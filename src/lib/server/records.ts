import type { Account, SessionUser } from "@/lib/auth/types"
import { isUserRole } from "@/lib/auth/types"
import type { Category, MasterLineItem } from "@/lib/catalog/types"
import { displayName, HttpError, nameInUse, uniqueUsername } from "@/lib/server/auth"
import { withDatabase, type Database } from "@/lib/server/db"
import { hashPassword } from "@/lib/server/password"
import { syncTicketOvertime, syncTicketTime } from "@/lib/server/sync"
import { createReference, nextTicketNumber } from "@/lib/tickets/numbering"
import { normalizeTicket } from "@/lib/tickets/normalize"
import {
  isTicketStatus,
  normalizeLineItem,
  type NewTicketInput,
  type Ticket,
  type TicketStatus,
} from "@/lib/tickets/types"
import { normalizeActivity } from "@/lib/calendar/normalize"
import type { Activity, NewActivityInput } from "@/lib/calendar/types"
import { hoursBetween, isLocalDateKey, parseHm } from "@/lib/datetime"
import { normalizeTimesheetEntry } from "@/lib/timesheet/normalize"
import type { NewTimesheetEntryInput, TimesheetEntry } from "@/lib/timesheet/types"

function nowIso(): string {
  return new Date().toISOString()
}

function categoryName(db: Database, categoryId: string | null): string {
  if (!categoryId) return ""
  return db.categories.find((category) => category.id === categoryId)?.name ?? ""
}

function presentTicket(db: Database, ticket: Ticket): Ticket {
  return normalizeTicket({ ...ticket, categoryName: categoryName(db, ticket.categoryId) })
}

function presentEntry(db: Database, entry: TimesheetEntry): TimesheetEntry {
  const userName = entry.userId ? (db.users.find((user) => user.id === entry.userId)?.name ?? entry.userName) : entry.userName
  return { ...entry, userName }
}

function presentActivity(db: Database, activity: Activity): Activity {
  const userName = activity.userId
    ? (db.users.find((user) => user.id === activity.userId)?.name ?? activity.userName)
    : activity.userName
  return { ...activity, userName }
}

function renameOwnedRows(db: Database, userId: string, name: string): void {
  for (const entry of db.timesheet) {
    if (entry.userId === userId) entry.userName = name
  }
  for (const activity of db.activities) {
    if (activity.userId === userId) activity.userName = name
  }
}

function visibleActivities(user: SessionUser, activities: Activity[]): Activity[] {
  if (user.role === "admin") return activities
  return activities.filter((activity) => activity.userId === user.id)
}

function parsedTime(value: string | undefined): string {
  const next = value?.trim() ?? ""
  if (!next) return ""
  if (!parseHm(next)) throw new HttpError("Enter a valid time.", 400)
  return next
}

function activityFields(input: {
  date?: string
  title?: string
  note?: string
  startTime?: string
  endTime?: string
  colour?: string
}): Pick<Activity, "date" | "title" | "note" | "startTime" | "endTime" | "colour"> {
  const date = input.date?.trim() ?? ""
  const title = input.title?.trim() ?? ""
  if (!isLocalDateKey(date)) throw new HttpError("Enter a date.", 400)
  if (!title) throw new HttpError("Enter a title.", 400)
  if (title.length > 120) throw new HttpError("Title must be 120 characters or fewer.", 400)
  return {
    date,
    title,
    note: input.note?.trim() ?? "",
    startTime: parsedTime(input.startTime),
    endTime: parsedTime(input.endTime),
    colour: input.colour?.trim() ?? "",
  }
}

function canSeeTicket(user: SessionUser, ticket: Ticket): boolean {
  if (user.role === "finance") return ticket.assignedToFinance
  return true
}

function applyMasterPrices(db: Database, items: Ticket["lineItems"]): Ticket["lineItems"] {
  return items.map((item) => {
    const normalized = normalizeLineItem(item)
    if (!normalized.masterLineItemId) return normalized
    const master = db.masterLineItems.find((row) => row.id === normalized.masterLineItemId)
    if (!master) return normalized
    return {
      ...normalized,
      description: master.description,
      price: master.price,
    }
  })
}

function editableTicketPatch(user: SessionUser, patch: Partial<Ticket>): Partial<Ticket> {
  if (user.role === "finance") {
    const next: Partial<Ticket> = {}
    if (patch.status === "processed" || patch.status === "to_process") next.status = patch.status
    if (typeof patch.paid === "boolean") next.paid = patch.paid
    if (typeof patch.quotePaid === "boolean") next.quotePaid = patch.quotePaid
    if (typeof patch.discount === "number") next.discount = patch.discount
    return next
  }
  const next: Partial<Ticket> = {}
  const textFields = [
    "nameSurname",
    "client",
    "clientEmail",
    "site",
    "requestedAt",
    "clientWorkDescription",
    "startTime",
    "endTime",
    "jobNumber",
    "completedAt",
    "actualWorkDone",
  ] as const
  for (const field of textFields) {
    if (typeof patch[field] === "string") next[field] = patch[field]
  }
  if (typeof patch.overtimeHours === "number") next.overtimeHours = patch.overtimeHours
  if (patch.hoursSpent === null || typeof patch.hoursSpent === "number") next.hoursSpent = patch.hoursSpent
  if (Array.isArray(patch.lineItems)) next.lineItems = patch.lineItems
  if (typeof patch.status === "string" && isTicketStatus(patch.status)) next.status = patch.status
  if (patch.categoryId === null || typeof patch.categoryId === "string") next.categoryId = patch.categoryId
  if (typeof patch.assignedToFinance === "boolean") next.assignedToFinance = patch.assignedToFinance
  if (typeof patch.paid === "boolean") next.paid = patch.paid
  if (typeof patch.quotePaid === "boolean") next.quotePaid = patch.quotePaid
  if (typeof patch.discount === "number") next.discount = patch.discount
  return next
}

export async function listTickets(user: SessionUser): Promise<Ticket[]> {
  return withDatabase((db) =>
    db.tickets
      .filter((ticket) => canSeeTicket(user, ticket))
      .map((ticket) => presentTicket(db, ticket))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  )
}

export async function getTicket(user: SessionUser, id: string): Promise<Ticket> {
  return withDatabase((db) => {
    const ticket = db.tickets.find((item) => item.id === id)
    if (!ticket || !canSeeTicket(user, ticket)) throw new HttpError("Ticket not found.", 404)
    return presentTicket(db, ticket)
  })
}

export async function createTicket(user: SessionUser, input: NewTicketInput): Promise<Ticket> {
  if (user.role === "finance") throw new HttpError("Finance can open assigned work orders.", 403)
  const client = input.client?.trim() ?? ""
  const clientEmail = input.clientEmail?.trim() ?? ""
  if (!client) throw new HttpError("Client name is required.", 400)
  if (!clientEmail) throw new HttpError("Client email is required.", 400)
  return withDatabase((db, markDirty) => {
    const issued = nextTicketNumber(db.sequences, db.tickets)
    const createdAt = nowIso()
    const ticket = normalizeTicket({
      id: crypto.randomUUID(),
      manageItId: null,
      ticketNumber: issued.ticketNumber,
      reference: createReference(),
      nameSurname: user.name,
      client,
      clientEmail,
      site: "",
      requestedAt: createdAt,
      clientWorkDescription: "",
      startTime: "",
      endTime: "",
      overtimeHours: 0,
      hoursSpent: null,
      jobNumber: "",
      completedAt: "",
      actualWorkDone: "",
      lineItems: [],
      discount: 0,
      status: "open",
      categoryId: null,
      categoryName: "",
      assignedToFinance: false,
      paid: false,
      quotePaid: false,
      accepted: false,
      issuerUserId: user.id,
      createdAt,
      updatedAt: createdAt,
    })
    db.tickets.unshift(ticket)
    db.sequences[issued.dayKey] = issued.sequence
    markDirty()
    return presentTicket(db, ticket)
  })
}

export async function updateTicket(user: SessionUser, id: string, patch: Partial<Ticket>): Promise<Ticket> {
  return withDatabase((db, markDirty) => {
    const index = db.tickets.findIndex((ticket) => ticket.id === id)
    if (index < 0) throw new HttpError("Ticket not found.", 404)
    const existing = db.tickets[index]
    if (!canSeeTicket(user, existing)) throw new HttpError("Ticket not found.", 404)
    const allowed = editableTicketPatch(user, patch)
    let status: TicketStatus = existing.status
    if (allowed.status && isTicketStatus(allowed.status)) status = allowed.status
    if (status === "to_process" && !allowed.completedAt && !existing.completedAt) {
      allowed.completedAt = nowIso()
    }
    const startTime = allowed.startTime ?? existing.startTime
    const endTime = allowed.endTime ?? existing.endTime
    if (status === "open" && startTime && endTime) status = "in_progress"
    if (existing.status === "to_process" || existing.status === "processed" || existing.status === "complete") {
      if (status === "in_progress" && allowed.status !== "in_progress") status = existing.status
    }
    const categoryId = allowed.categoryId === undefined ? existing.categoryId : allowed.categoryId
    const lineItems = applyMasterPrices(db, allowed.lineItems ?? existing.lineItems)
    const next = normalizeTicket({
      ...existing,
      ...allowed,
      lineItems,
      status,
      categoryId: categoryId || null,
      categoryName: categoryName(db, categoryId || null),
      id: existing.id,
      manageItId: existing.manageItId,
      ticketNumber: existing.ticketNumber,
      reference: existing.reference,
      issuerUserId: existing.issuerUserId,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    })
    db.tickets[index] = next
    syncTicketTime(db, next)
    syncTicketOvertime(db, next)
    markDirty()
    return presentTicket(db, next)
  })
}

export async function deleteTicket(user: SessionUser, id: string): Promise<void> {
  if (user.role === "finance") throw new HttpError("Finance cannot delete tickets.", 403)
  return withDatabase((db, markDirty) => {
    const ticket = db.tickets.find((item) => item.id === id)
    if (!ticket) throw new HttpError("Ticket not found.", 404)
    db.tickets = db.tickets.filter((item) => item.id !== id)
    markDirty()
  })
}

function visibleEntries(user: SessionUser, entries: TimesheetEntry[]): TimesheetEntry[] {
  if (user.role === "admin") return entries
  return entries.filter((entry) => entry.userId === user.id)
}

export async function listTimesheet(user: SessionUser): Promise<TimesheetEntry[]> {
  return withDatabase((db) =>
    visibleEntries(user, db.timesheet)
      .map((entry) => presentEntry(db, entry))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
  )
}

export async function createTimesheetEntry(user: SessionUser, input: NewTimesheetEntryInput): Promise<TimesheetEntry> {
  const hours = hoursBetween(input.startTime, input.endTime) || input.hours
  if (!(hours > 0)) throw new HttpError("Enter a start and end time.", 400)
  return withDatabase((db, markDirty) => {
    const createdAt = nowIso()
    const entry = normalizeTimesheetEntry({
      id: crypto.randomUUID(),
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      hours,
      isOvertime: Boolean(input.isOvertime),
      ticketId: input.ticketId ?? null,
      note: input.note?.trim() ?? "",
      userId: user.id,
      userName: user.name,
      createdAt,
      updatedAt: createdAt,
    })
    db.timesheet.push(entry)
    markDirty()
    return presentEntry(db, entry)
  })
}

export async function updateTimesheetEntry(
  user: SessionUser,
  id: string,
  patch: Partial<TimesheetEntry>
): Promise<TimesheetEntry> {
  return withDatabase((db, markDirty) => {
    const index = db.timesheet.findIndex((entry) => entry.id === id)
    if (index < 0) throw new HttpError("Timesheet entry not found.", 404)
    const existing = db.timesheet[index]
    if (user.role !== "admin" && existing.userId !== user.id) {
      throw new HttpError("Timesheet entry not found.", 404)
    }
    const startTime = patch.startTime ?? existing.startTime
    const endTime = patch.endTime ?? existing.endTime
    const next = normalizeTimesheetEntry({
      ...existing,
      ...patch,
      startTime,
      endTime,
      hours: hoursBetween(startTime, endTime) || patch.hours || existing.hours,
      id: existing.id,
      userId: existing.userId,
      userName: existing.userName,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    })
    db.timesheet[index] = next
    markDirty()
    return presentEntry(db, next)
  })
}

export async function deleteTimesheetEntry(user: SessionUser, id: string): Promise<void> {
  return withDatabase((db, markDirty) => {
    const existing = db.timesheet.find((entry) => entry.id === id)
    if (!existing) throw new HttpError("Timesheet entry not found.", 404)
    if (user.role !== "admin" && existing.userId !== user.id) {
      throw new HttpError("Timesheet entry not found.", 404)
    }
    db.timesheet = db.timesheet.filter((entry) => entry.id !== id)
    markDirty()
  })
}

export async function listActivities(user: SessionUser): Promise<Activity[]> {
  return withDatabase((db) =>
    visibleActivities(user, db.activities)
      .map((activity) => presentActivity(db, activity))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.startTime || "99:99").localeCompare(b.startTime || "99:99") ||
          a.title.localeCompare(b.title)
      )
  )
}

export async function createActivity(user: SessionUser, input: NewActivityInput): Promise<Activity> {
  const fields = activityFields(input)
  return withDatabase((db, markDirty) => {
    const createdAt = nowIso()
    const activity = normalizeActivity({
      id: crypto.randomUUID(),
      ...fields,
      userId: user.id,
      userName: user.name,
      createdAt,
      updatedAt: createdAt,
    })
    db.activities.push(activity)
    markDirty()
    return presentActivity(db, activity)
  })
}

export async function updateActivity(
  user: SessionUser,
  id: string,
  patch: Partial<Activity>
): Promise<Activity> {
  return withDatabase((db, markDirty) => {
    const index = db.activities.findIndex((activity) => activity.id === id)
    if (index < 0) throw new HttpError("Activity not found.", 404)
    const existing = db.activities[index]
    if (user.role !== "admin" && existing.userId !== user.id) {
      throw new HttpError("Activity not found.", 404)
    }
    const fields = activityFields({
      date: patch.date ?? existing.date,
      title: patch.title ?? existing.title,
      note: patch.note ?? existing.note,
      startTime: patch.startTime ?? existing.startTime,
      endTime: patch.endTime ?? existing.endTime,
      colour: patch.colour ?? existing.colour,
    })
    const next = normalizeActivity({
      ...existing,
      ...fields,
      id: existing.id,
      userId: existing.userId,
      userName: existing.userName,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    })
    db.activities[index] = next
    markDirty()
    return presentActivity(db, next)
  })
}

export async function deleteActivity(user: SessionUser, id: string): Promise<void> {
  return withDatabase((db, markDirty) => {
    const existing = db.activities.find((activity) => activity.id === id)
    if (!existing) throw new HttpError("Activity not found.", 404)
    if (user.role !== "admin" && existing.userId !== user.id) {
      throw new HttpError("Activity not found.", 404)
    }
    db.activities = db.activities.filter((activity) => activity.id !== id)
    markDirty()
  })
}

export async function listCategories(): Promise<Category[]> {
  return withDatabase((db) => [...db.categories].sort((a, b) => a.name.localeCompare(b.name)))
}

export async function createCategory(name: string): Promise<Category> {
  const trimmed = name.trim()
  if (!trimmed) throw new HttpError("Category name is required.", 400)
  return withDatabase((db, markDirty) => {
    if (db.categories.some((category) => category.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new HttpError("That category already exists.", 400)
    }
    const category = { id: crypto.randomUUID(), name: trimmed, createdAt: nowIso() }
    db.categories.push(category)
    markDirty()
    return category
  })
}

export async function updateCategory(id: string, name: string): Promise<Category> {
  const trimmed = name.trim()
  if (!trimmed) throw new HttpError("Category name is required.", 400)
  return withDatabase((db, markDirty) => {
    const index = db.categories.findIndex((category) => category.id === id)
    if (index < 0) throw new HttpError("Category not found.", 404)
    db.categories[index] = { ...db.categories[index], name: trimmed }
    for (const ticket of db.tickets) {
      if (ticket.categoryId === id) ticket.categoryName = trimmed
    }
    markDirty()
    return db.categories[index]
  })
}

export async function deleteCategory(id: string): Promise<void> {
  return withDatabase((db, markDirty) => {
    db.categories = db.categories.filter((category) => category.id !== id)
    for (const ticket of db.tickets) {
      if (ticket.categoryId === id) {
        ticket.categoryId = null
        ticket.categoryName = ""
      }
    }
    markDirty()
  })
}

export async function listMasterLineItems(): Promise<MasterLineItem[]> {
  return withDatabase((db) =>
    [...db.masterLineItems].sort((a, b) => a.description.localeCompare(b.description))
  )
}

export async function createMasterLineItem(description: string, price: number): Promise<MasterLineItem> {
  const trimmed = description.trim()
  if (!trimmed) throw new HttpError("Line item description is required.", 400)
  if (!Number.isFinite(price) || price < 0) throw new HttpError("Enter a price of zero or more.", 400)
  return withDatabase((db, markDirty) => {
    const createdAt = nowIso()
    const item = {
      id: crypto.randomUUID(),
      description: trimmed,
      price,
      createdAt,
      updatedAt: createdAt,
    }
    db.masterLineItems.push(item)
    markDirty()
    return item
  })
}

export async function updateMasterLineItem(
  id: string,
  description: string,
  price: number
): Promise<MasterLineItem> {
  const trimmed = description.trim()
  if (!trimmed) throw new HttpError("Line item description is required.", 400)
  if (!Number.isFinite(price) || price < 0) throw new HttpError("Enter a price of zero or more.", 400)
  return withDatabase((db, markDirty) => {
    const index = db.masterLineItems.findIndex((item) => item.id === id)
    if (index < 0) throw new HttpError("Line item not found.", 404)
    const next = { ...db.masterLineItems[index], description: trimmed, price, updatedAt: nowIso() }
    db.masterLineItems[index] = next
    markDirty()
    return next
  })
}

export async function deleteMasterLineItem(id: string): Promise<void> {
  return withDatabase((db, markDirty) => {
    db.masterLineItems = db.masterLineItems.filter((item) => item.id !== id)
    markDirty()
  })
}

function publicAccount(user: Database["users"][number]): Account {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  }
}

export async function listUsers(): Promise<Account[]> {
  return withDatabase((db) => db.users.map(publicAccount).sort((a, b) => a.name.localeCompare(b.name)))
}

export async function createUser(input: {
  name: string
  password: string
  role: string
}): Promise<Account> {
  const name = displayName(input.name)
  const password = input.password.trim()
  if (password.length < 4) throw new HttpError("Password must be at least 4 characters.", 400)
  if (!isUserRole(input.role)) throw new HttpError("Choose admin, user, or finance.", 400)
  const role = input.role
  return withDatabase((db, markDirty) => {
    if (nameInUse(db.users, name)) {
      throw new HttpError("That name is already in use.", 400)
    }
    const user = {
      id: crypto.randomUUID(),
      name,
      username: uniqueUsername(db.users, name),
      passwordHash: hashPassword(password),
      role,
      createdAt: nowIso(),
    }
    db.users.push(user)
    markDirty()
    return publicAccount(user)
  })
}

export async function updateUser(
  actor: SessionUser,
  id: string,
  input: { name?: string; role?: string; password?: string }
): Promise<Account> {
  return withDatabase((db, markDirty) => {
    const index = db.users.findIndex((user) => user.id === id)
    if (index < 0) throw new HttpError("User not found.", 404)
    const existing = db.users[index]
    const name = input.name != null ? displayName(input.name) : existing.name
    const role = input.role && isUserRole(input.role) ? input.role : existing.role
    const admins = db.users.filter((user) => user.role === "admin")
    if (existing.role === "admin" && role !== "admin" && admins.length <= 1) {
      throw new HttpError("Keep at least one admin.", 400)
    }
    if (nameInUse(db.users, name, id)) {
      throw new HttpError("That name is already in use.", 400)
    }
    const next = { ...existing, name, username: uniqueUsername(db.users, name, id), role }
    const password = input.password?.trim() ?? ""
    if (password) {
      if (password.length < 4) throw new HttpError("Password must be at least 4 characters.", 400)
      next.passwordHash = hashPassword(password)
    }
    db.users[index] = next
    renameOwnedRows(db, id, name)
    if (actor.id === id && role !== "admin" && existing.role === "admin") {
      throw new HttpError("Ask another admin to change your role.", 400)
    }
    markDirty()
    return publicAccount(next)
  })
}

export async function deleteUser(actor: SessionUser, id: string): Promise<void> {
  if (actor.id === id) throw new HttpError("You cannot remove your own account.", 400)
  return withDatabase((db, markDirty) => {
    const existing = db.users.find((user) => user.id === id)
    if (!existing) throw new HttpError("User not found.", 404)
    const admins = db.users.filter((user) => user.role === "admin")
    if (existing.role === "admin" && admins.length <= 1) {
      throw new HttpError("Keep at least one admin.", 400)
    }
    db.users = db.users.filter((user) => user.id !== id)
    db.sessions = db.sessions.filter((session) => session.userId !== id)
    markDirty()
  })
}

const DATA_TABLES = ["users", "categories", "masterLineItems", "tickets", "timesheet", "activities"] as const
export type DataTableName = (typeof DATA_TABLES)[number]

function isDataTable(value: string): value is DataTableName {
  return DATA_TABLES.includes(value as DataTableName)
}

function tableRows(db: Database, table: DataTableName): Record<string, unknown>[] {
  if (table === "users") {
    return db.users.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    }))
  }
  return db[table] as unknown as Record<string, unknown>[]
}

export async function databaseSummary(): Promise<{ table: DataTableName; count: number }[]> {
  return withDatabase((db) =>
    DATA_TABLES.map((table) => ({ table, count: tableRows(db, table).length }))
  )
}

export async function databaseTable(table: string): Promise<Record<string, unknown>[]> {
  if (!isDataTable(table)) throw new HttpError("Unknown table.", 404)
  return withDatabase((db) => tableRows(db, table))
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const lines = [headers.join(",")]
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","))
  }
  return lines.join("\n")
}

function csvCell(value: unknown): string {
  const text =
    value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

type ImportBody = {
  tickets?: Partial<Ticket>[]
  entries?: Partial<TimesheetEntry>[]
  sequences?: Record<string, number>
}

export async function importBrowserData(user: SessionUser, body: ImportBody): Promise<{ tickets: number; entries: number }> {
  return withDatabase((db, markDirty) => {
    let tickets = 0
    let entries = 0
    const existingTickets = new Set(db.tickets.map((ticket) => ticket.id))
    for (const raw of body.tickets ?? []) {
      if (!raw || typeof raw.id !== "string" || existingTickets.has(raw.id)) continue
      const ticket = normalizeTicket({
        ...raw,
        id: raw.id,
        issuerUserId: raw.issuerUserId ?? user.id,
        nameSurname: raw.nameSurname?.trim() ? raw.nameSurname : user.name,
      })
      db.tickets.push(ticket)
      existingTickets.add(ticket.id)
      tickets += 1
    }
    const existingEntries = new Set(db.timesheet.map((entry) => entry.id))
    for (const raw of body.entries ?? []) {
      if (!raw || typeof raw.id !== "string" || existingEntries.has(raw.id)) continue
      db.timesheet.push(
        normalizeTimesheetEntry({
          ...raw,
          id: raw.id,
          userId: raw.userId ?? user.id,
          userName: raw.userName?.trim() ? raw.userName : user.name,
        })
      )
      existingEntries.add(raw.id)
      entries += 1
    }
    for (const [dayKey, sequence] of Object.entries(body.sequences ?? {})) {
      const value = Number(sequence)
      if (!Number.isFinite(value)) continue
      db.sequences[dayKey] = Math.max(db.sequences[dayKey] ?? 0, value)
    }
    if (tickets > 0 || entries > 0) markDirty()
    return { tickets, entries }
  })
}

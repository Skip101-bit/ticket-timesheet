import { addHoursToTime, hoursBetween, isoToDateKey, toLocalDateKey } from "@/lib/datetime"
import type { Database } from "@/lib/server/db"
import { ticketWorkHours } from "@/lib/tickets/normalize"
import type { Ticket } from "@/lib/tickets/types"
import { isTicketAutoLogEntry } from "@/lib/timesheet/overtime"
import { normalizeTimesheetEntry } from "@/lib/timesheet/normalize"
import type { TimesheetEntry } from "@/lib/timesheet/types"

function nowIso(): string {
  return new Date().toISOString()
}

function ticketWorkDate(ticket: Ticket): string {
  return isoToDateKey(ticket.completedAt) ?? isoToDateKey(ticket.requestedAt) ?? toLocalDateKey(new Date())
}

function userName(db: Database, userId: string | null): string {
  if (!userId) return ""
  return db.users.find((user) => user.id === userId)?.name ?? ""
}

function listForTicket(db: Database, ticketId: string): TimesheetEntry[] {
  return db.timesheet.filter((entry) => entry.ticketId === ticketId)
}

export function syncTicketTime(db: Database, ticket: Ticket): void {
  const hours = ticketWorkHours(ticket)
  const matches = listForTicket(db, ticket.id)
  const existing =
    matches.find((entry) => isTicketAutoLogEntry(entry, ticket)) ??
    matches.find((entry) => entry.isOvertime !== true) ??
    matches.find((entry) => entry.note === ticket.ticketNumber)

  if (hours <= 0) {
    if (existing && existing.note === ticket.ticketNumber) {
      db.timesheet = db.timesheet.filter((entry) => entry.id !== existing.id)
    }
    return
  }

  const date = ticketWorkDate(ticket)
  const startTime = ticket.startTime || "08:00"
  const endTime = ticket.endTime || addHoursToTime(startTime, hours)
  const userId = ticket.issuerUserId
  const payload = {
    date,
    startTime,
    endTime,
    hours,
    isOvertime: false,
    note: ticket.ticketNumber,
    userId,
    userName: userName(db, userId),
  }

  if (existing) {
    const index = db.timesheet.findIndex((entry) => entry.id === existing.id)
    db.timesheet[index] = normalizeTimesheetEntry({
      ...existing,
      ...payload,
      id: existing.id,
      ticketId: ticket.id,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    })
    return
  }

  const createdAt = nowIso()
  db.timesheet.push(
    normalizeTimesheetEntry({
      id: crypto.randomUUID(),
      ...payload,
      ticketId: ticket.id,
      createdAt,
      updatedAt: createdAt,
    })
  )
}

export function syncTicketOvertime(db: Database, ticket: Ticket): void {
  const hours = ticket.overtimeHours
  const existing = listForTicket(db, ticket.id).find(
    (entry) => entry.isOvertime === true && !isTicketAutoLogEntry(entry, ticket)
  )

  if (!(hours > 0)) {
    if (existing) db.timesheet = db.timesheet.filter((entry) => entry.id !== existing.id)
    return
  }

  const startTime = ticket.endTime || "17:00"
  const endTime = addHoursToTime(startTime, hours)
  const userId = ticket.issuerUserId
  const payload = {
    date: ticketWorkDate(ticket),
    startTime,
    endTime,
    hours: hoursBetween(startTime, endTime) || hours,
    isOvertime: true,
    note: `${ticket.ticketNumber} overtime`,
    userId,
    userName: userName(db, userId),
  }

  if (existing) {
    const index = db.timesheet.findIndex((entry) => entry.id === existing.id)
    db.timesheet[index] = normalizeTimesheetEntry({
      ...existing,
      ...payload,
      id: existing.id,
      ticketId: ticket.id,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    })
    return
  }

  const createdAt = nowIso()
  db.timesheet.push(
    normalizeTimesheetEntry({
      id: crypto.randomUUID(),
      ...payload,
      ticketId: ticket.id,
      createdAt,
      updatedAt: createdAt,
    })
  )
}

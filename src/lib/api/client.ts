import type { Activity, NewActivityInput } from "@/lib/calendar/types"
import type { Account, SessionUser } from "@/lib/auth/types"
import type { Category, MasterLineItem } from "@/lib/catalog/types"
import { TICKET_STORE_KEY } from "@/lib/tickets/local-store"
import type { OpenedEmailResult } from "@/lib/tickets/opened-email"
import type { NewTicketInput, Ticket } from "@/lib/tickets/types"
import { TIMESHEET_STORE_KEY } from "@/lib/timesheet/local-store"
import type { NewTimesheetEntryInput, TimesheetEntry } from "@/lib/timesheet/types"

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (response.status === 401 && !path.startsWith("/api/auth/login") && !path.startsWith("/api/auth/setup")) {
    window.dispatchEvent(new Event("roboware:unauthorized"))
  }
  if (!response.ok) {
    throw new ApiError(data.error || "Request failed.", response.status)
  }
  return data
}

export const api = {
  me: () => request<{ user: SessionUser }>("/api/auth/me"),
  login: (name: string, password: string) =>
    request<{ user: SessionUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ name, username: name, password }),
    }),
  register: (input: { name: string; password: string; role: "admin" | "user" }) =>
    request<{ user: SessionUser }>("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateAccount: (input: { name: string; password?: string }) =>
    request<{ user: SessionUser }>("/api/auth/account", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  listTickets: () => request<{ tickets: Ticket[] }>("/api/tickets").then((data) => data.tickets),
  getTicket: (id: string) => request<{ ticket: Ticket }>(`/api/tickets/${id}`).then((data) => data.ticket),
  createTicket: (input: NewTicketInput) =>
    request<{ ticket: Ticket }>("/api/tickets", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((data) => data.ticket),
  sendOpenedTicketEmail: (id: string, to: string) =>
    request<OpenedEmailResult>(`/api/tickets/${id}/opened-email`, {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
  sendWorkOrderEmail: (id: string, to: string) =>
    request<OpenedEmailResult>(`/api/tickets/${id}/work-order-email`, {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
  updateTicket: (id: string, patch: Partial<Ticket>) =>
    request<{ ticket: Ticket }>(`/api/tickets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).then((data) => data.ticket),
  deleteTicket: (id: string) => request<{ ok: boolean }>(`/api/tickets/${id}`, { method: "DELETE" }),
  listTimesheet: () =>
    request<{ entries: TimesheetEntry[] }>("/api/timesheet").then((data) => data.entries),
  createTimesheetEntry: (input: NewTimesheetEntryInput) =>
    request<{ entry: TimesheetEntry }>("/api/timesheet", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((data) => data.entry),
  updateTimesheetEntry: (id: string, patch: Partial<TimesheetEntry>) =>
    request<{ entry: TimesheetEntry }>(`/api/timesheet/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).then((data) => data.entry),
  deleteTimesheetEntry: (id: string) =>
    request<{ ok: boolean }>(`/api/timesheet/${id}`, { method: "DELETE" }),
  listActivities: () =>
    request<{ activities: Activity[] }>("/api/activities").then((data) => data.activities),
  createActivity: (input: NewActivityInput) =>
    request<{ activity: Activity }>("/api/activities", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((data) => data.activity),
  updateActivity: (id: string, patch: Partial<Activity>) =>
    request<{ activity: Activity }>(`/api/activities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).then((data) => data.activity),
  deleteActivity: (id: string) =>
    request<{ ok: boolean }>(`/api/activities/${id}`, { method: "DELETE" }),
  listCategories: () => request<{ categories: Category[] }>("/api/categories").then((data) => data.categories),
  createCategory: (name: string) =>
    request<{ category: Category }>("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name }),
    }).then((data) => data.category),
  updateCategory: (id: string, name: string) =>
    request<{ category: Category }>(`/api/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }).then((data) => data.category),
  deleteCategory: (id: string) => request<{ ok: boolean }>(`/api/categories/${id}`, { method: "DELETE" }),
  listLineItems: () =>
    request<{ lineItems: MasterLineItem[] }>("/api/line-items").then((data) => data.lineItems),
  createLineItem: (description: string, price: number) =>
    request<{ lineItem: MasterLineItem }>("/api/line-items", {
      method: "POST",
      body: JSON.stringify({ description, price }),
    }).then((data) => data.lineItem),
  updateLineItem: (id: string, description: string, price: number) =>
    request<{ lineItem: MasterLineItem }>(`/api/line-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ description, price }),
    }).then((data) => data.lineItem),
  deleteLineItem: (id: string) => request<{ ok: boolean }>(`/api/line-items/${id}`, { method: "DELETE" }),
  listUsers: () => request<{ users: Account[] }>("/api/users").then((data) => data.users),
  createUser: (input: { name: string; password: string; role: string }) =>
    request<{ user: Account }>("/api/users", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((data) => data.user),
  updateUser: (id: string, input: { name?: string; role?: string; password?: string }) =>
    request<{ user: Account }>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }).then((data) => data.user),
  deleteUser: (id: string) => request<{ ok: boolean }>(`/api/users/${id}`, { method: "DELETE" }),
  databaseSummary: () =>
    request<{ tables: { table: string; count: number }[]; file: string }>("/api/data"),
  databaseTable: (table: string) =>
    request<{ rows: Record<string, unknown>[] }>(`/api/data?table=${encodeURIComponent(table)}`).then(
      (data) => data.rows
    ),
}

const IMPORTED_KEY = "roboware.db.imported"

export async function importBrowserDataOnce(): Promise<void> {
  if (window.localStorage.getItem(IMPORTED_KEY) === "1") return
  let tickets: unknown[] = []
  let entries: unknown[] = []
  let sequences: Record<string, number> = {}
  try {
    const raw = window.localStorage.getItem(TICKET_STORE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { tickets?: unknown[]; sequences?: Record<string, number> } | unknown[]
      if (Array.isArray(parsed)) tickets = parsed
      else {
        tickets = parsed.tickets ?? []
        sequences = parsed.sequences ?? {}
      }
    }
  } catch {
    tickets = []
  }
  try {
    const raw = window.localStorage.getItem(TIMESHEET_STORE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { entries?: unknown[] }
      entries = parsed.entries ?? []
    }
  } catch {
    entries = []
  }
  if (tickets.length === 0 && entries.length === 0) {
    window.localStorage.setItem(IMPORTED_KEY, "1")
    return
  }
  await request("/api/import", {
    method: "POST",
    body: JSON.stringify({ tickets, entries, sequences }),
  })
  window.localStorage.setItem(IMPORTED_KEY, "1")
}

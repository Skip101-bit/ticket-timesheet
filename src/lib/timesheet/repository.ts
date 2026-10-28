import { hoursBetween } from "@/lib/datetime"
import { normalizeTimesheetEntry } from "@/lib/timesheet/normalize"
import { readTimesheetStore, writeTimesheetStore } from "@/lib/timesheet/local-store"
import type { NewTimesheetEntryInput, TimesheetEntry } from "@/lib/timesheet/types"

export interface TimesheetRepository {
  list(): TimesheetEntry[]
  create(input: NewTimesheetEntryInput): TimesheetEntry
  update(id: string, patch: Partial<TimesheetEntry>): TimesheetEntry
  delete(id: string): void
  upsertForTicket(input: NewTimesheetEntryInput & { ticketId: string }): TimesheetEntry
}

function nowIso(): string {
  return new Date().toISOString()
}

function withHours(input: NewTimesheetEntryInput): NewTimesheetEntryInput {
  const hours = hoursBetween(input.startTime, input.endTime) || input.hours
  return { ...input, hours }
}

export const localTimesheetRepository: TimesheetRepository = {
  list() {
    return readTimesheetStore()
      .entries.map((entry) => normalizeTimesheetEntry(entry))
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date)
        if (byDate !== 0) return byDate
        return a.startTime.localeCompare(b.startTime) || a.createdAt.localeCompare(b.createdAt)
      })
  },

  create(input) {
    const store = readTimesheetStore()
    const createdAt = nowIso()
    const ready = withHours(input)
    const entry = normalizeTimesheetEntry({
      id: crypto.randomUUID(),
      date: ready.date,
      startTime: ready.startTime,
      endTime: ready.endTime,
      hours: ready.hours,
      isOvertime: ready.isOvertime ?? false,
      ticketId: ready.ticketId ?? null,
      note: ready.note?.trim() ?? "",
      userId: null,
      userName: "",
      createdAt,
      updatedAt: createdAt,
    })
    writeTimesheetStore({
      version: 1,
      entries: [...store.entries.map((item) => normalizeTimesheetEntry(item)), entry],
    })
    return entry
  },

  update(id, patch) {
    const store = readTimesheetStore()
    const entries = store.entries.map((item) => normalizeTimesheetEntry(item))
    const index = entries.findIndex((entry) => entry.id === id)
    if (index < 0) {
      throw new Error("Timesheet entry not found.")
    }
    const existing = entries[index]
    const next = normalizeTimesheetEntry({
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    })
    entries[index] = next
    writeTimesheetStore({ version: 1, entries })
    return next
  },

  delete(id) {
    const store = readTimesheetStore()
    writeTimesheetStore({
      version: 1,
      entries: store.entries
        .map((item) => normalizeTimesheetEntry(item))
        .filter((entry) => entry.id !== id),
    })
  },

  upsertForTicket(input) {
    const ready = withHours(input)
    const existing = this.list().find(
      (entry) => entry.ticketId === input.ticketId && entry.isOvertime !== true
    )
    if (existing) {
      return this.update(existing.id, {
        date: ready.date,
        startTime: ready.startTime,
        endTime: ready.endTime,
        hours: ready.hours,
        isOvertime: false,
        note: ready.note ?? existing.note,
      })
    }
    return this.create(ready)
  },
}

import { addHoursToTime, hoursBetween } from "@/lib/datetime"
import type { TimesheetEntry } from "@/lib/timesheet/types"

export function normalizeTimesheetEntry(
  raw: Partial<TimesheetEntry> & { id: string }
): TimesheetEntry {
  const hours = Number.isFinite(raw.hours) ? Number(raw.hours) : 0
  const startTime = raw.startTime || "08:00"
  const endTime = raw.endTime || (hours > 0 ? addHoursToTime(startTime, hours) : "16:00")
  const computed = hoursBetween(startTime, endTime)
  return {
    id: raw.id,
    date: raw.date ?? "",
    startTime,
    endTime,
    hours: computed > 0 ? computed : hours,
    isOvertime: Boolean(raw.isOvertime),
    ticketId: raw.ticketId ?? null,
    note: raw.note ?? "",
    userId: raw.userId ?? null,
    userName: raw.userName ?? "",
    createdAt: raw.createdAt ?? "",
    updatedAt: raw.updatedAt ?? "",
  }
}

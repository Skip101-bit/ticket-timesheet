import type { TimesheetStoreSnapshot } from "@/lib/timesheet/types"

export const TIMESHEET_STORE_KEY = "roboware.timesheet.v2"

export class TimesheetStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "TimesheetStoreError"
  }
}

function emptyStore(): TimesheetStoreSnapshot {
  return { version: 1, entries: [] }
}

export function readTimesheetStore(): TimesheetStoreSnapshot {
  try {
    const raw = window.localStorage.getItem(TIMESHEET_STORE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as Partial<TimesheetStoreSnapshot>
    if (!parsed || !Array.isArray(parsed.entries)) {
      throw new TimesheetStoreError("Saved timesheet data is unreadable.")
    }
    return { version: 1, entries: parsed.entries }
  } catch (error) {
    if (error instanceof TimesheetStoreError) throw error
    throw new TimesheetStoreError("Could not read timesheet from this browser.", { cause: error })
  }
}

export function writeTimesheetStore(store: TimesheetStoreSnapshot): void {
  try {
    window.localStorage.setItem(TIMESHEET_STORE_KEY, JSON.stringify(store))
  } catch (error) {
    throw new TimesheetStoreError("Could not save timesheet in this browser.", { cause: error })
  }
}

export type TimesheetEntry = {
  id: string
  date: string
  startTime: string
  endTime: string
  hours: number
  isOvertime: boolean
  ticketId: string | null
  note: string
  userId: string | null
  userName: string
  createdAt: string
  updatedAt: string
}

export type TimesheetStoreSnapshot = {
  version: 1
  entries: TimesheetEntry[]
}

export type NewTimesheetEntryInput = {
  date: string
  startTime: string
  endTime: string
  hours: number
  isOvertime?: boolean
  ticketId?: string | null
  note?: string
}

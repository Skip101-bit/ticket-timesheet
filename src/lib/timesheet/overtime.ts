import { ticketWorkHours } from "@/lib/tickets/normalize"
import type { Ticket } from "@/lib/tickets/types"
import type { TimesheetEntry } from "@/lib/timesheet/types"

export const NORMAL_DAY_HOURS = 8
export const NORMAL_WEEK_HOURS = 40

export function dailyOvertime(hours: number): number {
  return Math.max(0, hours - NORMAL_DAY_HOURS)
}

export function weeklyOvertime(weekTotal: number): number {
  return Math.max(0, weekTotal - NORMAL_WEEK_HOURS)
}

export type WeekOvertimeSummary = {
  weekTotal: number
  dailyOtTotal: number
  weeklyOt: number
  explicitOt: number
  countedOt: number
  regular: number
}

export function summarizeWeekOvertime(dailyHours: number[]): WeekOvertimeSummary {
  const weekTotal = dailyHours.reduce((sum, hours) => sum + hours, 0)
  const dailyOtTotal = dailyHours.reduce((sum, hours) => sum + dailyOvertime(hours), 0)
  const weeklyOt = weeklyOvertime(weekTotal)
  const countedOt = Math.max(dailyOtTotal, weeklyOt)
  return {
    weekTotal,
    dailyOtTotal,
    weeklyOt,
    explicitOt: 0,
    countedOt,
    regular: weekTotal - countedOt,
  }
}

export function summarizeWeekEntries(dayEntries: TimesheetEntry[][]): WeekOvertimeSummary {
  const dailyRegular = dayEntries.map((entries) =>
    entries.filter((entry) => !entry.isOvertime).reduce((sum, entry) => sum + entry.hours, 0)
  )
  const explicitOt = dayEntries
    .flat()
    .filter((entry) => entry.isOvertime)
    .reduce((sum, entry) => sum + entry.hours, 0)
  const weekRegular = dailyRegular.reduce((sum, hours) => sum + hours, 0)
  const weekTotal = weekRegular + explicitOt
  const dailyOtTotal = dailyRegular.reduce((sum, hours) => sum + dailyOvertime(hours), 0)
  const weeklyOt = weeklyOvertime(weekRegular)
  const countedOt = explicitOt + Math.max(dailyOtTotal, weeklyOt)
  return {
    weekTotal,
    dailyOtTotal,
    weeklyOt,
    explicitOt,
    countedOt,
    regular: weekTotal - countedOt,
  }
}

export function sumExplicitOvertimeHours(entries: TimesheetEntry[]): number {
  return entries.reduce((sum, entry) => {
    if (entry.isOvertime !== true) return sum
    const hours = Number(entry.hours)
    return Number.isFinite(hours) && hours > 0 ? sum + hours : sum
  }, 0)
}

/** The auto-logged ticket start/end row is regular time, even if it was wrongly flagged OT. */
export function isTicketAutoLogEntry(entry: TimesheetEntry, ticket: Ticket): boolean {
  if (entry.ticketId !== ticket.id) return false
  if (ticket.startTime && ticket.endTime) {
    return entry.startTime === ticket.startTime && entry.endTime === ticket.endTime
  }
  const hours = ticketWorkHours(ticket)
  return hours > 0 && entry.hours === hours && entry.note === ticket.ticketNumber
}

function isEmailOvertimeEntry(entry: TimesheetEntry, ticket: Ticket): boolean {
  return entry.isOvertime === true && !isTicketAutoLogEntry(entry, ticket)
}

export function overtimeByClient(
  entries: TimesheetEntry[],
  tickets: Ticket[]
): { client: string; hours: number }[] {
  const totals = new Map<string, number>()
  for (const entry of entries) {
    if (entry.hours <= 0) continue
    const ticket = tickets.find((item) => item.id === entry.ticketId)
    if (!ticket || !isEmailOvertimeEntry(entry, ticket)) continue
    const client = ticket.client.trim() || "Unassigned"
    totals.set(client, (totals.get(client) ?? 0) + entry.hours)
  }
  return [...totals.entries()]
    .map(([client, hours]) => ({ client, hours }))
    .sort((a, b) => b.hours - a.hours)
}

export function overtimeHoursForTicket(entries: TimesheetEntry[], ticket: Ticket): number {
  return sumExplicitOvertimeHours(
    entries.filter((entry) => entry.ticketId === ticket.id && isEmailOvertimeEntry(entry, ticket))
  )
}

export function overtimeHoursForClient(
  entries: TimesheetEntry[],
  tickets: Ticket[],
  client: string
): number {
  const clientTickets = tickets.filter((ticket) => ticket.client.trim() === client.trim())
  const ids = new Set(clientTickets.map((ticket) => ticket.id))
  return sumExplicitOvertimeHours(
    entries.filter((entry) => {
      if (!entry.ticketId || !ids.has(entry.ticketId)) return false
      const ticket = clientTickets.find((item) => item.id === entry.ticketId)
      return Boolean(ticket && isEmailOvertimeEntry(entry, ticket))
    })
  )
}

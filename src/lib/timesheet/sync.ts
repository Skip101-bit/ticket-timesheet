import { addHoursToTime, hoursBetween, isoToDateKey, toLocalDateKey } from "@/lib/datetime"
import { ticketWorkHours } from "@/lib/tickets/normalize"
import type { Ticket } from "@/lib/tickets/types"
import { isTicketAutoLogEntry } from "@/lib/timesheet/overtime"
import { localTimesheetRepository } from "@/lib/timesheet/repository"
import type { TimesheetEntry } from "@/lib/timesheet/types"

function ticketWorkDate(ticket: Ticket): string {
  return isoToDateKey(ticket.completedAt) ?? isoToDateKey(ticket.requestedAt) ?? toLocalDateKey(new Date())
}

export function syncTicketToTimesheet(ticket: Ticket): TimesheetEntry | null {
  const hours = ticketWorkHours(ticket)
  if (hours <= 0) return null

  const date = ticketWorkDate(ticket)
  const startTime = ticket.startTime || "08:00"
  const endTime = ticket.endTime || addHoursToTime(startTime, hours)
  const matches = localTimesheetRepository.list().filter((entry) => entry.ticketId === ticket.id)
  const existing =
    matches.find((entry) => isTicketAutoLogEntry(entry, ticket)) ??
    matches.find((entry) => entry.isOvertime !== true) ??
    matches.find((entry) => entry.note === ticket.ticketNumber)

  if (existing) {
    return localTimesheetRepository.update(existing.id, {
      date,
      startTime,
      endTime,
      hours,
      isOvertime: false,
      note: ticket.ticketNumber,
    })
  }

  return localTimesheetRepository.create({
    date,
    startTime,
    endTime,
    hours,
    ticketId: ticket.id,
    note: ticket.ticketNumber,
    isOvertime: false,
  })
}

export function findTicketOvertimeEntry(ticket: Ticket): TimesheetEntry | undefined {
  return localTimesheetRepository
    .list()
    .find((entry) => entry.ticketId === ticket.id && entry.isOvertime === true && !isTicketAutoLogEntry(entry, ticket))
}

export function hydrateTicketOvertimeHours(ticket: Ticket): Ticket {
  if (ticket.overtimeHours > 0) return ticket
  const existingOt = findTicketOvertimeEntry(ticket)
  if (!existingOt || existingOt.hours <= 0) return ticket
  return { ...ticket, overtimeHours: existingOt.hours }
}

export function syncTicketOvertime(ticket: Ticket): TimesheetEntry | null {
  const hours = ticket.overtimeHours
  const existingOt = findTicketOvertimeEntry(ticket)

  if (!(hours > 0)) {
    if (existingOt) localTimesheetRepository.delete(existingOt.id)
    return null
  }

  const startTime = ticket.endTime || "17:00"
  const endTime = addHoursToTime(startTime, hours)
  const payload = {
    date: ticketWorkDate(ticket),
    startTime,
    endTime,
    hours: hoursBetween(startTime, endTime) || hours,
    isOvertime: true,
    note: `${ticket.ticketNumber} overtime`,
  }

  if (existingOt) {
    return localTimesheetRepository.update(existingOt.id, payload)
  }

  return localTimesheetRepository.create({
    ...payload,
    ticketId: ticket.id,
  })
}

export function addOvertimeForTicket(ticket: Ticket): TimesheetEntry {
  const overtime = syncTicketOvertime(ticket)
  if (!overtime) {
    throw new Error("Select how much overtime under start and end time.")
  }
  return overtime
}

import { PRODUCT_NAME } from "@/lib/branding"
import { formatHours } from "@/lib/datetime"
import { formatMoney } from "@/lib/money"
import { lineItemTotal, ticketGrandTotal, type Ticket } from "@/lib/tickets/types"
import { isTicketAutoLogEntry, overtimeHoursForClient, overtimeHoursForTicket } from "@/lib/timesheet/overtime"
import type { TimesheetEntry } from "@/lib/timesheet/types"

export type TicketEmailKind = "opened" | "closed"

export type TicketEmailContext = {
  entries: TimesheetEntry[]
  allEntries: TimesheetEntry[]
  tickets: Ticket[]
}

function greeting(client: string): string {
  const name = client.trim()
  return name ? `Hi ${name}` : "Hi"
}

const SIGN_OFF = ["Regards", PRODUCT_NAME] as const

function checklistBlock(ticket: Ticket): string[] {
  if (ticket.status !== "processed") return []
  return [
    "Checklist",
    `Paid: ${ticket.paid ? "Yes" : "No"}`,
    `Quote sent out: ${ticket.quotePaid ? "Yes" : "No"}`,
    "",
  ]
}

function timesheetBlock(entries: TimesheetEntry[], ticket: Ticket): string[] {
  if (entries.length === 0) {
    return ["Timesheet", "No time logged on this ticket yet."]
  }
  const rows = entries.map((entry) => {
    const kind =
      entry.isOvertime === true && !isTicketAutoLogEntry(entry, ticket) ? "Overtime" : "Regular"
    return `${entry.date}  ${entry.startTime}–${entry.endTime}  ${formatHours(entry.hours)} h  ${kind}`
  })
  const total = entries.reduce((sum, entry) => sum + entry.hours, 0)
  return ["Timesheet", ...rows, `Timesheet hours: ${formatHours(total)} h`]
}

export function buildShortTicketEmail(
  ticket: Ticket,
  kind: TicketEmailKind
): { subject: string; body: string } {
  const opened = kind === "opened"
  const heading = opened ? "Ticket opened" : "Ticket closed"
  return {
    subject: `${heading} ${ticket.ticketNumber}`,
    body: [
      greeting(ticket.client),
      "",
      `Ticket ${ticket.ticketNumber} is ${opened ? "open" : "closed"}.`,
      "",
      `Ticket number: ${ticket.ticketNumber}`,
      `Reference: ${ticket.reference}`,
      "",
      ...SIGN_OFF,
    ].join("\n"),
  }
}

export function buildTicketEmail(
  ticket: Ticket,
  _kind: TicketEmailKind,
  context: TicketEmailContext
): { subject: string; body: string } {
  const items =
    ticket.lineItems.length === 0
      ? "None"
      : ticket.lineItems
          .map((item, index) => {
            const label = item.description.trim() || "Item"
            return `${index + 1}. ${label}  qty ${item.quantity}  ${formatMoney(lineItemTotal(item))}`
          })
          .join("\n")

  const hours = ticket.hoursSpent
  const hoursLabel =
    hours == null || Number.isNaN(hours) ? "Not recorded" : `${formatHours(hours)} hour${hours === 1 ? "" : "s"}`

  const body = [
    greeting(ticket.client),
    "",
    `Ticket ${ticket.ticketNumber} is open.`,
    "",
    `Ticket number: ${ticket.ticketNumber}`,
    `Reference: ${ticket.reference}`,
    `Status: Opened`,
    `Client: ${ticket.client || "—"}`,
    `Site: ${ticket.site || "—"}`,
    `Ticket issuer: ${ticket.nameSurname || "—"}`,
    `Job number: ${ticket.jobNumber || "—"}`,
    ticket.startTime || ticket.endTime
      ? `Work time: ${ticket.startTime || "—"} – ${ticket.endTime || "—"}`
      : null,
    `Hours spent: ${hoursLabel}`,
    "",
    "Work requested:",
    ticket.clientWorkDescription.trim() || "—",
    "",
    ...timesheetBlock(context.entries, ticket),
    "",
    `Overtime on this ticket: ${formatHours(overtimeHoursForTicket(context.entries, ticket))} h`,
    `Overtime for ${ticket.client || "this client"}: ${formatHours(overtimeHoursForClient(context.allEntries, context.tickets, ticket.client))} h`,
    "",
    "Line items:",
    items,
    `Discount: ${formatMoney(ticket.discount)}`,
    `Total: ${formatMoney(ticketGrandTotal(ticket.lineItems, ticket.discount))}`,
    "",
    ...checklistBlock(ticket),
    ...SIGN_OFF,
  ]
    .filter((line) => line !== null)
    .join("\n")

  return {
    subject: `Ticket opened ${ticket.ticketNumber} — ${ticket.client || "client"}`,
    body,
  }
}

export function buildWorkOrderEmail(ticket: Ticket): { subject: string; body: string } {
  return {
    subject: `Work order ${ticket.ticketNumber}`,
    body: [
      greeting(ticket.client),
      "",
      "Work order attached.",
      "",
      `Ticket number: ${ticket.ticketNumber}`,
      `Reference: ${ticket.reference}`,
      "",
      ...checklistBlock(ticket),
      ...SIGN_OFF,
    ].join("\n"),
  }
}

function mailtoHref(email: string, message: { subject: string; body: string }): string {
  return `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`
}

export function buildWorkOrderMailtoHref(email: string, ticket: Ticket): string {
  return mailtoHref(email, buildWorkOrderEmail(ticket))
}

/** Outlook compose draft. Opens as an unsent message when the file is opened. */
export function buildUnsentEml(to: string, message: { subject: string; body: string }): string {
  return [
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    `To: ${to.trim()}`,
    `Subject: ${message.subject}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    message.body.replace(/\n/g, "\r\n"),
    "",
  ].join("\r\n")
}

export function emlFilename(ticketNumber: string, slug: string): string {
  const safe = ticketNumber.replace(/[^\w.-]+/g, "-")
  return `${safe}-${slug}.eml`
}

export function buildShortMailtoHref(email: string, ticket: Ticket, kind: TicketEmailKind): string {
  return mailtoHref(email, buildShortTicketEmail(ticket, kind))
}

export function buildMailtoHref(
  email: string,
  ticket: Ticket,
  kind: TicketEmailKind,
  context: TicketEmailContext
): string {
  if (kind === "closed") {
    return buildShortMailtoHref(email, ticket, "closed")
  }
  return mailtoHref(email, buildTicketEmail(ticket, kind, context))
}

export function openMailto(href: string, target?: Window | null): void {
  if (target && !target.closed) {
    try {
      target.location.replace(href)
      return
    } catch {
      // Fall through if the draft tab is blocked.
    }
  }
  const link = document.createElement("a")
  link.href = href
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function downloadTextFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

export function buildEmlWithPdf(options: {
  to: string
  subject: string
  body: string
  filename: string
  pdf: Uint8Array
}): string {
  const boundary = `----=_Roboware_${crypto.randomUUID()}`
  const wrapped = bytesToBase64(options.pdf).replace(/(.{76})/g, "$1\r\n")
  return [
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    `To: ${options.to.trim()}`,
    `Subject: ${options.subject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    options.body.replace(/\n/g, "\r\n"),
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${options.filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${options.filename}"`,
    "",
    wrapped,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n")
}

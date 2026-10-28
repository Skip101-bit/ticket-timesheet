import { hoursBetween } from "@/lib/datetime"
import { isTicketStatus, normalizeDiscount, normalizeLineItem, type Ticket } from "@/lib/tickets/types"

export function normalizeTicket(raw: Partial<Ticket> & { id: string }): Ticket {
  const lineItems = Array.isArray(raw.lineItems)
    ? raw.lineItems.map((item) => normalizeLineItem(item))
    : []
  const startTime = raw.startTime ?? ""
  const endTime = raw.endTime ?? ""
  const computed = startTime && endTime ? hoursBetween(startTime, endTime) : 0
  const storedHours = raw.hoursSpent
  const overtimeHours = Number(raw.overtimeHours)
  return {
    id: raw.id,
    manageItId: raw.manageItId ?? null,
    ticketNumber: raw.ticketNumber ?? "",
    reference: raw.reference ?? "",
    nameSurname: raw.nameSurname ?? "",
    client: raw.client ?? "",
    clientEmail: raw.clientEmail ?? "",
    site: raw.site ?? "",
    requestedAt: raw.requestedAt ?? "",
    clientWorkDescription: raw.clientWorkDescription ?? "",
    startTime,
    endTime,
    overtimeHours: Number.isFinite(overtimeHours) && overtimeHours > 0 ? overtimeHours : 0,
    hoursSpent: computed > 0 ? computed : storedHours ?? null,
    jobNumber: raw.jobNumber ?? "",
    completedAt: raw.completedAt ?? "",
    actualWorkDone: raw.actualWorkDone ?? "",
    lineItems,
    discount: normalizeDiscount(raw.discount),
    status: raw.status && isTicketStatus(raw.status) ? raw.status : "open",
    categoryId: raw.categoryId ?? null,
    categoryName: raw.categoryName ?? "",
    assignedToFinance: Boolean(raw.assignedToFinance),
    paid: Boolean(raw.paid),
    quotePaid: Boolean(raw.quotePaid),
    accepted: Boolean(raw.accepted),
    issuerUserId: raw.issuerUserId ?? null,
    createdAt: raw.createdAt ?? "",
    updatedAt: raw.updatedAt ?? "",
  }
}

export function ticketWorkHours(ticket: Pick<Ticket, "startTime" | "endTime" | "hoursSpent">): number {
  if (ticket.startTime && ticket.endTime) {
    return hoursBetween(ticket.startTime, ticket.endTime)
  }
  return ticket.hoursSpent && ticket.hoursSpent > 0 ? ticket.hoursSpent : 0
}

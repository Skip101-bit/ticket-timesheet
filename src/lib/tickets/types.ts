export const TICKET_STATUSES = ["open", "in_progress", "complete", "to_process", "processed"] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]

export type LineItem = {
  id: string
  masterLineItemId: string | null
  description: string
  quantity: number
  price: number
}

export type Ticket = {
  id: string
  /** Reserved for a future ManageIT integration. Unused in the local store. */
  manageItId: string | null
  ticketNumber: string
  reference: string
  nameSurname: string
  client: string
  clientEmail: string
  site: string
  requestedAt: string
  clientWorkDescription: string
  startTime: string
  endTime: string
  overtimeHours: number
  hoursSpent: number | null
  jobNumber: string
  completedAt: string
  actualWorkDone: string
  lineItems: LineItem[]
  discount: number
  status: TicketStatus
  categoryId: string | null
  categoryName: string
  assignedToFinance: boolean
  paid: boolean
  quotePaid: boolean
  accepted: boolean
  issuerUserId: string | null
  createdAt: string
  updatedAt: string
}

export type NewTicketInput = {
  client: string
  clientEmail: string
}

export type TicketStoreSnapshot = {
  version: 1
  tickets: Ticket[]
  sequences: Record<string, number>
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  complete: "Complete",
  to_process: "To be processed",
  processed: "Processed",
}

export function isTicketStatus(value: string): value is TicketStatus {
  return TICKET_STATUSES.includes(value as TicketStatus)
}

export function normalizeLineItem(item: Partial<LineItem> & { id: string }): LineItem {
  const quantity = Number(item.quantity)
  const price = Number(item.price)
  return {
    id: item.id,
    masterLineItemId: item.masterLineItemId ?? null,
    description: item.description ?? "",
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    price: Number.isFinite(price) ? price : 0,
  }
}

export function lineItemTotal(item: LineItem): number {
  const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 0
  const price = Number.isFinite(item.price) ? item.price : 0
  return quantity * price
}

export function lineItemsTotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + lineItemTotal(item), 0)
}

export function normalizeDiscount(value: unknown): number {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

export function ticketGrandTotal(items: LineItem[], discount?: number): number {
  return Math.max(0, lineItemsTotal(items) - normalizeDiscount(discount))
}

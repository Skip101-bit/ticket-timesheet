import { createReference, nextTicketNumber } from "@/lib/tickets/numbering"
import { normalizeTicket } from "@/lib/tickets/normalize"
import { readTicketStore, writeTicketStore } from "@/lib/tickets/local-store"
import type { NewTicketInput, Ticket } from "@/lib/tickets/types"

export interface TicketRepository {
  list(): Ticket[]
  get(id: string): Ticket | null
  create(input: NewTicketInput): Ticket
  update(id: string, patch: Partial<Ticket>): Ticket
  delete(id: string): void
}

function nowIso(): string {
  return new Date().toISOString()
}

export const localTicketRepository: TicketRepository = {
  list() {
    return [...readTicketStore().tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },

  get(id) {
    return readTicketStore().tickets.find((ticket) => ticket.id === id) ?? null
  },

  create(input) {
    const store = readTicketStore()
    const issued = nextTicketNumber(store.sequences, store.tickets)
    const createdAt = nowIso()
    const ticket = normalizeTicket({
      id: crypto.randomUUID(),
      manageItId: null,
      ticketNumber: issued.ticketNumber,
      reference: createReference(),
      nameSurname: "",
      client: input.client.trim(),
      clientEmail: input.clientEmail.trim(),
      site: "",
      requestedAt: createdAt,
      clientWorkDescription: "",
      startTime: "",
      endTime: "",
      overtimeHours: 0,
      hoursSpent: null,
      jobNumber: "",
      completedAt: "",
      actualWorkDone: "",
      lineItems: [],
      discount: 0,
      status: "open",
      categoryId: null,
      categoryName: "",
      assignedToFinance: false,
      paid: false,
      quotePaid: false,
      accepted: false,
      issuerUserId: null,
      createdAt,
      updatedAt: createdAt,
    })
    writeTicketStore({
      version: 1,
      tickets: [ticket, ...store.tickets],
      sequences: { ...store.sequences, [issued.dayKey]: issued.sequence },
    })
    return ticket
  },

  update(id, patch) {
    const store = readTicketStore()
    const index = store.tickets.findIndex((ticket) => ticket.id === id)
    if (index < 0) {
      throw new Error("Ticket not found.")
    }
    const existing = store.tickets[index]
    const next = normalizeTicket({
      ...existing,
      ...patch,
      id: existing.id,
      manageItId: existing.manageItId,
      ticketNumber: existing.ticketNumber,
      reference: existing.reference,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    })
    const tickets = [...store.tickets]
    tickets[index] = next
    writeTicketStore({ ...store, tickets })
    return next
  },

  delete(id) {
    const store = readTicketStore()
    writeTicketStore({
      ...store,
      tickets: store.tickets.filter((ticket) => ticket.id !== id),
    })
  },
}

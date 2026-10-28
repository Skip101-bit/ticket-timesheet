import { normalizeTicket } from "@/lib/tickets/normalize"
import type { TicketStoreSnapshot } from "@/lib/tickets/types"

export const TICKET_STORE_KEY = "roboware.tickets.v2"

export class TicketStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "TicketStoreError"
  }
}

function emptyStore(): TicketStoreSnapshot {
  return { version: 1, tickets: [], sequences: {} }
}

export function readTicketStore(): TicketStoreSnapshot {
  try {
    const raw = window.localStorage.getItem(TICKET_STORE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as Partial<TicketStoreSnapshot> | TicketStoreSnapshot["tickets"]
    if (Array.isArray(parsed)) {
      return { version: 1, tickets: parsed.map((ticket) => normalizeTicket(ticket)), sequences: {} }
    }
    if (!parsed || !Array.isArray(parsed.tickets)) {
      throw new TicketStoreError("Saved ticket data is unreadable.")
    }
    return {
      version: 1,
      tickets: parsed.tickets.map((ticket) => normalizeTicket(ticket)),
      sequences: parsed.sequences && typeof parsed.sequences === "object" ? parsed.sequences : {},
    }
  } catch (error) {
    if (error instanceof TicketStoreError) throw error
    throw new TicketStoreError("Could not read tickets from this browser.", { cause: error })
  }
}

export function writeTicketStore(store: TicketStoreSnapshot): void {
  try {
    window.localStorage.setItem(TICKET_STORE_KEY, JSON.stringify(store))
  } catch (error) {
    throw new TicketStoreError("Could not save tickets in this browser.", { cause: error })
  }
}

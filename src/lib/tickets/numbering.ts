import { pad2 } from "@/lib/datetime"
import type { Ticket } from "@/lib/tickets/types"

export function dayKeyFromDate(date = new Date()): string {
  return `${pad2(date.getFullYear() % 100)}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
}

export function parseTicketSequence(ticketNumber: string): { dayKey: string; sequence: number } | null {
  const match = /^TKT-(\d{6})-(\d{4})$/.exec(ticketNumber)
  if (!match) return null
  return { dayKey: match[1], sequence: Number.parseInt(match[2], 10) }
}

export function nextTicketNumber(
  sequences: Record<string, number>,
  existing: Ticket[],
  date = new Date()
): { ticketNumber: string; dayKey: string; sequence: number } {
  const dayKey = dayKeyFromDate(date)
  const stored = sequences[dayKey] ?? 0
  const existingMax = existing.reduce((max, ticket) => {
    const parsed = parseTicketSequence(ticket.ticketNumber)
    if (!parsed || parsed.dayKey !== dayKey) return max
    return Math.max(max, parsed.sequence)
  }, 0)
  const sequence = Math.max(stored, existingMax) + 1
  return {
    ticketNumber: `TKT-${dayKey}-${String(sequence).padStart(4, "0")}`,
    dayKey,
    sequence,
  }
}

export function createReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
  return `REF-${token}`
}

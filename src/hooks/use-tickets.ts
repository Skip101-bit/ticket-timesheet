"use client"

import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api/client"
import type { NewTicketInput, Ticket } from "@/lib/tickets/types"

type TicketsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; tickets: Ticket[] }

export function useTickets() {
  const [state, setState] = useState<TicketsState>({ status: "loading" })

  const reload = useCallback(async () => {
    try {
      const tickets = await api.listTickets()
      setState({ status: "ready", tickets })
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Could not load tickets.",
      })
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  const create = useCallback(
    async (input: NewTicketInput) => {
      const ticket = await api.createTicket(input)
      await reload()
      return ticket
    },
    [reload]
  )

  const update = useCallback(
    async (id: string, patch: Partial<Ticket>) => {
      const ticket = await api.updateTicket(id, patch)
      await reload()
      return ticket
    },
    [reload]
  )

  const remove = useCallback(
    async (id: string) => {
      await api.deleteTicket(id)
      await reload()
    },
    [reload]
  )

  return { state, reload, create, update, remove }
}

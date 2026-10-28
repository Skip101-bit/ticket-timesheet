"use client"

import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api/client"
import type { NewTimesheetEntryInput, TimesheetEntry } from "@/lib/timesheet/types"

type TimesheetState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: TimesheetEntry[] }

export function useTimesheet() {
  const [state, setState] = useState<TimesheetState>({ status: "loading" })

  const reload = useCallback(async () => {
    try {
      const entries = await api.listTimesheet()
      setState({ status: "ready", entries })
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Could not load the timesheet.",
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
    async (input: NewTimesheetEntryInput) => {
      const entry = await api.createTimesheetEntry(input)
      await reload()
      return entry
    },
    [reload]
  )

  const update = useCallback(
    async (id: string, patch: Partial<TimesheetEntry>) => {
      const entry = await api.updateTimesheetEntry(id, patch)
      await reload()
      return entry
    },
    [reload]
  )

  const remove = useCallback(
    async (id: string) => {
      await api.deleteTimesheetEntry(id)
      await reload()
    },
    [reload]
  )

  return { state, reload, create, update, remove }
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api/client"
import type { Activity, NewActivityInput } from "@/lib/calendar/types"

type ActivitiesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; activities: Activity[] }

export function useActivities() {
  const [state, setState] = useState<ActivitiesState>({ status: "loading" })

  const reload = useCallback(async () => {
    try {
      const activities = await api.listActivities()
      setState({ status: "ready", activities })
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Could not load activities.",
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
    async (input: NewActivityInput) => {
      const activity = await api.createActivity(input)
      await reload()
      return activity
    },
    [reload]
  )

  const update = useCallback(
    async (id: string, patch: Partial<Activity>) => {
      const activity = await api.updateActivity(id, patch)
      await reload()
      return activity
    },
    [reload]
  )

  const remove = useCallback(
    async (id: string) => {
      await api.deleteActivity(id)
      await reload()
    },
    [reload]
  )

  return { state, reload, create, update, remove }
}

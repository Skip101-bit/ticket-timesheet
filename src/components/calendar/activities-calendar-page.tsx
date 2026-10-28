"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useSession } from "@/components/auth/auth-gate"
import { ActivityDialog } from "@/components/calendar/activity-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useActivities } from "@/hooks/use-activities"
import { colorForUserIndex } from "@/lib/calendar/colors"
import type { Activity, NewActivityInput } from "@/lib/calendar/types"
import {
  addMonths,
  formatDisplayDate,
  formatMonthYear,
  monthCalendarCells,
  parseLocalDateKey,
  startOfMonth,
  toLocalDateKey,
} from "@/lib/datetime"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

type CalendarUser = {
  key: string
  name: string
  bg: string
  fg: string
}

function userKey(activity: Activity): string {
  return activity.userId || activity.userName.trim() || "unknown"
}

function colourForActivity(activity: Activity, user: CalendarUser | undefined): { bg: string; fg: string } {
  if (activity.colour) return { bg: activity.colour, fg: user?.fg ?? "#134e4a" }
  return { bg: user?.bg ?? "#ccfbf1", fg: user?.fg ?? "#115e59" }
}

function formatTimeRange(activity: Activity): string {
  if (activity.startTime && activity.endTime) return `${activity.startTime}–${activity.endTime}`
  return activity.startTime || activity.endTime || ""
}

export function ActivitiesCalendarPage() {
  const { user } = useSession()
  const { state, create, update, remove } = useActivities()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Activity | null>(null)
  const today = toLocalDateKey(new Date())
  const cells = useMemo(() => monthCalendarCells(month), [month])
  const activities = state.status === "ready" ? state.activities : []

  const users = useMemo(() => {
    const seen = new Map<string, CalendarUser>()
    for (const activity of activities) {
      const key = userKey(activity)
      if (seen.has(key)) continue
      const color = colorForUserIndex(seen.size)
      seen.set(key, { key, name: activity.userName.trim() || "Unnamed", bg: color.bg, fg: color.fg })
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [activities])
  const colorByUser = useMemo(() => new Map(users.map((item) => [item.key, item])), [users])

  const byDay = useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const activity of activities) {
      const list = map.get(activity.date) ?? []
      list.push(activity)
      map.set(activity.date, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99") || a.title.localeCompare(b.title))
    }
    return map
  }, [activities])

  const selected = byDay.get(selectedDate) ?? []

  function openNew(date = selectedDate) {
    setSelectedDate(date)
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(activity: Activity) {
    setSelectedDate(activity.date)
    setEditing(activity)
    setDialogOpen(true)
  }

  async function handleSave(input: NewActivityInput) {
    try {
      if (editing) {
        await update(editing.id, input)
        toast.success("Activity updated.")
      } else {
        await create(input)
        toast.success("Activity added.")
      }
      setSelectedDate(input.date)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the activity.")
      throw error
    }
  }

  async function handleDelete() {
    if (!editing) return
    try {
      await remove(editing.id)
      toast.success("Activity removed.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the activity.")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            {user.role === "admin"
              ? "Everyone’s activities, each person in a colour. Click a day or Add to put one on the calendar."
              : "Your activities. Click a day or Add to put one on the calendar."}
          </p>
        </div>
        <Button type="button" onClick={() => openNew()}>
          Add activity
        </Button>
      </div>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load activities</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{formatMonthYear(month)}</CardTitle>
              <CardDescription>Click a day to add or open that day’s list.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Previous month"
                onClick={() => setMonth((current) => addMonths(current, -1))}
              >
                ‹
              </Button>
              <Button type="button" variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>
                This month
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Next month"
                onClick={() => setMonth((current) => addMonths(current, 1))}
              >
                ›
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {users.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {users.map((item) => (
                  <li
                    key={item.key}
                    className="rounded-md px-2 py-1 text-xs font-medium"
                    style={{ backgroundColor: item.bg, color: item.fg }}
                  >
                    {item.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {state.status === "loading" ? "Loading…" : "No activities yet this month."}
              </p>
            )}
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
              {WEEKDAYS.map((day) => (
                <div key={day} className="bg-muted/60 px-1 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              {cells.map((cell) => {
                const dayActivities = byDay.get(cell.key) ?? []
                const dayNumber = parseLocalDateKey(cell.key).getDate()
                const isSelected = cell.key === selectedDate
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => {
                      setSelectedDate(cell.key)
                      setMonth(startOfMonth(parseLocalDateKey(cell.key)))
                      openNew(cell.key)
                    }}
                    className={cn(
                      "min-h-20 bg-white p-1.5 text-left align-top",
                      !cell.inMonth && "bg-muted/30 text-muted-foreground",
                      isSelected && "ring-2 ring-inset ring-teal-600",
                      cell.key === today && "font-semibold text-teal-900",
                    )}
                  >
                    <p className="text-xs tabular-nums">{dayNumber}</p>
                    {dayActivities.length > 0 ? (
                      <ul className="mt-1 grid gap-0.5">
                        {dayActivities.slice(0, 3).map((activity) => {
                          const colour = colourForActivity(activity, colorByUser.get(userKey(activity)))
                          return (
                            <li
                              key={activity.id}
                              className="truncate rounded px-1 py-0.5 text-[10px] font-medium"
                              style={{ backgroundColor: colour.bg, color: colour.fg }}
                              title={activity.title}
                            >
                              {activity.title}
                            </li>
                          )
                        })}
                        {dayActivities.length > 3 ? (
                          <li className="px-1 text-[10px] text-muted-foreground">+{dayActivities.length - 3}</li>
                        ) : null}
                      </ul>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{formatDisplayDate(parseLocalDateKey(selectedDate))}</CardTitle>
            <CardDescription>
              {selected.length === 0 ? "Nothing on this day yet." : `${selected.length} activit${selected.length === 1 ? "y" : "ies"}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button type="button" variant="outline" onClick={() => openNew(selectedDate)}>
              Add
            </Button>
            {selected.length > 0 ? (
              <ul className="grid gap-2">
                {selected.map((activity) => {
                  const colour = colourForActivity(activity, colorByUser.get(userKey(activity)))
                  const own = activity.userId === user.id || user.role === "admin"
                  const time = formatTimeRange(activity)
                  return (
                    <li key={activity.id}>
                      <button
                        type="button"
                        disabled={!own}
                        onClick={() => openEdit(activity)}
                        className="w-full rounded-lg border p-3 text-left disabled:opacity-80"
                        style={{ borderColor: colour.bg, backgroundColor: `${colour.bg}66` }}
                      >
                        <p className="text-sm font-medium" style={{ color: colour.fg }}>
                          {activity.title}
                        </p>
                        {time ? <p className="text-xs tabular-nums text-muted-foreground">{time}</p> : null}
                        <p className="text-xs text-muted-foreground">{activity.userName}</p>
                        {activity.note ? <p className="mt-1 text-xs text-muted-foreground">{activity.note}</p> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <ActivityDialog
        open={dialogOpen}
        date={selectedDate}
        activity={editing}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        onDelete={editing ? handleDelete : undefined}
      />
    </div>
  )
}

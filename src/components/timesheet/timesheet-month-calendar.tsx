"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  addMonths,
  formatHours,
  formatMonthYear,
  monthCalendarCells,
  parseLocalDateKey,
  startOfMonth,
} from "@/lib/datetime"
import type { TimesheetEntry } from "@/lib/timesheet/types"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

const USER_COLORS = [
  { bg: "#ccfbf1", fg: "#115e59" },
  { bg: "#dbeafe", fg: "#1e40af" },
  { bg: "#fef3c7", fg: "#92400e" },
  { bg: "#fce7f3", fg: "#9d174d" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#dcfce7", fg: "#166534" },
  { bg: "#ffedd5", fg: "#9a3412" },
  { bg: "#cffafe", fg: "#0e7490" },
  { bg: "#fae8ff", fg: "#a21caf" },
  { bg: "#e0e7ff", fg: "#3730a3" },
] as const

type CalendarUser = {
  key: string
  name: string
  bg: string
  fg: string
}

function userKey(entry: TimesheetEntry): string {
  return entry.userId || entry.userName.trim() || "unknown"
}

function userName(entry: TimesheetEntry): string {
  return entry.userName.trim() || "Unnamed"
}

export function TimesheetMonthCalendar({ entries }: { entries: TimesheetEntry[] }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const cells = useMemo(() => monthCalendarCells(month), [month])
  const users = useMemo(() => {
    const seen = new Map<string, CalendarUser>()
    for (const entry of entries) {
      const key = userKey(entry)
      if (seen.has(key)) continue
      const color = USER_COLORS[seen.size % USER_COLORS.length] ?? USER_COLORS[0]
      seen.set(key, { key, name: userName(entry), bg: color.bg, fg: color.fg })
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [entries])
  const colorByUser = useMemo(() => new Map(users.map((user) => [user.key, user])), [users])
  const hoursByDay = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const entry of entries) {
      const day = map.get(entry.date) ?? new Map<string, number>()
      const key = userKey(entry)
      day.set(key, (day.get(key) ?? 0) + entry.hours)
      map.set(entry.date, day)
    }
    return map
  }, [entries])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Team timesheet</CardTitle>
          <CardDescription>
            Hours for everyone in the shared timesheet. Each person has a colour.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => setMonth((current) => addMonths(current, -1))}
          >
            <ChevronLeftIcon />
          </Button>
          <p className="min-w-40 text-center text-sm font-medium">{formatMonthYear(month)}</p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => setMonth((current) => addMonths(current, 1))}
          >
            <ChevronRightIcon />
          </Button>
          <Button type="button" variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>
            This month
          </Button>
          <Button nativeButton={false} variant="outline" render={<Link href="/timesheet" />}>
            Open timesheet
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {users.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {users.map((user) => (
              <li
                key={user.key}
                className="rounded-md px-2 py-1 text-xs font-medium"
                style={{ backgroundColor: user.bg, color: user.fg }}
              >
                {user.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No time logged yet.</p>
        )}
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
          {WEEKDAYS.map((day) => (
            <div key={day} className="bg-muted/60 px-1 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
              {day}
            </div>
          ))}
          {cells.map((cell) => {
            const dayHours = hoursByDay.get(cell.key)
            const dayNumber = parseLocalDateKey(cell.key).getDate()
            return (
              <div
                key={cell.key}
                className={cn(
                  "min-h-20 bg-white p-1.5",
                  !cell.inMonth && "bg-muted/30 text-muted-foreground"
                )}
              >
                <p className="text-xs font-medium tabular-nums">{dayNumber}</p>
                {dayHours && dayHours.size > 0 ? (
                  <ul className="mt-1 grid gap-0.5">
                    {[...dayHours.entries()].map(([key, hours]) => {
                      const user = colorByUser.get(key)
                      return (
                        <li
                          key={key}
                          className="truncate rounded px-1 py-0.5 text-[10px] font-medium tabular-nums"
                          style={{
                            backgroundColor: user?.bg ?? "#e7e5e4",
                            color: user?.fg ?? "#44403c",
                          }}
                          title={`${user?.name ?? "Unnamed"} ${formatHours(hours)} h`}
                        >
                          {formatHours(hours)} h
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

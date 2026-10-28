"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, PlusIcon, PrinterIcon } from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/components/auth/auth-gate"
import { RobowareLogo } from "@/components/branding/roboware-logo"
import { TimesheetEntryDialog } from "@/components/timesheet/timesheet-entry-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTickets } from "@/hooks/use-tickets"
import { useTimesheet } from "@/hooks/use-timesheet"
import {
  addDays,
  formatDisplayDate,
  formatHours,
  formatWeekRange,
  parseLocalDateKey,
  startOfWeekMonday,
  toLocalDateKey,
  weekDateKeys,
} from "@/lib/datetime"
import { api } from "@/lib/api/client"
import type { Account } from "@/lib/auth/types"
import { PRODUCT_NAME } from "@/lib/branding"
import { overtimeByClient, summarizeWeekEntries } from "@/lib/timesheet/overtime"
import type { TimesheetEntry } from "@/lib/timesheet/types"
import { cn } from "@/lib/utils"

type DialogState = {
  open: boolean
  date: string
  entry: TimesheetEntry | null
  overtime: boolean
}

const ALL = "all"

export function TimesheetWeekView() {
  const { user } = useSession()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get("date")
  const initialDate = dateParam ? parseLocalDateKey(dateParam) : new Date()
  const [monday, setMonday] = useState(() => startOfWeekMonday(initialDate))
  const { state, reload, create, update, remove } = useTimesheet()
  const ticketsState = useTickets().state
  const tickets = useMemo(
    () => (ticketsState.status === "ready" ? ticketsState.tickets : []),
    [ticketsState]
  )
  const [jobFilter, setJobFilter] = useState(ALL)
  const [clientFilter, setClientFilter] = useState(ALL)
  const [issuerFilter, setIssuerFilter] = useState(ALL)
  const [people, setPeople] = useState<Account[]>([])
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    date: toLocalDateKey(new Date()),
    entry: null,
    overtime: false,
  })

  useEffect(() => {
    if (user.role !== "admin") return
    const timer = window.setTimeout(() => {
      void api.listUsers().then(setPeople).catch(() => setPeople([]))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [user.role])

  const days = useMemo(() => weekDateKeys(monday), [monday])
  const entries = useMemo(
    () => (state.status === "ready" ? state.entries : []),
    [state]
  )
  const jobs = useMemo(() => {
    const labels = new Map<string, string>()
    for (const ticket of tickets) {
      const number = ticket.jobNumber.trim()
      if (!number) continue
      labels.set(number, ticket.client.trim() ? `${number} · ${ticket.client.trim()}` : number)
    }
    return [...labels.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [tickets])
  const clients = useMemo(
    () => [...new Set(tickets.map((ticket) => ticket.client.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [tickets]
  )
  const ticketById = useMemo(() => new Map(tickets.map((ticket) => [ticket.id, ticket])), [tickets])
  const scoped = useMemo(() => {
    return entries.filter((entry) => {
      if (user.role === "admin" && issuerFilter !== ALL && entry.userId !== issuerFilter) return false
      if (jobFilter === ALL && clientFilter === ALL) return true
      const ticket = entry.ticketId ? ticketById.get(entry.ticketId) : undefined
      if (!ticket) return false
      if (jobFilter !== ALL && ticket.jobNumber.trim() !== jobFilter) return false
      if (clientFilter !== ALL && ticket.client.trim() !== clientFilter) return false
      return true
    })
  }, [entries, user.role, issuerFilter, jobFilter, clientFilter, ticketById])
  const byDay = useMemo(() => {
    const map = new Map<string, TimesheetEntry[]>()
    for (const day of days) map.set(day, [])
    for (const entry of scoped) {
      if (!map.has(entry.date)) continue
      map.get(entry.date)?.push(entry)
    }
    return map
  }, [days, scoped])

  const dayLists = days.map((day) => byDay.get(day) ?? [])
  const dailyHours = dayLists.map((list) => list.reduce((sum, entry) => sum + entry.hours, 0))
  const summary = summarizeWeekEntries(dayLists)
  const clientOvertime = useMemo(
    () => overtimeByClient(scoped.filter((entry) => days.includes(entry.date)), tickets),
    [scoped, days, tickets]
  )
  const filterActive = jobFilter !== ALL || clientFilter !== ALL || (user.role === "admin" && issuerFilter !== ALL)
  const allTimeHours = scoped.reduce((sum, entry) => sum + entry.hours, 0)
  const ticketLabel = (ticketId: string | null) => {
    if (!ticketId) return null
    const ticket = tickets.find((item) => item.id === ticketId)
    if (!ticket) return "Ticket"
    return ticket.client ? `${ticket.ticketNumber} · ${ticket.client}` : ticket.ticketNumber
  }

  function openNew(date: string, overtime = false) {
    setDialog({ open: true, date, entry: null, overtime })
  }

  async function handleSave(input: {
    date: string
    startTime: string
    endTime: string
    hours: number
    ticketId: string | null
    note: string
    isOvertime: boolean
  }) {
    try {
      if (dialog.entry) {
        await update(dialog.entry.id, input)
      } else {
        await create(input)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that time entry.")
      throw error
    }
  }

  async function handleDelete() {
    if (!dialog.entry) return
    try {
      await remove(dialog.entry.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete that time entry.")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="print-only hidden">
        <RobowareLogo />
        <p className="mt-1 text-sm text-teal-800">{PRODUCT_NAME}</p>
        <p className="text-sm text-teal-800">Technician timesheet · {formatWeekRange(monday)}</p>
      </div>

      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Timesheet</h1>
          <p className="text-sm text-muted-foreground">
            {user.role === "admin"
              ? "All techs’ hours. Filter by job, client, or issuer."
              : "Your hours. Filter by job or client."}{" "}
            Ticket start and end times log here on their own.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setMonday(addDays(monday, -7))}>
            <ChevronLeftIcon />
          </Button>
          <p className="min-w-48 text-center text-sm font-medium">{formatWeekRange(monday)}</p>
          <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setMonday(addDays(monday, 7))}>
            <ChevronRightIcon />
          </Button>
          <Button variant="outline" onClick={() => setMonday(startOfWeekMonday(new Date()))}>
            This week
          </Button>
          <Button variant="outline" onClick={() => openNew(toLocalDateKey(new Date()), true)}>
            <ClockIcon />
            Make overtime
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <PrinterIcon />
            Print week
          </Button>
        </div>
      </div>

      {state.status === "loading" ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading timesheet</CardTitle>
            <CardDescription>Loading hours…</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load timesheet</AlertTitle>
          <AlertDescription>
            {state.message}{" "}
            <button type="button" className="underline" onClick={reload}>
              Try again
            </button>
          </AlertDescription>
        </Alert>
      ) : null}

      {state.status === "ready" ? (
        <>
          <div className="no-print flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Select value={jobFilter || ALL} onValueChange={(value) => setJobFilter(typeof value === "string" ? value : ALL)}>
              <SelectTrigger className="w-full sm:w-64" aria-label="Filter by job">
                <SelectValue placeholder="Job">
                  {jobFilter === ALL ? "All jobs" : jobs.find(([number]) => number === jobFilter)?.[1] || jobFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All jobs</SelectItem>
                {jobs.map(([number, label]) => (
                  <SelectItem key={number} value={number}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={clientFilter || ALL}
              onValueChange={(value) => setClientFilter(typeof value === "string" ? value : ALL)}
            >
              <SelectTrigger className="w-full sm:w-56" aria-label="Filter by client">
                <SelectValue placeholder="Client">
                  {clientFilter === ALL ? "All clients" : clientFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All clients</SelectItem>
                {clients.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {user.role === "admin" ? (
              <Select
                value={issuerFilter || ALL}
                onValueChange={(value) => setIssuerFilter(typeof value === "string" ? value : ALL)}
              >
                <SelectTrigger className="w-full sm:w-56" aria-label="Filter by ticket issuer">
                  <SelectValue placeholder="Ticket issuer">
                    {issuerFilter === ALL
                      ? "All ticket issuers"
                      : people.find((person) => person.id === issuerFilter)?.name || "Ticket issuer"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All ticket issuers</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          {filterActive ? (
            <Card>
              <CardHeader>
                <CardDescription>All hours for this filter</CardDescription>
                <CardTitle>{formatHours(allTimeHours)} h</CardTitle>
              </CardHeader>
            </Card>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3 print-totals">
            <Card>
              <CardHeader>
                <CardDescription>Regular</CardDescription>
                <CardTitle>{formatHours(summary.regular)} h</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Overtime</CardDescription>
                <CardTitle>{formatHours(summary.countedOt)} h</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Week total</CardDescription>
                <CardTitle>{formatHours(summary.weekTotal)} h</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Overtime by client</CardTitle>
              <CardDescription>OT this week, by client.</CardDescription>
            </CardHeader>
            <CardContent>
              {clientOvertime.length === 0 ? (
                <p className="text-sm text-muted-foreground">No OT for a client this week.</p>
              ) : (
                <div className="grid gap-2">
                  {clientOvertime.map((row) => (
                    <div key={row.client} className="flex items-center justify-between text-sm">
                      <span>{row.client}</span>
                      <span className="font-medium">{formatHours(row.hours)} h OT</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {scoped.filter((entry) => days.includes(entry.date)).length === 0 ? (
            <Card className="no-print">
              <CardHeader>
                <CardTitle>No time logged this week</CardTitle>
                <CardDescription>Fill start and end on a ticket and it shows up here.</CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <div className="hidden gap-3 md:grid print:grid">
            {days.map((day, index) => {
              const dayEntries = byDay.get(day) ?? []
              const hours = dailyHours[index] ?? 0
              const hasExplicitOt = dayEntries.some((entry) => entry.isOvertime)
              const overtimeDay = hasExplicitOt || hours > 8
              return (
                <section
                  key={day}
                  className={cn("rounded-xl border p-4", overtimeDay && "border-amber-300 bg-amber-50")}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium">{formatDisplayDate(parseLocalDateKey(day))}</h2>
                      {overtimeDay ? <Badge variant="secondary">OT</Badge> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{formatHours(hours)} h</span>
                      <Button className="no-print" size="sm" variant="outline" onClick={() => openNew(day)}>
                        <PlusIcon />
                        Add
                      </Button>
                      <Button className="no-print" size="sm" variant="outline" onClick={() => openNew(day, true)}>
                        <ClockIcon />
                        Make overtime
                      </Button>
                    </div>
                  </div>
                  {dayEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No entries</p>
                  ) : (
                    <div className="grid gap-2">
                      {dayEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 ring-1 ring-foreground/5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {entry.startTime}–{entry.endTime} · {formatHours(entry.hours)} h
                              {entry.isOvertime ? " · OT" : ""}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {ticketLabel(entry.ticketId) ? (
                                <Button
                                  nativeButton={false}
                                  variant="link"
                                  size="sm"
                                  className="h-auto px-0"
                                  render={<Link href={`/tickets/${entry.ticketId}`} />}
                                >
                                  {ticketLabel(entry.ticketId)}
                                </Button>
                              ) : (
                                "No ticket"
                              )}
                              {entry.note ? ` · ${entry.note}` : ""}
                              {user.role === "admin" && entry.userName ? ` · ${entry.userName}` : ""}
                            </p>
                          </div>
                          <Button
                            className="no-print"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDialog({ open: true, date: day, entry, overtime: entry.isOvertime })}
                          >
                            Edit
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>

          <div className="grid gap-3 md:hidden print:hidden">
            {days.map((day, index) => {
              const dayEntries = byDay.get(day) ?? []
              const hours = dailyHours[index] ?? 0
              const overtimeDay = dayEntries.some((entry) => entry.isOvertime) || hours > 8
              return (
                <Card key={day} className={cn(overtimeDay && "border-amber-300 bg-amber-50")}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{formatDisplayDate(parseLocalDateKey(day))}</CardTitle>
                      {overtimeDay ? <Badge variant="secondary">OT</Badge> : null}
                    </div>
                    <CardDescription>{formatHours(hours)} h logged</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    {dayEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No entries</p>
                    ) : (
                      dayEntries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          className="rounded-lg bg-white px-3 py-2 text-left text-sm ring-1 ring-foreground/10"
                          onClick={() => setDialog({ open: true, date: day, entry, overtime: entry.isOvertime })}
                        >
                          <span className="font-medium">
                            {entry.startTime}–{entry.endTime} · {formatHours(entry.hours)} h
                            {entry.isOvertime ? " · OT" : ""}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {ticketLabel(entry.ticketId) ?? "No ticket"}
                            {entry.note ? ` · ${entry.note}` : ""}
                            {user.role === "admin" && entry.userName ? ` · ${entry.userName}` : ""}
                          </span>
                        </button>
                      ))
                    )}
                    <div className="flex gap-2">
                      <Button className="no-print flex-1" variant="outline" size="sm" onClick={() => openNew(day)}>
                        <PlusIcon />
                        Add
                      </Button>
                      <Button className="no-print flex-1" variant="outline" size="sm" onClick={() => openNew(day, true)}>
                        <ClockIcon />
                        OT
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      ) : null}

      <TimesheetEntryDialog
        open={dialog.open}
        date={dialog.date}
        entry={dialog.entry}
        tickets={tickets}
        defaultOvertime={dialog.overtime}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        onSave={handleSave}
        onDelete={dialog.entry ? handleDelete : undefined}
      />
    </div>
  )
}

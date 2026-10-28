"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { PlusIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/components/auth/auth-gate"
import { NewTicketDialog } from "@/components/tickets/new-ticket-dialog"
import { TimesheetMonthCalendar } from "@/components/timesheet/timesheet-month-calendar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  isTicketStatus,
  type Ticket,
  type TicketStatus,
} from "@/lib/tickets/types"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | TicketStatus

const ALL = "all"

function matchesQuery(ticket: Ticket, query: string): boolean {
  if (!query) return true
  const haystack = [
    ticket.ticketNumber,
    ticket.reference,
    ticket.client,
    ticket.clientEmail,
    ticket.site,
    ticket.nameSurname,
    ticket.jobNumber,
    ticket.categoryName,
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(query)
}

function statusBadgeVariant(status: TicketStatus) {
  if (status === "processed" || status === "complete") return "secondary" as const
  if (status === "in_progress" || status === "to_process") return "default" as const
  return "outline" as const
}

export function TicketBoard() {
  const { user } = useSession()
  const { state, reload, update } = useTickets()
  const timesheet = useTimesheet().state
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [issuer, setIssuer] = useState(ALL)
  const [category, setCategory] = useState(ALL)
  const [dialogOpen, setDialogOpen] = useState(false)

  const tickets = useMemo(() => (state.status === "ready" ? state.tickets : []), [state])
  const issuers = useMemo(
    () =>
      [...new Set(tickets.map((ticket) => ticket.nameSurname.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [tickets]
  )
  const categories = useMemo(
    () =>
      [...new Set(tickets.map((ticket) => ticket.categoryName.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [tickets]
  )
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return tickets.filter((ticket) => {
      const statusOk = status === "all" || ticket.status === status
      const issuerOk = issuer === ALL || ticket.nameSurname.trim() === issuer
      const categoryOk = category === ALL || ticket.categoryName.trim() === category
      return statusOk && issuerOk && categoryOk && matchesQuery(ticket, normalized)
    })
  }, [tickets, query, status, issuer, category])

  async function setTicketStatus(ticket: Ticket, next: TicketStatus) {
    try {
      await update(ticket.id, { status: next })
      toast.success(next === "to_process" ? "Sent to process." : "Marked processed.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the ticket.")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Job tickets</h1>
          <p className="text-sm text-muted-foreground">
            {user.role === "finance"
              ? "Jobs assigned to finance. Search the ref, then Convert to PDF."
              : "Send finished jobs to process, then mark processed."}
          </p>
        </div>
        {user.role !== "finance" ? (
          <Button onClick={() => setDialogOpen(true)}>
            <PlusIcon />
            New ticket
          </Button>
        ) : null}
      </div>

      {timesheet.status === "ready" && user.role !== "finance" ? (
        <TimesheetMonthCalendar entries={timesheet.entries} />
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ticket no, ref, client…"
            aria-label="Search tickets"
          />
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <Select
            value={status || ALL}
            onValueChange={(value) => {
              if (typeof value !== "string") return
              if (value === ALL) {
                setStatus(ALL)
                return
              }
              if (isTicketStatus(value)) setStatus(value)
            }}
          >
            <SelectTrigger className="w-full lg:w-52" aria-label="Filter by status">
              <SelectValue placeholder="Status">
                {status === ALL ? "All" : TICKET_STATUS_LABELS[status]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {TICKET_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {TICKET_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={issuer || ALL} onValueChange={(value) => setIssuer(typeof value === "string" ? value : ALL)}>
            <SelectTrigger className="w-full lg:w-56" aria-label="Filter by ticket issuer">
              <SelectValue placeholder="Ticket issuer">
                {issuer === ALL ? "All ticket issuers" : issuer}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All ticket issuers</SelectItem>
              {issuers.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category || ALL} onValueChange={(value) => setCategory(typeof value === "string" ? value : ALL)}>
            <SelectTrigger className="w-full lg:w-52" aria-label="Filter by category">
              <SelectValue placeholder="Category">
                {category === ALL ? "All categories" : category}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {state.status === "loading" ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading tickets</CardTitle>
            <CardDescription>Loading tickets…</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load tickets</AlertTitle>
          <AlertDescription>
            {state.message}{" "}
            <button type="button" className="underline" onClick={() => void reload()}>
              Try again
            </button>
          </AlertDescription>
        </Alert>
      ) : null}

      {state.status === "ready" && filtered.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{tickets.length === 0 ? "No tickets yet" : "No matching tickets"}</CardTitle>
            <CardDescription>
              {tickets.length === 0
                ? user.role === "finance"
                  ? "They show up here after someone assigns them to finance."
                  : "Click New ticket."
                : "Try another search, issuer, category, or status."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {state.status === "ready" ? (
        <div className="grid gap-3">
          {filtered.map((ticket) => (
            <Card key={ticket.id} className="transition-colors hover:bg-muted/30">
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{ticket.ticketNumber}</p>
                    <Badge variant={statusBadgeVariant(ticket.status)}>
                      {TICKET_STATUS_LABELS[ticket.status]}
                    </Badge>
                    {ticket.categoryName ? <Badge variant="outline">{ticket.categoryName}</Badge> : null}
                    {ticket.assignedToFinance ? <Badge variant="secondary">Finance</Badge> : null}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {ticket.reference} · {ticket.client || "No client"} · {ticket.site || "No site"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ticket issuer: {ticket.nameSurname.trim() || "Unassigned"}
                  </p>
                </div>
                <div className={cn("flex shrink-0 flex-wrap gap-2")}>
                  {user.role !== "finance" && ticket.status !== "to_process" && ticket.status !== "processed" ? (
                    <Button variant="outline" onClick={() => void setTicketStatus(ticket, "to_process")}>
                      Send to process
                    </Button>
                  ) : null}
                  {ticket.status === "to_process" ? (
                    <Button variant="outline" onClick={() => void setTicketStatus(ticket, "processed")}>
                      Processed
                    </Button>
                  ) : null}
                  <Button
                    nativeButton={false}
                    variant="outline"
                    render={<Link href={`/tickets/${ticket.id}`} />}
                  >
                    Open
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <NewTicketDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatHours, hoursBetween } from "@/lib/datetime"
import type { Ticket } from "@/lib/tickets/types"
import type { TimesheetEntry } from "@/lib/timesheet/types"

type EntrySaveInput = {
  date: string
  startTime: string
  endTime: string
  hours: number
  ticketId: string | null
  note: string
  isOvertime: boolean
}

type EntryDialogProps = {
  open: boolean
  date: string
  entry: TimesheetEntry | null
  tickets: Ticket[]
  defaultOvertime?: boolean
  onOpenChange: (open: boolean) => void
  onSave: (input: EntrySaveInput) => void | Promise<void>
  onDelete?: () => void | Promise<void>
}

const NO_TICKET = "__none__"

export function TimesheetEntryDialog({
  open,
  date,
  entry,
  tickets,
  defaultOvertime = false,
  onOpenChange,
  onSave,
  onDelete,
}: EntryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <TimesheetEntryFields
            key={`${entry?.id ?? `new-${date}`}-${defaultOvertime}`}
            date={date}
            entry={entry}
            tickets={tickets}
            defaultOvertime={defaultOvertime}
            onOpenChange={onOpenChange}
            onSave={onSave}
            onDelete={onDelete}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function TimesheetEntryFields({
  date,
  entry,
  tickets,
  defaultOvertime = false,
  onOpenChange,
  onSave,
  onDelete,
}: Omit<EntryDialogProps, "open">) {
  const [entryDate, setEntryDate] = useState(entry?.date ?? date)
  const [startTime, setStartTime] = useState(
    entry?.startTime ?? (defaultOvertime ? "16:00" : "08:00")
  )
  const [endTime, setEndTime] = useState(entry?.endTime ?? (defaultOvertime ? "18:00" : "16:00"))
  const [ticketId, setTicketId] = useState(entry?.ticketId ?? NO_TICKET)
  const [note, setNote] = useState(entry?.note ?? "")
  const [isOvertime, setIsOvertime] = useState(entry?.isOvertime ?? defaultOvertime)
  const [timeError, setTimeError] = useState<string | null>(null)

  const hours = useMemo(() => hoursBetween(startTime, endTime), [startTime, endTime])
  const selectedTicket = tickets.find((item) => item.id === ticketId)
  const selectedTicketLabel =
    ticketId === NO_TICKET
      ? "No ticket"
      : selectedTicket
        ? `${selectedTicket.ticketNumber} — ${selectedTicket.client || "No client"}`
        : "Ticket"

  async function handleSave() {
    if (hours <= 0) {
      setTimeError("Need a start and end time.")
      return
    }
    try {
      await onSave({
        date: entryDate,
        startTime,
        endTime,
        hours,
        ticketId: ticketId === NO_TICKET ? null : ticketId,
        note: note.trim(),
        isOvertime,
      })
      onOpenChange(false)
    } catch {
      return
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {entry ? "Edit time entry" : isOvertime ? "Add overtime" : "Add time entry"}
        </DialogTitle>
        <DialogDescription>
          Start and end set the hours. Tick OT if this is overtime.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ts-date">Date</Label>
          <Input
            id="ts-date"
            type="date"
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ts-start">Start time</Label>
            <Input
              id="ts-start"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ts-end">End time</Label>
            <Input
              id="ts-end"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Hours: {formatHours(hours)} h</p>
        {timeError ? <p className="text-xs text-destructive">{timeError}</p> : null}
        <div className="grid gap-1.5">
          <Label>Ticket</Label>
          <Select value={ticketId || NO_TICKET} onValueChange={(value) => setTicketId(typeof value === "string" && value ? value : NO_TICKET)}>
            <SelectTrigger className="w-full">
              <SelectValue>{selectedTicketLabel || "No ticket"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TICKET}>No ticket</SelectItem>
              {tickets.map((ticket) => (
                <SelectItem key={ticket.id} value={ticket.id}>
                  {ticket.ticketNumber} — {ticket.client || "No client"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ts-note">Note</Label>
          <Textarea
            id="ts-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Travel, waiting, extra labour"
            rows={3}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isOvertime}
            onChange={(event) => setIsOvertime(event.target.checked)}
          />
          Overtime
        </label>
      </div>
      <DialogFooter className="sm:justify-between">
        {entry && onDelete ? (
          <Button
            variant="destructive"
            onClick={() => {
              onDelete()
              onOpenChange(false)
            }}
          >
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()}>Save</Button>
        </div>
      </DialogFooter>
    </>
  )
}

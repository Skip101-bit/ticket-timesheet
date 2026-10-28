"use client"

import { useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import type { Activity, NewActivityInput } from "@/lib/calendar/types"

type ActivityDialogProps = {
  open: boolean
  date: string
  activity: Activity | null
  onOpenChange: (open: boolean) => void
  onSave: (input: NewActivityInput) => void | Promise<void>
  onDelete?: () => void | Promise<void>
}

export function ActivityDialog({
  open,
  date,
  activity,
  onOpenChange,
  onSave,
  onDelete,
}: ActivityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <ActivityFields
            key={activity?.id ?? `new-${date}`}
            date={date}
            activity={activity}
            onOpenChange={onOpenChange}
            onSave={onSave}
            onDelete={onDelete}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ActivityFields({
  date,
  activity,
  onOpenChange,
  onSave,
  onDelete,
}: Omit<ActivityDialogProps, "open">) {
  const [entryDate, setEntryDate] = useState(activity?.date ?? date)
  const [title, setTitle] = useState(activity?.title ?? "")
  const [note, setNote] = useState(activity?.note ?? "")
  const [startTime, setStartTime] = useState(activity?.startTime ?? "09:00")
  const [endTime, setEndTime] = useState(activity?.endTime ?? "10:00")
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const nextTitle = title.trim()
    if (!nextTitle) {
      setError("Enter a title.")
      return
    }
    if (!entryDate) {
      setError("Enter a date.")
      return
    }
    try {
      await onSave({
        date: entryDate,
        title: nextTitle,
        note: note.trim(),
        startTime,
        endTime,
      })
      onOpenChange(false)
    } catch {
      return
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{activity ? "Edit activity" : "Add activity"}</DialogTitle>
        <DialogDescription>Date, time, and a short title. Note is optional.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="activity-title">Title</Label>
          <Input
            id="activity-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Site visit, delivery, meeting"
            autoFocus
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="activity-date">Date</Label>
          <Input
            id="activity-date"
            type="date"
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="activity-start">Start</Label>
            <Input
              id="activity-start"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="activity-end">End</Label>
            <Input
              id="activity-end"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="activity-note">Note</Label>
          <Textarea
            id="activity-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional detail"
            rows={3}
          />
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      <DialogFooter className="sm:justify-between">
        {activity && onDelete ? (
          <Button
            variant="destructive"
            onClick={() => {
              void onDelete()
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

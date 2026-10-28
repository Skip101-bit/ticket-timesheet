"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { MailIcon, PrinterIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/components/auth/auth-gate"
import { RobowareLogo } from "@/components/branding/roboware-logo"
import { LineItemsEditor } from "@/components/tickets/line-items-editor"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { api } from "@/lib/api/client"
import { PRODUCT_NAME } from "@/lib/branding"
import type { Category, MasterLineItem } from "@/lib/catalog/types"
import { formatHours, fromDatetimeLocalValue, hoursBetween, toDatetimeLocalValue } from "@/lib/datetime"
import { isValidEmail } from "@/lib/email"
import { formatMoney } from "@/lib/money"
import {
  buildShortMailtoHref,
  buildWorkOrderMailtoHref,
  openMailto,
} from "@/lib/tickets/email"
import { ticketWorkHours } from "@/lib/tickets/normalize"
import { lineItemTotal, ticketGrandTotal, TICKET_STATUS_LABELS, type Ticket } from "@/lib/tickets/types"
import type { OpenedEmailResult } from "@/lib/tickets/opened-email"

type TicketFormProps = {
  ticketId: string
}

const NO_CATEGORY = "none"

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

export function TicketForm({ ticketId }: TicketFormProps) {
  const router = useRouter()
  const { user } = useSession()
  const finance = user.role === "finance"
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [masters, setMasters] = useState<MasterLineItem[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [sendingWorkOrder, setSendingWorkOrder] = useState(false)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [nextTicket, nextCategories, nextMasters] = await Promise.all([
          api.getTicket(ticketId),
          api.listCategories(),
          api.listLineItems(),
        ])
        if (cancelled) return
        setTicket(nextTicket)
        setCategories(nextCategories)
        setMasters(nextMasters)
        setLoadError(null)
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not load this ticket.")
        }
      }
    }
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [ticketId])

  function persist(next: Ticket) {
    setSaveState("saving")
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void api
        .updateTicket(next.id, next)
        .then(() => setSaveState("saved"))
        .catch((error: unknown) => {
          setSaveState("error")
          toast.error(error instanceof Error ? error.message : "Could not save this ticket.")
        })
    }, 400)
  }

  function patch(partial: Partial<Ticket>, immediate = false) {
    setTicket((current) => {
      if (!current) return current
      const next = { ...current, ...partial }
      if (partial.startTime !== undefined || partial.endTime !== undefined) {
        const startTime = partial.startTime ?? next.startTime
        const endTime = partial.endTime ?? next.endTime
        next.startTime = startTime
        next.endTime = endTime
        next.hoursSpent = startTime && endTime ? hoursBetween(startTime, endTime) : next.hoursSpent
      }
      if (partial.categoryId !== undefined) {
        next.categoryName = categories.find((category) => category.id === partial.categoryId)?.name ?? ""
      }
      if (immediate) {
        if (saveTimer.current) window.clearTimeout(saveTimer.current)
        setSaveState("saving")
        void api
          .updateTicket(next.id, next)
          .then(() => setSaveState("saved"))
          .catch((error: unknown) => {
            setSaveState("error")
            toast.error(error instanceof Error ? error.message : "Could not save this ticket.")
          })
      } else {
        persist(next)
      }
      return next
    })
  }

  function requireEmail(): string | null {
    if (!ticket) return null
    const email = ticket.clientEmail.trim()
    if (!email || !isValidEmail(email)) {
      toast.error("Need a valid client email first.")
      return null
    }
    return email
  }

  function handleTicketClosed() {
    if (!ticket) return
    const email = requireEmail()
    if (!email) return
    openMailto(buildShortMailtoHref(email, ticket, "closed"))
    toast.success("Closed email opened. Hit Send in Outlook.")
  }

  function waitForMailto() {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, 300)
    })
  }

  function toastWorkOrderEmail(email: string, result: OpenedEmailResult) {
    if (result.status === "sent") {
      toast.success(`Work order sent to ${email}.`)
      return
    }
    if (result.status === "not_configured") {
      toast.success("Work order opened in Outlook.")
      return
    }
    toast.error(
      result.error
        ? `Work order email failed (${result.error}). Opened in Outlook.`
        : "Work order email failed. Opened in Outlook."
    )
  }

  async function handleSendWorkOrder() {
    if (!ticket || sendingWorkOrder) return
    const email = requireEmail()
    if (!email) return
    setSendingWorkOrder(true)
    openMailto(buildWorkOrderMailtoHref(email, ticket))
    try {
      const mailPromise = api.sendWorkOrderEmail(ticket.id, email)
      await waitForMailto()
      toastWorkOrderEmail(email, await mailPromise)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Work order email failed (${error.message}). Opened in Outlook.`
          : "Work order email failed. Opened in Outlook."
      )
    } finally {
      setSendingWorkOrder(false)
    }
  }

  async function handleDelete() {
    if (!ticket) return
    try {
      await api.deleteTicket(ticket.id)
      router.push("/")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this ticket.")
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <Alert variant="destructive">
          <AlertTitle>Ticket unavailable</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 text-sm text-muted-foreground">
        Loading ticket…
      </div>
    )
  }

  const hours = ticketWorkHours(ticket)
  const locked = finance

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 print:gap-2 print:px-0 print:py-0">
      <div className="print-only hidden">
        <RobowareLogo className="print:h-9" />
        <p className="mt-1 text-sm text-teal-800">{PRODUCT_NAME}</p>
        <p className="text-sm text-teal-800">Work order</p>
      </div>

      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Work order</h1>
          <p className="text-sm text-muted-foreground">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                  ? "Save failed"
                  : "Ticket number and reference stay as issued"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{TICKET_STATUS_LABELS[ticket.status]}</Badge>
            {ticket.categoryName ? <Badge variant="secondary">{ticket.categoryName}</Badge> : null}
            {ticket.assignedToFinance ? <Badge>Assigned to finance</Badge> : null}
            {user.role !== "finance" && ticket.status !== "to_process" && ticket.status !== "processed" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => patch({ status: "to_process" }, true)}>
                Send to process
              </Button>
            ) : null}
            {ticket.status === "to_process" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => patch({ status: "processed" }, true)}>
                Processed
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role !== "finance" ? (
            <Button type="button" variant="outline" onClick={handleTicketClosed}>
              <MailIcon />
              Ticket closed
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <PrinterIcon />
            Convert to PDF
          </Button>
          <Button type="button" variant="outline" onClick={() => void handleSendWorkOrder()} disabled={sendingWorkOrder}>
            <MailIcon />
            Send work order
          </Button>
          {user.role !== "finance" ? (
            <Button
              type="button"
              variant={ticket.assignedToFinance ? "secondary" : "outline"}
              onClick={() => patch({ assignedToFinance: !ticket.assignedToFinance }, true)}
            >
              {ticket.assignedToFinance ? "Assigned to finance" : "Assign to finance"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="print-sheet grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
          <Field label="Reference" htmlFor="reference">
            <Input id="reference" value={ticket.reference} readOnly disabled />
          </Field>
          <Field label="Ticket number" htmlFor="ticket-number">
            <Input id="ticket-number" value={ticket.ticketNumber} readOnly disabled />
          </Field>
          <Field label="Ticket issuer" htmlFor="ticket-issuer">
            <Input
              id="ticket-issuer"
              value={ticket.nameSurname}
              disabled={locked}
              onChange={(event) => patch({ nameSurname: event.target.value })}
            />
          </Field>
          <Field label="Category" htmlFor="category">
            <Select
              value={ticket.categoryId ?? NO_CATEGORY}
              disabled={locked}
              onValueChange={(value) => {
                const next = typeof value === "string" ? value : NO_CATEGORY
                patch({ categoryId: next === NO_CATEGORY ? null : next })
              }}
            >
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="Category">
                  {ticket.categoryId
                    ? categories.find((category) => category.id === ticket.categoryId)?.name ||
                      ticket.categoryName ||
                      "Category"
                    : "No category"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Client" htmlFor="client">
            <Input
              id="client"
              value={ticket.client}
              disabled={locked}
              onChange={(event) => patch({ client: event.target.value })}
              placeholder="Shoprite DC"
            />
          </Field>
          <Field label="Client email" htmlFor="client-email">
            <Input
              id="client-email"
              type="email"
              value={ticket.clientEmail}
              disabled={locked}
              onChange={(event) => patch({ clientEmail: event.target.value })}
              placeholder="accounts@shoprite.co.za"
            />
          </Field>
          <Field label="Site" htmlFor="site">
            <Input
              id="site"
              value={ticket.site}
              disabled={locked}
              onChange={(event) => patch({ site: event.target.value })}
              placeholder="City Deep"
            />
          </Field>
          <Field label="Date/time of request" htmlFor="requested-at">
            <Input
              id="requested-at"
              type="datetime-local"
              value={toDatetimeLocalValue(ticket.requestedAt)}
              disabled={locked}
              onChange={(event) => patch({ requestedAt: fromDatetimeLocalValue(event.target.value) })}
            />
          </Field>
        </div>

        <Field label="Client work description" htmlFor="client-work">
          <Textarea
            id="client-work"
            value={ticket.clientWorkDescription}
            disabled={locked}
            onChange={(event) => patch({ clientWorkDescription: event.target.value })}
            placeholder="Scanner down on inbound"
            rows={4}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
          <Field label="Start time" htmlFor="start-time">
            <Input
              id="start-time"
              type="time"
              value={ticket.startTime}
              disabled={locked}
              onChange={(event) => patch({ startTime: event.target.value })}
            />
          </Field>
          <Field label="End time" htmlFor="end-time">
            <Input
              id="end-time"
              type="time"
              value={ticket.endTime}
              disabled={locked}
              onChange={(event) => patch({ endTime: event.target.value })}
            />
          </Field>
        </div>

        <Field label="Overtime hours" htmlFor="overtime-hours">
          <Input
            id="overtime-hours"
            type="number"
            min={0}
            step="0.25"
            disabled={locked}
            value={ticket.overtimeHours === 0 ? "" : String(ticket.overtimeHours)}
            placeholder="0"
            onChange={(event) => {
              const hoursValue = Number(event.target.value)
              patch({ overtimeHours: Number.isFinite(hoursValue) && hoursValue > 0 ? hoursValue : 0 })
            }}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
          <Field label="Hours spent" htmlFor="hours-spent">
            <Input id="hours-spent" value={hours > 0 ? formatHours(hours) : ""} readOnly />
          </Field>
          <Field label="Job number" htmlFor="job-number">
            <Input
              id="job-number"
              value={ticket.jobNumber}
              disabled={locked}
              onChange={(event) => patch({ jobNumber: event.target.value })}
              placeholder="J1042"
            />
          </Field>
          <Field label="Date/time of completion" htmlFor="completed-at">
            <Input
              id="completed-at"
              type="datetime-local"
              value={toDatetimeLocalValue(ticket.completedAt)}
              disabled={locked}
              onChange={(event) => patch({ completedAt: fromDatetimeLocalValue(event.target.value) })}
            />
          </Field>
        </div>

        <Field label="Actual work done" htmlFor="actual-work">
          <Textarea
            id="actual-work"
            value={ticket.actualWorkDone}
            disabled={locked}
            onChange={(event) => patch({ actualWorkDone: event.target.value })}
            placeholder="Replaced scanner, tested"
            rows={4}
          />
        </Field>

        {ticket.status === "processed" ? (
          <fieldset className="grid gap-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Checklist</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-teal-700"
                checked={ticket.paid}
                onChange={(event) => patch({ paid: event.target.checked }, true)}
              />
              Paid
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-teal-700"
                checked={ticket.quotePaid}
                onChange={(event) => patch({ quotePaid: event.target.checked }, true)}
              />
              Quote sent out
            </label>
          </fieldset>
        ) : null}

        <div className="no-print">
          <LineItemsEditor
            items={ticket.lineItems}
            masters={masters}
            disabled={locked}
            discount={ticket.discount}
            onChange={(lineItems) => patch({ lineItems })}
            onDiscountChange={(discount) => patch({ discount })}
          />
        </div>

        <div className="print-line-items hidden print:block">
          <p className="print-line-items-heading">Line items</p>
          {ticket.lineItems.length > 0 ? (
            <table className="print-line-items-table">
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Unit price</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {ticket.lineItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.description.trim() || "Item"}</td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.price)}</td>
                    <td>{formatMoney(lineItemTotal(item))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Discount</td>
                  <td>{formatMoney(ticket.discount)}</td>
                </tr>
                <tr>
                  <td colSpan={3}>Grand total</td>
                  <td>{formatMoney(ticketGrandTotal(ticket.lineItems, ticket.discount))}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="print-line-items-empty">No line items</p>
          )}
          {ticket.lineItems.length === 0 ? (
            <table className="print-line-items-table">
              <tbody>
                <tr>
                  <td>Discount</td>
                  <td>{formatMoney(ticket.discount)}</td>
                </tr>
                <tr>
                  <td>Grand total</td>
                  <td>{formatMoney(ticketGrandTotal(ticket.lineItems, ticket.discount))}</td>
                </tr>
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

      {user.role !== "finance" ? (
        <div className="no-print">
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon />
            Delete ticket
          </Button>
        </div>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              {ticket.ticketNumber} will be deleted. That number is not reused.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
              Delete ticket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

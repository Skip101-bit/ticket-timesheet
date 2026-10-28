"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api/client"
import { isValidEmail } from "@/lib/email"
import { buildShortMailtoHref, openMailto } from "@/lib/tickets/email"
import type { OpenedEmailResult } from "@/lib/tickets/opened-email"

type NewTicketDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function waitForMailto() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 300)
  })
}

async function sendOpenedEmail(ticketId: string, to: string): Promise<OpenedEmailResult> {
  try {
    return await api.sendOpenedTicketEmail(ticketId, to)
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Could not send the email.",
    }
  }
}

function toastOpenedEmail(email: string, result: OpenedEmailResult) {
  if (result.status === "sent") {
    toast.success(`Ticket issued. Opened email sent to ${email}.`)
    return
  }
  if (result.status === "not_configured") {
    toast.success("Ticket issued. Opened email in Outlook.")
    return
  }
  toast.error(
    result.error
      ? `Ticket issued. Email failed (${result.error}). Opened in Outlook.`
      : "Ticket issued. Email failed. Opened in Outlook."
  )
}

export function NewTicketDialog({ open, onOpenChange }: NewTicketDialogProps) {
  const router = useRouter()
  const [client, setClient] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setClient("")
    setClientEmail("")
    setEmailError(null)
    setClientError(null)
    setSubmitting(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleCreate() {
    const name = client.trim()
    const email = clientEmail.trim()
    let valid = true
    if (!name) {
      setClientError("Need a client name.")
      valid = false
    } else {
      setClientError(null)
    }
    if (!email) {
      setEmailError("Need a client email.")
      valid = false
    } else if (!isValidEmail(email)) {
      setEmailError("That email looks wrong.")
      valid = false
    } else {
      setEmailError(null)
    }
    if (!valid) return

    setSubmitting(true)
    try {
      const ticket = await api.createTicket({ client: name, clientEmail: email })
      openMailto(buildShortMailtoHref(email, ticket, "opened"))
      const mailPromise = sendOpenedEmail(ticket.id, email)
      await waitForMailto()
      toastOpenedEmail(email, await mailPromise)
      router.push(`/tickets/${ticket.id}`)
      handleOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the ticket.")
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New ticket</DialogTitle>
          <DialogDescription>
            Client name and email. Issue ticket sends the opened email.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="new-client">Client name</Label>
            <Input
              id="new-client"
              value={client}
              onChange={(event) => setClient(event.target.value)}
              aria-invalid={Boolean(clientError)}
              placeholder="Shoprite DC"
              autoFocus
            />
            {clientError ? <p className="text-xs text-destructive">{clientError}</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-client-email">Client email</Label>
            <Input
              id="new-client-email"
              type="email"
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
              aria-invalid={Boolean(emailError)}
              placeholder="accounts@shoprite.co.za"
            />
            {emailError ? <p className="text-xs text-destructive">{emailError}</p> : null}
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={() => void handleCreate()} disabled={submitting}>
            Issue ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

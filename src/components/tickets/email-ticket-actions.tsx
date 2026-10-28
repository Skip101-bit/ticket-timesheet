"use client"

import { useState } from "react"
import { CopyIcon, MailIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { isValidEmail } from "@/lib/email"
import { localTicketRepository } from "@/lib/tickets/repository"
import {
  buildMailtoHref,
  buildShortMailtoHref,
  buildShortTicketEmail,
  buildTicketEmail,
  buildUnsentEml,
  emlFilename,
  type TicketEmailKind,
} from "@/lib/tickets/email"
import type { Ticket } from "@/lib/tickets/types"
import { localTimesheetRepository } from "@/lib/timesheet/repository"

const MAILTO_SAFE_LENGTH = 1800

export function EmailTicketActions({ ticket }: { ticket: Ticket }) {
  const [openedOpen, setOpenedOpen] = useState(false)

  function requireEmail(): string | null {
    const email = ticket.clientEmail.trim()
    if (!email) {
      toast.error("Need a valid client email first.")
      return null
    }
    if (!isValidEmail(email)) {
      toast.error("Client email looks wrong. Fix it on the ticket, then try again.")
      return null
    }
    return email
  }

  function context() {
    const allEntries = localTimesheetRepository.list()
    return {
      entries: allEntries.filter((entry) => entry.ticketId === ticket.id),
      allEntries,
      tickets: localTicketRepository.list(),
    }
  }

  const to = ticket.clientEmail.trim()
  const mailContext = openedOpen ? context() : null
  const shortOpened = buildShortTicketEmail(ticket, "opened")
  const fullOpened = mailContext ? buildTicketEmail(ticket, "opened", mailContext) : shortOpened
  const shortOpenedHref = to && isValidEmail(to) ? buildShortMailtoHref(to, ticket, "opened") : undefined
  const fullOpenedHref =
    to && isValidEmail(to) && mailContext ? buildMailtoHref(to, ticket, "opened", mailContext) : undefined

  function handleEmail(kind: TicketEmailKind) {
    if (!requireEmail()) return
    if (kind === "opened") {
      setOpenedOpen(true)
      return
    }
    window.location.assign(buildShortMailtoHref(to, ticket, "closed"))
  }

  async function handleCopy(kind: TicketEmailKind) {
    const text =
      kind === "opened"
        ? [
            "Opened (short)",
            "",
            formatCopied(shortOpened),
            "",
            "Opened (full)",
            "",
            formatCopied(buildTicketEmail(ticket, "opened", context())),
          ].join("\n")
        : formatCopied(buildShortTicketEmail(ticket, "closed"))
    try {
      await navigator.clipboard.writeText(text)
      toast.success(
        kind === "opened"
          ? "Opened emails copied."
          : "Closed email copied."
      )
    } catch {
      toast.error("Could not copy. Select the ticket details and copy them.")
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => handleEmail("opened")}>
        <MailIcon />
        Email opened
      </Button>
      <Button type="button" variant="outline" onClick={() => void handleCopy("opened")}>
        <CopyIcon />
        Copy opened
      </Button>
      <Button type="button" variant="outline" onClick={() => handleEmail("closed")}>
        <MailIcon />
        Email closed
      </Button>
      <Button type="button" variant="outline" onClick={() => void handleCopy("closed")}>
        <CopyIcon />
        Copy closed
      </Button>

      <Dialog open={openedOpen} onOpenChange={setOpenedOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Opened emails</DialogTitle>
            <DialogDescription>
              Outlook opens one draft at a time. Send the short one first, then the full email.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <OpenedEmailCard
              title="1. Short notice"
              message={shortOpened}
              href={shortOpenedHref}
              filename={emlFilename(ticket.ticketNumber, "opened-short")}
              to={to}
            />
            <OpenedEmailCard
              title="2. Full details"
              message={fullOpened}
              href={fullOpenedHref}
              filename={emlFilename(ticket.ticketNumber, "opened-full")}
              to={to}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function OpenedEmailCard({
  title,
  message,
  href,
  filename,
  to,
}: {
  title: string
  message: { subject: string; body: string }
  href: string | undefined
  filename: string
  to: string
}) {
  const useMailto = Boolean(href && href.length < MAILTO_SAFE_LENGTH)

  function downloadEml() {
    const blob = new Blob([buildUnsentEml(to, message)], { type: "message/rfc822" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
  }

  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{message.subject}</p>
      <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-muted/60 p-2 text-xs">
        {message.body}
      </pre>
      {useMailto && href ? (
        <Button nativeButton={false} variant="outline" render={<a href={href} />}>
          <MailIcon />
          Open in Outlook
        </Button>
      ) : href || to ? (
        <Button type="button" variant="outline" onClick={downloadEml}>
          <MailIcon />
          Download Outlook draft
        </Button>
      ) : (
        <Button type="button" variant="outline" disabled>
          Need client email first
        </Button>
      )}
    </div>
  )
}

function formatCopied(message: { subject: string; body: string }): string {
  return `${message.subject}\n\n${message.body}`
}

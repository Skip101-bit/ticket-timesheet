import { isValidEmail } from "@/lib/email"
import { sendEmail } from "@/lib/server/mail"
import { errorResponse, json, requireUser } from "@/lib/server/http"
import { getTicket } from "@/lib/server/records"
import { buildWorkOrderEmail } from "@/lib/tickets/email"
import type { OpenedEmailResult } from "@/lib/tickets/opened-email"
import { buildWorkOrderPdf } from "@/lib/tickets/pdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser()
    const { id } = await context.params
    const ticket = await getTicket(user, id)
    const body = (await request.json().catch(() => ({}))) as { to?: string }
    const to = (body.to ?? ticket.clientEmail).trim()
    if (!isValidEmail(to)) {
      const result: OpenedEmailResult = {
        status: "failed",
        error: "Client email is invalid.",
      }
      return json(result)
    }
    const message = buildWorkOrderEmail(ticket)
    const pdf = buildWorkOrderPdf(ticket)
    const filename = `${ticket.ticketNumber.replace(/[^\w.-]+/g, "-")}.pdf`
    return json(
      await sendEmail({
        to,
        subject: message.subject,
        text: message.body,
        attachments: [
          {
            filename,
            content: Buffer.from(pdf),
            contentType: "application/pdf",
          },
        ],
      })
    )
  } catch (error) {
    return errorResponse(error)
  }
}

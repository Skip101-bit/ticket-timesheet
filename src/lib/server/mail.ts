import { PRODUCT_NAME } from "@/lib/branding"
import type { OpenedEmailResult } from "@/lib/tickets/opened-email"

function smtpFromAddress(): string {
  return (process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "").trim()
}

function smtpFromHeader(): string {
  const address = smtpFromAddress()
  if (!address) return ""
  if (address.includes("<")) return address
  return `"${PRODUCT_NAME.replace(/"/g, "")}" <${address}>`
}

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && smtpFromAddress())
}

export type MailAttachment = {
  filename: string
  content: Buffer
  contentType: string
}

export async function sendEmail(options: {
  to: string
  subject: string
  text: string
  attachments?: MailAttachment[]
}): Promise<OpenedEmailResult> {
  if (!isSmtpConfigured()) return { status: "not_configured" }

  const host = process.env.SMTP_HOST!.trim()
  const port = Number(process.env.SMTP_PORT ?? "587")
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS ?? ""
  const from = smtpFromHeader()

  try {
    const { createTransport } = await import("nodemailer")
    const transporter = createTransport({
      host,
      port: Number.isFinite(port) && port > 0 ? port : 587,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 8_000,
    })
    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      attachments: options.attachments,
    })
    return { status: "sent" }
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Could not send the email.",
    }
  }
}

export async function sendPlainEmail(
  to: string,
  subject: string,
  text: string
): Promise<OpenedEmailResult> {
  return sendEmail({ to, subject, text })
}

export type OpenedEmailStatus = "sent" | "not_configured" | "failed"

export type OpenedEmailResult = {
  status: OpenedEmailStatus
  error?: string
}

import { TicketForm } from "@/components/tickets/ticket-form"

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <TicketForm ticketId={id} />
}

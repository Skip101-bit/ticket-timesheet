import { createTicket, listTickets } from "@/lib/server/records"
import { errorResponse, json, requireUser } from "@/lib/server/http"
import type { NewTicketInput } from "@/lib/tickets/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await requireUser()
    return json({ tickets: await listTickets(user) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = (await request.json()) as NewTicketInput
    return json({ ticket: await createTicket(user, body) }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}

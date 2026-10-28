import { deleteTicket, getTicket, updateTicket } from "@/lib/server/records"
import { errorResponse, json, requireUser } from "@/lib/server/http"
import type { Ticket } from "@/lib/tickets/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser()
    const { id } = await context.params
    return json({ ticket: await getTicket(user, id) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser()
    const { id } = await context.params
    const body = (await request.json()) as Partial<Ticket>
    return json({ ticket: await updateTicket(user, id, body) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireUser()
    const { id } = await context.params
    await deleteTicket(user, id)
    return json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}

import { deleteActivity, updateActivity } from "@/lib/server/records"
import { errorResponse, json, requireUser } from "@/lib/server/http"
import type { Activity } from "@/lib/calendar/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser()
    const { id } = await context.params
    const body = (await request.json()) as Partial<Activity>
    return json({ activity: await updateActivity(user, id, body) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireUser()
    const { id } = await context.params
    await deleteActivity(user, id)
    return json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}

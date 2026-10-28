import { assertRole } from "@/lib/server/auth"
import { deleteUser, updateUser } from "@/lib/server/records"
import { errorResponse, json, requireUser } from "@/lib/server/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireUser()
    assertRole(actor, ["admin"])
    const { id } = await context.params
    const body = (await request.json()) as { name?: string; role?: string; password?: string }
    return json({ user: await updateUser(actor, id, body) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const actor = await requireUser()
    assertRole(actor, ["admin"])
    const { id } = await context.params
    await deleteUser(actor, id)
    return json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}

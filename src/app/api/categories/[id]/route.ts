import { HttpError } from "@/lib/server/auth"
import { deleteCategory, updateCategory } from "@/lib/server/records"
import { errorResponse, json, requireUser } from "@/lib/server/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

async function staff() {
  const user = await requireUser()
  if (user.role === "finance") throw new HttpError("Finance cannot change categories.", 403)
  return user
}

export async function PATCH(request: Request, context: Context) {
  try {
    await staff()
    const { id } = await context.params
    const body = (await request.json()) as { name?: string }
    return json({ category: await updateCategory(id, body.name ?? "") })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await staff()
    const { id } = await context.params
    await deleteCategory(id)
    return json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}

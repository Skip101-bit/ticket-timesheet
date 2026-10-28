import { assertRole, HttpError } from "@/lib/server/auth"
import { createCategory, listCategories } from "@/lib/server/records"
import { errorResponse, json, requireUser } from "@/lib/server/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireUser()
    return json({ categories: await listCategories() })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    if (user.role === "finance") throw new HttpError("Finance cannot change categories.", 403)
    assertRole(user, ["admin", "user"])
    const body = (await request.json()) as { name?: string }
    return json({ category: await createCategory(body.name ?? "") }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}

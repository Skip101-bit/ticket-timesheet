import { updateOwnAccount } from "@/lib/server/auth"
import { errorResponse, json } from "@/lib/server/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; password?: string }
    const user = await updateOwnAccount({
      name: body.name ?? "",
      password: body.password,
    })
    return json({ user })
  } catch (error) {
    return errorResponse(error)
  }
}

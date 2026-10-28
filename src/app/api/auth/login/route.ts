import { login } from "@/lib/server/auth"
import { errorResponse, json } from "@/lib/server/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; username?: string; password?: string }
    const user = await login(String(body.name || body.username || ""), String(body.password ?? ""))
    if (!user) return json({ error: "Name or password is incorrect." }, 401)
    return json({ user })
  } catch (error) {
    return errorResponse(error)
  }
}

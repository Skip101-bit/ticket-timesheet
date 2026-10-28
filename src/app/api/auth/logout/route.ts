import { logout } from "@/lib/server/auth"
import { errorResponse, json } from "@/lib/server/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  try {
    await logout()
    return json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}

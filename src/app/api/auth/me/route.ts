import { currentUser } from "@/lib/server/auth"
import { json } from "@/lib/server/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const user = await currentUser()
  if (!user) return json({ user: null }, 401)
  return json({ user })
}

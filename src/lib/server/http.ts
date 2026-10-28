import { currentUser, HttpError } from "@/lib/server/auth"
import type { SessionUser } from "@/lib/auth/types"

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.message }, error.status)
  const message = error instanceof Error ? error.message : "Something went wrong."
  return json({ error: message }, 500)
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser()
  if (!user) throw new HttpError("Sign in required.", 401)
  return user
}

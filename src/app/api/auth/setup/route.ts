import { registerAccount } from "@/lib/server/auth"
import { errorResponse, json } from "@/lib/server/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; password?: string; role?: string }
    const user = await registerAccount({
      name: body.name ?? "",
      password: body.password ?? "",
      role: body.role ?? "",
    })
    return json({ user }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}

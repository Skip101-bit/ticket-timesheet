import { assertRole } from "@/lib/server/auth"
import { createUser, listUsers } from "@/lib/server/records"
import { errorResponse, json, requireUser } from "@/lib/server/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await requireUser()
    assertRole(user, ["admin"])
    return json({ users: await listUsers() })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    assertRole(user, ["admin"])
    const body = (await request.json()) as {
      name?: string
      password?: string
      role?: string
    }
    return json(
      {
        user: await createUser({
          name: body.name ?? "",
          password: body.password ?? "",
          role: body.role ?? "user",
        }),
      },
      201
    )
  } catch (error) {
    return errorResponse(error)
  }
}

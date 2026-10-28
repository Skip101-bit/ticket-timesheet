import { createActivity, listActivities } from "@/lib/server/records"
import { errorResponse, json, requireUser } from "@/lib/server/http"
import type { NewActivityInput } from "@/lib/calendar/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await requireUser()
    return json({ activities: await listActivities(user) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = (await request.json()) as NewActivityInput
    return json({ activity: await createActivity(user, body) }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}

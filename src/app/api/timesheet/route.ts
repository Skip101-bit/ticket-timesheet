import { createTimesheetEntry, listTimesheet } from "@/lib/server/records"
import { errorResponse, json, requireUser } from "@/lib/server/http"
import type { NewTimesheetEntryInput } from "@/lib/timesheet/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await requireUser()
    return json({ entries: await listTimesheet(user) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = (await request.json()) as NewTimesheetEntryInput
    return json({ entry: await createTimesheetEntry(user, body) }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}

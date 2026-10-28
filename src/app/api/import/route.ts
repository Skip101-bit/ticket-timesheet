import { importBrowserData } from "@/lib/server/records"
import { errorResponse, json, requireUser } from "@/lib/server/http"
import type { Ticket } from "@/lib/tickets/types"
import type { TimesheetEntry } from "@/lib/timesheet/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = (await request.json()) as {
      tickets?: Partial<Ticket>[]
      entries?: Partial<TimesheetEntry>[]
      sequences?: Record<string, number>
    }
    return json(await importBrowserData(user, body))
  } catch (error) {
    return errorResponse(error)
  }
}

import { deleteTimesheetEntry, updateTimesheetEntry } from "@/lib/server/records"
import { errorResponse, json, requireUser } from "@/lib/server/http"
import type { TimesheetEntry } from "@/lib/timesheet/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser()
    const { id } = await context.params
    const body = (await request.json()) as Partial<TimesheetEntry>
    return json({ entry: await updateTimesheetEntry(user, id, body) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireUser()
    const { id } = await context.params
    await deleteTimesheetEntry(user, id)
    return json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}

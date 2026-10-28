import { HttpError } from "@/lib/server/auth"
import { createMasterLineItem, listMasterLineItems } from "@/lib/server/records"
import { errorResponse, json, requireUser } from "@/lib/server/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireUser()
    return json({ lineItems: await listMasterLineItems() })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    if (user.role === "finance") throw new HttpError("Finance cannot change line items.", 403)
    const body = (await request.json()) as { description?: string; price?: number }
    return json(
      { lineItem: await createMasterLineItem(body.description ?? "", Number(body.price)) },
      201
    )
  } catch (error) {
    return errorResponse(error)
  }
}

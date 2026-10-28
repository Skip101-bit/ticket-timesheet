import { assertRole } from "@/lib/server/auth"
import { databaseFilePath } from "@/lib/server/db"
import { databaseSummary, databaseTable, rowsToCsv } from "@/lib/server/records"
import { errorResponse, json, requireUser } from "@/lib/server/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const user = await requireUser()
    assertRole(user, ["admin"])
    const url = new URL(request.url)
    const table = url.searchParams.get("table")
    const format = url.searchParams.get("format")
    if (!table) {
      return json({ tables: await databaseSummary(), file: databaseFilePath() })
    }
    const rows = await databaseTable(table)
    if (format === "csv") {
      return new Response(rowsToCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${table}.csv"`,
        },
      })
    }
    return json({ rows })
  } catch (error) {
    return errorResponse(error)
  }
}

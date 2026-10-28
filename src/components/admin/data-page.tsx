"use client"

import { useEffect, useState } from "react"
import { useSession } from "@/components/auth/auth-gate"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api/client"

const LABELS: Record<string, string> = {
  users: "Users",
  categories: "Categories",
  masterLineItems: "Line items",
  tickets: "Tickets",
  timesheet: "Timesheet",
  activities: "Activities",
}

export function DataPage() {
  const { user } = useSession()
  const [tables, setTables] = useState<{ table: string; count: number }[]>([])
  const [file, setFile] = useState("data/roboware.json")
  const [active, setActive] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user.role !== "admin") return
    const timer = window.setTimeout(() => {
      void api
        .databaseSummary()
        .then((result) => {
          setTables(result.tables)
          setFile(result.file)
          setError(null)
        })
        .catch((loadError: unknown) => {
          setError(loadError instanceof Error ? loadError.message : "Could not load the database.")
        })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [user.role])

  async function openTable(table: string) {
    try {
      setActive(table)
      setRows(await api.databaseTable(table))
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not open that table.")
    }
  }

  if (user.role !== "admin") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <Alert>
          <AlertTitle>Admin only</AlertTitle>
          <AlertDescription>You need admin to open this.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : []

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Database</h1>
        <p className="text-sm text-muted-foreground">
          All tickets sit in {file}. Passwords are not shown.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not read data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => (
          <Card key={table.table}>
            <CardHeader>
              <CardTitle>{LABELS[table.table] ?? table.table}</CardTitle>
              <CardDescription>{table.count} records</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => void openTable(table.table)}>
                View
              </Button>
              <Button
                nativeButton={false}
                variant="outline"
                render={<a href={`/api/data?table=${encodeURIComponent(table.table)}&format=csv`} />}
              >
                Download CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {active ? (
        <Card>
          <CardHeader>
            <CardTitle>{LABELS[active] ?? active}</CardTitle>
            <CardDescription>{rows.length} records</CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">This table is empty.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column}>{column}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={String(row.id ?? index)}>
                      {columns.map((column) => (
                        <TableCell key={column} className="max-w-64 truncate align-top">
                          {formatCell(row[column])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function formatCell(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

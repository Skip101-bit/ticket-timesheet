import { Suspense } from "react"
import { TimesheetWeekView } from "@/components/timesheet/timesheet-week-view"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function TimesheetPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
          <Card>
            <CardHeader>
              <CardTitle>Loading timesheet</CardTitle>
              <CardDescription>Loading the week…</CardDescription>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <TimesheetWeekView />
    </Suspense>
  )
}

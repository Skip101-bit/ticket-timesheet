export function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function parseLocalDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function isLocalDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return toLocalDateKey(parseLocalDateKey(value)) === value
}

export function startOfWeekMonday(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  return start
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

export function weekDateKeys(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, index) => toLocalDateKey(addDays(monday, index)))
}

export function toDatetimeLocalValue(iso: string): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function fromDatetimeLocalValue(value: string): string {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6)
  const sameMonth = monday.getMonth() === sunday.getMonth()
  const sameYear = monday.getFullYear() === sunday.getFullYear()
  const start = monday.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  })
  const end = sunday.toLocaleDateString(undefined, {
    day: "numeric",
    month: sameMonth ? undefined : "short",
    year: "numeric",
  })
  return `${start} – ${end}`
}

export function isoToDateKey(iso: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return toLocalDateKey(date)
}

export function parseHm(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

export function hoursBetween(startTime: string, endTime: string): number {
  const start = parseHm(startTime)
  const end = parseHm(endTime)
  if (!start || !end) return 0
  let minutes = end.hours * 60 + end.minutes - (start.hours * 60 + start.minutes)
  if (minutes <= 0) minutes += 24 * 60
  return Math.round((minutes / 60) * 100) / 100
}

export function addHoursToTime(startTime: string, hours: number): string {
  const start = parseHm(startTime) ?? { hours: 8, minutes: 0 }
  const total = start.hours * 60 + start.minutes + Math.round(hours * 60)
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  return `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}`
}

export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return "0"
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2)
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" })
}

export function monthCalendarCells(monthStart: Date): { key: string; inMonth: boolean }[] {
  const first = startOfMonth(monthStart)
  const gridStart = startOfWeekMonday(first)
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index)
    return {
      key: toLocalDateKey(date),
      inMonth: date.getMonth() === first.getMonth(),
    }
  })
}

import type { Activity } from "@/lib/calendar/types"

export function normalizeActivity(raw: Partial<Activity> & { id: string }): Activity {
  return {
    id: raw.id,
    date: raw.date ?? "",
    title: (raw.title ?? "").trim(),
    note: raw.note ?? "",
    startTime: raw.startTime ?? "",
    endTime: raw.endTime ?? "",
    userId: raw.userId ?? "",
    userName: raw.userName ?? "",
    colour: raw.colour ?? "",
    createdAt: raw.createdAt ?? "",
    updatedAt: raw.updatedAt ?? "",
  }
}

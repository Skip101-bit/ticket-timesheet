import fs from "node:fs"
import path from "node:path"

import type { SessionUser, UserRole } from "@/lib/auth/types"
import type { Category, MasterLineItem } from "@/lib/catalog/types"
import { hashPassword, verifyPassword } from "@/lib/server/password"
import type { Activity } from "@/lib/calendar/types"
import type { Ticket } from "@/lib/tickets/types"
import type { TimesheetEntry } from "@/lib/timesheet/types"

export type { Category, MasterLineItem }

export type DbUser = SessionUser & {
  username: string
  passwordHash: string
  createdAt: string
}

export type DbSession = {
  id: string
  userId: string
  expiresAt: string
}

export type Database = {
  version: 1
  users: DbUser[]
  sessions: DbSession[]
  categories: Category[]
  masterLineItems: MasterLineItem[]
  tickets: Ticket[]
  sequences: Record<string, number>
  timesheet: TimesheetEntry[]
  activities: Activity[]
  setupComplete?: boolean
}

function resolveDatabaseFilePath(): string {
  const configured = process.env.DATA_DIR?.trim()
  if (!configured) {
    return path.join(process.cwd(), "data", "roboware.json")
  }
  const dataDir = path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured)
  return path.join(dataDir, "roboware.json")
}

const filePath = resolveDatabaseFilePath()

let queue: Promise<unknown> = Promise.resolve()

function nowIso(): string {
  return new Date().toISOString()
}

function seedDatabase(): Database {
  const createdAt = nowIso()
  return {
    version: 1,
    users: [
      {
        id: crypto.randomUUID(),
        name: "Admin",
        username: "admin",
        passwordHash: hashPassword("admin"),
        role: "admin" satisfies UserRole,
        createdAt,
      },
    ],
    sessions: [],
    categories: ["Quote", "Support", "Development"].map((name) => ({
      id: crypto.randomUUID(),
      name,
      createdAt,
    })),
    masterLineItems: [],
    tickets: [],
    sequences: {},
    timesheet: [],
    activities: [],
    setupComplete: false,
  }
}

function untouchedSeedAdmin(db: Database): boolean {
  if (db.users.length !== 1) return false
  const user = db.users[0]
  if (!user) return false
  const seedLogin =
    user.username === "admin" || user.name.trim().toLowerCase() === "admin"
  if (!seedLogin) return false
  return verifyPassword("admin", user.passwordHash)
}

function slugFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return slug.length >= 2 ? slug : "user"
}

function migrateUsersForNameLogin(db: Database): boolean {
  let dirty = false
  for (const user of db.users) {
    if (!user.username) {
      const nextUsername = slugFromName(user.name)
      const taken = db.users.some((other) => other.id !== user.id && other.username === nextUsername)
      user.username = taken ? `${nextUsername}-${user.id.slice(0, 8)}` : nextUsername
      dirty = true
    }
  }
  return dirty
}

function readDatabase(): Database {
  try {
    if (!fs.existsSync(filePath)) return seedDatabase()
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<Database>
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.users)) {
      throw new Error("Database file is unreadable.")
    }
    return {
      version: 1,
      users: parsed.users,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      masterLineItems: Array.isArray(parsed.masterLineItems) ? parsed.masterLineItems : [],
      tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
      sequences: parsed.sequences && typeof parsed.sequences === "object" ? parsed.sequences : {},
      timesheet: Array.isArray(parsed.timesheet) ? parsed.timesheet : [],
      activities: Array.isArray(parsed.activities) ? parsed.activities : [],
      setupComplete: typeof parsed.setupComplete === "boolean" ? parsed.setupComplete : undefined,
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Database file is unreadable.") throw error
    throw new Error("Could not read the application database.", { cause: error })
  }
}

function writeDatabase(db: Database): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temp = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(temp, JSON.stringify(db, null, 2))
  fs.renameSync(temp, filePath)
}

export function databaseFilePath(): string {
  return filePath
}

export function withDatabase<T>(fn: (db: Database, markDirty: () => void) => T): Promise<T> {
  const task = queue.then(() => {
    const db = readDatabase()
    let dirty = false
    if (typeof db.setupComplete !== "boolean") {
      db.setupComplete = !untouchedSeedAdmin(db)
      dirty = true
    }
    if (migrateUsersForNameLogin(db)) dirty = true
    const result = fn(db, () => {
      dirty = true
    })
    if (dirty || !fs.existsSync(filePath)) writeDatabase(db)
    return result
  })
  queue = task.then(
    () => undefined,
    () => undefined
  )
  return task
}

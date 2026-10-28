import { cookies } from "next/headers"

import type { SessionUser, UserRole } from "@/lib/auth/types"
import { isUserRole } from "@/lib/auth/types"
import { withDatabase, type DbUser } from "@/lib/server/db"
import { hashPassword, verifyPassword } from "@/lib/server/password"

export const SESSION_COOKIE = "roboware_session"
const SESSION_DAYS = 30

function nowIso(): string {
  return new Date().toISOString()
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export function publicUser(user: DbUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
  }
}

export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

export function displayName(name: string): string {
  const next = name.trim().replace(/\s+/g, " ")
  if (next.length < 2) throw new HttpError("Name must be at least 2 characters.", 400)
  if (next.length > 80) throw new HttpError("Name must be 80 characters or fewer.", 400)
  return next
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

export function uniqueUsername(users: { id: string; username: string }[], name: string, exceptId?: string): string {
  const base = slugFromName(name)
  let candidate = base
  let n = 2
  while (users.some((user) => user.username === candidate && user.id !== exceptId)) {
    const suffix = `-${n}`
    candidate = `${base.slice(0, Math.max(1, 40 - suffix.length))}${suffix}`
    n += 1
  }
  return candidate
}

export function nameInUse(users: { id: string; name: string }[], name: string, exceptId?: string): boolean {
  const key = nameKey(name)
  return users.some((user) => nameKey(user.name) === key && user.id !== exceptId)
}

function usernameKey(username: string | undefined): string {
  return (username ?? "").trim().toLowerCase()
}

function matchesLogin(user: DbUser, login: string): boolean {
  const key = nameKey(login)
  if (!key) return false
  const username = usernameKey(user.username)
  const lowered = login.trim().toLowerCase()
  const slug = slugFromName(login)
  const userNameKey = nameKey(user.name ?? "")
  return (
    userNameKey === key ||
    userNameKey.startsWith(`${key} `) ||
    username === lowered ||
    username === slug ||
    nameKey(username.replace(/-/g, " ")) === key
  )
}

function passwordMatches(password: string, stored: string): boolean {
  if (verifyPassword(password, stored)) return true
  const trimmed = password.trim()
  return trimmed !== password && verifyPassword(trimmed, stored)
}

function findUserByLogin(users: DbUser[], login: string, password: string): DbUser | undefined {
  const candidates = users.filter((user) => matchesLogin(user, login))
  return candidates.find((user) => passwordMatches(password, user.passwordHash))
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null
  return withDatabase((db, markDirty) => {
    const now = nowIso()
    const before = db.sessions.length
    db.sessions = db.sessions.filter((session) => session.expiresAt > now)
    if (db.sessions.length !== before) markDirty()
    const session = db.sessions.find((item) => item.id === token)
    if (!session) return null
    const user = db.users.find((item) => item.id === session.userId)
    return user ? publicUser(user) : null
  })
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies()
  return getSessionUser(jar.get(SESSION_COOKIE)?.value)
}

async function setSessionCookie(sessionId: string): Promise<void> {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  })
}

function checkedCredentials(name: string, password: string, passwordRequired: boolean) {
  const nextName = displayName(name)
  const nextPassword = password.trim()
  if (passwordRequired || nextPassword) {
    if (nextPassword.length < 4) throw new HttpError("Password must be at least 4 characters.", 400)
  }
  return { name: nextName, password: nextPassword }
}

function publicSignupRole(role: string): "admin" | "user" {
  if (role === "admin" || role === "user") return role
  throw new HttpError("Choose Admin or User.", 400)
}

export async function registerAccount(input: {
  name: string
  password: string
  role: string
}): Promise<SessionUser> {
  const credentials = checkedCredentials(input.name, input.password, true)
  const role = publicSignupRole(input.role)
  const result = await withDatabase((db, markDirty) => {
    if (nameInUse(db.users, credentials.name)) {
      throw new HttpError("That name is already in use.", 400)
    }
    const user = {
      id: crypto.randomUUID(),
      name: credentials.name,
      username: uniqueUsername(db.users, credentials.name),
      passwordHash: hashPassword(credentials.password),
      role,
      createdAt: nowIso(),
    }
    db.users.push(user)
    db.setupComplete = true
    const session = {
      id: crypto.randomUUID(),
      userId: user.id,
      expiresAt: addDays(nowIso(), SESSION_DAYS),
    }
    db.sessions.push(session)
    markDirty()
    return { user: publicUser(user), sessionId: session.id }
  })
  await setSessionCookie(result.sessionId)
  return result.user
}

export async function updateOwnAccount(input: { name: string; password?: string }): Promise<SessionUser> {
  const actor = await currentUser()
  if (!actor) throw new HttpError("Sign in required.", 401)
  const credentials = checkedCredentials(input.name, input.password ?? "", false)
  return withDatabase((db, markDirty) => {
    const index = db.users.findIndex((user) => user.id === actor.id)
    if (index < 0) throw new HttpError("User not found.", 404)
    if (nameInUse(db.users, credentials.name, actor.id)) {
      throw new HttpError("That name is already in use.", 400)
    }
    const next = {
      ...db.users[index],
      name: credentials.name,
      username: uniqueUsername(db.users, credentials.name, actor.id),
    }
    if (credentials.password.trim()) next.passwordHash = hashPassword(credentials.password)
    db.users[index] = next
    for (const entry of db.timesheet) {
      if (entry.userId === actor.id) entry.userName = credentials.name
    }
    for (const activity of db.activities) {
      if (activity.userId === actor.id) activity.userName = credentials.name
    }
    markDirty()
    return publicUser(next)
  })
}

export async function login(name: string, password: string): Promise<SessionUser | null> {
  const result = await withDatabase((db, markDirty) => {
    const user = findUserByLogin(db.users, name, password)
    if (!user) return null
    const session = {
      id: crypto.randomUUID(),
      userId: user.id,
      expiresAt: addDays(nowIso(), SESSION_DAYS),
    }
    db.sessions.push(session)
    markDirty()
    return { user: publicUser(user), sessionId: session.id }
  })
  if (!result) return null
  await setSessionCookie(result.sessionId)
  return result.user
}

export async function logout(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) {
    await withDatabase((db, markDirty) => {
      const next = db.sessions.filter((session) => session.id !== token)
      if (next.length !== db.sessions.length) {
        db.sessions = next
        markDirty()
      }
    })
  }
  jar.delete(SESSION_COOKIE)
}

export function assertRole(user: SessionUser, roles: UserRole[]): void {
  if (!roles.includes(user.role) || !isUserRole(user.role)) {
    throw new HttpError("You do not have access to that.", 403)
  }
}

export class HttpError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "HttpError"
    this.status = status
  }
}

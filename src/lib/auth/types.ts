export const USER_ROLES = ["admin", "user", "finance"] as const

export type UserRole = (typeof USER_ROLES)[number]

export type SessionUser = {
  id: string
  name: string
  role: UserRole
}

export type Account = SessionUser & {
  createdAt: string
}

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole)
}

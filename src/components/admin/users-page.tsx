"use client"

import { useEffect, useState } from "react"
import { Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/components/auth/auth-gate"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api } from "@/lib/api/client"
import { USER_ROLES, isUserRole, type Account, type UserRole } from "@/lib/auth/types"

function roleLabel(role: string): string {
  if (role === "admin") return "Admin"
  if (role === "finance") return "Finance"
  return "User"
}

export function UsersPage() {
  const { user } = useSession()
  const [users, setUsers] = useState<Account[]>([])
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("user")

  async function reload() {
    try {
      setUsers(await api.listUsers())
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load users.")
    }
  }

  useEffect(() => {
    if (user.role !== "admin") return
    const timer = window.setTimeout(() => {
      void reload()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [user.role])

  if (user.role !== "admin") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <Alert>
          <AlertTitle>Admin only</AlertTitle>
          <AlertDescription>You need admin to add or remove people.</AlertDescription>
        </Alert>
      </div>
    )
  }

  async function handleAdd() {
    try {
      await api.createUser({ name, password, role })
      setName("")
      setPassword("")
      setRole("user")
      await reload()
      toast.success("User added.")
    } catch (addError) {
      toast.error(addError instanceof Error ? addError.message : "Could not add that user.")
    }
  }

  async function handleRemove(account: Account) {
    if (!window.confirm(`Remove ${account.name}?`)) return
    try {
      await api.deleteUser(account.id)
      await reload()
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Could not remove that user.")
    }
  }

  async function handleSave(account: Account, next: { name: string; role: UserRole; password: string }) {
    try {
      await api.updateUser(account.id, {
        name: next.name,
        role: next.role,
        password: next.password || undefined,
      })
      await reload()
      toast.success("User saved.")
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save that user.")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Admin sees everyone’s hours. Finance sees jobs assigned to them. Users issue tickets and log their own time.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a user</CardTitle>
          <CardDescription>They sign in with this name.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="user-name">Name</Label>
            <Input id="user-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="user-password">Password</Label>
            <Input
              id="user-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(value) => {
                const next = typeof value === "string" ? value : "user"
                setRole(isUserRole(next) ? next : "user")
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{roleLabel(role)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {roleLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" className="sm:col-span-2 sm:justify-self-start" onClick={() => void handleAdd()}>
            Add user
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load users</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3">
        {users.map((account) => (
          <UserRow
            key={account.id}
            account={account}
            isSelf={account.id === user.id}
            onSave={handleSave}
            onRemove={() => void handleRemove(account)}
          />
        ))}
      </div>
    </div>
  )
}

function UserRow({
  account,
  isSelf,
  onSave,
  onRemove,
}: {
  account: Account
  isSelf: boolean
  onSave: (account: Account, next: { name: string; role: UserRole; password: string }) => Promise<void>
  onRemove: () => void
}) {
  const [name, setName] = useState(account.name)
  const [role, setRole] = useState<UserRole>(account.role)
  const [password, setPassword] = useState("")

  return (
    <Card>
      <CardContent className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_auto]">
        <Input value={name} aria-label="Name" onChange={(event) => setName(event.target.value)} />
        <Select
          value={role}
          onValueChange={(value) => {
            const next = typeof value === "string" ? value : "user"
            setRole(isUserRole(next) ? next : "user")
          }}
        >
          <SelectTrigger className="w-full" aria-label="Role">
            <SelectValue>{roleLabel(role)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {USER_ROLES.map((item) => (
              <SelectItem key={item} value={item}>
                {roleLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="password"
          value={password}
          placeholder="New password"
          aria-label="New password"
          onChange={(event) => setPassword(event.target.value)}
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void onSave(account, { name, role, password })}>
            Save
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Remove user" disabled={isSelf} onClick={onRemove}>
            <Trash2Icon />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

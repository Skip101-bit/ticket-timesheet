"use client"

import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { useSession } from "@/components/auth/auth-gate"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api/client"

export function AccountPage() {
  const { user, setUser } = useSession()
  const [name, setName] = useState(user.name)
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const result = await api.updateAccount({
        name,
        password: password.trim() ? password : undefined,
      })
      setUser(result.user)
      setName(result.user.name)
      setPassword("")
      toast.success("Account saved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your account.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">Change your name or password. You sign in with the name.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your sign-in</CardTitle>
          <CardDescription>Leave password blank to keep the current one.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid gap-1.5">
              <Label htmlFor="account-name">Name</Label>
              <Input
                id="account-name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="account-password">New password</Label>
              <Input
                id="account-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

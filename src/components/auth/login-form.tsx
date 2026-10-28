"use client"

import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, importBrowserDataOnce } from "@/lib/api/client"
import type { SessionUser } from "@/lib/auth/types"
import { PRODUCT_NAME } from "@/lib/branding"

export function LoginForm({ onSignedIn }: { onSignedIn: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"admin" | "user" | "">("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === "register" && (role === "admin" || role === "user") === false) {
      toast.error("Choose Admin or User.")
      return
    }
    const data = new FormData(event.currentTarget)
    const nextName = String(data.get("name") ?? "").trim() || name.trim()
    const nextPassword = String(data.get("password") || password)
    setName(nextName)
    setPassword(nextPassword)
    setSubmitting(true)
    try {
      const result =
        mode === "register"
          ? await api.register({ name: nextName, password: nextPassword, role: role === "user" ? "user" : "admin" })
          : await api.login(nextName, nextPassword)
      try {
        await importBrowserDataOnce()
      } catch {
        toast.error("Signed in, but old browser tickets could not be copied across.")
      }
      onSignedIn(result.user)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in.")
      setSubmitting(false)
    }
  }

  const register = mode === "register"

  return (
    <div className="grid min-h-svh w-full place-items-center px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
        <img
          src="/roboware-logo.png"
          alt="Roboware"
          width={256}
          height={243}
          className="mx-auto h-auto w-[256px] max-w-full shrink-0"
        />
        <p className="text-center text-sm font-medium text-teal-900">{PRODUCT_NAME}</p>
        <Card className="w-full">
          <CardHeader>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={register ? "outline" : "default"}
                onClick={() => setMode("login")}
              >
                Sign in
              </Button>
              <Button
                type="button"
                variant={register ? "default" : "outline"}
                onClick={() => setMode("register")}
              >
                Create account
              </Button>
            </div>
            <CardTitle>{register ? "Create account" : "Sign in"}</CardTitle>
            <CardDescription>
              {register
                ? "Name, password, and role."
                : "Name and password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={(event) => void handleSubmit(event)}>
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="username"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {register ? (
                <div className="grid gap-1.5">
                  <Label>Role</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={role === "admin" ? "default" : "outline"}
                      onClick={() => setRole("admin")}
                    >
                      Admin
                    </Button>
                    <Button
                      type="button"
                      variant={role === "user" ? "default" : "outline"}
                      onClick={() => setRole("user")}
                    >
                      User
                    </Button>
                  </div>
                </div>
              ) : null}
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : register ? "Create account" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

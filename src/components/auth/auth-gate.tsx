"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { AppHeader } from "@/components/layout/app-header"
import { LoginForm } from "@/components/auth/login-form"
import { api, importBrowserDataOnce } from "@/lib/api/client"
import type { SessionUser } from "@/lib/auth/types"

type SessionContextValue = {
  user: SessionUser
  setUser: (user: SessionUser) => void
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error("Sign in before using the session.")
  return value
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)

  async function refresh() {
    try {
      const result = await api.me()
      try {
        await importBrowserDataOnce()
      } catch {
        // A failed import must not sign the person out.
      }
      setUser(result.user)
    } catch {
      setUser(null)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh()
    }, 0)
    function onUnauthorized() {
      setUser(null)
    }
    window.addEventListener("roboware:unauthorized", onUnauthorized)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("roboware:unauthorized", onUnauthorized)
    }
  }, [])

  if (!user) {
    return (
      <LoginForm
        onSignedIn={(next) => {
          setUser(next)
        }}
      />
    )
  }

  return (
    <SessionContext.Provider
      value={{
        user,
        setUser: (next) => {
          setUser(next)
        },
        logout: async () => {
          await api.logout()
          setUser(null)
        },
      }}
    >
      <div className="app-shell flex min-h-svh flex-1 flex-col md:flex-row">
        <AppHeader />
        {children}
      </div>
    </SessionContext.Provider>
  )
}

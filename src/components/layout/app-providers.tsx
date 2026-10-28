"use client"

import type { ReactNode } from "react"
import { Toaster } from "@/components/ui/sonner"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      {children}
      <Toaster position="top-right" />
    </div>
  )
}

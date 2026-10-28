"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { RobowareLogo } from "@/components/branding/roboware-logo"
import { useSession } from "@/components/auth/auth-gate"
import { Button } from "@/components/ui/button"
import { PRODUCT_NAME } from "@/lib/branding"
import { cn } from "@/lib/utils"

function MenuGlyph({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      {open ? (
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          d="M6 6l12 12M18 6L6 18"
        />
      ) : (
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          d="M4 7h16M4 12h16M4 17h16"
        />
      )}
    </svg>
  )
}

const NAV = [
  { href: "/", label: "Tickets" },
  { href: "/timesheet", label: "Timesheet" },
  { href: "/calendar", label: "Calendar" },
  { href: "/line-items", label: "Line items" },
  { href: "/categories", label: "Categories" },
] as const

export function AppHeader() {
  const pathname = usePathname()
  const { user, logout } = useSession()
  const [open, setOpen] = useState(false)
  const items = [
    ...NAV.filter(
      (item) =>
        user.role !== "finance" || item.href === "/" || item.href === "/timesheet" || item.href === "/calendar",
    ),
    { href: "/account", label: "Account" },
    ...(user.role === "admin"
      ? [
          { href: "/users", label: "Users" },
          { href: "/data", label: "Data" },
        ]
      : []),
  ]

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <aside className="no-print sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur-sm md:h-svh md:w-56 md:shrink-0 md:border-b-0 md:border-r">
      <div
        className={cn(
          "flex px-3 py-2 md:h-full md:flex-col md:items-stretch md:gap-6 md:px-3 md:py-4",
          open ? "flex-col items-stretch gap-3" : "items-center justify-between",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <Link href="/" title={PRODUCT_NAME} className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <RobowareLogo className="h-10 md:h-14" />
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <MenuGlyph open={open} />
          </Button>
        </div>
        <div
          className={cn(
            "min-h-0 flex-col gap-4 overflow-y-auto md:flex md:flex-1",
            open ? "flex" : "hidden",
          )}
        >
          <nav className="flex flex-col gap-1">
            {items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/" || pathname.startsWith("/tickets")
                  : pathname.startsWith(item.href)
              return (
                <Button
                  key={item.href}
                  nativeButton={false}
                  variant={active ? "secondary" : "ghost"}
                  render={<Link href={item.href} />}
                  className={cn("w-full justify-start", active && "bg-teal-50 text-teal-950")}
                >
                  {item.label}
                </Button>
              )
            })}
          </nav>
          <div className="mt-auto flex flex-col gap-2 border-t border-stone-200 pt-3">
            <p className="px-2.5 text-sm text-muted-foreground">
              {user.name}
              <span className="ml-1 capitalize">({user.role})</span>
            </p>
            <Button variant="ghost" className="w-full justify-start" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}

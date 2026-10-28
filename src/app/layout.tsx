import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { AuthGate } from "@/components/auth/auth-gate"
import { AppProviders } from "@/components/layout/app-providers"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Roboware Ticket Timesheet",
  description: "Field-service job tickets and technician overtime timesheet.",
}

export const dynamic = "force-dynamic"

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-svh flex-col bg-stone-50 text-foreground">
        <AppProviders>
          <AuthGate>
            <main className="flex-1">{children}</main>
          </AuthGate>
        </AppProviders>
      </body>
    </html>
  )
}

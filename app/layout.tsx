import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import ThemeInit from "@/components/ThemeInit"

export const metadata: Metadata = {
  title: "OpenHouse · OpenHire Prototype",
  description:
    "Internal OpenAI workspace shell demonstrating the OpenHire recruiter copilot experience.",
  applicationName: "OpenHouse",
  authors: [{ name: "OpenAI Recruiting Tools" }],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ThemeInit />
        {children}
        <Analytics />
      </body>
    </html>
  )
}

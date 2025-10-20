import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import ThemeInit from "@/components/ThemeInit"

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
})

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
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeInit />
        {children}
        <Analytics />
      </body>
    </html>
  )
}

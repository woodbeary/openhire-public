"use client"

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Command,
  ExternalLink,
  FileText,
  Folder,
  Megaphone,
  Menu,
  Search,
  Users,
  Video,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import type { ComponentType } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function OpenHousePage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#f7f8fb] text-[#0a0f18]">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-transparent bg-white px-6 pb-10 pt-8 transition-transform duration-300 lg:static lg:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-10">
          <h1 className="text-[26px] font-semibold tracking-tight text-[#101520]">OpenHouse</h1>
        </div>
        <nav className="space-y-1 text-sm text-[#5a6170]">
          <SidebarItem icon={Folder} label="Directory" />
          <SidebarItem icon={Megaphone} label="Announcements" />
          <SidebarItem icon={Video} label="Videos" />
          <SidebarItem icon={FileText} label="Resources" />
          <SidebarItem icon={Users} label="Support by Team" />
        </nav>
        <div className="mt-14 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#c1c6d1]">
          Loops
        </div>
        <Link
          href="/openhire"
          className="mt-4 inline-flex w-full items-center justify-between rounded-[22px] bg-[#0f141f] px-5 py-3 text-sm font-semibold text-white shadow-[0_22px_48px_-32px_rgba(15,20,31,0.78)] transition hover:bg-[#1a2331]"
        >
          <span>OpenHire</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.25em]">
            New
          </span>
        </Link>
      </aside>

      {isMobileMenuOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="flex flex-1 justify-center">
        <div className="w-full max-w-[1080px] px-6 pb-24 pt-12 sm:px-12">
          <header className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 lg:hidden"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1" />
            <div className="hidden items-center gap-3 text-[#6c7384] sm:flex">
              <HeaderButton icon={Search} label="Open search" />
              <div className="flex items-center gap-1 rounded-lg border border-[#dfe2ea] bg-white px-2 py-1 text-[11px] font-medium">
                <Command className="h-3.5 w-3.5" />
                <span className="tracking-wide">K</span>
              </div>
              <HeaderButton icon={ExternalLink} label="Open new window" />
              <Avatar className="h-10 w-10 border border-[#dfe2ea]">
                <AvatarImage
                  src="https://placehold.co/160x160/eff2f7/4a5363?text=SC"
                  alt="Scotty"
                />
                <AvatarFallback className="bg-[#eff2f7] text-[#4a5363]">SC</AvatarFallback>
              </Avatar>
            </div>
          </header>

          <section className="mt-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-[#aeb5c1]">Friday, October 17</p>
            <h2 className="mt-6 text-[46px] font-semibold tracking-tight text-[#0a0f18]">Good afternoon, Scotty!</h2>
            <p className="mt-6 max-w-2xl text-[15px] leading-7 text-[#6a7182]">
              Search across people, loops, and knowledge to keep context at your fingertips and move quickly together.
            </p>
            <div className="mt-8 flex justify-start">
              <div className="relative flex w-full max-w-[620px] items-center rounded-[30px] border border-[#eceef5] bg-white px-6 py-4 shadow-[0_24px_60px_-45px_rgba(10,15,24,0.45)]">
                <Input
                  className="h-10 flex-1 border-none bg-transparent pl-0 text-sm text-[#0a0f18] focus-visible:ring-0"
                  placeholder="Search across people, loops, and knowledge..."
                />
                <button
                  type="button"
                  aria-label="Submit search"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#f7f8fb] to-[#d9dee7] text-[#141e2d] shadow-[0_12px_26px_-18px_rgba(10,15,24,0.55)]"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          <section className="mt-24">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-[22px] font-semibold tracking-tight text-[#0a0f18]">ICYMI</h3>
              <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.32em] text-[#aeb5c1]">
                <span>Showing until September 13, 2025</span>
                <div className="flex items-center gap-2">
                  <CarouselButton direction="prev" />
                  <CarouselButton direction="next" />
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-2">
              <Card className="border border-[#f0f2f6] bg-white shadow-[0_28px_65px_-52px_rgba(10,15,24,0.58)]">
                <CardContent className="px-9 pb-10 pt-9">
                  <h4 className="mb-4 text-[19px] font-semibold tracking-tight text-[#0a0f18]">
                    Introducing GPT-5-Codex
                  </h4>
                  <p className="mb-7 text-[15px] leading-7 text-[#5e6574]">
                    Today we&apos;re launching GPT-5-Codex, a version of GPT-5 optimized for agentic coding and
                    collaborative pair programming in the Codex CLI, the IDE extension, and Codex Web. GPT-5-Codex is
                    able to dynamically adjust how...
                  </p>
                  <ArticleFooter
                    name="Andrey Mishchenko"
                    image="https://placehold.co/160x160/eff2f7/4a5363?text=AM"
                    fallback="AM"
                    meta={["September 15, 2025", "Research & Deployment"]}
                  />
                </CardContent>
              </Card>

              <Card className="border border-[#f0f2f6] bg-white shadow-[0_28px_65px_-52px_rgba(10,15,24,0.58)]">
                <CardContent className="px-9 pb-10 pt-9">
                  <h4 className="mb-4 text-[19px] font-semibold tracking-tight text-[#0a0f18]">
                    New economic research paper: How people use ChatGPT
                  </h4>
                  <p className="mb-7 text-[15px] leading-7 text-[#5e6574]">
                    Tonight we&apos;re releasing the largest study to date of how people use ChatGPT, in collaboration
                    with Harvard economist David Deming. The paper, which will be published through the National Bureau
                    of Economic Research, analyzes...
                  </p>
                  <ArticleFooter
                    name="Ronnie Chatterji"
                    image="https://placehold.co/160x160/eff2f7/4a5363?text=RC"
                    fallback="RC"
                    meta={["September 14, 2025", "Customers & Partners", "Research & Deployment"]}
                  />
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="mt-20">
            <div className="flex items-center justify-between">
              <h3 className="text-[22px] font-semibold tracking-tight text-[#0a0f18]">Videos</h3>
              <div className="flex items-center gap-2">
                <CarouselButton direction="prev" />
                <CarouselButton direction="next" />
              </div>
            </div>
            <div className="mt-6 h-28 rounded-[26px] border border-dashed border-[#e6e9f0] bg-white/60" />
          </section>
        </div>
      </div>
    </div>
  )
}

function SidebarItem({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[#f2f3f6] hover:text-[#0a0f18]">
      <Icon className="h-[15px] w-[15px]" />
      <span>{label}</span>
    </button>
  )
}

function HeaderButton({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dfe2ea] bg-white text-[#6c7384] shadow-[0_16px_40px_-40px_rgba(10,15,24,0.8)] transition hover:border-[#d0d4dd]"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function CarouselButton({ direction }: { direction: "prev" | "next" }) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight
  const label = direction === "prev" ? "Previous" : "Next"
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dfe2ea] bg-white text-[#6c7384] shadow-[0_16px_40px_-40px_rgba(10,15,24,0.8)] transition hover:border-[#d0d4dd]"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function ArticleFooter({
  name,
  image,
  fallback,
  meta,
}: {
  name: string
  image: string
  fallback: string
  meta: string[]
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8">
        <AvatarImage src={image} alt={name} />
        <AvatarFallback className="bg-[#d4d8e3] text-xs text-[#40495b]">{fallback}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="text-sm font-medium text-[#0a0f18]">{name}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#8f96a6]">
          {meta.map((entry, idx) => (
            <span key={entry} className="flex items-center gap-2">
              {idx > 0 && <span className="text-[#cdd1dc]">•</span>}
              {entry}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

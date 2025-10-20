"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  type DetailedHTMLProps,
  type HTMLAttributes,
} from "react"
import type { ChatKitOptions } from "@openai/chatkit"
import { AlertCircle, Loader2, MoreHorizontal } from "lucide-react"
import Link from "next/link"

import { candidates, type CandidateProfile } from "@/lib/candidates"
import { missionDefinitions, type MissionId } from "@/lib/missions"

const CHATKIT_SCRIPT_URL =
  process.env.NEXT_PUBLIC_CHATKIT_SCRIPT_URL ??
  "https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"

let chatKitScriptPromise: Promise<void> | null = null

function ensureChatKitScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve()
  }

  if (customElements.get("openai-chatkit")) {
    return Promise.resolve()
  }

  if (chatKitScriptPromise) {
    return chatKitScriptPromise
  }

  const existingScript = document.querySelector<HTMLScriptElement>("script[data-openai-chatkit]")
  if (existingScript) {
    chatKitScriptPromise = customElements.whenDefined("openai-chatkit").then(() => undefined)
    return chatKitScriptPromise
  }

  chatKitScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = CHATKIT_SCRIPT_URL
    script.async = true
    script.setAttribute("data-openai-chatkit", "true")
    script.addEventListener("error", () => {
      chatKitScriptPromise = null
      reject(new Error("Failed to load the ChatKit bundle."))
    })
    script.addEventListener("load", () => {
      customElements
        .whenDefined("openai-chatkit")
        .then(() => resolve())
        .catch((error) => {
          chatKitScriptPromise = null
          reject(error)
        })
    })
    document.head.appendChild(script)
  })

  return chatKitScriptPromise
}

function extractWorkflowFileIds(result: unknown): string[] {
  const ids = new Set<string>()
  const seen = new WeakSet<object>()

  const visit = (value: unknown) => {
    if (!value) {
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item)
      }
      return
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>
      if (seen.has(obj)) {
        return
      }
      seen.add(obj)

      const fileId = obj.file_id
      if (typeof fileId === "string") {
        ids.add(fileId)
      }

      for (const key of Object.keys(obj)) {
        if (key === "file_id") {
          continue
        }
        visit(obj[key])
      }
    }
  }

  if (result && typeof result === "object") {
    const conversation = (result as { conversation?: unknown[] }).conversation
    if (Array.isArray(conversation)) {
      for (const entry of conversation) {
        visit(entry)
      }
    }
  }

  return Array.from(ids)
}

type CandidatePickerProps = {
  candidates: CandidateProfile[]
  selectedCandidateId: string | null
  onSelect: (candidateId: string) => void
  onCreateNew: (candidate: { name: string; email?: string }) => void
  recruiterOf: (candidateId: string) => string
  onReassign: (candidateId: string, recruiter: string) => void
}

function CandidatePicker({ candidates, selectedCandidateId, onSelect, onCreateNew, recruiterOf, onReassign }: CandidatePickerProps) {
  const [query, setQuery] = useState("")
  const normalized = query.trim().toLowerCase()
  const list = normalized
    ? candidates.filter((c) =>
        [c.name, c.email, c.role].filter(Boolean).some((v) => v!.toLowerCase().includes(normalized)),
      )
    : candidates

  return (
    <div className="absolute inset-0 z-20 overflow-auto bg-white px-8 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#828ba0]">Attach to a candidate</p>
            <h2 className="text-2xl font-semibold text-[#0a0f18]">Who are we recruiting for?</h2>
            <p className="text-sm text-[#5a6171]">
              Select a candidate to preload interview notes, transcripts, and prompts. You can start a fresh profile if
              they&apos;re new to OpenHire.
            </p>
          </div>
        </header>
        <div className="mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or role…"
            className="h-10 w-full rounded-[14px] border border-[#e1e4ed] bg-white px-4 text-sm text-[#0a0f18] outline-none transition focus:border-[#b9c1d2]"
          />
        </div>
        <div className="rounded-[18px] border border-[#eceef3] bg-[#f8f9fd]">
          <PaginatedList items={list} pageSize={4} render={(candidate, idx, total) => {
            const isActive = candidate.id === selectedCandidateId
            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onSelect(candidate.id)}
                className={`flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left transition ${
                  isActive ? "bg-white" : "hover:bg-white"
                } ${idx !== total - 1 ? "border-b border-[#e7eaf2]" : ""}`}
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[#0a0f18]">{candidate.name}</h3>
                  <p className="text-xs text-[#5a6171]">{candidate.role}</p>
                  {candidate.lastInteraction && (
                    <p className="text-xs text-[#828ba0]">{candidate.lastInteraction}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-[#81889a]">{candidate.email}</div>
                  <div className="mt-1 text-[11px] text-[#7a8499]">
                    Recruiter: <span className="font-medium">{recruiterOf(candidate.id)}</span>
                    <span
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const who = window.prompt("Reassign to:", recruiterOf(candidate.id))?.trim()
                        if (who) onReassign(candidate.id, who)
                      }}
                      className="ml-2 cursor-pointer underline-offset-2 hover:underline"
                    >
                      Change
                    </span>
                  </div>
                </div>
              </button>
            )
          }} />
        </div>
        <InlineAddCandidate onCreate={onCreateNew} />
      </div>
    </div>
  )
}

type CandidateSummaryProps = {
  candidate: CandidateProfile
  onChange: () => void
}

function CandidateSummary({ candidate, onChange }: CandidateSummaryProps) {
  return (
    <section className="border-b border-[#eceff5] bg-white px-8 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-[#0a0f18]">{candidate.name}</h1>
        <button
          type="button"
          onClick={onChange}
          className="cursor-pointer text-xs font-semibold text-[#606a7d] underline-offset-2 hover:underline"
          aria-label="Switch candidate"
        >
          Switch
        </button>
      </div>
    </section>
  )
}

// Notes UI moved off the main surface; will return in an off-canvas panel

function InlineAddCandidate({ onCreate }: { onCreate: (c: { name: string; email?: string }) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")

  if (!open) {
    return (
      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-[#616b7c]">Need someone else? Start a new profile to capture their first notes.</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-[#bcc0ca] px-4 py-2 text-sm font-semibold text-[#0a0f18] transition hover:border-[#9aa1b2]"
        >
          <span className="text-lg leading-none">+</span>
          Add new candidate
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) return
        onCreate({ name: trimmed, email: email.trim() })
      }}
      className="mt-6 flex items-end justify-between gap-4 rounded-[18px] border border-[#e6e9f1] bg-white p-4"
    >
      <div className="flex w-full gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-[#6b7385]">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Chen"
            className="h-9 w-full rounded-lg border border-[#d6dbe6] px-3 text-sm text-[#0a0f18] outline-none transition focus:border-[#aeb6c8]"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-[#6b7385]">Email (optional)</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@example.com"
            className="h-9 w-full rounded-lg border border-[#d6dbe6] px-3 text-sm text-[#0a0f18] outline-none transition focus:border-[#aeb6c8]"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="cursor-pointer rounded-full border border-[#d6dbe6] bg-white px-4 py-2 text-xs font-semibold text-[#0a0f18] transition hover:border-[#bcc3d2]"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="cursor-pointer rounded-full bg-[#0a0f18] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1a2232]"
        >
          Create
        </button>
      </div>
    </form>
  )
}

type InsightSource = {
  fileId: string
  name: string | null
  vectorStoreFileId: string
  attributes: Record<string, unknown> | null
}

type LiveSpeaker = "candidate" | "recruiter" | "unknown"

type LiveLine = {
  id: string
  speaker: LiveSpeaker
  text: string
  createdAt: number
}

type TranscriptItem = {
  text: string
  speaker: LiveSpeaker
  createdAt: number
}

type AudioLevel = { level: number; updatedAt: number }

type AudioLevelMonitor = { stop: () => void }

type MissionStatus = "pending" | "progress" | "complete" | "risk"

type MissionEvidence = { text: string; at: number }

type MissionSnapshot = {
  status: MissionStatus
  evidence: MissionEvidence[]
}

type MissionState = Record<MissionId, MissionSnapshot>

const missionStatusStyles: Record<MissionStatus, { label: string; badgeClass: string }> = {
  pending: { label: "Pending", badgeClass: "border-[#d6dbe6] text-[#5a6171] bg-white" },
  progress: { label: "In review", badgeClass: "border-[#fbbf24] text-[#b45309] bg-[#fffbeb]" },
  complete: { label: "Backed", badgeClass: "border-[#34d399] text-[#047857] bg-[#ecfdf5]" },
  risk: { label: "Risk", badgeClass: "border-[#f87171] text-[#b91c1c] bg-[#fef2f2]" },
}

const nowish = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now())

function createAudioLevelMonitor(stream: MediaStream, onLevel: (level: number) => void): AudioLevelMonitor | null {
  if (typeof window === "undefined") {
    return null
  }

  const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext
  if (!AudioContextCtor) {
    return null
  }

  try {
    const context = new AudioContextCtor()
    if (context.state === "suspended") {
      context.resume().catch(() => undefined)
    }
    const source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)

    const buffer = new Float32Array(analyser.fftSize)
    let stopped = false
    let rafId: number | null = null

    const tick = () => {
      if (stopped) {
        return
      }
      analyser.getFloatTimeDomainData(buffer)
      let sumSquares = 0
      for (let i = 0; i < buffer.length; i += 1) {
        const sample = buffer[i]
        sumSquares += sample * sample
      }
      const rms = Math.sqrt(sumSquares / buffer.length)
      onLevel(rms)
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return {
      stop: () => {
        stopped = true
        if (rafId !== null) {
          cancelAnimationFrame(rafId)
        }
        try {
          source.disconnect()
        } catch {
          // ignore cleanup failures
        }
        try {
          analyser.disconnect()
        } catch {
          // ignore cleanup failures
        }
        context.close().catch(() => undefined)
      },
    }
  } catch {
    return null
  }
}

const createInitialMissionState = (): MissionState => {
  const state = {} as MissionState
  for (const mission of missionDefinitions) {
    state[mission.id] = { status: "pending", evidence: [] }
  }
  return state
}

const missionIdSet = new Set<MissionId>(missionDefinitions.map((mission) => mission.id))

function parseMissionId(value: unknown): MissionId | null {
  if (typeof value !== "string") {
    return null
  }
  if (missionIdSet.has(value as MissionId)) {
    return value as MissionId
  }
  const normalized = value.replace(/[-\s]/g, "_") as MissionId
  if (missionIdSet.has(normalized)) {
    return normalized
  }
  return null
}

const missionStatusSet: Set<MissionStatus> = new Set(["pending", "progress", "complete", "risk"])

function parseMissionStatus(value: unknown): MissionStatus | null {
  if (typeof value !== "string") {
    return null
  }
  const lower = value.toLowerCase() as MissionStatus
  if (missionStatusSet.has(lower)) {
    return lower
  }
  return null
}

function InsightsPanel({
  open,
  onClose,
  candidate,
  live,
  isRecording,
  missions,
  sources,
}: {
  open: boolean
  onClose: () => void
  candidate: CandidateProfile | null
  live: LiveLine[]
  isRecording: boolean
  missions: MissionState
  sources: InsightSource[]
}) {
  const [tab, setTab] = useState<'insights' | 'notes' | 'files' | 'live'>("insights")
  const [noteText, setNoteText] = useState('')
  const previousRecording = useRef(isRecording)
  const [showRecruiterLines, setShowRecruiterLines] = useState(false)

  useEffect(() => {
    if (isRecording) {
      setTab('live')
    } else if (previousRecording.current) {
      setTab('insights')
    }
    previousRecording.current = isRecording
  }, [isRecording])

  return (
    <aside
      className={`pointer-events-auto fixed inset-y-0 right-0 z-30 w-[380px] transform border-l border-[#e4e7f0] bg-white shadow-[0_28px_70px_-45px_rgba(10,15,24,0.45)] transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full"}`}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between border-b border-[#eef1f7] px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#0a0f18]">{candidate ? candidate.name : 'Insights'}</h3>
          <nav className="ml-2 flex gap-2">
            {(['insights','notes','files','live'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`cursor-pointer rounded px-2 py-1 text-xs ${tab===t? 'bg-[#0a0f18] text-white':'text-[#0a0f18] border border-[#e2e6f0]'}`}>{t}</button>
            ))}
          </nav>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-full border border-[#e1e4ed] px-2 py-1 text-xs text-[#4b5263] hover:bg-[#f3f4f7]"
        >
          Close
        </button>
      </div>
      <div className="h-full overflow-y-auto px-4 py-4 text-sm">
        {tab === 'insights' && (
          <>
            <section className="mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#828ba0]">Mission alignment</h4>
              <div className="mt-3 space-y-3">
                {missionDefinitions.map((mission) => {
                  const snapshot = missions[mission.id] ?? { status: "pending", evidence: [] }
                  const meta = missionStatusStyles[snapshot.status]
                  const evidence = snapshot.evidence.slice(-2)
                  return (
                    <div
                      key={mission.id}
                      className="rounded-lg border border-[#eef1f7] bg-white p-3 shadow-[0_8px_16px_-12px_rgba(15,23,42,0.1)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-[#0a0f18]">{mission.title}</div>
                          <p className="mt-1 text-xs leading-5 text-[#5a6171]">{mission.description}</p>
                        </div>
                        <span
                          className={`whitespace-nowrap rounded-full border px-2 py-[2px] text-[11px] font-semibold uppercase tracking-[0.18em] ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      {evidence.length > 0 ? (
                        <ul className="mt-3 space-y-2 text-xs text-[#0a0f18]">
                          {evidence.map((item, idx) => (
                            <li
                              key={`${mission.id}-evidence-${idx}`}
                              className="rounded-md bg-[#f7f8fb] p-2 leading-5 text-[#1f2937]"
                            >
                              “{item.text}”
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-3 rounded-md border border-dashed border-[#e6eaf3] bg-[#fbfcff] p-2 text-xs text-[#6b7280]">
                          Awaiting signal during the conversation.
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
            <section className="mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#828ba0]">Sources</h4>
              <div className="mt-2 space-y-2">
                {sources.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#dfe3ee] bg-[#fafbff] p-3 text-xs text-[#5a6171]">
                    Workflow citations linked to this candidate will show up here.
                  </div>
                ) : (
                  sources.map((source) => (
                    <div
                      key={source.vectorStoreFileId}
                      className="rounded-lg border border-[#eef1f7] bg-white p-3 text-[#0a0f18] shadow-[0_8px_16px_-12px_rgba(15,23,42,0.15)]"
                    >
                      <div className="text-sm font-semibold">{source.name ?? source.fileId}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8a93a5]">
                        Vector source · {source.fileId}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
            <section className="mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#828ba0]">Role routing</h4>
              <div className="mt-2 space-y-2">
                <div className="rounded-lg border border-[#eef1f7] p-3 text-[#3b4354]">GTM Innovator · Fit pending</div>
                <div className="rounded-lg border border-[#eef1f7] p-3 text-[#3b4354]">People Innovation · Fit pending</div>
              </div>
            </section>
          </>
        )}
        {tab === 'notes' && candidate && (
          <div>
            <div className="mb-2 flex gap-2">
              <input value={noteText} onChange={(e)=>setNoteText(e.target.value)} placeholder="Add a note…" className="h-9 flex-1 rounded-lg border border-[#e2e8f0] px-3 text-sm" />
              <button onClick={async ()=>{ const text = noteText.trim(); if(!text) return; await fetch('/api/candidates/note',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: candidate.id, text })}); setNoteText(''); alert('Note saved') }} className="rounded-lg bg-black px-3 text-sm font-semibold text-white">Save</button>
            </div>
            <p className="text-xs text-[#64748b]">Notes are shared across your team for this candidate.</p>
          </div>
        )}
        {tab === 'files' && candidate && (
          <div>
            <p className="mb-2 text-sm text-[#3b4354]">Upload PDFs or TXT to the vector store for retrieval in chat.</p>
            <VectorUploadInline candidate={candidate} />
          </div>
        )}
        {tab === 'live' && (
          <>
            <div className="mb-3 flex items-center justify-between text-xs text-[#5a6171]">
              <span>Streaming transcript</span>
              <label className="flex cursor-pointer items-center gap-1">
                <input
                  type="checkbox"
                  checked={showRecruiterLines}
                  onChange={(e) => setShowRecruiterLines(e.target.checked)}
                />
                Show my mic
              </label>
            </div>
            <div className="space-y-2">
              {live.length === 0 ? (
                <div className="text-[#64748b]">No live transcript yet.</div>
              ) : (
                live
                  .filter((line) => showRecruiterLines || line.speaker !== "recruiter")
                  .map((line) => (
                    <div key={line.id} className="rounded-md bg-[#f7f8fb] p-2 text-[#0f172a]">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a93a5]">
                        {line.speaker === "candidate" ? "Candidate" : line.speaker === "recruiter" ? "You" : "Live"}
                      </div>
                      <div>{line.text}</div>
                    </div>
                  ))
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}

function VectorUploadInline({ candidate }: { candidate: CandidateProfile }) {
  return (
    <form onSubmit={(e)=>e.preventDefault()}>
      <input
        type="file"
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0]
          if (!file) return
          const fd = new FormData()
          fd.append('file', file)
          fd.append('candidate', candidate.id)
          fd.append('email', candidate.email ?? '')
          const res = await fetch('/api/vectorstore/upload', { method: 'POST', body: fd })
          if (!res.ok) {
            const p = await res.json().catch(() => null)
            alert(`Upload failed: ${p?.error ?? res.status}`)
          } else {
            alert('File uploaded to vector store')
          }
          e.currentTarget.value = ''
        }}
      />
    </form>
  )
}

function PaginatedList<T>({ items, pageSize, render }: { items: T[]; pageSize: number; render: (item: T, idx: number, totalOnPage: number) => React.ReactElement }) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const clampedPage = Math.min(page, totalPages - 1)
  const start = clampedPage * pageSize
  const pageItems = items.slice(start, start + pageSize)

  return (
    <div>
      <div>
        {pageItems.map((item, i) => render(item, i, pageItems.length))}
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs text-[#7a8499]">Page {clampedPage + 1} of {totalPages}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="cursor-pointer rounded-full border border-[#d6dbe6] bg-white px-3 py-1 text-xs text-[#0a0f18] disabled:opacity-50"
            disabled={clampedPage === 0}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="cursor-pointer rounded-full border border-[#d6dbe6] bg-white px-3 py-1 text-xs text-[#0a0f18] disabled:opacity-50"
            disabled={clampedPage >= totalPages - 1}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}


type ChatKitElement = HTMLElement & {
  options?: ChatKitOptions
  setOptions?: (options: ChatKitOptions) => void
}

type Phase = "loading" | "ready" | "error"

type ChatKitTokenResponse = {
  client_secret?: { value?: string }
  clientSecret?: { value?: string }
  value?: string
  error?: string
}

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "openai-chatkit": DetailedHTMLProps<HTMLAttributes<ChatKitElement>, ChatKitElement>
    }
  }
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

export default function OpenHirePage() {
  const chatKitRef = useRef<ChatKitElement | null>(null)
  const [phase, setPhase] = useState<Phase>("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(true)
  const [customCandidates, setCustomCandidates] = useState<CandidateProfile[]>([])
  const [candidateThreads, setCandidateThreads] = useState<Record<string, string | null>>({})
  const [assignments, setAssignments] = useState<Record<string, { current: string; history: { value: string; at: number }[] }>>({})
  // Future: persist notes by candidate (local DB or hosted store)
  const selectedCandidateIdRef = useRef<string | null>(null)
  const [isInsightsOpen, setIsInsightsOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [liveLines, setLiveLines] = useState<LiveLine[]>([])
  const [missionState, setMissionState] = useState<MissionState>(() => createInitialMissionState())
  const [insightSources, setInsightSources] = useState<InsightSource[]>([])
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const transcriptItemsRef = useRef<Map<string, TranscriptItem>>(new Map())
  const micLevelRef = useRef<AudioLevel>({ level: 0, updatedAt: 0 })
  const systemLevelRef = useRef<AudioLevel>({ level: 0, updatedAt: 0 })
  const micMonitorRef = useRef<AudioLevelMonitor | null>(null)
  const systemMonitorRef = useRef<AudioLevelMonitor | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const systemStreamRef = useRef<MediaStream | null>(null)
  const processedTranscriptIdsRef = useRef<Set<string>>(new Set())

  const applyMissionUpdate = useCallback(
    (missionId: MissionId, updater: (snapshot: MissionSnapshot) => MissionSnapshot) => {
      setMissionState((prev) => {
        const current = prev[missionId] ?? { status: "pending", evidence: [] }
        const next = updater(current)
        if (
          next === current ||
          (next.status === current.status &&
            next.evidence.length === current.evidence.length &&
            next.evidence.every((entry, idx) => entry.text === current.evidence[idx]?.text))
        ) {
          return prev
        }
        return { ...prev, [missionId]: next }
      })
    },
    [],
  )

  const determineSpeaker = useCallback((): LiveSpeaker => {
    const now = nowish()
    const micLevel = now - micLevelRef.current.updatedAt < 350 ? micLevelRef.current.level : 0
    const systemLevel =
      now - systemLevelRef.current.updatedAt < 350 ? systemLevelRef.current.level : 0
    const MIN_LEVEL = 0.015
    const DOMINANCE_RATIO = 1.4

    if (systemLevel > MIN_LEVEL && systemLevel > micLevel * DOMINANCE_RATIO) {
      return "candidate"
    }
    if (micLevel > MIN_LEVEL && micLevel > systemLevel * DOMINANCE_RATIO) {
      return "recruiter"
    }
    if (systemLevel > MIN_LEVEL * 0.75) {
      return "candidate"
    }
    if (micLevel > MIN_LEVEL * 0.75) {
      return "recruiter"
    }
    return "unknown"
  }, [])

  const updateLiveLinesFromRefs = useCallback(() => {
    const lines = Array.from(transcriptItemsRef.current.entries())
      .map(([id, item]) => ({
        id,
        text: item.text.trim(),
        speaker: item.speaker,
        createdAt: item.createdAt,
      }))
      .filter((item) => item.text.length > 0)
      .sort((a, b) => a.createdAt - b.createdAt)
    setLiveLines(lines)
  }, [])

  const allCandidates = useMemo(() => [...customCandidates, ...candidates], [customCandidates])
  const selectedCandidate = useMemo(
    () => allCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [allCandidates, selectedCandidateId],
  )

  useEffect(() => {
    setInsightSources([])
  }, [selectedCandidate?.id])

  useEffect(() => {
    selectedCandidateIdRef.current = selectedCandidateId
  }, [selectedCandidateId])

  useEffect(() => {
    processedTranscriptIdsRef.current = new Set()
    setMissionState(createInitialMissionState())
  }, [selectedCandidate?.id])

  useEffect(() => {
    if (liveLines.length === 0) {
      return
    }
    const processed = processedTranscriptIdsRef.current
    const newLines = liveLines.filter((line) => {
      if (!line.id || processed.has(line.id)) {
        return false
      }
      return line.text.trim().length > 0
    })
    if (newLines.length === 0) {
      return
    }
    newLines.forEach((line) => processed.add(line.id))
    const candidateLines = newLines.filter((line) => line.speaker === "candidate")
    if (candidateLines.length === 0) {
      return
    }

    for (const line of candidateLines) {
      const lower = line.text.toLowerCase()
      for (const mission of missionDefinitions) {
        const positiveMatch = mission.positivePhrases.some((phrase) =>
          lower.includes(phrase.toLowerCase()),
        )
        const riskMatch =
          mission.riskPhrases?.some((phrase) => lower.includes(phrase.toLowerCase())) ?? false

        if (!positiveMatch && !riskMatch) {
          continue
        }

        const snippet =
          line.text.length > 180 ? `${line.text.slice(0, 177).trimEnd()}…` : line.text.trim()

        applyMissionUpdate(mission.id, (snapshot) => {
          const hasSnippet = snapshot.evidence.some((item) => item.text === snippet)
          const nextEvidence = hasSnippet
            ? snapshot.evidence
            : (() => {
                const appended = [...snapshot.evidence, { text: snippet, at: nowish() }]
                if (appended.length > 5) {
                  return appended.slice(appended.length - 5)
                }
                return appended
              })()

          let nextStatus: MissionStatus = snapshot.status
          if (riskMatch) {
            nextStatus = "risk"
          } else if (positiveMatch && snapshot.status !== "risk") {
            const effectiveCount = hasSnippet ? snapshot.evidence.length : nextEvidence.length
            nextStatus = effectiveCount >= 2 ? "complete" : "progress"
          }

          if (nextStatus === snapshot.status && nextEvidence === snapshot.evidence) {
            return snapshot
          }

          return { status: nextStatus, evidence: nextEvidence }
        })
      }
    }
  }, [applyMissionUpdate, liveLines])

  const chatKitOptions = useMemo<ChatKitOptions | null>(() => {
    if (!selectedCandidate) {
      return null
    }
    if (!assignments[selectedCandidate.id]) {
      setAssignments((prev) => ({ ...prev, [selectedCandidate.id]: { current: "Alex R.", history: [{ value: "Alex R.", at: Date.now() }] } }))
    }

    return {
      api: {
        async getClientSecret(existing?: unknown) {
          // If ChatKit asks to refresh, let it reuse the current secret for now
          if (typeof existing === 'string' && existing.length > 0) {
            return existing
          }
          try {
            const response = await fetch("/api/chatkit/token", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                candidate: {
                  id: selectedCandidate.id,
                  name: selectedCandidate.name,
                  role: selectedCandidate.role,
                  email: selectedCandidate.email,
                  recruiter: assignments[selectedCandidate.id]?.current ?? 'Alex R.',
                },
              }),
            })
            const payload = await (async (): Promise<ChatKitTokenResponse | null> => {
              try {
                return (await response.json()) as ChatKitTokenResponse
              } catch {
                return null
              }
            })()

            if (!response.ok) {
              const message =
                payload?.error ?? `Failed to fetch ChatKit client secret (status ${response.status}).`
              throw new Error(typeof message === "string" ? message : "Failed to fetch ChatKit client secret.")
            }

            const secret =
              payload?.client_secret?.value ?? payload?.clientSecret?.value ?? payload?.value ?? null

            if (typeof secret !== "string" || secret.length === 0) {
              throw new Error("ChatKit token response did not include a client secret.")
            }

            return secret
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unexpected error while retrieving ChatKit client secret."
            setErrorMessage(message)
            setPhase("error")
            throw error instanceof Error ? error : new Error(message)
          }
        },
      },
      onClientTool: async ({ name, params }) => {
        if (name === "openhire.record") {
          if (isRecording) {
            await stopRealtime()
            setIsRecording(false)
            return {}
          }
          try {
            await startRealtime()
            setIsRecording(true)
            setIsInsightsOpen(true)
          } catch (e) {
            console.error(e)
            alert('Failed to start recording')
          }
          return {}
        }
        if (name === "openhire.mission_update") {
          const missionIdInput =
            (params?.mission_id as unknown) ??
            (params?.missionId as unknown) ??
            (params?.id as unknown) ??
            null
          const missionId = parseMissionId(missionIdInput)
          if (!missionId) {
            console.warn("Received mission update with unknown mission id", missionIdInput)
            return { status: "ignored", reason: "unknown_mission" }
          }
          const statusInput =
            (params?.status as unknown) ??
            (params?.state as unknown) ??
            (params?.label as unknown) ??
            null
          const status = parseMissionStatus(statusInput)
          const evidenceInput = params?.evidence ?? params?.snippet ?? params?.text

          applyMissionUpdate(missionId, (snapshot) => {
            const nextStatus = status ?? snapshot.status

            let updatedEvidence = snapshot.evidence
            if (typeof evidenceInput === "string" && evidenceInput.trim().length > 0) {
              const snippet =
                evidenceInput.length > 200
                  ? `${evidenceInput.slice(0, 197).trimEnd()}…`
                  : evidenceInput.trim()
              if (!snapshot.evidence.some((item) => item.text === snippet)) {
                updatedEvidence = [...snapshot.evidence, { text: snippet, at: nowish() }]
                if (updatedEvidence.length > 5) {
                  updatedEvidence = updatedEvidence.slice(updatedEvidence.length - 5)
                }
              }
            } else if (
              Array.isArray(evidenceInput) &&
              evidenceInput.some((item) => typeof item === "string" && item.trim().length > 0)
            ) {
              const prepared = (evidenceInput as unknown[])
                .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
                .map((text) =>
                  text.length > 200 ? `${text.slice(0, 197).trimEnd()}…` : text.trim(),
                )
                .map((text) => ({ text, at: nowish() }))
              if (prepared.length > 0) {
                updatedEvidence = [...snapshot.evidence, ...prepared]
                if (updatedEvidence.length > 5) {
                  updatedEvidence = updatedEvidence.slice(updatedEvidence.length - 5)
                }
              }
            }

            const changed =
              nextStatus !== snapshot.status || updatedEvidence !== snapshot.evidence
            return changed ? { status: nextStatus, evidence: updatedEvidence } : snapshot
          })

          return { status: "ok" }
        }
        return {}
      },
      initialThread: candidateThreads[selectedCandidate.id] ?? null,
      header: {
        enabled: true,
        title: { enabled: true, text: selectedCandidate.name },
      },
      startScreen: {
        prompts: [
          {
            icon: "suitcase",
            label: "Role routing",
            prompt: "Compare this candidate against the GTM Innovator and People Innovation tracks.",
          },
          {
            icon: "notebook-pencil",
            label: "Prep handoff",
            prompt: "Draft a note for the next interviewer highlighting strengths, risks, and follow-ups.",
          },
        ],
      },
      theme: {
        colorScheme: "light",
        color: {
          accent: {
            primary: "#2D5BFF",
            level: 2,
          },
        },
        typography: {
          fontFamily: "'Inter', sans-serif",
        },
        radius: "soft",
        density: "normal",
      },
      history: { enabled: true },
      widgets: {
        async onAction(action) {
          if (action?.type !== "openhire.run_workflow") {
            return
          }

          const payload =
            typeof action.payload === "object" && action.payload
              ? (action.payload as Record<string, unknown>)
              : undefined

          const message = typeof payload?.message === "string" ? payload.message : null
          if (!message) {
            return
          }

          const response = await fetch("/api/chatkit/workflow", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message, candidate_id: selectedCandidate?.id, vector_store_id: process.env.NEXT_PUBLIC_VECTOR_STORE_ID }),
          })

          const workflowPayload = await (async () => {
            try {
              return (await response.json()) as { error?: string; result?: unknown }
            } catch {
              return null
            }
          })()

          if (!response.ok) {
            throw new Error(workflowPayload?.error ?? "Workflow execution failed.")
          }

          const result = workflowPayload?.result

          if (result && typeof result === 'object') {
            const missionUpdates = Array.isArray((result as { missionUpdates?: unknown }).missionUpdates)
              ? ((result as { missionUpdates?: unknown }).missionUpdates as Array<{
                  mission_id?: unknown
                  status?: unknown
                  evidence?: unknown
                }> )
              : []

            for (const update of missionUpdates) {
              const missionId = parseMissionId(update.mission_id)
              if (!missionId) {
                continue
              }
              const status = parseMissionStatus(update.status)
              const evidenceInput = update.evidence

              applyMissionUpdate(missionId, (snapshot) => {
                const nextStatus = status ?? snapshot.status

                let updatedEvidence = snapshot.evidence
                const appendEvidence = (text: string) => {
                  const trimmed = text.length > 200 ? `${text.slice(0, 197).trimEnd()}…` : text.trim()
                  if (trimmed.length === 0 || snapshot.evidence.some((item) => item.text === trimmed)) {
                    return
                  }
                  updatedEvidence = [...updatedEvidence, { text: trimmed, at: nowish() }]
                  if (updatedEvidence.length > 5) {
                    updatedEvidence = updatedEvidence.slice(updatedEvidence.length - 5)
                  }
                }

                if (typeof evidenceInput === 'string') {
                  appendEvidence(evidenceInput)
                } else if (Array.isArray(evidenceInput)) {
                  for (const entry of evidenceInput) {
                    if (typeof entry === 'string') {
                      appendEvidence(entry)
                    }
                  }
                }

                const changed = nextStatus !== snapshot.status || updatedEvidence !== snapshot.evidence
                return changed ? { status: nextStatus, evidence: updatedEvidence } : snapshot
              })
            }
          }

          const fileIds = extractWorkflowFileIds(result)
          if (!selectedCandidate?.id || fileIds.length === 0) {
            setInsightSources([])
            return
          }

          try {
            const sourcesResponse = await fetch("/api/vectorstore/sources", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ file_ids: fileIds, candidate_id: selectedCandidate.id }),
            })
            const sourcesPayload = await (async () => {
              try {
                return (await sourcesResponse.json()) as { sources?: InsightSource[]; error?: unknown }
              } catch {
                return null
              }
            })()

            if (!sourcesResponse.ok) {
              console.error("Failed to load vector store sources", sourcesPayload?.error)
              setInsightSources([])
              return
            }

            const nextSources = Array.isArray(sourcesPayload?.sources)
              ? (sourcesPayload.sources as InsightSource[])
              : []
            setInsightSources(nextSources)
          } catch (error) {
            console.error("Vector store sources lookup failed", error)
            setInsightSources([])
          }
        },
      },
      composer: {
        placeholder: `Ask about ${selectedCandidate.name}…`,
        attachments: {
          enabled: true,
          accept: {
            "application/pdf": [".pdf"],
            "text/plain": [".txt"],
          },
          maxCount: 3,
          maxSize: 20 * 1024 * 1024,
        },
        tools: [
          { id: 'openhire.record', label: isRecording ? 'Stop' : 'Record', shortLabel: isRecording ? 'Stop' : 'Record', icon: 'bolt', pinned: true },
        ],
      },
    }
  }, [applyMissionUpdate, candidateThreads, selectedCandidate, setErrorMessage, setPhase, isRecording])

  useEffect(() => {
    if (phase !== "loading") return

    let cancelled = false

    ensureChatKitScript()
      .then(() => {
        if (!cancelled) {
          setErrorMessage(null)
          setPhase("ready")
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load ChatKit."
          setErrorMessage(message)
          setPhase("error")
        }
      })

    return () => {
      cancelled = true
    }
  }, [phase])

  useEffect(() => {
    if (phase !== "ready" || !chatKitOptions) return

    const element = chatKitRef.current
    if (!element) return

    const applyOptions = () => {
      try {
        if (typeof element.setOptions === "function") {
          element.setOptions(chatKitOptions)
        } else {
          element.options = chatKitOptions
        }
        setErrorMessage(null)
        setPhase("ready")
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to configure ChatKit options."
        setErrorMessage(message)
        setPhase("error")
      }
    }

    applyOptions()

    const handleError = (event: Event) => {
      const detail = (event as CustomEvent<{ error?: Error }>).detail
      const message = detail?.error?.message ?? "ChatKit reported an error."
      setErrorMessage(message)
      setPhase("error")
    }

    const handleThreadChange = (event: Event) => {
      const threadId = (event as CustomEvent<{ threadId: string | null }>).detail.threadId
      const candidateId = selectedCandidateIdRef.current
      if (!candidateId) return
      setCandidateThreads((prev) => {
        if (prev[candidateId] === threadId) {
          return prev
        }
        return { ...prev, [candidateId]: threadId }
      })
    }

    element.addEventListener("chatkit.error", handleError)
    element.addEventListener("chatkit.thread.change", handleThreadChange)

    return () => {
      element.removeEventListener("chatkit.error", handleError)
      element.removeEventListener("chatkit.thread.change", handleThreadChange)
    }
  }, [chatKitOptions, phase])

  const retry = () => {
    setErrorMessage(null)
    setPhase("loading")
  }

  const isChatVisible = phase === "ready" && Boolean(chatKitOptions)

  async function startRealtime() {
    transcriptItemsRef.current = new Map()
    micLevelRef.current = { level: 0, updatedAt: 0 }
    systemLevelRef.current = { level: 0, updatedAt: 0 }
    micMonitorRef.current?.stop()
    systemMonitorRef.current?.stop()
    micMonitorRef.current = null
    systemMonitorRef.current = null
    micStreamRef.current = null
    systemStreamRef.current = null
    processedTranscriptIdsRef.current = new Set()
    setMissionState(createInitialMissionState())
    setLiveLines([])
    const pc = new RTCPeerConnection()
    pcRef.current = pc
    // Create data channel for events
    const dc = pc.createDataChannel('oai-events')
    dcRef.current = dc
    dc.onmessage = (e) => {
      try {
        const msg = typeof e.data === 'string' ? JSON.parse(e.data) : null
        if (!msg || typeof msg.type !== 'string') {
          return
        }

        if (msg.type.startsWith('conversation.item.input_audio_transcription.')) {
          const itemId =
            typeof msg.item_id === 'string'
              ? msg.item_id
              : `transcript-${msg.event_id ?? nowish()}`
          const existing = transcriptItemsRef.current.get(itemId)
          const speaker =
            existing && existing.speaker !== "unknown" ? existing.speaker : determineSpeaker()
          const baseItem: TranscriptItem =
            existing ??
            ({
              text: "",
              speaker,
              createdAt: nowish(),
            } as TranscriptItem)

          if (typeof msg.delta === 'string') {
            const nextItem: TranscriptItem = {
              ...baseItem,
              speaker,
              text: `${baseItem.text}${msg.delta}`,
            }
            transcriptItemsRef.current.set(itemId, nextItem)
          } else if (typeof msg.transcript === 'string') {
            const nextItem: TranscriptItem = {
              ...baseItem,
              speaker,
              text: msg.transcript,
            }
            transcriptItemsRef.current.set(itemId, nextItem)
          } else if (typeof msg.text === 'string') {
            const nextItem: TranscriptItem = {
              ...baseItem,
              speaker,
              text: msg.text,
            }
            transcriptItemsRef.current.set(itemId, nextItem)
          } else {
            return
          }
          updateLiveLinesFromRefs()
          return
        }
      } catch {
        // non-JSON event; ignore
      }
    }

    // Add microphone audio
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
    })
    const [micTrack] = mic.getTracks()
    if (micTrack) {
      pc.addTrack(micTrack, mic)
      micStreamRef.current = mic
      micMonitorRef.current = createAudioLevelMonitor(mic, (level) => {
        micLevelRef.current = { level, updatedAt: nowish() }
      })
    }

    // Try capturing system/tab audio (Chrome only). Optional.
    try {
      const getDisplayMedia = (navigator.mediaDevices as unknown as { getDisplayMedia?: (opts: MediaStreamConstraints) => Promise<MediaStream> }).getDisplayMedia?.bind(navigator.mediaDevices as unknown as { getDisplayMedia: (opts: MediaStreamConstraints) => Promise<MediaStream> })
      const sys: MediaStream | undefined = getDisplayMedia ? await getDisplayMedia({ audio: true, video: false }) : undefined
      if (sys) {
        const [sysTrack] = sys.getTracks()
        if (sysTrack) {
          pc.addTrack(sysTrack as MediaStreamTrack, sys as MediaStream)
          systemStreamRef.current = sys
          systemMonitorRef.current = createAudioLevelMonitor(sys, (level) => {
            systemLevelRef.current = { level, updatedAt: nowish() }
          })
        }
      }
    } catch {
      // ignore if not available or user cancels
    }

    // Start negotiation
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    const sdpRes = await fetch('/api/realtime/webrtc', { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: offer.sdp ?? '' })
    if (!sdpRes.ok) {
      throw new Error('Realtime handshake failed')
    }
    const answer = { type: 'answer' as const, sdp: await sdpRes.text() }
    await pc.setRemoteDescription(answer)
  }

  async function stopRealtime() {
    try {
      dcRef.current?.close()
    } catch {
      // ignore
    }
    try {
      pcRef.current?.getSenders().forEach((s) => s.track && s.track.stop())
      pcRef.current?.close()
    } catch {
      // ignore
    }
    dcRef.current = null
    pcRef.current = null
    micMonitorRef.current?.stop()
    systemMonitorRef.current?.stop()
    micMonitorRef.current = null
    systemMonitorRef.current = null
    micStreamRef.current?.getTracks().forEach((track) => {
      try {
        track.stop()
      } catch {
        // ignore
      }
    })
    systemStreamRef.current?.getTracks().forEach((track) => {
      try {
        track.stop()
      } catch {
        // ignore
      }
    })
    micStreamRef.current = null
    systemStreamRef.current = null
  }

  return (
    <div className="flex h-screen flex-col bg-[#f5f6f8] text-[#0a0f18]">
      <header className="flex items-center justify-between border-b border-[#eceff5] bg-white px-8 py-5">
        <Link href="/" className="cursor-pointer text-sm font-semibold text-[#0a0f18] transition hover:text-[#1f2a3b]">
          OpenHouse
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              if (isRecording) { await stopRealtime(); setIsRecording(false); return }
              try { await startRealtime(); setIsRecording(true); setIsInsightsOpen(true) } catch (e) { console.error(e); alert('Mic permission or realtime start failed') }
            }}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition ${isRecording ? 'border-[#ef4444] text-[#ef4444]' : 'border-[#d6dbe6] text-[#0a0f18] hover:border-[#bcc3d2]'}`}
          >
            {isRecording ? 'Stop' : 'Record'}
          </button>
          <button
            type="button"
            onClick={() => setIsInsightsOpen((v) => !v)}
            className="cursor-pointer rounded-full border border-[#d6dbe6] bg-white px-3 py-1 text-xs font-semibold text-[#0a0f18] transition hover:border-[#bcc3d2]"
          >
            {isInsightsOpen ? "Hide Insights" : "Show Insights"}
          </button>
          {/* Panel menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((v) => !v)}
              className="cursor-pointer rounded-full border border-[#d6dbe6] bg-white p-1 text-xs font-semibold text-[#0a0f18] transition hover:border-[#bcc3d2]"
              aria-label="Open panel menu"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 z-30 mt-2 w-48 rounded-lg border border-[#e5e7eb] bg-white p-1 shadow">
                <button
                  className="w-full cursor-pointer rounded px-2 py-1 text-left text-sm hover:bg-[#f5f6f8]"
                  onClick={() => {
                    setIsInsightsOpen(true)
                    setIsMenuOpen(false)
                  }}
                >
                  Insights panel
                </button>
                <button
                  className="w-full cursor-pointer rounded px-2 py-1 text-left text-sm hover:bg-[#f5f6f8]"
                  onClick={() => {
                    if (selectedCandidate) window.location.href = `/openhire/candidate/${selectedCandidate.id}`
                  }}
                >
                  View profile
                </button>
                <button
                  className="w-full cursor-pointer rounded px-2 py-1 text-left text-sm hover:bg-[#f5f6f8]"
                  onClick={() => {
                    setIsPickerOpen(true)
                    setIsMenuOpen(false)
                  }}
                >
                  Switch candidate
                </button>
                <button
                  className="w-full cursor-pointer rounded px-2 py-1 text-left text-sm hover:bg-[#f5f6f8]"
                  onClick={async () => {
                    setIsMenuOpen(false)
                    if (isRecording) {
                      await stopRealtime(); setIsRecording(false); return
                    }
                    try { await startRealtime(); setIsRecording(true); setIsInsightsOpen(true) } catch (e) { console.error(e); alert('Failed to start recording') }
                  }}
                >
                  {isRecording ? 'Stop recording' : 'Start recording'}
                </button>
                <button
                  className="w-full cursor-pointer rounded px-2 py-1 text-left text-sm hover:bg-[#f5f6f8]"
                  onClick={() => {
                    fileInputRef.current?.click()
                    setIsMenuOpen(false)
                  }}
                >
                  Upload file to vector store
                </button>
              </div>
            )}
          </div>
          <div className="text-xs uppercase tracking-[0.32em] text-[#9aa1b2]">OpenHire Beta</div>
        </div>
      </header>

      {selectedCandidate && (
        <CandidateSummary
          candidate={selectedCandidate}
          onChange={() => setIsPickerOpen(true)}
        />
      )}

      <div className="relative flex-1 bg-[#f7f8fb]">
        {(isPickerOpen || !selectedCandidate) && (
          <CandidatePicker
            candidates={allCandidates}
            selectedCandidateId={selectedCandidateId}
            onSelect={(candidateId) => {
              setSelectedCandidateId(candidateId)
              setIsPickerOpen(false)
              setErrorMessage(null)
              setPhase("loading")
            }}
            onCreateNew={({ name, email }) => {
              fetch('/api/candidates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email }),
              })
                .then((r) => r.json())
                .then((payload) => {
                  const id = payload?.id as string
                  if (id) {
                    const created: CandidateProfile = { id, name, role: 'Unassigned', email: email ?? '' }
                    setCustomCandidates((prev) => [{ ...created }, ...prev])
                    setSelectedCandidateId(id)
                    setIsPickerOpen(false)
                    setPhase('loading')
                  }
                })
            }}
            recruiterOf={(id) => assignments[id]?.current ?? 'Alex R.'}
            onReassign={(id, who) => {
              fetch('/api/candidates/reassign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, recruiter: who }),
              }).then(() =>
                setAssignments((prev) => {
                  const existing = prev[id]
                  const history = existing ? [...existing.history, { value: who, at: Date.now() }] : [{ value: who, at: Date.now() }]
                  return { ...prev, [id]: { current: who, history } }
                }),
              )
            }}
          />
        )}

        {phase === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-white/85 text-[#5f687a] backdrop-blur">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Loading ChatKit…</span>
          </div>
        )}

        {phase === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white/90 px-6 text-center">
            <AlertCircle className="h-7 w-7 text-[#c24634]" />
            <div className="max-w-md text-sm leading-6 text-[#5a6171]">
              {errorMessage ??
                "We couldn’t start the ChatKit session. Confirm your OpenAI credentials and workflow ID, then try again."}
            </div>
            <button
              type="button"
              onClick={retry}
              className="rounded-full border border-[#d2d6df] bg-white px-5 py-2 text-sm font-medium text-[#0a0f18] transition hover:border-[#bcc0ca]"
            >
              Retry
            </button>
          </div>
        )}

        <openai-chatkit
          ref={chatKitRef}
          className={isChatVisible ? "block" : "hidden"}
          style={{ display: isChatVisible ? "block" : "none", height: "100%", width: "100%" }}
          data-domain-key={process.env.NEXT_PUBLIC_CHATKIT_DOMAIN_KEY}
        ></openai-chatkit>

        {/* hidden upload input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={async (e) => {
            const file = e.currentTarget.files?.[0]
            const cand = selectedCandidate
            if (!file || !cand) return
            const fd = new FormData()
            fd.append('file', file)
            fd.append('candidate', cand.id)
            fd.append('email', cand.email ?? '')
            const res = await fetch('/api/vectorstore/upload', { method: 'POST', body: fd })
            if (!res.ok) {
              const p = await res.json().catch(() => null)
              alert(`Upload failed: ${p?.error ?? res.status}`)
            } else {
              alert('File uploaded to vector store')
            }
            e.currentTarget.value = ''
          }}
        />

        

        <InsightsPanel
          open={isInsightsOpen}
          onClose={() => setIsInsightsOpen(false)}
          candidate={selectedCandidate}
          live={liveLines}
          missions={missionState}
          isRecording={isRecording}
          sources={insightSources}
        />
      </div>
    </div>
  )
}

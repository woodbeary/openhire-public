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
import type { ChatKitOptions, Widgets } from "@openai/chatkit"
import type { LucideIcon } from "lucide-react"
import {
  AlertCircle,
  Loader2,
  ArrowLeftRight,
  ChevronDown,
  CheckCircle2,
  CircleDot,
  Dot,
  XCircle,
  Check,
  Pencil,
  Trash2,
  X,
} from "lucide-react"

import { candidates, type CandidateProfile } from "@/lib/candidates"
import { missionDefinitions, type MissionId } from "@/lib/missions"
import type { CandidateTimelineEntry } from "@/lib/serverStore"
import type { WorkflowMissionUpdate } from "@/lib/agentkit/types"

const CHATKIT_SCRIPT_URL =
  process.env.NEXT_PUBLIC_CHATKIT_SCRIPT_URL ??
  "https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"

const MISSION_WIDGET_ID = "openhire.mission_checklist"

type WorkspaceView = "insights" | "notes" | "files"

const WORKSPACE_VIEWS: { id: WorkspaceView; label: string }[] = [
  { id: "insights", label: "Insights" },
  { id: "notes", label: "Notes" },
  { id: "files", label: "Files" },
]

type BannerState = { id: number; tone: "success" | "error" | "info"; text: string }

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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
    <div className="absolute inset-0 z-40 overflow-auto bg-white px-8 py-10">
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

const BANNER_STYLES: Record<BannerState["tone"], { bg: string; border: string; text: string }> = {
  success: {
    bg: "bg-[#ecfdf5]",
    border: "border-[#bbf7d0]",
    text: "text-[#166534]",
  },
  error: {
    bg: "bg-[#fef2f2]",
    border: "border-[#fecaca]",
    text: "text-[#b91c1c]",
  },
  info: {
    bg: "bg-[#eff6ff]",
    border: "border-[#bfdbfe]",
    text: "text-[#1d4ed8]",
  },
}

function InlineBanner({ banner, onDismiss }: { banner: BannerState; onDismiss: () => void }) {
  const styles = BANNER_STYLES[banner.tone]
  return (
    <div
      className={`mx-8 mt-3 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${styles.bg} ${styles.border} ${styles.text}`}
      role="status"
      aria-live="polite"
    >
      <span className="leading-6">{banner.text}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-current/20 bg-white/40 text-xs text-current transition hover:bg-white"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
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

const missionStatusMeta: Record<
  MissionStatus,
  { label: string; icon: LucideIcon; iconClass: string; ringClass: string; textClass: string; badgeClass: string }
> = {
  pending: {
    label: "Pending",
    icon: Dot,
    iconClass: "text-[#cbd5f5]",
    ringClass: "",
    textClass: "text-[#6b7280]",
    badgeClass: "border border-[#d6dbe6] bg-white text-[#6b7280]",
  },
  progress: {
    label: "In review",
    icon: CircleDot,
    iconClass: "text-[#2563eb]",
    ringClass: "ring-1 ring-[#bfdbfe]/60",
    textClass: "text-[#1d4ed8]",
    badgeClass: "border border-[#bfdbfe] bg-[#e0f2fe] text-[#1d4ed8]",
  },
  complete: {
    label: "Backed",
    icon: CheckCircle2,
    iconClass: "text-[#047857]",
    ringClass: "ring-1 ring-[#34d399]/60",
    textClass: "text-[#047857]",
    badgeClass: "border border-[#bbf7d0] bg-[#ecfdf5] text-[#047857]",
  },
  risk: {
    label: "Risk",
    icon: XCircle,
    iconClass: "text-[#b91c1c]",
    ringClass: "ring-1 ring-[#f87171]/70",
    textClass: "text-[#b91c1c]",
    badgeClass: "border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
  },
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

function WorkspacePanel({
  view,
  candidate,
  live,
  isRecording,
  missions,
  sources,
  timeline,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onToggleRecording,
  onFileLogged,
}: {
  view: WorkspaceView
  candidate: CandidateProfile | null
  live: LiveLine[]
  isRecording: boolean
  missions: MissionState
  sources: InsightSource[]
  timeline: CandidateTimelineEntry[]
  onAddNote: (note: string) => Promise<{ ok: boolean; error?: string }>
  onUpdateNote: (noteId: string, text: string) => Promise<{ ok: boolean; error?: string }>
  onDeleteNote: (noteId: string) => Promise<{ ok: boolean; error?: string }>
  onToggleRecording: () => void | Promise<void>
  onFileLogged: (entry: CandidateTimelineEntry) => void
}) {
  const [noteText, setNoteText] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [noteMessage, setNoteMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [showRecruiterLines, setShowRecruiterLines] = useState(false)
  const [showTranscript, setShowTranscript] = useState(true)
  const [expandedMission, setExpandedMission] = useState<MissionId | null>(null)

  useEffect(() => {
    if (isRecording) {
      setShowTranscript(true)
    }
  }, [isRecording])

  useEffect(() => {
    setExpandedMission(null)
  }, [candidate?.id])

  const handleSaveNote = useCallback(async () => {
    if (!candidate) return
    const trimmed = noteText.trim()
    if (!trimmed) return
    setSavingNote(true)
    const result = await onAddNote(trimmed)
    setSavingNote(false)
    if (result.ok) {
      setNoteText("")
      setNoteMessage({ tone: "success", text: "Note saved to the shared timeline." })
    } else if (result.error) {
      setNoteMessage({ tone: "error", text: result.error })
    }
  }, [candidate, noteText, onAddNote])

  const handleEditNote = useCallback(
    async (noteId: string, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) {
        setNoteMessage({ tone: "error", text: "Note text cannot be empty." })
        return { ok: false, error: "Note text cannot be empty." }
      }
      const result = await onUpdateNote(noteId, trimmed)
      if (result.ok) {
        setNoteMessage({ tone: "success", text: "Note updated." })
      } else if (result.error) {
        setNoteMessage({ tone: "error", text: result.error })
      }
      return result
    },
    [onUpdateNote],
  )

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      const result = await onDeleteNote(noteId)
      if (result.ok) {
        setNoteMessage({ tone: "success", text: "Note deleted." })
      } else if (result.error) {
        setNoteMessage({ tone: "error", text: result.error })
      }
      return result
    },
    [onDeleteNote],
  )

  useEffect(() => {
    if (!noteMessage) return
    const timeout = window.setTimeout(() => setNoteMessage(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [noteMessage])

  const insightMissions = useMemo(
    () =>
      missionDefinitions.map((mission) => {
        const snapshot = missions[mission.id] ?? { status: "pending", evidence: [] }
        const meta = missionStatusMeta[snapshot.status]
        const latestEvidence =
          snapshot.evidence.length > 0
            ? snapshot.evidence[snapshot.evidence.length - 1]?.text ?? null
            : null
        return { mission, meta, snapshot, latestEvidence }
      }),
    [missions],
  )
  if (!candidate) {
    return (
      <section className="flex h-full w-full flex-col bg-white">
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm leading-6 text-[#677086]">
          Choose a candidate from the picker to unlock insights, notes, and shared files in the workspace.
        </div>
      </section>
    )
  }

  return (
    <section className="flex h-full w-full flex-col bg-white">
      <div className="flex-1 overflow-y-auto px-6 pb-10 pt-5 text-sm">
        {view === "insights" && (
          <div className="space-y-6">
            <section>
              <div className="rounded-2xl border border-[#e4e7f0] bg-white/95 p-5 shadow-sm">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#828ba0]">
                    Candidate overview
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#5a6171]">
                    {candidate.role ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#e2e6f0] bg-white px-3 py-1 font-medium text-[#1f2332]">
                        <span className="h-2 w-2 rounded-full bg-[#2d5bff]" aria-hidden />
                        {candidate.role}
                      </span>
                    ) : null}
                    {candidate.email ? (
                      <span className="truncate rounded-full border border-[#e2e6f0] bg-white px-3 py-1 font-medium text-[#1f2332]/80">
                        {candidate.email}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#828ba0]">Sources</div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {sources.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#dfe3ee] bg-[#fafbff] p-4 text-xs text-[#5a6171]">
                        Workflow citations linked to this candidate will show up here.
                      </div>
                    ) : (
                      sources.map((source) => (
                        <article
                          key={source.vectorStoreFileId}
                          className="rounded-2xl border border-[#e4e7f0] bg-white/95 p-4 text-[#0a0f18] shadow-sm"
                        >
                          <div className="text-sm font-semibold">{source.name ?? source.fileId}</div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#8a93a5]">
                            Vector file · {source.vectorStoreFileId.slice(0, 8)}…
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#828ba0]">Live transcript</h4>
                <button
                  type="button"
                  onClick={() => setShowTranscript((value) => !value)}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[#d6dbe6] bg-white text-[#0a0f18] transition hover:border-[#bcc3d2] hover:bg-[#f5f6f8]"
                  aria-label={showTranscript ? "Collapse transcript" : "Expand transcript"}
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showTranscript ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
              <label className="mt-2 inline-flex w-fit cursor-pointer items-center gap-2 text-xs text-[#4b5263]">
                <input
                  type="checkbox"
                  checked={showRecruiterLines}
                  onChange={(e) => setShowRecruiterLines(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border border-[#d6dbe6]"
                />
                Show recruiter lines
              </label>
              {showTranscript ? (
                <div className="mt-3 space-y-2 rounded-2xl border border-[#e5e9f2] bg-white px-4 py-4">
                  {!isRecording ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#dfe3ee] bg-[#fafbff] p-4 text-sm text-[#5a6171]">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void onToggleRecording()
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#d0d6e4] bg-white px-3 py-1.5 text-xs font-semibold text-[#0a0f18] transition hover:border-[#bcc3d2]"
                        >
                          Record
                        </button>
                        <span>to stream the transcript and mission progress in real time.</span>
                      </div>
                    </div>
                  ) : live.length === 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#dfe3ee] bg-[#fafbff] p-4 text-sm text-[#5a6171]">
                      <span>Waiting for the first lines to come in…</span>
                      <button
                        type="button"
                        onClick={() => {
                          void onToggleRecording()
                        }}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#ef4444] bg-[#fee2e2] px-3 py-1.5 text-xs font-semibold text-[#b91c1c] transition hover:border-[#dc2626]"
                      >
                        Stop recording
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            void onToggleRecording()
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#ef4444] bg-[#fee2e2] px-3 py-1.5 text-xs font-semibold text-[#b91c1c] transition hover:border-[#dc2626]"
                        >
                          Stop recording
                        </button>
                      </div>
                      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                        {live
                          .filter((line) => showRecruiterLines || line.speaker !== "recruiter")
                          .map((line) => (
                            <div key={line.id} className="rounded-xl bg-[#f7f8fb] p-3 text-[#0f172a]">
                              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a93a5]">
                                <span>
                                  {line.speaker === "candidate"
                                    ? "Candidate"
                                    : line.speaker === "recruiter"
                                      ? "You"
                                      : "Live"}
                                </span>
                                <span>{new Date(line.createdAt).toLocaleTimeString()}</span>
                              </div>
                              <div>{line.text}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </section>

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#828ba0]">Mission alignment</h4>
              <div className="mt-4 flex flex-wrap gap-4">
                {insightMissions.map(({ mission, meta, latestEvidence }) => {
                  const Icon = meta.icon
                  const tooltip = `${mission.title}: ${meta.label}${
                    latestEvidence ? ` – “${latestEvidence}”` : ""
                  }`
                  return (
                    <button
                      type="button"
                      key={mission.id}
                      onClick={() =>
                        setExpandedMission((current) => (current === mission.id ? null : mission.id))
                      }
                      title={tooltip}
                      className={`flex min-w-[70px] cursor-pointer flex-col items-center gap-1 rounded-xl border border-transparent px-2 py-2 text-center text-[11px] font-medium text-[#4b5263] transition ${
                        expandedMission === mission.id
                          ? "border-[#cfd6e6] bg-[#f8f9fd] shadow-sm"
                          : "hover:-translate-y-0.5 hover:border-[#dde1ec] hover:bg-[#f9fafc]"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full border border-[#e1e4ed] bg-white shadow-sm transition ${meta.ringClass || ""} ${
                          expandedMission === mission.id ? "scale-[1.05]" : "hover:shadow-md"
                        }`}
                        role="img"
                        aria-label={`${mission.title} status ${meta.label}`}
                      >
                        <Icon className={`h-4 w-4 ${meta.iconClass}`} />
                      </span>
                      <span className="leading-4 text-[#5a6171]">{mission.title}</span>
                      <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.18em] ${meta.badgeClass}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.textClass.replace("text", "bg")}`} />
                        {meta.label}
                      </span>
                    </button>
                  )
                })}
              </div>
              {expandedMission
                ? (() => {
                    const detail = insightMissions.find(({ mission }) => mission.id === expandedMission)
                    if (!detail) {
                      return null
                    }
                    const evidence = detail.snapshot.evidence
                    return (
                      <div className="mt-4 rounded-2xl border border-[#e4e7f0] bg-white/95 p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[#0a0f18]">{detail.mission.title}</div>
                            <p className="mt-1 text-xs leading-5 text-[#5a6171]">{detail.mission.description}</p>
                          </div>
                          <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${detail.meta.textClass}`}>
                            {detail.meta.label}
                          </span>
                        </div>
                        {evidence.length > 0 ? (
                          <ul className="mt-3 space-y-2 text-xs text-[#0a0f18]">
                            {evidence.map((item, idx) => (
                              <li
                                key={`${detail.mission.id}-expanded-${idx}`}
                                className="rounded-xl bg-[#f7f8fb] px-3 py-2 leading-5 text-[#1f2937]"
                              >
                                “{item.text}”
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-3 rounded-xl border border-dashed border-[#e6eaf3] bg-[#fbfcff] px-3 py-3 text-xs text-[#6b7280]">
                            Awaiting signal during the conversation.
                          </div>
                        )}
                      </div>
                    )
                  })()
                : null}
            </section>
          </div>
        )}

        {view === "notes" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#e4e9f2] bg-white/95 p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note…"
                  className="h-11 flex-1 rounded-xl border border-[#e2e6f0] bg-white px-4 text-sm text-[#0a0f18] outline-none transition focus:border-[#c1c9dc]"
                />
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={savingNote || !noteText.trim()}
                  className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-[#0a0f18] text-white transition hover:bg-[#1a2232] disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Save note"
                >
                  {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-[#5a6171]">Notes are shared across your team for this candidate.</p>
              {noteMessage ? (
                <div
                  className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                    noteMessage.tone === "success"
                      ? "border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
                      : "border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]"
                  }`}
                >
                  {noteMessage.text}
                </div>
              ) : null}
            </div>

            <TimelineList
              entries={timeline}
              emptyLabel="No activity yet. Leave a note or upload a file to start the timeline."
              onEditNote={handleEditNote}
              onDeleteNote={handleDeleteNote}
            />
          </div>
        )}

        {view === "files" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#e4e9f2] bg-white/95 p-5 shadow-sm">
              <p className="text-sm text-[#3b4354]">
                Upload PDFs or TXT files to the vector store so the assistant can cite them in future chats.
              </p>
              <div className="mt-3">
                <VectorUploadInline candidate={candidate} onUploaded={onFileLogged} />
              </div>
            </div>

            <TimelineList
              entries={timeline.filter((entry) => entry.type === "file")}
              emptyLabel={timeline.length > 0 ? "No files uploaded yet." : "No workspace activity yet."}
            />
          </div>
        )}
      </div>
    </section>
  )
}

function TimelineList({
  entries,
  emptyLabel,
  onEditNote,
  onDeleteNote,
}: {
  entries: CandidateTimelineEntry[]
  emptyLabel: string
  onEditNote?: (noteId: string, text: string) => Promise<{ ok: boolean; error?: string }>
  onDeleteNote?: (noteId: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const [editingNote, setEditingNote] = useState<{ id: string; text: string } | null>(null)
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!editingNote) {
      return
    }
    const entry = entries.find((item) => item.id === editingNote.id && item.type === "note")
    if (!entry || entry.type !== "note") {
      setEditingNote(null)
      setDraft("")
    }
  }, [editingNote, entries])

  if (entries.length === 0) {
    return <p className="text-sm text-[#5a6171]">{emptyLabel}</p>
  }

  return (
    <ul className="space-y-3 text-sm">
      {entries.map((entry) => {
        const isEditing = editingNote?.id === entry.id
        return (
          <li key={entry.id} className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748b]">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.2em] ${
                    entry.type === "note"
                      ? "bg-[#eef8ff] text-[#1d4ed8]"
                      : "bg-[#fef3c7] text-[#b45309]"
                  }`}
                >
                  {entry.type === "note" ? "Note" : "File"}
                </span>
                <span>{new Date(entry.at).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-[#0a0f18]">
                <span className="font-medium">{entry.author}</span>
                {entry.type === "note" && (onEditNote || onDeleteNote) ? (
                  isEditing ? (
                    <>
                      {onEditNote ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!editingNote) return
                            setPending(true)
                            const result = await onEditNote(editingNote.id, draft)
                            setPending(false)
                            if (result.ok) {
                              setEditingNote(null)
                              setDraft("")
                            }
                          }}
                          disabled={pending}
                        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#d0d6e4] bg-white text-[#047857] transition hover:border-[#b8c0d3] hover:bg-[#f5f6f8] disabled:cursor-not-allowed"
                          aria-label="Save note"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNote(null)
                          setDraft("")
                        }}
                        disabled={pending}
                      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#d0d6e4] bg-white text-[#b91c1c] transition hover:border-[#b8c0d3] hover:bg-[#fef2f2] disabled:cursor-not-allowed"
                        aria-label="Cancel edit"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      {onEditNote ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (entry.type !== "note") return
                            setEditingNote({ id: entry.id, text: entry.text })
                            setDraft(entry.text)
                          }}
                          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#d0d6e4] bg-white text-[#1f2937] transition hover:border-[#b8c0d3] hover:bg-[#f5f6f8]"
                          aria-label="Edit note"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      {onDeleteNote ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (pending) return
                            if (!window.confirm("Delete this note?")) {
                              return
                            }
                            setPending(true)
                            const result = await onDeleteNote(entry.id)
                            setPending(false)
                            if (result.ok && editingNote?.id === entry.id) {
                              setEditingNote(null)
                              setDraft("")
                            }
                          }}
                          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#fca5a5] bg-[#fef2f2] text-[#b91c1c] transition hover:border-[#f87171] hover:bg-[#fee2e2]"
                          aria-label="Delete note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </>
                  )
                ) : null}
              </div>
            </div>
          {entry.type === "note" ? (
            isEditing ? (
              <div className="mt-3">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="w-full rounded-xl border border-[#dfe3ee] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition focus:border-[#b9c3d8]"
                  rows={3}
                  disabled={pending}
                />
              </div>
            ) : (
              <>
                <p className="mt-2 text-[#0f172a]">{entry.text}</p>
              </>
            )
          ) : (
            <p className="mt-2 text-[#0f172a]">
              Uploaded <span className="font-semibold">{entry.fileName}</span> to the shared workspace.
            </p>
          )}
          </li>
        )
      })}
    </ul>
  )
}

function VectorUploadInline({
  candidate,
  onUploaded,
}: {
  candidate: CandidateProfile
  onUploaded: (entry: CandidateTimelineEntry) => void
}) {
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!status) return
    const timeout = window.setTimeout(() => setStatus(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [status])

  return (
    <div>
      <label className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#cfd6e6] bg-[#f9fbff] px-4 text-sm font-semibold text-[#0a0f18] transition hover:border-[#9aa5bf]">
        <input
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          disabled={uploading}
          className="hidden"
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ""
            if (!file) return
            setUploading(true)
            try {
              const formData = new FormData()
              formData.append("file", file)
              formData.append("candidate", candidate.id)
              formData.append("email", candidate.email ?? "")
              formData.append("uploader", "You")
              const response = await fetch("/api/vectorstore/upload", { method: "POST", body: formData })
              const payload = await response.json().catch(() => null)
              if (!response.ok) {
                const message = typeof payload?.error === "string" ? payload.error : "Upload failed"
                setStatus({ tone: "error", text: message })
              } else {
                const entry = (payload?.entry ?? null) as CandidateTimelineEntry | null
                const finalEntry = entry ?? {
                  id: Math.random().toString(36).slice(2, 9),
                  type: "file" as const,
                  fileName: file.name,
                  author: "You",
                  at: Date.now(),
                }
                onUploaded(finalEntry)
                setStatus({ tone: "success", text: `${file.name} uploaded to the workspace.` })
              }
            } catch (error) {
              console.error("Upload failed", error)
              setStatus({ tone: "error", text: "Unexpected error while uploading." })
            } finally {
              setUploading(false)
            }
          }}
        />
        {uploading ? "Uploading…" : "Upload a file"}
      </label>
      {status ? (
        <p className={`mt-2 text-xs ${status.tone === "success" ? "text-[#166534]" : "text-[#b91c1c]"}`}>
          {status.text}
        </p>
      ) : null}
    </div>
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
  sendCustomAction?: (
    action: { type: string; payload?: Record<string, unknown> },
    itemId?: string,
  ) => Promise<void>
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
  const [candidateTimelines, setCandidateTimelines] = useState<Record<string, CandidateTimelineEntry[]>>({})
  const [assignments, setAssignments] = useState<Record<string, { current: string; history: { value: string; at: number }[] }>>({})
  // Future: persist notes by candidate (local DB or hosted store)
  const selectedCandidateIdRef = useRef<string | null>(null)
  const [workspaceVisible, setWorkspaceVisible] = useState(false)
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceView>("insights")
  const wasRecordingRef = useRef(false)
  const [banner, setBanner] = useState<BannerState | null>(null)
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

  const showBanner = useCallback((tone: BannerState["tone"], message: string) => {
    const text = message.trim()
    if (!text) return
    setBanner({ id: Date.now(), tone, text })
  }, [])

  const dismissBanner = useCallback(() => {
    setBanner(null)
  }, [])

  useEffect(() => {
    if (!banner) return
    const timeout = window.setTimeout(() => setBanner(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [banner])

  const allCandidates = useMemo(() => [...customCandidates, ...candidates], [customCandidates])
  const selectedCandidate = useMemo(
    () => allCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [allCandidates, selectedCandidateId],
  )

  useEffect(() => {
    if (!selectedCandidate && workspaceVisible) {
      setWorkspaceVisible(false)
    }
  }, [selectedCandidate, workspaceVisible])

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

  const currentCandidateId = selectedCandidate?.id ?? null

  const selectedTimeline = useMemo(
    () => (currentCandidateId ? candidateTimelines[currentCandidateId] ?? [] : []),
    [candidateTimelines, currentCandidateId],
  )

  const appendTimelineEntry = useCallback((candidateId: string, entry: CandidateTimelineEntry) => {
    setCandidateTimelines((prev) => {
      const existing = prev[candidateId] ?? []
      const filtered = existing.filter((item) => item.id !== entry.id)
      const next = [entry, ...filtered].sort((a, b) => b.at - a.at)
      return { ...prev, [candidateId]: next }
    })
  }, [])

  const replaceTimelineEntry = useCallback((candidateId: string, entry: CandidateTimelineEntry) => {
    setCandidateTimelines((prev) => {
      const existing = prev[candidateId] ?? []
      const next = existing.map((item) => (item.id === entry.id ? entry : item))
      return { ...prev, [candidateId]: next }
    })
  }, [])

  const removeTimelineEntry = useCallback((candidateId: string, entryId: string) => {
    setCandidateTimelines((prev) => {
      const existing = prev[candidateId] ?? []
      const next = existing.filter((item) => item.id !== entryId)
      return { ...prev, [candidateId]: next }
    })
  }, [])

  const handleNoteSave = useCallback(
    async (text: string): Promise<{ ok: boolean; error?: string }> => {
      if (!currentCandidateId) {
        return { ok: false, error: "Select a candidate before adding notes." }
      }
      try {
        const response = await fetch("/api/candidates/note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: currentCandidateId, text, author: "You" }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          const errorMessage = typeof payload?.error === "string" ? payload.error : "Failed to save note."
          return { ok: false, error: errorMessage }
        }
        const entry = (payload?.entry ?? null) as CandidateTimelineEntry | null
        const finalEntry = entry ?? {
          id: Math.random().toString(36).slice(2, 9),
          type: "note" as const,
          text,
          author: "You",
          at: Date.now(),
        }
        appendTimelineEntry(currentCandidateId, finalEntry)
        return { ok: true }
      } catch (error) {
        console.error("Failed to save note", error)
        return { ok: false, error: "Unexpected error while saving note." }
      }
    },
    [appendTimelineEntry, currentCandidateId],
  )

  const handleNoteUpdate = useCallback(
    async (noteId: string, text: string): Promise<{ ok: boolean; error?: string }> => {
      if (!currentCandidateId) {
        return { ok: false, error: "Select a candidate before editing notes." }
      }
      try {
        const response = await fetch("/api/candidates/note", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: currentCandidateId, noteId, text }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "Failed to update note."
          return { ok: false, error: message }
        }
        const entry = (payload?.entry ?? null) as CandidateTimelineEntry | null
        if (entry) {
          replaceTimelineEntry(currentCandidateId, entry)
        }
        return { ok: true }
      } catch (error) {
        console.error("Failed to update note", error)
        return { ok: false, error: "Unexpected error while updating note." }
      }
    },
    [currentCandidateId, replaceTimelineEntry],
  )

  const handleNoteDelete = useCallback(
    async (noteId: string): Promise<{ ok: boolean; error?: string }> => {
      if (!currentCandidateId) {
        return { ok: false, error: "Select a candidate before deleting notes." }
      }
      try {
        const response = await fetch("/api/candidates/note", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: currentCandidateId, noteId }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "Failed to delete note."
          return { ok: false, error: message }
        }
        removeTimelineEntry(currentCandidateId, noteId)
        return { ok: true }
      } catch (error) {
        console.error("Failed to delete note", error)
        return { ok: false, error: "Unexpected error while deleting note." }
      }
    },
    [currentCandidateId, removeTimelineEntry],
  )

  const handleFileLogged = useCallback(
    (entry: CandidateTimelineEntry) => {
      if (!currentCandidateId) return
      appendTimelineEntry(currentCandidateId, entry)
    },
    [appendTimelineEntry, currentCandidateId],
  )

  const summarizeCall = useCallback(async () => {
    const candidateId = selectedCandidateIdRef.current
    if (!candidateId) {
      return
    }

    const transcriptItems = Array.from(transcriptItemsRef.current.values())
      .filter((item) => item.text.trim().length > 0)
      .sort((a, b) => a.createdAt - b.createdAt)

    if (transcriptItems.length === 0) {
      return
    }

    const transcriptText = transcriptItems
      .map((item) => {
        const speakerLabel =
          item.speaker === "candidate" ? "Candidate" : item.speaker === "recruiter" ? "Recruiter" : "System"
        return `${speakerLabel}: ${item.text.trim()}`
      })
      .join("\n")

    if (!transcriptText) {
      return
    }

    const candidateName =
      allCandidates.find((candidate) => candidate.id === candidateId)?.name ?? selectedCandidate?.name ?? candidateId

    const missionSnapshot = missionDefinitions
      .map((mission) => {
        const snapshot = missionState[mission.id] ?? { status: "pending", evidence: [] }
        return `${mission.title}: ${snapshot.status} (${snapshot.evidence.length} notes)`
      })
      .join("\n")

    try {
      const response = await fetch("/api/chatkit/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `You are the OpenHire recruiter copilot. Summarize the latest call with candidate ${candidateName}. Produce:\n- A three bullet recap of highlights\n- Outstanding risks or follow-ups\n- Routing recommendation confidence if applicable\n\nCurrent mission tracker:\n${missionSnapshot}\n\nTranscript:\n${transcriptText}`,
          candidate_id: candidateId,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const errorMessage =
          typeof payload?.error === "string" ? payload.error : "Failed to generate the call summary."
        throw new Error(errorMessage)
      }

      const summaryText =
        typeof payload?.result?.outputText === "string" ? payload.result.outputText.trim() : undefined
      const missionPayload = Array.isArray(payload?.result?.missionUpdates)
        ? (payload.result.missionUpdates as WorkflowMissionUpdate[])
        : []

      if (missionPayload.length > 0) {
        missionPayload.forEach((update) => {
          applyMissionUpdate(update.mission_id, (snapshot) => {
            const evidence = update.evidence ?? []
            let nextEvidence = snapshot.evidence
            for (const snippet of evidence) {
              if (!snapshot.evidence.some((entry) => entry.text === snippet)) {
                nextEvidence = [...nextEvidence, { text: snippet, at: nowish() }]
              }
            }
            if (nextEvidence.length > 5) {
              nextEvidence = nextEvidence.slice(nextEvidence.length - 5)
            }
            const nextStatus = update.status ?? snapshot.status
            const changed = nextStatus !== snapshot.status || nextEvidence !== snapshot.evidence
            return changed ? { status: nextStatus, evidence: nextEvidence } : snapshot
          })
        })
      }

      if (summaryText && summaryText.length > 0) {
        const entry: CandidateTimelineEntry = {
          id: `summary-${Date.now()}`,
          type: "note",
          text: summaryText,
          author: "OpenHire",
          at: Date.now(),
        }
        appendTimelineEntry(candidateId, entry)
        showBanner("success", "Call summary saved to the timeline.")
      } else {
        showBanner("info", "Recording ended. No summary was generated for this call.")
      }
    } catch (error) {
      console.error("Call summarization failed", error)
      const message = error instanceof Error ? error.message : "Unexpected error during call summarization."
      showBanner("error", message)
    } finally {
      transcriptItemsRef.current = new Map()
      setLiveLines([])
      processedTranscriptIdsRef.current = new Set()
    }
  }, [
    allCandidates,
    appendTimelineEntry,
    applyMissionUpdate,
    missionState,
    selectedCandidate?.name,
    showBanner,
  ])

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

  useEffect(() => {
    setInsightSources([])
  }, [selectedCandidate?.id])

  useEffect(() => {
    if (!selectedCandidate?.id) return
    const candidateId = selectedCandidate.id
    let cancelled = false

    ;(async () => {
      try {
        const response = await fetch(`/api/candidates/${candidateId}`)
        if (!response.ok) return
        const payload = (await response.json().catch(() => null)) as
          | {
              assignment?: { current: string; history: { value: string; at: number }[] }
              timeline?: CandidateTimelineEntry[]
            }
          | null
        if (cancelled || !payload) return

        const assignment = payload.assignment
        if (assignment) {
          setAssignments((prev) => ({ ...prev, [candidateId]: assignment }))
        }
        if (Array.isArray(payload.timeline)) {
          const sorted = [...payload.timeline].sort((a, b) => b.at - a.at)
          setCandidateTimelines((prev) => ({ ...prev, [candidateId]: sorted }))
        }
      } catch (error) {
        console.error("Failed to load candidate profile", error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedCandidate?.id])

  useEffect(() => {
    if (isRecording) {
      setWorkspaceVisible(true)
      wasRecordingRef.current = true
      return
    }

    if (wasRecordingRef.current) {
      wasRecordingRef.current = false
    }
  }, [isRecording])

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
            setWorkspaceVisible(true)
            setActiveWorkspace("insights")
          } catch (e) {
            console.error(e)
            showBanner("error", "We couldn't start recording. Check mic permissions and try again.")
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
        title: { enabled: false },
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
        async onAction(action, widgetItem) {
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

          const workflowWidgets = Array.isArray((result as { widgets?: unknown }).widgets)
            ? ((result as { widgets?: unknown }).widgets as unknown[])
            : []

          if (workflowWidgets.length > 0) {
            const element = chatKitRef.current
            const send = element?.sendCustomAction?.bind(element)
            if (send) {
              for (const widgetCandidate of workflowWidgets) {
                if (!isPlainObject(widgetCandidate)) {
                  continue
                }

                const root = widgetCandidate.root
                if (typeof root !== 'object' || root === null) {
                  continue
                }

                const widgetPayload = {
                  id: typeof widgetCandidate.id === 'string' ? widgetCandidate.id : MISSION_WIDGET_ID,
                  kind:
                    typeof widgetCandidate.kind === 'string' ? widgetCandidate.kind : 'mission-checklist',
                  root: root as Widgets.WidgetRoot,
                  updatedAt:
                    typeof widgetCandidate.updatedAt === 'string'
                      ? widgetCandidate.updatedAt
                      : new Date().toISOString(),
                }

                try {
                  await send(
                    {
                      type: 'openhire.widgets.upsert',
                      payload: { widget: widgetPayload },
                    },
                    widgetItem?.id,
                  )
                } catch (error) {
                  console.error('Failed to sync mission widget', error)
                }
              }
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
        tools: [],
      },
    }
  }, [
    applyMissionUpdate,
    candidateThreads,
    selectedCandidate,
    setErrorMessage,
    setPhase,
    isRecording,
    showBanner,
  ])

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

  const isChatReady = phase === "ready" && Boolean(chatKitOptions)

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

  async function handleRecordingToggle() {
    if (isRecording) {
      await stopRealtime()
      setIsRecording(false)
      await summarizeCall()
      return
    }
    try {
      await startRealtime()
      setIsRecording(true)
      setWorkspaceVisible(true)
      setActiveWorkspace("insights")
    } catch (error) {
      console.error(error)
      showBanner("error", "Mic permission or realtime start failed.")
    }
  }

  return (
    <div className="flex h-screen flex-col bg-[#f5f6f8] text-[#0a0f18]">
      <header className="bg-white px-8 py-5">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-2">
            {selectedCandidate ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold leading-7 text-[#0a0f18]">{selectedCandidate.name}</h1>
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(true)}
                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#d0d6e4] bg-white text-[#1f2332] transition hover:border-[#b2bdd6] hover:shadow-sm"
                    aria-label="Switch candidate"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : null}
            {workspaceVisible ? (
              <nav className="flex flex-wrap gap-2 pt-1">
                {WORKSPACE_VIEWS.map((item) => {
                  const isActive = activeWorkspace === item.id
                  const disabled = !selectedCandidate
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (disabled || isActive) return
                        setActiveWorkspace(item.id)
                      }}
                      disabled={disabled}
                      className={`inline-flex cursor-pointer items-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? "bg-[#0a0f18] text-white shadow-sm"
                          : "border border-[#e2e6f0] text-[#0a0f18] hover:border-[#c9d0de]"
                      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </nav>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              {selectedCandidate ? (
                <div className="inline-flex items-center rounded-full border border-[#d6dbe6] bg-white p-1 text-xs font-semibold text-[#0a0f18] shadow-sm">
                  <button
                    type="button"
                    onClick={() => setWorkspaceVisible(false)}
                    className={`cursor-pointer rounded-full px-3 py-1 transition ${
                      workspaceVisible
                        ? "text-[#6b7280] hover:bg-[#f3f4f6]"
                        : "bg-[#0a0f18] text-white shadow hover:bg-[#111827]"
                    }`}
                  >
                    Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkspaceVisible(true)
                      setActiveWorkspace("insights")
                    }}
                    className={`cursor-pointer rounded-full px-3 py-1 transition ${
                      workspaceVisible
                        ? "bg-[#0a0f18] text-white shadow hover:bg-[#111827]"
                        : "text-[#6b7280] hover:bg-[#f3f4f6]"
                    }`}
                  >
                    Workspace
                  </button>
                </div>
              ) : null}
              <div className="text-xs uppercase tracking-[0.32em] text-[#9aa1b2]">OpenHire Beta</div>
            </div>
          </div>
        </div>
      </header>

      {banner ? <InlineBanner banner={banner} onDismiss={dismissBanner} /> : null}

      <div className="relative flex min-h-0 flex-1 bg-[#f7f8fb]">
        <div className={`min-h-0 flex-1 ${workspaceVisible ? "hidden" : "flex"}`}>
          <div className="relative h-full w-full">
            <openai-chatkit
              ref={chatKitRef}
              className={isChatReady ? "block h-full w-full" : "hidden"}
              style={{ height: "100%", width: "100%" }}
              data-domain-key={process.env.NEXT_PUBLIC_CHATKIT_DOMAIN_KEY}
            ></openai-chatkit>
          </div>
        </div>
        <div className={`flex min-h-0 flex-1 flex-col bg-white ${workspaceVisible ? "" : "hidden"}`}>
          <WorkspacePanel
            view={activeWorkspace}
            candidate={selectedCandidate}
            live={liveLines}
            isRecording={isRecording}
            missions={missionState}
            sources={insightSources}
            timeline={selectedTimeline}
            onAddNote={handleNoteSave}
            onUpdateNote={handleNoteUpdate}
            onDeleteNote={handleNoteDelete}
            onToggleRecording={handleRecordingToggle}
            onFileLogged={handleFileLogged}
          />
        </div>

        {phase === "loading" && !workspaceVisible && (
          <div className="absolute inset-0 z-30 flex items-center justify-center gap-3 bg-white/85 text-[#5f687a] backdrop-blur">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Loading ChatKit…</span>
          </div>
        )}

        {phase === "error" && !workspaceVisible && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-white/90 px-6 text-center">
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
      </div>
      {!workspaceVisible ? (
        <footer className="bg-white px-8 py-4 text-center text-[11px] font-medium tracking-[0.18em] text-[#5f687a]">
          OpenHire can make mistakes. If anything seems off, ping us on #openhire-feedback or fill out this form.
        </footer>
      ) : null}
    </div>
  )
}

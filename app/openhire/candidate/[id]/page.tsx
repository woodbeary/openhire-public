import { revalidatePath } from "next/cache"
import Link from "next/link"
import { notFound } from "next/navigation"

import { getStore, type CandidateTimelineEntry } from "@/lib/serverStore"

type NoteEntry = Extract<CandidateTimelineEntry, { type: "note" }>

type CandidateResp = {
  candidate: { id: string; name: string; email: string; role: string; lastInteraction?: string }
  assignment: { current: string; history: { value: string; at: number }[] }
  notes: NoteEntry[]
  timeline: CandidateTimelineEntry[]
}

function loadCandidate(id: string): CandidateResp | null {
  const { candidates, assignments, timeline } = getStore()
  const candidate = candidates.find((c) => c.id === id)
  if (!candidate) {
    return null
  }
  const assignment = assignments[candidate.id] ?? { current: "Unassigned", history: [] }
  const entries = timeline[candidate.id] ?? []
  const notes = entries.filter((entry): entry is NoteEntry => entry.type === "note")
  return { candidate, assignment, notes, timeline: entries }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("")
}

type CandidateParams = { id: string }

async function resolveParams(params: CandidateParams | Promise<CandidateParams>): Promise<CandidateParams> {
  return typeof (params as Promise<CandidateParams>).then === "function"
    ? await (params as Promise<CandidateParams>)
    : (params as CandidateParams)
}

export default async function CandidatePage({ params }: { params: CandidateParams | Promise<CandidateParams> }) {
  const { id } = await resolveParams(params)
  const data = loadCandidate(id)
  if (!data) {
    notFound()
  }
  const { candidate, assignment, notes, timeline } = data
  const initials = getInitials(candidate.name || "Candidate") || "?"
  const firstName = candidate.name.split(" ")[0] || "candidate"

  return (
    <div className="min-h-screen bg-[#f4f5f8] pb-16 pt-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6">
        <header className="flex flex-col gap-4">
          <Link
            href="/openhire"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#5f687a] transition hover:text-[#0a0f18]"
          >
            <span className="text-base">←</span> Back to workspace
          </Link>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold text-[#0a0f18]">Candidate profile</h1>
            <p className="max-w-3xl text-sm leading-6 text-[#586074]">
              Review assignments, notes, and recent activity for {candidate.name.split(" ")[0] ?? "this candidate"} before jumping back into the workspace.
            </p>
          </div>
        </header>

        <section className="rounded-3xl border border-[#e4e8f1] bg-white/95 p-8 shadow-[0_24px_48px_-36px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#0a0f18] to-[#1f2a40] text-2xl font-semibold text-white shadow-lg">
                {initials}
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold text-[#0a0f18]">{candidate.name}</h2>
                    <span className="inline-flex items-center rounded-full bg-[#0a0f18] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                      {assignment.current || "Unassigned"}
                    </span>
                  </div>
                  <p className="text-sm text-[#5f687a]">Active in {candidate.role || "an open track"}</p>
                </div>
                <dl className="grid grid-cols-1 gap-3 text-sm text-[#0a0f18] sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#edf0f7] bg-[#f8f9fd] px-4 py-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e879b]">Email</dt>
                    <dd className="mt-1 font-medium">{candidate.email || "—"}</dd>
                  </div>
                  <div className="rounded-2xl border border-[#edf0f7] bg-[#f8f9fd] px-4 py-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e879b]">Last interaction</dt>
                    <dd className="mt-1 font-medium">{candidate.lastInteraction ?? "—"}</dd>
                  </div>
                  <div className="rounded-2xl border border-[#edf0f7] bg-[#f8f9fd] px-4 py-3 sm:col-span-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e879b]">Profile ID</dt>
                    <dd className="mt-1 font-medium">{candidate.id}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 text-sm text-[#0a0f18] lg:items-end">
              <p className="text-xs uppercase tracking-[0.2em] text-[#9aa1b2]">Quick actions</p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={candidate.email ? `mailto:${candidate.email}` : undefined}
                  className={`inline-flex items-center justify-center rounded-full border border-[#d6dbe6] px-4 py-2 text-xs font-semibold transition ${
                    candidate.email
                      ? "text-[#0a0f18] hover:border-[#bcc3d2] hover:text-[#111827]"
                      : "cursor-not-allowed text-[#a0a6b6] opacity-70"
                  }`}
                  aria-disabled={!candidate.email}
                >
                  Email {firstName}
                </a>
                <Link
                  href="/openhire"
                  className="inline-flex items-center justify-center rounded-full bg-[#0a0f18] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#141c2d]"
                >
                  Jump into workspace
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="space-y-6">
            <article className="rounded-3xl border border-[#e5e9f2] bg-white/95 p-6 shadow-[0_24px_48px_-36px_rgba(10,15,24,0.28)]">
              <header className="mb-4 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-[#828ba0]">Notes</h3>
              </header>
              <form
                className="mb-5 flex flex-col gap-3 sm:flex-row"
                action={async (formData: FormData) => {
                  "use server"
                  const text = String(formData.get("text") ?? "").trim()
                  if (!text) return
                  const { timeline: storeTimeline } = getStore()
                  const list = (storeTimeline[candidate.id] ||= [])
                  list.unshift({
                    id: Math.random().toString(36).slice(2, 9),
                    type: "note",
                    text,
                    author: "You",
                    at: Date.now(),
                  })
                  await revalidatePath(`/openhire/candidate/${candidate.id}`)
                }}
              >
                <input
                  name="text"
                  placeholder="Add a quick note for the panel…"
                  className="h-11 flex-1 rounded-xl border border-[#e2e6f0] bg-[#f9fafc] px-4 text-sm text-[#0a0f18] outline-none transition focus:border-[#c1c9dc]"
                />
                <button className="inline-flex items-center justify-center rounded-xl bg-[#0a0f18] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1a2232]">
                  Save note
                </button>
              </form>
              {notes.length === 0 ? (
                <p className="text-sm text-[#5f687a]">No notes yet. Capture observations from interviews or screens to share with the loop.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {notes.map((note) => (
                    <li key={note.id} className="rounded-2xl border border-[#eef1f7] bg-[#f9fafc] p-4">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-[#7f879a]">
                        <span>{new Date(note.at).toLocaleString()}</span>
                        <span className="font-semibold text-[#0a0f18]">{note.author}</span>
                      </div>
                      <p className="mt-2 text-[15px] leading-6 text-[#1f2937]">{note.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-3xl border border-[#e5e9f2] bg-white/95 p-6 shadow-[0_24px_48px_-36px_rgba(10,15,24,0.28)]">
              <header className="mb-4 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-[#828ba0]">Activity timeline</h3>
              </header>
              {timeline.length === 0 ? (
                <p className="text-sm text-[#5f687a]">No activity yet. Mission updates, notes, and uploaded files will land here.</p>
              ) : (
                <ul className="space-y-4 text-sm">
                  {timeline.map((entry) => (
                    <li key={entry.id} className="rounded-2xl border border-[#eef1f7] bg-[#fdfdfd] p-4 shadow-sm">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-[#9aa1b2]">
                        <span>{new Date(entry.at).toLocaleString()}</span>
                        <span className="font-semibold text-[#0a0f18]">{entry.author}</span>
                      </div>
                      {entry.type === "note" ? (
                        <p className="mt-3 text-[15px] leading-6 text-[#1f2332]">{entry.text}</p>
                      ) : (
                        <p className="mt-3 text-[15px] leading-6 text-[#1f2332]">
                          Uploaded <span className="font-semibold">{entry.fileName}</span> to the workspace
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-[#e5e9f2] bg-white/95 p-6 shadow-[0_24px_48px_-36px_rgba(10,15,24,0.28)]">
              <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-[#828ba0]">Recruiter assignment</h3>
              <p className="mt-2 text-sm text-[#5f687a]">
                Update who owns the next touchpoint so the workspace stays routed to the right teammate.
              </p>
              <form
                className="mt-4 flex flex-col gap-3"
                action={async (formData: FormData) => {
                  "use server"
                  const recruiter = String(formData.get("recruiter") ?? "").trim()
                  if (!recruiter) return
                  const id = String(formData.get("id") ?? "")
                  if (!id) return
                  const { assignments } = getStore()
                  const record = assignments[id]
                  if (!record) return
                  record.current = recruiter
                  record.history.push({ value: recruiter, at: Date.now() })
                  await revalidatePath(`/openhire/candidate/${candidate.id}`)
                }}
              >
                <input name="id" defaultValue={candidate.id} hidden />
                <input
                  name="recruiter"
                  placeholder="Reassign to…"
                  className="h-11 rounded-xl border border-[#e2e6f0] bg-[#f9fafc] px-4 text-sm text-[#0a0f18] outline-none transition focus:border-[#c1c9dc]"
                  defaultValue=""
                />
                <button className="inline-flex items-center justify-center rounded-xl bg-[#0a0f18] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1a2232]">
                  Save assignment
                </button>
              </form>
              <div className="mt-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#828ba0]">History</div>
                <ul className="mt-2 space-y-2 text-xs text-[#0a0f18]">
                  {assignment.history.map((h, idx) => (
                    <li key={`${h.at}-${idx}`} className="rounded-xl bg-[#f9fafc] px-3 py-2">
                      <div className="font-medium">{h.value}</div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-[#9aa1b2]">{new Date(h.at).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="rounded-3xl border border-[#e5e9f2] bg-white/95 p-6 shadow-[0_24px_48px_-36px_rgba(10,15,24,0.28)]">
              <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-[#828ba0]">Profile snapshot</h3>
              <dl className="mt-4 space-y-3 text-sm text-[#0a0f18]">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-[#5f687a]">Track</dt>
                  <dd className="font-medium">{candidate.role || "Unassigned"}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-[#5f687a]">Last interaction</dt>
                  <dd className="font-medium">{candidate.lastInteraction ?? "—"}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-[#5f687a]">Profile ID</dt>
                  <dd className="font-medium">{candidate.id}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

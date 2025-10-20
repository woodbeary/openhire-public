import { candidates as baseCandidates } from "@/lib/candidates"

export type ServerCandidate = {
  id: string
  name: string
  email: string
  role: string
  lastInteraction?: string
}

export type AssignmentLog = { value: string; at: number }

export type CandidateTimelineEntry =
  | { id: string; type: "note"; text: string; author: string; at: number }
  | { id: string; type: "file"; fileName: string; author: string; at: number }

type Store = {
  candidates: ServerCandidate[]
  assignments: Record<string, { current: string; history: AssignmentLog[] }>
  timeline: Record<string, CandidateTimelineEntry[]>
}

let store: Store | null = null

function seedCandidates(): ServerCandidate[] {
  const seeded = baseCandidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    email: candidate.email,
    role: candidate.role,
    lastInteraction: candidate.lastInteraction,
  }))

  const extraNames = [
    "Liam Johnson",
    "Emma Davis",
    "Noah Wilson",
    "Ava Martinez",
    "Ethan Brown",
    "Sophia Anderson",
    "Mason Thomas",
    "Mia Taylor",
    "Logan Moore",
    "Charlotte Jackson",
    "Lucas White",
    "Amelia Harris",
    "Elijah Martin",
    "Harper Thompson",
    "James Garcia",
    "Evelyn Martinez",
    "Benjamin Clark",
    "Abigail Lewis",
    "Alexander Lee",
    "Emily Walker",
    "Michael Hall",
  ]

  const roles = ["GTM Innovator Track", "People Innovation Track", "Mission Ops Track"]

  extraNames.forEach((name, idx) => {
    const id = `cand_seed_${idx}`
    if (seeded.some((candidate) => candidate.id === id)) {
      return
    }
    const email = `${name.toLowerCase().replace(/[^a-z]/g, "")}@example.com`
    seeded.push({
      id,
      name,
      email,
      role: roles[idx % roles.length],
      lastInteraction: undefined,
    })
  })

  return seeded
}

export function getStore(): Store {
  if (!store) {
    const candidates = seedCandidates()
    const assignments: Store["assignments"] = {}
    const now = Date.now()
    for (const candidate of candidates) {
      assignments[candidate.id] = {
        current: "Alex R.",
        history: [{ value: "Alex R.", at: now }],
      }
    }
    store = { candidates, assignments, timeline: {} }
  }
  return store
}


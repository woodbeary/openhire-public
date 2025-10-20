'use server'

import { NextResponse } from 'next/server'
import { getStore } from '@/lib/serverStore'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const { candidates, assignments, timeline } = getStore()
  const cand = candidates.find((c) => c.id === String(params.id))
  if (!cand) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const assignment = assignments[cand.id] ?? { current: 'Unassigned', history: [] }
  const entries = timeline[cand.id] ?? []
  const noteItems = entries.filter((entry) => entry.type === 'note')
  return NextResponse.json({ candidate: cand, assignment, notes: noteItems, timeline: entries })
}

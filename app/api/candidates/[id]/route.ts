'use server'

import { NextResponse } from 'next/server'
import { getStore } from '@/lib/serverStore'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const { candidates, assignments, notes } = getStore()
  const cand = candidates.find((c) => c.id === String(params.id))
  if (!cand) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const assignment = assignments[cand.id] ?? { current: 'Unassigned', history: [] }
  const noteItems = notes[cand.id] ?? []
  return NextResponse.json({ candidate: cand, assignment, notes: noteItems })
}

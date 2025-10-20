'use server'

import { NextResponse } from 'next/server'
import { getStore } from '@/lib/serverStore'

export async function POST(request: Request) {
  const { assignments } = getStore()
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const recruiter = typeof body?.recruiter === 'string' ? body.recruiter.trim() : ''
  if (!id || !recruiter) return NextResponse.json({ error: 'id and recruiter required' }, { status: 400 })
  const existing = assignments[id]
  if (!existing) return NextResponse.json({ error: 'candidate not found' }, { status: 404 })
  existing.current = recruiter
  existing.history.push({ value: recruiter, at: Date.now() })
  return NextResponse.json({ ok: true })
}


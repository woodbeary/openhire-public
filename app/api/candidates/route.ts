'use server'

import { NextResponse } from 'next/server'
import { getStore } from '@/lib/serverStore'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').toLowerCase()
  const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10))
  const pageSize = Math.max(1, Math.min(50, parseInt(searchParams.get('pageSize') || '4', 10)))

  const { candidates } = getStore()
  const filtered = q
    ? candidates.filter((c) => [c.name, c.email, c.role].some((v) => v.toLowerCase().includes(q)))
    : candidates
  const total = filtered.length
  const start = Math.min(page * pageSize, Math.max(0, total - 1))
  const items = filtered.slice(start, start + pageSize)
  return NextResponse.json({ items, total, page, pageSize })
}

export async function POST(request: Request) {
  const { candidates, assignments } = getStore()
  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const id = `cand_${Math.random().toString(36).slice(2, 10)}`
  const role = 'Unassigned'
  candidates.unshift({ id, name, email, role })
  assignments[id] = { current: 'Alex R.', history: [{ value: 'Alex R.', at: Date.now() }] }
  return NextResponse.json({ id })
}


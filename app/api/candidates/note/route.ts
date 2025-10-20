'use server'

import { NextResponse } from 'next/server'
import { getStore } from '@/lib/serverStore'

export async function POST(request: Request) {
  const { notes } = getStore()
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!id || !text) return NextResponse.json({ error: 'id and text required' }, { status: 400 })
  const list = (notes[id] ||= [])
  list.unshift({ id: Math.random().toString(36).slice(2, 9), text, at: Date.now() })
  return NextResponse.json({ ok: true })
}


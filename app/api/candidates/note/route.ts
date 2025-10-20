'use server'

import { NextResponse } from 'next/server'
import { getStore } from '@/lib/serverStore'

export async function POST(request: Request) {
  const { timeline } = getStore()
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const author = typeof body?.author === 'string' && body.author.trim().length > 0 ? body.author.trim() : 'You'
  if (!id || !text) return NextResponse.json({ error: 'id and text required' }, { status: 400 })
  const list = (timeline[id] ||= [])
  const entry = { id: Math.random().toString(36).slice(2, 9), type: 'note' as const, text, author, at: Date.now() }
  list.unshift(entry)
  return NextResponse.json({ ok: true, entry })
}

export async function PUT(request: Request) {
  const { timeline } = getStore()
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const noteId = typeof body?.noteId === 'string' ? body.noteId : ''
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!id || !noteId || !text) {
    return NextResponse.json({ error: 'id, noteId, and text required' }, { status: 400 })
  }
  const list = timeline[id]
  if (!list) {
    return NextResponse.json({ error: 'Unknown candidate' }, { status: 404 })
  }
  const index = list.findIndex((entry) => entry.id === noteId)
  if (index === -1 || list[index]?.type !== 'note') {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }
  const existing = list[index]!
  const updated = { ...existing, text }
  list[index] = updated
  return NextResponse.json({ ok: true, entry: updated })
}

export async function DELETE(request: Request) {
  const { timeline } = getStore()
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const noteId = typeof body?.noteId === 'string' ? body.noteId : ''
  if (!id || !noteId) {
    return NextResponse.json({ error: 'id and noteId required' }, { status: 400 })
  }
  const list = timeline[id]
  if (!list) {
    return NextResponse.json({ error: 'Unknown candidate' }, { status: 404 })
  }
  const index = list.findIndex((entry) => entry.id === noteId)
  if (index === -1 || list[index]?.type !== 'note') {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }
  list.splice(index, 1)
  return NextResponse.json({ ok: true })
}

'use server'

import { NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com'
const VECTOR_STORE_ID = process.env.OPENAI_VECTOR_STORE_ID

type VectorStoreFile = {
  id: string
  file_id: string
  name?: string | null
  attributes?: Record<string, unknown> | null
}

type VectorStoreListResponse = {
  data?: VectorStoreFile[]
  has_more?: boolean
  last_id?: string | null
}

export async function POST(request: Request) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY missing' }, { status: 500 })
  }
  if (!VECTOR_STORE_ID) {
    return NextResponse.json({ error: 'OPENAI_VECTOR_STORE_ID missing' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const candidateId = typeof (body as { candidate_id?: unknown })?.candidate_id === 'string' ? (body as { candidate_id: string }).candidate_id : undefined
  const fileIds = Array.isArray((body as { file_ids?: unknown })?.file_ids)
    ? ((body as { file_ids: unknown[] }).file_ids.filter((value) => typeof value === 'string') as string[])
    : []

  if (fileIds.length === 0) {
    return NextResponse.json({ sources: [] })
  }

  const headers = {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    'OpenAI-Beta': 'assistants=v2',
  }

  const collected = new Map<string, VectorStoreFile>()
  const targetIds = new Set(fileIds)
  let hasMore = true
  let cursor: string | null = null

  while (hasMore && collected.size < targetIds.size) {
    const url = new URL(`${OPENAI_BASE_URL}/v1/vector_stores/${VECTOR_STORE_ID}/files`)
    url.searchParams.set('limit', '200')
    if (cursor) {
      url.searchParams.set('after', cursor)
    }

    const listResponse = await fetch(url, { headers })
    const listPayload = (await listResponse.json().catch(() => null)) as VectorStoreListResponse | null

    if (!listResponse.ok || !listPayload) {
      const listError =
        listPayload && typeof listPayload === 'object' && 'error' in listPayload && typeof (listPayload as { error?: unknown }).error === 'string'
          ? (listPayload as { error: string }).error
          : 'Failed to list vector store files'

      return NextResponse.json({ error: listError }, { status: listResponse.status || 500 })
    }

    const data = Array.isArray(listPayload.data) ? listPayload.data : []
    for (const item of data) {
      if (!item || typeof item !== 'object') {
        continue
      }
      if (!targetIds.has(item.file_id)) {
        continue
      }
      if (candidateId) {
        const candidateAttribute =
          typeof item.attributes === 'object' && item.attributes && 'candidate' in item.attributes &&
          typeof (item.attributes as Record<string, unknown>).candidate === 'string'
            ? ((item.attributes as Record<string, unknown>).candidate as string)
            : undefined
        if (!candidateAttribute || candidateAttribute !== candidateId) {
          continue
        }
      }
      collected.set(item.file_id, item)
    }

    hasMore = Boolean(listPayload.has_more)
    cursor = listPayload.last_id ?? null
    if (!cursor) {
      break
    }
  }

  if (collected.size === 0) {
    return NextResponse.json({ sources: [] })
  }

  const fileMetaResponses = await Promise.all(
    Array.from(collected.keys()).map(async (fileId) => {
      const metaRes = await fetch(`${OPENAI_BASE_URL}/v1/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      })
      const metaPayload = await metaRes.json().catch(() => null)
      return {
        fileId,
        ok: metaRes.ok,
        payload: metaPayload as { filename?: string | null } | null,
      }
    }),
  )

  const sources = fileMetaResponses.map((meta) => {
    const vectorStoreFile = collected.get(meta.fileId)!
    const name = meta.ok ? meta.payload?.filename ?? vectorStoreFile.name ?? null : vectorStoreFile.name ?? null
    return {
      fileId: meta.fileId,
      name,
      vectorStoreFileId: vectorStoreFile.id,
      attributes: vectorStoreFile.attributes ?? null,
    }
  })

  return NextResponse.json({ sources })
}


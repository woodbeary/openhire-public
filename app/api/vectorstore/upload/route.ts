'use server'

import { NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com'
const VECTOR_STORE_ID = process.env.OPENAI_VECTOR_STORE_ID

export async function POST(request: Request) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY missing' }, { status: 500 })
  }
  if (!VECTOR_STORE_ID) {
    return NextResponse.json({ error: 'OPENAI_VECTOR_STORE_ID missing' }, { status: 500 })
  }

  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const email = (form.get('email') as string) || undefined
    const candidate = (form.get('candidate') as string) || undefined

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    // 1) Upload file to OpenAI Files with purpose=assistants
    const fileUploadForm = new FormData()
    fileUploadForm.append('purpose', 'assistants')
    fileUploadForm.append('file', file)

    const uploadRes = await fetch(`${OPENAI_BASE_URL}/v1/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: fileUploadForm,
    })

    const uploaded = await uploadRes.json()
    if (!uploadRes.ok) {
      return NextResponse.json({ error: uploaded?.error?.message ?? 'upload failed' }, { status: uploadRes.status })
    }
    const fileId = uploaded?.id as string | undefined
    if (!fileId) {
      return NextResponse.json({ error: 'upload succeeded but missing file id' }, { status: 500 })
    }

    // 2) Attach to vector store
    const attachRes = await fetch(`${OPENAI_BASE_URL}/v1/vector_stores/${VECTOR_STORE_ID}/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        file_id: fileId,
        attributes: {
          candidate,
          email,
        },
      }),
    })

    const attached = await attachRes.json()
    if (!attachRes.ok) {
      return NextResponse.json({ error: attached?.error?.message ?? 'attach failed' }, { status: attachRes.status })
    }

    return NextResponse.json({
      file_id: fileId,
      vector_store_file: attached,
    })
  } catch (error) {
    console.error('vectorstore upload error', error)
    return NextResponse.json({ error: 'unexpected error' }, { status: 500 })
  }
}


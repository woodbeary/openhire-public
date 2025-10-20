'use server'

import { NextResponse } from 'next/server'

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime-mini-2025-10-06'
const REALTIME_PROMPT_ID = process.env.OPENAI_REALTIME_PROMPT_ID
const REALTIME_PROMPT_VERSION = process.env.OPENAI_REALTIME_PROMPT_VERSION ?? '1'
const REALTIME_TRANSCRIPT_MODEL = process.env.OPENAI_REALTIME_TRANSCRIPT_MODEL ?? 'gpt-4o-mini-transcribe'

export async function POST(request: Request) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not set. Add it to your environment to enable realtime sessions.' },
      { status: 500 },
    )
  }

  try {
    const sdp = await request.text()
    if (!sdp || sdp.length < 20) {
      return NextResponse.json({ error: 'Invalid SDP offer' }, { status: 400 })
    }

    const audioInputConfig = {
      turn_detection: {
        type: 'server_vad',
        create_response: false,
        interrupt_response: false,
      },
      ...(REALTIME_TRANSCRIPT_MODEL
        ? { transcription: { model: REALTIME_TRANSCRIPT_MODEL } }
        : {}),
    }

    const sessionConfig = {
      type: 'realtime',
      model: REALTIME_MODEL,
      prompt: REALTIME_PROMPT_ID
        ? {
            id: REALTIME_PROMPT_ID,
            version: REALTIME_PROMPT_VERSION,
          }
        : undefined,
      audio: {
        input: audioInputConfig,
      },
    }

    const fd = new FormData()
    fd.set('sdp', sdp)
    fd.set('session', JSON.stringify(sessionConfig))

    const response = await fetch(`${OPENAI_BASE_URL}/v1/realtime/calls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: fd,
    })

    const answerText = await response.text()
    if (!response.ok) {
      console.error('Realtime webrtc error', answerText)
      return NextResponse.json({ error: 'Failed to create realtime call' }, { status: response.status })
    }

    return new Response(answerText, { headers: { 'Content-Type': 'application/sdp' } })
  } catch (error) {
    console.error('Unexpected realtime webrtc error', error)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

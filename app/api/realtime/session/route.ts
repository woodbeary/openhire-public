'use server'

import { NextResponse } from 'next/server'

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime-mini-2025-10-06'
const REALTIME_PROMPT_ID = process.env.OPENAI_REALTIME_PROMPT_ID ?? 'pmpt_68f3f95fe12881938330a6c1da11164205cd59d72d9491bd'
const REALTIME_PROMPT_VERSION = process.env.OPENAI_REALTIME_PROMPT_VERSION ?? '1'
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE ?? 'marin'
const REALTIME_TRANSCRIPT_MODEL = process.env.OPENAI_REALTIME_TRANSCRIPT_MODEL ?? 'whisper-1'

type SessionRequest = {
  voice?: string
  model?: string
}

type RealtimeClientSecretResponse = {
  value?: string
  expires_at?: string
  client_secret?: { value?: string; expires_at?: string } | string
  clientSecret?: { value?: string; expires_at?: string } | string
  error?: { message?: string } | string
}

export async function POST(request: Request) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not set. Add it to your environment to enable realtime sessions.' },
      { status: 500 },
    )
  }

  let overrides: SessionRequest | null = null
  try {
    if (request.body) {
        overrides = (await request.json()) as SessionRequest
    }
  } catch (error) {
    // ignore malformed JSON and fall back to defaults
    console.warn('Failed to parse realtime session overrides', error)
  }

  const model = overrides?.model ?? REALTIME_MODEL
  const voice = overrides?.voice ?? REALTIME_VOICE

  const sessionPayload = {
    session: {
      type: 'realtime',
      model,
      prompt: REALTIME_PROMPT_ID
        ? {
            id: REALTIME_PROMPT_ID,
            version: REALTIME_PROMPT_VERSION,
          }
        : undefined,
      audio: {
        input: {
          transcription: REALTIME_TRANSCRIPT_MODEL
            ? {
                model: REALTIME_TRANSCRIPT_MODEL,
              }
            : undefined,
        },
        output: {
          voice,
        },
      },
    },
  }

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/v1/realtime/client_secrets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1',
      },
      body: JSON.stringify(sessionPayload),
    })

    const payload = await (async (): Promise<RealtimeClientSecretResponse | null> => {
      try {
        return (await response.json()) as RealtimeClientSecretResponse
      } catch {
        return null
      }
    })()

    if (!response.ok) {
      const errorMessage =
        typeof payload?.error === 'string'
          ? payload.error
          : typeof payload?.error === 'object' && payload?.error && 'message' in payload.error
            ? payload.error.message
            : undefined
      const message = errorMessage ?? `Realtime session request failed with status ${response.status}`

      console.error('Realtime client secret error', {
        status: response.status,
        payload,
      })

      return NextResponse.json({ error: message }, { status: response.status })
    }

    const secret =
      payload?.value ??
      (typeof payload?.client_secret === 'string'
        ? payload.client_secret
        : payload?.client_secret?.value) ??
      (typeof payload?.clientSecret === 'string'
        ? payload.clientSecret
        : payload?.clientSecret?.value) ??
      null

    if (typeof secret !== 'string' || secret.length === 0) {
      return NextResponse.json(
        {
          error: 'Realtime session response did not contain a client secret.',
        },
        { status: 500 },
      )
    }

    const expiresAt =
      payload?.expires_at ??
      (typeof payload?.client_secret === 'string' ? undefined : payload?.client_secret?.expires_at) ??
      (typeof payload?.clientSecret === 'string' ? undefined : payload?.clientSecret?.expires_at) ??
      null

    return NextResponse.json({
      client_secret: {
        value: secret,
        expires_at: expiresAt,
      },
    })
  } catch (error) {
    console.error('Unexpected realtime session error', error)
    return NextResponse.json(
      {
        error: 'Unexpected error while creating a realtime session.',
      },
      { status: 500 },
    )
  }
}

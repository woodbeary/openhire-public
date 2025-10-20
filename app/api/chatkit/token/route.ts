'use server'

import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { DEFAULT_WORKFLOW_ID } from "@/lib/agentkit/constants"

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com"
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const CHATKIT_WORKFLOW_ID =
  process.env.OPENAI_CHATKIT_WORKFLOW_ID ?? DEFAULT_WORKFLOW_ID
const CHATKIT_WORKFLOW_VERSION = process.env.OPENAI_CHATKIT_WORKFLOW_VERSION ?? "1"
// const OPENAI_VECTOR_STORE_ID = process.env.OPENAI_VECTOR_STORE_ID

type ChatKitSessionResponse = {
  client_secret?: { value?: string; expires_at?: string } | string
  clientSecret?: { value?: string; expires_at?: string } | string
  value?: string
  expires_at?: string
  error?: { message?: string } | string
}

export async function POST(request: Request) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY is not set. Add it to your environment to enable ChatKit.",
      },
      { status: 500 },
    )
  }

  try {
    type CookieSetOptions = {
      name: string
      value: string
      httpOnly?: boolean
      sameSite?: 'lax' | 'strict' | 'none'
      secure?: boolean
      path?: string
      maxAge?: number
      expires?: Date
    }
    type CookieStore = { get: (name: string) => { value?: string } | undefined; set: (opts: CookieSetOptions) => void }
    let cookieStore: CookieStore | null = null
    try {
      cookieStore = (await cookies()) as unknown as CookieStore
    } catch {
      // tests or non-request scope
      cookieStore = null
    }
    const COOKIE_NAME = "openhire_chatkit_user_id"
    const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days
    const CANDIDATE_COOKIE_NAME = "openhire_candidate_id"

    let candidateIdFromRequest: string | null = null
    const contentType = request.headers.get("content-type")
    if (contentType?.includes("application/json")) {
      const payload = await (async () => {
        try {
          return (await request.json()) as { candidate?: { id?: unknown; name?: string; role?: string; email?: string; recruiter?: string } }
        } catch {
          return null
        }
      })()
      const candidateIdValue = payload?.candidate?.id
      if (typeof candidateIdValue === "string" && candidateIdValue.length > 0) {
        candidateIdFromRequest = candidateIdValue
      }
      // Additional candidate fields are intentionally ignored here
    }

    let userId = cookieStore ? cookieStore.get(COOKIE_NAME)?.value ?? null : null
    if (!userId) {
      userId = `recruiter-${crypto.randomUUID()}`
      if (cookieStore) {
        cookieStore.set({
          name: COOKIE_NAME,
          value: userId,
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: COOKIE_MAX_AGE,
        })
      }
    }

    if (candidateIdFromRequest && cookieStore) {
      cookieStore.set({
        name: CANDIDATE_COOKIE_NAME,
        value: candidateIdFromRequest,
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: COOKIE_MAX_AGE,
      })
    }

    // Scope user by candidate to isolate history per candidate
    const scopedUserId = candidateIdFromRequest ? `${userId}__cand_${candidateIdFromRequest}` : userId

    const response = await fetch(`${OPENAI_BASE_URL}/v1/chatkit/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "chatkit_beta=v1",
      },
      body: JSON.stringify({
        user: scopedUserId,
        workflow: {
          id: CHATKIT_WORKFLOW_ID,
          version: CHATKIT_WORKFLOW_VERSION,
        },
        // Note: attributes not currently supported by sessions API; keep minimal payload
      }),
    })

    const payload = await (async (): Promise<ChatKitSessionResponse | null> => {
      try {
        return (await response.json()) as ChatKitSessionResponse
      } catch {
        return null
      }
    })()

    if (!response.ok) {
      const errorMessage =
        typeof payload?.error === "string"
          ? payload.error
          : typeof payload?.error === "object" && payload?.error && "message" in payload.error
            ? payload.error.message
            : undefined
      const message = errorMessage ?? `ChatKit session request failed with status ${response.status}`

      console.error("ChatKit session error", {
        status: response.status,
        payload,
      })

      return NextResponse.json({ error: message }, { status: response.status })
    }

    const secret =
      (typeof payload?.client_secret === "string"
        ? payload.client_secret
        : payload?.client_secret?.value) ??
      (typeof payload?.clientSecret === "string"
        ? payload.clientSecret
        : payload?.clientSecret?.value) ??
      payload?.value ??
      null

    if (typeof secret !== "string" || secret.length === 0) {
      return NextResponse.json(
        {
          error: "ChatKit session response did not contain a client secret.",
        },
        { status: 500 },
      )
    }

    const expiresAt =
      (typeof payload?.client_secret === "string"
        ? undefined
        : payload?.client_secret?.expires_at) ??
      (typeof payload?.clientSecret === "string" ? undefined : payload?.clientSecret?.expires_at) ??
      payload?.expires_at ??
      null

    return NextResponse.json({
      client_secret: {
        value: secret,
        expires_at: expiresAt,
      },
    })
  } catch (error) {
    console.error("Unexpected ChatKit session error", error)
    return NextResponse.json(
      {
        error: "Unexpected error while creating a ChatKit session.",
      },
      { status: 500 },
    )
  }
}

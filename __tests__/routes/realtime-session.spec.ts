import { describe, expect, it, vi, beforeEach } from 'vitest'

async function loadModule() {
  await vi.resetModules()
  return import('@/app/api/realtime/session/route')
}

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env = { ...originalEnv }
})

describe('POST /api/realtime/session', () => {
  it('returns 500 when API key is missing', async () => {
    delete process.env.OPENAI_API_KEY

    const { POST } = await loadModule()
    const response = await POST(new Request('http://localhost', { method: 'POST' }))
    const payload = (await response.json()) as { error?: string }

    expect(response.status).toBe(500)
    expect(payload.error).toContain('OPENAI_API_KEY')
  })

  it('returns realtime client secret payload on success', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENAI_REALTIME_PROMPT_ID = 'pmpt_test'

    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ client_secret: { value: 'ek_test', expires_at: '2025-01-01T00:00:00Z' } }),
          { status: 200 },
        ),
      )

    const { POST } = await loadModule()
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ voice: 'alloy' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const payload = (await response.json()) as { client_secret?: { value?: string } }

    expect(response.status).toBe(200)
    expect(payload.client_secret?.value).toBe('ek_test')

    const [, requestInit] = mockFetch.mock.calls[0]!
    const body = JSON.parse((requestInit as RequestInit).body as string)
    expect(body.session.prompt.id).toBe('pmpt_test')
    expect(body.session.audio.output.voice).toBe('alloy')
  })
})

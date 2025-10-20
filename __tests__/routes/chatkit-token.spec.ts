import { describe, expect, it, vi, beforeEach } from 'vitest'

async function loadModule() {
  await vi.resetModules()
  return import('@/app/api/chatkit/token/route')
}

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env = { ...originalEnv }
})

describe('POST /api/chatkit/token', () => {
  it('returns 500 when API key is missing', async () => {
    delete process.env.OPENAI_API_KEY

    const { POST } = await loadModule()
    const response = await POST()
    const payload = (await response.json()) as { error?: string }

    expect(response.status).toBe(500)
    expect(payload.error).toContain('OPENAI_API_KEY')
  })

  it('returns client secret payload on success', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENAI_CHATKIT_WORKFLOW_ID = 'wf_test'
    process.env.OPENAI_CHATKIT_WORKFLOW_VERSION = '1'

    const mockFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            client_secret: { value: 'secret', expires_at: '2025-01-01T00:00:00Z' },
          }),
          { status: 200 },
        ),
      )

    const { POST } = await loadModule()
    const response = await POST(new Request('http://test.local/api/chatkit/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate: { id: 'cand_x', name: 'X', role: 'Unassigned', email: 'x@example.com', recruiter: 'Alex R.' } }) }))
    const payload = (await response.json()) as { client_secret?: { value?: string } }

    expect(response.status).toBe(200)
    expect(payload.client_secret?.value).toBe('secret')

    const [, requestInit] = mockFetch.mock.calls[0]!
    expect((requestInit as RequestInit).method).toBe('POST')
    const parsed = JSON.parse((requestInit as RequestInit).body as string)
    expect(parsed).toMatchObject({
      workflow: { id: 'wf_test', version: '1' },
      user: expect.any(String),
    })
  })
})

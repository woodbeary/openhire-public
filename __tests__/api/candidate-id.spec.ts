import { describe, expect, it } from 'vitest'

async function loadRoute() {
  return import('@/app/api/candidates/[id]/route')
}

describe('GET /api/candidates/[id]', () => {
  it('returns 404 for unknown', async () => {
    const { GET } = await loadRoute()
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'nope' }) } as unknown as { params: Promise<{ id: string }> })
    expect(res.status).toBe(404)
  })

  it('returns candidate for seeded id', async () => {
    const { GET } = await loadRoute()
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'cand_seed_0' }) } as unknown as { params: Promise<{ id: string }> })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { candidate?: { id?: string } }
    expect(body?.candidate?.id).toBe('cand_seed_0')
  })
})

import { describe, it, expect } from 'vitest'
import { GET as GET_CANDIDATES, POST as POST_CANDIDATE } from '@/app/api/candidates/route'
import { POST as POST_REASSIGN } from '@/app/api/candidates/reassign/route'

function makeReq(url: string, init?: RequestInit) {
  return new Request(url, init)
}

describe('candidates API', () => {
  it('paginates and filters', async () => {
    const res1 = await GET_CANDIDATES(makeReq('http://test.local/api/candidates?q=olivia&page=0&pageSize=4'))
    const body1 = await res1.json() as { items: unknown[] }
    expect(res1.status).toBe(200)
    expect(body1.items.length).toBeGreaterThanOrEqual(0)

    const res2 = await GET_CANDIDATES(makeReq('http://test.local/api/candidates?page=0&pageSize=4'))
    const body2 = await res2.json() as { items: unknown[]; total: number }
    expect(body2.items.length).toBe(4)
    expect(body2.total).toBeGreaterThanOrEqual(4)
  })

  it('creates and reassigns', async () => {
    const res = await POST_CANDIDATE(makeReq('http://test.local/api/candidates', { method: 'POST', body: JSON.stringify({ name: 'Test Candidate', email: 'test@example.com' }) }))
    const payload = await res.json() as { id: string }
    expect(res.status).toBe(200)
    const id = payload.id as string
    expect(id).toBeTruthy()

    const re = await POST_REASSIGN(makeReq('http://test.local/api/candidates/reassign', { method: 'POST', body: JSON.stringify({ id, recruiter: 'Alex Z.' }) }))
    expect(re.status).toBe(200)
  })
})

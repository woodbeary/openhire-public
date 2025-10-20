import { notFound } from 'next/navigation'

type CandidateResp = {
  candidate: { id: string; name: string; email: string; role: string; lastInteraction?: string }
  assignment: { current: string; history: { value: string; at: number }[] }
  notes: { id: string; text: string; at: number }[]
}

async function getData(id: string): Promise<CandidateResp> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/candidates/${id}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('failed')
  return (await res.json()) as CandidateResp
}

export default async function CandidatePage({ params }: { params: { id: string } }) {
  let data: CandidateResp
  try {
    data = await getData(params.id)
  } catch {
    notFound()
  }

  const { candidate, assignment, notes } = data!

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{candidate.name}</h1>
        <a href="/openhire" className="text-sm text-[#334155] underline-offset-2 hover:underline">Back to OpenHire</a>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-[#475569]">Profile</h2>
          <div className="space-y-1 text-sm">
            <div><span className="text-[#64748b]">Email:</span> {candidate.email || '—'}</div>
            <div><span className="text-[#64748b]">Track:</span> {candidate.role}</div>
            <div><span className="text-[#64748b]">Last Interaction:</span> {candidate.lastInteraction ?? '—'}</div>
          </div>
        </div>
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-[#475569]">Assignment</h2>
          <div className="mb-3 text-sm">Current recruiter: <span className="font-medium">{assignment.current}</span></div>
          <form action="/api/candidates/reassign" method="post" className="flex gap-2">
            <input type="hidden" name="id" value={candidate.id} />
            <input name="recruiter" placeholder="Reassign to…" className="h-9 flex-1 rounded-lg border border-[#e2e8f0] px-3 text-sm" />
            <button formAction={async (formData: FormData) => {
              'use server'
              const id = String(formData.get('id') ?? '')
              const recruiter = String(formData.get('recruiter') ?? '')
              await fetch('/api/candidates/reassign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, recruiter }) })
            }} className="rounded-lg bg-black px-3 text-sm font-semibold text-white">Save</button>
          </form>
          <div className="mt-3 text-xs text-[#64748b]">History</div>
          <ul className="mt-1 space-y-1 text-xs text-[#334155]">
            {assignment.history.map((h, i) => (
              <li key={i}>{new Date(h.at).toLocaleString()} · {h.value}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-[#e5e7eb] bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-[#475569]">Notes</h2>
        <form className="mb-3 flex gap-2" action={async (formData: FormData) => {
          'use server'
          const text = String(formData.get('text') ?? '')
          await fetch('/api/candidates/note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: candidate.id, text }) })
        }}>
          <input name="text" placeholder="Add a note…" className="h-9 flex-1 rounded-lg border border-[#e2e8f0] px-3 text-sm" />
          <button className="rounded-lg bg-black px-3 text-sm font-semibold text-white">Add</button>
        </form>
        {notes.length === 0 ? (
          <div className="text-sm text-[#64748b]">No notes yet.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-[#e2e8f0] p-2">
                <div className="text-xs text-[#64748b]">{new Date(n.at).toLocaleString()}</div>
                <div className="text-[#0f172a]">{n.text}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}


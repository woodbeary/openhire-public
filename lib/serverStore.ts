export type ServerCandidate = {
  id: string
  name: string
  email: string
  role: string
  lastInteraction?: string
}

export type AssignmentLog = { value: string; at: number }

type Store = {
  candidates: ServerCandidate[]
  assignments: Record<string, { current: string; history: AssignmentLog[] }>
  notes: Record<string, { id: string; text: string; at: number }[]>
}

let store: Store | null = null

function seedCandidates(): ServerCandidate[] {
  const names = [
    'Jacob Lopez','Olivia Nguyen','Mateo Alvarez','Ayesha Patel','Liam Johnson','Emma Davis','Noah Wilson','Ava Martinez','Ethan Brown','Sophia Anderson','Mason Thomas','Mia Taylor','Logan Moore','Charlotte Jackson','Lucas White','Amelia Harris','Elijah Martin','Harper Thompson','James Garcia','Evelyn Martinez','Benjamin Clark','Abigail Lewis','Alexander Lee','Emily Walker','Michael Hall'
  ]
  return names.map((name, idx) => {
    const id = `cand_seed_${idx}`
    const email = name.toLowerCase().replace(/[^a-z]/g,'') + '@example.com'
    const roles = ['GTM Innovator Track','People Innovation Track','Mission Ops Track']
    return { id, name, email, role: roles[idx % roles.length], lastInteraction: undefined }
  })
}

export function getStore(): Store {
  if (!store) {
    const candidates = seedCandidates()
    const assignments: Store['assignments'] = {}
    for (const c of candidates) {
      assignments[c.id] = { current: 'Alex R.', history: [{ value: 'Alex R.', at: Date.now() }] }
    }
    store = { candidates, assignments, notes: {} }
  }
  return store
}


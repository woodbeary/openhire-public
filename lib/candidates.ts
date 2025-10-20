export type CandidateProfile = {
  id: string
  name: string
  role: string
  email: string
  lastInteraction?: string
}

export const candidates: CandidateProfile[] = [
  {
    id: "cand_jacob",
    name: "Jacob Lopez",
    role: "GTM Innovator Track",
    email: "jacob.lopez@example.com",
    lastInteraction: "Interview retro Oct 18, 2025",
  },
  {
    id: "cand_olivia",
    name: "Olivia Nguyen",
    role: "GTM Innovator Track",
    email: "olivia.nguyen@example.com",
    lastInteraction: "Interviewed Oct 15, 2025",
  },
  {
    id: "cand_mateo",
    name: "Mateo Alvarez",
    role: "People Innovation Track",
    email: "mateo.alvarez@example.com",
    lastInteraction: "Intro screen Oct 13, 2025",
  },
  {
    id: "cand_ayesha",
    name: "Ayesha Patel",
    role: "Mission Ops Track",
    email: "ayesha.patel@example.com",
    lastInteraction: "Panel pending Oct 20, 2025",
  },
]

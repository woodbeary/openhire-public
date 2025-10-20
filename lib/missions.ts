export type MissionId =
  | "mission_alignment"
  | "safety_mindset"
  | "execution_ownership"
  | "xf_collaboration"
  | "routing_recommendation"

export type MissionDefinition = {
  id: MissionId
  title: string
  description: string
  positivePhrases: string[]
  riskPhrases?: string[]
}

export const missionDefinitions: MissionDefinition[] = [
  {
    id: "mission_alignment",
    title: "Mission alignment",
    description: "Understands and resonates with the company mission and candidate impact.",
    positivePhrases: ["mission", "purpose", "aligned", "values", "impact"],
    riskPhrases: ["not sure", "unclear", "confused", "don't know"],
  },
  {
    id: "safety_mindset",
    title: "Safety mindset",
    description: "Demonstrates responsible handling of data, safety, or risk conversations.",
    positivePhrases: ["security", "privacy", "safety", "guardrail", "risk mitigation"],
    riskPhrases: ["danger", "risky", "ignore", "skip", "bypass"],
  },
  {
    id: "execution_ownership",
    title: "Execution ownership",
    description: "Shows end-to-end ownership and follow-through on complex projects.",
    positivePhrases: ["shipped", "delivered", "owner", "end to end", "accountable"],
    riskPhrases: ["handoff", "blocked", "stalled", "deprioritized"],
  },
  {
    id: "xf_collaboration",
    title: "Cross-functional fluency",
    description: "Collaborates effectively across product, engineering, and go-to-market teams.",
    positivePhrases: ["cross-functional", "partnered", "collaborated", "stakeholder", "align"],
    riskPhrases: ["siloed", "misaligned", "conflict", "friction"],
  },
  {
    id: "routing_recommendation",
    title: "Routing recommendation",
    description: "Hints at best-fit role or team for routing follow-ups.",
    positivePhrases: ["role", "team", "recommend", "best fit", "route", "assign"],
    riskPhrases: ["not sure where", "no idea", "unsure"],
  },
]

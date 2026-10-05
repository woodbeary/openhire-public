# OpenHire

**A recruiter copilot on OpenAI's agent stack, built over one weekend in October 2025, twelve days after AgentKit launched.**

Recruiters lose context between calls and handoffs. OpenHire keeps the interview loop in one workspace: a ChatKit thread that knows the candidate, a live checklist that ticks itself off as evidence comes up on a call, and a clean handoff to the next interviewer.

Built by [Jacob Lopez](https://jacob.com.ai), Oct 18–20, 2025. I demoed it to an OpenAI hiring manager that week.

## What it does

- **Candidate workspace.** A recruiter lane with candidates, notes, and reassignment for handoffs. See [`app/openhire`](app/openhire) and [`app/api/candidates`](app/api/candidates).
- **ChatKit with a custom widget.** A "mission checklist" widget covering mission alignment, safety mindset, execution ownership, cross-functional fluency, and a routing recommendation. Items flip as the conversation produces evidence. See [`chatkit/widgets/mission-checklist.json`](chatkit/widgets/mission-checklist.json) and [`lib/chatkit/mission-checklist.ts`](lib/chatkit/mission-checklist.ts).
- **Live calls over the Realtime API.** Ephemeral sessions over WebRTC for call capture and transcription. See [`app/api/realtime`](app/api/realtime).
- **Shared context with vector stores.** Upload resumes and transcripts once; every thread can search them. See [`app/api/vectorstore`](app/api/vectorstore).
- **Tests.** Vitest specs for the API routes and the checklist logic in [`__tests__`](__tests__).

## Stack

Next.js 15 (App Router, Turbopack) · TypeScript · `@openai/chatkit-react` · `@openai/agents` · Realtime API (WebRTC) · OpenAI vector stores · Vitest

## Run it

```bash
pnpm install
cp .env.example .env.local   # or set the variables below
pnpm dev
```

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Server-side API key |
| `OPENAI_CHATKIT_WORKFLOW_ID`, `OPENAI_CHATKIT_WORKFLOW_VERSION` | The Agent Builder workflow behind the ChatKit thread |
| `NEXT_PUBLIC_CHATKIT_DOMAIN_KEY` | ChatKit domain key for the browser |
| `OPENAI_VECTOR_STORE_ID` | Vector store for shared files |
| `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE`, `OPENAI_REALTIME_TRANSCRIPT_MODEL` | Realtime session settings |

Candidate data is mock data. The commit history is the original, from Oct 18 to Oct 20, 2025; private notes and copied API documentation were removed before publishing.

## More

This was one stop on the way to [TXT CLAW → Rotary](https://github.com/woodbeary/rotary): always-on agents you text, shipped in February 2026.

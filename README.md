## OpenHire (working title)

We are preparing a recruiter-facing experience that feels native to OpenAI’s internal **OpenHouse** tooling while specializing in interview loops. Nothing is wired up yet—this document captures what we are aiming to build over the weekend.

### What we are going to build

- **OpenHire workspace**: a left-rail entry inside an OpenHouse-inspired shell that opens a dedicated recruiter lane without adding another dashboard.
- **Recruiter copilot thread**: powered by OpenAI’s October 2025 stack (ChatKit, Agents SDK, Responses API, Document Search, Realtime). It will ingest transcripts, emails, resumes, and produce evidence-first summaries, role-fit suggestions, and curated handoffs.
- **Live signal checklist**: five OpenAI mission prompts (mission alignment, safety mindset, execution ownership, cross-functional fluency, routing recommendation) that update in real time when evidence is found.
- **Role routing + handoffs**: surface top-three internal landing spots and spin up a fresh, share-safe chat thread for the next interviewer so private notes stay private.
- **Context budget + privacy controls**: codex-style token gauge, explicit “ephemeral mode,” and data-retention tooling so recruiters feel confident experimenting without polluting canonical candidate context.

### Near-term to-do list

1. Recreate the OpenHouse look & feel (layout, off-canvas sources panel, keyboard affordances) as static scaffolding.
2. Integrate ChatKit (hosted) with our Next.js App Router setup using pnpm and Turbopack.
3. Prototype the recruiter flow end-to-end with mocked data (emails lost, handoff gaps, role recommendations).
4. Add Agents SDK + Responses API integration, including tracing and an initial eval suite for summaries.
5. Layer in optional Realtime WebRTC capture and the codex-style context budget meter.

### Getting started (dev environment)

```bash
pnpm install
pnpm dev        # Turbopack-enabled dev server
```

The app currently renders the default Next.js starter screen. All functionality listed above is still ahead of us.

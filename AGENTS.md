# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts the Next.js App Router surface; global chrome lives in `app/layout.tsx`, while the hosted ChatKit experience sits in `app/openhire/page.tsx`.  
- `app/api/chatkit/` and future `realtime` endpoints mint client secrets for hosted AgentKit flows.  
- Shared UI resides in `components/`, domain helpers in `lib/`, and static assets in `public/`.  
- Product planning artifacts stay in `plan.md` and research context in `README.md`/`transcript.md`; keep them updated as features ship.

## Build, Test, and Development Commands
- `pnpm dev` — launches the Turbopack dev server at `http://localhost:3000`.  
- `pnpm build` — produces an optimized Next.js build with Turbopack.  
- `pnpm start` — serves the production build locally.  
- `pnpm lint` — runs ESLint using the project config (TypeScript + Next rules). Add scripts for tests as they come online.

## Coding Style & Naming Conventions
- Use TypeScript with strict typing; prefer functional React components in PascalCase (e.g., `OpenHireShell`).  
- Keep modules small: route handlers in `app/api/*`, UI primitives under `components/ui/`, domain logic in `lib/`.  
- Styling uses Tailwind v4 tokens in `app/globals.css`; favor utility classes over ad hoc CSS.  
- Run `pnpm lint` before commits to enforce ESLint/TypeScript guidelines.

## Testing Guidelines
- Snapshot and interaction tests (Playwright or Vitest + React Testing Library) should live under `__tests__/` mirroring their source path.  
- Name specs `<component>.spec.tsx` or `<feature>.e2e.ts`.  
- Target critical flows first: ChatKit session loader, hosted token API, and realtime session broker. Document coverage expectations in `plan.md` as suites mature.

## Commit & Pull Request Guidelines
- Follow imperative, scope-aware commit messages (e.g., `feat(chatkit): add widget action bridge`). Squash trivial fixups locally.  
- PRs must include: purpose summary, screenshots or screen recordings for UI shifts, list of new env vars, and verification steps (`pnpm dev`, `pnpm lint`, relevant tests).  
- Link to plan items or issues when available and call out pending follow-up work under a **Next Steps** heading.

## Agent & Realtime Configuration Tips
- Store secrets in `.env.local` using keys documented in `README.md`. Never commit API keys or client secrets.  
- Capture workflow IDs, prompt IDs, and widget JSON in the PR description so reviewers can replay AgentKit scenarios quickly.

## Agents & Workflow Architecture
- **Workflow source** lives in `lib/agentkit/workflow.ts`. It mirrors the published Agent Builder graph but adds repo-owned logic (mission checklist bridge, system context injection). All workflow updates should originate here and be promoted through the platform.
- **Mission checklist pipeline**: agents call the `openhire.mission_update` tool (implemented with the Agents SDK `tool()` helper). The runner accumulates each call into `missionUpdates` and returns it alongside the agent response. The ChatKit widget action handler (`app/openhire/page.tsx`) merges those updates with the realtime transcript heuristics so the Insights “Mission alignment” rail stays authoritative.
- **Widget/action surface**: hosted ChatKit exposes an `openhire.run_workflow` action. The client relays candidate + vector store identifiers to `/api/chatkit/workflow`, which in turn runs `runWorkflow`. When widgets are added (mission checklist, role routing, handoff), keep the JSON in `chatkit/` and update this doc with IDs.
- **Mission checklist widget**: base JSON design lives in `chatkit/widgets/mission-checklist.json`; runtime assembly happens in `lib/chatkit/mission-checklist.ts`. Workflow runs return the rendered widget (`kind: "mission-checklist"`), and the client forwards it back into ChatKit via the `openhire.widgets.upsert` custom action so the thread mirrors the Insights rail.
- **Retrieval context**: `/api/vectorstore/sources` filters by `attributes.candidate`. Any new tools (e.g., `ingest_email`) should honor this contract and use the same attribute key so Insights can stay scoped per candidate.
- **Realtime capture**: `/api/realtime/webrtc` issues WebRTC calls with transcription-only VAD. Client-side diarization tags lines as “candidate” or “recruiter”; future realtime diarization support can replace the heuristic without touching Agents integration.

## OpenHire (working title)

We are preparing a recruiter-facing experience that feels native to OpenAI’s internal **OpenHouse** tooling while specializing in interview loops. The OpenHouse shell (left navigation, ICYMI feed, off-canvas sources rail) is now scaffolded in Next.js, and the `OpenHire` entry points to a dedicated route where ChatKit will live. Everything else in this document captures the functionality we are going to layer on next.

### What we are going to build

- **OpenHire workspace**: a left-rail entry inside an OpenHouse-inspired shell that opens a dedicated recruiter lane without adding another dashboard.
- **Recruiter copilot thread**: powered by OpenAI’s October 2025 stack (ChatKit, Agents SDK, Responses API, Document Search, Realtime). It will ingest transcripts, emails, resumes, and produce evidence-first summaries, role-fit suggestions, and curated handoffs.
- **Live signal checklist**: five OpenAI mission prompts (mission alignment, safety mindset, execution ownership, cross-functional fluency, routing recommendation) that update in real time when evidence is found.
- **Role routing + handoffs**: surface top-three internal landing spots and spin up a fresh, share-safe chat thread for the next interviewer so private notes stay private.
- **Context budget + privacy controls**: codex-style token gauge, explicit “ephemeral mode,” and data-retention tooling so recruiters feel confident experimenting without polluting canonical candidate context.

### Near-term to-do list

1. Finish polishing the OpenHouse look & feel (layout nits, off-canvas sources panel, keyboard affordances) as static scaffolding.
2. Integrate ChatKit (hosted) with our Next.js App Router setup using pnpm and Turbopack.
3. Prototype the recruiter flow end-to-end with mocked data (emails lost, handoff gaps, role recommendations).
4. Add Agents SDK + Responses API integration, including tracing and an initial eval suite for summaries.
5. Layer in optional Realtime WebRTC capture and the codex-style context budget meter.

### Stack snapshot (2025 releases we rely on)

- **Next.js 15 App Router + Turbopack** (pnpm) for the UI shell.
- **ChatKit (hosted)** for the recruiter copilot thread, widgets, and sharing primitives.
- **Responses API + Agents SDK** for tool calling, tracing, and document search.
- **Realtime API (WebRTC + ephemeral token flow)** for the record button / live transcript nudge mode.
- **OpenAI Evals + Traces dashboards** to monitor summarisation faithfulness and routing quality as we iterate.

### AgentKit / ChatKit research digest (Oct 18, 2025)

- **AgentKit rollout**: On October 6 2025 OpenAI introduced AgentKit, bundling Agent Builder for visual multi-agent workflows, the Connector Registry for governed data access, and ChatKit for embeddable agent UIs—ChatKit and the new eval tooling are GA, while Agent Builder and Connector Registry remain beta-gated.citeturn3view0
- **ChatKit integration updates**: The ChatKit starter still loads `https://cdn.platform.openai.com/deployments/chatkit/chatkit.js`, fetches a hosted session via `openai.chatkit.sessions.create(...)`, and recommends the React bindings for advanced lifecycle hooks—mirroring our `/openhire` loader.citeturn2view0
- **Realtime API GA**: OpenAI’s August 28 2025 announcement brought the GPT‑4o speech stack to general availability with WebRTC/WebSocket transports, tool-calling support, and updated token pricing, making it a good fit for our recorder toggle.citeturn1view0

### Integration blueprint (fast path for our demo)

- **Workflow & prompt identifiers**
  - Agent Builder workflow: `wf_YOUR_WORKFLOW_ID` (published as `agent_workflow_published`, version `1`).
  - Realtime prompt: `pmpt_68f3f95fe12881938330a6c1da11164205cd59d72d9491bd` (pair with `gpt-realtime-mini-2025-10-06`, optional `version: "1"` in session payloads).
  - Transcript model for live captions: `whisper-1`. Keep these IDs in `.env.local` for local dev and rotate via secrets manager in prod.
- **Backend endpoints**
  - `/api/chatkit/session`: POST → `openai.chatkit.sessions.create({ workflow: { id, version }, user, attributes })`, return `client_secret`. Keep the `OpenAI-Beta: chatkit_beta=v1` header until docs say otherwise.citeturn2view0
  - `/api/realtime/session`: POST → `openai.realtime.client_secrets.create({ session: { type: "realtime", model: "gpt-realtime-mini", audio: { output: { voice } }, prompt: { id: PROMPT_ID } } })`, return `value` to browser for WebRTC. Reuse when we add push-to-talk.citeturn1view0
  - `/api/chatkit/workflow`: POST `{ message }` to execute the AgentKit workflow server-side for widgets or scripted actions.
  - `/api/widget-action`: POST handler for ChatKit `widgets.onAction` payloads so checklist buttons can patch candidate state.

- **Frontend mount**
  - Add `<script src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js" async></script>` in `app/openhire/layout.tsx` head.
  - In `/openhire` route use `@openai/chatkit-react`:
    ```tsx
    const { control } = useChatKit({
      api: {
        async getClientSecret(existing) {
          const endpoint = existing ? "/api/chatkit/session?refresh=1" : "/api/chatkit/session";
          const res = await fetch(endpoint, { method: "POST" });
          const { client_secret } = await res.json();
          return client_secret;
        },
      },
      widgets: { onAction: forwardWidgetAction },
      theme: recruiterTheme,
      composer: {
        placeholder: "Ask OpenHire to prep you for Jacob’s loop…",
        attachments: { uploadStrategy: { type: "hosted" }, maxSize: 20 * 1024 * 1024, maxCount: 3 },
      },
    });
    ```
  - Render `<ChatKit control={control} className="h-full w-full" />`; hide the default header and history once we supply our own chrome.

- **Agent Builder handshake**
  - In Agent Builder, publish the recruiter workflow and capture `{ workflowId, version }`.
  - Configure nodes: Start → Transcript ingest (File Search / MCP) → Evidence extractor → Role recommender → Widget renderer (Card/List). Add guardrail node before widget emit for prompt injection defense.
  - Export widget JSON from ChatKit Studio for: five-mission checklist (ListView+Badge), role-fit card (Card+Button.onClickAction), handoff CTA (Button → `handoff` action).

- **Realtime “mini” stream**
  - Browser obtains ephemeral key via `/api/realtime/session`, then:
    ```ts
    const pc = new RTCPeerConnection();
    const dc = pc.createDataChannel("oai-events");
    dc.onmessage = handleRealtimeEvent;
    await attachMicTrack(pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const answer = await fetch("/api/realtime/session", {
      method: "POST",
      body: offer.sdp,
      headers: { "Content-Type": "application/sdp" },
    });
    await pc.setRemoteDescription({ type: "answer", sdp: await answer.text() });
    ```
  - Send `session.update` with `{ type: "realtime", model: "gpt-realtime-mini", prompt: { id: PROMPT_ID }, audio: { output: { voice: "marin" } } }`.
  - When the recruiter taps “Record”, call `pc.addTrack(stream.getAudioTracks()[0])`; on stop, remove track and send `input_audio_buffer.commit` if VAD is disabled.

- **Widget / action loop**
  - Serve widget payloads from `/api/chatkit/widgets` so Agent Builder can push updates without redeploying.
  - Handle `ActionConfig` payloads server-side: `type: "mark_checklist"` updates in-memory candidate JSON; `type: "handoff"` triggers Agents SDK tool that mints a new ChatKit thread for the hiring manager.

- **Prompt + guardrails**
  - Store recruiter prompt (`pmpt_*`) in platform. Include sections: Mission signals checklist, Role recommendation rubric, Handoff policy, Privacy modes.
  - Add guardrail node in workflow to redact emails/PII before they hit widgets; fallback to summary if guardrail fails.

- **Telemetry**
  - Enable Traces in Agents SDK (`trace: true`) so we can show the decision graph.
  - Use Evals quickstart template to score summaries vs. transcript references (faithfulness) ahead of Monday demo.

### Environment

Add the following variables to `.env.local` (or your preferred secrets manager):

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-side key used to mint ChatKit client secrets. |
| `OPENAI_CHATKIT_WORKFLOW_ID` *(optional)* | Workflow bound to the ChatKit session. Defaults to the published `agent_workflow_published` ID provided by Jacob. |
| `OPENAI_CHATKIT_WORKFLOW_VERSION` *(optional)* | Workflow version, default `1`. |
| `OPENAI_BASE_URL` *(optional)* | Override if you proxy requests through a gateway. Defaults to `https://api.openai.com`. |
| `NEXT_PUBLIC_CHATKIT_SCRIPT_URL` *(optional)* | Custom CDN URL for the ChatKit bundle. Defaults to OpenAI’s hosted `https://cdn.platform.openai.com/deployments/chatkit/chatkit.js`. |
| `OPENAI_REALTIME_MODEL` *(optional)* | Realtime model identifier. Defaults to `gpt-realtime-mini-2025-10-06`. |
| `OPENAI_REALTIME_PROMPT_ID` *(optional)* | Prompt ID applied to realtime sessions (e.g. recruiter voice agent). |
| `OPENAI_REALTIME_PROMPT_VERSION` *(optional)* | Prompt version for realtime sessions. Defaults to `1`. |
| `OPENAI_REALTIME_TRANSCRIPT_MODEL` *(optional)* | Model used for transcription (default `whisper-1`). |
| `OPENAI_REALTIME_VOICE` *(optional)* | Preferred voice for realtime audio responses (`marin`, `verse`, etc.). |

### Getting started (dev environment)

```bash
pnpm install
pnpm dev        # Turbopack-enabled dev server
```

The default route mirrors the OpenHouse UI. The `/openhire` route now mounts a full-screen ChatKit surface; provide the environment variables above to see it connect in hosted mode.

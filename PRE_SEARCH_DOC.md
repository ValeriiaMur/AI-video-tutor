# Pre-Search Document: Live AI Video Tutor
## Low-Latency Socratic Teaching Avatar

**Date:** March 9, 2026
**Status:** Decision-locked, ready for implementation

---

## 1. Project Summary

Build an AI video avatar tutor that teaches neural network concepts (backpropagation intuition) to grades 6-12 students using the Socratic method, with sub-second end-to-end response latency and a custom 3D avatar.

## 2. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Architecture | Composable streamed pipeline | Best control over per-stage latency while shipping fast |
| Avatar | Custom Three.js character (hand-crafted) | Unique, full control, no vendor dependency (RPM shut down) |
| Input modality | Voice-first | Most natural conversational feel, matches "not chatbot-like" requirement |
| Demo subject | AI / How neural networks learn | Great Socratic fit, scalable across grade bands |
| LLM | Claude 3.5 Haiku (streaming) | Fast TTFT (~300ms), strong instruction following for Socratic prompts |
| STT | Deepgram Nova-2 (WebSocket streaming) | Industry-leading streaming latency ~100-150ms, excellent VAD |
| TTS | ElevenLabs Turbo v2 (WebSocket streaming) | Best quality + latency combo, ~100-200ms first byte |
| Lip-sync | Viseme-based from TTS metadata | Most accurate sync for ±80ms requirement |
| Deployment | Vercel (Next.js native) | Edge functions, free tier, WebSocket via Edge Runtime |
| Cost target | <$0.10 per 5-min session | Aggressive caching, short responses, sliding window context |
| Benchmark gate | Yes — prove latency closes before full build | Brief explicitly recommends this approach |
| Context management | Sliding window (last 5-8 exchanges) | Simple, predictable token usage, fast |
| Testing | Comprehensive (15+ tests, target bonus points) | Unit + integration + E2E + latency benchmarks |
| Timeline | 1 week (aggressive) | Composable pipeline approach makes this feasible |
| Framework | Next.js + TypeScript + Tailwind CSS | User preference, Vercel-native |

## 3. Technology Stack

### Frontend
- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Three.js** + custom glTF model with viseme blendshapes
- **Web Audio API** for microphone capture and audio playback
- **WebSocket client** for streaming pipeline communication

### Backend (Next.js API Routes / Edge Functions)
- **Deepgram SDK** — WebSocket streaming STT
- **Anthropic SDK** — Claude 3.5 Haiku streaming
- **ElevenLabs SDK** — WebSocket streaming TTS with alignment data
- **WebSocket server** — orchestrates the full pipeline

### Infrastructure
- **Vercel** — hosting, edge functions, serverless
- **Environment variables** — API keys for Deepgram, Anthropic, ElevenLabs

## 4. Pipeline Architecture

```
[Microphone] → [VAD/Endpointing] → [Deepgram STT] → [Claude Haiku] → [ElevenLabs TTS] → [Three.js Avatar]
     |              |                     |                |                |                    |
     |         detect speech          stream text      stream tokens    stream audio+visemes  render frames
     |           end                                                                              |
     └────────────────────────────────── latency measurement at every stage ──────────────────────┘
```

**Critical principle:** The pipeline MUST be streamed end-to-end. LLM output streams into TTS, TTS streams into avatar renderer. No sequential execution.

### Per-Stage Latency Budget

| Stage | Target | Max | Our Stack |
|---|---:|---:|---|
| Speech-to-text | <150ms | <300ms | Deepgram Nova-2 (~100-150ms) |
| LLM TTFT | <200ms | <400ms | Claude 3.5 Haiku (~300ms with caching) |
| TTS first byte | <150ms | <300ms | ElevenLabs Turbo v2 (~100-200ms) |
| Avatar render | <100ms | <200ms | Three.js client-side (<50ms) |
| Network + overhead | <50ms | <100ms | Vercel Edge (~30-50ms) |
| **Total E2E** | **<500ms** | **<1000ms** | **~580-750ms estimated** |

## 5. Avatar Design: Custom Three.js Character

### Approach
- Source a stylized low-poly humanoid model from Sketchfab with facial blendshapes
- Alternatively, create in VRoid Studio and export as VRM
- Load via GLTFLoader in Three.js
- Drive viseme blendshapes from ElevenLabs alignment data
- Three states: **listening** (subtle idle animation), **thinking** (visual cue), **speaking** (lip-sync active)

### Lip-Sync Implementation
1. ElevenLabs streams audio chunks with alignment/timing metadata
2. Map phonemes → visemes (standard 15 viseme set)
3. Update `morphTargetInfluences` on the mesh each frame
4. Smooth interpolation between visemes using delta timing
5. Target: ±80ms sync (±45ms for bonus)

### Libraries
- **three** — core 3D rendering
- **@pixiv/three-vrm** — VRM model support (if using VRM format)
- **TalkingHead** patterns — reference implementation for browser lip-sync

## 6. Socratic Method Implementation

### System Prompt Strategy
- Grade-level adaptive prompting (6-8, 9-10, 11-12 bands)
- Never give direct answers — always respond with a guiding question
- Scaffold understanding through smaller sub-questions
- Redirect wrong answers gently ("What if we think about it this way...")
- When student is right, ask "Can you explain why?"
- Keep responses SHORT (2-3 sentences max) for latency budget
- End every turn with a question that advances understanding

### Demo Script: Neural Networks / Backpropagation
1. **Hook:** "Have you ever wondered how a computer can learn to recognize a cat in a photo?"
2. **Concept 1:** What is a neural network? (pattern matching analogy)
3. **Concept 2:** How does it learn from mistakes? (backpropagation intuition)
4. **Concept 3:** Why does practice make it better? (gradient descent as "adjusting")

### Grade-Level Adaptation
- **Grades 6-8:** "Imagine a team of friends passing notes..." (concrete analogies)
- **Grades 9-10:** Introduce terms like "weights" and "error signal"
- **Grades 11-12:** Discuss partial derivatives conceptually, chain rule intuition

## 7. Benchmark Gate Plan

**Before building the full stack**, prove each stage meets its budget:

### Gate 1: STT Latency (Day 1)
- Connect to Deepgram WebSocket with test audio
- Measure: time from audio chunk sent → first transcript token received
- Pass criteria: <300ms (max acceptable)

### Gate 2: LLM TTFT (Day 1)
- Stream a Socratic prompt to Claude 3.5 Haiku
- Measure: time from request → first token
- Test with prompt caching enabled
- Pass criteria: <400ms (max acceptable)

### Gate 3: TTS First Byte (Day 1)
- Stream text to ElevenLabs WebSocket
- Measure: time from text sent → first audio byte received
- Pass criteria: <300ms (max acceptable)

### Gate 4: End-to-End (Day 2)
- Chain all three with a simple WebSocket relay
- Measure: total time from audio input end → first audio output byte
- Pass criteria: <1000ms (max acceptable)

**If any gate fails:** investigate alternatives before proceeding.

## 8. Cost Analysis

### Per-Session Estimate (5-minute session, ~15 exchanges)

| Service | Usage | Cost |
|---|---|---|
| Deepgram STT | ~5 min audio | $0.039 |
| Claude 3.5 Haiku | ~3K input + 1.5K output tokens | $0.008 |
| ElevenLabs TTS | ~3,000 characters | $0.018 |
| **Total per session** | | **~$0.065** |

✅ Under $0.10 target.

### Optimization Levers
- Prompt caching (up to 90% cost reduction on Haiku)
- Short Socratic responses (2-3 sentences = fewer tokens)
- Sliding window context (cap token growth)
- ElevenLabs character count optimization (concise tutor responses)

## 9. Testing Strategy (15+ Tests)

### Unit Tests (8)
1. STT stream processing and transcript assembly
2. LLM Socratic prompt — response ends with question
3. LLM grade-level adaptation — vocabulary check
4. TTS audio chunk assembly
5. Viseme mapping from phoneme data
6. Latency timer accuracy
7. Sliding window context management
8. Session state management

### Integration Tests (5)
9. STT → LLM streaming handoff
10. LLM → TTS streaming handoff
11. TTS → Avatar viseme sync pipeline
12. Full pipeline end-to-end flow
13. WebSocket connection lifecycle

### E2E / Benchmark Tests (4)
14. End-to-end latency under 1 second
15. Lip-sync alignment within ±80ms
16. Full conversation loop (3 exchanges)
17. Latency variance / consistency check

## 10. AI Observability

### Per-Request Metrics
- `stt_latency_ms` — Deepgram transcript time
- `llm_ttft_ms` — Claude time to first token
- `llm_total_ms` — Claude full response time
- `tts_ttfb_ms` — ElevenLabs time to first audio byte
- `tts_total_ms` — ElevenLabs full audio time
- `avatar_render_ms` — Three.js frame render time
- `e2e_latency_ms` — Total end-to-end
- `lip_sync_offset_ms` — Audio/visual sync delta

### Session Metrics
- `total_exchanges` — Number of Q&A turns
- `concepts_covered` — Topics discussed
- `socratic_score` — % of tutor turns ending with a question
- `avg_response_length` — Token count per response
- `session_cost_usd` — Running cost calculation

### Dashboard
- Real-time latency waterfall visualization
- Per-stage breakdown chart
- Session quality scorecard
- Cost tracking

## 11. Project Structure

```
ai-video-tutor/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Main tutor interface
│   │   ├── layout.tsx          # Root layout
│   │   └── api/
│   │       └── tutor/
│   │           └── route.ts    # WebSocket upgrade endpoint
│   ├── components/
│   │   ├── TutorAvatar.tsx     # Three.js 3D avatar component
│   │   ├── TutorSession.tsx    # Main session orchestrator
│   │   ├── VoiceInput.tsx      # Microphone + VAD
│   │   ├── LatencyDashboard.tsx # Real-time metrics display
│   │   └── SubjectSelector.tsx  # Grade + topic picker
│   ├── lib/
│   │   ├── pipeline/
│   │   │   ├── stt.ts          # Deepgram STT client
│   │   │   ├── llm.ts          # Claude Haiku streaming
│   │   │   ├── tts.ts          # ElevenLabs streaming
│   │   │   └── orchestrator.ts # Pipeline coordinator
│   │   ├── avatar/
│   │   │   ├── loader.ts       # glTF/VRM model loader
│   │   │   ├── visemes.ts      # Viseme mapping + interpolation
│   │   │   └── states.ts       # Listening/thinking/speaking states
│   │   ├── prompts/
│   │   │   ├── socratic.ts     # Socratic method system prompts
│   │   │   └── grading.ts      # Grade-level adaptation
│   │   ├── metrics/
│   │   │   ├── latency.ts      # Per-stage latency tracking
│   │   │   ├── session.ts      # Session-level metrics
│   │   │   └── observer.ts     # AI observability system
│   │   └── context/
│   │       └── window.ts       # Sliding window context manager
│   ├── hooks/
│   │   ├── useAudioCapture.ts  # Microphone hook
│   │   ├── useWebSocket.ts     # WS connection hook
│   │   └── useTutorSession.ts  # Session state hook
│   └── types/
│       └── index.ts            # Shared TypeScript types
├── __tests__/                  # Test suite (15+ tests)
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── public/
│   └── models/                 # 3D avatar model files
├── docs/
│   ├── LATENCY_ANALYSIS.md
│   ├── ARCHITECTURE.md
│   └── OPTIMIZATION_LOG.md
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── jest.config.ts
├── package.json
└── README.md
```

## 12. Implementation Schedule (1 Week)

| Day | Focus | Deliverable |
|---|---|---|
| 1 | Benchmark gate: prove all 4 stages meet latency budget | Pass/fail report for each stage |
| 2 | Pipeline: STT→LLM→TTS streaming chain + WebSocket orchestrator | Working audio-in → audio-out pipeline |
| 3 | Avatar: Three.js character + viseme lip-sync + states | Animated 3D tutor speaking with lip-sync |
| 4 | UI: Next.js frontend + session flow + Socratic prompts | Complete tutoring interface |
| 5 | Testing: 15+ tests + latency benchmarking framework | Full test suite passing |
| 6 | Observability + documentation + optimization | Dashboard, README, analysis docs |
| 7 | Demo video recording + polish + final QA | 1-5 min demo video, submission-ready |

## 13. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| ElevenLabs doesn't provide viseme data in streaming | Lip-sync accuracy degrades | Fallback to audio-driven lip-sync (amplitude analysis) |
| Claude Haiku TTFT exceeds 400ms | E2E budget blown | Enable prompt caching, reduce system prompt size, test Groq as backup |
| Three.js model without proper blendshapes | No lip-sync possible | Pre-validate model blendshapes before committing, have backup VRoid model |
| Vercel WebSocket limitations | Pipeline can't stream properly | Use Vercel Edge Runtime or fallback to Railway/Fly.io |
| 1-week timeline too aggressive | Incomplete submission | Prioritize: benchmark gate → pipeline → avatar → tests → docs |

## 14. Open Research Questions (From Brief)

1. **Which stage is the main bottleneck?** → Benchmark gate will reveal this Day 1
2. **Which optimizations matter most?** → Prompt caching (LLM), streaming chunking (TTS), client-side rendering (avatar)
3. **What does this cost at scale?** → $0.065/session × 1000 sessions/day = ~$65/day = ~$1,950/month
4. **Which avatar stack stays under 100ms?** → Client-side Three.js (target <50ms)

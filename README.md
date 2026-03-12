# Teach Me Like I'm 5 — AI Video Tutor

A real-time AI video avatar tutor that teaches any topic through the Socratic method. Features a unique **Wisdom Orb** — a glowing, morphing crystal character powered by Three.js that responds to speech with lip-synced animation, emotional states, and particle effects.

<img width="726" height="832" alt="Screenshot 2026-03-12 at 10 26 25 AM" src="https://github.com/user-attachments/assets/65781f35-b9ba-4bfb-a77f-59da456156e8" />
<img width="1648" height="860" alt="Screenshot 2026-03-12 at 10 26 51 AM" src="https://github.com/user-attachments/assets/5bf9f8d3-c726-429a-b20e-6017af9e716d" />


## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Add your API keys to .env.local

# Run in development (works without API keys using mock mode)
npm run dev

# Run tests
npm test
```

Open [http://localhost:3000](http://localhost:3000), type a topic, and start learning.

## Architecture

### Streaming Pipeline

```
[Microphone] → [Deepgram STT] → [Claude Haiku] → [ElevenLabs TTS] → [Wisdom Orb Avatar]
                 ~150ms             ~200ms TTFT        ~150ms TTFB        <50ms render
```

All stages stream in parallel — LLM tokens flow into TTS as they arrive, and TTS audio flows into the avatar renderer. No sequential waiting.

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14 + TypeScript + Tailwind | App framework |
| 3D Avatar | Three.js + Custom Shaders | Wisdom Orb with lip-sync |
| STT | Deepgram Nova-2 (WebSocket) | Voice → text, <150ms |
| LLM | Claude 3.5 Haiku (streaming) | Socratic tutoring, <200ms TTFT |
| TTS | ElevenLabs Turbo v2 (WebSocket) | Text → speech, <150ms TTFB |
| Deployment | Vercel | Edge functions, free tier |

### Latency Budget

| Stage | Target | Max Acceptable |
|-------|--------|---------------|
| Speech-to-text | <150ms | <300ms |
| LLM time to first token | <200ms | <400ms |
| TTS first byte | <150ms | <300ms |
| Avatar rendering | <100ms | <200ms |
| **End-to-end total** | **<500ms** | **<1000ms** |

## Features

### The Wisdom Orb

A procedurally animated 3D crystal orb that:
- **Glows purple** when idle, **teal** when listening, **gold** when thinking, **bright purple** when speaking
- **Morphs shape** using simplex noise displacement — more dramatic when speaking
- **Lip-syncs** via viseme-driven mouth deformation from TTS alignment data
- **Orbiting particles** that speed up/slow down based on state
- **Custom GLSL shaders** for fresnel edge glow and inner crystalline light

### Socratic Method

The tutor (named "Lumi") never gives direct answers. Instead:
- Asks guiding questions that scaffold understanding
- Adapts vocabulary and complexity to grade level (6-8, 9-10, 11-12)
- Redirects wrong answers gently
- Asks "why?" when students answer correctly
- Always ends responses with a question

### Observability

Real-time metrics dashboard showing:
- Per-stage latency waterfall (STT, LLM TTFT, TTS TTFB, Avatar render)
- End-to-end latency with pass/fail indicators against budget
- Session statistics (exchanges, Socratic score, concepts covered, cost)
- Full event export as JSON for post-session analysis

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Topic selection landing page
│   ├── layout.tsx                # Root layout
│   └── api/
│       ├── tutor/route.ts        # LLM proxy endpoint
│       └── benchmark/route.ts    # Latency benchmark endpoint
├── components/
│   ├── WisdomOrb.tsx             # Three.js 3D avatar (custom shaders)
│   ├── TutorSession.tsx          # Main session orchestrator UI
│   └── LatencyDashboard.tsx      # Real-time metrics display
├── lib/
│   ├── pipeline/
│   │   ├── stt.ts                # Deepgram STT client
│   │   ├── llm.ts                # Claude Haiku streaming client
│   │   ├── tts.ts                # ElevenLabs streaming client
│   │   └── orchestrator.ts       # Pipeline coordinator
│   ├── avatar/
│   │   ├── visemes.ts            # Viseme mapping & interpolation
│   │   └── states.ts             # Avatar state machine
│   ├── prompts/
│   │   └── socratic.ts           # Socratic system prompt builder
│   ├── metrics/
│   │   ├── latency.ts            # Per-stage latency tracking
│   │   ├── session.ts            # Session metrics aggregator
│   │   └── observer.ts           # AI observability system
│   └── context/
│       └── window.ts             # Sliding window context manager
└── types/
    └── index.ts                  # TypeScript type definitions

__tests__/
├── unit/                         # 23 unit tests
│   ├── latency.test.ts           # Latency tracker & budget checks
│   ├── socratic.test.ts          # Socratic prompt system
│   ├── visemes.test.ts           # Viseme mapping & avatar state
│   ├── context.test.ts           # Context window & session metrics
│   ├── observer.test.ts          # AI observability
│   └── tts.test.ts               # TTS phoneme mapping
└── integration/                  # 5 integration tests
    └── pipeline.test.ts          # Full pipeline flow with mocks
```

## Testing

28+ tests covering unit, integration, and pipeline flow:

```bash
npm test              # Run all tests
npm test -- --verbose # Detailed output
npm run test:coverage # With coverage report
```

### Test Categories

| Category | Count | What's tested |
|----------|-------|---------------|
| Latency tracking | 8 | Timer accuracy, budget checks, statistics |
| Socratic prompts | 4 | Grade adaptation, question detection |
| Viseme/Avatar | 7 | Viseme mapping, interpolation, state machine |
| Context management | 4 | Sliding window, token estimation |
| Observability | 5 | Event logging, subscriptions, export |
| Pipeline integration | 5 | Full flow, event ordering, metrics |

## Configuration

### Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...      # Claude Haiku access
DEEPGRAM_API_KEY=...              # Deepgram Nova-2 STT
ELEVENLABS_API_KEY=...            # ElevenLabs TTS
ELEVENLABS_VOICE_ID=...           # Optional: custom voice
```

### Mock Mode

The app runs fully in mock mode without any API keys — useful for development, testing, and demos. Toggle it on the landing page.

## Cost Analysis

Per 5-minute session (~15 exchanges):

| Service | Usage | Cost |
|---------|-------|------|
| Deepgram STT | ~5 min audio | $0.039 |
| Claude Haiku | ~3K in + 1.5K out tokens | $0.008 |
| ElevenLabs TTS | ~3,000 characters | $0.018 |
| **Total** | | **~$0.065** |

## Optimization Strategies

1. **Prompt caching** — Up to 90% cost/latency reduction on Claude
2. **Streaming pipeline** — LLM tokens → TTS → Avatar, no sequential waits
3. **Short responses** — Socratic style naturally produces 2-3 sentence responses
4. **Client-side avatar** — Zero server-side render latency
5. **Sliding window context** — Bounded token growth per exchange

## Limitations

- Voice input requires microphone permission and modern browser
- ElevenLabs alignment data may not include per-phoneme visemes in all modes (audio-driven fallback available)
- Claude Haiku TTFT varies by load; prompt caching recommended for production
- WebSocket connections may not work in all Vercel deployment configs (Edge Runtime required)
- 3D avatar performance depends on client GPU

## License

MIT

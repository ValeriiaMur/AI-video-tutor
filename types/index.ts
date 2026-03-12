// ============================================================
// Core Types for AI Video Tutor - "Teach Me Like I'm 5"
// ============================================================

// --- Avatar States ---
export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

// --- Viseme Types (standard 15 viseme set) ---
export type Viseme =
  | 'sil'  // silence
  | 'PP'   // p, b, m
  | 'FF'   // f, v
  | 'TH'   // th
  | 'DD'   // t, d
  | 'kk'   // k, g
  | 'CH'   // ch, j, sh
  | 'SS'   // s, z
  | 'nn'   // n, l
  | 'RR'   // r
  | 'aa'   // a
  | 'E'    // e
  | 'I'    // i
  | 'O'    // o
  | 'U';   // u

// --- Grade Levels ---
export type GradeLevel = 'elementary' | 'middle' | 'high';
export type GradeBand = '6-8' | '9-10' | '11-12';

// --- Session Types ---
export interface TutorSession {
  id: string;
  topic: string;
  gradeLevel: GradeBand;
  exchanges: Exchange[];
  metrics: SessionMetrics;
  startedAt: number;
  conceptsCovered: string[];
  state: SessionState;
}

export type SessionState = 'setup' | 'active' | 'paused' | 'ended';

export interface Exchange {
  id: string;
  studentInput: string;
  tutorResponse: string;
  timestamp: number;
  latencyBreakdown: LatencyBreakdown;
}

// --- Pipeline Types ---
export interface PipelineConfig {
  stt: STTConfig;
  llm: LLMConfig;
  tts: TTSConfig;
  avatar: AvatarConfig;
}

export interface STTConfig {
  provider: 'deepgram';
  model: string;
  language: string;
  sampleRate: number;
  encoding: string;
  endpointingMs: number;
}

export interface LLMConfig {
  provider: 'anthropic';
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

export interface TTSConfig {
  provider: 'elevenlabs';
  voiceId: string;
  model: string;
  outputFormat: string;
  optimizeStreamingLatency: number;
}

export interface AvatarConfig {
  type: 'wisdom-orb';
  particleCount: number;
  glowIntensity: number;
  morphSpeed: number;
}

// --- Latency Tracking ---
export interface LatencyBreakdown {
  sttMs: number;
  llmTtftMs: number;
  llmTotalMs: number;
  ttsTtfbMs: number;
  ttsTotalMs: number;
  avatarRenderMs: number;
  networkMs: number;
  e2eMs: number;
  timestamp: number;
}

export interface LatencyBenchmark {
  stage: string;
  target: number;
  maxAcceptable: number;
  measured: number;
  passed: boolean;
}

// --- Metrics ---
export interface SessionMetrics {
  totalExchanges: number;
  avgE2eLatencyMs: number;
  avgTtftMs: number;
  avgTtfbMs: number;
  avgLipSyncOffsetMs: number;
  socraticScore: number; // % of turns ending with question
  conceptsCovered: number;
  estimatedCostUsd: number;
  latencyBreakdowns: LatencyBreakdown[];
}

// --- Pipeline Events (WebSocket messages) ---
export type PipelineEvent =
  | { type: 'session_start'; sessionId: string; topic: string; gradeLevel: GradeBand }
  | { type: 'audio_chunk'; data: string; isFinal: boolean }
  | { type: 'stt_transcript'; text: string; isFinal: boolean; latencyMs: number }
  | { type: 'llm_token'; token: string; isFirst: boolean; latencyMs: number }
  | { type: 'llm_done'; fullText: string; latencyMs: number }
  | { type: 'tts_audio'; audio: string; visemes?: VisemeEvent[]; isFirst: boolean; latencyMs: number }
  | { type: 'tts_done'; latencyMs: number }
  | { type: 'avatar_state'; state: AvatarState }
  | { type: 'metrics'; breakdown: LatencyBreakdown }
  | { type: 'error'; message: string; stage: string }
  | { type: 'session_end'; metrics: SessionMetrics };

export interface VisemeEvent {
  viseme: Viseme;
  timestamp: number; // ms offset from audio start
  duration: number;  // ms
  weight: number;    // 0-1 intensity
}

// --- Observability ---
export interface ObservabilityEvent {
  eventType: 'pipeline_stage' | 'session_event' | 'error' | 'metric';
  stage?: string;
  data: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
  traceId: string;
}

// --- Prompt Types ---
export interface SocraticPromptContext {
  topic: string;
  gradeLevel: GradeBand;
  conversationHistory: ConversationMessage[];
  conceptsCovered: string[];
  currentConceptIndex: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ============================================================
// Text-to-Speech Module — ElevenLabs Streaming
// WebSocket streaming with alignment data for lip-sync
// ============================================================

import type { VisemeEvent, Viseme } from '@/types';
import type { LatencyTracker } from '@/lib/metrics/latency';
import type { AIObserver } from '@/lib/metrics/observer';

export interface TTSConfig {
  apiKey: string;
  voiceId?: string;
  model?: string;
  outputFormat?: string;
  optimizeStreamingLatency?: number;
}

export type TTSAudioHandler = (audioChunk: ArrayBuffer, visemes: VisemeEvent[], isFirst: boolean) => void;
export type TTSDoneHandler = () => void;

// Phoneme to Viseme mapping (simplified)
const PHONEME_TO_VISEME: Record<string, Viseme> = {
  // Silence
  'sil': 'sil', 'sp': 'sil', '': 'sil',
  // Bilabials: p, b, m
  'p': 'PP', 'b': 'PP', 'm': 'PP',
  // Labiodentals: f, v
  'f': 'FF', 'v': 'FF',
  // Dentals: th
  'T': 'TH', 'D': 'TH',
  // Alveolars: t, d, n, l
  't': 'DD', 'd': 'DD', 'n': 'nn', 'l': 'nn',
  // Velars: k, g
  'k': 'kk', 'g': 'kk',
  // Post-alveolars: ch, j, sh, zh
  'tS': 'CH', 'dZ': 'CH', 'S': 'CH', 'Z': 'CH',
  // Sibilants: s, z
  's': 'SS', 'z': 'SS',
  // Rhotics
  'r': 'RR', 'R': 'RR',
  // Vowels
  'a': 'aa', 'A': 'aa', '@': 'aa',
  'e': 'E', 'E': 'E',
  'i': 'I', 'I': 'I',
  'o': 'O', 'O': 'O',
  'u': 'U', 'U': 'U',
};

/**
 * ElevenLabs Streaming TTS Client
 * Streams text → audio with alignment data
 */
export class ElevenLabsTTS {
  private ws: WebSocket | null = null;
  private config: Required<TTSConfig>;
  private onAudio: TTSAudioHandler | null = null;
  private onDone: TTSDoneHandler | null = null;
  private onError: ((error: Error) => void) | null = null;
  private latencyTracker: LatencyTracker | null = null;
  private observer: AIObserver | null = null;
  private isFirstChunk: boolean = true;
  private isConnected: boolean = false;

  constructor(config: TTSConfig) {
    this.config = {
      apiKey: config.apiKey,
      voiceId: config.voiceId ?? '21m00Tcm4TlvDq8ikWAM', // Rachel
      model: config.model ?? 'eleven_turbo_v2',
      outputFormat: config.outputFormat ?? 'pcm_24000',
      optimizeStreamingLatency: config.optimizeStreamingLatency ?? 4,
    };
  }

  attachInstrumentation(tracker: LatencyTracker, observer: AIObserver): void {
    this.latencyTracker = tracker;
    this.observer = observer;
  }

  /** Connect to ElevenLabs WebSocket */
  async connect(): Promise<void> {
    const url = `wss://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}/stream-input?model_id=${this.config.model}&output_format=${this.config.outputFormat}&optimize_streaming_latency=${this.config.optimizeStreamingLatency}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        // Send initial config message
        this.ws?.send(JSON.stringify({
          text: ' ',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.0,
            use_speaker_boost: true,
          },
          xi_api_key: this.config.apiKey,
          try_trigger_generation: false,
          generation_config: {
            chunk_length_schedule: [120, 160, 250, 290],
          },
        }));
        this.observer?.logStage('tts', { event: 'connected' });
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(typeof event.data === 'string' ? event.data : '{}');
          this.handleMessage(data);
        } catch (err) {
          this.observer?.logError('tts', err);
        }
      };

      this.ws.onerror = () => {
        const error = new Error('ElevenLabs WebSocket error');
        this.observer?.logError('tts', error);
        this.onError?.(error);
        reject(error);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.observer?.logStage('tts', { event: 'disconnected' });
      };
    });
  }

  /** Stream text to TTS (call multiple times for streaming from LLM) */
  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[TTS] WebSocket not connected, skipping text chunk');
      // Fire completion so pipeline doesn't deadlock
      this.onDone?.();
      return;
    }

    if (this.isFirstChunk) {
      this.latencyTracker?.mark('tts_ttfb');
      this.latencyTracker?.mark('tts_total');
      this.isFirstChunk = true; // Will measure on first audio back
    }

    this.ws.send(JSON.stringify({
      text,
      try_trigger_generation: true,
    }));
  }

  /** Signal that all text has been sent */
  flush(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        text: '',
      }));
    }
  }

  /** Register handlers */
  onAudioChunk(handler: TTSAudioHandler): void {
    this.onAudio = handler;
  }

  onComplete(handler: TTSDoneHandler): void {
    this.onDone = handler;
  }

  onTTSError(handler: (error: Error) => void): void {
    this.onError = handler;
  }

  /** Disconnect */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /** Reset for new utterance */
  resetForNewUtterance(): void {
    this.isFirstChunk = true;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  private handleMessage(data: Record<string, unknown>): void {
    // Handle audio data
    if (data.audio) {
      const audioBase64 = data.audio as string;
      const audioBytes = base64ToArrayBuffer(audioBase64);

      if (this.isFirstChunk) {
        const ttfb = this.latencyTracker?.measure('tts_ttfb') ?? -1;
        this.observer?.logStage('tts', {
          event: 'first_audio_byte',
          latencyMs: ttfb,
        });
      }

      // Extract alignment/viseme data if available
      const visemes = this.extractVisemes(data);

      this.onAudio?.(audioBytes, visemes, this.isFirstChunk);
      this.isFirstChunk = false;
    }

    // Handle completion
    if (data.isFinal === true) {
      const totalLatency = this.latencyTracker?.measure('tts_total') ?? -1;
      this.observer?.logStage('tts', {
        event: 'complete',
        totalLatencyMs: totalLatency,
      });
      this.onDone?.();
    }
  }

  /** Extract viseme data from ElevenLabs alignment info */
  private extractVisemes(data: Record<string, unknown>): VisemeEvent[] {
    const alignment = data.alignment as Record<string, unknown> | undefined;
    if (!alignment) {
      // If no alignment data, generate visemes from audio amplitude (fallback)
      return [];
    }

    const chars = (alignment.chars as string[]) ?? [];
    const charStartTimesMs = (alignment.charStartTimesMs as number[]) ?? [];
    const charDurationsMs = (alignment.charDurationsMs as number[]) ?? [];

    const visemes: VisemeEvent[] = [];
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i].toLowerCase();
      const viseme = PHONEME_TO_VISEME[char] ?? inferVisemeFromChar(char);

      visemes.push({
        viseme,
        timestamp: charStartTimesMs[i] ?? i * 50,
        duration: charDurationsMs[i] ?? 50,
        weight: 1.0,
      });
    }

    return visemes;
  }
}

/** Infer viseme from a character when phoneme mapping isn't available */
function inferVisemeFromChar(char: string): Viseme {
  if ('aeiou'.includes(char)) {
    const vowelMap: Record<string, Viseme> = { a: 'aa', e: 'E', i: 'I', o: 'O', u: 'U' };
    return vowelMap[char] ?? 'aa';
  }
  if ('pbm'.includes(char)) return 'PP';
  if ('fv'.includes(char)) return 'FF';
  if ('tdnl'.includes(char)) return 'DD';
  if ('kg'.includes(char)) return 'kk';
  if ('sz'.includes(char)) return 'SS';
  if ('r'.includes(char)) return 'RR';
  return 'sil';
}

/** Convert base64 string to ArrayBuffer */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof atob !== 'undefined') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  // Node.js fallback
  const buffer = Buffer.from(base64, 'base64');
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * Mock TTS for testing
 */
export class MockTTS {
  private onAudio: TTSAudioHandler | null = null;
  private onDone: TTSDoneHandler | null = null;
  private latencyTracker: LatencyTracker | null = null;

  attachInstrumentation(tracker: LatencyTracker): void {
    this.latencyTracker = tracker;
  }

  async connect(): Promise<void> {
    console.log('[MockTTS] Connected');
  }

  sendText(text: string): void {
    this.latencyTracker?.mark('tts_ttfb');
    this.latencyTracker?.mark('tts_total');

    // Simulate audio generation
    setTimeout(() => {
      const mockAudio = new ArrayBuffer(1024);
      const mockVisemes: VisemeEvent[] = text.split('').map((char, i) => ({
        viseme: inferVisemeFromChar(char.toLowerCase()),
        timestamp: i * 50,
        duration: 50,
        weight: 1.0,
      }));

      this.latencyTracker?.measure('tts_ttfb');
      this.onAudio?.(mockAudio, mockVisemes, true);

      setTimeout(() => {
        this.latencyTracker?.measure('tts_total');
        this.onDone?.();
      }, 100);
    }, 80);
  }

  flush(): void {}
  onAudioChunk(handler: TTSAudioHandler): void { this.onAudio = handler; }
  onComplete(handler: TTSDoneHandler): void { this.onDone = handler; }
  onTTSError(): void {}
  disconnect(): void {}
  resetForNewUtterance(): void {}
  getIsConnected(): boolean { return true; }
}

export { inferVisemeFromChar, base64ToArrayBuffer, PHONEME_TO_VISEME };

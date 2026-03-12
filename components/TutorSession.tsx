'use client';
// ============================================================
// TutorSession — Orb-Centric Tutoring Interface
// Features: Concept graph, emotion detection, aha celebrations,
// progress persistence. The orb dominates. No chat bubbles.
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import type { AvatarState, GradeBand, LatencyBreakdown, SessionMetrics, PipelineEvent, VisemeEvent } from '@/types';
import WisdomOrb from './WisdomOrb';
import LatencyDashboard from './LatencyDashboard';
import ConceptMap from './ConceptMap';
import AhaCelebration from './AhaCelebration';
import ProgressBadge from './ProgressBadge';
import { PipelineOrchestrator } from '@/lib/pipeline/orchestrator';
import {
  ConceptGraph,
  extractConcepts,
  assessUnderstanding,
  detectAhaMoment,
  type ConceptGraphState,
} from '@/lib/knowledge/concept-graph';
import { analyzeTextEmotion, combineSignals, type EmotionState } from '@/lib/knowledge/emotion';
import { loadProfile, recordSession } from '@/lib/knowledge/progress';

interface TutorSessionProps {
  topic: string;
  gradeLevel: GradeBand;
  useMocks?: boolean;
}

export default function TutorSession({ topic, gradeLevel, useMocks = true }: TutorSessionProps) {
  // Pipeline state
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [visemeEvents, setVisemeEvents] = useState<VisemeEvent[]>([]);
  const [tutorText, setTutorText] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'student' | 'tutor'; text: string }>>([]);
  const [textInput, setTextInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [latencyBreakdown, setLatencyBreakdown] = useState<LatencyBreakdown | null>(null);
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Panel state
  const [activePanel, setActivePanel] = useState<'none' | 'metrics' | 'concepts'>('none');

  // Knowledge features
  const [graphState, setGraphState] = useState<ConceptGraphState>({ nodes: [], edges: [], totalMastery: 0 });
  const [emotion, setEmotion] = useState<EmotionState>('neutral');
  const [ahaTrigger, setAhaTrigger] = useState(0);
  const [ahaConcept, setAhaConcept] = useState<string>('');
  const [breakthroughs, setBreakthroughs] = useState(0);

  // Refs
  const orchestratorRef = useRef<PipelineOrchestrator | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conceptGraphRef = useRef(new ConceptGraph());
  const sessionStartTime = useRef(Date.now());
  const previousMastery = useRef(0);

  // Load profile for streak
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    const profile = loadProfile();
    setStreak(profile.currentStreak);
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatHistory, tutorText]);

  // Process each exchange through knowledge features
  const processExchange = useCallback((studentText: string, tutorResponse: string) => {
    const textEmotion = analyzeTextEmotion(studentText);
    const finalEmotion = combineSignals(textEmotion);
    setEmotion(finalEmotion.state);

    const concepts = extractConcepts(tutorResponse);
    const understanding = assessUnderstanding(studentText);
    const isAha = detectAhaMoment(studentText, previousMastery.current, understanding);

    conceptGraphRef.current.addConcepts(concepts, understanding, isAha);
    const newState = conceptGraphRef.current.getState();
    setGraphState(newState);
    previousMastery.current = newState.totalMastery / 100;

    if (isAha || finalEmotion.state === 'breakthrough') {
      setBreakthroughs((b) => b + 1);
      setAhaConcept(concepts[0] ?? topic);
      setAhaTrigger((t) => t + 1);
    }
  }, [topic]);

  const initSession = useCallback(async () => {
    try {
      setError(null);
      sessionStartTime.current = Date.now();
      const orchestrator = new PipelineOrchestrator({
        topic,
        gradeLevel,
        useMocks,
        deepgramApiKey: process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY,
        anthropicApiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
        elevenLabsApiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
      });

      let lastStudentText = '';

      orchestrator.onEvent((event: PipelineEvent) => {
        switch (event.type) {
          case 'avatar_state':
            setAvatarState(event.state);
            break;
          case 'stt_transcript':
            if (event.isFinal) {
              lastStudentText = event.text;
              setInterimText('');
              // Only add for voice input (latencyMs > 0). Text input adds its own message in sendText.
              if (event.latencyMs > 0) {
                setChatHistory((prev) => [...prev, { role: 'student', text: event.text }]);
              }
            } else {
              // Show interim (partial) transcript as user speaks
              setInterimText(event.text);
            }
            break;
          case 'llm_token':
            setTutorText((prev) => prev + event.token);
            break;
          case 'llm_done':
            setChatHistory((prev) => [...prev, { role: 'tutor', text: event.fullText }]);
            setTutorText('');
            if (lastStudentText) {
              processExchange(lastStudentText, event.fullText);
            }
            break;
          case 'tts_audio':
            if (event.visemes) setVisemeEvents(event.visemes);
            break;
          case 'metrics':
            setLatencyBreakdown(event.breakdown);
            break;
          case 'session_end':
            setSessionMetrics(event.metrics);
            break;
          case 'error':
            setError(`[${event.stage}] ${event.message}`);
            break;
        }
      });

      await orchestrator.initialize();
      orchestratorRef.current = orchestrator;
      setIsConnected(true);
      await orchestrator.generateGreeting();
    } catch (err) {
      setError(`Failed to initialize: ${err}`);
    }
  }, [topic, gradeLevel, useMocks, processExchange]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
      });
      mediaStreamRef.current = stream;
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const buffer = new ArrayBuffer(inputData.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        }
        orchestratorRef.current?.sendAudio(buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      setIsRecording(true);
      setAvatarState('listening');
    } catch (err) {
      setError(`Microphone error: ${err}`);
    }
  }, []);

  const stopRecording = useCallback(() => {
    // Flush STT buffer so final transcript arrives
    orchestratorRef.current?.finishAudio();
    processorRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close();
    setIsRecording(false);
  }, []);

  const sendText = useCallback(async () => {
    if (!textInput.trim() || !orchestratorRef.current) return;
    const text = textInput.trim();
    setTextInput('');
    setTutorText('');

    // Always show the student message immediately, even if pipeline is busy
    setChatHistory((prev) => [...prev, { role: 'student', text }]);

    try {
      await orchestratorRef.current.handleTextInput(text);
    } catch (err) {
      setError(`Send failed: ${err}`);
    }
  }, [textInput]);

  const endSession = useCallback(() => {
    const result = orchestratorRef.current?.endSession();
    if (result) setSessionMetrics(result.metrics);
    stopRecording();
    setIsConnected(false);

    const profile = loadProfile();
    recordSession(profile, {
      topic,
      conceptsLearned: conceptGraphRef.current.getConceptCount(),
      breakthroughs: conceptGraphRef.current.getBreakthroughCount(),
      mastery: graphState.totalMastery,
      exchanges: chatHistory.filter((m) => m.role === 'student').length,
      durationMs: Date.now() - sessionStartTime.current,
    });
  }, [stopRecording, topic, graphState.totalMastery, chatHistory]);

  const stateLabel =
    avatarState === 'listening' ? 'Listening...'
    : avatarState === 'thinking' ? 'Thinking...'
    : avatarState === 'speaking' ? 'Speaking'
    : '';

  return (
    <div className="flex flex-col h-screen bg-paper relative overflow-hidden">
      <AhaCelebration trigger={ahaTrigger} concept={ahaConcept} />

      <div className="relative z-10 flex flex-col h-full">

        {/* ── Header ── */}
        <header className="flex items-center justify-between px-6 py-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className={`state-pip state-pip-${avatarState}`} />
            <h1 className="text-lg">
              <span className="text-ink-ghost">learn:</span>{' '}
              <span className="text-ink font-display italic">{topic}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <ProgressBadge graph={graphState} breakthroughs={breakthroughs} emotion={emotion} streak={streak} />

            <button
              onClick={() => setActivePanel((p) => p === 'concepts' ? 'none' : 'concepts')}
              className={`btn-ghost ${activePanel === 'concepts' ? '!bg-canvas-warm !text-ink-soft' : ''}`}
            >
              Map
            </button>
            <button
              onClick={() => setActivePanel((p) => p === 'metrics' ? 'none' : 'metrics')}
              className={`btn-ghost ${activePanel === 'metrics' ? '!bg-canvas-warm !text-ink-soft' : ''}`}
            >
              Metrics
            </button>
            {isConnected && (
              <button onClick={endSession} className="btn-ghost !text-ember !border-ember/20 hover:!bg-ember-glow">
                End
              </button>
            )}
          </div>
        </header>

        <div className="divider" />

        {/* ── Main: content + optional panel ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Center column */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Orb — fixed height, does NOT scroll */}
            <div className="flex-shrink-0 flex items-center justify-center py-3 relative animate-scale-in">
              <WisdomOrb
                avatarState={avatarState}
                visemeEvents={visemeEvents}
                className="w-[180px] h-[180px] md:w-[220px] md:h-[220px]"
              />
              {stateLabel && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                  <span className="label-upper text-ink-ghost animate-fade-in">{stateLabel}</span>
                </div>
              )}

              {/* Emotion hint next to orb */}
              {emotion !== 'neutral' && emotion !== 'confident' && (
                <div className="absolute right-8 top-1/2 -translate-y-1/2">
                  <span className="text-xs text-ink-ghost italic">
                    {emotion === 'confused' && 'Take your time.'}
                    {emotion === 'frustrated' && "It's okay, this is tricky."}
                    {emotion === 'curious' && 'Great curiosity!'}
                    {emotion === 'excited' && 'Love the energy!'}
                    {emotion === 'breakthrough' && 'Breakthrough!'}
                  </span>
                </div>
              )}
            </div>

            <div className="divider" />

            {/* Conversation — scrollable, full width */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-4 scroll-smooth">

              {chatHistory.length === 0 && !isConnected && (
                <p className="text-center text-ink-ghost text-sm italic py-8">
                  Start a session to begin learning with Lumi.
                </p>
              )}

              <div className="w-full space-y-4">
                {chatHistory.map((msg, i) => (
                  <div key={i} className="exchange-row">
                    {msg.role === 'student' ? (
                      <div className="flex justify-end">
                        <div className="exchange-student">{msg.text}</div>
                      </div>
                    ) : (
                      <div className="w-full">
                        <span className="label-upper block mb-1">Lumi</span>
                        <p className="exchange-tutor">{msg.text}</p>
                      </div>
                    )}
                  </div>
                ))}

                {/* Live streaming text — appears inline after history */}
                {tutorText && (
                  <div className="exchange-row">
                    <div className="w-full">
                      <span className="label-upper block mb-1">Lumi</span>
                      <p className="exchange-tutor streaming-text">{tutorText}<span className="streaming-cursor" /></p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input — full width */}
            <div className="px-4 sm:px-6 lg:px-10 py-3 border-t border-canvas-muted bg-canvas/80 backdrop-blur-sm">
              {/* Interim voice transcript preview */}
              {isRecording && interimText && (
                <div className="mb-2 flex justify-end">
                  <span className="text-sm text-ink-ghost italic">{interimText}...</span>
                </div>
              )}

              {!isConnected ? (
                <div className="max-w-md mx-auto">
                  <button onClick={initSession} className="btn-primary w-full">Begin Session</button>
                </div>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isRecording
                        ? 'bg-ember/15 border-2 border-ember/40 recording-pulse'
                        : 'bg-canvas-warm border border-canvas-muted hover:border-ink-faint hover:bg-white'
                    }`}
                    title={isRecording ? 'Stop recording' : 'Start recording'}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      {isRecording ? (
                        <rect x="7" y="7" width="10" height="10" rx="2" className="text-ember" />
                      ) : (
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" className="text-ink-muted" />
                      )}
                    </svg>
                  </button>

                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendText()}
                    placeholder={isRecording ? 'Listening... speak now' : 'Type your answer...'}
                    className="input-warm flex-1 !py-2.5 !text-sm"
                    disabled={isRecording}
                  />

                  <button
                    onClick={sendText}
                    disabled={!textInput.trim() || isRecording}
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                      textInput.trim() && !isRecording
                        ? 'bg-ink text-white hover:bg-ink-soft'
                        : 'bg-canvas-warm text-ink-faint'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-5 5m5-5l5 5" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Side panel */}
          {activePanel !== 'none' && (
            <div className="w-[300px] border-l border-canvas-muted bg-canvas-warm p-5 overflow-y-auto animate-fade-in">
              {activePanel === 'metrics' && (
                <LatencyDashboard
                  currentBreakdown={latencyBreakdown}
                  sessionMetrics={sessionMetrics}
                  isVisible={true}
                />
              )}
              {activePanel === 'concepts' && (
                <div>
                  <h3 className="label-upper mb-4">Knowledge Map</h3>
                  <ConceptMap graph={graphState} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-5 right-5 z-50 card-floating px-5 py-3 max-w-md animate-fade-up !border-ember/20">
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-ember mt-1.5 flex-shrink-0" />
              <span className="text-sm text-ink-soft">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-ink-ghost hover:text-ink-muted transition-colors text-lg leading-none">
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

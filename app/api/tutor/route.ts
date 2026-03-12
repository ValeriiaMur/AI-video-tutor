// ============================================================
// API Route — Tutor Pipeline Endpoint
// Handles text-based tutoring exchanges (for text-first mode)
// Voice pipeline uses direct WebSocket connections client-side
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

// Anthropic streaming proxy to avoid CORS issues
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { systemPrompt, messages, model, maxTokens, temperature } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model ?? 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens ?? 150,
        temperature: temperature ?? 0.7,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      return NextResponse.json(
        { error: `Anthropic API error: ${anthropicResponse.status}`, details: errorText },
        { status: anthropicResponse.status }
      );
    }

    // Stream the response through
    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[API/tutor] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'ai-video-tutor',
    pipeline: {
      stt: 'deepgram-nova-2',
      llm: 'claude-3.5-haiku',
      tts: 'elevenlabs-turbo-v2',
      avatar: 'wisdom-orb-threejs',
    },
    timestamp: new Date().toISOString(),
  });
}

// ============================================================
// Benchmark API Route
// Runs latency benchmarks against each pipeline stage
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

interface BenchmarkResult {
  stage: string;
  latencyMs: number;
  passed: boolean;
  target: number;
  maxAcceptable: number;
  details: string;
}

export async function POST(request: NextRequest) {
  const { stages } = await request.json().catch(() => ({ stages: ['llm'] }));
  const results: BenchmarkResult[] = [];

  // Benchmark LLM (Claude Haiku)
  if (stages.includes('llm')) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const start = performance.now();
        let ttft = -1;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 50,
            temperature: 0.7,
            system: 'You are a helpful tutor. Respond briefly.',
            messages: [{ role: 'user', content: 'What is 2+2?' }],
            stream: true,
          }),
        });

        if (response.ok) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (reader) {
            let firstToken = true;
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = decoder.decode(value);
              if (firstToken && text.includes('content_block_delta')) {
                ttft = performance.now() - start;
                firstToken = false;
              }
            }
          }

          const totalMs = performance.now() - start;
          results.push({
            stage: 'llm_ttft',
            latencyMs: ttft,
            passed: ttft > 0 && ttft <= 400,
            target: 200,
            maxAcceptable: 400,
            details: `Claude 3.5 Haiku TTFT: ${Math.round(ttft)}ms, Total: ${Math.round(totalMs)}ms`,
          });
        }
      } catch (error) {
        results.push({
          stage: 'llm_ttft',
          latencyMs: -1,
          passed: false,
          target: 200,
          maxAcceptable: 400,
          details: `Error: ${error}`,
        });
      }
    } else {
      results.push({
        stage: 'llm_ttft',
        latencyMs: -1,
        passed: false,
        target: 200,
        maxAcceptable: 400,
        details: 'ANTHROPIC_API_KEY not configured',
      });
    }
  }

  // Summary
  const allPassed = results.every((r) => r.passed);
  return NextResponse.json({
    benchmarkGate: allPassed ? 'PASSED' : 'FAILED',
    results,
    timestamp: new Date().toISOString(),
  });
}

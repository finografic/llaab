/**
 * Bun runtime smoke for the AI SDK boundary (Fable migration A1; migration doc Phase 0).
 * Serves a mocked OpenAI-compatible endpoint with Bun.serve, then runs a generateText call
 * through @ai-sdk/openai-compatible. No live provider or network access required.
 *
 * Run from the repo root: `bun run packages/llm/scripts/ai-sdk-bun-smoke.ts`
 * Exits 0 and prints a summary line on success.
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';

const server = Bun.serve({
  port: 0,
  fetch: () =>
    Response.json({
      id: 'chatcmpl-smoke',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'smoke-model',
      choices: [{ index: 0, message: { role: 'assistant', content: 'bun-smoke-ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
    }),
});

try {
  const provider = createOpenAICompatible({
    name: 'bun-smoke',
    baseURL: `http://localhost:${server.port}/v1`,
    includeUsage: true,
  });
  const result = await generateText({
    model: provider('smoke-model'),
    prompt: 'smoke test',
    maxRetries: 0,
  });

  if (result.text !== 'bun-smoke-ok') {
    throw new Error(`unexpected completion text: ${result.text}`);
  }
  if (result.usage.inputTokens !== 5 || result.usage.outputTokens !== 2) {
    throw new Error(`unexpected usage: ${JSON.stringify(result.usage)}`);
  }

  console.log(
    `ai-sdk bun smoke OK — text="${result.text}" inputTokens=${result.usage.inputTokens} outputTokens=${result.usage.outputTokens} bun=${Bun.version}`,
  );
} finally {
  server.stop();
}

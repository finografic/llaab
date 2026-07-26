import type { LlmProgress } from '../types.js';

function normalizeLmStudioStatus(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('loading')) return 'loading';
  if (normalized.includes('processing')) return 'processing prompt';
  if (normalized.includes('gen')) return 'generating';
  if (normalized.includes('idle')) return 'idle';
  return normalized || undefined;
}

export function parseLmStudioProgressLine(line: string, model: string): LlmProgress | undefined {
  if (!line.includes(model)) return undefined;

  const statusMatch = line.match(
    /\b(LOADING\s+\d+(?:\.\d+)?%|PROCESSING\s+PROMPT\s+\d+(?:\.\d+)?%|GEN\s+[\d,]+\s+tok|IDLE)(?=$|\s)/i,
  );
  if (!statusMatch) return undefined;

  const rawStatus = statusMatch[1] ?? '';
  const tokenMatch = rawStatus.match(/GEN\s+([\d,]+)\s+tok/i);
  return {
    status: normalizeLmStudioStatus(rawStatus),
    completionTokens: tokenMatch?.[1] ? Number.parseInt(tokenMatch[1].replaceAll(',', ''), 10) : undefined,
  };
}

/**
 * Known wrong → right replacements for cleaned transcript text (ASR quirks, recurring brand typos). Applied
 * after `cleanTranscript`, before `structureText` and LLM extract.
 */
export interface TranscriptReplacementRule {
  pattern: RegExp;
  replacement: string;
}

export const KNOWN_TRANSCRIPT_REPLACEMENTS: readonly TranscriptReplacementRule[] = [
  { pattern: /\bVerscell\b/gi, replacement: 'Vercel' },
];

export function applyKnownTranscriptReplacements(text: string): string {
  let out = text;
  for (const { pattern, replacement } of KNOWN_TRANSCRIPT_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

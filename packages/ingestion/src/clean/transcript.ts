export interface CleanedTranscript {
  cleanedText: string;
  rawLength: number;
  cleanLength: number;
}

export function cleanTranscript(rawTranscript: string): CleanedTranscript {
  const rawLength = rawTranscript.length;

  if (!rawTranscript) {
    return { cleanedText: '', rawLength: 0, cleanLength: 0 };
  }

  let text = rawTranscript;

  const lines = text.split('\n').filter((line) => line.trim());
  const dedupedLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (dedupedLines[dedupedLines.length - 1] !== trimmedLine) {
      dedupedLines.push(trimmedLine);
    }
  }

  text = dedupedLines.join(' ');
  text = text.replace(/\s+/g, ' ').trim();

  return {
    cleanedText: text,
    rawLength,
    cleanLength: text.length,
  };
}

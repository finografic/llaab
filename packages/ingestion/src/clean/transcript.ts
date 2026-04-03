export function cleanTranscript(input: string): string {
  return input.replace(/\[(\d{2}:)?\d{2}:\d{2}\]/g, '').replace(/\s+/g, ' ').trim();
}

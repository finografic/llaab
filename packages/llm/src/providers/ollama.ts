export async function summarizeWithOllama(input: string): Promise<string> {
  return `Ollama placeholder summary: ${input.slice(0, 160)}`;
}

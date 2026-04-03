export async function summarizeWithAnthropic(input: string): Promise<string> {
  return `Anthropic placeholder summary: ${input.slice(0, 160)}`;
}

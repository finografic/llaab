export interface StructuredText {
  structuredContent: string;
  paragraphCount: number;
}

export function structureText(cleanedText: string, sentencesPerParagraph: number = 5): StructuredText {
  if (!cleanedText) {
    return { structuredContent: '', paragraphCount: 0 };
  }

  const sentences = cleanedText.match(/[^.!?]+[.!?]+/g) || [cleanedText];
  const paragraphs: string[] = [];

  for (let index = 0; index < sentences.length; index += sentencesPerParagraph) {
    const chunk = sentences
      .slice(index, index + sentencesPerParagraph)
      .map((sentence) => sentence.trim())
      .join(' ');

    paragraphs.push(chunk);
  }

  return {
    structuredContent: paragraphs.join('\n\n'),
    paragraphCount: paragraphs.length,
  };
}

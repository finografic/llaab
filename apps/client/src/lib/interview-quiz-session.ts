import type { InterviewQuizStorage } from './interview-quiz-storage';

import type { InterviewDomainId, InterviewQuestion, InterviewSection } from 'types/interview-quiz.types';

export type InterviewSessionCount = 5 | 10 | 20 | 'all';
export type InterviewSectionFilter = InterviewSection | 'both';
export type InterviewDifficultyFilter = 1 | 2 | 3 | 'all';

export interface InterviewSessionConfig {
  count: InterviewSessionCount;
  section: InterviewSectionFilter;
  difficulty: InterviewDifficultyFilter;
  autoRead: boolean;
  speechRate: number;
}

export interface InterviewSelectionOptions {
  domains: InterviewDomainId[];
  config: InterviewSessionConfig;
  questions: InterviewQuestion[];
  storage: InterviewQuizStorage;
  retryIds?: string[];
}

export interface InterviewReplacementOptions extends InterviewSelectionOptions {
  excludeIds: string[];
}

const DEFAULT_CONFIG: InterviewSessionConfig = {
  count: 10,
  section: 'both',
  difficulty: 'all',
  autoRead: true,
  speechRate: 1.15,
};

export function createDefaultInterviewSessionConfig(): InterviewSessionConfig {
  return DEFAULT_CONFIG;
}

export function createInterviewSessionQuestions({
  domains,
  config,
  questions,
  storage,
  retryIds,
}: InterviewSelectionOptions): InterviewQuestion[] {
  const retrySet = new Set(retryIds ?? []);
  const attemptsByQuestion = Map.groupBy(storage.attempts, (attempt) => attempt.questionId);
  const filtered = questions.filter((question) => {
    if (!domains.includes(question.domain)) return false;
    if (config.section !== 'both' && question.section !== config.section) return false;
    if (config.difficulty !== 'all' && question.difficulty !== config.difficulty) return false;
    if (retrySet.size > 0 && !retrySet.has(question.id)) return false;
    return true;
  });
  const flaggedIds = new Set(storage.flaggedIds);
  const selected = new Map<string, InterviewQuestion>();
  const targetCount = config.count === 'all' ? filtered.length : Math.min(config.count, filtered.length);

  for (const question of createWeightedQuestionOrder(filtered, attemptsByQuestion, flaggedIds)) {
    if (selected.size >= targetCount) break;
    selected.set(question.id, question);
  }

  return [...selected.values()].map(randomiseQuestionForDisplay);
}

export function createInterviewReplacementQuestion({
  domains,
  config,
  questions,
  storage,
  retryIds,
  excludeIds,
}: InterviewReplacementOptions): InterviewQuestion | null {
  const excluded = new Set(excludeIds);
  const replacement = createInterviewSessionQuestions({
    domains,
    config: { ...config, count: 'all' },
    questions,
    storage,
    retryIds,
  }).find((question) => !excluded.has(question.id));

  return replacement ?? null;
}

function createWeightedQuestionOrder(
  questions: InterviewQuestion[],
  attemptsByQuestion: Map<string, InterviewQuizStorage['attempts']>,
  flaggedIds: Set<string>,
): InterviewQuestion[] {
  return questions
    .map((question) => {
      const weight = getQuestionSelectionWeight(question, attemptsByQuestion, flaggedIds);
      return {
        question,
        rank: -Math.log(Math.random()) / weight,
      };
    })
    .toSorted((a, b) => a.rank - b.rank)
    .map((item) => item.question);
}

function getQuestionSelectionWeight(
  question: InterviewQuestion,
  attemptsByQuestion: Map<string, InterviewQuizStorage['attempts']>,
  flaggedIds: Set<string>,
): number {
  const attempts = attemptsByQuestion.get(question.id) ?? [];
  const wasMissed = attempts.some((attempt) => !attempt.correct);
  const baseWeight = attempts.length === 0 ? 4 : wasMissed ? 3 : 1;
  return flaggedIds.has(question.id) ? baseWeight * 1.15 : baseWeight;
}

export function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function randomiseQuestionForDisplay(question: InterviewQuestion): InterviewQuestion {
  if (question.type !== 'mcq') return question;

  const options = shuffleArray(question.options);
  const displayLabelByOptionId = new Map(
    options.map((option, index) => [option.id, String.fromCharCode(65 + index)]),
  );
  const remapOptionReferences = (text: string) =>
    text.replace(/\bOption\s+([a-d])\b/gi, (_, optionId: string) => {
      const displayLabel = displayLabelByOptionId.get(optionId.toLowerCase());
      return displayLabel ? `Option ${displayLabel}` : `Option ${optionId.toUpperCase()}`;
    });

  return {
    ...question,
    options,
    explanation: remapOptionReferences(question.explanation),
    explanationSpoken: question.explanationSpoken
      ? remapOptionReferences(question.explanationSpoken)
      : undefined,
    distractorNotes: question.distractorNotes
      ? Object.fromEntries(
          Object.entries(question.distractorNotes).map(([optionId, note]) => [
            optionId,
            remapOptionReferences(note),
          ]),
        )
      : undefined,
  };
}

export function createInitialOrder(question: InterviewQuestion): string[] {
  if (question.type !== 'order') return [];

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const shuffled = shuffleArray(question.items.map((item) => item.id));
    if (!ordersMatch(shuffled, question.correctOrder)) return shuffled;
  }

  return question.correctOrder.toReversed();
}

export function ordersMatch(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

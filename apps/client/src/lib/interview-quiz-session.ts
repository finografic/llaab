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
}

export interface InterviewSelectionOptions {
  domains: InterviewDomainId[];
  config: InterviewSessionConfig;
  questions: InterviewQuestion[];
  storage: InterviewQuizStorage;
  retryIds?: string[];
}

const DEFAULT_CONFIG: InterviewSessionConfig = {
  count: 10,
  section: 'both',
  difficulty: 'all',
  autoRead: false,
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
  const weighted = filtered.flatMap((question) => {
    const attempts = attemptsByQuestion.get(question.id) ?? [];
    const wasMissed = attempts.some((attempt) => !attempt.correct);
    const weight = attempts.length === 0 ? 4 : wasMissed ? 3 : 1;
    return Array.from({ length: weight }, () => question);
  });
  const pool = weighted.length > 0 ? weighted : filtered;
  const selected = new Map<string, InterviewQuestion>();
  const targetCount = config.count === 'all' ? filtered.length : Math.min(config.count, filtered.length);

  for (const question of shuffleArray(pool)) {
    if (selected.size >= targetCount) break;
    selected.set(question.id, question);
  }

  return [...selected.values()];
}

export function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
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

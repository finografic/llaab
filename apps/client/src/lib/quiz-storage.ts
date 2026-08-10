import type { QuizDomainId, QuizSection } from 'types/quiz.types';

export interface QuizAttempt {
  id: string;
  questionId: string;
  domain: QuizDomainId;
  section: QuizSection;
  correct: boolean;
  score?: number;
  answeredAt: string;
  selectedOptionId?: string;
  submittedOrder?: string[];
}

export interface QuizDomainAccuracy {
  attempts: number;
  correct: number;
}

export interface QuizStorage {
  attempts: QuizAttempt[];
  flaggedIds: string[];
  domainAccuracy: Partial<Record<QuizDomainId, QuizDomainAccuracy>>;
}

const STORAGE_KEY = 'llaab.quiz.v1';

const EMPTY_STORAGE: QuizStorage = {
  attempts: [],
  flaggedIds: [],
  domainAccuracy: {},
};

export function loadQuizStorage(): QuizStorage {
  if (typeof window === 'undefined') return EMPTY_STORAGE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORAGE;

    const parsed = JSON.parse(raw) as Partial<QuizStorage>;

    return {
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      flaggedIds: Array.isArray(parsed.flaggedIds) ? parsed.flaggedIds : [],
      domainAccuracy:
        parsed.domainAccuracy && typeof parsed.domainAccuracy === 'object' ? parsed.domainAccuracy : {},
    };
  } catch {
    return EMPTY_STORAGE;
  }
}

export function saveQuizStorage(storage: QuizStorage): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}

export function addQuizAttempt(
  storage: QuizStorage,
  attempt: Omit<QuizAttempt, 'id' | 'answeredAt'>,
): QuizStorage {
  const nextAttempt: QuizAttempt = {
    ...attempt,
    id: `${attempt.questionId}-${Date.now()}`,
    answeredAt: new Date().toISOString(),
  };
  const currentAccuracy = storage.domainAccuracy[attempt.domain] ?? { attempts: 0, correct: 0 };
  const score = attempt.score ?? (attempt.correct ? 1 : 0);

  return {
    ...storage,
    attempts: [...storage.attempts, nextAttempt],
    domainAccuracy: {
      ...storage.domainAccuracy,
      [attempt.domain]: {
        attempts: currentAccuracy.attempts + 1,
        correct: currentAccuracy.correct + score,
      },
    },
  };
}

export function toggleQuizFlag(storage: QuizStorage, questionId: string): QuizStorage {
  const flagged = new Set(storage.flaggedIds);
  if (flagged.has(questionId)) flagged.delete(questionId);
  else flagged.add(questionId);

  return saveFlaggedIds(storage, flagged);
}

export function addQuizPracticeFlag(storage: QuizStorage, questionId: string): QuizStorage {
  const flagged = new Set(storage.flaggedIds);
  flagged.add(questionId);

  return saveFlaggedIds(storage, flagged);
}

function saveFlaggedIds(storage: QuizStorage, flagged: Set<string>): QuizStorage {
  return {
    ...storage,
    flaggedIds: [...flagged].toSorted(),
  };
}

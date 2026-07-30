import type { InterviewDomainId, InterviewSection } from 'types/interview-quiz.types';

export interface InterviewAttempt {
  id: string;
  questionId: string;
  domain: InterviewDomainId;
  section: InterviewSection;
  correct: boolean;
  score?: number;
  answeredAt: string;
  selectedOptionId?: string;
  submittedOrder?: string[];
}

export interface InterviewDomainAccuracy {
  attempts: number;
  correct: number;
}

export interface InterviewQuizStorage {
  attempts: InterviewAttempt[];
  flaggedIds: string[];
  domainAccuracy: Partial<Record<InterviewDomainId, InterviewDomainAccuracy>>;
}

const STORAGE_KEY = 'llaab.interviewQuiz.v1';

const EMPTY_STORAGE: InterviewQuizStorage = {
  attempts: [],
  flaggedIds: [],
  domainAccuracy: {},
};

export function loadInterviewQuizStorage(): InterviewQuizStorage {
  if (typeof window === 'undefined') return EMPTY_STORAGE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORAGE;

    const parsed = JSON.parse(raw) as Partial<InterviewQuizStorage>;

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

export function saveInterviewQuizStorage(storage: InterviewQuizStorage): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}

export function addInterviewAttempt(
  storage: InterviewQuizStorage,
  attempt: Omit<InterviewAttempt, 'id' | 'answeredAt'>,
): InterviewQuizStorage {
  const nextAttempt: InterviewAttempt = {
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

export function toggleInterviewFlag(storage: InterviewQuizStorage, questionId: string): InterviewQuizStorage {
  const flagged = new Set(storage.flaggedIds);
  if (flagged.has(questionId)) flagged.delete(questionId);
  else flagged.add(questionId);

  return saveFlaggedIds(storage, flagged);
}

export function addInterviewPracticeFlag(
  storage: InterviewQuizStorage,
  questionId: string,
): InterviewQuizStorage {
  const flagged = new Set(storage.flaggedIds);
  flagged.add(questionId);

  return saveFlaggedIds(storage, flagged);
}

function saveFlaggedIds(storage: InterviewQuizStorage, flagged: Set<string>): InterviewQuizStorage {
  return {
    ...storage,
    flaggedIds: [...flagged].toSorted(),
  };
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InterviewQuizStorage } from './interview-quiz-storage';

import type { InterviewMcqQuestion, InterviewOrderQuestion } from 'types/interview-quiz.types';

import { createInitialOrder, createInterviewSessionQuestions, ordersMatch } from './interview-quiz-session';

const EMPTY_STORAGE: InterviewQuizStorage = {
  attempts: [],
  flaggedIds: [],
  domainAccuracy: {},
};

const MCQ_QUESTION: InterviewMcqQuestion = {
  id: 'apis-001',
  domain: 'apis',
  section: 'depth',
  type: 'mcq',
  difficulty: 2,
  stem: 'Which option is correct?',
  options: [
    { id: 'a', text: 'Correct' },
    { id: 'b', text: 'Trap one' },
    { id: 'c', text: 'Trap two' },
    { id: 'd', text: 'Trap three' },
  ],
  correctOptionId: 'a',
  explanation: 'Option c is the tempting answer.',
  explanationSpoken: 'Option b is also tempting.',
  distractorNotes: {
    b: 'Option d fails for another reason.',
  },
  tags: [],
};

const ORDER_QUESTION: InterviewOrderQuestion = {
  id: 'apis-002',
  domain: 'apis',
  section: 'depth',
  type: 'order',
  difficulty: 2,
  stem: 'Order these steps.',
  items: [
    { id: 'i1', text: 'First' },
    { id: 'i2', text: 'Second' },
    { id: 'i3', text: 'Third' },
  ],
  correctOrder: ['i1', 'i2', 'i3'],
  orderRationale: 'The steps are sequential.',
  explanation: 'The steps are sequential.',
  tags: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('interview quiz question randomisation', () => {
  it('shuffles MCQ options while preserving IDs and remapping displayed option references', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const [question] = createInterviewSessionQuestions({
      domains: ['apis'],
      config: {
        count: 'all',
        section: 'both',
        difficulty: 'all',
        autoRead: true,
        speechRate: 1.15,
      },
      questions: [MCQ_QUESTION],
      storage: EMPTY_STORAGE,
    });

    expect(question?.type).toBe('mcq');
    if (question?.type !== 'mcq') return;

    expect(question.options.map((option) => option.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(question.correctOptionId).toBe('a');
    expect(question.explanation).toBe('Option B is the tempting answer.');
    expect(question.explanationSpoken).toBe('Option A is also tempting.');
    expect(question.distractorNotes?.b).toBe('Option C fails for another reason.');
    expect(MCQ_QUESTION.options.map((option) => option.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('starts ordering questions in a shuffled, incorrect order', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const initialOrder = createInitialOrder(ORDER_QUESTION);

    expect(initialOrder).toEqual(['i2', 'i3', 'i1']);
    expect(ordersMatch(initialOrder, ORDER_QUESTION.correctOrder)).toBe(false);
  });
});

export type QuizDomainId =
  | 'testing'
  | 'automation'
  | 'cloud'
  | 'apis'
  | 'typescript'
  | 'frontend'
  | 'platform'
  | 'vald';

export type QuizSection = 'glossary' | 'depth';
export type QuizQuestionType = 'mcq' | 'order';

export interface QuizQuestionBase {
  id: string;
  domain: QuizDomainId;
  section: QuizSection;
  type: QuizQuestionType;
  difficulty: 1 | 2 | 3;
  stem: string;
  stemSpoken?: string;
  code?: {
    lang: 'ts' | 'tsx' | 'js' | 'yaml' | 'bash' | 'json' | 'hcl';
    content: string;
  };
  explanation: string;
  explanationSpoken?: string;
  tags: string[];
}

export interface QuizMcqQuestion extends QuizQuestionBase {
  type: 'mcq';
  options: Array<{ id: string; text: string; code?: string }>;
  correctOptionId: string;
  distractorNotes?: Record<string, string>;
}

export interface QuizOrderQuestion extends QuizQuestionBase {
  type: 'order';
  items: Array<{ id: string; text: string }>;
  correctOrder: string[];
  orderRationale: string;
}

export type QuizQuestion = QuizMcqQuestion | QuizOrderQuestion;

export type InterviewDomainId =
  | 'testing'
  | 'automation'
  | 'cloud'
  | 'apis'
  | 'typescript'
  | 'frontend'
  | 'platform'
  | 'vald';

export type InterviewSection = 'glossary' | 'depth';
export type InterviewQuestionType = 'mcq' | 'order';

export interface InterviewQuestionBase {
  id: string;
  domain: InterviewDomainId;
  section: InterviewSection;
  type: InterviewQuestionType;
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

export interface InterviewMcqQuestion extends InterviewQuestionBase {
  type: 'mcq';
  options: Array<{ id: string; text: string; code?: string }>;
  correctOptionId: string;
  distractorNotes?: Record<string, string>;
}

export interface InterviewOrderQuestion extends InterviewQuestionBase {
  type: 'order';
  items: Array<{ id: string; text: string }>;
  correctOrder: string[];
  orderRationale: string;
}

export type InterviewQuestion = InterviewMcqQuestion | InterviewOrderQuestion;

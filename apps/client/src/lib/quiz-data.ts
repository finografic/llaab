import apisQuestions from 'vault/quiz/questions/apis.json';
import automationQuestions from 'vault/quiz/questions/automation.json';
import cloudQuestions from 'vault/quiz/questions/cloud.json';
import frontendQuestions from 'vault/quiz/questions/frontend.json';
import platformQuestions from 'vault/quiz/questions/platform.json';
import testingQuestions from 'vault/quiz/questions/testing.json';
import typescriptQuestions from 'vault/quiz/questions/typescript.json';
import valdQuestions from 'vault/quiz/questions/vald.json';

import type { QuizDomainId, QuizQuestion } from 'types/quiz.types';

export interface QuizDomainMeta {
  id: QuizDomainId;
  title: string;
  label: string;
  description: string;
}

export interface QuizDomainStats {
  total: number;
  glossary: number;
  depth: number;
  mcq: number;
  order: number;
}

export const QUIZ_DOMAIN_META: QuizDomainMeta[] = [
  {
    id: 'testing',
    title: 'Testing',
    label: 'Testing',
    description: 'Testing philosophy, Playwright, flake diagnosis and confidence at the right layer.',
  },
  {
    id: 'automation',
    title: 'Automation',
    label: 'Automation',
    description: 'Continuous integration, delivery, infrastructure as code and deployment safety.',
  },
  {
    id: 'cloud',
    title: 'Cloud',
    label: 'Cloud',
    description: 'AWS to Azure vocabulary, honest mappings and where the analogies stop.',
  },
  {
    id: 'apis',
    title: 'APIs',
    label: 'APIs',
    description: 'Contracts, idempotency, versioning, retries, pagination and service boundaries.',
  },
  {
    id: 'typescript',
    title: 'TypeScript',
    label: 'TypeScript',
    description: 'Type safety at boundaries, narrowing, generics, schemas and modelling state.',
  },
  {
    id: 'frontend',
    title: 'Front end',
    label: 'Front end',
    description: 'React architecture, dense data, accessibility, performance and server state.',
  },
  {
    id: 'platform',
    title: 'Platform',
    label: 'Platform',
    description: 'Standards adoption, developer experience, judgement and influence without authority.',
  },
  {
    id: 'vald',
    title: 'VALD',
    label: 'VALD',
    description: 'Product and stack flashcards for Hub, Norms, devices and the role context.',
  },
];

export const QUIZ_QUESTIONS_BY_DOMAIN: Record<QuizDomainId, QuizQuestion[]> = {
  testing: testingQuestions as QuizQuestion[],
  automation: automationQuestions as QuizQuestion[],
  cloud: cloudQuestions as QuizQuestion[],
  apis: apisQuestions as QuizQuestion[],
  typescript: typescriptQuestions as QuizQuestion[],
  frontend: frontendQuestions as QuizQuestion[],
  platform: platformQuestions as QuizQuestion[],
  vald: valdQuestions as QuizQuestion[],
};

export const QUIZ_QUESTIONS = QUIZ_DOMAIN_META.flatMap(({ id }) => QUIZ_QUESTIONS_BY_DOMAIN[id]);

export const QUIZ_DOMAIN_STATS: Record<QuizDomainId, QuizDomainStats> = Object.fromEntries(
  QUIZ_DOMAIN_META.map(({ id }) => {
    const questions = QUIZ_QUESTIONS_BY_DOMAIN[id];

    return [
      id,
      {
        total: questions.length,
        glossary: questions.filter((question) => question.section === 'glossary').length,
        depth: questions.filter((question) => question.section === 'depth').length,
        mcq: questions.filter((question) => question.type === 'mcq').length,
        order: questions.filter((question) => question.type === 'order').length,
      },
    ];
  }),
) as Record<QuizDomainId, QuizDomainStats>;

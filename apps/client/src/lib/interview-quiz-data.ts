import type { InterviewDomainId, InterviewQuestion } from 'types/interview-quiz.types';

import apisQuestions from '../../../../vault/interviews/VALD/questions/apis.json';
import automationQuestions from '../../../../vault/interviews/VALD/questions/automation.json';
import cloudQuestions from '../../../../vault/interviews/VALD/questions/cloud.json';
import frontendQuestions from '../../../../vault/interviews/VALD/questions/frontend.json';
import platformQuestions from '../../../../vault/interviews/VALD/questions/platform.json';
import testingQuestions from '../../../../vault/interviews/VALD/questions/testing.json';
import typescriptQuestions from '../../../../vault/interviews/VALD/questions/typescript.json';
import valdQuestions from '../../../../vault/interviews/VALD/questions/vald.json';

export interface InterviewDomainMeta {
  id: InterviewDomainId;
  title: string;
  label: string;
  description: string;
}

export interface InterviewDomainStats {
  total: number;
  glossary: number;
  depth: number;
  mcq: number;
  order: number;
}

export const INTERVIEW_DOMAIN_META: InterviewDomainMeta[] = [
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

export const INTERVIEW_QUESTIONS_BY_DOMAIN: Record<InterviewDomainId, InterviewQuestion[]> = {
  testing: testingQuestions as InterviewQuestion[],
  automation: automationQuestions as InterviewQuestion[],
  cloud: cloudQuestions as InterviewQuestion[],
  apis: apisQuestions as InterviewQuestion[],
  typescript: typescriptQuestions as InterviewQuestion[],
  frontend: frontendQuestions as InterviewQuestion[],
  platform: platformQuestions as InterviewQuestion[],
  vald: valdQuestions as InterviewQuestion[],
};

export const INTERVIEW_QUESTIONS = INTERVIEW_DOMAIN_META.flatMap(
  ({ id }) => INTERVIEW_QUESTIONS_BY_DOMAIN[id],
);

export const INTERVIEW_DOMAIN_STATS: Record<InterviewDomainId, InterviewDomainStats> = Object.fromEntries(
  INTERVIEW_DOMAIN_META.map(({ id }) => {
    const questions = INTERVIEW_QUESTIONS_BY_DOMAIN[id];

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
) as Record<InterviewDomainId, InterviewDomainStats>;

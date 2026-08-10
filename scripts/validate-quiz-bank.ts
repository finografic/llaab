#!/usr/bin/env bun
/**
 * Validates vault/quiz/questions/<domain>.json against the schema
 * and writing rules in .agents/INTERVIEW_QUIZ_APP_SPEC.md.
 *
 * Usage: bun scripts/validate-quiz-bank.ts <domain>
 * bun scripts/validate-quiz-bank.ts --all
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const QUESTIONS_DIR = join(import.meta.dir, '..', 'vault', 'quiz', 'questions');

const DOMAINS = ['testing', 'automation', 'cloud', 'apis', 'typescript', 'frontend', 'platform', 'vald'];

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function validateDomain(domain: string): string[] {
  const errors: string[] = [];
  const path = join(QUESTIONS_DIR, `${domain}.json`);
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return [`${domain}: file not found at ${path}`];
  }

  let questions: any[];
  try {
    questions = JSON.parse(raw);
  } catch (e) {
    return [`${domain}: invalid JSON — ${(e as Error).message}`];
  }

  if (!Array.isArray(questions)) {
    return [`${domain}: root must be an array`];
  }

  const seenIds = new Set<string>();

  for (const q of questions) {
    const tag = `${domain}/${q.id ?? '(no id)'}`;

    if (!q.id || typeof q.id !== 'string') errors.push(`${tag}: missing id`);
    if (seenIds.has(q.id)) errors.push(`${tag}: duplicate id`);
    seenIds.add(q.id);

    if (q.domain !== domain) {
      errors.push(`${tag}: domain field '${q.domain}' does not match file domain '${domain}'`);
    }
    if (!['glossary', 'depth'].includes(q.section)) errors.push(`${tag}: invalid section '${q.section}'`);
    if (![1, 2, 3].includes(q.difficulty)) errors.push(`${tag}: invalid difficulty '${q.difficulty}'`);
    if (!q.stem || typeof q.stem !== 'string') errors.push(`${tag}: missing stem`);
    if (!q.explanation || typeof q.explanation !== 'string') errors.push(`${tag}: missing explanation`);
    if (!Array.isArray(q.tags) || q.tags.length === 0) errors.push(`${tag}: missing tags`);

    for (const field of ['stem', 'stemSpoken', 'explanation', 'explanationSpoken']) {
      const val = q[field];
      if (typeof val === 'string' && val.includes('—')) {
        errors.push(`${tag}: em-dash found in ${field}`);
      }
    }

    if (q.type === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        errors.push(`${tag}: mcq must have exactly 4 options`);
      } else {
        const optionIds = q.options.map((o: any) => o.id);
        if (!optionIds.includes(q.correctOptionId)) {
          errors.push(`${tag}: correctOptionId '${q.correctOptionId}' not present in options`);
        }
        for (const o of q.options) {
          if (wordCount(o.text ?? '') > 12) {
            errors.push(`${tag}: option '${o.id}' exceeds 12 words`);
          }
        }
      }
    } else if (q.type === 'order') {
      if (!Array.isArray(q.items) || q.items.length < 4 || q.items.length > 6) {
        errors.push(`${tag}: order must have 4 to 6 items`);
      } else {
        const itemIds = q.items.map((i: any) => i.id).sort((a: string, b: string) => a.localeCompare(b));
        const orderIds = [...(q.correctOrder ?? [])].sort((a: string, b: string) => a.localeCompare(b));
        if (JSON.stringify(itemIds) !== JSON.stringify(orderIds)) {
          errors.push(`${tag}: correctOrder is not a permutation of items`);
        }
        for (const i of q.items) {
          if (wordCount(i.text ?? '') > 10) {
            errors.push(`${tag}: item '${i.id}' exceeds 10 words`);
          }
        }
      }
      if (!q.orderRationale || typeof q.orderRationale !== 'string') {
        errors.push(`${tag}: order question missing orderRationale`);
      }
    } else {
      errors.push(`${tag}: invalid type '${q.type}'`);
    }
  }

  return errors;
}

const args = process.argv.slice(2);
const targets = args.includes('--all')
  ? DOMAINS.filter((d) => {
      try {
        readFileSync(join(QUESTIONS_DIR, `${d}.json`));
        return true;
      } catch {
        return false;
      }
    })
  : args;

if (targets.length === 0) {
  console.error('Usage: bun scripts/validate-quiz-bank.ts <domain> | --all');
  process.exit(1);
}

let totalErrors = 0;
for (const domain of targets) {
  const errors = validateDomain(domain);
  if (errors.length === 0) {
    let count = 0;
    try {
      count = JSON.parse(readFileSync(join(QUESTIONS_DIR, `${domain}.json`), 'utf8')).length;
    } catch {
      /* already reported above */
    }
    console.log(`OK  ${domain} (${count} questions)`);
  } else {
    console.log(`FAIL ${domain}`);
    for (const e of errors) console.log(`  - ${e}`);
    totalErrors += errors.length;
  }
}

if (totalErrors > 0) {
  console.error(`\n${totalErrors} error(s) found.`);
  process.exit(1);
}

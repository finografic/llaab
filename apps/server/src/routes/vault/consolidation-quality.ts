export interface ConsolidationQualityCandidate {
  id: string;
  title: string;
  body?: string;
  domains: string[];
  tags: string[];
}

export interface ConsolidationQualityCanonical {
  title: string;
  body: string;
  tags: string[];
  keyClaims?: string[];
  sourceCandidateIdeaIds: string[];
}

export interface ConsolidationQualityIssue {
  code: string;
  message: string;
}

export interface ConsolidationQualityResult {
  passed: boolean;
  issues: ConsolidationQualityIssue[];
}

const MIN_CANONICAL_IDEAS = 4;
const MAX_CANONICAL_IDEAS = 6;
const MIN_COVERAGE_RATIO = 0.8;

function candidateHaystack(candidate: ConsolidationQualityCandidate): string {
  return `${candidate.id} ${candidate.title} ${candidate.body ?? ''} ${candidate.tags.join(' ')} ${candidate.domains.join(' ')}`.toLocaleLowerCase();
}

function canonicalHaystack(idea: ConsolidationQualityCanonical): string {
  return `${idea.title} ${idea.body} ${idea.tags.join(' ')} ${(idea.keyClaims ?? []).join(' ')}`.toLocaleLowerCase();
}

function matchesAny(haystack: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(haystack));
}

function countMatchingCandidates(candidates: ConsolidationQualityCandidate[], patterns: RegExp[]): number {
  return candidates.filter((candidate) => matchesAny(candidateHaystack(candidate), patterns)).length;
}

function anyCanonicalMatches(canonicalIdeas: ConsolidationQualityCanonical[], patterns: RegExp[]): boolean {
  return canonicalIdeas.some((idea) => matchesAny(canonicalHaystack(idea), patterns));
}

function hasDomainTag(idea: ConsolidationQualityCanonical): boolean {
  return idea.tags.some((tag) => tag.startsWith('d:'));
}

const V8_CANDIDATE_PATTERNS = [/\bv8\b/, /isolate/, /sandbox/, /multi-tenant/, /runtime-isolation/];
const V8_CANONICAL_PATTERNS = [/runtime-isolation/, /sandbox/, /\bv8\b/, /v8-isolate/];

const NON_DETERMINISM_CANDIDATE_PATTERNS = [/non-determinism/, /non-deterministic/, /non determinism/];
const NON_DETERMINISM_CANONICAL_PATTERNS = [/non-determinism/, /non-deterministic/, /model-behavior/];

const BASH_CANDIDATE_PATTERNS = [/\bbash\b/];
const BASH_CANONICAL_PATTERNS = [
  /\bbash\b/,
  /foundational/,
  /limited/,
  /execution layer/,
  /inherent limitation/,
];

const TYPED_EXECUTION_CANDIDATE_PATTERNS = [
  /typescript/,
  /typed[- ]execution/,
  /typed[- ]environment/,
  /programmable[- ]execution/,
  /typescript[- ]sdk/,
  /structured[- ]typescript/,
];
const TYPED_EXECUTION_CANONICAL_PATTERNS = [
  /typed/,
  /programmable/,
  /typescript/,
  /structured.*execution/,
  /execution layer/,
];

export function validateConsolidationQuality(
  candidates: ConsolidationQualityCandidate[],
  canonicalIdeas: ConsolidationQualityCanonical[],
  coveredCandidateIds: Iterable<string>,
): ConsolidationQualityResult {
  const issues: ConsolidationQualityIssue[] = [];
  const coveredCount = new Set(coveredCandidateIds).size;
  const totalCandidates = candidates.length;

  if (canonicalIdeas.length < MIN_CANONICAL_IDEAS || canonicalIdeas.length > MAX_CANONICAL_IDEAS) {
    issues.push({
      code: 'canonical_count',
      message: `Expected ${MIN_CANONICAL_IDEAS}–${MAX_CANONICAL_IDEAS} canonical ideas, got ${canonicalIdeas.length}.`,
    });
  }

  if (totalCandidates > 0 && coveredCount / totalCandidates < MIN_COVERAGE_RATIO) {
    const pct = Math.round((coveredCount / totalCandidates) * 100);
    issues.push({
      code: 'candidate_coverage',
      message: `Candidate coverage is ${pct}% (minimum ${Math.round(MIN_COVERAGE_RATIO * 100)}%).`,
    });
  }

  const missingDomainTags = canonicalIdeas.filter((idea) => !hasDomainTag(idea));
  if (missingDomainTags.length > 0) {
    issues.push({
      code: 'domain_tags',
      message: `${missingDomainTags.length} canonical idea(s) are missing a domain tag (d:*).`,
    });
  }

  const hasV8Candidates = candidates.some((candidate) =>
    matchesAny(candidateHaystack(candidate), V8_CANDIDATE_PATTERNS),
  );
  if (hasV8Candidates && !anyCanonicalMatches(canonicalIdeas, V8_CANONICAL_PATTERNS)) {
    issues.push({
      code: 'v8_runtime',
      message:
        'V8/runtime isolation candidates exist but no canonical idea covers sandboxing or V8 isolates.',
    });
  }

  const nonDeterminismCandidateCount = countMatchingCandidates(
    candidates,
    NON_DETERMINISM_CANDIDATE_PATTERNS,
  );
  if (
    nonDeterminismCandidateCount >= 2 &&
    !anyCanonicalMatches(canonicalIdeas, NON_DETERMINISM_CANONICAL_PATTERNS)
  ) {
    issues.push({
      code: 'non_determinism',
      message:
        'Multiple non-determinism candidates exist but no canonical idea captures model non-determinism.',
    });
  }

  const hasBashCandidates = candidates.some((candidate) =>
    matchesAny(candidateHaystack(candidate), BASH_CANDIDATE_PATTERNS),
  );
  if (hasBashCandidates && !anyCanonicalMatches(canonicalIdeas, BASH_CANONICAL_PATTERNS)) {
    issues.push({
      code: 'bash_execution',
      message:
        'Bash-related candidates exist but no canonical idea captures Bash as a foundational but limited execution layer.',
    });
  }

  const hasTypedExecutionCandidates = candidates.some((candidate) =>
    matchesAny(candidateHaystack(candidate), TYPED_EXECUTION_CANDIDATE_PATTERNS),
  );
  if (
    hasTypedExecutionCandidates &&
    !anyCanonicalMatches(canonicalIdeas, TYPED_EXECUTION_CANONICAL_PATTERNS)
  ) {
    issues.push({
      code: 'typed_execution',
      message:
        'Typed execution candidates exist but no canonical idea captures typed or programmable execution layers.',
    });
  }

  return { passed: issues.length === 0, issues };
}

export function formatConsolidationQualityWarning(result: ConsolidationQualityResult): string | undefined {
  if (result.passed) return undefined;
  return `Consolidation quality check: ${result.issues.map((issue) => issue.message).join(' ')}`;
}

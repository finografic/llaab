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
  score: number;
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

function anyCanonicalMatches(canonicalIdeas: ConsolidationQualityCanonical[], patterns: RegExp[]): boolean {
  return canonicalIdeas.some((idea) => matchesAny(canonicalHaystack(idea), patterns));
}

function hasDomainTag(idea: ConsolidationQualityCanonical): boolean {
  return idea.tags.some((tag) => tag.startsWith('d:'));
}

const CONTEXT_CANDIDATE_PATTERNS = [
  /context stuffing/,
  /context-stuffing/,
  /targeted retrieval/,
  /code-generated search/,
  /context-retrieval/,
  /context-window-bloat/,
  /dumping.*codebase/,
];
const CONTEXT_CANONICAL_PATTERNS = [
  /context stuffing/,
  /targeted retrieval/,
  /retrieval/,
  /grep/,
  /code-driven/,
  /token-efficiency/,
];

const V8_CANDIDATE_PATTERNS = [/\bv8\b/, /isolate/, /sandbox/, /multi-tenant/, /runtime-isolation/];
const V8_CANONICAL_PATTERNS = [/runtime-isolation/, /sandbox/, /\bv8\b/, /v8-isolate/];

const NON_DETERMINISM_CANDIDATE_PATTERNS = [/non-determinism/, /non-deterministic/, /non determinism/];
const NON_DETERMINISM_TEXT_PATTERNS = [
  /non-determinism/,
  /non-deterministic/,
  /unpredictability/,
  /stochasticity/,
  /model behavior/,
  /model-behavior/,
];
const NON_DETERMINISM_TAG_PATTERNS = [/^non-determinism$/, /^model-behavior$/];

function getNonDeterminismCandidates(
  candidates: ConsolidationQualityCandidate[],
): ConsolidationQualityCandidate[] {
  return candidates.filter((candidate) =>
    matchesAny(candidateHaystack(candidate), NON_DETERMINISM_CANDIDATE_PATTERNS),
  );
}

function isDedicatedNonDeterminismIdea(idea: ConsolidationQualityCanonical): boolean {
  const titleBody = `${idea.title} ${idea.body}`.toLocaleLowerCase();
  const hasRequiredText = matchesAny(titleBody, NON_DETERMINISM_TEXT_PATTERNS);
  const hasRequiredTag = idea.tags.some((tag) =>
    NON_DETERMINISM_TAG_PATTERNS.some((pattern) => pattern.test(tag)),
  );
  return hasRequiredText && hasRequiredTag;
}

function hasDedicatedNonDeterminismCanonical(
  canonicalIdeas: ConsolidationQualityCanonical[],
  nonDeterminismCandidates: ConsolidationQualityCandidate[],
): boolean {
  if (nonDeterminismCandidates.length === 0) return true;

  const nonDeterminismCandidateIds = new Set(nonDeterminismCandidates.map((candidate) => candidate.id));
  return canonicalIdeas.some(
    (idea) =>
      isDedicatedNonDeterminismIdea(idea) &&
      idea.sourceCandidateIdeaIds.some((candidateId) => nonDeterminismCandidateIds.has(candidateId)),
  );
}

function nonDeterminismScoreRatio(
  canonicalIdeas: ConsolidationQualityCanonical[],
  nonDeterminismCandidates: ConsolidationQualityCandidate[],
): number {
  if (nonDeterminismCandidates.length < 2) return 1;
  if (hasDedicatedNonDeterminismCanonical(canonicalIdeas, nonDeterminismCandidates)) return 1;
  if (anyCanonicalMatches(canonicalIdeas, NON_DETERMINISM_TEXT_PATTERNS)) return 0.35;
  return 0;
}

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

function canonicalCountScoreRatio(count: number): number {
  if (count >= MIN_CANONICAL_IDEAS && count <= MAX_CANONICAL_IDEAS) return 1;
  if (count === MIN_CANONICAL_IDEAS - 1 || count === MAX_CANONICAL_IDEAS + 1) return 0.6;
  if (count === MIN_CANONICAL_IDEAS - 2 || count === MAX_CANONICAL_IDEAS + 2) return 0.3;
  return 0;
}

interface QualityScoreComponent {
  applicable: boolean;
  ratio: number;
  weight: number;
}

function buildQualityScoreComponents(
  candidates: ConsolidationQualityCandidate[],
  canonicalIdeas: ConsolidationQualityCanonical[],
  coveredCandidateIds: Iterable<string>,
): QualityScoreComponent[] {
  const coveredCount = new Set(coveredCandidateIds).size;
  const totalCandidates = candidates.length;
  const coverageRatio = totalCandidates > 0 ? coveredCount / totalCandidates : 1;
  const domainTagRatio =
    canonicalIdeas.length > 0
      ? canonicalIdeas.filter((idea) => hasDomainTag(idea)).length / canonicalIdeas.length
      : 0;

  const hasContextCandidates = candidates.some((candidate) =>
    matchesAny(candidateHaystack(candidate), CONTEXT_CANDIDATE_PATTERNS),
  );
  const hasV8Candidates = candidates.some((candidate) =>
    matchesAny(candidateHaystack(candidate), V8_CANDIDATE_PATTERNS),
  );
  const nonDeterminismCandidates = getNonDeterminismCandidates(candidates);
  const hasBashCandidates = candidates.some((candidate) =>
    matchesAny(candidateHaystack(candidate), BASH_CANDIDATE_PATTERNS),
  );
  const hasTypedExecutionCandidates = candidates.some((candidate) =>
    matchesAny(candidateHaystack(candidate), TYPED_EXECUTION_CANDIDATE_PATTERNS),
  );

  return [
    {
      applicable: canonicalIdeas.length > 0,
      ratio: canonicalCountScoreRatio(canonicalIdeas.length),
      weight: 15,
    },
    {
      applicable: totalCandidates > 0,
      ratio: Math.min(1, coverageRatio / MIN_COVERAGE_RATIO),
      weight: 20,
    },
    {
      applicable: canonicalIdeas.length > 0,
      ratio: domainTagRatio,
      weight: 10,
    },
    {
      applicable: hasContextCandidates,
      ratio: anyCanonicalMatches(canonicalIdeas, CONTEXT_CANONICAL_PATTERNS) ? 1 : 0,
      weight: 15,
    },
    {
      applicable: hasV8Candidates,
      ratio: anyCanonicalMatches(canonicalIdeas, V8_CANONICAL_PATTERNS) ? 1 : 0,
      weight: 15,
    },
    {
      applicable: nonDeterminismCandidates.length >= 2,
      ratio: nonDeterminismScoreRatio(canonicalIdeas, nonDeterminismCandidates),
      weight: 15,
    },
    {
      applicable: hasBashCandidates,
      ratio: anyCanonicalMatches(canonicalIdeas, BASH_CANONICAL_PATTERNS) ? 1 : 0,
      weight: 10,
    },
    {
      applicable: hasTypedExecutionCandidates,
      ratio: anyCanonicalMatches(canonicalIdeas, TYPED_EXECUTION_CANONICAL_PATTERNS) ? 1 : 0,
      weight: 10,
    },
  ];
}

export function scoreConsolidationQuality(
  candidates: ConsolidationQualityCandidate[],
  canonicalIdeas: ConsolidationQualityCanonical[],
  coveredCandidateIds: Iterable<string>,
): number {
  const components = buildQualityScoreComponents(candidates, canonicalIdeas, coveredCandidateIds);
  let totalWeight = 0;
  let earned = 0;

  for (const component of components) {
    if (!component.applicable) continue;
    totalWeight += component.weight;
    earned += component.weight * component.ratio;
  }

  if (totalWeight === 0) return 100;
  return Math.round((earned / totalWeight) * 100);
}

export function validateConsolidationQuality(
  candidates: ConsolidationQualityCandidate[],
  canonicalIdeas: ConsolidationQualityCanonical[],
  coveredCandidateIds: Iterable<string>,
): ConsolidationQualityResult {
  const issues: ConsolidationQualityIssue[] = [];
  const coveredCount = new Set(coveredCandidateIds).size;
  const totalCandidates = candidates.length;
  const score = scoreConsolidationQuality(candidates, canonicalIdeas, coveredCandidateIds);

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

  const hasContextCandidates = candidates.some((candidate) =>
    matchesAny(candidateHaystack(candidate), CONTEXT_CANDIDATE_PATTERNS),
  );
  if (hasContextCandidates && !anyCanonicalMatches(canonicalIdeas, CONTEXT_CANONICAL_PATTERNS)) {
    issues.push({
      code: 'context_retrieval',
      message:
        'Context retrieval candidates exist but no canonical idea captures targeted retrieval or context optimization.',
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

  const nonDeterminismCandidates = getNonDeterminismCandidates(candidates);
  if (
    nonDeterminismCandidates.length >= 2 &&
    !hasDedicatedNonDeterminismCanonical(canonicalIdeas, nonDeterminismCandidates)
  ) {
    issues.push({
      code: 'non_determinism_separate',
      message:
        'Multiple non-determinism candidates exist but no dedicated canonical idea captures model behavior (non-determinism or model-behavior tag, with non-determinism candidates as sources). Folding non-determinism into a context-retrieval idea is not sufficient.',
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

  return { passed: issues.length === 0, score, issues };
}

export function formatConsolidationQualityWarning(result: ConsolidationQualityResult): string | undefined {
  if (result.passed) return undefined;
  return `Consolidation quality check: ${result.issues.map((issue) => issue.message).join(' ')}`;
}

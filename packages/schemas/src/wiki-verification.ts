import type { WikiEvidenceMetrics } from './wiki-evidence-metrics.js';
import type { WikiContestedClaimEvidence, WikiSourceRef, WikiVerificationStatus } from './wiki.schema.js';

export interface WikiMaterialClaimSupport {
  claim: string;
  /** Independent origin ids supporting the claim (from resolveWikiSourceOriginIdentity). */
  supporting_origin_ids: string[];
  /** Independent origin ids that explicitly oppose the claim. */
  opposing_origin_ids?: string[];
}

export interface DetermineWikiVerificationInput {
  sourceRefs: WikiSourceRef[];
  contestedClaims?: string[];
  contestedClaimEvidence?: WikiContestedClaimEvidence[];
  evidenceMetrics?: WikiEvidenceMetrics;
  materialClaims?: WikiMaterialClaimSupport[];
  /**
   * Preserve an already-corroborated promoted page when updating without new contradiction.
   * Does not elevate contested material.
   */
  currentVerificationStatus?: WikiVerificationStatus;
}

function hasExplicitOpposingEvidenceGroups(
  contestedClaimEvidence: WikiContestedClaimEvidence[] | undefined,
): boolean {
  return (contestedClaimEvidence ?? []).some(
    (item) =>
      item.claim.trim().length > 0 &&
      item.existing_source_ref_ids.length > 0 &&
      item.incoming_source_ref_ids.length > 0,
  );
}

function hasMaterialClaimContradiction(materialClaims: WikiMaterialClaimSupport[] | undefined): boolean {
  return (materialClaims ?? []).some(
    (claim) => claim.supporting_origin_ids.length > 0 && (claim.opposing_origin_ids?.length ?? 0) > 0,
  );
}

function hasValidatedAuthoritativeExternal(sourceRefs: WikiSourceRef[]): boolean {
  return sourceRefs.some(
    (ref) =>
      ref.kind === 'external' &&
      ref.verification === 'corroborated' &&
      (ref.validation_notes?.length ?? 0) === 0,
  );
}

function hasIndependentClaimCorroboration(materialClaims: WikiMaterialClaimSupport[] | undefined): boolean {
  return (materialClaims ?? []).some((claim) => {
    const origins = new Set(claim.supporting_origin_ids.filter(Boolean));
    return origins.size >= 2 && (claim.opposing_origin_ids?.length ?? 0) === 0;
  });
}

/**
 * Central verification calculator for wiki drafts and promoted pages.
 *
 * - `contested` only when opposing evidence groups exist for the same claim
 * - `corroborated` only with ≥2 independent origins or a validated authoritative external
 * - Otherwise `source-backed` when claims resolve to supplied evidence
 *
 * Low diversity, unresolved questions, ambiguity, and weak citations are separate issues and
 * must not alone imply `contested`.
 */
export function determineWikiVerificationStatus(
  input: DetermineWikiVerificationInput,
): WikiVerificationStatus {
  if (
    hasExplicitOpposingEvidenceGroups(input.contestedClaimEvidence) ||
    hasMaterialClaimContradiction(input.materialClaims)
  ) {
    return 'contested';
  }

  // Contested claim strings without opposing evidence groups are warnings, not verification state.
  // Independent-source count alone is insufficient — require claim-level support or
  // a validated authoritative external. Low diversity remains a quality warning.
  if (
    hasValidatedAuthoritativeExternal(input.sourceRefs) ||
    hasIndependentClaimCorroboration(input.materialClaims)
  ) {
    return 'corroborated';
  }

  if (input.currentVerificationStatus === 'corroborated') {
    return 'corroborated';
  }

  return 'source-backed';
}

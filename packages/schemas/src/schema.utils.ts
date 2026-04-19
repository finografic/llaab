import type { NodeType } from './primitives.schema.js';
import type { ZodType } from 'zod';

import { DecisionNodeSchema } from './decision-node.schema.js';
import { IdeaNodeSchema } from './idea-node.schema.js';
import { InstructionNodeSchema } from './instruction-node.schema.js';
import { NodeTypeSchema, TimestampSchema } from './primitives.schema.js';
import { PromptNodeSchema } from './prompt-node.schema.js';
import { ResourceNodeSchema } from './resource-node.schema.js';
import { RunNodeSchema } from './run-node.schema.js';
import { SkillNodeSchema } from './skill-node.schema.js';
import { SourceNodeSchema } from './source-node.schema.js';
import { TranscriptNodeSchema } from './transcript-node.schema.js';

export const nodeSchemaByType: Record<NodeType, ZodType> = {
  decision: DecisionNodeSchema,
  idea: IdeaNodeSchema,
  instruction: InstructionNodeSchema,
  prompt: PromptNodeSchema,
  resource: ResourceNodeSchema,
  run: RunNodeSchema,
  skill: SkillNodeSchema,
  source: SourceNodeSchema,
  transcript: TranscriptNodeSchema,
};

/**
 * Canonical stored UTC instant for frontmatter and run metadata: ISO 8601 without fractional seconds.
 * Example: `2026-04-12T15:59:39Z`
 */
export function formatIsoUtcSeconds(date: Date): string {
  const s = date.toISOString();
  return s.includes('.') ? s.replace(/\.\d{3}Z$/, 'Z') : s;
}

/**
 * UTC instant for human-readable transcript bodies (no `T` or `Z`). Example: `2026-04-12T15:59:39Z` →
 * `2026-04-12 15:59:39`
 */
export function formatIsoUtcForTranscriptBody(isoUtc: string): string {
  const noMs = isoUtc.includes('.') ? isoUtc.replace(/\.\d{3}Z$/, 'Z') : isoUtc;
  const m = noMs.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})Z$/);
  if (m) return `${m[1]} ${m[2]}`;
  return isoUtc
    .replace('T', ' ')
    .replace(/Z$/, '')
    .replace(/\.\d{3}$/, '');
}

/**
 * Filesystem-safe instant fragment for node ids (not full ISO): keep uppercase `T` between date and time
 * (same as ISO 8601), `:` → `-` in the time part, no trailing `Z`. Example: `2026-04-12T15-59-39`
 */
export function formatInstantForFilenameId(date: Date): string {
  return formatIsoUtcSeconds(date).replace(/:/g, '-').replace(/Z$/, '');
}

/**
 * Joins a slug prefix to the filesystem-safe datetime fragment with **`_`** (datetime is always its own
 * segment). Use for any node id that ends with a timestamp (runs, untitled transcripts, etc.).
 */
export function appendDatetimeFilenameSegment(prefix: string, date: Date): string {
  return `${prefix}_${formatInstantForFilenameId(date)}`;
}

/** Deterministic run node id: `{skill-slug}-run_{date_time}` (underscore before the instant). */
export function buildRunNodeId(skillName: string, startedAt: Date): string {
  return appendDatetimeFilenameSegment(`${toNodeId(skillName)}-run`, startedAt);
}

export function now(): string {
  return formatIsoUtcSeconds(new Date());
}

export function toNodeId(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['\u2018\u2019"\u201C\u201D]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || 'untitled-node';
}

export function formatNodeFilename(type: NodeType, id: string): string {
  return `${type}.${id}.md`;
}

export function isNodeType(value: string): value is NodeType {
  return NodeTypeSchema.safeParse(value).success;
}

export function isTimestamp(value: string): boolean {
  return TimestampSchema.safeParse(value).success;
}

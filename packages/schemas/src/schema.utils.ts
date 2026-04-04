import type { ZodType } from 'zod';

import { DecisionNodeSchema } from './decision-node.schema.js';
import { IdeaNodeSchema } from './idea-node.schema.js';
import { InstructionNodeSchema } from './instruction-node.schema.js';
import { type NodeType, NodeTypeSchema, TimestampSchema } from './primitives.schema.js';
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

export function now(): string {
  return new Date().toISOString();
}

export function toNodeId(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['"]/g, '')
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

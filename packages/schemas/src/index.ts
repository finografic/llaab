import { z } from 'zod';

// ─── Node Types ───────────────────────────────────────────────────────────────

export const NodeTypeSchema = z.enum(['idea', 'decision', 'prompt', 'instruction', 'resource']);

export type NodeType = z.infer<typeof NodeTypeSchema>;

// ─── Base Node ────────────────────────────────────────────────────────────────

export const BaseNodeSchema = z.object({
  id: z.string().uuid(),
  type: NodeTypeSchema,
  title: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  tags: z.array(z.string()).default([]),
  body: z.string().default(''),
});

export type BaseNode = z.infer<typeof BaseNodeSchema>;

// ─── Idea Node ────────────────────────────────────────────────────────────────

export const IdeaNodeSchema = BaseNodeSchema.extend({
  type: z.literal('idea'),
  status: z.enum(['raw', 'developing', 'captured']).default('raw'),
});

export type IdeaNode = z.infer<typeof IdeaNodeSchema>;

// ─── Decision Node ────────────────────────────────────────────────────────────

export const DecisionNodeSchema = BaseNodeSchema.extend({
  type: z.literal('decision'),
  context: z.string().default(''),
  rationale: z.string().default(''),
  status: z.enum(['proposed', 'accepted', 'superseded']).default('proposed'),
});

export type DecisionNode = z.infer<typeof DecisionNodeSchema>;

// ─── Prompt Node ──────────────────────────────────────────────────────────────

export const PromptNodeSchema = BaseNodeSchema.extend({
  type: z.literal('prompt'),
  model: z.string().optional(),
  template: z.string().default(''),
});

export type PromptNode = z.infer<typeof PromptNodeSchema>;

// ─── Instruction Node ─────────────────────────────────────────────────────────

export const InstructionNodeSchema = BaseNodeSchema.extend({
  type: z.literal('instruction'),
  scope: z.string().default(''),
});

export type InstructionNode = z.infer<typeof InstructionNodeSchema>;

// ─── Resource Node ────────────────────────────────────────────────────────────

export const ResourceNodeSchema = BaseNodeSchema.extend({
  type: z.literal('resource'),
  url: z.string().url().optional(),
  sourceType: z.enum(['youtube', 'article', 'book', 'podcast', 'other']).default('other'),
});

export type ResourceNode = z.infer<typeof ResourceNodeSchema>;

// ─── Union ────────────────────────────────────────────────────────────────────

export const AnyNodeSchema = z.discriminatedUnion('type', [
  IdeaNodeSchema,
  DecisionNodeSchema,
  PromptNodeSchema,
  InstructionNodeSchema,
  ResourceNodeSchema,
]);

export type AnyNode = z.infer<typeof AnyNodeSchema>;

// ─── Frontmatter ──────────────────────────────────────────────────────────────

export const FrontmatterSchema = z.object({
  id: z.string(),
  type: NodeTypeSchema,
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()).default([]),
});

export type Frontmatter = z.infer<typeof FrontmatterSchema>;

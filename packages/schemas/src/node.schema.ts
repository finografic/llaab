import { z } from 'zod';

import { CanonicalIdeaNodeSchema } from './canonical-idea-node.schema.js';
import { DecisionNodeSchema } from './decision-node.schema.js';
import { IdeaNodeSchema } from './idea-node.schema.js';
import { InstructionNodeSchema } from './instruction-node.schema.js';
import { PromptNodeSchema } from './prompt-node.schema.js';
import { ResourceNodeSchema } from './resource-node.schema.js';
import { RunNodeSchema } from './run-node.schema.js';
import { SkillNodeSchema } from './skill-node.schema.js';
import { SourceNodeSchema } from './source-node.schema.js';
import { TranscriptNodeSchema } from './transcript-node.schema.js';
import { WikiDraftNodeSchema } from './wiki-draft-node.schema.js';

export const NodeSchema = z.discriminatedUnion('type', [
  CanonicalIdeaNodeSchema,
  IdeaNodeSchema,
  SkillNodeSchema,
  PromptNodeSchema,
  InstructionNodeSchema,
  TranscriptNodeSchema,
  ResourceNodeSchema,
  SourceNodeSchema,
  DecisionNodeSchema,
  RunNodeSchema,
  WikiDraftNodeSchema,
]);

export type LabNode = z.infer<typeof NodeSchema>;

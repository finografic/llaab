import { z } from '@llaab/schemas';

export const CommandSourceSchema = z.enum(['terminal', 'ui', 'cli', 'agent']);

export const AiRunCommandSchema = z.object({
  kind: z.literal('ai.run'),
  task: z.enum(['format', 'extract', 'code', 'reason']),
  prompt: z.string().min(1),
  model: z.string().min(1).optional(),
  system: z.string().min(1).optional(),
  maxTokens: z.number().int().positive().optional(),
});

export const AgentRunCommandSchema = z.object({
  kind: z.literal('agent.run'),
  nodeId: z.string().min(1).optional(),
  force: z.boolean().optional(),
});

export const FsReadCommandSchema = z.object({
  kind: z.literal('fs.read'),
  path: z.string().min(1),
});

export const FsListCommandSchema = z.object({
  kind: z.literal('fs.list'),
  path: z.string().min(1),
});

export const CommandSchema = z.discriminatedUnion('kind', [
  AiRunCommandSchema,
  AgentRunCommandSchema,
  FsReadCommandSchema,
  FsListCommandSchema,
]);

export const CommandEnvelopeSchema = z.object({
  id: z.string().min(1),
  source: CommandSourceSchema,
  timestamp: z.string().datetime(),
  command: CommandSchema,
});

export const TokenOutputEventSchema = z.object({
  type: z.literal('token'),
  data: z.string(),
});

export const StdoutOutputEventSchema = z.object({
  type: z.literal('stdout'),
  data: z.string(),
});

export const StderrOutputEventSchema = z.object({
  type: z.literal('stderr'),
  data: z.string(),
});

export const MetaOutputEventSchema = z.object({
  type: z.literal('meta'),
  data: z.record(z.string(), z.unknown()),
});

export const ErrorOutputEventSchema = z.object({
  type: z.literal('error'),
  message: z.string().min(1),
  code: z.string().min(1).optional(),
});

export const DoneOutputEventSchema = z.object({
  type: z.literal('done'),
  code: z.number().int(),
});

export const OutputEventSchema = z.discriminatedUnion('type', [
  TokenOutputEventSchema,
  StdoutOutputEventSchema,
  StderrOutputEventSchema,
  MetaOutputEventSchema,
  ErrorOutputEventSchema,
  DoneOutputEventSchema,
]);

export const OutputEnvelopeSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime(),
  event: OutputEventSchema,
});

export type CommandSource = z.infer<typeof CommandSourceSchema>;
export type Command = z.infer<typeof CommandSchema>;
export type AiRunCommand = z.infer<typeof AiRunCommandSchema>;
export type AgentRunCommand = z.infer<typeof AgentRunCommandSchema>;
export type FsReadCommand = z.infer<typeof FsReadCommandSchema>;
export type FsListCommand = z.infer<typeof FsListCommandSchema>;
export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;
export type OutputEvent = z.infer<typeof OutputEventSchema>;
export type OutputEnvelope = z.infer<typeof OutputEnvelopeSchema>;

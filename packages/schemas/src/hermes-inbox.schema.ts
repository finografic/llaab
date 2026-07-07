import { z } from 'zod';

import { TimestampSchema } from './primitives.schema.js';

export const HermesInboxPlatformSchema = z.enum(['telegram', 'discord', 'manual', 'unknown']);

export const HermesInboxAttachmentKindSchema = z.enum(['file', 'image', 'unknown']);

export const HermesInboxAttachmentSchema = z.object({
  kind: HermesInboxAttachmentKindSchema.default('unknown'),
  file_name: z.string().min(1).optional(),
  mime_type: z.string().min(1).optional(),
  size_bytes: z.number().int().nonnegative().optional(),
  local_path: z.string().min(1).optional(),
  url: z.url().optional(),
});

export const HermesInboxSourceSchema = z.object({
  platform: HermesInboxPlatformSchema.default('unknown'),
  user_id: z.string().min(1).optional(),
  chat_id: z.string().min(1).optional(),
  message_id: z.string().min(1).optional(),
  timestamp: TimestampSchema.optional(),
});

export const HermesInboxItemSchema = z.object({
  raw_text: z.string().optional(),
  attachments: z.array(HermesInboxAttachmentSchema).default([]),
  source: HermesInboxSourceSchema.default({ platform: 'unknown' }),
  received_at: TimestampSchema.optional(),
});

export const HermesInboxRouteKindSchema = z.enum([
  'youtube_url',
  'npm_package',
  'command_candidate',
  'todo',
  'github_repo',
  'web_link',
  'attachment',
  'raw',
]);

export const HermesInboxRouteActionSchema = z.enum([
  'ingest_youtube',
  'pin_library',
  'capture_command_candidate',
  'capture_todo',
  'capture_web_link',
  'capture_attachment',
  'capture_raw',
]);

export const HermesInboxRouteSchema = z.object({
  kind: HermesInboxRouteKindSchema,
  confidence: z.number().min(0).max(1),
  action: HermesInboxRouteActionSchema,
  payload: z.record(z.string(), z.unknown()),
  reason: z.string().min(1).optional(),
});

export const HermesInboxToolNameSchema = z.enum([
  'vault_capture_inbox',
  'vault_ingest_youtube',
  'vault_pin_library',
  'vault_capture_todo',
  'vault_capture_web_link',
  'vault_capture_attachment',
]);

export const HermesInboxToolCallSchema = z.object({
  name: HermesInboxToolNameSchema,
  arguments: z.record(z.string(), z.unknown()),
});

export const HermesInboxExecutionStatusSchema = z.enum(['queued', 'captured', 'pinned', 'saved', 'failed']);

export const HermesInboxExecutionResultSchema = z.object({
  status: HermesInboxExecutionStatusSchema,
  target_id: z.string().min(1).optional(),
  target_label: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
});

export const HermesInboxReceiptSchema = z.object({
  text: z.string().min(1),
  status: HermesInboxExecutionStatusSchema,
});

export const HermesInboxLogEventSchema = z.object({
  event: z.literal('hermes_inbox_route'),
  route: HermesInboxRouteSchema,
  tool_call: HermesInboxToolCallSchema.optional(),
  receipt: HermesInboxReceiptSchema,
  status: HermesInboxExecutionStatusSchema,
  error: z.string().min(1).optional(),
});

export type HermesInboxPlatform = z.infer<typeof HermesInboxPlatformSchema>;
export type HermesInboxAttachmentKind = z.infer<typeof HermesInboxAttachmentKindSchema>;
export type HermesInboxAttachment = z.infer<typeof HermesInboxAttachmentSchema>;
export type HermesInboxSource = z.infer<typeof HermesInboxSourceSchema>;
export type HermesInboxItem = z.infer<typeof HermesInboxItemSchema>;
export type HermesInboxRouteKind = z.infer<typeof HermesInboxRouteKindSchema>;
export type HermesInboxRouteAction = z.infer<typeof HermesInboxRouteActionSchema>;
export type HermesInboxRoute = z.infer<typeof HermesInboxRouteSchema>;
export type HermesInboxToolName = z.infer<typeof HermesInboxToolNameSchema>;
export type HermesInboxToolCall = z.infer<typeof HermesInboxToolCallSchema>;
export type HermesInboxExecutionStatus = z.infer<typeof HermesInboxExecutionStatusSchema>;
export type HermesInboxExecutionResult = z.infer<typeof HermesInboxExecutionResultSchema>;
export type HermesInboxReceipt = z.infer<typeof HermesInboxReceiptSchema>;
export type HermesInboxLogEvent = z.infer<typeof HermesInboxLogEventSchema>;

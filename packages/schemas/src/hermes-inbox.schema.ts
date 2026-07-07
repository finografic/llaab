import { z } from 'zod';

import { TimestampSchema } from './primitives.schema.js';

export const HermesInboxPlatformSchema = z.enum(['telegram', 'discord', 'manual', 'unknown']);

export const HermesInboxAttachmentKindSchema = z.enum(['file', 'image', 'unknown']);

export const HermesInboxAttachmentSchema = z.object({
  kind: HermesInboxAttachmentKindSchema.default('unknown'),
  file_name: z.string().min(1).optional(),
  mime_type: z.string().min(1).optional(),
  size_bytes: z.number().int().nonnegative().optional(),
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

export type HermesInboxPlatform = z.infer<typeof HermesInboxPlatformSchema>;
export type HermesInboxAttachmentKind = z.infer<typeof HermesInboxAttachmentKindSchema>;
export type HermesInboxAttachment = z.infer<typeof HermesInboxAttachmentSchema>;
export type HermesInboxSource = z.infer<typeof HermesInboxSourceSchema>;
export type HermesInboxItem = z.infer<typeof HermesInboxItemSchema>;
export type HermesInboxRouteKind = z.infer<typeof HermesInboxRouteKindSchema>;
export type HermesInboxRouteAction = z.infer<typeof HermesInboxRouteActionSchema>;
export type HermesInboxRoute = z.infer<typeof HermesInboxRouteSchema>;

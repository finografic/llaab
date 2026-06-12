import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';

export const SourceKindSchema = z.enum(['person', 'channel', 'repo', 'publication', 'organization', 'other']);
export const SourceProfilePlatformSchema = z.enum([
  'youtube',
  'github',
  'x',
  'bluesky',
  'website',
  'twitch',
  'npm',
]);

export const SourceProfileSchema = z.object({
  platform: SourceProfilePlatformSchema,
  url: z.string().url(),
  handle: z.string().optional(),
  label: z.string().optional(),
  primary: z.boolean().optional(),
});

export const SourceNodeSchema = BaseNodeSchema.extend({
  type: z.literal('source'),
  source_kind: SourceKindSchema.default('other'),
  url: z.string().url().optional(),
  platforms: z.array(z.string()).default([]),
  /** LLAAB auto-refresh flag — not the same as a YouTube subscription. */
  follow: z.boolean().default(false),
  /** Platform-native id (e.g. YouTube channel id `UC…`). */
  platform_id: z.string().optional(),
  /** Platform handle (e.g. `@t3dotgg`). */
  handle: z.string().optional(),
  avatar_url: z.string().url().optional(),
  subscriber_count: z.number().int().nonnegative().optional(),
  video_count: z.number().int().nonnegative().optional(),
  verified: z.boolean().optional(),
  /** When platform metadata was last refreshed from the upstream API / yt-dlp. */
  metadata_fetched_at: z.string().optional(),
  /** Whether the configured Google account subscribes to this channel, when checkable. */
  youtube_subscribed: z.boolean().optional(),
  profiles: z.array(SourceProfileSchema).default([]),
});

export type SourceNode = z.infer<typeof SourceNodeSchema>;
export type SourceKind = z.infer<typeof SourceKindSchema>;
export type SourceProfile = z.infer<typeof SourceProfileSchema>;
export type SourceProfilePlatform = z.infer<typeof SourceProfilePlatformSchema>;

import { z } from 'zod';

export const ingestYouTubeBodySchema = z.object({
  url: z.string().url('Must be a valid URL'),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  skipExtraction: z.boolean().optional(),
});

export type IngestYouTubeBody = z.infer<typeof ingestYouTubeBodySchema>;

export const ingestPodcastBodySchema = z.object({
  url: z.string().url('Must be a valid URL'),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  skipExtraction: z.boolean().optional(),
});

export type IngestPodcastBody = z.infer<typeof ingestPodcastBodySchema>;

export const ingestArticleBodySchema = z.object({
  url: z.string().url('Must be a valid URL'),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  skipExtraction: z.boolean().optional(),
  /** Inbox capture that triggered this ingest, retained as provenance on the article. */
  inboxCaptureId: z.string().optional(),
});

export type IngestArticleBody = z.infer<typeof ingestArticleBodySchema>;

export const ingestObsidianWebClipBodySchema = z.object({
  markdown: z.string().min(1, 'Paste Obsidian Web Clipper Markdown'),
  tags: z.array(z.string()).optional(),
  skipExtraction: z.boolean().optional(),
});

export type IngestObsidianWebClipBody = z.infer<typeof ingestObsidianWebClipBodySchema>;

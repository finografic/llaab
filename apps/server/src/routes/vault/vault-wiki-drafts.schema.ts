import { CreateWikiDraftRequestSchema, NodeIdSchema, WikiSectionDraftSchema } from '@llaab/schemas';
import { z } from 'zod';

export const createWikiDraftBodySchema = CreateWikiDraftRequestSchema;
export type CreateWikiDraftBody = z.infer<typeof createWikiDraftBodySchema>;

export const listWikiDraftsQuerySchema = z.object({
  status: z.enum(['proposed', 'accepted', 'rejected', 'superseded']).optional(),
  topic: z.string().min(1).optional(),
  target: NodeIdSchema.optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListWikiDraftsQuery = z.infer<typeof listWikiDraftsQuerySchema>;

export const resolveWikiDraftBodySchema = z
  .object({
    target_wiki_id: NodeIdSchema.optional(),
    distinct_topic_key: NodeIdSchema.optional(),
  })
  .refine((body) => (body.target_wiki_id === undefined) !== (body.distinct_topic_key === undefined), {
    message: 'Choose one existing wiki target or confirm one distinct topic key.',
  });
export type ResolveWikiDraftBody = z.infer<typeof resolveWikiDraftBodySchema>;

export const editWikiDraftBodySchema = z
  .object({
    title: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
    sections: z.array(WikiSectionDraftSchema).min(1).optional(),
  })
  .refine((body) => body.title !== undefined || body.summary !== undefined || body.sections !== undefined, {
    message: 'Provide a title, summary, and/or sections to update.',
  });
export type EditWikiDraftBody = z.infer<typeof editWikiDraftBodySchema>;

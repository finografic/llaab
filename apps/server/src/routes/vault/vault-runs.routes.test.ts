import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppCtx } from '../../types/app.types.js';

/** Minimal context stub — `deleteRun` only reads one param and one query value. */
function deleteRunCtx(runId: string, deleteProduced: boolean): AppCtx {
  return {
    req: {
      param: () => ({ id: runId }),
      query: (key: string) => (key === 'deleteProduced' ? String(deleteProduced) : undefined),
    },
    json: (body: unknown) => body,
  } as unknown as AppCtx;
}

describe('deleteRun — produced-node retention', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'llaab-vault-runs-'));
    process.env.LLAAB_VAULT = join(root, 'vault');
    process.env.LLAAB_KNOWLEDGE = join(root, 'knowledge');
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_KNOWLEDGE;
    await rm(root, { force: true, recursive: true });
  });

  it('keeps a publication source that another article still references', async () => {
    const core = await import('@llaab/core');
    const { deleteRun } = await import('./vault-runs.routes.js');

    const source = await core.createNode({
      type: 'source',
      id: 'signal-journal',
      title: 'Signal Journal',
      extra: { source_kind: 'publication', url: 'https://signal.example.com', platforms: ['website'] },
    });

    const firstArticle = await core.createNode({
      type: 'resource',
      id: 'first-article',
      title: 'First article',
      body: 'First article body.',
      extra: {
        resource_type: 'article',
        url: 'https://signal.example.com/a',
        source_id: source.id,
      },
    });

    // A second article from the same publication, produced by a different run.
    await core.createNode({
      type: 'resource',
      id: 'second-article',
      title: 'Second article',
      body: 'Second article body.',
      extra: {
        resource_type: 'article',
        url: 'https://signal.example.com/b',
        source_id: source.id,
      },
    });

    const run = await core.createNode({
      type: 'run',
      id: 'run-first-article',
      title: 'Ingest first article',
      extra: {
        skill_id: 'ingest-article',
        run_status: 'completed',
        produced_node_ids: [firstArticle.id, source.id],
      },
    });

    const response = (await deleteRun.handler(deleteRunCtx(run.id, true))) as unknown as {
      success: boolean;
      deletedProduced: number;
    };

    expect(response.success).toBe(true);
    // The article goes; the shared publication source stays.
    expect(response.deletedProduced).toBe(1);

    const remaining = await core.listNodes();
    const remainingIds = remaining.map((node) => node.id);
    expect(remainingIds).toContain('signal-journal');
    expect(remainingIds).toContain('second-article');
    expect(remainingIds).not.toContain('first-article');
    expect(remainingIds).not.toContain('run-first-article');
  });

  /**
   * Retention is evaluated against a snapshot taken before any deletion, so a source whose only
   * article is being deleted in the same batch is conservatively kept. This is pre-existing
   * behavior shared with YouTube and podcast runs (transcript + source in one run), not something
   * article ingestion introduced — recorded here so a future change is a deliberate one.
   */
  it('deletes the article and its ideas but conservatively keeps the source in the same batch', async () => {
    const core = await import('@llaab/core');
    const { deleteRun } = await import('./vault-runs.routes.js');

    const source = await core.createNode({
      type: 'source',
      id: 'lone-journal',
      title: 'Lone Journal',
      extra: { source_kind: 'publication', url: 'https://lone.example.com', platforms: ['website'] },
    });

    const article = await core.createNode({
      type: 'resource',
      id: 'only-article',
      title: 'Only article',
      body: 'Only article body.',
      extra: { resource_type: 'article', url: 'https://lone.example.com/a', source_id: source.id },
    });

    const idea = await core.createNode({
      type: 'idea',
      id: 'article-idea',
      title: 'Article idea',
      extra: { origin: 'extracted', source_id: article.id, related: [article.id] },
    });

    const run = await core.createNode({
      type: 'run',
      id: 'run-only-article',
      title: 'Ingest only article',
      extra: {
        skill_id: 'ingest-article',
        run_status: 'completed',
        produced_node_ids: [article.id, source.id, idea.id],
      },
    });

    const response = (await deleteRun.handler(deleteRunCtx(run.id, true))) as unknown as {
      deletedProduced: number;
    };

    expect(response.deletedProduced).toBe(2);

    const remainingIds = (await core.listNodes()).map((node) => node.id);
    expect(remainingIds).not.toContain('only-article');
    expect(remainingIds).not.toContain('article-idea');
    expect(remainingIds).toContain('lone-journal');
  });

  it('keeps produced nodes when deleteProduced is not requested', async () => {
    const core = await import('@llaab/core');
    const { deleteRun } = await import('./vault-runs.routes.js');

    const article = await core.createNode({
      type: 'resource',
      id: 'kept-article',
      title: 'Kept article',
      body: 'Kept article body.',
      extra: { resource_type: 'article', url: 'https://keep.example.com/a' },
    });

    const run = await core.createNode({
      type: 'run',
      id: 'run-kept-article',
      title: 'Ingest kept article',
      extra: {
        skill_id: 'ingest-article',
        run_status: 'completed',
        produced_node_ids: [article.id],
      },
    });

    const response = (await deleteRun.handler(deleteRunCtx(run.id, false))) as unknown as {
      deletedProduced: number;
    };

    expect(response.deletedProduced).toBe(0);
    expect((await core.listNodes()).map((node) => node.id)).toContain('kept-article');
  });

  it('keeps a source still referenced by a transcript', async () => {
    const core = await import('@llaab/core');
    const { deleteRun } = await import('./vault-runs.routes.js');

    const source = await core.createNode({
      type: 'source',
      id: 'mixed-source',
      title: 'Mixed Source',
      extra: { source_kind: 'publication', url: 'https://mixed.example.com', platforms: ['website'] },
    });

    await core.createNode({
      type: 'transcript',
      id: 'mixed-transcript',
      title: 'Mixed transcript',
      body: 'Transcript body.',
      extra: {
        source_id: source.id,
        source_url: 'https://www.youtube.com/watch?v=mixed',
        source_type: 'youtube',
      },
    });

    const article = await core.createNode({
      type: 'resource',
      id: 'mixed-article',
      title: 'Mixed article',
      body: 'Article body.',
      extra: { resource_type: 'article', url: 'https://mixed.example.com/a', source_id: source.id },
    });

    const run = await core.createNode({
      type: 'run',
      id: 'run-mixed-article',
      title: 'Ingest mixed article',
      extra: {
        skill_id: 'ingest-article',
        run_status: 'completed',
        produced_node_ids: [article.id, source.id],
      },
    });

    await deleteRun.handler(deleteRunCtx(run.id, true));

    expect((await core.listNodes()).map((node) => node.id)).toContain('mixed-source');
  });
});

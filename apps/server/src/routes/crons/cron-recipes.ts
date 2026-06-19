import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { listNodes } from '@llaab/core';
import { appendRunEvent, runSkill } from '@llaab/skills';
import type { IdeaNode, RunNode, TranscriptNode } from '@llaab/schemas';

import { consolidateTranscriptIdeasForTranscript } from '../vault/vault-transcripts.routes.js';

export interface CronRecipe {
  id: string;
  title: string;
  description: string;
  command: string;
  risk: 'low' | 'medium' | 'high';
  scheduleExamples: Array<{
    label: string;
    value: string;
  }>;
}

export interface CronRecipeDto extends CronRecipe {
  /**
   * Whether the recipe will execute when triggered (manually, via `/terminal`, or by an
   * external scheduler hitting `POST /api/crons/:id/run`). LLAAB owns no scheduler itself —
   * this is a kill-switch on the one-shot endpoint, not a "currently scheduled" indicator.
   */
  enabled: boolean;
}

export interface CronRecipeRunResult {
  recipeId: string;
  checked: number;
  pending: number;
  consolidated: number;
  skipped: number;
  failed: number;
  producedNodeIds: string[];
  results: Array<{
    transcriptId: string;
    title: string;
    status: 'consolidated' | 'skipped' | 'failed';
    reason?: string;
    canonicalIdeaIds?: string[];
  }>;
}

const RECENT_TRANSCRIPTS_WINDOW_DAYS = 7;

export const CRON_RECIPES: CronRecipe[] = [
  {
    id: 'check-transcripts-consolidation',
    title: 'Check transcript consolidation',
    description: 'Scan transcripts and consolidate any transcript with extracted ideas but no canonical set.',
    command: 'cron.run check-transcripts-consolidation',
    risk: 'medium',
    scheduleExamples: [
      {
        label: 'macOS launchd',
        value: 'curl -X POST http://localhost:8888/api/crons/check-transcripts-consolidation/run',
      },
      {
        label: 'cron',
        value: '0 */6 * * * curl -X POST http://localhost:8888/api/crons/check-transcripts-consolidation/run',
      },
    ],
  },
  {
    id: 'check-recent-transcripts-consolidation',
    title: 'Check recent transcript consolidation (7d)',
    description: `Scan transcripts created in the last ${RECENT_TRANSCRIPTS_WINDOW_DAYS} days and consolidate any with extracted ideas but no canonical set.`,
    command: 'cron.run check-recent-transcripts-consolidation',
    risk: 'medium',
    scheduleExamples: [
      {
        label: 'macOS launchd',
        value: 'curl -X POST http://localhost:8888/api/crons/check-recent-transcripts-consolidation/run',
      },
      {
        label: 'cron (every 6 hours)',
        value:
          '0 */6 * * * curl -X POST http://localhost:8888/api/crons/check-recent-transcripts-consolidation/run',
      },
    ],
  },
];

function findRecipe(id: string): CronRecipe | undefined {
  return CRON_RECIPES.find((recipe) => recipe.id === id);
}

const CRON_STATE_PATH = resolve(process.cwd(), 'configs/cron-recipes.json');

interface CronRecipeStateFile {
  recipes?: Record<string, { enabled?: boolean }>;
}

function readCronState(): CronRecipeStateFile {
  if (!existsSync(CRON_STATE_PATH)) return {};

  try {
    return JSON.parse(readFileSync(CRON_STATE_PATH, 'utf8')) as CronRecipeStateFile;
  } catch {
    return {};
  }
}

function writeCronState(state: CronRecipeStateFile): void {
  mkdirSync(dirname(CRON_STATE_PATH), { recursive: true });
  writeFileSync(CRON_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

export function isCronRecipeEnabled(id: string): boolean {
  return readCronState().recipes?.[id]?.enabled ?? true;
}

export function setCronRecipeEnabled(id: string, enabled: boolean): boolean {
  if (!findRecipe(id)) throw new Error(`Unknown cron recipe: ${id}`);

  const state = readCronState();
  writeCronState({ ...state, recipes: { ...state.recipes, [id]: { enabled } } });
  return enabled;
}

export function listCronRecipesWithState(): CronRecipeDto[] {
  return CRON_RECIPES.map((recipe) => ({ ...recipe, enabled: isCronRecipeEnabled(recipe.id) }));
}

function transcriptHasCanonicalSet(transcript: TranscriptNode): boolean {
  return (transcript.canonical_coverage?.canonical_idea_ids.length ?? 0) > 0;
}

function transcriptHasCandidateIdeas(
  transcript: TranscriptNode,
  runs: RunNode[],
  ideasById: Map<string, IdeaNode>,
): boolean {
  return runs
    .filter((run) => run.produced_node_ids.includes(transcript.id))
    .some((run) => run.produced_node_ids.some((nodeId) => ideasById.has(nodeId)));
}

function selectScanTranscripts(recipeId: string, transcripts: TranscriptNode[]): TranscriptNode[] {
  if (recipeId !== 'check-recent-transcripts-consolidation') return transcripts;

  const cutoffMs = Date.now() - RECENT_TRANSCRIPTS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return transcripts.filter((transcript) => Date.parse(transcript.created_at) >= cutoffMs);
}

export async function runCronRecipe(id: string): Promise<{ runNodeId: string; result: CronRecipeRunResult }> {
  const recipe = findRecipe(id);
  if (!recipe) throw new Error(`Unknown cron recipe: ${id}`);
  if (!isCronRecipeEnabled(id)) throw new Error(`Cron recipe "${recipe.title}" is disabled.`);

  const { record, result } = await runSkill(
    `cron-${recipe.id}`,
    async (_input, runNodeId): Promise<CronRecipeRunResult> => {
      const allNodes = await listNodes();
      const allTranscripts = allNodes.filter((node): node is TranscriptNode => node.type === 'transcript');
      const transcripts = selectScanTranscripts(recipe.id, allTranscripts);
      const runs = allNodes.filter((node): node is RunNode => node.type === 'run');
      const ideasById = new Map(
        allNodes.filter((node): node is IdeaNode => node.type === 'idea').map((idea) => [idea.id, idea]),
      );

      const pending = transcripts.filter(
        (transcript) =>
          !transcriptHasCanonicalSet(transcript) && transcriptHasCandidateIdeas(transcript, runs, ideasById),
      );
      const producedNodeIds: string[] = [];
      const results: CronRecipeRunResult['results'] = [];

      await appendRunEvent(runNodeId, {
        level: 'info',
        message: `Found ${pending.length} transcript${pending.length === 1 ? '' : 's'} needing consolidation`,
      });

      for (const transcript of pending) {
        try {
          await appendRunEvent(runNodeId, {
            level: 'info',
            message: `Consolidating ${transcript.title}`,
            href: `/vault/transcripts/${transcript.id}`,
            node_ids: [transcript.id],
          });
          const consolidation = await consolidateTranscriptIdeasForTranscript({
            transcriptId: transcript.id,
          });
          producedNodeIds.push(...consolidation.canonicalIdeaIds);
          results.push({
            transcriptId: transcript.id,
            title: transcript.title,
            status: 'consolidated',
            canonicalIdeaIds: consolidation.canonicalIdeaIds,
          });
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'Consolidation failed';
          results.push({
            transcriptId: transcript.id,
            title: transcript.title,
            status: 'failed',
            reason,
          });
          await appendRunEvent(runNodeId, {
            level: 'error',
            message: `Failed to consolidate ${transcript.title}: ${reason}`,
            href: `/vault/transcripts/${transcript.id}`,
            node_ids: [transcript.id],
          });
        }
      }

      const skipped = transcripts.length - pending.length;
      return {
        recipeId: recipe.id,
        checked: transcripts.length,
        pending: pending.length,
        consolidated: results.filter((item) => item.status === 'consolidated').length,
        skipped,
        failed: results.filter((item) => item.status === 'failed').length,
        producedNodeIds,
        results,
      };
    },
    { recipeId: recipe.id },
  );

  return { runNodeId: record.runNodeId, result };
}

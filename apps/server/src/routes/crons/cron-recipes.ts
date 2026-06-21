import { spawn } from 'node:child_process';
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
  cronExpression: string;
  scheduleExamples: Array<{
    label: string;
    value: string;
  }>;
}

export interface CronRecipeDto extends CronRecipe {
  /**
   * Whether this recipe is installed in the user's crontab. LLAAB still owns no long-running
   * scheduler; it only manages one-shot endpoint lines in the host crontab.
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
const MANAGED_CRONTAB_MARKER_PREFIX = '# llaab:cron:';
const LOCAL_API_ORIGIN = 'http://127.0.0.1:8888';
const CURL_BIN = '/usr/bin/curl';
let crontabWriteQueue = Promise.resolve();

function cronRunUrl(recipeId: string): string {
  return `${LOCAL_API_ORIGIN}/api/crons/${recipeId}/run`;
}

function cronLogPath(recipeId: string): string {
  return `/tmp/llaab-cron-${recipeId}.log`;
}

function cronCommand(recipe: CronRecipe): string {
  return [
    recipe.cronExpression,
    CURL_BIN,
    '-fsS',
    '-X',
    'POST',
    cronRunUrl(recipe.id),
    `>${cronLogPath(recipe.id)}`,
    '2>&1',
    `${MANAGED_CRONTAB_MARKER_PREFIX}${recipe.id}`,
  ].join(' ');
}

export const CRON_RECIPES: CronRecipe[] = [
  {
    id: 'check-transcripts-consolidation',
    title: 'Check transcript consolidation',
    description: 'Scan transcripts and consolidate any transcript with extracted ideas but no canonical set.',
    command: 'cron.run check-transcripts-consolidation',
    risk: 'medium',
    cronExpression: '10 */6 * * *',
    scheduleExamples: [
      {
        label: 'macOS launchd',
        value: `${CURL_BIN} -fsS -X POST ${cronRunUrl('check-transcripts-consolidation')}`,
      },
      {
        label: 'cron',
        value: cronCommand({
          id: 'check-transcripts-consolidation',
          title: '',
          description: '',
          command: '',
          risk: 'medium',
          cronExpression: '10 */6 * * *',
          scheduleExamples: [],
        }),
      },
    ],
  },
  {
    id: 'check-recent-transcripts-consolidation',
    title: 'Check recent transcript consolidation (7d)',
    description: `Scan transcripts created in the last ${RECENT_TRANSCRIPTS_WINDOW_DAYS} days and consolidate any with extracted ideas but no canonical set.`,
    command: 'cron.run check-recent-transcripts-consolidation',
    risk: 'medium',
    cronExpression: '0 */6 * * *',
    scheduleExamples: [
      {
        label: 'macOS launchd',
        value: `${CURL_BIN} -fsS -X POST ${cronRunUrl('check-recent-transcripts-consolidation')}`,
      },
      {
        label: 'cron (every 6 hours)',
        value: cronCommand({
          id: 'check-recent-transcripts-consolidation',
          title: '',
          description: '',
          command: '',
          risk: 'medium',
          cronExpression: '0 */6 * * *',
          scheduleExamples: [],
        }),
      },
    ],
  },
];

function findRecipe(id: string): CronRecipe | undefined {
  return CRON_RECIPES.find((recipe) => recipe.id === id);
}

function runCrontab(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('crontab', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      const message = stderr.trim() || `crontab exited with status ${code}`;
      reject(new Error(message));
    });

    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

async function readCrontab(): Promise<string> {
  try {
    return await runCrontab(['-l']);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('no crontab for')) return '';
    throw err;
  }
}

async function writeCrontab(contents: string): Promise<void> {
  await runCrontab(['-'], contents);
}

async function updateCrontab(mutator: (current: string) => string): Promise<void> {
  crontabWriteQueue = crontabWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const current = await readCrontab();
      await writeCrontab(mutator(current));
    });

  await crontabWriteQueue;
}

function removeManagedRecipeLine(crontab: string, recipeId: string): string {
  const marker = `${MANAGED_CRONTAB_MARKER_PREFIX}${recipeId}`;
  return crontab
    .split('\n')
    .filter((line) => !line.includes(marker))
    .join('\n')
    .trimEnd();
}

async function isCronRecipeEnabled(id: string): Promise<boolean> {
  const crontab = await readCrontab();
  return crontab.split('\n').some((line) => line.includes(`${MANAGED_CRONTAB_MARKER_PREFIX}${id}`));
}

export async function setCronRecipeEnabled(id: string, enabled: boolean): Promise<boolean> {
  const recipe = findRecipe(id);
  if (!recipe) throw new Error(`Unknown cron recipe: ${id}`);

  await updateCrontab((existing) => {
    const withoutRecipe = removeManagedRecipeLine(existing, id);
    if (!enabled) return withoutRecipe ? `${withoutRecipe}\n` : '';

    return `${withoutRecipe}${withoutRecipe ? '\n' : ''}${cronCommand(recipe)}\n`;
  });
  return enabled;
}

export async function listCronRecipesWithState(): Promise<CronRecipeDto[]> {
  const crontab = await readCrontab();
  return CRON_RECIPES.map((recipe) => ({
    ...recipe,
    enabled: crontab
      .split('\n')
      .some((line) => line.includes(`${MANAGED_CRONTAB_MARKER_PREFIX}${recipe.id}`)),
  }));
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
  if (!(await isCronRecipeEnabled(id))) throw new Error(`Cron recipe "${recipe.title}" is disabled.`);

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

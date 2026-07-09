import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { listNodes } from '@llaab/core';
import type { CronHistoryEntry } from './cron-history.js';
import type { CreateCronRecipeBody, UpdateCronRecipeBody } from './crons.schema.js';
import type { IdeaNode, RunNode, TranscriptNode } from '@llaab/schemas';

import { consolidateTranscriptIdeasForTranscript } from '../vault/vault-transcripts.routes.js';
import { appendCronHistoryEntry, listCronHistory } from './cron-history.js';

export interface CronScript {
  id: string;
  title: string;
  description: string;
  location: string;
}

export interface CronRecipe {
  id: string;
  title: string;
  description: string;
  command: string;
  risk: 'low' | 'medium' | 'high';
  cronExpression: string;
  scriptId: string;
  scheduleExamples: Array<{
    label: string;
    value: string;
  }>;
}

export type CronRecipeHealth = 'ok' | 'stale' | 'failing' | 'never_ran' | 'not_installed';

export interface CronRecipeDto extends CronRecipe {
  /**
   * Whether this recipe is installed in the user's crontab. LLAAB still owns no long-running
   * scheduler; it only manages one-shot endpoint lines in the host crontab.
   */
  enabled: boolean;
  /** Operational truth: installed lines can still be failing (e.g. 401) or stale. */
  health: CronRecipeHealth;
  healthDetail?: string;
  lastRunAt?: string;
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
const CRON_RECIPES_PATH = resolve(process.cwd(), 'configs/cron-recipes.json');
const CRON_RUNNER_SCRIPT = resolve(process.cwd(), 'scripts/macos/llaab-cron-run.sh');
/** Treat a 6h recipe as stale after 2 missed windows (+ buffer). */
const STALE_AFTER_MS = 13 * 60 * 60 * 1000;
let crontabWriteQueue = Promise.resolve();

type CronRecipeConfig = Omit<CronRecipe, 'command' | 'scheduleExamples'>;
type CronRecipeConfigPatch = Partial<Omit<CronRecipeConfig, 'id'>> & { enabled?: boolean };

interface CronRecipesFile {
  recipes: Record<string, CronRecipeConfigPatch>;
}

function cronLogPath(recipeId: string): string {
  return `/tmp/llaab-cron-${recipeId}.log`;
}

function cronCommand(recipe: Pick<CronRecipe, 'cronExpression' | 'id'>): string {
  // Wrapper sources repo .env and sends X-API-Key — bare curl 401s when LLAAB_API_KEY is set.
  return [
    recipe.cronExpression,
    CRON_RUNNER_SCRIPT,
    recipe.id,
    `${MANAGED_CRONTAB_MARKER_PREFIX}${recipe.id}`,
  ].join(' ');
}

function readCronLogSnippet(recipeId: string): string {
  const path = cronLogPath(recipeId);
  if (!existsSync(path)) return '';
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return '';
  }
}

export const CRON_SCRIPTS: CronScript[] = [
  {
    id: 'check-transcripts-consolidation',
    title: 'Check transcript consolidation',
    description:
      'Scan all transcripts and consolidate any transcript with extracted ideas but no canonical set.',
    location: 'apps/server/src/routes/crons/cron-recipes.ts#executeCronRecipe',
  },
  {
    id: 'check-recent-transcripts-consolidation',
    title: 'Check recent transcript consolidation (7d)',
    description: `Scan transcripts created in the last ${RECENT_TRANSCRIPTS_WINDOW_DAYS} days and consolidate any with extracted ideas but no canonical set.`,
    location: 'apps/server/src/routes/crons/cron-recipes.ts#executeCronRecipe',
  },
];

const BUILT_IN_CRON_RECIPES: CronRecipeConfig[] = [
  {
    id: 'check-transcripts-consolidation',
    title: 'Check transcript consolidation',
    description: 'Scan transcripts and consolidate any transcript with extracted ideas but no canonical set.',
    risk: 'medium',
    cronExpression: '10 */6 * * *',
    scriptId: 'check-transcripts-consolidation',
  },
  {
    id: 'check-recent-transcripts-consolidation',
    title: 'Check recent transcript consolidation (7d)',
    description: `Scan transcripts created in the last ${RECENT_TRANSCRIPTS_WINDOW_DAYS} days and consolidate any with extracted ideas but no canonical set.`,
    risk: 'medium',
    cronExpression: '0 */6 * * *',
    scriptId: 'check-recent-transcripts-consolidation',
  },
];

function readCronRecipesFile(): CronRecipesFile {
  if (!existsSync(CRON_RECIPES_PATH)) return { recipes: {} };

  try {
    const parsed = JSON.parse(readFileSync(CRON_RECIPES_PATH, 'utf8')) as Partial<CronRecipesFile>;
    return { recipes: parsed.recipes ?? {} };
  } catch {
    return { recipes: {} };
  }
}

function writeCronRecipesFile(file: CronRecipesFile): void {
  mkdirSync(dirname(CRON_RECIPES_PATH), { recursive: true });
  writeFileSync(CRON_RECIPES_PATH, `${JSON.stringify(file, null, 2)}\n`);
}

function ensureKnownScript(scriptId: string): void {
  if (!CRON_SCRIPTS.some((script) => script.id === scriptId)) {
    throw new Error(`Unknown cron script: ${scriptId}`);
  }
}

function normalizeCronExpression(expression: string): string {
  const parts = expression
    .trim()
    .split(/\s+/)
    .map((part) => part.trim() || '*');

  if (parts.length < 5 || parts.length > 7) {
    throw new Error('Cron frequency must contain 5 to 7 fields.');
  }

  return parts.join(' ');
}

function slugifyRecipeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function materializeRecipe(config: CronRecipeConfig): CronRecipe {
  return {
    ...config,
    command: `cron.run ${config.id}`,
    scheduleExamples: [
      {
        label: 'macOS launchd / manual',
        value: `${CRON_RUNNER_SCRIPT} ${config.id}`,
      },
      {
        label: 'cron',
        value: cronCommand(config),
      },
    ],
  };
}

function listCronRecipeConfigs(): CronRecipeConfig[] {
  const stored = readCronRecipesFile();
  const byId = new Map<string, CronRecipeConfig>();

  for (const recipe of BUILT_IN_CRON_RECIPES) {
    const patch = stored.recipes[recipe.id];
    byId.set(recipe.id, {
      id: recipe.id,
      title: patch?.title ?? recipe.title,
      description: patch?.description ?? recipe.description,
      risk: patch?.risk ?? recipe.risk,
      cronExpression: normalizeCronExpression(patch?.cronExpression ?? recipe.cronExpression),
      scriptId: patch?.scriptId ?? recipe.scriptId,
    });
  }

  for (const [id, patch] of Object.entries(stored.recipes)) {
    if (byId.has(id)) continue;
    if (!patch.title || !patch.description || !patch.risk || !patch.cronExpression || !patch.scriptId) {
      continue;
    }
    byId.set(id, {
      id,
      title: patch.title,
      description: patch.description,
      risk: patch.risk,
      cronExpression: normalizeCronExpression(patch.cronExpression),
      scriptId: patch.scriptId,
    });
  }

  return [...byId.values()];
}

function listCronRecipes(): CronRecipe[] {
  return listCronRecipeConfigs().map(materializeRecipe);
}

function findRecipe(id: string): CronRecipe | undefined {
  return listCronRecipes().find((recipe) => recipe.id === id);
}

function writeRecipePatch(id: string, patch: CronRecipeConfigPatch): CronRecipe {
  const file = readCronRecipesFile();
  writeCronRecipesFile({
    recipes: {
      ...file.recipes,
      [id]: {
        ...(file.recipes[id] ?? {}),
        ...patch,
        cronExpression: patch.cronExpression
          ? normalizeCronExpression(patch.cronExpression)
          : file.recipes[id]?.cronExpression,
      },
    },
  });

  const recipe = findRecipe(id);
  if (!recipe) throw new Error(`Unknown cron recipe: ${id}`);
  return recipe;
}

export function listCronScripts(): CronScript[] {
  return CRON_SCRIPTS;
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
      const next = mutator(current);
      if (next === current) return;
      await writeCrontab(next);
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

function managedLineNeedsRewrite(line: string): boolean {
  return line.includes(MANAGED_CRONTAB_MARKER_PREFIX) && !line.includes(CRON_RUNNER_SCRIPT);
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

/** Reinstall every currently-installed recipe with the current authenticated runner command. */
export async function repairInstalledCronRecipes(): Promise<string[]> {
  const crontab = await readCrontab();
  const repaired: string[] = [];
  for (const recipe of listCronRecipes()) {
    const marker = `${MANAGED_CRONTAB_MARKER_PREFIX}${recipe.id}`;
    const line = crontab.split('\n').find((entry) => entry.includes(marker));
    if (!line) continue;
    if (!managedLineNeedsRewrite(line) && line.includes(CRON_RUNNER_SCRIPT)) continue;
    await setCronRecipeEnabled(recipe.id, true);
    repaired.push(recipe.id);
  }
  return repaired;
}

function resolveRecipeHealth(args: {
  enabled: boolean;
  recipeId: string;
  crontabLine?: string;
  lastRunAt?: string;
  lastRunStatus?: CronHistoryEntry['status'];
}): { health: CronRecipeHealth; healthDetail?: string } {
  if (!args.enabled) {
    return { health: 'not_installed', healthDetail: 'Not installed in crontab' };
  }

  if (args.crontabLine && managedLineNeedsRewrite(args.crontabLine)) {
    return {
      health: 'failing',
      healthDetail: 'Crontab line is outdated (bare curl without API key) — click Repair crontab',
    };
  }

  if (args.lastRunStatus === 'failed') {
    return { health: 'failing', healthDetail: 'Last recorded run failed' };
  }

  if (args.lastRunAt) {
    const ageMs = Date.now() - Date.parse(args.lastRunAt);
    if (Number.isFinite(ageMs) && ageMs > STALE_AFTER_MS) {
      return {
        health: 'stale',
        healthDetail: `Last successful run was ${Math.floor(ageMs / (60 * 60 * 1000))}h ago`,
      };
    }
    return { health: 'ok' };
  }

  // No history yet — fall back to /tmp cron log (may still show pre-repair 401s).
  const log = readCronLogSnippet(args.recipeId);
  if (/401|Unauthorized/i.test(log)) {
    return {
      health: 'failing',
      healthDetail: 'Last crontab trigger got HTTP 401 — runner must send X-API-Key',
    };
  }
  if (/curl:|error|failed/i.test(log)) {
    return { health: 'failing', healthDetail: log.slice(0, 160) || 'Cron log reports an error' };
  }

  return {
    health: 'never_ran',
    healthDetail: 'Installed, but no successful history entry yet',
  };
}

export async function createCronRecipe(input: CreateCronRecipeBody): Promise<CronRecipeDto> {
  const id = slugifyRecipeId(input.id ?? input.title);
  if (!id) throw new Error('Recipe id is required.');
  if (findRecipe(id)) throw new Error(`Cron recipe already exists: ${id}`);
  ensureKnownScript(input.scriptId);

  const recipe = writeRecipePatch(id, {
    title: input.title,
    description: input.description,
    risk: input.risk,
    cronExpression: input.cronExpression,
    scriptId: input.scriptId,
  });

  return {
    ...recipe,
    enabled: false,
    health: 'not_installed',
    healthDetail: 'Not installed in crontab',
  };
}

export async function updateCronRecipe(id: string, input: UpdateCronRecipeBody): Promise<CronRecipeDto> {
  const existing = findRecipe(id);
  if (!existing) throw new Error(`Unknown cron recipe: ${id}`);
  if (input.scriptId) ensureKnownScript(input.scriptId);

  const metadataPatch: CronRecipeConfigPatch = {};
  if (input.title !== undefined) metadataPatch.title = input.title;
  if (input.description !== undefined) metadataPatch.description = input.description;
  if (input.risk !== undefined) metadataPatch.risk = input.risk;
  if (input.cronExpression !== undefined) metadataPatch.cronExpression = input.cronExpression;
  if (input.scriptId !== undefined) metadataPatch.scriptId = input.scriptId;

  const updated = Object.keys(metadataPatch).length > 0 ? writeRecipePatch(id, metadataPatch) : existing;
  const currentlyEnabled = await isCronRecipeEnabled(id);
  const shouldBeEnabled = input.enabled ?? currentlyEnabled;

  if (currentlyEnabled || input.enabled !== undefined) {
    await setCronRecipeEnabled(id, shouldBeEnabled);
  }

  const history = listCronHistory();
  const lastEntry = history.find((entry) => entry.recipeId === id);
  const { health, healthDetail } = resolveRecipeHealth({
    enabled: shouldBeEnabled,
    recipeId: id,
    lastRunAt: lastEntry?.startedAt,
    lastRunStatus: lastEntry?.status,
  });

  return {
    ...updated,
    enabled: shouldBeEnabled,
    health,
    healthDetail,
    lastRunAt: lastEntry?.startedAt,
  };
}

export async function listCronRecipesWithState(): Promise<CronRecipeDto[]> {
  // Do not rewrite crontab on GET — that can hang under launchd. Repair happens on enable/update
  // via setCronRecipeEnabled, or explicitly via POST /api/crons/repair.
  const crontab = await readCrontab();
  const history = listCronHistory();

  return listCronRecipes().map((recipe) => {
    const marker = `${MANAGED_CRONTAB_MARKER_PREFIX}${recipe.id}`;
    const crontabLine = crontab.split('\n').find((line) => line.includes(marker));
    const enabled = Boolean(crontabLine);
    const lastEntry = history.find((entry) => entry.recipeId === recipe.id);
    const { health, healthDetail } = resolveRecipeHealth({
      enabled,
      recipeId: recipe.id,
      crontabLine,
      lastRunAt: lastEntry?.startedAt,
      lastRunStatus: lastEntry?.status,
    });

    return {
      ...recipe,
      enabled,
      health,
      healthDetail,
      lastRunAt: lastEntry?.startedAt,
    };
  });
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

function cronHistoryEntryId(recipeId: string, startedAt: string): string {
  return `${recipeId}-${startedAt.replace(/[:.]/g, '-')}`;
}

async function executeCronRecipe(recipe: CronRecipe): Promise<CronRecipeRunResult> {
  const allNodes = await listNodes();
  const allTranscripts = allNodes.filter((node): node is TranscriptNode => node.type === 'transcript');
  const transcripts = selectScanTranscripts(recipe.scriptId, allTranscripts);
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

  for (const transcript of pending) {
    try {
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
      results.push({
        transcriptId: transcript.id,
        title: transcript.title,
        status: 'failed',
        reason: err instanceof Error ? err.message : 'Consolidation failed',
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
}

export async function runCronRecipe(
  id: string,
): Promise<{ historyEntry: CronHistoryEntry; result: CronRecipeRunResult }> {
  const recipe = findRecipe(id);
  if (!recipe) throw new Error(`Unknown cron recipe: ${id}`);
  if (!(await isCronRecipeEnabled(id))) throw new Error(`Cron recipe "${recipe.title}" is disabled.`);

  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  try {
    const result = await executeCronRecipe(recipe);
    const completedAtMs = Date.now();
    const historyEntry = appendCronHistoryEntry({
      id: cronHistoryEntryId(recipe.id, startedAt),
      recipeId: recipe.id,
      title: `${recipe.title} run`,
      status: 'completed',
      startedAt,
      completedAt: new Date(completedAtMs).toISOString(),
      durationMs: completedAtMs - startedAtMs,
      result,
    });
    return { historyEntry, result };
  } catch (err) {
    const completedAtMs = Date.now();
    const historyEntry = appendCronHistoryEntry({
      id: cronHistoryEntryId(recipe.id, startedAt),
      recipeId: recipe.id,
      title: `${recipe.title} run`,
      status: 'failed',
      startedAt,
      completedAt: new Date(completedAtMs).toISOString(),
      durationMs: completedAtMs - startedAtMs,
      error: err instanceof Error ? err.message : 'Cron recipe failed',
    });
    throw Object.assign(err instanceof Error ? err : new Error('Cron recipe failed'), { historyEntry });
  }
}

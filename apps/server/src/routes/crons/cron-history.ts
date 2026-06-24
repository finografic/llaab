import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { CronRecipeRunResult } from './cron-recipes.js';

export interface CronHistoryEntry {
  id: string;
  recipeId: string;
  title: string;
  status: 'completed' | 'failed';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  result?: CronRecipeRunResult;
  error?: string;
}

interface CronHistoryFile {
  entriesByRecipe: Record<string, CronHistoryEntry[]>;
}

const CRON_HISTORY_PATH = resolve(process.cwd(), 'configs/cron-history.json');
const HISTORY_LIMIT_PER_RECIPE = 2;

function readCronHistoryFile(): CronHistoryFile {
  if (!existsSync(CRON_HISTORY_PATH)) return { entriesByRecipe: {} };

  try {
    const parsed = JSON.parse(readFileSync(CRON_HISTORY_PATH, 'utf8')) as Partial<CronHistoryFile>;
    return { entriesByRecipe: parsed.entriesByRecipe ?? {} };
  } catch {
    return { entriesByRecipe: {} };
  }
}

function writeCronHistoryFile(history: CronHistoryFile): void {
  mkdirSync(dirname(CRON_HISTORY_PATH), { recursive: true });
  writeFileSync(CRON_HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`);
}

export function listCronHistory(): CronHistoryEntry[] {
  const history = readCronHistoryFile();
  return Object.values(history.entriesByRecipe)
    .flat()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function appendCronHistoryEntry(entry: CronHistoryEntry): CronHistoryEntry {
  const history = readCronHistoryFile();
  const entries = [entry, ...(history.entriesByRecipe[entry.recipeId] ?? [])]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, HISTORY_LIMIT_PER_RECIPE);

  writeCronHistoryFile({
    entriesByRecipe: {
      ...history.entriesByRecipe,
      [entry.recipeId]: entries,
    },
  });
  return entry;
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const UI_STATE_PATH = resolve(process.cwd(), 'configs/ui-state.json');

type UiStateFile = Record<string, unknown>;

function readUiState(): UiStateFile {
  if (!existsSync(UI_STATE_PATH)) return {};

  try {
    return JSON.parse(readFileSync(UI_STATE_PATH, 'utf8')) as UiStateFile;
  } catch {
    return {};
  }
}

function writeUiState(state: UiStateFile): void {
  mkdirSync(dirname(UI_STATE_PATH), { recursive: true });
  writeFileSync(UI_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

/** Returns the persisted value for `key`, or `null` if nothing has been saved yet. */
export function getUiState(key: string): unknown {
  return readUiState()[key] ?? null;
}

/** Persists `value` under `key`, overwriting any previous value. Returns `value` for convenience. */
export function setUiState(key: string, value: unknown): unknown {
  const state = readUiState();
  writeUiState({ ...state, [key]: value });
  return value;
}

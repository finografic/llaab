export const RUNS_CHANGED_EVENT = 'llaab:runs-changed';

export function dispatchRunsChanged(): void {
  window.dispatchEvent(new CustomEvent(RUNS_CHANGED_EVENT));
}

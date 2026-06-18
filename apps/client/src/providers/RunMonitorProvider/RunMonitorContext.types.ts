import type { CreateSettersType } from '@finografic/zustand-context-creator';
import type { RunMonitorKeys, SETTER_PREFIX } from './RunMonitorContext';
import type { ReactNode } from 'react';

export interface RunMonitorValues {
  [RunMonitorKeys.selectedRunId]: string | undefined;
  [RunMonitorKeys.dismissedRunIds]: string[];
}

type RunMonitorSetters = CreateSettersType<RunMonitorValues, typeof SETTER_PREFIX>;

interface RunMonitorActions extends RunMonitorSetters {
  selectRun: (runId: string | undefined) => void;
  dismissRun: (runId: string) => void;
  resetDismissedRuns: () => void;
}

export interface RunMonitorStore extends RunMonitorValues {
  actions: RunMonitorActions;
}

export type RunMonitorReturn = Omit<RunMonitorStore, 'actions'> & RunMonitorActions;

export interface RunMonitorProviderProps {
  initialValue?: Partial<RunMonitorValues>;
  children: ReactNode;
}

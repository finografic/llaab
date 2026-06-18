import { createSetters, createZustandContext } from '@finografic/zustand-context-creator';
import { createStore, useStore } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { RunMonitorReturn, RunMonitorStore, RunMonitorValues } from './RunMonitorContext.types';
import type { StoreApi } from 'zustand';

export const DISPLAY_NAME = 'RunMonitor';
export const SETTER_PREFIX = 'RunMonitor';

export enum RunMonitorKeys {
  selectedRunId = 'selectedRunId',
  dismissedRunIds = 'dismissedRunIds',
}

export const defaultValue: RunMonitorValues = {
  selectedRunId: undefined,
  dismissedRunIds: [],
};

export const RunMonitorContext = createZustandContext(({ initialValue }) => {
  return createStore<RunMonitorStore>()(
    subscribeWithSelector(
      (set): RunMonitorStore => ({
        ...defaultValue,
        ...initialValue,
        actions: {
          ...createSetters({ set, defaultValue, prefix: SETTER_PREFIX }),
          selectRun: (runId) => set({ selectedRunId: runId }),
          dismissRun: (runId) =>
            set((state) => ({
              dismissedRunIds: state.dismissedRunIds.includes(runId)
                ? state.dismissedRunIds
                : [...state.dismissedRunIds, runId],
            })),
          resetDismissedRuns: () => set({ dismissedRunIds: [] }),
        },
      }),
    ),
  );
});

export const useRunMonitorState = (): RunMonitorReturn => {
  const store = RunMonitorContext.useContext();
  if (!store) {
    throw new Error(`useRunMonitorState must be used within a ${DISPLAY_NAME}Provider`);
  }

  return useStore<StoreApi<RunMonitorStore>, RunMonitorReturn>(
    store,
    useShallow(({ actions, ...state }) => ({
      ...state,
      ...actions,
    })),
  );
};

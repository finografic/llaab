import type { RunMonitorProviderProps } from './RunMonitorContext.types';

import { DISPLAY_NAME, RunMonitorContext } from './RunMonitorContext';

export function RunMonitorProvider({ initialValue, children }: RunMonitorProviderProps) {
  return <RunMonitorContext.Provider initialValue={initialValue}>{children}</RunMonitorContext.Provider>;
}

RunMonitorProvider.displayName = `${DISPLAY_NAME}Provider`;

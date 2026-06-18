import { RunMonitorTrigger } from 'components/RunMonitor';
import { usePanelRef } from 'components/ui/resizable';
import { CleanVaultDialog } from 'dialogs/CleanVaultDialog/CleanVaultDialog';
import { useRunMonitorState } from 'providers/RunMonitorProvider';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import styles from './AppLayout.module.css';

export function SecondaryActionBar({ leadingAction }: { leadingAction: ReactNode }) {
  const runMonitorPanelRef = usePanelRef();
  const { isOpen } = useRunMonitorState();

  useEffect(() => {
    const panel = runMonitorPanelRef.current;
    if (!panel) return;

    if (isOpen) {
      panel.resize('430px');
      return;
    }

    panel.collapse();
  }, [isOpen, runMonitorPanelRef]);

  return (
    <div className={styles.secondaryActions}>
      <div className={styles.secondaryLeading}>{leadingAction}</div>
      <div className={styles.secondaryTrailing}>
        <CleanVaultDialog resetIngestFormOnSuccess />
        <RunMonitorTrigger />
      </div>
    </div>
  );
}

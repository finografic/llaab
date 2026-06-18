import { RunMonitorTrigger } from 'components/RunMonitor';
import { VaultGitTrigger } from 'components/VaultGitPanel';
import { CleanVaultDialog } from 'dialogs/CleanVaultDialog/CleanVaultDialog';
import type { SecondaryPanel } from './AppLayout';
import type { ReactNode } from 'react';

import styles from './AppLayout.module.css';

interface SecondaryActionBarProps {
  leadingAction: ReactNode;
  activePanel: SecondaryPanel;
  onActivePanelChange: (panel: SecondaryPanel) => void;
}

export function SecondaryActionBar({
  leadingAction,
  activePanel,
  onActivePanelChange,
}: SecondaryActionBarProps) {
  const toggle = (panel: Exclude<SecondaryPanel, null>) => {
    onActivePanelChange(activePanel === panel ? null : panel);
  };

  return (
    <div className={styles.secondaryActions}>
      <div className={styles.secondaryLeading}>{leadingAction}</div>
      <div className={styles.secondaryTrailing}>
        <CleanVaultDialog resetIngestFormOnSuccess />
        <VaultGitTrigger isActive={activePanel === 'vaultGit'} onToggle={() => toggle('vaultGit')} />
        <RunMonitorTrigger isOpen={activePanel === 'runs'} onToggle={() => toggle('runs')} />
      </div>
    </div>
  );
}

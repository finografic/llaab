import { cn } from '@llaab/ui/lib/utils';
import { RunMonitorTrigger } from 'components/RunMonitor';
import { Button } from 'components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip';
import { VaultGitTrigger } from 'components/VaultGitPanel';
import { CleanVaultDialog } from 'dialogs/CleanVaultDialog/CleanVaultDialog';
import { PanelLeftIcon } from 'lucide-react';
import type { SecondaryPanel } from './AppLayout';
import type { ReactNode } from 'react';

import styles from './AppLayout.module.css';

interface SecondaryActionBarProps {
  leadingAction: ReactNode;
  isLeftSidebarOpen: boolean;
  onLeftSidebarOpenChange: (open: boolean) => void;
  activePanel: SecondaryPanel;
  onActivePanelChange: (panel: SecondaryPanel) => void;
}

export function SecondaryActionBar({
  leadingAction,
  isLeftSidebarOpen,
  onLeftSidebarOpenChange,
  activePanel,
  onActivePanelChange,
}: SecondaryActionBarProps) {
  const toggle = (panel: Exclude<SecondaryPanel, null>) => {
    onActivePanelChange(activePanel === panel ? null : panel);
  };

  return (
    <div className={styles.secondaryActions}>
      <div className={styles.secondaryLeading}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(styles.secondaryPanelTrigger, isLeftSidebarOpen && styles.isActive)}
              onClick={() => onLeftSidebarOpenChange(!isLeftSidebarOpen)}
              aria-pressed={isLeftSidebarOpen}
              aria-label="Toggle left sidebar"
            >
              <PanelLeftIcon aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle left sidebar</TooltipContent>
        </Tooltip>
        {leadingAction}
      </div>
      <div className={styles.secondaryTrailing}>
        <CleanVaultDialog resetIngestFormOnSuccess />
        <VaultGitTrigger isActive={activePanel === 'vaultGit'} onToggle={() => toggle('vaultGit')} />
        <RunMonitorTrigger isOpen={activePanel === 'runs'} onToggle={() => toggle('runs')} />
      </div>
    </div>
  );
}

import { BrainIcon, LandPlotIcon, PipetteIcon, VoicemailIcon } from '@llaab/icons';
import { NavMenu } from 'components/NavMenu/NavMenu';
import { buttonVariants } from 'components/ui/button';
import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import styles from './AppHeader.module.css';

const iconButtonClass = buttonVariants({ variant: 'outline', size: 'icon' });

interface AppHeaderProps {
  actions?: ReactNode;
}

export function AppHeader({ actions }: AppHeaderProps) {
  const { pathname } = useLocation();

  return (
    <header className={styles.appHeader}>
      <NavMenu pathname={pathname} />

      <div className={styles.actions}>
        {actions}
        <Link to="/ingest" className={iconButtonClass} aria-label="Ingest source">
          <PipetteIcon className="icon" aria-hidden />
        </Link>
        <Link to="/vault/transcripts" className={iconButtonClass} aria-label="Transcripts">
          <VoicemailIcon className="icon" aria-hidden />
        </Link>
        <Link to="/llm" className={iconButtonClass} aria-label="LLM models">
          <BrainIcon className="icon" aria-hidden />
        </Link>
        <Link to="/dev/icons" className={iconButtonClass} aria-label="LLAAB Icons">
          <LandPlotIcon className="icon" aria-hidden />
        </Link>
      </div>
    </header>
  );
}

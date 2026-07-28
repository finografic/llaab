import { BookMarkedIcon, BrainIcon, InboxIcon, LandPlotIcon, PipetteIcon, VoicemailIcon } from '@llaab/icons';
import { cn } from '@llaab/ui/lib/utils';
import { NavMenu } from 'components/NavMenu/NavMenu';
import { buttonVariants } from 'components/ui/button';
import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import styles from './AppHeader.module.css';

const iconButtonClass = cn(
  buttonVariants({ variant: 'ghost', size: 'icon' }),
  // Ghost defaults to hover:text-foreground; keep always-on accent like the old outline tier.
  'hover:text-[var(--accent-hover)]',
);

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
        <Link to="/knowledge/wikis" className={iconButtonClass} aria-label="Wikis">
          <BookMarkedIcon className="icon" aria-hidden />
        </Link>
        <Link to="/vault/inbox" className={iconButtonClass} aria-label="Inbox">
          <InboxIcon className="icon" aria-hidden />
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

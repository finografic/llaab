import { cn } from '@llaab/ui/lib/utils';
import { AppFooter } from 'components/AppFooter/AppFooter';
import { AppHeader } from 'components/AppHeader/AppHeader';
import { Outlet, useMatches } from 'react-router-dom';

import styles from './AppLayout.module.css';

export interface RouteHandle {
  title?: string;
  fullBleed?: boolean;
}

export function AppLayout() {
  const matches = useMatches();
  const handle = [...matches].toReversed().find((match) => match.handle)?.handle as RouteHandle | undefined;
  const { title, fullBleed = false } = handle ?? {};

  return (
    <div className={styles.appShell}>
      <AppHeader title={title} />
      <main className={cn(styles.pageContent, fullBleed && styles.pageContentBleed)}>
        <Outlet />
      </main>
      <AppFooter />
    </div>
  );
}

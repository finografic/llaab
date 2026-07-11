import { useIsPackagePinned, useIsRepositoryPinned } from 'queries/registry';
import { Link } from 'react-router-dom';

import styles from './RegistrySidebarSectionLabel.module.css';

export type RegistrySidebarSectionLabelKind = 'package' | 'repository';

interface RegistrySidebarSectionLabelProps {
  kind: RegistrySidebarSectionLabelKind;
  /** Npm package name or `owner/repo`. */
  target: string;
  children: string;
}

function detailPath(kind: RegistrySidebarSectionLabelKind, target: string): string | null {
  if (kind === 'package') {
    return target ? `/registry/package/${encodeURIComponent(target)}` : null;
  }
  const [owner, repo] = target.split('/');
  if (!owner || !repo) return null;
  return `/registry/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

/**
 * Sidebar section label — becomes a white underlined Link to the internal
 * detail route once the target is pinned (updates live when pin toggles).
 */
export function RegistrySidebarSectionLabel({ kind, target, children }: RegistrySidebarSectionLabelProps) {
  const isPackagePinned = useIsPackagePinned(kind === 'package' ? target : '');
  const isRepoPinned = useIsRepositoryPinned(kind === 'repository' ? target : '');
  const isPinned = kind === 'package' ? isPackagePinned : isRepoPinned;
  const to = detailPath(kind, target);

  if (isPinned && to) {
    return (
      <Link to={to} className={styles.labelLink}>
        {children}
      </Link>
    );
  }

  return <span className={styles.label}>{children}</span>;
}

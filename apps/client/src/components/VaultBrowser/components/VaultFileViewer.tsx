import { useVaultFile } from 'queries/vault';

import styles from './VaultFileViewer.module.css';

export interface VaultFileViewerProps {
  path: string | null;
}

export function VaultFileViewer({ path }: VaultFileViewerProps) {
  const { data: content, isLoading: loading, error: fileError } = useVaultFile(path);
  const error = fileError instanceof Error ? fileError.message : fileError ? 'Failed to load file.' : null;

  return (
    <div className={styles.viewer}>
      {!path ? <p className={styles.viewerEmpty}>Select a file to view its contents.</p> : null}
      {path && loading ? <p className={styles.viewerLoading}>Loading…</p> : null}
      {path && error ? <p className={styles.viewerError}>{error}</p> : null}
      {path && !loading && content != null ? (
        <div className={styles.viewerContent}>
          <p className={styles.viewerPath}>{path}</p>
          <pre className={styles.viewerPre}>{content}</pre>
        </div>
      ) : null}
    </div>
  );
}

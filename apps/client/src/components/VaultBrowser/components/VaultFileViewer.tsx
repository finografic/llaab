import { File, PatchDiff } from '@pierre/diffs/react';
import { useVaultFile, useVaultFileDiff } from 'queries/vault';
import { useMemo } from 'react';

import { PIERRE_DIFFS_THEME_STYLE } from 'lib/pierre-diffs-theme';

import styles from './VaultFileViewer.module.css';

export interface VaultFileViewerProps {
  path: string | null;
  showDiff?: boolean;
}

export function VaultFileViewer({ path, showDiff = false }: VaultFileViewerProps) {
  const { data: content, isLoading: fileLoading, error: fileError } = useVaultFile(path, !showDiff);
  const { data: patch, isLoading: diffLoading, error: diffError } = useVaultFileDiff(path, showDiff);
  const activeError = showDiff ? diffError : fileError;
  const loading = showDiff ? diffLoading : fileLoading;
  const error =
    activeError instanceof Error ? activeError.message : activeError ? 'Failed to load file.' : null;

  // Experimental: render vault file contents with `@pierre/diffs` (no diff markers, just
  // syntax highlighting) to evaluate how it handles markdown before deciding whether to also
  // adopt it for the Vault Changes diff view.
  const file = useMemo(
    () => (path && content != null ? { name: path, contents: content } : null),
    [path, content],
  );

  return (
    <div className={styles.viewer}>
      {!path ? <p className={styles.viewerEmpty}>Select a file to view its contents.</p> : null}
      {path && loading ? <p className={styles.viewerLoading}>Loading…</p> : null}
      {path && error ? <p className={styles.viewerError}>{error}</p> : null}
      {path && showDiff && patch === '' && !loading && !error ? (
        <p className={styles.viewerEmpty}>No working-tree diff for this file.</p>
      ) : null}
      {path && showDiff && patch ? (
        <PatchDiff
          key={`${path}:diff`}
          patch={patch}
          style={{ ...PIERRE_DIFFS_THEME_STYLE, height: 'auto' }}
          options={{
            diffStyle: 'unified',
            diffIndicators: 'bars',
            overflow: 'wrap',
            themeType: 'dark',
          }}
          className={styles.viewerFile}
        />
      ) : null}
      {file ? (
        <File
          key={file.name}
          file={file}
          // Render at natural height so the page's own scroll container handles scrolling,
          // instead of the file growing a second nested scrollbar.
          style={{ ...PIERRE_DIFFS_THEME_STYLE, height: 'auto' }}
          options={{ themeType: 'dark' }}
          className={styles.viewerFile}
        />
      ) : null}
    </div>
  );
}

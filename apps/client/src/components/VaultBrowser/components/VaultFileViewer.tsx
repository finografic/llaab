import { File, PatchDiff } from '@pierre/diffs/react';
import { ToggleGroup, ToggleGroupItem } from 'components/ui/toggle-group';
import { useVaultFile, useVaultFileDiff } from 'queries/vault';
import { useMemo } from 'react';

import { PIERRE_DIFFS_THEME_STYLE } from 'constants/pierre-diffs-theme';

import styles from './VaultFileViewer.module.css';

export interface VaultFileViewerProps {
  path: string | null;
  showDiff?: boolean;
  showRenderedMarkdown?: boolean;
  onMarkdownViewChange?: (mode: 'raw' | 'render') => void;
}

function isMarkdownPath(path: string | null): boolean {
  return path?.toLowerCase().endsWith('.md') === true || path?.toLowerCase().endsWith('.markdown') === true;
}

export function VaultFileViewer({
  path,
  showDiff = false,
  showRenderedMarkdown = false,
  onMarkdownViewChange,
}: VaultFileViewerProps) {
  const renderMarkdown = showRenderedMarkdown && isMarkdownPath(path);
  const {
    data: fileContent,
    isLoading: fileLoading,
    error: fileError,
  } = useVaultFile(path, !showDiff, renderMarkdown);
  const { data: patch, isLoading: diffLoading, error: diffError } = useVaultFileDiff(path, showDiff);
  const activeError = showDiff ? diffError : fileError;
  const loading = showDiff ? diffLoading : fileLoading;
  const error =
    activeError instanceof Error ? activeError.message : activeError ? 'Failed to load file.' : null;

  // Experimental: render vault file contents with `@pierre/diffs` (no diff markers, just
  // syntax highlighting) to evaluate how it handles markdown before deciding whether to also
  // adopt it for the Vault Changes diff view.
  const file = useMemo(
    () =>
      path && fileContent?.content != null && !fileContent.html
        ? { name: path, contents: fileContent.content }
        : null,
    [path, fileContent],
  );
  const canRenderMarkdown = !showDiff && isMarkdownPath(path);

  return (
    <div className={styles.viewer}>
      {!path ? <p className={styles.viewerEmpty}>Select a file to view its contents.</p> : null}
      {path && loading ? <p className={styles.viewerLoading}>Loading…</p> : null}
      {path && error ? <p className={styles.viewerError}>{error}</p> : null}
      {path && canRenderMarkdown && !loading && !error ? (
        <div className={styles.viewerToolbar}>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={showRenderedMarkdown ? 'render' : 'raw'}
            onValueChange={(value) => {
              if (value === 'raw' || value === 'render') onMarkdownViewChange?.(value);
            }}
            aria-label="Markdown view"
          >
            <ToggleGroupItem value="raw">Raw</ToggleGroupItem>
            <ToggleGroupItem value="render">Rendered</ToggleGroupItem>
          </ToggleGroup>
        </div>
      ) : null}
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
      {path && !showDiff && showRenderedMarkdown && fileContent?.html ? (
        <article className={styles.markdownContent} dangerouslySetInnerHTML={{ __html: fileContent.html }} />
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

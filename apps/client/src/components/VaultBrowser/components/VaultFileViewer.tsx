import { File, PatchDiff } from '@pierre/diffs/react';
import { TtsPlayer } from 'components/TtsPlayer';
import { Card, CardContent } from 'components/ui/card';
import { Col, Row } from 'components/ui/grid';
import { ToggleGroup, ToggleGroupItem } from 'components/ui/toggle-group';
import { useVaultFile, useVaultFileDiff } from 'queries/vault';
import { useMemo } from 'react';
import type { VaultMarkdownRenderMode } from 'queries/vault';

import { PIERRE_DIFFS_THEME_STYLE } from 'constants/pierre-diffs-theme';

import styles from './VaultFileViewer.module.css';

export interface VaultFileViewerProps {
  path: string | null;
  showDiff?: boolean;
  showRenderedMarkdown?: boolean;
  showEnhancedMarkdown?: boolean;
  onMarkdownViewChange?: (mode: VaultMarkdownRenderMode) => void;
}

function isMarkdownPath(path: string | null): boolean {
  return path?.toLowerCase().endsWith('.md') === true || path?.toLowerCase().endsWith('.markdown') === true;
}

export function VaultFileViewer({
  path,
  showDiff = false,
  showRenderedMarkdown = false,
  showEnhancedMarkdown = false,
  onMarkdownViewChange,
}: VaultFileViewerProps) {
  const markdownView: VaultMarkdownRenderMode = showEnhancedMarkdown
    ? 'enhanced'
    : showRenderedMarkdown
      ? 'render'
      : 'raw';
  const {
    data: fileContent,
    isLoading: fileLoading,
    error: fileError,
  } = useVaultFile(path, !showDiff, isMarkdownPath(path) ? markdownView : 'raw');
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
      path && fileContent?.content != null && !fileContent.html && fileContent.sections.length === 0
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
            value={markdownView}
            onValueChange={(value) => {
              if (value === 'raw' || value === 'render' || value === 'enhanced') {
                onMarkdownViewChange?.(value);
              }
            }}
            aria-label="Markdown view"
          >
            <ToggleGroupItem value="raw">Raw</ToggleGroupItem>
            <ToggleGroupItem value="render">Rendered</ToggleGroupItem>
            <ToggleGroupItem value="enhanced">Enhanced</ToggleGroupItem>
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
      {path && !showDiff && showEnhancedMarkdown && fileContent?.sections.length ? (
        <Row className={styles.enhancedLayout} gutterWidth={16}>
          <Col xs={12} lg="content" className={styles.enhancedMain}>
            <div className={styles.enhancedSections}>
              {fileContent.sections.map((section) => (
                <Card key={section.id} id={section.id} className={styles.enhancedCard}>
                  <CardContent className={styles.enhancedCardContent}>
                    <div className={styles.enhancedCardToolbar}>
                      <TtsPlayer variant="minimal" text={section.markdown} />
                    </div>
                    <article
                      className={styles.markdownContent}
                      dangerouslySetInnerHTML={{ __html: section.html }}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </Col>
          <Col xs={12} lg="content" className={styles.enhancedTocCol}>
            <Card className={styles.enhancedTocCard}>
              <CardContent className={styles.enhancedTocContent}>
                <div className={styles.enhancedTocHeading}>Contents</div>
                <nav aria-label="Enhanced markdown sections">
                  <ol className={styles.enhancedTocList}>
                    {fileContent.sections.map((section) => (
                      <li key={section.id}>
                        <a href={`#${section.id}`}>{section.heading}</a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </CardContent>
            </Card>
          </Col>
        </Row>
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

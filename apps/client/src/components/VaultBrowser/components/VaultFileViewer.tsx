import { File, PatchDiff } from '@pierre/diffs/react';
import { TtsPlayer } from 'components/TtsPlayer';
import { Card, CardContent } from 'components/ui/card';
import { Col, Row } from 'components/ui/grid';
import { Toggle } from 'components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from 'components/ui/toggle-group';
import { SquareArrowUpIcon } from 'lucide-react';
import { useVaultFile, useVaultFileDiff } from 'queries/vault';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { VaultMarkdownRenderMode, VaultMarkdownSplitLevel } from 'queries/vault';

import { PIERRE_DIFFS_THEME_STYLE } from 'constants/pierre-diffs-theme';

import styles from './VaultFileViewer.module.css';

const BACK_TO_TOP_SCROLL_THRESHOLD = 600;
const ACTIVE_SECTION_TOP_OFFSET = 160;
const QUOTE_RUN_CLASS = 'quote-run';
const OPENING_QUOTE_PATTERN = /^["“]/u;
const CLOSING_QUOTE_PATTERN = /["”]\s*$/u;

function getScrollParent(element: HTMLElement | null): HTMLElement | Window {
  let current = element?.parentElement ?? null;

  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === 'auto' || overflowY === 'scroll') return current;
    current = current.parentElement;
  }

  return window;
}

function getScrollTop(scrollParent: HTMLElement | Window) {
  return scrollParent instanceof Window ? scrollParent.scrollY : scrollParent.scrollTop;
}

function annotateQuoteRuns(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  let quoteRunOpen = false;

  for (const element of template.content.children) {
    if (element.tagName.toLowerCase() !== 'p') continue;

    const text = element.textContent?.trim() ?? '';
    const startsQuote = OPENING_QUOTE_PATTERN.test(text);
    const endsQuote = CLOSING_QUOTE_PATTERN.test(text);

    if (startsQuote || quoteRunOpen) {
      element.classList.add(QUOTE_RUN_CLASS);
      quoteRunOpen = !endsQuote;
    }
  }

  return template.innerHTML;
}

export interface VaultFileViewerProps {
  path: string | null;
  showDiff?: boolean;
  showRenderedMarkdown?: boolean;
  showEnhancedMarkdown?: boolean;
  splitLevel?: VaultMarkdownSplitLevel;
  onMarkdownViewChange?: (mode: VaultMarkdownRenderMode) => void;
  onSplitLevelChange?: (level: VaultMarkdownSplitLevel) => void;
}

function isMarkdownPath(path: string | null): boolean {
  return path?.toLowerCase().endsWith('.md') === true || path?.toLowerCase().endsWith('.markdown') === true;
}

export function VaultFileViewer({
  path,
  showDiff = false,
  showRenderedMarkdown = false,
  showEnhancedMarkdown = false,
  splitLevel = 'h1',
  onMarkdownViewChange,
  onSplitLevelChange,
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
  } = useVaultFile(path, !showDiff, isMarkdownPath(path) ? markdownView : 'raw', splitLevel);
  const { data: patch, isLoading: diffLoading, error: diffError } = useVaultFileDiff(path, showDiff);
  const [highlightBold, setHighlightBold] = useState(false);
  const [italiciseQuotes, setItaliciseQuotes] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const scrollParentRef = useRef<HTMLElement | Window>(window);
  const enhancedSectionRefs = useRef(new Map<string, HTMLDivElement>());
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
  const enhancedSections = useMemo(() => fileContent?.sections ?? [], [fileContent?.sections]);
  const useEnhancedPresentation = showEnhancedMarkdown;
  const markdownClassName = [
    styles.markdownContent,
    useEnhancedPresentation && highlightBold ? styles.highlightBold : '',
    useEnhancedPresentation && italiciseQuotes ? styles.italiciseQuotes : '',
  ]
    .filter(Boolean)
    .join(' ');
  const renderedHtml = useMemo(
    () =>
      useEnhancedPresentation && italiciseQuotes && fileContent?.html
        ? annotateQuoteRuns(fileContent.html)
        : fileContent?.html,
    [fileContent?.html, italiciseQuotes, useEnhancedPresentation],
  );
  const enhancedSectionHtml = useMemo(
    () =>
      new Map(
        enhancedSections.map((section) => [
          section.id,
          useEnhancedPresentation && italiciseQuotes ? annotateQuoteRuns(section.html) : section.html,
        ]),
      ),
    [enhancedSections, italiciseQuotes, useEnhancedPresentation],
  );

  useEffect(() => {
    if (!path) return;

    const scrollParent = getScrollParent(viewerRef.current);
    scrollParentRef.current = scrollParent;
    scrollParent.scrollTo({ top: 0, behavior: 'auto' });
    setActiveSectionId(null);
    setShowBackToTop(false);
  }, [path]);

  useEffect(() => {
    if (!showEnhancedMarkdown) return;

    setHighlightBold(true);
    setItaliciseQuotes(true);
  }, [showEnhancedMarkdown]);

  useEffect(() => {
    if (!showEnhancedMarkdown || enhancedSections.length === 0) {
      setActiveSectionId(null);
      setShowBackToTop(false);
      return;
    }

    const scrollParent = getScrollParent(viewerRef.current);
    scrollParentRef.current = scrollParent;

    function updateScrollState() {
      let nextActiveId = enhancedSections[0]?.id ?? null;
      const firstSection = nextActiveId ? enhancedSectionRefs.current.get(nextActiveId) : null;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const section of enhancedSections) {
        const element = enhancedSectionRefs.current.get(section.id);
        if (!element) continue;
        const distance = Math.abs(element.getBoundingClientRect().top - ACTIVE_SECTION_TOP_OFFSET);
        if (distance < closestDistance) {
          closestDistance = distance;
          nextActiveId = section.id;
        }
      }

      setActiveSectionId(nextActiveId);
      setShowBackToTop(
        getScrollTop(scrollParent) > BACK_TO_TOP_SCROLL_THRESHOLD ||
          (firstSection?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY) < 0,
      );
    }

    updateScrollState();
    scrollParent.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    return () => {
      scrollParent.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [enhancedSections, showEnhancedMarkdown]);

  function setEnhancedSectionRef(id: string) {
    return (element: HTMLDivElement | null) => {
      if (element) {
        enhancedSectionRefs.current.set(id, element);
      } else {
        enhancedSectionRefs.current.delete(id);
      }
    };
  }

  function scrollToTop() {
    scrollParentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleTocClick(sectionId: string) {
    setActiveSectionId(sectionId);
    window.setTimeout(() => {
      const section = enhancedSectionRefs.current.get(sectionId);
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  return (
    <div ref={viewerRef} className={styles.viewer}>
      {!path ? <p className={styles.viewerEmpty}>Select a file to view its contents.</p> : null}
      {path && loading ? <p className={styles.viewerLoading}>Loading…</p> : null}
      {path && error ? <p className={styles.viewerError}>{error}</p> : null}
      {path && canRenderMarkdown && !loading && !error ? (
        <div className={styles.viewerToolbar}>
          <Row gutterWidth={12} className={styles.viewerToolbarRow} align="center">
            <Col xs={6} className={styles.viewerToolbarLeft}>
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
            </Col>
            <Col xs={6} className={styles.viewerToolbarRight}>
              {showEnhancedMarkdown ? (
                <>
                  <ToggleGroup
                    type="single"
                    size="sm"
                    variant="outline"
                    value={splitLevel}
                    onValueChange={(value) => {
                      if (value === 'h1' || value === 'h2') onSplitLevelChange?.(value);
                    }}
                    aria-label="Split markdown sections by"
                  >
                    <ToggleGroupItem value="h1">H1</ToggleGroupItem>
                    <ToggleGroupItem value="h2">H2</ToggleGroupItem>
                  </ToggleGroup>
                  <Toggle
                    size="sm"
                    variant="outline"
                    pressed={highlightBold}
                    onPressedChange={setHighlightBold}
                    aria-label="Highlight bold text"
                  >
                    Highlight Bold
                  </Toggle>
                  <Toggle
                    size="sm"
                    variant="outline"
                    pressed={italiciseQuotes}
                    onPressedChange={setItaliciseQuotes}
                    aria-label="Italicise quotes"
                  >
                    Italicise Quotes
                  </Toggle>
                </>
              ) : null}
            </Col>
          </Row>
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
        <article className={markdownClassName} dangerouslySetInnerHTML={{ __html: renderedHtml ?? '' }} />
      ) : null}
      {path && !showDiff && showEnhancedMarkdown && enhancedSections.length ? (
        <Row className={styles.enhancedLayout} gutterWidth={16}>
          <Col xs={12} lg="content" className={styles.enhancedMain}>
            <div className={styles.enhancedSections}>
              {enhancedSections.map((section) => (
                <Card
                  key={section.id}
                  id={section.id}
                  ref={setEnhancedSectionRef(section.id)}
                  className={styles.enhancedCard}
                >
                  <CardContent className={styles.enhancedCardContent}>
                    <div className={styles.enhancedCardToolbar}>
                      <TtsPlayer variant="minimal" text={section.markdown} />
                    </div>
                    <article
                      className={markdownClassName}
                      dangerouslySetInnerHTML={{
                        __html: enhancedSectionHtml.get(section.id) ?? section.html,
                      }}
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
                    {enhancedSections.map((section) => (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          className={
                            activeSectionId === section.id ? styles.enhancedTocLinkActive : undefined
                          }
                          aria-current={activeSectionId === section.id ? 'location' : undefined}
                          onClick={() => handleTocClick(section.id)}
                        >
                          {section.heading}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </CardContent>
            </Card>
          </Col>
          {showBackToTop ? (
            <button
              type="button"
              className={styles.backToTopButton}
              aria-label="Back to top"
              title="Back to top"
              onClick={scrollToTop}
            >
              <SquareArrowUpIcon aria-hidden="true" />
            </button>
          ) : null}
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

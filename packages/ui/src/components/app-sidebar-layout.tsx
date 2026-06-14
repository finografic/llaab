'use client';

import { useIsMobile } from 'hooks/useIsMobile';
import * as React from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from 'ui/resizable';
import { SidebarInset, SidebarProvider } from 'ui/sidebar';
import { cn } from 'utils';
import type { Layout, PanelImperativeHandle, PanelSize } from 'react-resizable-panels';

export type AppSidebarAlign = 'left' | 'right';

/**
 * `inline` — sidebar in flex flow below any layout header (default for LLAAB; stays under sticky app header).
 * `fixed` — shadcn fixed `inset-y-0` sidebar; do not use with the global sticky `AppHeader`.
 */
export type AppSidebarPosition = 'inline' | 'fixed';

export interface AppSidebarLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  /** Full-width row above the sidebar + main columns (sidebar-16 pattern). */
  header?: React.ReactNode;
  resizable?: boolean;
  /**
   * Panel size bounds for the sidebar (resizable mode only). Pass CSS unit strings:
   * "20%", "200px", "10rem". Bare numbers are treated as **pixels** by the library.
   * Defaults are percentage strings: minWidth "18%", maxWidth "45%", defaultWidth "28%".
   */
  minWidth?: number | string;
  maxWidth?: number | string;
  defaultWidth?: number | string;
  align?: AppSidebarAlign;
  position?: AppSidebarPosition;
  className?: string;
  headerClassName?: string;
  sidebarClassName?: string;
  sidebarPanelClassName?: string;
  insetClassName?: string;
  style?: React.CSSProperties;

  // ── Persistent layout ────────────────────────────────────────────────────
  /**
   * Stable id for the sidebar panel — required when using persistent layout so
   * the saved layout can be matched back to the correct panel on restore.
   * Defaults to "sidebar".
   */
  sidebarPanelId?: string;
  /**
   * Stable id for the main content panel. Defaults to "main".
   */
  mainPanelId?: string;
  /**
   * Pass the `defaultLayout` returned by `useDefaultLayout()` to restore a previously
   * saved layout from storage. Import the hook from `components/ui/resizable`.
   *
   * @example
   *   import { useDefaultLayout } from 'components/ui/resizable';
   *
   *   const { defaultLayout, onLayoutChanged } = useDefaultLayout({
   *   id: "transcripts-split",
   *   storage: localStorage,
   *   });
   *   <AppSidebarLayout
   *   sidebarPanelId="transcripts-sidebar"
   *   mainPanelId="transcripts-main"
   *   defaultLayout={defaultLayout}
   *   onLayoutChanged={onLayoutChanged}
   *   ...
   *   />
   */
  defaultLayout?: Layout;
  /** Pass the `onLayoutChanged` callback returned by `useDefaultLayout()`. */
  onLayoutChanged?: (layout: Layout) => void;

  // ── Collapsible sidebar ───────────────────────────────────────────────────
  /**
   * Allow the sidebar panel to be collapsed. The panel collapses when dragged
   * below `minWidth`; expand by dragging outward or via the panel's imperative handle.
   */
  collapsible?: boolean;
  /**
   * Size of the sidebar when collapsed — same CSS unit formats as minWidth.
   * Defaults to "0%" (fully hidden).
   */
  collapsedSize?: number | string;
  /** Called when the sidebar panel collapses. */
  onCollapse?: () => void;
  /** Called when the sidebar panel expands from its collapsed state. */
  onExpand?: () => void;
  /**
   * Ref to the sidebar panel's imperative handle — use to call `.collapse()` or
   * `.expand()` programmatically. Import `usePanelRef` from `components/ui/resizable`.
   */
  sidebarPanelRef?: React.Ref<PanelImperativeHandle | null>;
}

/** Convert a caller-supplied width value to a CSS unit string safe for the library. */
function toCssSize(value: number | string, _fallback: string): string {
  if (typeof value === 'string') return value;
  // Legacy callers may pass bare percentage numbers (18, 28, 45) — preserve that.
  return `${value}%`;
}

/**
 * True when a sidebar size value is a pure percentage (or bare number treated as %).
 * Absolute units like "600px" or "20rem" return false.
 */
function isPercentOrBare(v: number | string): boolean {
  if (typeof v === 'number') return true;
  const s = v.trim();
  return s.endsWith('%') || /^\d+(\.\d+)?$/.test(s);
}

function SidebarColumn({
  children,
  position,
  className,
}: {
  children: React.ReactNode;
  position: AppSidebarPosition;
  className?: string;
}) {
  return (
    <div
      data-sidebar-position={position}
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-col bg-sidebar text-sidebar-foreground',
        position === 'fixed' && 'relative',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AppSidebarLayout({
  sidebar,
  children,
  header,
  resizable = false,
  minWidth = '18%',
  maxWidth = '45%',
  defaultWidth = '28%',
  align = 'left',
  position = 'inline',
  className,
  headerClassName,
  sidebarClassName,
  sidebarPanelClassName,
  insetClassName,
  style,
  sidebarPanelId = 'sidebar',
  mainPanelId = 'main',
  defaultLayout,
  onLayoutChanged,
  collapsible = false,
  collapsedSize = '0%',
  onCollapse,
  onExpand,
  sidebarPanelRef,
}: AppSidebarLayoutProps) {
  const isMobile = useIsMobile();

  // Detect collapse/expand transitions via onResize since the library has no
  // dedicated onCollapse/onExpand panel props — compare current vs previous size.
  const prevSizeRef = React.useRef<number | undefined>(undefined);
  const collapsedPct = parseFloat(String(collapsedSize));
  const handleSidebarResize = React.useCallback(
    (panelSize: PanelSize) => {
      const current = panelSize.asPercentage;
      const prev = prevSizeRef.current;
      if (prev !== undefined) {
        if (current <= collapsedPct && prev > collapsedPct) onCollapse?.();
        else if (current > collapsedPct && prev <= collapsedPct) onExpand?.();
      }
      prevSizeRef.current = current;
    },
    [collapsedPct, onCollapse, onExpand],
  );

  const sidebarMin = toCssSize(minWidth, '18%');
  const sidebarMax = toCssSize(maxWidth, '45%');
  const sidebarDefault = toCssSize(defaultWidth, '28%');

  // Complement sizes for the main panel only make sense when sidebar values are pure
  // percentages. Pixel-based sidebar sizes (e.g. "600px") produce invalid negative
  // results like "-500%" which collapse the main panel to 0 width.
  const sidebarUsesPercent =
    isPercentOrBare(minWidth) && isPercentOrBare(maxWidth) && isPercentOrBare(defaultWidth);
  const numDefault = parseFloat(String(defaultWidth));
  const numMin = parseFloat(String(minWidth));
  const numMax = parseFloat(String(maxWidth));
  const mainDefault = sidebarUsesPercent ? `${100 - numDefault}%` : undefined;
  const mainMin = sidebarUsesPercent ? `${100 - numMax}%` : '1%';
  const mainMax = sidebarUsesPercent ? `${100 - numMin}%` : undefined;

  const inset = (
    <SidebarInset
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background',
        insetClassName,
      )}
    >
      {children}
    </SidebarInset>
  );

  const sidebarColumn = (
    <SidebarColumn position={position} className={sidebarClassName}>
      {sidebar}
    </SidebarColumn>
  );

  const sidebarPanel = (
    <ResizablePanel
      id={sidebarPanelId}
      defaultSize={sidebarDefault}
      minSize={sidebarMin}
      maxSize={sidebarMax}
      collapsible={collapsible}
      collapsedSize={collapsedSize}
      onResize={(onCollapse ?? onExpand) ? handleSidebarResize : undefined}
      panelRef={sidebarPanelRef}
      className={cn('min-w-0', sidebarPanelClassName)}
    >
      {sidebarColumn}
    </ResizablePanel>
  );

  const mainPanel = (
    <ResizablePanel
      id={mainPanelId}
      defaultSize={mainDefault}
      minSize={mainMin}
      maxSize={mainMax}
      className="min-w-0"
    >
      {inset}
    </ResizablePanel>
  );

  const columns = resizable ? (
    <ResizablePanelGroup
      orientation={isMobile ? 'vertical' : 'horizontal'}
      className="min-h-0 flex-1"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      {align === 'left' ? (
        <>
          {sidebarPanel}
          <ResizableHandle withHandle />
          {mainPanel}
        </>
      ) : (
        <>
          {mainPanel}
          <ResizableHandle withHandle />
          {sidebarPanel}
        </>
      )}
    </ResizablePanelGroup>
  ) : (
    <div className={cn('flex min-h-0 flex-1', align === 'right' && 'flex-row-reverse')}>
      {sidebarColumn}
      {inset}
    </div>
  );

  return (
    <SidebarProvider className={cn('flex min-h-0 w-full flex-1 flex-col', className)} style={style}>
      {header ? (
        <header
          className={cn(
            'z-40 flex h-(--secondary-actions-h) shrink-0 items-center gap-2 border-b bg-background px-4',
            headerClassName,
          )}
        >
          {header}
        </header>
      ) : null}
      {columns}
    </SidebarProvider>
  );
}

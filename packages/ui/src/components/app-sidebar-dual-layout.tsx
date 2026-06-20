'use client';

import { useIsMobile } from 'hooks/useIsMobile';
import * as React from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from 'ui/resizable';
import { SidebarInset, SidebarProvider } from 'ui/sidebar';
import { cn } from 'utils';
import type { Layout, PanelImperativeHandle, PanelSize } from 'react-resizable-panels';

export type AppSidebarAlign = 'left' | 'right';

/**
 * `inline` — sidebars in flex flow below any layout header (default for LLAAB; stays under sticky app
 * header). `fixed` — shadcn fixed `inset-y-0` sidebar; do not use with the global sticky `AppHeader`.
 */
export type AppSidebarPosition = 'inline' | 'fixed';

export interface AppSidebarLayoutProps {
  /** Backward-compatible single-sidebar slot. Uses `align` to decide left vs right. */
  sidebar?: React.ReactNode;
  leftSidebar?: React.ReactNode;
  rightSidebar?: React.ReactNode;
  children: React.ReactNode;
  /** Full-width row above the sidebar + main columns (sidebar-16 pattern). */
  header?: React.ReactNode;
  resizable?: boolean;
  /**
   * Panel size bounds for the legacy/right sidebar (resizable mode only). Pass CSS unit strings:
   * "20%", "200px", "10rem". Bare numbers are treated as percentages by this wrapper.
   * Defaults are percentage strings: minWidth "18%", maxWidth "45%", defaultWidth "28%".
   */
  minWidth?: number | string;
  maxWidth?: number | string;
  defaultWidth?: number | string;
  leftMinWidth?: number | string;
  leftMaxWidth?: number | string;
  leftDefaultWidth?: number | string;
  align?: AppSidebarAlign;
  position?: AppSidebarPosition;
  className?: string;
  headerClassName?: string;
  sidebarClassName?: string;
  leftSidebarClassName?: string;
  rightSidebarClassName?: string;
  sidebarPanelClassName?: string;
  leftSidebarPanelClassName?: string;
  rightSidebarPanelClassName?: string;
  insetClassName?: string;
  style?: React.CSSProperties;

  // ── Persistent layout ────────────────────────────────────────────────────
  sidebarPanelId?: string;
  leftSidebarPanelId?: string;
  rightSidebarPanelId?: string;
  mainPanelId?: string;
  defaultLayout?: Layout;
  onLayoutChanged?: (layout: Layout) => void;

  // ── Collapsible sidebars ─────────────────────────────────────────────────
  collapsible?: boolean;
  leftCollapsible?: boolean;
  rightCollapsible?: boolean;
  collapsedSize?: number | string;
  leftCollapsedSize?: number | string;
  rightCollapsedSize?: number | string;
  onCollapse?: () => void;
  onExpand?: () => void;
  leftOnCollapse?: () => void;
  leftOnExpand?: () => void;
  rightOnCollapse?: () => void;
  rightOnExpand?: () => void;
  sidebarPanelRef?: React.Ref<PanelImperativeHandle | null>;
  leftSidebarPanelRef?: React.Ref<PanelImperativeHandle | null>;
  rightSidebarPanelRef?: React.Ref<PanelImperativeHandle | null>;
}

function toCssSize(value: number | string): string {
  if (typeof value === 'string') return value;
  return `${value}%`;
}

function isPercentOrBare(value: number | string): boolean {
  if (typeof value === 'number') return true;
  const text = value.trim();
  return text.endsWith('%') || /^\d+(\.\d+)?$/.test(text);
}

function parseSize(value: number | string): number {
  return Number.parseFloat(String(value));
}

function useResizeTransition({
  collapsedSize,
  onCollapse,
  onExpand,
}: {
  collapsedSize: number | string;
  onCollapse?: () => void;
  onExpand?: () => void;
}) {
  const prevSizeRef = React.useRef<number | undefined>(undefined);
  const collapsedPct = parseSize(collapsedSize);

  return React.useCallback(
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

interface SidebarPanelConfig {
  id: string;
  node: React.ReactNode;
  position: AppSidebarPosition;
  minWidth: number | string;
  maxWidth: number | string;
  defaultWidth: number | string;
  collapsible: boolean;
  collapsedSize: number | string;
  onResize?: (panelSize: PanelSize) => void;
  panelRef?: React.Ref<PanelImperativeHandle | null>;
  sidebarClassName?: string;
  panelClassName?: string;
}

function createSidebarPanel(config: SidebarPanelConfig) {
  return (
    <ResizablePanel
      id={config.id}
      defaultSize={toCssSize(config.defaultWidth)}
      minSize={toCssSize(config.minWidth)}
      maxSize={toCssSize(config.maxWidth)}
      collapsible={config.collapsible}
      collapsedSize={config.collapsedSize}
      onResize={config.onResize}
      panelRef={config.panelRef}
      className={cn('min-w-0', config.panelClassName)}
    >
      <SidebarColumn position={config.position} className={config.sidebarClassName}>
        {config.node}
      </SidebarColumn>
    </ResizablePanel>
  );
}

export function AppSidebarLayout({
  sidebar,
  leftSidebar,
  rightSidebar,
  children,
  header,
  resizable = false,
  minWidth = '18%',
  maxWidth = '45%',
  defaultWidth = '28%',
  leftMinWidth,
  leftMaxWidth,
  leftDefaultWidth,
  align = 'left',
  position = 'inline',
  className,
  headerClassName,
  sidebarClassName,
  leftSidebarClassName,
  rightSidebarClassName,
  sidebarPanelClassName,
  leftSidebarPanelClassName,
  rightSidebarPanelClassName,
  insetClassName,
  style,
  sidebarPanelId = 'sidebar',
  leftSidebarPanelId = 'left-sidebar',
  rightSidebarPanelId,
  mainPanelId = 'main',
  defaultLayout,
  onLayoutChanged,
  collapsible = false,
  leftCollapsible,
  rightCollapsible,
  collapsedSize = '0%',
  leftCollapsedSize,
  rightCollapsedSize,
  onCollapse,
  onExpand,
  leftOnCollapse,
  leftOnExpand,
  rightOnCollapse,
  rightOnExpand,
  sidebarPanelRef,
  leftSidebarPanelRef,
  rightSidebarPanelRef,
}: AppSidebarLayoutProps) {
  const isMobile = useIsMobile();
  const legacySidebarIsLeft = align === 'left';
  const resolvedLeftSidebar = leftSidebar ?? (legacySidebarIsLeft ? sidebar : null);
  const resolvedRightSidebar = rightSidebar ?? (legacySidebarIsLeft ? null : sidebar);

  const leftCollapseSize = leftCollapsedSize ?? collapsedSize;
  const rightCollapseSize = rightCollapsedSize ?? collapsedSize;
  const handleLeftResize = useResizeTransition({
    collapsedSize: leftCollapseSize,
    onCollapse: leftOnCollapse ?? (legacySidebarIsLeft ? onCollapse : undefined),
    onExpand: leftOnExpand ?? (legacySidebarIsLeft ? onExpand : undefined),
  });
  const handleRightResize = useResizeTransition({
    collapsedSize: rightCollapseSize,
    onCollapse: rightOnCollapse ?? (legacySidebarIsLeft ? undefined : onCollapse),
    onExpand: rightOnExpand ?? (legacySidebarIsLeft ? undefined : onExpand),
  });

  const leftMin = leftMinWidth ?? minWidth;
  const leftMax = leftMaxWidth ?? maxWidth;
  const leftDefault = leftDefaultWidth ?? defaultWidth;
  const rightMin = minWidth;
  const rightMax = maxWidth;
  const rightDefault = defaultWidth;
  const hasLeft = resolvedLeftSidebar !== null && resolvedLeftSidebar !== undefined;
  const hasRight = resolvedRightSidebar !== null && resolvedRightSidebar !== undefined;

  const sidebarsUsePercent =
    (!hasLeft || (isPercentOrBare(leftMin) && isPercentOrBare(leftMax) && isPercentOrBare(leftDefault))) &&
    (!hasRight || (isPercentOrBare(rightMin) && isPercentOrBare(rightMax) && isPercentOrBare(rightDefault)));
  const totalDefault = (hasLeft ? parseSize(leftDefault) : 0) + (hasRight ? parseSize(rightDefault) : 0);
  const totalMin = (hasLeft ? parseSize(leftMin) : 0) + (hasRight ? parseSize(rightMin) : 0);
  const totalMax = (hasLeft ? parseSize(leftMax) : 0) + (hasRight ? parseSize(rightMax) : 0);
  const mainDefault = sidebarsUsePercent ? `${100 - totalDefault}%` : undefined;
  const mainMin = sidebarsUsePercent ? `${Math.max(1, 100 - totalMax)}%` : '1%';
  const mainMax = sidebarsUsePercent ? `${100 - totalMin}%` : undefined;

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

  const leftPanel = hasLeft
    ? createSidebarPanel({
        id: leftSidebarPanelId,
        node: resolvedLeftSidebar,
        position,
        minWidth: leftMin,
        maxWidth: leftMax,
        defaultWidth: leftDefault,
        collapsible: leftCollapsible ?? (legacySidebarIsLeft ? collapsible : false),
        collapsedSize: leftCollapseSize,
        onResize:
          (leftOnCollapse ?? leftOnExpand ?? (legacySidebarIsLeft ? (onCollapse ?? onExpand) : undefined))
            ? handleLeftResize
            : undefined,
        panelRef: leftSidebarPanelRef ?? (legacySidebarIsLeft ? sidebarPanelRef : undefined),
        sidebarClassName: leftSidebarClassName ?? (legacySidebarIsLeft ? sidebarClassName : undefined),
        panelClassName:
          leftSidebarPanelClassName ?? (legacySidebarIsLeft ? sidebarPanelClassName : undefined),
      })
    : null;

  const rightPanel = hasRight
    ? createSidebarPanel({
        id: rightSidebarPanelId ?? sidebarPanelId,
        node: resolvedRightSidebar,
        position,
        minWidth: rightMin,
        maxWidth: rightMax,
        defaultWidth: rightDefault,
        collapsible: rightCollapsible ?? (legacySidebarIsLeft ? false : collapsible),
        collapsedSize: rightCollapseSize,
        onResize:
          (rightOnCollapse ?? rightOnExpand ?? (legacySidebarIsLeft ? undefined : (onCollapse ?? onExpand)))
            ? handleRightResize
            : undefined,
        panelRef: rightSidebarPanelRef ?? (legacySidebarIsLeft ? undefined : sidebarPanelRef),
        sidebarClassName: rightSidebarClassName ?? (legacySidebarIsLeft ? undefined : sidebarClassName),
        panelClassName:
          rightSidebarPanelClassName ?? (legacySidebarIsLeft ? undefined : sidebarPanelClassName),
      })
    : null;

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
      {leftPanel}
      {leftPanel ? <ResizableHandle withHandle /> : null}
      {mainPanel}
      {rightPanel ? <ResizableHandle withHandle /> : null}
      {rightPanel}
    </ResizablePanelGroup>
  ) : (
    <div className="flex min-h-0 flex-1">
      {hasLeft ? (
        <SidebarColumn
          position={position}
          className={leftSidebarClassName ?? (legacySidebarIsLeft ? sidebarClassName : undefined)}
        >
          {resolvedLeftSidebar}
        </SidebarColumn>
      ) : null}
      {inset}
      {hasRight ? (
        <SidebarColumn
          position={position}
          className={rightSidebarClassName ?? (legacySidebarIsLeft ? undefined : sidebarClassName)}
        >
          {resolvedRightSidebar}
        </SidebarColumn>
      ) : null}
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

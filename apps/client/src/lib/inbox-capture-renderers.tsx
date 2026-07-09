import type { ComponentType, ReactNode } from 'react';

import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';
import { routeKindLabel } from 'lib/inbox-capture.utils';

export interface InboxCaptureRendererProps {
  capture: ParsedInboxCapture;
}

export interface InboxCaptureListRowProps extends InboxCaptureRendererProps {
  selected?: boolean;
}

/** Registry from route kind → list/detail renderers. Unknown kinds use defaults. */
export const INBOX_CAPTURE_RENDERERS: Record<
  string,
  {
    ListRow?: ComponentType<InboxCaptureListRowProps>;
    Detail?: ComponentType<InboxCaptureRendererProps>;
  }
> = {
  // Type-specific renderers land in Phase 3; defaults cover all kinds until then.
};

export function getInboxListRowRenderer(
  routeKind: string,
): ComponentType<InboxCaptureListRowProps> | undefined {
  return INBOX_CAPTURE_RENDERERS[routeKind]?.ListRow;
}

export function getInboxDetailRenderer(
  routeKind: string,
): ComponentType<InboxCaptureRendererProps> | undefined {
  return INBOX_CAPTURE_RENDERERS[routeKind]?.Detail;
}

export function DefaultInboxCaptureSummary({ capture }: InboxCaptureRendererProps): ReactNode {
  const { rawText, provenance, routeKind } = capture;
  const url = typeof provenance?.payload?.['url'] === 'string' ? provenance.payload['url'] : undefined;
  const command =
    typeof provenance?.payload?.['command'] === 'string' ? provenance.payload['command'] : undefined;
  const attachment = provenance?.payload?.['attachment'];
  const fileName =
    attachment && typeof attachment === 'object' && !Array.isArray(attachment)
      ? typeof (attachment as Record<string, unknown>)['file_name'] === 'string'
        ? String((attachment as Record<string, unknown>)['file_name'])
        : undefined
      : undefined;

  if (url) return url;
  if (command) return command;
  if (fileName) return fileName;
  if (rawText) return rawText.length > 160 ? `${rawText.slice(0, 160)}…` : rawText;
  return `Inbox ${routeKindLabel(routeKind)}`;
}

import {
  AttachmentDetail,
  CodeAttachmentDetail,
  CodeLinkDetail,
  CodeSnippetDetail,
  CommandCandidateDetail,
  DocsAttachmentDetail,
  DocsLinkDetail,
  GitHubRepoDetail,
  ImageDetail,
  NpmPackageDetail,
  PostLinkDetail,
  TodoDetail,
  WebLinkDetail,
} from 'components/InboxCaptureDetail/inbox-capture-type-renderers';
import type { InboxCaptureRendererProps } from 'components/InboxCaptureDetail/inbox-capture-type-renderers';
import type { ComponentType, ReactNode } from 'react';

import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';
import { routeKindLabel } from 'lib/inbox-capture.utils';

export type { InboxCaptureRendererProps };

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
  docs_link: { Detail: DocsLinkDetail },
  post_link: { Detail: PostLinkDetail },
  github_repo: { Detail: GitHubRepoDetail },
  web_link: { Detail: WebLinkDetail },
  npm_package: { Detail: NpmPackageDetail },
  code_snippet: { Detail: CodeSnippetDetail },
  code_link: { Detail: CodeLinkDetail },
  code_attachment: { Detail: CodeAttachmentDetail },
  image: { Detail: ImageDetail },
  attachment: { Detail: AttachmentDetail },
  docs_attachment: { Detail: DocsAttachmentDetail },
  todo: { Detail: TodoDetail },
  command_candidate: { Detail: CommandCandidateDetail },
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

export function DefaultInboxCaptureSummary({ capture }: { capture: ParsedInboxCapture }): ReactNode {
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

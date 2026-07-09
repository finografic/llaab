import { Badge } from 'components/ui/badge';
import { Link } from 'react-router-dom';

import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';
import { routeKindLabel } from 'lib/inbox-capture.utils';

export interface InboxCaptureRendererProps {
  capture: ParsedInboxCapture;
}

import {
  CaptureMetaGrid,
  CaptureSection,
  CodeBlock,
  CopyButton,
  ExternalLinkButton,
  attachmentString,
  normalizeDisplayLanguage,
  payloadString,
} from './inbox-capture-detail-shared';
import styles from './InboxCaptureDetail.module.css';

function LinkCaptureDetail({ capture, label }: InboxCaptureRendererProps & { label: string }) {
  const url = payloadString(capture, 'url') ?? capture.rawText;
  let domain: string | undefined;
  let path: string | undefined;
  try {
    if (url) {
      const parsed = new URL(url);
      domain = parsed.hostname;
      path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    domain = undefined;
  }

  return (
    <>
      <CaptureSection title={label}>
        <CaptureMetaGrid
          items={[
            { label: 'Title', value: capture.node.title },
            { label: 'URL', value: url ? <span className="meta-mono">{url}</span> : '—' },
            { label: 'Domain', value: domain ?? '—' },
            { label: 'Path', value: path ? <span className="meta-mono">{path}</span> : '—' },
            {
              label: 'Tags',
              value: capture.node.tags.length ? capture.node.tags.join(', ') : '—',
            },
          ]}
        />
        {url ? (
          <div className={styles.actions}>
            <ExternalLinkButton href={url} />
            <CopyButton text={url} label="Copy URL" />
          </div>
        ) : null}
        <p className={styles.promotePlaceholder}>
          Future: extract / promote this link into a resource or knowledge artifact.
        </p>
      </CaptureSection>
    </>
  );
}

export function DocsLinkDetail({ capture }: InboxCaptureRendererProps) {
  return <LinkCaptureDetail capture={capture} label="Docs link" />;
}

export function PostLinkDetail({ capture }: InboxCaptureRendererProps) {
  return <LinkCaptureDetail capture={capture} label="Post / article link" />;
}

export function WebLinkDetail({ capture }: InboxCaptureRendererProps) {
  return <LinkCaptureDetail capture={capture} label="Web link" />;
}

export function GitHubRepoDetail({ capture }: InboxCaptureRendererProps) {
  const url = payloadString(capture, 'url') ?? capture.rawText;
  const owner = payloadString(capture, 'owner');
  const repo = payloadString(capture, 'repo');

  return (
    <CaptureSection title="GitHub repository">
      <CaptureMetaGrid
        items={[
          { label: 'Owner', value: owner ?? '—' },
          { label: 'Repo', value: repo ?? '—' },
          { label: 'URL', value: url ? <span className="meta-mono">{url}</span> : '—' },
        ]}
      />
      {url ? (
        <div className={styles.actions}>
          <ExternalLinkButton href={url} label="Open on GitHub" />
          <CopyButton text={url} label="Copy URL" />
        </div>
      ) : null}
      <p className={styles.promotePlaceholder}>Future: ingest this repository once repo ingestion exists.</p>
    </CaptureSection>
  );
}

export function CodeLinkDetail({ capture }: InboxCaptureRendererProps) {
  const url = payloadString(capture, 'url') ?? capture.rawText;
  const language = normalizeDisplayLanguage(payloadString(capture, 'language'));
  const filePath = payloadString(capture, 'file_path');

  return (
    <CaptureSection title="Code link">
      <CaptureMetaGrid
        items={[
          { label: 'URL', value: url ? <span className="meta-mono">{url}</span> : '—' },
          { label: 'File', value: filePath ? <span className="meta-mono">{filePath}</span> : '—' },
          { label: 'Language', value: language ?? '—' },
        ]}
      />
      {url ? (
        <div className={styles.actions}>
          <ExternalLinkButton href={url} label="Open code" />
          <CopyButton text={url} label="Copy URL" />
        </div>
      ) : null}
    </CaptureSection>
  );
}

export function NpmPackageDetail({ capture }: InboxCaptureRendererProps) {
  const packageName =
    payloadString(capture, 'package_name') ??
    payloadString(capture, 'name') ??
    capture.node.title.replace(/^Pinned npm package:\s*/i, '').trim();
  const url = payloadString(capture, 'url');

  return (
    <CaptureSection title="npm package">
      <CaptureMetaGrid
        items={[
          { label: 'Package', value: packageName || '—' },
          { label: 'URL', value: url ? <span className="meta-mono">{url}</span> : '—' },
        ]}
      />
      <div className={styles.actions}>
        {packageName ? (
          <ButtonLink to={`/registry/package/${encodeURIComponent(packageName)}`}>
            Open in registry
          </ButtonLink>
        ) : null}
        {packageName ? <ButtonLink to="/registry">Open pinned libraries</ButtonLink> : null}
        {url ? <ExternalLinkButton href={url} label="Open on npm" /> : null}
      </div>
    </CaptureSection>
  );
}

function ButtonLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="meta-link">
      {children}
    </Link>
  );
}

export function CodeSnippetDetail({ capture }: InboxCaptureRendererProps) {
  const language = normalizeDisplayLanguage(
    payloadString(capture, 'language') ?? guessLanguageFromText(capture.rawText),
  );
  const code = capture.rawText || capture.bodyWithoutJson;

  return (
    <CaptureSection title="Code snippet">
      {code ? <CodeBlock code={code} language={language} /> : <p>No snippet body.</p>}
      <p className={styles.promotePlaceholder}>
        Future: promote useful snippets into references, prompts, or skills.
      </p>
    </CaptureSection>
  );
}

export function CodeAttachmentDetail({ capture }: InboxCaptureRendererProps) {
  const fileName = attachmentString(capture, 'file_name') ?? 'attachment';
  const language = normalizeDisplayLanguage(
    payloadString(capture, 'language') ?? languageFromFilename(fileName),
  );
  const localPath = attachmentString(capture, 'local_path');
  const preview = capture.rawText;

  return (
    <CaptureSection title="Code attachment">
      <CaptureMetaGrid
        items={[
          { label: 'File', value: fileName },
          { label: 'Language', value: language ?? '—' },
          {
            label: 'Local path',
            value: localPath ? (
              <span className="meta-mono">{localPath}</span>
            ) : (
              'Not copied into vault (Hermes media cache)'
            ),
          },
        ]}
      />
      {preview ? <CodeBlock code={preview} language={language} /> : null}
      {localPath ? (
        <p className={styles.promotePlaceholder}>
          Media-cache paths are not permanent until a vault assets pipeline exists.
        </p>
      ) : null}
    </CaptureSection>
  );
}

export function ImageDetail({ capture }: InboxCaptureRendererProps) {
  const fileName = attachmentString(capture, 'file_name') ?? 'image';
  const localPath = attachmentString(capture, 'local_path');
  const mimeType = attachmentString(capture, 'mime_type');
  const url = attachmentString(capture, 'url');

  return (
    <CaptureSection title="Image">
      <CaptureMetaGrid
        items={[
          { label: 'File', value: fileName },
          { label: 'MIME', value: mimeType ?? '—' },
          {
            label: 'Local path',
            value: localPath ? (
              <span className="meta-mono">{localPath}</span>
            ) : (
              'Not copied into vault (Hermes media cache)'
            ),
          },
        ]}
      />
      {url ? (
        <div className={styles.actions}>
          <img src={url} alt={fileName} className={styles.imagePreview} />
          <ExternalLinkButton href={url} label="Open image URL" />
        </div>
      ) : (
        <p className={styles.promotePlaceholder}>
          No durable preview URL in vault yet — binary remains in Hermes media cache.
        </p>
      )}
    </CaptureSection>
  );
}

export function AttachmentDetail({
  capture,
  label = 'Attachment',
}: InboxCaptureRendererProps & { label?: string }) {
  const fileName = attachmentString(capture, 'file_name') ?? 'attachment';
  const localPath = attachmentString(capture, 'local_path');
  const mimeType = attachmentString(capture, 'mime_type');
  const kind = attachmentString(capture, 'kind') ?? capture.routeKind;

  return (
    <CaptureSection title={label}>
      <div className={styles.actions}>
        <Badge variant="secondary">{attachmentVisualLabel(kind, mimeType, fileName)}</Badge>
      </div>
      <CaptureMetaGrid
        items={[
          { label: 'File', value: fileName },
          { label: 'MIME', value: mimeType ?? '—' },
          {
            label: 'Local path',
            value: localPath ? (
              <span className="meta-mono">{localPath}</span>
            ) : (
              'Not copied into vault (Hermes media cache)'
            ),
          },
        ]}
      />
      {capture.rawText ? <pre className="body-pre">{capture.rawText}</pre> : null}
      <p className={styles.promotePlaceholder}>
        Avoid assuming Hermes media-cache paths are permanent until a vault assets pipeline exists.
      </p>
    </CaptureSection>
  );
}

export function DocsAttachmentDetail({ capture }: InboxCaptureRendererProps) {
  return <AttachmentDetail capture={capture} label="Docs attachment" />;
}

export function TodoDetail({ capture }: InboxCaptureRendererProps) {
  return (
    <CaptureSection title="Todo">
      <pre className="body-pre">{capture.rawText || capture.node.title}</pre>
      <CaptureMetaGrid
        items={[
          { label: 'Platform', value: capture.platform },
          { label: 'Route kind', value: routeKindLabel(capture.routeKind) },
        ]}
      />
      <p className={styles.promotePlaceholder}>
        Future: promote to reference, skill, or prompt after review.
      </p>
    </CaptureSection>
  );
}

export function CommandCandidateDetail({ capture }: InboxCaptureRendererProps) {
  const command = payloadString(capture, 'command') ?? capture.rawText;

  return (
    <CaptureSection title="Command candidate">
      <p className={styles.nonExecutable}>
        Non-executable reference only — do not run Telegram-captured commands from this UI.
      </p>
      {command ? <CodeBlock code={command} language="bash" /> : <p>No command text.</p>}
      <div className={styles.actions}>
        {command ? <CopyButton text={command} label="Copy command" /> : null}
      </div>
      <p className={styles.promotePlaceholder}>
        Future: promote to reference / skill / prompt after explicit review.
      </p>
    </CaptureSection>
  );
}

function attachmentVisualLabel(kind: string, mimeType?: string, fileName?: string): string {
  if (kind === 'image' || mimeType?.startsWith('image/')) return 'Image';
  if (kind === 'docs_attachment' || fileName?.endsWith('.md')) return 'Document';
  if (
    kind === 'code_attachment' ||
    Boolean(fileName && /\.(ts|tsx|js|jsx|py|rs|go|json|yml|yaml)$/i.test(fileName))
  ) {
    return 'Code';
  }
  if (fileName && /\.(zip|tar|gz|tgz|7z|rar)$/i.test(fileName)) return 'Archive';
  return 'Unknown file';
}

function languageFromFilename(fileName: string): string | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
      return 'typescript';
    case 'tsx':
    case 'jsx':
      return 'tsx';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'yml':
    case 'yaml':
      return 'yaml';
    default:
      return undefined;
  }
}

function guessLanguageFromText(text: string): string | undefined {
  if (/^\s*</.test(text) && /<\/?[A-Za-z]/.test(text)) return 'tsx';
  if (/^\s*import\s.+from\s+['"]/.test(text) || /:\s*[A-Z][A-Za-z0-9_<>|]+/.test(text)) {
    return 'typescript';
  }
  return undefined;
}

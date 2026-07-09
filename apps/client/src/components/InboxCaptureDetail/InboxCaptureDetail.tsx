import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Link } from 'react-router-dom';

import { getInboxDetailRenderer } from 'lib/inbox-capture-renderers';
import { routeKindLabel } from 'lib/inbox-capture.utils';
import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';
import { formatDetailDate } from 'utils/format-date.utils';

import styles from './InboxCaptureDetail.module.css';

export interface InboxCaptureDetailProps {
  capture: ParsedInboxCapture;
}

export function InboxCaptureDetail({ capture }: InboxCaptureDetailProps) {
  const CustomDetail = getInboxDetailRenderer(capture.routeKind);
  if (CustomDetail) {
    return <CustomDetail capture={capture} />;
  }

  return <DefaultInboxCaptureDetail capture={capture} />;
}

function DefaultInboxCaptureDetail({ capture }: InboxCaptureDetailProps) {
  const {
    node,
    routeKind,
    platform,
    receivedAt,
    provenance,
    rawText,
    bodyWithoutJson,
    parseError,
    malformed,
  } = capture;
  const payload = provenance?.payload;
  const url = typeof payload?.['url'] === 'string' ? payload['url'] : undefined;

  return (
    <>
      <div className={styles.metaRow}>
        <Badge variant="secondary">{routeKindLabel(routeKind)}</Badge>
        <Badge variant="outline">{platform}</Badge>
        <Badge variant="outline">{node.status}</Badge>
        <Badge variant="outline">{node.type}</Badge>
      </div>

      {node.tags.length > 0 ? (
        <div className="tag-row">
          {node.tags.map((tag) => (
            <span key={tag} className="tag" data-tag={tag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {malformed || parseError ? (
        <p className={styles.error}>{parseError ?? 'This capture has malformed provenance data.'}</p>
      ) : null}

      <section className="section">
        <h2 className="section__heading">Core metadata</h2>
        <dl className="meta-grid">
          <dt>Title</dt>
          <dd>{node.title || 'Untitled capture'}</dd>
          <dt>Route kind</dt>
          <dd>
            <span className="meta-mono">{routeKind}</span>
          </dd>
          <dt>Review / status</dt>
          <dd>
            <span className={`badge badge--status badge--${node.status}`}>{node.status}</span>
            <span className="meta-text"> (node lifecycle; inbox review state comes in Phase 4)</span>
          </dd>
          <dt>Source platform</dt>
          <dd>{platform}</dd>
          <dt>Received</dt>
          <dd className="meta-text">{formatDetailDate(receivedAt)}</dd>
          <dt>Target node</dt>
          <dd>
            <Link to={`/vault/nodes/${node.id}`} className="meta-link">
              {node.id}
            </Link>
          </dd>
          {provenance?.source?.message_id ? (
            <>
              <dt>Source message</dt>
              <dd className="meta-mono">{provenance.source.message_id}</dd>
            </>
          ) : null}
        </dl>
      </section>

      {url ? (
        <section className="section">
          <h2 className="section__heading">Link</h2>
          <div className={styles.actions}>
            <Button asChild variant="outline" size="sm">
              <a href={url} target="_blank" rel="noreferrer">
                Open source URL
              </a>
            </Button>
          </div>
          <p className="meta-mono">{url}</p>
        </section>
      ) : null}

      {rawText || bodyWithoutJson ? (
        <section className="section">
          <h2 className="section__heading">Captured text</h2>
          <pre className="body-pre">{rawText || bodyWithoutJson}</pre>
        </section>
      ) : null}

      {payload ? (
        <section className="section">
          <h2 className="section__heading">Payload</h2>
          <pre className={styles.payloadPre}>{safeJson(payload)}</pre>
        </section>
      ) : null}

      {node.body ? (
        <section className="section">
          <h2 className="section__heading">Raw body</h2>
          {malformed ? (
            <p className={styles.warning}>Showing raw body because provenance parsing failed.</p>
          ) : null}
          <pre className="body-pre">{node.body}</pre>
        </section>
      ) : (
        <p className={styles.warning}>This capture has no body content.</p>
      )}
    </>
  );
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

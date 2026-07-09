import { Badge } from 'components/ui/badge';
import { Link } from 'react-router-dom';

import { DefaultInboxCaptureSummary, getInboxListRowRenderer } from 'lib/inbox-capture-renderers';
import { routeKindLabel } from 'lib/inbox-capture.utils';
import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';
import { formatDetailDate } from 'utils/format-date.utils';

import styles from './InboxCaptureList.module.css';

export interface InboxCaptureListProps {
  captures: ParsedInboxCapture[];
  loading?: boolean;
  error?: string | null;
  selectedId?: string;
  emptyMessage?: string;
}

export function InboxCaptureList({
  captures,
  loading = false,
  error = null,
  selectedId,
  emptyMessage = 'No inbox captures yet.',
}: InboxCaptureListProps) {
  if (loading) {
    return <p className={styles.state}>Loading inbox captures…</p>;
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  if (captures.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.list}>
      {captures.map((capture) => {
        const CustomRow = getInboxListRowRenderer(capture.routeKind);
        if (CustomRow) {
          return (
            <CustomRow key={capture.node.id} capture={capture} selected={selectedId === capture.node.id} />
          );
        }

        return (
          <DefaultInboxCaptureListRow
            key={capture.node.id}
            capture={capture}
            selected={selectedId === capture.node.id}
          />
        );
      })}
    </div>
  );
}

function DefaultInboxCaptureListRow({
  capture,
  selected = false,
}: {
  capture: ParsedInboxCapture;
  selected?: boolean;
}) {
  const { node, routeKind, platform, receivedAt, malformed } = capture;

  return (
    <Link
      to={`/vault/inbox/${node.id}`}
      className={`${styles.row}${selected ? ` ${styles.rowSelected}` : ''}`}
    >
      <div>
        <div className={styles.title}>{node.title || 'Untitled capture'}</div>
        <div className={styles.summary}>
          <DefaultInboxCaptureSummary capture={capture} />
        </div>
        {malformed ? <div className={styles.malformed}>Malformed provenance JSON</div> : null}
      </div>
      <div className={styles.meta}>
        <Badge variant="secondary">{routeKindLabel(routeKind)}</Badge>
      </div>
      <div className={styles.meta}>
        <Badge variant="outline">{platform}</Badge>
        <Badge variant="outline">{node.status}</Badge>
      </div>
      <div className={styles.date}>{formatDetailDate(receivedAt)}</div>
    </Link>
  );
}

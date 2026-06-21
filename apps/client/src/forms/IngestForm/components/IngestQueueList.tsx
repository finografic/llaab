import { XIcon } from 'lucide-react';
import type { QueuedIngestItem } from '../ingest-form.types';

export interface IngestQueueListProps {
  items: QueuedIngestItem[];
  currentUrl: string | null;
  status: string | null;
  onRemove: (id: string) => void;
}

/**
 * Items dropped/submitted while one is already processing. Ingestion still runs one at a
 * time — this is just visibility into what's waiting, with a way to back an item out before
 * its turn comes up.
 */
export function IngestQueueList({ items, currentUrl, status, onRemove }: IngestQueueListProps) {
  if (items.length === 0 && !currentUrl && !status) return null;

  return (
    <div className="pipeline">
      <div className="pipeline-chain__header text-muted-foreground">
        Queue
        <span className="font-mono text-xs">
          {currentUrl ? 'processing' : 'idle'}
          {items.length > 0 ? ` · ${items.length} waiting` : ''}
        </span>
      </div>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      {currentUrl ? (
        <div className="pipeline-card pipeline-card--active">
          <div className="pipeline-card__main">
            <div className="pipeline-card__row">
              <div className="pipeline-card__title min-w-0">
                <span className="pipeline-card__status">Current</span>
                <span className="pipeline-card__path truncate">{currentUrl}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {items.map((item, index) => (
        <div key={item.id} className="pipeline-card pipeline-card--neutral">
          <div className="pipeline-card__main">
            <div className="pipeline-card__row">
              <div className="pipeline-card__title min-w-0">
                <span className="pipeline-card__status">{index === 0 ? 'Next' : `Waiting ${index + 1}`}</span>
                <span className="pipeline-card__path truncate">{item.url}</span>
                {item.tags.length > 0 ? (
                  <span className="text-xs text-muted-foreground">{item.tags.length} tags</span>
                ) : null}
              </div>
              <button
                type="button"
                className="pipeline-action-btn pipeline-action-btn--retry"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.url} from the queue`}
              >
                <XIcon size={14} aria-hidden />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

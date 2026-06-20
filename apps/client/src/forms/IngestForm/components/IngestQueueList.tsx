import { XIcon } from 'lucide-react';
import type { QueuedIngestItem } from '../ingest-form.types';

export interface IngestQueueListProps {
  items: QueuedIngestItem[];
  onRemove: (id: string) => void;
}

/**
 * Items dropped/submitted while one is already processing. Ingestion still runs one at a
 * time — this is just visibility into what's waiting, with a way to back an item out before
 * its turn comes up.
 */
export function IngestQueueList({ items, onRemove }: IngestQueueListProps) {
  if (items.length === 0) return null;

  return (
    <div className="pipeline">
      <div className="pipeline-chain__header text-muted-foreground">Queued ({items.length})</div>
      {items.map((item) => (
        <div key={item.id} className="pipeline-card pipeline-card--neutral">
          <div className="pipeline-card__main">
            <div className="pipeline-card__row">
              <div className="pipeline-card__title min-w-0">
                <span className="pipeline-card__path truncate">{item.url}</span>
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

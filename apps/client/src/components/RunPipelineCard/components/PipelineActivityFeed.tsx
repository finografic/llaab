import type { RunEvent } from '@llaab/schemas';

import styles from '../RunPipelineCard.module.css';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function eventMessageClassName(level: RunEvent['level']) {
  if (level === 'error') return styles.activityMessageError;
  if (level === 'warning') return styles.activityMessageWarning;
  if (level === 'success') return styles.activityMessageSuccess;
  return styles.activityMessage;
}

export function PipelineActivityFeed({ events }: { events: RunEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className={styles.activity}>
      <span className={styles.activityTitle}>Activity</span>
      {events.map((event) => (
        <div key={event.id} className={styles.activityEvent}>
          <time className={styles.activityTime} dateTime={event.at}>
            {formatTime(event.at)}
          </time>
          <span className={eventMessageClassName(event.level)}>{event.message}</span>
        </div>
      ))}
    </div>
  );
}

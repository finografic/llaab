import { TtsPlayer } from 'components/TtsPlayer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'components/ui/collapsible';

import styles from './SourceBodySection.module.css';

interface SourceBodySectionProps {
  sourceId: string;
  title: string;
  body: string;
  countLabel?: string | null;
  estimatedDurationSeconds?: number;
  enableTts?: boolean;
}

export function SourceBodySection({
  sourceId,
  title,
  body,
  countLabel,
  estimatedDurationSeconds,
  enableTts = false,
}: SourceBodySectionProps) {
  if (!body) return null;

  return (
    <section className="section">
      <Collapsible key={`${sourceId}-body`} defaultOpen={false}>
        <div className={styles.sectionHeader}>
          <CollapsibleTrigger className={styles.sectionTrigger}>
            <span className={styles.headingLabel}>
              {title}
              {countLabel ? <span className="section__count">{countLabel}</span> : null}
            </span>
          </CollapsibleTrigger>
          {enableTts ? (
            <TtsPlayer variant="full" text={body} estimatedDurationSeconds={estimatedDurationSeconds} />
          ) : null}
        </div>
        <CollapsibleContent className={styles.sectionContent}>
          <pre className={`body-pre ${styles.bodyPre}`}>{body}</pre>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

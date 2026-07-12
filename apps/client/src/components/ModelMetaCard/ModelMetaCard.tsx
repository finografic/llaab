import styles from './ModelMetaCard.module.css';

interface ModelMeta {
  model?: string;
  provider?: string;
  durationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
}

interface ModelMetaCardProps {
  meta: ModelMeta;
  title?: string;
}

function formatDuration(ms?: number): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatNumber(value?: number): string {
  return value == null ? '—' : value.toLocaleString();
}

export function ModelMetaCard({ meta, title = 'Model metadata' }: ModelMetaCardProps) {
  const totalTokens = (meta.promptTokens ?? 0) + (meta.completionTokens ?? 0);
  const hasMetadata = Boolean(
    meta.model ||
    meta.provider ||
    meta.durationMs != null ||
    meta.promptTokens != null ||
    meta.completionTokens != null,
  );

  if (!hasMetadata) return null;

  return (
    <section className={styles.modelMeta} aria-label={title}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {meta.provider ? <span className={styles.badge}>{meta.provider}</span> : null}
      </div>

      <div className={styles.grid}>
        <div className={styles.item}>
          <span className={styles.label}>Model</span>
          <span className={`${styles.value} ${styles.valueMono}`}>{meta.model ?? '—'}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>Latency</span>
          <span className={styles.value}>{formatDuration(meta.durationMs)}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>Prompt tokens</span>
          <span className={styles.value}>{formatNumber(meta.promptTokens)}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>Completion tokens</span>
          <span className={styles.value}>{formatNumber(meta.completionTokens)}</span>
        </div>
      </div>

      {meta.promptTokens != null || meta.completionTokens != null ? (
        <div className={styles.tokens} aria-label="Token usage">
          <div className={styles.tokenBar}>
            <span
              className={`${styles.token} ${styles.tokenPrompt}`}
              style={{ flexGrow: meta.promptTokens ?? 0 }}
            />
            <span
              className={`${styles.token} ${styles.tokenCompletion}`}
              style={{ flexGrow: meta.completionTokens ?? 0 }}
            />
          </div>
          <span className={styles.tokenTotal}>{formatNumber(totalTokens)} total tokens</span>
        </div>
      ) : null}
    </section>
  );
}

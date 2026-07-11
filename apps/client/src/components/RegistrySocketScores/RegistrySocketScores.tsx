import { useNpmPackageSocketScores } from 'queries/registry';

import { socketScoreTone } from 'utils/format-downloads-change.utils';

import styles from './RegistrySocketScores.module.css';

interface RegistrySocketScoresProps {
  packageName: string;
  version?: string;
}

const SCORE_ITEMS = [
  { key: 'supplyChain', label: 'Supply Chain Security' },
  { key: 'vulnerability', label: 'Vulnerability' },
  { key: 'quality', label: 'Quality' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'license', label: 'License' },
] as const;

const RING_SIZE = 56;
const STROKE = 3.5;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ScoreGauge({ label, value }: { label: string; value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);
  const tone = socketScoreTone(clamped);
  const ringClass = tone === 'ok' ? styles.ringOk : tone === 'warn' ? styles.ringWarn : styles.ringDanger;
  const scoreClass = tone === 'ok' ? styles.scoreOk : tone === 'warn' ? styles.scoreWarn : styles.scoreDanger;

  return (
    <div className={styles.gauge}>
      <div className={styles.ringWrap} aria-hidden>
        <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
          <circle
            className={styles.ringTrack}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
          />
          <circle
            className={`${styles.ringValue} ${ringClass}`}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </svg>
        <span className={`${styles.score} ${scoreClass}`}>{clamped}</span>
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
}

export function RegistrySocketScores({ packageName, version }: RegistrySocketScoresProps) {
  const { data, isPending, isError } = useNpmPackageSocketScores(packageName, version);

  if (isError) return null;
  if (!isPending && data && !data.configured) return null;
  if (!isPending && (!data?.scores || !data.configured)) return null;

  const socketUrl = `https://socket.dev/npm/package/${encodeURIComponent(packageName)}`;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Socket scores</span>
        <a href={socketUrl} className={styles.headerLink} target="_blank" rel="noopener noreferrer">
          socket.dev
        </a>
      </div>
      <div className={styles.row}>
        {isPending
          ? SCORE_ITEMS.map((item) => (
              <div key={item.key} className={styles.gauge}>
                <div className={`${styles.ringWrap} ${styles.skeleton}`} aria-hidden />
                <span className={styles.label}>{item.label}</span>
              </div>
            ))
          : SCORE_ITEMS.map((item) => (
              <ScoreGauge key={item.key} label={item.label} value={data.scores![item.key]} />
            ))}
      </div>
    </div>
  );
}

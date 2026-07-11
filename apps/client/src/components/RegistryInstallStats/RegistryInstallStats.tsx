import { CheckIcon } from 'lucide-react';
import { useNpmPackageStats } from 'queries/registry';

import { formatBytes } from 'utils/format-bytes.utils';

import styles from './RegistryInstallStats.module.css';

interface RegistryInstallStatsProps {
  packageName: string;
  version?: string;
  /** Immediate self size from packument `dist.unpackedSize` while tree stats load. */
  unpackedSize?: number;
}

export function RegistryInstallStats({ packageName, version, unpackedSize }: RegistryInstallStatsProps) {
  const { data, isPending, isError } = useNpmPackageStats(packageName, version);

  const selfSize = data?.selfSize ?? unpackedSize;
  const totalSize = data?.totalSize;
  const showTotal = totalSize != null && selfSize != null ? totalSize !== selfSize : totalSize != null;

  return (
    <>
      <div className={styles.section}>
        <span className={styles.label}>Install size</span>
        <span className={styles.value}>
          {selfSize != null ? (
            <>
              <span>{formatBytes(selfSize)}</span>
              {isPending && unpackedSize != null ? (
                <span className={styles.muted}> (…)</span>
              ) : showTotal && totalSize != null ? (
                <span className={styles.muted}> ({formatBytes(totalSize)})</span>
              ) : isPending ? (
                <span className={styles.muted}>…</span>
              ) : null}
            </>
          ) : isPending ? (
            <span className={styles.muted}>…</span>
          ) : isError ? (
            <span className={styles.muted}>—</span>
          ) : (
            <span className={styles.muted}>—</span>
          )}
        </span>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>Vulns</span>
        <span className={styles.value}>
          {isPending ? (
            <span className={styles.muted}>…</span>
          ) : isError || data == null ? (
            <span className={styles.muted}>—</span>
          ) : data.vulnCount === 0 ? (
            <span className={styles.vulnOk}>
              <CheckIcon size={12} aria-hidden />0
            </span>
          ) : (
            <span className={styles.vulnWarn}>{data.vulnCount.toLocaleString('en-US')}</span>
          )}
        </span>
      </div>
    </>
  );
}

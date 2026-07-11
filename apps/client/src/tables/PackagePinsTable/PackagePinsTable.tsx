import { getSortedRowModel } from '@tanstack/react-table';
import { DataTable, sortableHeader } from 'components/ui/data-table';
import { XIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { PinnedPackage } from '@llaab/schemas';
import type { DataTableColumns } from '@llaab/ui/lib/data-table-utils';
import type { CellContext } from '@tanstack/react-table';

import { formatDetailDate } from 'utils/format-date.utils';

import styles from './PackagePinsTable.module.css';

function fmtDownloads(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function renderNameCell({ row }: CellContext<PinnedPackage, unknown>) {
  const { name, meta } = row.original;
  return (
    <div className={styles.titleCell}>
      <Link to={`/registry/package/${encodeURIComponent(name)}`} className={styles.titleLink}>
        {name}
      </Link>
      {meta.description && <span className={styles.description}>{meta.description}</span>}
    </div>
  );
}

function renderVersionCell({ row }: CellContext<PinnedPackage, unknown>) {
  return <span className={styles.mono}>{row.original.meta.version}</span>;
}

function renderLicenseCell({ row }: CellContext<PinnedPackage, unknown>) {
  return row.original.meta.license ? (
    <span className={styles.mono}>{row.original.meta.license}</span>
  ) : (
    <span className={styles.muted}>—</span>
  );
}

function renderDownloadsCell({ row }: CellContext<PinnedPackage, unknown>) {
  return <span className={styles.mono}>{fmtDownloads(row.original.meta.weeklyDownloads)}</span>;
}

function renderPinnedAtCell({ getValue }: CellContext<PinnedPackage, unknown>) {
  const ts = getValue<string>();
  return <time className={styles.mono}>{formatDetailDate(ts)}</time>;
}

function makeUnpinCell(onUnpin: (name: string) => void) {
  return function UnpinCell({ row }: CellContext<PinnedPackage, unknown>) {
    return (
      <button
        type="button"
        className={styles.unpinButton}
        aria-label={`Unpin ${row.original.name}`}
        onClick={() => onUnpin(row.original.name)}
      >
        <XIcon size={14} aria-hidden />
      </button>
    );
  };
}

function makeColumns(onUnpin: (name: string) => void): DataTableColumns<PinnedPackage> {
  return [
    {
      id: 'name',
      accessorFn: (pin) => pin.name,
      header: sortableHeader('Package'),
      cell: renderNameCell,
    },
    {
      id: 'version',
      accessorFn: (pin) => pin.meta.version,
      header: sortableHeader('Version'),
      cell: renderVersionCell,
    },
    {
      id: 'license',
      accessorFn: (pin) => pin.meta.license ?? '',
      header: 'License',
      cell: renderLicenseCell,
    },
    {
      id: 'downloads',
      accessorFn: (pin) => pin.meta.weeklyDownloads ?? 0,
      header: sortableHeader('Downloads / wk'),
      cell: renderDownloadsCell,
    },
    {
      accessorKey: 'pinnedAt',
      header: sortableHeader('Pinned'),
      cell: renderPinnedAtCell,
    },
    {
      id: 'unpin',
      header: '',
      cell: makeUnpinCell(onUnpin),
    },
  ];
}

interface PackagePinsTableProps {
  pins: PinnedPackage[];
  onUnpin: (name: string) => void;
}

export function PackagePinsTable({ pins, onUnpin }: PackagePinsTableProps) {
  const columns = useMemo(() => makeColumns(onUnpin), [onUnpin]);

  return (
    <DataTable
      columns={columns}
      data={pins}
      emptyMessage="No pinned packages yet. Search for packages and pin your favourites."
      options={{ getSortedRowModel: getSortedRowModel() }}
    />
  );
}

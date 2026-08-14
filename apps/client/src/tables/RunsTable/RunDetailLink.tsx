import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from 'queries/vault';
import { Link } from 'react-router-dom';
import type { RunNode } from '@llaab/schemas';
import type { ReactNode } from 'react';

export interface RunDetailLinkProps {
  run: RunNode;
  className?: string;
  children: ReactNode;
}

export function RunDetailLink({ run, className, children }: RunDetailLinkProps) {
  const queryClient = useQueryClient();

  const seedRun = () => {
    queryClient.setQueryData(QUERY_KEYS.vault.run(run.id), run);
  };

  return (
    <Link
      to={`/vault/runs/${run.id}`}
      className={className}
      onPointerEnter={seedRun}
      onFocus={seedRun}
      onClick={seedRun}
    >
      {children}
    </Link>
  );
}

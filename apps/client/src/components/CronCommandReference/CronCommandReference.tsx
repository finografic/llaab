import { cn } from '@llaab/ui/lib/utils';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { PlayIcon } from 'lucide-react';
import { useRunCronRecipe } from 'queries/crons';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CronRecipe, CronRecipeRunResponse } from 'queries/crons';

interface CronCommandReferenceProps {
  recipe: CronRecipe;
  onRun?: (response: CronRecipeRunResponse) => void;
}

const RISK_BADGE_CLASS: Record<CronRecipe['risk'], string> = {
  low: 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]',
  medium: 'border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info-text)]',
  high: 'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]',
};

/**
 * Command + Run Now control for a single cron recipe. Lives outside `/crons` so other
 * vault pages (e.g. a transcript missing canonical coverage) can surface the relevant
 * recipe without duplicating the run-button wiring.
 */
export function CronCommandReference({ recipe, onRun }: CronCommandReferenceProps) {
  const runRecipe = useRunCronRecipe();
  const [lastRun, setLastRun] = useState<CronRecipeRunResponse | null>(null);
  const running = runRecipe.isPending && runRecipe.variables === recipe.id;

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3 text-sm">
        <Badge
          variant="outline"
          className={cn('h-auto shrink-0 py-1 text-sm', RISK_BADGE_CLASS[recipe.risk])}
        >
          {recipe.risk} risk
        </Badge>
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-3 py-1.25 font-mono text-base">
          {recipe.command}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={running}
          onClick={() => {
            runRecipe.mutate(recipe.id, {
              onSuccess: (data) => {
                setLastRun(data);
                onRun?.(data);
              },
            });
          }}
        >
          <PlayIcon aria-hidden />
          {running ? 'Running…' : 'Run Now'}
        </Button>
      </div>

      {lastRun ? (
        <Link
          to={`/vault/runs/${lastRun.runNodeId}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          View run — checked {lastRun.result.checked}, consolidated {lastRun.result.consolidated}, failed{' '}
          {lastRun.result.failed}
        </Link>
      ) : null}

      {runRecipe.error ? (
        <p className="text-xs text-destructive">
          {runRecipe.error instanceof Error ? runRecipe.error.message : 'Cron recipe failed.'}
        </p>
      ) : null}
    </div>
  );
}

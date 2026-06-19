import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { TimerIcon } from 'lucide-react';
import { useRunCronRecipe } from 'queries/crons';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CronRecipe, CronRecipeRunResponse } from 'queries/crons';

interface CronCommandReferenceProps {
  recipe: CronRecipe;
  onRun?: (response: CronRecipeRunResponse) => void;
}

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
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{recipe.risk} risk</Badge>
        <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{recipe.command}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
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
          <TimerIcon aria-hidden />
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

import { cn } from '@llaab/ui/lib/utils';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { PauseIcon, PlayIcon } from 'lucide-react';
import { useRunCronRecipe, useSetCronRecipeEnabled } from 'queries/crons';
import { useState } from 'react';
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

/** Toggle button showing whether the recipe will execute when triggered (manual or external). */
function CronEnabledToggle({ recipe }: { recipe: CronRecipe }) {
  const setEnabled = useSetCronRecipeEnabled();
  const { enabled } = recipe;

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn(
        'shrink-0',
        enabled
          ? 'border-[var(--success-border)] text-[var(--success-text)] hover:bg-[var(--success-bg)]'
          : 'text-muted-foreground',
      )}
      disabled={setEnabled.isPending}
      title={enabled ? 'Disable this recipe endpoint' : 'Enable this recipe endpoint'}
      onClick={() => setEnabled.mutate({ recipeId: recipe.id, enabled: !enabled })}
    >
      {enabled ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
      {enabled ? 'enabled' : 'disabled'}
    </Button>
  );
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
        <CronEnabledToggle recipe={recipe} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={running || !recipe.enabled}
          title={recipe.enabled ? undefined : 'Enable this recipe to run it'}
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
        <p className="text-xs text-muted-foreground">
          Last run checked {lastRun.result.checked}, consolidated {lastRun.result.consolidated}, failed{' '}
          {lastRun.result.failed}
        </p>
      ) : null}

      {runRecipe.error ? (
        <p className="text-xs text-destructive">
          {runRecipe.error instanceof Error ? runRecipe.error.message : 'Cron recipe failed.'}
        </p>
      ) : null}
    </div>
  );
}

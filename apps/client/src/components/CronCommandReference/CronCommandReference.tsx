import { cn } from '@llaab/ui/lib/utils';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { AlertTriangleIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { useRunCronRecipe, useSetCronRecipeEnabled } from 'queries/crons';
import { useState } from 'react';
import type { CronRecipe, CronRecipeHealth, CronRecipeRunResponse } from 'queries/crons';

interface CronCommandReferenceProps {
  recipe: CronRecipe;
  onRun?: (response: CronRecipeRunResponse) => void;
}

const RISK_BADGE_CLASS: Record<CronRecipe['risk'], string> = {
  low: 'border-(--success-border) bg-(--success-bg) text-(--success-text)',
  medium: 'border-(--info-border) bg-(--info-bg) text-(--info-text)',
  high: 'border-(--warning-border) bg-(--warning-bg) text-(--warning-text)',
};

const HEALTH_LABEL: Record<CronRecipeHealth, string> = {
  ok: 'healthy',
  stale: 'stale',
  failing: 'failing',
  never_ran: 'never ran',
  not_installed: 'not installed',
};

function healthBadgeClass(health: CronRecipeHealth): string {
  switch (health) {
    case 'ok':
      return 'border-(--success-border) bg-(--success-bg) text-(--success-text)';
    case 'stale':
    case 'never_ran':
      return 'border-(--warning-border) bg-(--warning-bg) text-(--warning-text)';
    case 'failing':
      return 'border-(--error-border) bg-(--error-bg) text-(--error-text)';
    case 'not_installed':
      return 'text-muted-foreground';
    default: {
      const exhaustive: never = health;
      return exhaustive;
    }
  }
}

/** Toggle button showing whether the recipe line is installed in crontab. */
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
          ? 'border-(--success-border) text-(--success-text) hover:bg-(--success-bg)'
          : 'text-muted-foreground',
      )}
      disabled={setEnabled.isPending}
      title={
        enabled
          ? 'Installed in crontab — click to remove the managed line'
          : 'Not installed — click to add the managed crontab line'
      }
      onClick={() => setEnabled.mutate({ recipeId: recipe.id, enabled: !enabled })}
    >
      {enabled ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
      {enabled ? 'installed' : 'not installed'}
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
  const health = recipe.health ?? (recipe.enabled ? 'never_ran' : 'not_installed');
  const unhealthy = health === 'failing' || health === 'stale' || health === 'never_ran';

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge
          variant="outline"
          className={cn('h-auto shrink-0 py-1 text-sm', RISK_BADGE_CLASS[recipe.risk])}
        >
          {recipe.risk} risk
        </Badge>
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-3 py-1.25 font-mono text-base">
          {recipe.command}
        </code>
        <Badge
          variant="outline"
          className={cn('h-auto shrink-0 py-1 text-sm', healthBadgeClass(health))}
          title={recipe.healthDetail}
        >
          {unhealthy ? <AlertTriangleIcon className="size-3.5" aria-hidden /> : null}
          {HEALTH_LABEL[health]}
        </Badge>
        <CronEnabledToggle recipe={recipe} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={running || !recipe.enabled}
          title={recipe.enabled ? undefined : 'Install this recipe in crontab to run it'}
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

      {recipe.healthDetail && unhealthy ? (
        <p className="text-xs text-(--warning-text)">{recipe.healthDetail}</p>
      ) : null}

      {recipe.lastRunAt ? (
        <p className="text-xs text-muted-foreground">
          Last history entry: {new Date(recipe.lastRunAt).toLocaleString()}
        </p>
      ) : null}

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

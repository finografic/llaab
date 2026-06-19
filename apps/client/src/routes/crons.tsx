import { PageHero } from 'components/PageHero/PageHero';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from 'components/ui/card';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { TimerIcon } from 'lucide-react';
import { useCronRecipes, useRunCronRecipe } from 'queries/crons';
import { useRuns } from 'queries/runs';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CronRecipeRunResponse } from 'queries/crons';

import { usePageTitle } from 'lib/use-page-title';

const CRON_SKILL_PREFIX = 'cron-';

function formatRunStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

export function CronsPage() {
  usePageTitle('Crons');

  const { data: recipes = [], isLoading } = useCronRecipes();
  const { data: runs = [] } = useRuns();
  const runRecipe = useRunCronRecipe();
  const [lastRun, setLastRun] = useState<CronRecipeRunResponse | null>(null);

  const recentCronRuns = useMemo(
    () => runs.filter((run) => run.skill_id?.startsWith(CRON_SKILL_PREFIX)).slice(0, 6),
    [runs],
  );

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Execute"
          title="Crons"
          meta={
            <>
              {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
            </>
          }
        />
      }
    >
      <PageList width="wide">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading cron recipes…</p> : null}

        <div className="grid gap-4">
          {recipes.map((recipe) => {
            const running = runRecipe.isPending && runRecipe.variables === recipe.id;
            return (
              <Card key={recipe.id}>
                <CardHeader>
                  <CardTitle>{recipe.title}</CardTitle>
                  <CardDescription>{recipe.description}</CardDescription>
                  <CardAction>
                    <Button
                      type="button"
                      size="sm"
                      disabled={running}
                      onClick={() => {
                        runRecipe.mutate(recipe.id, {
                          onSuccess: (data) => setLastRun(data),
                        });
                      }}
                    >
                      <TimerIcon aria-hidden />
                      {running ? 'Running…' : 'Run Now'}
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{recipe.risk} risk</Badge>
                    <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{recipe.command}</code>
                  </div>

                  <div className="grid gap-2">
                    <h3 className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                      External triggers
                    </h3>
                    {recipe.scheduleExamples.map((example) => (
                      <div key={example.label} className="grid gap-1 rounded-md border p-3">
                        <span className="text-sm font-medium">{example.label}</span>
                        <code className="whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">
                          {example.value}
                        </code>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {runRecipe.error ? (
          <p className="text-sm text-destructive">
            {runRecipe.error instanceof Error ? runRecipe.error.message : 'Cron recipe failed.'}
          </p>
        ) : null}

        {lastRun ? (
          <Card>
            <CardHeader>
              <CardTitle>Last Manual Run</CardTitle>
              <CardDescription>
                Checked {lastRun.result.checked} transcript{lastRun.result.checked !== 1 ? 's' : ''};{' '}
                consolidated {lastRun.result.consolidated}; failed {lastRun.result.failed}.
              </CardDescription>
              <CardAction>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/vault/runs/${lastRun.runNodeId}`}>View Run</Link>
                </Button>
              </CardAction>
            </CardHeader>
          </Card>
        ) : null}

        <section className="grid gap-3">
          <h2 className="text-base font-semibold">Recent Cron Runs</h2>
          {recentCronRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cron recipe runs yet.</p>
          ) : (
            <div className="grid gap-2">
              {recentCronRuns.map((run) => (
                <Link
                  key={run.id}
                  to={`/vault/runs/${run.id}`}
                  className="grid gap-1 rounded-md border bg-card p-3 hover:bg-muted"
                >
                  <span className="font-mono text-sm">{run.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRunStatus(run.run_status)} ·{' '}
                    {run.duration_ms ? `${run.duration_ms} ms` : 'running'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </PageList>
    </PageLayout>
  );
}

import { CronCommandReference } from 'components/CronCommandReference/CronCommandReference';
import { PageHero } from 'components/PageHero/PageHero';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'components/ui/collapsible';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { useCronRecipes } from 'queries/crons';
import { useRuns } from 'queries/runs';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { usePageTitle } from 'lib/use-page-title';

const CRON_SKILL_PREFIX = 'cron-';

const CRON_SYNTAX_LEGEND = `┌──────────────── (optional) second (0 - 59)
│ ┌────────────── minute (0 - 59)
│ │ ┌──────────── hour (0 - 23)
│ │ │ ┌────────── day of month (1 - 31)
│ │ │ │ ┌──────── month (1 - 12, JAN-DEC)
│ │ │ │ │ ┌────── day of week (0 - 6, SUN-Mon)
│ │ │ │ │ │       (0 to 6 are Sunday to Saturday; 7 is Sunday, the same as 0)
│ │ │ │ │ │ ┌──── (optional) year (1 - 9999)
│ │ │ │ │ │ │
* * * * * * *

*       any value
,       value list separator        (e.g. "1,15")
-       range of values             (e.g. "1-5")
/       step values                 (e.g. "*/15")`;

function formatRunStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

export function CronsPage() {
  usePageTitle('Crons');

  const { data: recipes = [], isLoading } = useCronRecipes();
  const { data: runs = [] } = useRuns();
  const [syntaxOpen, setSyntaxOpen] = useState(false);
  const [addRecipeOpen, setAddRecipeOpen] = useState(false);

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

        <Collapsible open={syntaxOpen} onOpenChange={setSyntaxOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            {syntaxOpen ? (
              <ChevronDownIcon size={14} aria-hidden />
            ) : (
              <ChevronRightIcon size={14} aria-hidden />
            )}
            Cron syntax
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 overflow-x-auto rounded-md border bg-muted p-3 font-mono text-xs">
              {CRON_SYNTAX_LEGEND}
            </pre>
          </CollapsibleContent>
        </Collapsible>

        <div className="grid gap-4">
          {recipes.map((recipe) => (
            <Card key={recipe.id}>
              <CardHeader>
                <CardTitle>{recipe.title}</CardTitle>
                <CardDescription>{recipe.description}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <CronCommandReference recipe={recipe} />

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
          ))}
        </div>

        <Collapsible open={addRecipeOpen} onOpenChange={setAddRecipeOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            {addRecipeOpen ? (
              <ChevronDownIcon size={14} aria-hidden />
            ) : (
              <ChevronRightIcon size={14} aria-hidden />
            )}
            Adding a Cron Recipe
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="mt-2 grid gap-1 rounded-md border p-3 text-sm text-muted-foreground">
              <li>
                1. Add recipe metadata to{' '}
                <code className="font-mono text-xs">apps/server/src/routes/crons/cron-recipes.ts</code>.
              </li>
              <li>2. Add a one-shot implementation in that file or a helper beside it.</li>
              <li>
                3. Wrap execution in <code className="font-mono text-xs">runSkill(...)</code> so every
                invocation creates a durable run node.
              </li>
              <li>4. Keep the recipe id stable; it becomes the URL and terminal command id.</li>
              <li>
                5. Expose manual execution through{' '}
                <code className="font-mono text-xs">POST /api/crons/:id/run</code>.
              </li>
              <li>6. Add a terminal action when the recipe should be discoverable from /terminal.</li>
            </ol>
          </CollapsibleContent>
        </Collapsible>

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

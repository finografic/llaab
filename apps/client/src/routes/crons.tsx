import { CronCommandReference } from 'components/CronCommandReference/CronCommandReference';
import { IconHeading } from 'components/IconHeading/IconHeading';
import { PageHero } from 'components/PageHero/PageHero';
import { Button } from 'components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from 'components/ui/dialog';
import { Input } from 'components/ui/input';
import { Label } from 'components/ui/label';
import { NativeSelect, NativeSelectOption } from 'components/ui/native-select';
import { Textarea } from 'components/ui/textarea';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { ChevronDownIcon, ChevronRightIcon, EditIcon, PlusIcon, TimerIcon } from 'lucide-react';
import {
  useCreateCronRecipe,
  useCronRecipes,
  useRepairCronRecipes,
  useUpdateCronRecipe,
} from 'queries/crons';
import { Fragment, useMemo, useState } from 'react';
import type { CronHistoryEntry, CronRecipe, CronRecipeWriteInput, CronScript } from 'queries/crons';
import type { FormEvent } from 'react';

import { usePageTitle } from 'lib/use-page-title';

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

function formatCronDuration(entry: CronHistoryEntry): string {
  return entry.durationMs > 0 ? `${entry.durationMs} ms` : '0 ms';
}

const CRON_PARTS = [
  { key: 'minute', label: 'Min' },
  { key: 'hour', label: 'Hour' },
  { key: 'dayOfMonth', label: 'Day' },
  { key: 'month', label: 'Mon' },
  { key: 'dayOfWeek', label: 'Week' },
] as const;

const EMPTY_RECIPES: CronRecipe[] = [];
const EMPTY_SCRIPTS: CronScript[] = [];
const EMPTY_HISTORY: CronHistoryEntry[] = [];

function splitCronExpression(expression: string): string[] {
  const parts = expression.trim().split(/\s+/).filter(Boolean);
  return CRON_PARTS.map((_, index) => parts[index] ?? '*');
}

function joinCronParts(parts: string[]): string {
  return CRON_PARTS.map((_, index) => parts[index]?.trim() || '*').join(' ');
}

function CronFrequencyInputs({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const parts = splitCronExpression(value);

  return (
    <div className="grid gap-2">
      <Label>Cron frequency</Label>
      <div className="flex flex-wrap gap-2">
        {CRON_PARTS.map((part, index) => (
          <label key={part.key} className="grid gap-1">
            <span className="text-xs text-muted-foreground">{part.label}</span>
            <Input
              className="w-16 text-center font-mono"
              value={parts[index] === '*' ? '' : parts[index]}
              maxLength={8}
              placeholder="*"
              onChange={(event) => {
                const next = [...parts];
                next[index] = event.target.value.trim() || '*';
                onChange(joinCronParts(next));
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function createInitialValues(recipe?: CronRecipe, scripts: CronScript[] = []): CronRecipeWriteInput {
  return {
    title: recipe?.title ?? '',
    description: recipe?.description ?? '',
    risk: recipe?.risk ?? 'medium',
    cronExpression: recipe?.cronExpression ?? '* * * * *',
    scriptId: recipe?.scriptId ?? scripts[0]?.id ?? '',
  };
}

function getFormScripts(recipe: CronRecipe | undefined, scripts: CronScript[]): CronScript[] {
  if (!recipe?.scriptId || scripts.some((script) => script.id === recipe.scriptId)) return scripts;

  return [
    {
      id: recipe.scriptId,
      title: recipe.scriptId,
      description: 'Current recipe script',
      location: recipe.scriptId,
    },
    ...scripts,
  ];
}

function CronRecipeFormDialog({
  mode,
  recipe,
  scripts,
}: {
  mode: 'add' | 'edit';
  recipe?: CronRecipe;
  scripts: CronScript[];
}) {
  const formScripts = useMemo(() => getFormScripts(recipe, scripts), [recipe, scripts]);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CronRecipeWriteInput>(() => createInitialValues(recipe, formScripts));
  const createRecipe = useCreateCronRecipe();
  const updateRecipe = useUpdateCronRecipe();
  const pending = createRecipe.isPending || updateRecipe.isPending;
  const error = createRecipe.error ?? updateRecipe.error;

  function resetForm() {
    setValues(createInitialValues(recipe, formScripts));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === 'edit' && recipe) {
      updateRecipe.mutate(
        { recipeId: recipe.id, ...values },
        {
          onSuccess: () => {
            setOpen(false);
          },
        },
      );
      return;
    }

    createRecipe.mutate(values, {
      onSuccess: () => {
        setOpen(false);
        resetForm();
      },
    });
  }

  const title = mode === 'add' ? 'Add Cron Recipe' : 'Edit Cron Recipe';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant={mode === 'add' ? 'default' : 'outline'}>
          {mode === 'add' ? <PlusIcon aria-hidden /> : <EditIcon aria-hidden />}
          {mode === 'add' ? 'Add Recipe' : 'Edit'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Recipes install a managed crontab line that calls one registered LLAAB script.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor={`${mode}-cron-title`}>Title</Label>
            <Input
              id={`${mode}-cron-title`}
              value={values.title}
              onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${mode}-cron-description`}>Description</Label>
            <Textarea
              id={`${mode}-cron-description`}
              value={values.description}
              onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
              required
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
            <div className="grid gap-2">
              <Label htmlFor={`${mode}-cron-risk`}>Risk</Label>
              <NativeSelect
                id={`${mode}-cron-risk`}
                className="w-full"
                value={values.risk}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    risk: event.target.value as CronRecipe['risk'],
                  }))
                }
              >
                <NativeSelectOption value="low">low</NativeSelectOption>
                <NativeSelectOption value="medium">medium</NativeSelectOption>
                <NativeSelectOption value="high">high</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${mode}-cron-script`}>Script</Label>
              <NativeSelect
                id={`${mode}-cron-script`}
                className="w-full"
                value={values.scriptId}
                onChange={(event) => setValues((current) => ({ ...current, scriptId: event.target.value }))}
                required
              >
                {formScripts.map((script) => (
                  <NativeSelectOption key={script.id} value={script.id}>
                    {script.title}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>

          <CronFrequencyInputs
            value={values.cronExpression}
            onChange={(cronExpression) => setValues((current) => ({ ...current, cronExpression }))}
          />

          {values.scriptId ? (
            <p className="font-mono text-xs text-muted-foreground">
              {formScripts.find((script) => script.id === values.scriptId)?.location}
            </p>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : 'Unable to save cron recipe.'}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending || formScripts.length === 0}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CronsPage() {
  usePageTitle('Crons');

  const { data, isLoading } = useCronRecipes();
  const repairCrons = useRepairCronRecipes();
  const recipes = data?.recipes ?? EMPTY_RECIPES;
  const scripts = data?.scripts ?? EMPTY_SCRIPTS;
  const history = data?.history ?? EMPTY_HISTORY;
  const scriptsById = useMemo(() => new Map(scripts.map((script) => [script.id, script])), [scripts]);
  const [syntaxOpen, setSyntaxOpen] = useState(false);
  const [addRecipeOpen, setAddRecipeOpen] = useState(false);
  const needsRepair = recipes.some((recipe) => recipe.health === 'failing' || recipe.health === 'stale');

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Execute"
          title="Crons"
          right={
            <div className="flex items-center gap-2">
              {needsRepair ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={repairCrons.isPending}
                  onClick={() => repairCrons.mutate()}
                >
                  {repairCrons.isPending ? 'Repairing…' : 'Repair crontab'}
                </Button>
              ) : null}
              <CronRecipeFormDialog mode="add" scripts={scripts} />
            </div>
          }
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

        <p className="max-w-3xl text-sm text-muted-foreground">
          Installed recipes have a managed line in the user crontab. Health reflects whether that line is
          actually succeeding (stale / failing / never ran), not only whether it is installed. Uninstalling
          removes LLAAB&apos;s managed line without touching unrelated entries. Crontab triggers use{' '}
          <code className="font-mono text-xs">scripts/macos/llaab-cron-run.sh</code> so API-key auth works.
        </p>
        {repairCrons.error ? (
          <p className="text-sm text-destructive">
            {repairCrons.error instanceof Error ? repairCrons.error.message : 'Repair failed.'}
          </p>
        ) : null}
        {repairCrons.data?.repaired?.length ? (
          <p className="text-sm text-(--success-text)">
            Repaired crontab lines for: {repairCrons.data.repaired.join(', ')}
          </p>
        ) : null}

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
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg">
                    <IconHeading icon={TimerIcon}>{recipe.title}</IconHeading>
                  </CardTitle>
                  <CronRecipeFormDialog mode="edit" recipe={recipe} scripts={scripts} />
                </div>
                <CardDescription>{recipe.description}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <CronCommandReference recipe={recipe} />
                <p className="text-xs text-muted-foreground">
                  Script: {scriptsById.get(recipe.scriptId)?.title ?? recipe.scriptId}
                </p>

                <div className="grid gap-2">
                  <h3 className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                    External triggers
                  </h3>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md border bg-muted p-3 font-mono text-xs">
                    {recipe.scheduleExamples.map((example, index) => (
                      <Fragment key={example.label}>
                        {index > 0 ? '\n\n' : ''}
                        <span className="text-muted-foreground/60"># {example.label}</span>
                        {'\n'}
                        {example.value}
                      </Fragment>
                    ))}
                  </pre>
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
              <li>1. Register a script server-side when a new behavior is needed.</li>
              <li>2. Use Add Recipe to choose that script and set the frequency.</li>
              <li>3. Enable the recipe to install its managed crontab line.</li>
              <li>4. Edit recipes here; the crontab line is refreshed if the recipe is enabled.</li>
            </ol>
          </CollapsibleContent>
        </Collapsible>

        <section className="grid gap-3">
          <h2 className="text-base font-semibold">Recent Cron Runs</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cron recipe runs yet.</p>
          ) : (
            <div className="grid gap-2">
              {history.map((entry) => (
                <div key={entry.id} className="grid gap-1 rounded-md border bg-card p-3">
                  <span className="font-mono text-sm">
                    {entry.recipeId} run {new Date(entry.startedAt).toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRunStatus(entry.status)} · {formatCronDuration(entry)}
                    {entry.result
                      ? ` · checked ${entry.result.checked}, consolidated ${entry.result.consolidated}, failed ${entry.result.failed}`
                      : ''}
                    {entry.error ? ` · ${entry.error}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </PageList>
    </PageLayout>
  );
}

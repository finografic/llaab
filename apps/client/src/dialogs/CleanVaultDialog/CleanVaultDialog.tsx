import { BrushCleaningIcon, ClockIcon, LoaderIcon } from '@llaab/icons';
import { Button } from 'components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'components/ui/dialog';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from 'components/ui/input-group';
import { Label } from 'components/ui/label';
import { useRuns } from 'queries/runs';
import { useVaultClean } from 'queries/vault';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';
import type { RunNode } from '@llaab/schemas';

import { dispatchIngestFormReset } from 'lib/ingest-form-events';
import { countRunsWithinHours } from 'utils/count-runs-within-hours.utils';

import styles from './CleanVaultDialog.module.css';

const DEFAULT_HOURS = 6;
const HOURS_DEBOUNCE_MS = 300;

interface CleanVaultDialogProps {
  resetIngestFormOnSuccess?: boolean;
}

function formatRunDeleteNote(runCount: number): string {
  const noun = runCount === 1 ? 'run' : 'runs';
  return `${runCount} ${noun} will be deleted`;
}

function formatRunDeletedToast(runCount: number): string {
  const noun = runCount === 1 ? 'run' : 'runs';
  return `Removed ${runCount} ${noun}.`;
}

function runCountForHours(runs: RunNode[] | null, hoursValue: string): number {
  if (runs === null) return 0;

  const parsedHours = Number(hoursValue);
  if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
    return 0;
  }

  return countRunsWithinHours(runs, parsedHours);
}

export function CleanVaultDialog({ resetIngestFormOnSuccess = false }: CleanVaultDialogProps) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(String(DEFAULT_HOURS));
  const [debouncedHours] = useDebounce(hours, HOURS_DEBOUNCE_MS);
  const [error, setError] = useState<string | null>(null);

  const { data: runs, isLoading: runsLoading, isError: runsError } = useRuns({ enabled: open });
  const vaultClean = useVaultClean();
  const cleaning = vaultClean.isPending;

  const runsList: RunNode[] | null = runs ?? null;
  const runCount = useMemo(() => runCountForHours(runsList, debouncedHours), [debouncedHours, runsList]);

  const closeDialog = () => {
    if (cleaning) return;
    setOpen(false);
    setError(null);
    setHours(String(DEFAULT_HOURS));
  };

  const handleClean = async () => {
    const parsedHours = Number(hours);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      setError('Enter a positive number of hours.');
      return;
    }

    setError(null);

    try {
      await vaultClean.mutateAsync(parsedHours);

      const deletedRunCount = runCountForHours(runsList, hours);
      toast.success(formatRunDeletedToast(deletedRunCount));
      if (resetIngestFormOnSuccess) {
        dispatchIngestFormReset();
      }
      setOpen(false);
      setError(null);
      setHours(String(DEFAULT_HOURS));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vault clean failed.');
    }
  };

  const parsedHours = Number(hours);
  const hasValidHours = Number.isFinite(parsedHours) && parsedHours > 0;
  const showRunNote = open && hasValidHours;
  const hoursPending = runsList !== null && !runsLoading && debouncedHours !== hours;

  const runNoteText = (() => {
    if (runsLoading || hoursPending) return 'Checking runs…';
    if (runsError) return 'Unable to load runs.';
    return formatRunDeleteNote(runCount);
  })();

  const runNoteClassName =
    runsLoading || hoursPending || runsError || runCount === 0 ? styles.runNoteMuted : styles.runNoteDanger;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={styles.trigger}
        aria-label="Clean recent vault activity"
        onClick={() => setOpen(true)}
      >
        <BrushCleaningIcon aria-hidden />
      </Button>

      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && closeDialog()}>
        <DialogContent showCloseButton={!cleaning} onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Clean recent vault activity</DialogTitle>
            <DialogDescription>
              Remove vault artifacts modified within the selected number of hours from runs, sources,
              transcripts, ideas, and temp files.
            </DialogDescription>
          </DialogHeader>

          <div className={styles.fieldRow}>
            <Label htmlFor="clean-vault-hours" className={styles.fieldLabel}>
              Window
            </Label>
            <div className={styles.hoursInputRow}>
              <InputGroup>
                <InputGroupInput
                  id="clean-vault-hours"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={hours}
                  disabled={cleaning}
                  onChange={(event) => setHours(event.target.value)}
                  placeholder="Clean past N hours..."
                />
                <InputGroupAddon>
                  {cleaning ? (
                    <LoaderIcon className="animate-spin" />
                  ) : (
                    <ClockIcon className={styles.hoursInputIcon} aria-hidden />
                  )}
                </InputGroupAddon>
                <InputGroupAddon align="inline-end">
                  <InputGroupText className="text-muted-foreground">hours</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              {showRunNote && <p className={runNoteClassName}>{runNoteText}</p>}
              {error && <p className={styles.error}>{error}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={cleaning} onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className={styles.cleanButton}
              disabled={cleaning}
              onClick={handleClean}
            >
              {cleaning ? 'Cleaning…' : 'Clean'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { BrushCleaningIcon } from '@llaab/icons';
import { Button } from 'components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'components/ui/dialog';
import { Input } from 'components/ui/input';
import { Label } from 'components/ui/label';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';
import type { RunNode } from '@llaab/schemas';

import { api } from 'lib/api';
import { apiPost } from 'lib/api-client';
import { dispatchIngestFormReset } from 'lib/ingest-form-events';
import { countRunsWithinHours } from 'utils/count-runs-within-hours.utils';

import s from './CleanVaultActivityButton.module.css';

const DEFAULT_HOURS = 6;
const HOURS_DEBOUNCE_MS = 300;

interface CleanVaultActivityButtonProps {
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

export function CleanVaultActivityButton({
  resetIngestFormOnSuccess = false,
}: CleanVaultActivityButtonProps) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(String(DEFAULT_HOURS));
  const [debouncedHours] = useDebounce(hours, HOURS_DEBOUNCE_MS);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunNode[] | null>(null);
  const [runsError, setRunsError] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);

  const resetDialogState = useCallback(() => {
    setRuns(null);
    setRunsError(false);
    setRunsLoading(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetDialogState();
      return;
    }

    let cancelled = false;

    const loadRuns = async () => {
      setRunsLoading(true);
      setRunsError(false);

      try {
        const res = await api.runs.$get();
        const body = (await res.json()) as { runs?: RunNode[] };

        if (!res.ok || !body.runs) {
          throw new Error('Failed to load runs.');
        }

        if (!cancelled) {
          setRuns(body.runs);
        }
      } catch {
        if (!cancelled) {
          setRunsError(true);
          setRuns(null);
        }
      } finally {
        if (!cancelled) {
          setRunsLoading(false);
        }
      }
    };

    void loadRuns();

    return () => {
      cancelled = true;
    };
  }, [open, resetDialogState]);

  const runCount = useMemo(() => runCountForHours(runs, debouncedHours), [debouncedHours, runs]);

  const closeDialog = () => {
    if (cleaning) return;
    setOpen(false);
    setError(null);
    setHours(String(DEFAULT_HOURS));
    resetDialogState();
  };

  const handleClean = async () => {
    const parsedHours = Number(hours);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      setError('Enter a positive number of hours.');
      return;
    }

    setCleaning(true);
    setError(null);

    try {
      await apiPost<{ success: true; removedCount: number }>('/api/vault/clean-recent', {
        hours: parsedHours,
      });

      const deletedRunCount = runCountForHours(runs, hours);
      toast.success(formatRunDeletedToast(deletedRunCount));
      if (resetIngestFormOnSuccess) {
        dispatchIngestFormReset();
      }
      setOpen(false);
      setError(null);
      setHours(String(DEFAULT_HOURS));
      resetDialogState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vault clean failed.');
    } finally {
      setCleaning(false);
    }
  };

  const parsedHours = Number(hours);
  const hasValidHours = Number.isFinite(parsedHours) && parsedHours > 0;
  const showRunNote = open && hasValidHours;
  const hoursPending = runs !== null && !runsLoading && debouncedHours !== hours;

  const runNoteText = (() => {
    if (runsLoading || hoursPending) return 'Checking runs…';
    if (runsError) return 'Unable to load runs.';
    return formatRunDeleteNote(runCount);
  })();

  const runNoteClassName =
    runsLoading || hoursPending || runsError || runCount === 0 ? s.runNoteMuted : s.runNoteDanger;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={s.trigger}
        aria-label="Clean recent vault activity"
        onClick={() => setOpen(true)}
      >
        <BrushCleaningIcon className={s.triggerIcon} aria-hidden />
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

          <div className={s.fieldRow}>
            <Label htmlFor="clean-vault-hours" className={s.fieldLabel}>
              Window
            </Label>
            <div className={s.hoursInputRow}>
              <Input
                id="clean-vault-hours"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={hours}
                disabled={cleaning}
                className={s.hoursInput}
                onChange={(event) => setHours(event.target.value)}
              />
              <span className={s.hoursSuffix}>hours</span>
            </div>
            {showRunNote && <p className={runNoteClassName}>{runNoteText}</p>}
          </div>

          {error && <p className={s.error}>{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={cleaning} onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className={s.cleanButton}
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

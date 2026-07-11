import { PinIcon, PinOffIcon } from '@llaab/icons';
import { cn } from '@llaab/ui/lib/utils';
import { Button } from 'components/ui/button';
import {
  useIsPackagePinned,
  useIsRepositoryPinned,
  usePinPackage,
  usePinRepository,
  useUnpinPackage,
  useUnpinRepository,
} from 'queries/registry';
import { toast } from 'sonner';
import type { MouseEvent } from 'react';

import styles from './RegistrySidebarPinButton.module.css';

export type RegistrySidebarPinKind = 'package' | 'repository';

export interface RegistrySidebarPinButtonProps {
  kind: RegistrySidebarPinKind;
  /** Npm package name or `owner/repo`. */
  target: string;
}

export function RegistrySidebarPinButton({ kind, target }: RegistrySidebarPinButtonProps) {
  const isPackagePinned = useIsPackagePinned(kind === 'package' ? target : '');
  const isRepoPinned = useIsRepositoryPinned(kind === 'repository' ? target : '');
  const pinPackage = usePinPackage();
  const unpinPackage = useUnpinPackage();
  const pinRepository = usePinRepository();
  const unpinRepository = useUnpinRepository();

  const isPinned = kind === 'package' ? isPackagePinned : isRepoPinned;
  const pinPending =
    kind === 'package'
      ? pinPackage.isPending || unpinPackage.isPending
      : pinRepository.isPending || unpinRepository.isPending;

  async function handlePinToggle(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (pinPending || !target) return;

    try {
      if (kind === 'package') {
        if (isPinned) {
          await unpinPackage.mutateAsync(target);
          toast.success(`Unpinned ${target}`);
        } else {
          await pinPackage.mutateAsync(target);
          toast.success(`Pinned ${target}`);
        }
        return;
      }

      if (isPinned) {
        await unpinRepository.mutateAsync(target);
        toast.success(`Unpinned ${target}`);
      } else {
        await pinRepository.mutateAsync(target);
        toast.success(`Pinned ${target}`);
      }
    } catch {
      toast.error(isPinned ? `Failed to unpin ${target}` : `Failed to pin ${target}`);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(styles.pinButton, isPinned && styles.pinButtonActive)}
      onClick={handlePinToggle}
      disabled={pinPending}
      aria-label={isPinned ? `Unpin ${target}` : `Pin ${target}`}
      aria-pressed={isPinned}
    >
      {isPinned ? (
        <PinIcon className={styles.pinIcon} aria-hidden />
      ) : (
        <PinOffIcon className={styles.pinIcon} aria-hidden />
      )}
    </Button>
  );
}

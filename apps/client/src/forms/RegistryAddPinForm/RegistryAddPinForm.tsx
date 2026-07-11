import { cn } from '@llaab/ui/lib/utils';
import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { Label } from 'components/ui/label';
import { CheckIcon, PinIcon } from 'lucide-react';
import { usePinPackage, usePinRepository } from 'queries/registry';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { DragEvent, FormEvent } from 'react';

import {
  classifyRegistryUrl,
  extractDroppedUrl,
  isHttpUrl,
  parseGithubRepoRef,
  parseNpmPackageRef,
} from './registry-add-pin-form.utils';
import styles from './registry-toolbar-card.module.css';

function detectedLabel(kind: ReturnType<typeof classifyRegistryUrl>): string | null {
  switch (kind) {
    case 'package':
      return 'Package URL detected';
    case 'repository':
      return 'Repository URL detected';
    case 'unknown':
      return null;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function RegistryAddPinForm() {
  const navigate = useNavigate();
  const pinPackageMutation = usePinPackage();
  const pinRepository = usePinRepository();

  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [, setDragDepth] = useState(0);

  const kind = useMemo(() => classifyRegistryUrl(url), [url]);
  const detection = detectedLabel(kind);
  const busy = pinPackageMutation.isPending || pinRepository.isPending;
  const canSubmit = !busy && kind !== 'unknown' && url.trim().length > 0;

  async function pinFromValue(raw: string) {
    const trimmed = raw.trim();
    const nextKind = classifyRegistryUrl(trimmed);

    if (nextKind === 'repository') {
      const fullName = parseGithubRepoRef(trimmed);
      if (!fullName) {
        setError('Could not parse a GitHub repository from that URL.');
        return;
      }
      try {
        await pinRepository.mutateAsync(fullName);
        toast.success(`Pinned ${fullName}`);
        setUrl('');
        setError(null);
        void navigate('/registry/repos');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to pin repository.');
      }
      return;
    }

    if (nextKind === 'package') {
      const name = parseNpmPackageRef(trimmed);
      if (!name) {
        setError('Could not parse an npm package from that URL.');
        return;
      }
      try {
        await pinPackageMutation.mutateAsync(name);
        toast.success(`Pinned ${name}`);
        setUrl('');
        setError(null);
        void navigate('/registry/packages');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to pin package.');
      }
      return;
    }

    setError(
      isHttpUrl(trimmed)
        ? 'Paste an npmjs.com / npmx.dev package URL or a github.com repository URL.'
        : 'Paste a valid npm or GitHub URL (or owner/repo / package name).',
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void pinFromValue(url);
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    setDragDepth((depth) => depth + 1);
    setIsDropActive(true);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    setDragDepth((depth) => {
      const next = Math.max(0, depth - 1);
      if (next === 0) setIsDropActive(false);
      return next;
    });
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragDepth(0);
    setIsDropActive(false);
    const droppedUrl = extractDroppedUrl(event.dataTransfer);
    if (!droppedUrl) {
      setError('Could not read a URL from that drop.');
      return;
    }
    setUrl(droppedUrl);
    setError(null);
    void pinFromValue(droppedUrl);
  }

  return (
    <div
      className={cn(styles.card, 'drop-zone', isDropActive && 'drop-zone--active')}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h2 className={cn(styles.title, styles.titleAccent)}>
        <PinIcon className={styles.titleIcon} aria-hidden />
        Add new registry
      </h2>

      <p className={cn(styles.feedback, detection && styles.feedbackAccent)}>
        {detection ? <CheckIcon className={styles.feedbackIcon} aria-hidden /> : null}
        <span>{detection ?? 'Paste or drop an npm, npmx, or GitHub URL to pin it.'}</span>
      </p>

      <form onSubmit={handleSubmit} noValidate className={styles.field}>
        <Label htmlFor="registry-add-pin-url">Registry URL</Label>
        <div className={styles.inputRow}>
          <Input
            id="registry-add-pin-url"
            type="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://"
            className={styles.input}
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError(null);
            }}
            disabled={busy}
          />
          <Button type="submit" disabled={!canSubmit} size="lg" className={styles.submitBtn}>
            {busy ? 'Adding…' : 'Add'}
          </Button>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </form>
    </div>
  );
}

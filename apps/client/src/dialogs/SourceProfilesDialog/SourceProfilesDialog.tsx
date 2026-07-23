import { useQueryClient } from '@tanstack/react-query';
import { Button } from 'components/ui/button';
import { Checkbox } from 'components/ui/checkbox';
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
import { CirclePlusIcon, GitBranchIcon, PlaySquareIcon } from 'lucide-react';
import { QUERY_KEYS } from 'queries/vault';
import { useState } from 'react';
import type { SourceProfile } from '@llaab/schemas';

import { api } from 'lib/api';

import styles from './SourceProfilesDialog.module.css';

export interface SourceProfilesDialogProps {
  sourceId: string;
  sourceTitle: string;
  profiles: SourceProfile[];
  primaryUrl?: string;
  primaryPlatform?: 'youtube';
  suggestedGithubUrl?: string;
  /** Non-LLM YouTube channel match for a podcast source — see match-podcast-youtube.ts. */
  suggestedYoutubeUrl?: string;
  youtubeMatchConfidence?: number;
  youtubeMatchBasis?: 'vault' | 'website' | 'search';
}

interface PlatformPill {
  platform: SourceProfile['platform'];
  label: string;
  url: string;
  primary?: boolean;
}

function platformLabel(platform: SourceProfile['platform']): string {
  switch (platform) {
    case 'github':
      return 'GitHub';
    case 'youtube':
      return 'YouTube';
    case 'x':
      return 'X';
    case 'bluesky':
      return 'Bluesky';
    case 'website':
      return 'Website';
    case 'twitch':
      return 'Twitch';
    case 'npm':
      return 'npm';
    case 'rss':
      return 'RSS';
  }
}

function matchBasisLabel(basis: 'vault' | 'website' | 'search'): string {
  switch (basis) {
    case 'vault':
      return 'matched to a channel already in your vault';
    case 'website':
      return "found on the podcast's website";
    case 'search':
      return 'found via YouTube search';
  }
}

function githubHandleFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'github.com') return undefined;
    const [handle] = parsed.pathname.split('/').filter(Boolean);
    return handle;
  } catch {
    return undefined;
  }
}

function normalizeGithubUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.hostname !== 'github.com') return undefined;
    const handle = githubHandleFromUrl(parsed.toString());
    return handle ? `https://github.com/${handle}` : undefined;
  } catch {
    return undefined;
  }
}

function normalizeYoutubeUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!/(^|\.)youtube\.com$/i.test(parsed.hostname)) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function buildPills(
  profiles: SourceProfile[],
  primaryUrl?: string,
  primaryPlatform?: 'youtube',
): PlatformPill[] {
  const primaryPill =
    primaryUrl && primaryPlatform
      ? [{ platform: primaryPlatform, label: platformLabel(primaryPlatform), url: primaryUrl, primary: true }]
      : [];

  const linkedPills = profiles.map((profile) => ({
    platform: profile.platform,
    label: profile.label ?? platformLabel(profile.platform),
    url: profile.url,
    primary: profile.primary,
  }));

  return [...primaryPill, ...linkedPills];
}

export function SourceProfilesDialog({
  sourceId,
  profiles,
  primaryUrl,
  primaryPlatform,
  suggestedGithubUrl,
  suggestedYoutubeUrl,
  youtubeMatchConfidence,
  youtubeMatchBasis,
}: SourceProfilesDialogProps) {
  const queryClient = useQueryClient();
  const initialGithub = profiles.find((profile) => profile.platform === 'github');
  const initialGithubUrl = initialGithub?.url ?? suggestedGithubUrl ?? '';
  const initialGithubEnabled = Boolean(initialGithub);

  const initialYoutube = profiles.find((profile) => profile.platform === 'youtube');
  const initialYoutubeUrl = initialYoutube?.url ?? suggestedYoutubeUrl ?? '';
  const initialYoutubeEnabled = Boolean(initialYoutube);
  const youtubeIsUnconfirmedSuggestion = !initialYoutube && Boolean(suggestedYoutubeUrl);

  const [open, setOpen] = useState(false);
  const [githubEnabled, setGithubEnabled] = useState(initialGithubEnabled);
  const [githubUrl, setGithubUrl] = useState(initialGithubUrl);
  const [youtubeEnabled, setYoutubeEnabled] = useState(initialYoutubeEnabled);
  const [youtubeUrl, setYoutubeUrl] = useState(initialYoutubeUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pills = buildPills(profiles, primaryUrl, primaryPlatform);

  const resetDialog = () => {
    setError(null);
    setGithubEnabled(initialGithubEnabled);
    setGithubUrl(initialGithubUrl);
    setYoutubeEnabled(initialYoutubeEnabled);
    setYoutubeUrl(initialYoutubeUrl);
    setSaving(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && saving) return;
    if (nextOpen) resetDialog();
    setOpen(nextOpen);
  };

  const handleSave = async () => {
    setError(null);

    const nextProfiles = profiles.filter(
      (profile) => profile.platform !== 'github' && profile.platform !== 'youtube',
    );
    const normalizedGithubUrl = normalizeGithubUrl(githubUrl);
    const normalizedYoutubeUrl = normalizeYoutubeUrl(youtubeUrl);

    if (githubEnabled) {
      if (!normalizedGithubUrl) {
        setError('Enter a valid GitHub profile URL.');
        return;
      }

      nextProfiles.push({
        platform: 'github',
        url: normalizedGithubUrl,
        handle: githubHandleFromUrl(normalizedGithubUrl),
      });
    }

    if (youtubeEnabled) {
      if (!normalizedYoutubeUrl) {
        setError('Enter a valid YouTube channel URL.');
        return;
      }

      nextProfiles.push({ platform: 'youtube', url: normalizedYoutubeUrl });
    }

    setSaving(true);

    try {
      const res = await api.vault.sources[':id'].profiles.$patch({
        param: { id: sourceId },
        json: { profiles: nextProfiles },
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to update profiles.');
      }

      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vault.node(sourceId) });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profiles.');
      setSaving(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.platformRow}>
        {pills.map((pill) => (
          <a
            key={`${pill.platform}-${pill.url}`}
            href={pill.url}
            className={`${styles.platformPill} ${pill.primary ? styles.primaryPill : ''}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {pill.platform === 'github' ? <GitBranchIcon aria-hidden="true" /> : null}
            {pill.platform === 'youtube' ? <PlaySquareIcon aria-hidden="true" /> : null}
            <span>{pill.label}</span>
          </a>
        ))}

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={styles.addButton}
          aria-label="Add linked platform"
          onClick={() => setOpen(true)}
        >
          <CirclePlusIcon aria-hidden="true" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>Linked platforms</DialogTitle>
            <DialogDescription>Add platform profiles for this source.</DialogDescription>
          </DialogHeader>

          <div className={styles.dialogBody}>
            <div className={styles.platformField}>
              <GitBranchIcon className={styles.platformIcon} aria-hidden="true" />
              <div className={styles.inputStack}>
                <Label htmlFor={`source-profile-github-${sourceId}`}>GitHub</Label>
                <Input
                  id={`source-profile-github-${sourceId}`}
                  type="url"
                  value={githubUrl}
                  placeholder={suggestedGithubUrl ?? 'https://github.com/t3dotgg'}
                  disabled={!githubEnabled || saving}
                  onChange={(event) => setGithubUrl(event.target.value)}
                />
              </div>
              <Checkbox
                aria-label="Enable GitHub profile"
                checked={githubEnabled}
                disabled={saving}
                onCheckedChange={(checked) => {
                  const enabled = checked === true;
                  setGithubEnabled(enabled);
                  if (enabled && !githubUrl.trim()) {
                    setGithubUrl(suggestedGithubUrl ?? '');
                  }
                }}
              />
            </div>

            {suggestedYoutubeUrl || initialYoutubeEnabled ? (
              <div className={styles.platformField}>
                <PlaySquareIcon className={styles.platformIcon} aria-hidden="true" />
                <div className={styles.inputStack}>
                  <Label htmlFor={`source-profile-youtube-${sourceId}`}>YouTube</Label>
                  <Input
                    id={`source-profile-youtube-${sourceId}`}
                    type="url"
                    value={youtubeUrl}
                    placeholder={suggestedYoutubeUrl ?? 'https://www.youtube.com/@channel'}
                    disabled={!youtubeEnabled || saving}
                    onChange={(event) => setYoutubeUrl(event.target.value)}
                  />
                  {youtubeIsUnconfirmedSuggestion && youtubeMatchConfidence != null && youtubeMatchBasis ? (
                    <p className={styles.suggestionHint}>
                      Suggested — {matchBasisLabel(youtubeMatchBasis)} ({youtubeMatchConfidence}% confidence).
                      Review before accepting.
                    </p>
                  ) : null}
                </div>
                <Checkbox
                  aria-label="Enable YouTube profile"
                  checked={youtubeEnabled}
                  disabled={saving}
                  onCheckedChange={(checked) => {
                    const enabled = checked === true;
                    setYoutubeEnabled(enabled);
                    if (enabled && !youtubeUrl.trim()) {
                      setYoutubeUrl(suggestedYoutubeUrl ?? '');
                    }
                  }}
                />
              </div>
            ) : null}

            {error ? <p className={styles.error}>{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'OK'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { MagnifyingGlassIcon } from '@llaab/icons';
import { cn } from '@llaab/ui/lib/utils';
import { InputGroup, InputGroupAddon, InputGroupInput } from 'components/ui/input-group';
import { Label } from 'components/ui/label';
import { siGithub, siNpm } from 'simple-icons';

import styles from './registry-toolbar-card.module.css';

export type RegistrySearchKind = 'packages' | 'repositories';

interface RegistrySearchCardProps {
  kind: RegistrySearchKind;
  tab: 'pinned' | 'search';
  query: string;
  onQueryChange: (value: string) => void;
  /** Current result count (filtered pins or search hits). Null while unknown/loading. */
  resultCount: number | null;
  isLoading?: boolean;
  autoFocus?: boolean;
}

function pluralLabel(kind: RegistrySearchKind, count: number): string {
  if (kind === 'packages') return count === 1 ? 'package' : 'packages';
  return count === 1 ? 'repository' : 'repositories';
}

type FeedbackTone = 'muted' | 'accent' | 'warning';

function resolveFeedback(args: {
  kind: RegistrySearchKind;
  tab: 'pinned' | 'search';
  queryEmpty: boolean;
  resultCount: number | null;
  isLoading: boolean;
}): { text: string; tone: FeedbackTone } {
  const { kind, tab, queryEmpty, resultCount, isLoading } = args;

  if (isLoading) {
    return { text: 'Searching…', tone: 'muted' };
  }

  if (queryEmpty) {
    if (tab === 'pinned' && resultCount != null) {
      return {
        text: `${resultCount.toLocaleString()} pinned ${pluralLabel(kind, resultCount)}`,
        tone: 'muted',
      };
    }
    // Search tab + empty field: keep the line for height, but no copy.
    return { text: '', tone: 'muted' };
  }

  if (resultCount === 0) {
    return { text: 'No results', tone: 'warning' };
  }

  if (resultCount != null && resultCount > 0) {
    return {
      text: `${resultCount.toLocaleString()} ${pluralLabel(kind, resultCount)} found`,
      tone: 'accent',
    };
  }

  return { text: '', tone: 'muted' };
}

function BrandIcon({ kind }: { kind: RegistrySearchKind }) {
  const icon = kind === 'packages' ? siNpm : siGithub;
  return (
    <svg role="img" viewBox="0 0 24 24" className={styles.titleBrandIcon} aria-hidden>
      <title>{icon.title}</title>
      <path fill="currentColor" d={icon.path} />
    </svg>
  );
}

export function RegistrySearchCard({
  kind,
  tab,
  query,
  onQueryChange,
  resultCount,
  isLoading = false,
  autoFocus = false,
}: RegistrySearchCardProps) {
  const title = kind === 'packages' ? 'Search packages' : 'Search Github';
  const inputLabel = kind === 'packages' ? 'Search package name' : 'Search repository name';
  const placeholder =
    tab === 'pinned'
      ? kind === 'packages'
        ? 'Filter pinned packages…'
        : 'Filter pinned repositories…'
      : kind === 'packages'
        ? 'Search packages…'
        : 'Search repositories…';

  const inputId = `registry-search-${kind}`;
  const queryEmpty = query.trim().length === 0;
  const feedback = resolveFeedback({ kind, tab, queryEmpty, resultCount, isLoading });

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        <BrandIcon kind={kind} />
        {title}
      </h2>

      <p
        className={cn(
          styles.feedback,
          feedback.tone === 'accent' && styles.feedbackAccent,
          feedback.tone === 'warning' && styles.feedbackWarning,
        )}
        aria-hidden={feedback.text.length === 0 ? true : undefined}
      >
        {/* nbsp preserves line height when Search-tab feedback is intentionally blank */}
        <span>{feedback.text || '\u00a0'}</span>
      </p>

      <div className={styles.field}>
        <Label htmlFor={inputId}>{inputLabel}</Label>
        <InputGroup
          className={cn(
            styles.searchGroup,
            'has-[[data-slot=input-group-control]:focus-visible]:ring-0',
            'has-[[data-slot=input-group-control]:focus-visible]:border-ring',
          )}
        >
          <InputGroupAddon align="inline-start" className={styles.searchIconSlot}>
            <MagnifyingGlassIcon className={styles.searchIcon} aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            id={inputId}
            className={styles.input}
            placeholder={placeholder}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            autoFocus={autoFocus}
          />
        </InputGroup>
      </div>
    </div>
  );
}

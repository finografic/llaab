import { PageHero } from 'components/PageHero/PageHero';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { useVaultNodes } from 'queries/vault';
import { SourcesTable } from 'tables/SourcesTable/SourcesTable';
import type { SourceNode } from '@llaab/schemas';

import { usePageTitle } from 'lib/use-page-title';

import styles from './sources.module.css';

export function SourcesPage() {
  usePageTitle('Sources');

  const { data: all = [], isLoading } = useVaultNodes({ type: 'source' });
  const sources = [...(all as SourceNode[])].toSorted((a, b) => a.title.localeCompare(b.title));
  const youtubeSubscribed = sources.filter(
    (s) => s.platforms.includes('youtube') && s.youtube_subscribed === true,
  );

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Vault"
          title="Sources"
          meta={
            <>
              {sources.length} source{sources.length !== 1 ? 's' : ''}
              {youtubeSubscribed.length > 0 ? (
                <span className={styles.subscriptionCount}>
                  {' '}
                  · {youtubeSubscribed.length} subscribed on YouTube
                </span>
              ) : null}
            </>
          }
        />
      }
    >
      <PageList width="wide">
        {isLoading ? <p className="text-muted-foreground text-sm">Loading sources…</p> : null}
        {!isLoading ? <SourcesTable sources={sources} /> : null}
      </PageList>
    </PageLayout>
  );
}

import { PageHero } from 'components/PageHero/PageHero';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { usePinnedLibraries, useUnpinLibrary } from 'queries/registry';
import { toast } from 'sonner';
import { LibraryPinsTable } from 'tables/LibraryPinsTable/LibraryPinsTable';

import { usePageTitle } from 'lib/use-page-title';

export function RegistryPinnedPage() {
  usePageTitle('Pinned Libraries');

  const { data: pins = [], isLoading } = usePinnedLibraries();
  const unpinLibrary = useUnpinLibrary();

  async function handleUnpin(name: string) {
    await unpinLibrary.mutateAsync(name);
    toast.success(`Unpinned ${name}`);
  }

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Registry"
          title="Pinned Libraries"
          meta={
            pins.length > 0
              ? `${pins.length} pinned ${pins.length === 1 ? 'library' : 'libraries'}`
              : undefined
          }
        />
      }
    >
      <PageList width="wide">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <LibraryPinsTable pins={pins} onUnpin={handleUnpin} />
        )}
      </PageList>
    </PageLayout>
  );
}

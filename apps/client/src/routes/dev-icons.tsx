import { PageHero } from 'components/PageHero/PageHero';
import { PageLayout } from 'layouts/PageLayout/PageLayout';

import { usePageTitle } from 'lib/use-page-title';

import styles from './dev-icons.module.css';

const ICONS_URL = 'http://localhost:5199/';

export function DevIconsPage() {
  usePageTitle('Dev · Icons');

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="System"
          title="Icons"
          description="Embedded Lucide picker for the local `@llaab/icons` registry."
        />
      }
    >
      <div className={styles.devIconsPage}>
        <div className={styles.devIconsFrameShell}>
          <iframe src={ICONS_URL} title="Lucide Manager" loading="lazy" className={styles.devIconsFrame} />
        </div>

        <div className={styles.devIconsToolbar}>
          <a href={ICONS_URL} target="_blank" rel="noreferrer noopener" className={styles.devIconsLink}>
            Open standalone picker
          </a>
          <span className={styles.devIconsMeta}>Source: {ICONS_URL}</span>
        </div>
      </div>
    </PageLayout>
  );
}

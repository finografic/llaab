import {
  ActivityIcon,
  ArrowRightIcon,
  FolderKanbanIcon,
  LandPlotIcon,
  PipetteIcon,
  PlayIcon,
  RadioIcon,
} from '@llaab/icons';
import { PageHero } from 'components/PageHero/PageHero';
import { Card, CardContent } from 'components/ui/card';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import { usePageTitle } from 'lib/use-page-title';

import styles from './root.module.css';

export function HomePage() {
  usePageTitle('Home');

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Learning Loop & Agent Automation Base"
          title="LLAAB"
          description="Your vault for ingested knowledge, structured nodes, and agent run history."
        />
      }
    >
      <div className={styles.home}>
        <div className={styles.grid}>
          <HomeCard
            to="/ingest"
            icon={<PipetteIcon size={18} aria-hidden="true" />}
            title="Ingest"
            description="Fetch a YouTube transcript and store it as a vault node."
          />
          <HomeCard
            to="/vault"
            icon={<FolderKanbanIcon size={18} aria-hidden="true" />}
            title="Vault"
            description="Browse transcripts, nodes, and structured vault content."
          />
          <HomeCard
            to="/vault/runs"
            icon={<PlayIcon size={18} aria-hidden="true" />}
            title="Runs"
            description="Inspect agent execution traces and skill run history."
          />
          <HomeCard
            to="/llm"
            icon={<ActivityIcon size={18} aria-hidden="true" />}
            title="Models"
            description="Task routing, provider status, and installed model indicators."
          />
          <HomeCard
            to="/hermes"
            icon={<RadioIcon size={18} aria-hidden="true" />}
            title="Hermes / MCP"
            description="Discord gateway, scoped vault tools, and operator automation."
          />
          <HomeCard
            to="/dev/icons"
            icon={<LandPlotIcon size={18} aria-hidden="true" />}
            title="Icons"
            description="Open the Lucide picker and manage the local icon registry."
          />
        </div>
      </div>
    </PageLayout>
  );
}

function HomeCard({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link to={to} className={styles.cardLink}>
      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>
          <div className={styles.cardIcon}>{icon}</div>
          <div className={styles.cardBody}>
            <h2 className={styles.cardTitle}>{title}</h2>
            <p className={styles.cardDesc}>{description}</p>
          </div>
          <ArrowRightIcon size={14} className={styles.cardArrow} aria-hidden="true" />
        </CardContent>
      </Card>
    </Link>
  );
}

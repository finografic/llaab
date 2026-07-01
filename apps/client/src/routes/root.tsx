import {
  ActivityIcon,
  ArrowRightIcon,
  FolderKanbanIcon,
  LandPlotIcon,
  PipetteIcon,
  PlayIcon,
  RadioIcon,
} from '@llaab/icons';
import { BalancedGrid } from 'components/BalancedGrid/BalancedGrid';
import { PageHero } from 'components/PageHero/PageHero';
import { Card, CardContent } from 'components/ui/card';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import { usePageTitle } from 'lib/use-page-title';

import styles from './root.module.css';

const HOME_CARDS = [
  {
    to: '/ingest',
    icon: PipetteIcon,
    title: 'Ingest',
    description: 'Fetch a YouTube transcript and store it as a vault node.',
  },
  {
    to: '/vault',
    icon: FolderKanbanIcon,
    title: 'Vault',
    description: 'Browse transcripts, nodes, and structured vault content.',
  },
  {
    to: '/vault/runs',
    icon: PlayIcon,
    title: 'Runs',
    description: 'Inspect agent execution traces and skill run history.',
  },
  {
    to: '/llm',
    icon: ActivityIcon,
    title: 'Models',
    description: 'Task routing, provider status, and installed model indicators.',
  },
  {
    to: '/hermes',
    icon: RadioIcon,
    title: 'Hermes / MCP',
    description: 'Discord gateway, scoped vault tools, and operator automation.',
  },
  {
    to: '/dev/icons',
    icon: LandPlotIcon,
    title: 'Icons',
    description: 'Open the Lucide picker and manage the local icon registry.',
  },
] as const;

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
        <BalancedGrid itemCount={HOME_CARDS.length} maxColumns={4} minColumns={2}>
          {HOME_CARDS.map(({ to, icon: Icon, title, description }) => (
            <HomeCard
              key={to}
              to={to}
              icon={<Icon size={18} aria-hidden="true" />}
              title={title}
              description={description}
            />
          ))}
        </BalancedGrid>
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

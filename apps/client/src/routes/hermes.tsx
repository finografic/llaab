import { BadgeCheckIcon, BrainIcon, RadioIcon, ShieldCheckIcon, ZapIcon } from '@llaab/icons';
import { PageHero } from 'components/PageHero/PageHero';
import { Badge } from 'components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'components/ui/card';
import { PageLayout } from 'layouts/PageLayout/PageLayout';

import { usePageTitle } from 'lib/use-page-title';

import styles from './hermes.module.css';

const mcpTools = [
  {
    name: 'vault_list',
    mode: 'read',
    description: 'List and filter compact vault node summaries.',
  },
  {
    name: 'vault_read',
    mode: 'read',
    description: 'Read full raw markdown for a selected vault node.',
  },
  {
    name: 'vault_capture_idea',
    mode: 'write',
    description: 'Capture raw observations from Discord into idea nodes.',
  },
];

const routingNotes = [
  'Route hellos, status checks, and simple reads to cheap/local models.',
  'Escalate planning, debugging, and risky mutations to stronger models.',
  'Keep write tools opt-in and test each one from Discord before expanding.',
];

export function HermesPage() {
  usePageTitle('Hermes / MCP');

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Operator Gateway"
          title="Hermes / MCP"
          description="Discord access to LLAAB through a scoped MCP bridge and explicit write tools."
        />
      }
    >
      <div className={styles.page}>
        <section className={styles.callout}>
          <div className={styles.calloutIcon}>
            <RadioIcon size={22} aria-hidden="true" />
          </div>
          <div className={styles.calloutBody}>
            <p className={styles.calloutEyebrow}>Live baseline</p>
            <h2 className={styles.calloutTitle}>Hermes is the phone-operable operator layer.</h2>
            <p className={styles.calloutText}>
              The gateway runs outside the LLAAB server, connects to Discord as <strong>lab</strong>, and
              reaches the vault through the allowlisted LLAAB MCP server.
            </p>
          </div>
          <Badge variant="outline" className={styles.calloutBadge}>
            SwiftBar managed
          </Badge>
        </section>

        <div className={styles.grid}>
          <Card>
            <CardHeader>
              <CardTitle className={styles.cardTitle}>
                <ShieldCheckIcon size={18} aria-hidden="true" />
                Current Guardrails
              </CardTitle>
              <CardDescription>Keep the Discord surface useful without making it broad.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className={styles.list}>
                <li>Private Discord server, single-user allowlist.</li>
                <li>LLAAB MCP tools are explicitly included, not globally exposed.</li>
                <li>
                  Writes go through server API auth with <code>LLAAB_API_KEY</code>.
                </li>
                <li>Gateway is a separate launchd process, not an app-server worker.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className={styles.cardTitle}>
                <ZapIcon size={18} aria-hidden="true" />
                Model Cost Routing
              </CardTitle>
              <CardDescription>Simple tasks should not spend premium reasoning tokens.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className={styles.list}>
                {routingNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>MCP tool surface</h2>
            <Badge variant="secondary">{mcpTools.length} tools</Badge>
          </div>
          <div className={styles.toolGrid}>
            {mcpTools.map((tool) => (
              <Card key={tool.name} className={styles.toolCard}>
                <CardHeader>
                  <CardTitle className={styles.toolTitle}>{tool.name}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant={tool.mode === 'write' ? 'default' : 'outline'}>{tool.mode}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Next build slots</h2>
            <BadgeCheckIcon size={18} className={styles.sectionIcon} aria-hidden="true" />
          </div>
          <div className={styles.nextGrid}>
            <div>
              <h3>Status API</h3>
              <p>Expose Hermes gateway state, active model, enabled MCP tools, and last Discord activity.</p>
            </div>
            <div>
              <h3>Tool expansion</h3>
              <p>Add write tools one at a time, starting with decisions before heavier ingest triggers.</p>
            </div>
            <div>
              <h3>Routing policy</h3>
              <p>Map cheap, standard, reasoning, and mutation tiers to task classes and MCP tools.</p>
            </div>
            <div>
              <h3>Operator runs</h3>
              <p>Persist meaningful Hermes actions as LLAAB run history when they become workflows.</p>
            </div>
          </div>
        </section>

        <section className={styles.note}>
          <BrainIcon size={18} aria-hidden="true" />
          <p>
            Agent-selected models should be bounded by policy: deterministic cheap routing first, escalation
            only for ambiguity, failed cheap attempts, planning, debugging, or risky mutation.
          </p>
        </section>
      </div>
    </PageLayout>
  );
}

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  compareToBaseline,
  evaluateRetrieval,
  loadFrozenGoldQueries,
  loadLiveGoldQueries,
  MONOREPO_ROOT,
  retrieveFromFrozenCorpus,
  retrieveFromLiveCorpus,
} from '@llaab/core';
import { defineCommand } from 'citty';
import type { RetrievalBaseline, RetrievalEvalReport, RetrievalQueryReport } from '@llaab/core';

import { pc } from '../utils/picocolors.js';

const BASELINE_PATH = join(MONOREPO_ROOT, 'packages/core/src/retrieval/fixtures/retrieval-baseline.json');

export const retrievalCommand = defineCommand({
  meta: {
    name: 'retrieval',
    description: 'Evaluate retrieval ranking quality',
  },
  subCommands: {
    eval: defineCommand({
      meta: {
        name: 'eval',
        description: 'Score the gold query set and compare against the recorded baseline',
      },
      args: {
        'frozen': {
          type: 'boolean',
          description: 'Evaluate the frozen fixture corpus instead of the live vault',
        },
        'update-baseline': {
          type: 'boolean',
          description: 'Write current frozen-corpus metrics to the recorded baseline',
        },
        'json': {
          type: 'boolean',
          description: 'Emit the full report as JSON',
        },
        'out': {
          type: 'string',
          description: 'Write the full JSON report to a file',
        },
      },
      async run({ args }) {
        const frozen = args.frozen === true || args['update-baseline'] === true;
        const queries = frozen ? loadFrozenGoldQueries() : loadLiveGoldQueries();
        const retrieve = frozen ? retrieveFromFrozenCorpus : retrieveFromLiveCorpus;

        const report = await evaluateRetrieval(queries, retrieve);

        if (args.json === true) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          printReport(report, frozen);
        }

        if (typeof args.out === 'string' && args.out.length > 0) {
          await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
          console.log(pc.gray(`\nreport written to ${args.out}`));
        }

        if (args['update-baseline'] === true) {
          await updateBaseline(report);
          return;
        }

        if (!frozen) {
          console.log(
            pc.gray(
              '\nLive corpus metrics are informational — the corpus changes with every ingest.\nRun with --frozen for the deterministic regression baseline.',
            ),
          );
          return;
        }

        await reportBaselineComparison(report);
      },
    }),
  },
});

function printReport(report: RetrievalEvalReport, frozen: boolean): void {
  console.log(pc.bold(`\nRetrieval evaluation — ${frozen ? 'frozen fixture corpus' : 'live corpus'}`));
  console.log(pc.gray(`${report.query_count} queries · k = ${report.ks.join(', ')}\n`));

  for (const query of report.queries) {
    printQuery(query);
  }

  console.log(pc.bold('\nAggregate'));
  console.log(`  MRR         ${formatMetric(report.aggregate.mrr)}`);
  for (const k of report.ks) {
    console.log(
      `  k=${String(k).padEnd(3)}       recall ${formatMetric(report.aggregate.recall_at_k[k] ?? 0)}   ` +
        `precision ${formatMetric(report.aggregate.precision_at_k[k] ?? 0)}   ` +
        `nDCG ${formatMetric(report.aggregate.ndcg_at_k[k] ?? 0)}`,
    );
  }

  const knownMisses = report.queries.filter((query) => query.known_miss).length;
  if (knownMisses > 0) {
    console.log(pc.gray(`\n${knownMisses} known miss(es) excluded from aggregates.`));
  }
}

function printQuery(query: RetrievalQueryReport): void {
  const missed = Object.entries(query.ranks).filter(([, rank]) => rank === null);
  const status = query.known_miss ? pc.yellow('miss') : missed.length > 0 ? pc.red('gap ') : pc.green('ok  ');

  console.log(`${status} ${pc.bold(query.id)}`);
  console.log(pc.gray(`     ${query.question}`));

  const rankSummary = Object.entries(query.ranks)
    .map(([ref, rank]) => `${rank === null ? pc.red('—') : pc.green(`#${rank}`)} ${pc.gray(ref)}`)
    .join('\n     ');

  if (rankSummary.length > 0) {
    console.log(`     ${rankSummary}`);
  } else {
    console.log(pc.gray('     (no expected documents — precision control)'));
  }

  console.log(
    pc.gray(
      `     rr ${query.reciprocal_rank}  ·  recall@5 ${query.recall_at_k[5] ?? 0}  ·  precision@5 ${query.precision_at_k[5] ?? 0}\n`,
    ),
  );
}

async function reportBaselineComparison(report: RetrievalEvalReport): Promise<void> {
  const baseline = await readBaseline();
  if (!baseline) {
    console.log(pc.yellow('\nNo baseline recorded. Run with --update-baseline to record one.'));
    return;
  }

  const comparisons = compareToBaseline(report, baseline);
  const regressions = comparisons.filter((comparison) => comparison.regressed);
  const improvements = comparisons.filter((comparison) => comparison.delta > 0);

  console.log(pc.bold(`\nVersus baseline recorded ${baseline.recorded_at}`));

  if (regressions.length === 0 && improvements.length === 0) {
    console.log(pc.gray('  unchanged'));
    return;
  }

  for (const improvement of improvements) {
    console.log(
      pc.green(
        `  ▲ ${improvement.metric.padEnd(12)} ${improvement.baseline} → ${improvement.current} (+${improvement.delta})`,
      ),
    );
  }
  for (const regression of regressions) {
    console.log(
      pc.red(
        `  ▼ ${regression.metric.padEnd(12)} ${regression.baseline} → ${regression.current} (${regression.delta})`,
      ),
    );
  }

  if (improvements.length > 0 && regressions.length === 0) {
    console.log(pc.gray('\nRanking improved. Lock it in with --update-baseline.'));
  }
  if (regressions.length > 0) {
    console.log(pc.red('\nRanking regressed. Do not update the baseline to make this pass.'));
    process.exitCode = 1;
  }
}

async function readBaseline(): Promise<RetrievalBaseline | null> {
  try {
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(BASELINE_PATH, 'utf-8')) as RetrievalBaseline;
  } catch {
    return null;
  }
}

async function updateBaseline(report: RetrievalEvalReport): Promise<void> {
  const existing = await readBaseline();
  const { loadFrozenDocuments } = await import('@llaab/core');
  const documents = loadFrozenDocuments();

  const next = {
    $comment:
      'Recorded metrics for the frozen corpus. Update deliberately, never to make a failing guard pass. A drop means ranking got worse; a rise means it got better and the new floor should be locked in. Regenerate with `lab retrieval eval --frozen --update-baseline`.',
    aggregate: report.aggregate,
    corpus: {
      knowledge_docs: documents.filter((document) => document.tier === 'knowledge').length,
      vault_nodes: documents.filter((document) => document.tier === 'vault').length,
    },
    recorded_at: new Date().toISOString(),
  };

  await writeFile(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');

  console.log(pc.green(`\nBaseline updated at ${BASELINE_PATH}`));
  if (existing) {
    console.log(pc.gray(`  MRR ${existing.aggregate.mrr} → ${report.aggregate.mrr}`));
  }
}

function formatMetric(value: number): string {
  return value.toFixed(4);
}

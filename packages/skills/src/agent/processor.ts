import { listNodes } from '@llaab/core';

import { clearIndex, hasProcessed, markProcessed, writeRunMeta } from './processed.js';
import { getRoutesFor } from './registry.js';

export interface RunAgentLoopOptions {
  nodeId?: string;
  force?: boolean;
}

export interface AgentRunResult {
  nodeId: string;
  skill: string;
  status: 'completed' | 'skipped' | 'failed';
  error?: string;
}

export interface AgentLoopSummary {
  scanned: number;
  processed: number;
  skipped: number;
  failed: number;
  runs: AgentRunResult[];
}

export async function runAgentLoop(opts: RunAgentLoopOptions = {}): Promise<AgentLoopSummary> {
  if (opts.force) await clearIndex();

  const allNodes = await listNodes();
  const nodes = opts.nodeId ? allNodes.filter((n) => n.id === opts.nodeId) : allNodes;

  const summary: AgentLoopSummary = {
    scanned: nodes.length,
    processed: 0,
    skipped: 0,
    failed: 0,
    runs: [],
  };

  for (const node of nodes) {
    const routes = getRoutesFor(node.type);

    for (const route of routes) {
      if (route.filter && !route.filter(node)) {
        summary.skipped++;
        summary.runs.push({ nodeId: node.id, skill: route.skill, status: 'skipped' });
        continue;
      }

      if (!opts.force && (await hasProcessed(node.id, route.skill))) {
        summary.skipped++;
        summary.runs.push({ nodeId: node.id, skill: route.skill, status: 'skipped' });
        continue;
      }

      try {
        const { record } = await route.execute(node);

        if (record.status === 'completed') {
          await markProcessed(node.id, route.skill);
          summary.processed++;
          summary.runs.push({ nodeId: node.id, skill: route.skill, status: 'completed' });
        } else {
          summary.failed++;
          summary.runs.push({ nodeId: node.id, skill: route.skill, status: 'failed', error: record.error });
        }
      } catch (err) {
        summary.failed++;
        summary.runs.push({
          nodeId: node.id,
          skill: route.skill,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  await writeRunMeta({
    lastRunAt: new Date().toISOString(),
    totalProcessed: summary.processed,
    totalSkipped: summary.skipped,
    totalFailed: summary.failed,
  });

  return summary;
}

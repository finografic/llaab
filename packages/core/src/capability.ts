import { z } from '@llaab/schemas';
import type { Command } from './command-protocol.js';

export const CapabilitySchema = z.enum([
  'chat',
  'reason',
  'summarize',
  'extract',
  'reduce',
  'structure',
  'memory_read',
  'memory_write',
  'skill_run',
  'agent_run',
  'command_run',
  'plan',
]);

export type Capability = z.infer<typeof CapabilitySchema>;

export const COMMAND_CAPABILITIES: Record<Command['kind'], Capability[]> = {
  'ai.run': ['chat', 'extract', 'reason'],
  'agent.run': ['agent_run', 'skill_run'],
  'fs.read': ['memory_read'],
  'fs.list': ['memory_read'],
};

export function getCommandCapabilities(command: Command): Capability[] {
  return COMMAND_CAPABILITIES[command.kind];
}

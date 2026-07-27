import { z } from '@llaab/schemas';
import type { Command } from './command-protocol.js';

export const CAPABILITIES = [
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
  'code_edit',
  'shell_exec',
  'test_run',
  'plan',
] as const;

export const CapabilitySchema = z.enum(CAPABILITIES);

export type Capability = z.infer<typeof CapabilitySchema>;

export const COMMAND_CAPABILITIES: Record<Command['kind'], Capability[]> = {
  'ai.run': ['chat', 'extract', 'reason', 'command_run'],
  'chat.ask': ['chat', 'reason', 'memory_read', 'command_run'],
  'agent.run': ['agent_run', 'skill_run', 'command_run'],
  'cron.run': ['skill_run', 'command_run'],
  'fs.read': ['memory_read', 'command_run'],
  'fs.list': ['memory_read', 'command_run'],
  'shell.exec': ['shell_exec', 'command_run'],
};

export function getCommandCapabilities(command: Command): Capability[] {
  return COMMAND_CAPABILITIES[command.kind];
}

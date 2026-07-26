export { AUTO_TAG_PATTERNS, autoTag } from './taxonomy.js';
export {
  CAPABILITIES,
  CapabilitySchema,
  COMMAND_CAPABILITIES,
  getCommandCapabilities,
} from './capability.js';
export type { Capability } from './capability.js';
export {
  AgentRunCommandSchema,
  AiRunCommandSchema,
  CommandEnvelopeSchema,
  CommandSchema,
  CommandSourceSchema,
  CronRunCommandSchema,
  DoneOutputEventSchema,
  ErrorOutputEventSchema,
  FsListCommandSchema,
  FsReadCommandSchema,
  MetaOutputEventSchema,
  OutputEnvelopeSchema,
  OutputEventSchema,
  ShellExecCommandSchema,
  StderrOutputEventSchema,
  StdoutOutputEventSchema,
  TokenOutputEventSchema,
} from './command-protocol.js';
export type {
  AgentRunCommand,
  AiRunCommand,
  Command,
  CommandEnvelope,
  CommandSource,
  CronRunCommand,
  FsListCommand,
  FsReadCommand,
  OutputEnvelope,
  OutputEvent,
  ShellExecCommand,
} from './command-protocol.js';
export {
  createHermesInboxLogEvent,
  createHermesInboxReceipt,
  createHermesInboxToolCall,
} from './hermes-inbox-receipts.js';
export { routeHermesInboxItem, routeHermesInboxText } from './hermes-inbox-router.js';
export { deleteNode } from './utils/delete-node.utils.js';
export { cleanRecentVaultActivity, countRecentVaultRuns } from './utils/clean-vault-activity.utils.js';
export { readMarkdownFiles } from './storage/reader.utils.js';
export { writeTextFile } from './storage/writer.utils.js';
export { createNode } from './utils/create-node.utils.js';
export { getNodeDirectoryPath, getNodeFilePath, VAULT_ROOT } from './utils/node-file.utils.js';
export { KNOWLEDGE_ROOT } from './utils/knowledge-root.js';
export {
  deleteKnowledgeWiki,
  getKnowledgeWikiPath,
  getKnowledgeWikiSectionIds,
  hashKnowledgeWikiPage,
  knowledgeWikiToMarkdown,
  listKnowledgeWikis,
  readKnowledgeWiki,
  renderKnowledgeWikiCitation,
  validateKnowledgeWikiPage,
  withKnowledgeWikiLock,
  writeKnowledgeWiki,
} from './utils/knowledge-wiki-file.utils.js';
export {
  assertValidKnowledgeWikiLinks,
  buildKnowledgeWikiGraph,
  buildKnowledgeWikiGraphFromPages,
  exportKnowledgeWikiGraph,
  type KnowledgeWikiGraph,
} from './utils/knowledge-wiki-graph.utils.js';
export { analyzeKnowledgeWikiNovelty } from './utils/analyze-knowledge-wiki-novelty.utils.js';
export { determineKnowledgeWikiLifecycle } from './utils/determine-knowledge-wiki-lifecycle.utils.js';
export {
  resolveKnowledgeWikiTopic,
  type KnowledgeWikiTopicMatch,
  type KnowledgeWikiTopicResolution,
} from './utils/resolve-knowledge-wiki-topic.utils.js';
export { MONOREPO_ROOT } from './utils/vault-root.js';
export { listNodes } from './utils/list-nodes.utils.js';
export {
  rankVaultSearchNodes,
  searchVaultNodes,
  type VaultSearchMatch,
  type VaultSearchMatchField,
  type VaultSearchQuery,
  type VaultSearchResult,
} from './utils/search-vault-nodes.utils.js';
export { parseFrontmatter } from './utils/parse-frontmatter.utils.js';
export { readNode } from './utils/read-node.utils.js';
export { readNodeByType } from './utils/read-node-by-type.utils.js';
export { updateNode } from './utils/update-node.utils.js';
export { writeNode } from './utils/write-node.utils.js';

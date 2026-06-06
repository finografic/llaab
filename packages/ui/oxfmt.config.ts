import type { OxfmtConfig, OxfmtOverrideConfig } from '@finografic/oxc-config/oxfmt';
import {
  AGENT_DOC_MARKDOWN_PATHS,
  agentMarkdown,
  base,
  css,
  ignorePatterns,
  json,
  markdown,
  react,
  sorting,
} from '@finografic/oxc-config/oxfmt';
import { defineConfig } from 'oxfmt';

export default defineConfig({
  ignorePatterns: [...ignorePatterns],
  ...base,
  ...react,
  ...sorting,
  overrides: [
    { files: ['*.json', '*.jsonc'], excludeFiles: [], options: { ...json } },
    {
      files: ['*.md', '*.mdx'],
      excludeFiles: [...AGENT_DOC_MARKDOWN_PATHS],
      options: { ...markdown },
    },
    {
      files: [...AGENT_DOC_MARKDOWN_PATHS],
      excludeFiles: [],
      options: { ...agentMarkdown },
    },
    { files: ['*.css', '*.scss'], excludeFiles: [], options: { ...css } },
  ] satisfies OxfmtOverrideConfig[],
} satisfies OxfmtConfig);

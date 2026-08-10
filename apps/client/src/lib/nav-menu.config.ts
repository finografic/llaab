export interface NavMenuItem {
  label: string;
  description: string;
  href: string;
  live: boolean;
}

export interface NavMenuSection {
  id: string;
  label: string;
  items: NavMenuItem[];
}

export const NAV_MENU_SECTIONS: NavMenuSection[] = [
  {
    id: 'vault',
    label: 'Vault',
    items: [
      {
        label: 'Browse Vault',
        description: 'File-tree browser for the full vault',
        href: '/vault',
        live: true,
      },
      {
        label: 'Nodes',
        description: 'Ideas, skills, resources, prompts, and instructions by type',
        href: '/vault/nodes',
        live: true,
      },
      {
        label: 'Transcripts',
        description: 'Ingested transcripts with summaries and linked ideas',
        href: '/vault/transcripts',
        live: true,
      },
      {
        label: 'Sources',
        description: 'Channels, repos, and other origin entities',
        href: '/vault/sources',
        live: true,
      },
      {
        label: 'Inbox',
        description: 'Hermes and Telegram captures awaiting review',
        href: '/vault/inbox',
        live: true,
      },
      {
        label: 'Wiki candidates (diagnostic)',
        description: 'Internal discovery audit — not the normal Create Wiki(s) path',
        href: '/vault/wiki-candidates',
        live: true,
      },
      {
        label: 'Search',
        description: 'Full-text search across vault nodes',
        href: '/vault/search',
        live: true,
      },
    ],
  },
  {
    id: 'registry',
    label: 'Registry',
    items: [
      {
        label: 'Packages',
        description: 'Pinned favourites and npm package search',
        href: '/registry/packages',
        live: true,
      },
      {
        label: 'Repositories',
        description: 'Pinned favourites and GitHub repository search',
        href: '/registry/repos',
        live: true,
      },
    ],
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    items: [
      {
        label: 'Knowledge Quiz',
        description: 'Static VALD quiz practice sessions and local progress',
        href: '/quiz',
        live: true,
      },
      {
        label: 'Wikis',
        description: 'Reviewed wiki pages promoted from vault drafts',
        href: '/knowledge/wikis',
        live: true,
      },
    ],
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    items: [
      {
        label: 'Ingest YouTube',
        description: 'Fetch a transcript and store it as a vault node',
        href: '/ingest',
        live: true,
      },
      {
        label: 'Ingest Article',
        description: 'Ingest a web article or blog post as a resource node',
        // Articles share the canonical /ingest form — there is no separate article page.
        href: '/ingest',
        live: true,
      },
      {
        label: 'Ingest Document',
        description: 'Ingest a local PDF or Office file via liteparse',
        href: '/ingest/document',
        live: false,
      },
      {
        label: 'Re-extract',
        description: 'Re-run LLM extraction on an existing transcript',
        href: '/pipeline/extract',
        live: false,
      },
    ],
  },
  {
    id: 'execute',
    label: 'Execute',
    items: [
      {
        label: 'Runs',
        description: 'Inspect agent execution traces and skill run history',
        href: '/vault/runs',
        live: true,
      },
      {
        label: 'Agent',
        description: 'Trigger a one-shot agent run and view status',
        href: '/agent',
        live: false,
      },
      {
        label: 'Terminal',
        description: 'Command panel — dispatch typed commands with streaming output',
        href: '/terminal',
        live: true,
      },
      {
        label: 'Hermes / MCP',
        description: 'Discord gateway, MCP tools, and operator automation',
        href: '/hermes',
        live: true,
      },
      {
        label: 'Crons',
        description: 'Manual recipe runs and external schedule snippets',
        href: '/crons',
        live: true,
      },
      {
        label: 'Skills',
        description: 'Browse registered skills and their capabilities',
        href: '/execute/skills',
        live: false,
      },
    ],
  },
  {
    id: 'models',
    label: 'Models',
    items: [
      {
        label: 'Status',
        description: 'Task routing map with installed and missing model indicators',
        href: '/llm',
        live: true,
      },
      {
        label: 'Providers',
        description: 'Registered LLM providers, availability, and configuration',
        href: '/llm/providers',
        live: false,
      },
      {
        label: 'Capabilities',
        description: 'Which providers and skills can handle which capabilities',
        href: '/llm/capabilities',
        live: false,
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        label: 'Icons',
        description: 'Open the embedded Lucide picker and manage the icon registry',
        href: '/icons',
        live: true,
      },
      {
        label: 'Doctor',
        description: 'Provider health, binary availability, and capability coverage',
        href: '/system/doctor',
        live: false,
      },
      {
        label: 'Harness',
        description: 'Harness prep pipeline status and extraction boundary inspector',
        href: '/system/harness',
        live: false,
      },
    ],
  },
];

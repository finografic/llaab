import type {
  HermesInboxExecutionResult,
  HermesInboxItem,
  HermesInboxLogEvent,
  HermesInboxReceipt,
  HermesInboxRoute,
  HermesInboxToolCall,
} from '@llaab/schemas';

export function createHermesInboxToolCall(
  route: HermesInboxRoute,
  item?: HermesInboxItem,
): HermesInboxToolCall {
  const source = item?.source;

  switch (route.action) {
    case 'ingest_youtube':
      return {
        name: 'vault_ingest_youtube',
        arguments: {
          url: stringPayload(route, 'url'),
          tags: ['hermes', 'inbox'],
        },
      };
    case 'pin_package':
    case 'pin_library':
      return {
        name: 'vault_pin_package',
        arguments: { name: stringPayload(route, 'package_name') },
      };
    case 'pin_repository':
      return {
        name: 'vault_pin_repository',
        arguments: {
          fullName: repoFullName(route),
          source,
          payload: route.payload,
          route_kind: route.kind,
        },
      };
    case 'capture_todo':
      return {
        name: 'vault_capture_todo',
        arguments: {
          text: stringPayload(route, 'text'),
          source,
        },
      };
    case 'capture_web_link':
      return {
        name: 'vault_capture_web_link',
        arguments: {
          url: stringPayload(route, 'url'),
          kind: route.kind,
          source,
          payload: route.payload,
        },
      };
    case 'capture_attachment':
      return {
        name: 'vault_capture_attachment',
        arguments: {
          attachment: route.payload['attachment'],
          raw_text: stringPayload(route, 'raw_text'),
          route_kind: route.kind,
          source,
          payload: route.payload,
        },
      };
    case 'capture_command_candidate':
      return {
        name: 'vault_capture_inbox',
        arguments: {
          raw_text: stringPayload(route, 'command'),
          route_kind: route.kind,
          source,
          payload: route.payload,
        },
      };
    case 'capture_raw':
      return {
        name: 'vault_capture_inbox',
        arguments: {
          raw_text: stringPayload(route, 'text'),
          route_kind: route.kind,
          source,
          payload: route.payload,
        },
      };
  }
}

export function createHermesInboxReceipt(
  route: HermesInboxRoute,
  result: HermesInboxExecutionResult,
): HermesInboxReceipt {
  if (result.status === 'failed') {
    return {
      status: 'failed',
      text: failedReceiptText(route, result.error),
    };
  }

  const target = result.target_label ?? result.target_id;

  switch (route.action) {
    case 'ingest_youtube':
      return { status: 'queued', text: withTarget('✅ Ingested YouTube video', target) };
    case 'pin_package':
    case 'pin_library':
      return {
        status: 'pinned',
        text: withTarget('✅ Pinned npm package', target ?? stringPayload(route, 'package_name')),
      };
    case 'pin_repository':
      return {
        status: 'pinned',
        text: withTarget('✅ Pinned GitHub repo', target ?? repoFullName(route)),
      };
    case 'capture_todo':
      return { status: 'captured', text: withTarget('✅ Captured todo', target) };
    case 'capture_web_link':
      return { status: 'saved', text: withTarget(webLinkReceiptPrefix(route), target) };
    case 'capture_attachment':
      return { status: 'saved', text: withTarget(attachmentReceiptPrefix(route), target) };
    case 'capture_command_candidate':
      return { status: 'saved', text: withTarget('✅ Saved command candidate', target) };
    case 'capture_raw':
      return { status: 'saved', text: withTarget(rawReceiptPrefix(route), target) };
  }
}

function webLinkReceiptPrefix(route: HermesInboxRoute): string {
  switch (route.kind) {
    case 'github_repo':
      return '✅ Saved GitHub repo';
    case 'docs_link':
      return '✅ Saved docs link';
    case 'post_link':
      return '✅ Saved post link';
    case 'code_link':
      return '✅ Saved code link';
    case 'web_link':
      return '✅ Saved link';
    case 'youtube_url':
    case 'npm_package':
    case 'command_candidate':
    case 'todo':
    case 'attachment':
    case 'image':
    case 'code_attachment':
    case 'docs_attachment':
    case 'code_snippet':
    case 'raw':
      return '✅ Saved link';
  }
}

function attachmentReceiptPrefix(route: HermesInboxRoute): string {
  if (route.kind === 'code_attachment') {
    const attachment = route.payload['attachment'];
    if (isImageAttachment(attachment)) {
      return '✅ Saved code snippet';
    }

    return '✅ Saved code attachment';
  }

  if (route.kind === 'docs_attachment') {
    return '✅ Saved docs attachment';
  }

  return route.kind === 'image' ? '✅ Saved image' : '✅ Saved attachment';
}

function isImageAttachment(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const attachment = value as Record<string, unknown>;
  return attachment['kind'] === 'image';
}

function rawReceiptPrefix(route: HermesInboxRoute): string {
  return route.kind === 'code_snippet' ? '✅ Saved code snippet' : '✅ Saved inbox item';
}

export function createHermesInboxLogEvent(input: {
  route: HermesInboxRoute;
  toolCall?: HermesInboxToolCall;
  receipt: HermesInboxReceipt;
  result: HermesInboxExecutionResult;
}): HermesInboxLogEvent {
  return {
    event: 'hermes_inbox_route',
    route: input.route,
    tool_call: input.toolCall,
    receipt: input.receipt,
    status: input.result.status,
    error: input.result.error,
  };
}

function stringPayload(route: HermesInboxRoute, key: string): string {
  const value = route.payload[key];

  return typeof value === 'string' ? value : '';
}

function repoFullName(route: HermesInboxRoute): string {
  const owner = stringPayload(route, 'owner');
  const repo = stringPayload(route, 'repo');

  return owner && repo ? `${owner}/${repo}` : '';
}

function withTarget(prefix: string, target: string | undefined): string {
  return target ? `${prefix}: ${target}` : prefix;
}

function failedReceiptText(route: HermesInboxRoute, error: string | undefined): string {
  const detail = error ?? route.kind;

  switch (route.action) {
    case 'ingest_youtube':
      return `❌ Failed YouTube ingest: ${detail}`;
    case 'pin_package':
    case 'pin_library':
      return `❌ Failed npm package pin: ${detail}`;
    case 'pin_repository':
      return `❌ Failed GitHub repo pin: ${detail}`;
    case 'capture_todo':
      return `❌ Failed todo capture: ${detail}`;
    case 'capture_web_link':
      return `❌ Failed link capture: ${detail}`;
    case 'capture_attachment':
      return `❌ Failed attachment save: ${detail}`;
    case 'capture_command_candidate':
      return `❌ Failed command candidate save: ${detail}`;
    case 'capture_raw':
      return route.kind === 'code_snippet'
        ? `❌ Failed code snippet save: ${detail}`
        : `❌ Failed inbox save: ${detail}`;
  }
}

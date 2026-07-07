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
    case 'pin_library':
      return {
        name: 'vault_pin_library',
        arguments: { name: stringPayload(route, 'package_name') },
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
          source,
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
      text: `Inbox failed: ${result.error ?? route.kind}`,
    };
  }

  const target = result.target_label ?? result.target_id;

  switch (route.action) {
    case 'ingest_youtube':
      return { status: 'queued', text: withTarget('Queued YouTube ingest', target) };
    case 'pin_library':
      return {
        status: 'pinned',
        text: withTarget('Pinned library', target ?? stringPayload(route, 'package_name')),
      };
    case 'capture_todo':
      return { status: 'captured', text: withTarget('Captured todo', target) };
    case 'capture_web_link':
      return { status: 'saved', text: withTarget('Saved link', target) };
    case 'capture_attachment':
      return { status: 'saved', text: withTarget('Saved attachment', target) };
    case 'capture_command_candidate':
      return { status: 'saved', text: withTarget('Saved command candidate', target) };
    case 'capture_raw':
      return { status: 'saved', text: withTarget('Saved to inbox', target) };
  }
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

function withTarget(prefix: string, target: string | undefined): string {
  return target ? `${prefix}: ${target}` : prefix;
}

import type { HermesInboxItem, HermesInboxRoute } from '@llaab/schemas';

const TODO_PREFIX_RE = /^\s*todo:\s*/i;
const DOCS_PREFIX_RE = /^\s*docs:\s*/i;
const POST_PREFIX_RE = /^\s*post:\s*/i;
const CODE_PREFIX_RE = /^\s*code:\s*/i;
const COMMAND_CANDIDATE_RE = /^\s*(?:npx|npmx|pnpm\s+dlx)\s+\S+/i;
const URL_CANDIDATE_RE = /https?:\/\/[^\s<>"')\]]+/i;
const CODE_FILE_LANGUAGE_BY_EXTENSION = new Map<string, string>([
  ['astro', 'astro'],
  ['cjs', 'javascript'],
  ['css', 'css'],
  ['go', 'go'],
  ['html', 'html'],
  ['java', 'java'],
  ['js', 'javascript'],
  ['json', 'json'],
  ['json5', 'json'],
  ['jsonc', 'jsonc'],
  ['jsx', 'tsx'],
  ['mjs', 'javascript'],
  ['py', 'python'],
  ['rs', 'rust'],
  ['scss', 'scss'],
  ['sh', 'shell'],
  ['sql', 'sql'],
  ['svelte', 'svelte'],
  ['toml', 'toml'],
  ['ts', 'typescript'],
  ['tsx', 'tsx'],
  ['vue', 'vue'],
  ['yaml', 'yaml'],
  ['yml', 'yaml'],
]);

export function routeHermesInboxItem(item: HermesInboxItem): HermesInboxRoute {
  const rawText = item.raw_text?.trim();
  const attachment = item.attachments[0];

  if (rawText) {
    const codeAttachmentLabel = attachment ? prefixedLine(rawText, CODE_PREFIX_RE) : undefined;
    if (attachment && codeAttachmentLabel !== undefined) {
      return {
        kind: 'code_attachment',
        confidence: 0.96,
        action: 'capture_attachment',
        payload: {
          attachment,
          raw_text: rawText,
          label: codeAttachmentLabel,
          language: languageForAttachment(attachment),
        },
        reason: 'Message has an attachment and includes a code: caption.',
      };
    }

    const docsAttachmentLabel = attachment ? prefixedLine(rawText, DOCS_PREFIX_RE) : undefined;
    if (attachment && docsAttachmentLabel !== undefined) {
      return {
        kind: 'docs_attachment',
        confidence: 0.95,
        action: 'capture_attachment',
        payload: { attachment, raw_text: rawText, label: docsAttachmentLabel },
        reason: 'Message has an attachment and includes a docs: caption.',
      };
    }

    if (!attachment) {
      return routeHermesInboxText(rawText);
    }

    return {
      kind: attachmentRouteKind(attachment),
      confidence: 0.9,
      action: 'capture_attachment',
      payload: attachmentPayload(attachment, rawText),
      reason:
        attachmentRouteKind(attachment) === 'code_attachment'
          ? 'Message has a recognized code file attachment.'
          : 'Message has an attachment and unstructured text.',
    };
  }

  if (attachment) {
    return {
      kind: attachmentRouteKind(attachment),
      confidence: 0.9,
      action: 'capture_attachment',
      payload: attachmentPayload(attachment),
      reason:
        attachmentRouteKind(attachment) === 'code_attachment'
          ? 'Message has a recognized code file attachment.'
          : 'Message has an attachment and no text.',
    };
  }

  return captureRaw('', 'Message has no text or attachments.');
}

export function routeHermesInboxText(rawText: string): HermesInboxRoute {
  const text = rawText.trim();

  if (!text) {
    return captureRaw(rawText, 'Message text is empty.');
  }

  if (TODO_PREFIX_RE.test(text)) {
    return {
      kind: 'todo',
      confidence: 0.98,
      action: 'capture_todo',
      payload: { text: text.replace(TODO_PREFIX_RE, '').trim() },
      reason: 'Message uses the todo: prefix.',
    };
  }

  const codeText = stripPrefix(text, CODE_PREFIX_RE);
  if (codeText) {
    const codeUrl = extractFirstUrl(codeText);
    if (codeUrl) {
      const githubBlob = parseGitHubBlobUrl(codeUrl);
      return {
        kind: 'code_link',
        confidence: githubBlob ? 0.96 : 0.86,
        action: 'capture_web_link',
        payload: githubBlob ?? {
          url: codeUrl.href,
          link_type: 'code_reference',
        },
        reason: githubBlob
          ? 'Message uses code: prefix with a GitHub blob URL.'
          : 'Message uses code: prefix with a URL.',
      };
    }

    return {
      kind: 'code_snippet',
      confidence: 0.94,
      action: 'capture_raw',
      payload: {
        text: codeText,
        language: detectCodeLanguage(codeText),
      },
      reason: 'Message uses the code: prefix without a URL.',
    };
  }

  const docsText = stripPrefix(text, DOCS_PREFIX_RE);
  if (docsText) {
    const docsUrl = extractFirstUrl(docsText);
    return docsUrl
      ? {
          kind: 'docs_link',
          confidence: 0.95,
          action: 'capture_web_link',
          payload: { url: docsUrl.href, label: docsText },
          reason: 'Message uses the docs: prefix.',
        }
      : captureRaw(text, 'Message uses docs: prefix without a URL.');
  }

  const postText = stripPrefix(text, POST_PREFIX_RE);
  if (postText) {
    const postUrl = extractFirstUrl(postText);
    return postUrl
      ? {
          kind: 'post_link',
          confidence: 0.95,
          action: 'capture_web_link',
          payload: { url: postUrl.href, label: postText },
          reason: 'Message uses the post: prefix.',
        }
      : captureRaw(text, 'Message uses post: prefix without a URL.');
  }

  if (COMMAND_CANDIDATE_RE.test(text)) {
    return {
      kind: 'command_candidate',
      confidence: 0.92,
      action: 'capture_command_candidate',
      payload: { command: text },
      reason: 'Message starts with npx, npmx, or pnpm dlx.',
    };
  }

  const codeLanguage = detectCodeLanguage(text);
  if (codeLanguage) {
    return {
      kind: 'code_snippet',
      confidence: 0.82,
      action: 'capture_raw',
      payload: { text, language: codeLanguage },
      reason: 'Message looks like pasted source code.',
    };
  }

  const url = extractFirstUrl(text);

  if (!url) {
    return captureRaw(text, 'No deterministic URL or prefix route matched.');
  }

  const youtubeUrl = parseYouTubeUrl(url);

  if (youtubeUrl) {
    return {
      kind: 'youtube_url',
      confidence: 0.98,
      action: 'ingest_youtube',
      payload: youtubeUrl,
      reason: 'URL matches a supported YouTube shape.',
    };
  }

  const npmPackage = parseNpmPackageUrl(url);

  if (npmPackage) {
    return {
      kind: 'npm_package',
      confidence: 0.97,
      action: 'pin_package',
      payload: npmPackage,
      reason: 'URL matches a supported npm package URL.',
    };
  }

  const githubRepo = parseGitHubRepoUrl(url);

  if (githubRepo) {
    return {
      kind: 'github_repo',
      confidence: 0.95,
      action: 'pin_repository',
      payload: githubRepo,
      reason: 'URL matches a GitHub repository and should be pinned.',
    };
  }

  return {
    kind: 'web_link',
    confidence: 0.8,
    action: 'capture_web_link',
    payload: { url: url.href },
    reason: 'URL is a generic web link.',
  };
}

function extractFirstUrl(text: string): URL | undefined {
  const match = text.match(URL_CANDIDATE_RE);

  if (!match?.[0]) {
    return undefined;
  }

  try {
    return new URL(match[0].replace(/[.,;:!?]+$/u, ''));
  } catch {
    return undefined;
  }
}

function stripPrefix(text: string, prefix: RegExp): string | undefined {
  if (!prefix.test(text)) {
    return undefined;
  }

  return text.replace(prefix, '').trim();
}

function prefixedLine(text: string, prefix: RegExp): string | undefined {
  for (const line of text.split(/\r?\n/u)) {
    const stripped = stripPrefix(line.trim(), prefix);
    if (stripped !== undefined) {
      return stripped;
    }
  }

  return undefined;
}

function parseYouTubeUrl(url: URL): { url: string; video_id?: string } | undefined {
  const hostname = url.hostname.toLowerCase().replace(/^www\./u, '');

  if (hostname === 'youtu.be') {
    const videoId = firstPathSegment(url);
    return videoId ? { url: url.href, video_id: videoId } : { url: url.href };
  }

  if (hostname !== 'youtube.com' && hostname !== 'm.youtube.com') {
    return undefined;
  }

  if (url.pathname === '/watch') {
    const videoId = url.searchParams.get('v') ?? undefined;
    return videoId ? { url: url.href, video_id: videoId } : { url: url.href };
  }

  if (url.pathname.startsWith('/shorts/')) {
    const videoId = url.pathname.split('/').filter(Boolean)[1];
    return videoId ? { url: url.href, video_id: videoId } : { url: url.href };
  }

  return undefined;
}

function parseNpmPackageUrl(url: URL): { package_name: string; url: string } | undefined {
  const hostname = url.hostname.toLowerCase().replace(/^www\./u, '');

  if ((hostname !== 'npmjs.com' && hostname !== 'npmx.dev') || !url.pathname.startsWith('/package/')) {
    return undefined;
  }

  const packagePath = url.pathname
    .replace(/^\/package\//u, '')
    .split('/')
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => decodeURIComponent(segment));

  if (packagePath.length === 0) {
    return undefined;
  }

  const packageName = packagePath[0]?.startsWith('@') ? packagePath.join('/') : packagePath[0];

  return packageName ? { package_name: packageName, url: url.href } : undefined;
}

function parseGitHubRepoUrl(url: URL): { owner: string; repo: string; url: string } | undefined {
  const hostname = url.hostname.toLowerCase().replace(/^www\./u, '');

  if (hostname !== 'github.com') {
    return undefined;
  }

  const [owner, repo] = url.pathname.split('/').filter(Boolean);

  if (!owner || !repo) {
    return undefined;
  }

  return { owner, repo: repo.replace(/\.git$/u, ''), url: url.href };
}

function parseGitHubBlobUrl(
  url: URL,
):
  | { owner: string; repo: string; ref: string; file_path: string; language?: string; url: string }
  | undefined {
  const hostname = url.hostname.toLowerCase().replace(/^www\./u, '');

  if (hostname !== 'github.com') {
    return undefined;
  }

  const [owner, repo, marker, ref, ...pathParts] = url.pathname.split('/').filter(Boolean);

  if (!owner || !repo || marker !== 'blob' || !ref || pathParts.length === 0) {
    return undefined;
  }

  const filePath = pathParts.map((part) => decodeURIComponent(part)).join('/');

  return {
    owner,
    repo,
    ref,
    file_path: filePath,
    language: languageForFilename(filePath),
    url: url.href,
  };
}

function attachmentRouteKind(attachment: HermesInboxItem['attachments'][number]): HermesInboxRoute['kind'] {
  if (attachment.kind === 'image') {
    return 'image';
  }

  return languageForAttachment(attachment) ? 'code_attachment' : 'attachment';
}

function attachmentPayload(
  attachment: HermesInboxItem['attachments'][number],
  rawText?: string,
): Record<string, unknown> {
  const language = languageForAttachment(attachment);

  return {
    attachment,
    ...(rawText ? { raw_text: rawText } : {}),
    ...(language ? { language } : {}),
  };
}

function languageForAttachment(attachment: HermesInboxItem['attachments'][number]): string | undefined {
  return languageForFilename(attachment.file_name ?? attachment.local_path ?? '');
}

function languageForFilename(filename: string): string | undefined {
  const extension = filename
    .split(/[./\\]/u)
    .at(-1)
    ?.toLowerCase();
  return extension ? CODE_FILE_LANGUAGE_BY_EXTENSION.get(extension) : undefined;
}

function detectCodeLanguage(text: string): string | undefined {
  const trimmed = text.trim();

  if (/<[A-Z][\w.:-]*(?:\s|>|\/>)/u.test(trimmed) || /className=/u.test(trimmed)) {
    return 'tsx';
  }

  if (
    /^\s*(?:import|export)\s+/mu.test(trimmed) ||
    /\b(?:interface|type)\s+\w+\s*[=<{]/u.test(trimmed) ||
    /^\s*(?:const|let|var)\s+\w+\s*:\s*\w+/mu.test(trimmed)
  ) {
    return 'typescript';
  }

  if (/^\s*(?:const|let|var|function)\s+\w+/mu.test(trimmed)) {
    return 'javascript';
  }

  if (/^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\s+/imu.test(trimmed)) {
    return 'sql';
  }

  if (
    /^#!\/.*\b(?:bash|sh|zsh)\b/u.test(trimmed) ||
    /^\s*(?:set -e|echo\s+|cd\s+|mkdir\s+)/mu.test(trimmed)
  ) {
    return 'shell';
  }

  return undefined;
}

function firstPathSegment(url: URL): string | undefined {
  return url.pathname.split('/').filter(Boolean)[0];
}

function captureRaw(text: string, reason: string): HermesInboxRoute {
  return {
    kind: 'raw',
    confidence: 0.5,
    action: 'capture_raw',
    payload: { text },
    reason,
  };
}

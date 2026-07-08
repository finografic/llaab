import type { HermesInboxItem, HermesInboxRoute } from '@llaab/schemas';

const TODO_PREFIX_RE = /^\s*todo:\s*/i;
const COMMAND_CANDIDATE_RE = /^\s*(?:npx|npmx|pnpm\s+dlx)\s+\S+/i;
const URL_CANDIDATE_RE = /https?:\/\/[^\s<>"')\]]+/i;

export function routeHermesInboxItem(item: HermesInboxItem): HermesInboxRoute {
  const rawText = item.raw_text?.trim();
  const attachment = item.attachments[0];

  if (rawText) {
    const textRoute = routeHermesInboxText(rawText);
    if (!attachment || textRoute.action !== 'capture_raw') {
      return textRoute;
    }

    return {
      kind: 'attachment',
      confidence: 0.9,
      action: 'capture_attachment',
      payload: { attachment, raw_text: rawText },
      reason: 'Message has an attachment and unstructured text.',
    };
  }

  if (attachment) {
    return {
      kind: 'attachment',
      confidence: 0.9,
      action: 'capture_attachment',
      payload: { attachment },
      reason: 'Message has an attachment and no text.',
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

  if (COMMAND_CANDIDATE_RE.test(text)) {
    return {
      kind: 'command_candidate',
      confidence: 0.92,
      action: 'capture_command_candidate',
      payload: { command: text },
      reason: 'Message starts with npx, npmx, or pnpm dlx.',
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
      action: 'pin_library',
      payload: npmPackage,
      reason: 'URL matches npmjs.com/package.',
    };
  }

  const githubRepo = parseGitHubRepoUrl(url);

  if (githubRepo) {
    return {
      kind: 'github_repo',
      confidence: 0.88,
      action: 'capture_web_link',
      payload: githubRepo,
      reason: 'URL matches a GitHub repository.',
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

  if (hostname !== 'npmjs.com' || !url.pathname.startsWith('/package/')) {
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

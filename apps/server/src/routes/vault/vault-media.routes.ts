import { readFile, realpath } from 'node:fs/promises';
import { basename, extname, resolve, sep } from 'node:path';
import type { AppCtxJson, AppCtxQuery } from '../../types/app.types.js';
import type { CodeHighlightBody, MediaQuery } from './vault.schema.js';

import { renderCodeToHtml } from '../../lib/readme-renderer.js';

const HERMES_IMAGE_CACHE_ROOT = resolve(
  process.env['HERMES_IMAGE_CACHE_ROOT'] ?? `${process.env['HOME']}/.hermes/image_cache`,
);

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export const codeHighlight = {
  path: '/code-highlight' as const,
  handler: async (c: AppCtxJson<CodeHighlightBody>) => {
    const { code, language } = c.req.valid('json');
    const html = await renderCodeToHtml(code, language);
    return c.json({ html });
  },
};

export const media = {
  path: '/media' as const,
  handler: async (c: AppCtxQuery<MediaQuery>) => {
    const { path } = c.req.valid('query');
    const resolved = resolve(path);
    const root = await realpath(HERMES_IMAGE_CACHE_ROOT);
    const real = await realpath(resolved);

    if (real !== root && !real.startsWith(root + sep)) {
      return c.json({ error: 'Invalid media path.' }, 403);
    }

    const contentType = IMAGE_MIME_BY_EXT[extname(real).toLowerCase()];
    if (!contentType) {
      return c.json({ error: 'Unsupported media type.' }, 415);
    }

    const data = await readFile(real);
    return c.body(data, 200, {
      'Content-Disposition': `inline; filename="${basename(real).replaceAll('"', '')}"`,
      'Content-Type': contentType,
    });
  },
};

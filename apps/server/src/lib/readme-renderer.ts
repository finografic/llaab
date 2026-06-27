import { Renderer, marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { getSingletonHighlighter } from 'shiki';
import type { Tokens } from 'marked';

const SHIKI_LANGS = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'json',
  'jsonc',
  'html',
  'css',
  'scss',
  'bash',
  'shell',
  'yaml',
  'markdown',
  'python',
  'rust',
  'go',
  'diff',
  'text',
] as const;

type ShikiLang = (typeof SHIKI_LANGS)[number];

async function getHighlighter() {
  return getSingletonHighlighter({ themes: ['github-dark'], langs: [...SHIKI_LANGS] });
}

async function highlight(code: string, lang: string): Promise<string> {
  const hl = await getHighlighter();
  const supported = hl.getLoadedLanguages() as string[];
  const safeLang: ShikiLang = supported.includes(lang) ? (lang as ShikiLang) : 'text';
  return hl.codeToHtml(code, { lang: safeLang, theme: 'github-dark' });
}

/** Render a raw readme markdown string to sanitized HTML with syntax-highlighted code blocks. */
export async function renderReadmeToHtml(markdown: string): Promise<string> {
  // Pre-render all code blocks asynchronously before the synchronous marked pass
  const tokens = marked.lexer(markdown);
  const highlightedBlocks = new Map<string, string>();

  // walkTokens returns void | Promise<void>; wrap so await is always on a thenable
  await Promise.resolve(
    marked.walkTokens(tokens, async (token) => {
      if (token.type === 'code') {
        const t = token as Tokens.Code;
        const lang = (t.lang ?? '').split(/[ ,]/)[0] ?? '';
        const key = `${lang}::${t.text}`;
        if (!highlightedBlocks.has(key)) {
          highlightedBlocks.set(key, await highlight(t.text, lang || 'text'));
        }
      }
    }),
  );

  const renderer = new Renderer();
  renderer.code = ({ text, lang }: Tokens.Code) => {
    const key = `${(lang ?? '').split(/[ ,]/)[0] ?? ''}::${text}`;
    return highlightedBlocks.get(key) ?? `<pre><code>${sanitizeHtml(text)}</code></pre>`;
  };

  const raw = marked.parse(markdown, { renderer }) as string;

  return sanitizeHtml(raw, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'span',
      'details',
      'summary',
      'picture',
      'source',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'style', 'id', 'tabindex'],
      'a': ['href', 'name', 'target', 'rel'],
      'img': ['src', 'alt', 'width', 'height', 'loading'],
      'td': ['align'],
      'th': ['align'],
      'source': ['srcset', 'media', 'type'],
    },
  });
}

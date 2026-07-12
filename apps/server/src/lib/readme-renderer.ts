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
  'shellscript',
  'yaml',
  'markdown',
  'python',
  'rust',
  'go',
  'diff',
  'text',
] as const;

type ShikiLang = (typeof SHIKI_LANGS)[number];

/** Common fence aliases → loaded Shiki language ids. */
const LANG_ALIASES: Record<string, ShikiLang> = {
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  json: 'json',
  jsonc: 'jsonc',
  html: 'html',
  css: 'css',
  scss: 'scss',
  bash: 'bash',
  sh: 'shellscript',
  shell: 'shellscript',
  zsh: 'shellscript',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
  py: 'python',
  python: 'python',
  rust: 'rust',
  rs: 'rust',
  go: 'go',
  diff: 'diff',
  text: 'text',
  plain: 'text',
  plaintext: 'text',
};

async function getHighlighter() {
  return getSingletonHighlighter({ themes: ['github-dark'], langs: [...SHIKI_LANGS] });
}

function resolveLang(raw: string | undefined): ShikiLang {
  const lang =
    (raw ?? '')
      .split(/[ ,:;]/)[0]
      ?.trim()
      .toLowerCase() ?? '';
  if (!lang) return 'text';
  return LANG_ALIASES[lang] ?? 'text';
}

export async function renderCodeToHtml(code: string, lang: string | undefined): Promise<string> {
  const hl = await getHighlighter();
  const safeLang = resolveLang(lang);
  return hl.codeToHtml(code, { lang: safeLang, theme: 'github-dark' });
}

/** Render a raw readme markdown string to sanitized HTML with syntax-highlighted code blocks. */
export async function renderReadmeToHtml(markdown: string): Promise<string> {
  const tokens = marked.lexer(markdown);
  const highlightedBlocks = new Map<string, string>();
  const highlightJobs: Array<Promise<void>> = [];

  // walkTokens does not await async callbacks — collect jobs and await them explicitly.
  marked.walkTokens(tokens, (token) => {
    if (token.type !== 'code') return;
    const t = token as Tokens.Code;
    const lang = (t.lang ?? '').split(/[ ,:;]/)[0] ?? '';
    const key = `${lang}::${t.text}`;
    if (highlightedBlocks.has(key)) return;
    highlightedBlocks.set(key, ''); // reserve key so duplicate fences share one job
    highlightJobs.push(
      renderCodeToHtml(t.text, t.lang).then((html) => {
        highlightedBlocks.set(key, html);
      }),
    );
  });

  await Promise.all(highlightJobs);

  const renderer = new Renderer();
  renderer.code = ({ text, lang }: Tokens.Code) => {
    const key = `${(lang ?? '').split(/[ ,:;]/)[0] ?? ''}::${text}`;
    return highlightedBlocks.get(key) || `<pre><code>${sanitizeHtml(text)}</code></pre>`;
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
      'pre': ['class', 'style', 'tabindex'],
      'code': ['class', 'style'],
    },
  });
}

import { describe, expect, it } from 'vitest';

import { parseFrontmatter } from './parse-frontmatter.utils.js';

describe('parseFrontmatter', () => {
  it('parses scalar arrays', () => {
    const { frontmatter } = parseFrontmatter(`---
tags:
  - run
  - ingest-youtube
---
`);

    expect(frontmatter.tags).toEqual(['run', 'ingest-youtube']);
  });

  it('parses object arrays written as indented YAML blocks', () => {
    const { frontmatter } = parseFrontmatter(`---
profiles:
  - platform: "github"
    url: "https://github.com/t3dotgg"
    handle: "t3dotgg"
---
`);

    expect(frontmatter.profiles).toEqual([
      {
        platform: 'github',
        url: 'https://github.com/t3dotgg',
        handle: 't3dotgg',
      },
    ]);
  });

  it('parses JSON-encoded object arrays on one line', () => {
    const { frontmatter } = parseFrontmatter(`---
profiles: [{"platform":"github","url":"https://github.com/t3dotgg","handle":"t3dotgg"}]
---
`);

    expect(frontmatter.profiles).toEqual([
      {
        platform: 'github',
        url: 'https://github.com/t3dotgg',
        handle: 't3dotgg',
      },
    ]);
  });

  it('un-escapes a JSON-stringified scalar instead of just stripping outer quotes', () => {
    // Mirrors how `serializeFrontmatterValue` writes a plain string field: JSON.stringify(value).
    const original = '{"transcriptId":"recursive-self-improvement","mode":"single-26b"}';
    const written = `input_summary: ${JSON.stringify(original)}`;
    const { frontmatter } = parseFrontmatter(`---\n${written}\n---\n`);

    expect(frontmatter.input_summary).toBe(original);
  });

  it('stays stable across repeated read-modify-write cycles (no compounding escapes)', () => {
    let value = '{"transcriptId":"x","mode":"single-26b"}';

    for (let cycle = 0; cycle < 5; cycle++) {
      const written = `input_summary: ${JSON.stringify(value)}`;
      const { frontmatter } = parseFrontmatter(`---\n${written}\n---\n`);
      value = frontmatter.input_summary as string;
    }

    expect(value).toBe('{"transcriptId":"x","mode":"single-26b"}');
  });
});

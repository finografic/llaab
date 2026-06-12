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
});

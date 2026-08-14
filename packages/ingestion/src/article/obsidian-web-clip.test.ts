import { describe, expect, it } from 'vitest';

import { parseObsidianWebClip } from './obsidian-web-clip.js';

const CLIP = `---
title: "Solution Architect's Responsibilities and Guiding Principles - Microsoft Azure Well-Architected Framework"
source: "https://learn.microsoft.com/en-us/azure/well-architected/architect-role/fundamentals"
author:
  - "[[ckittel]]"
published: 2026-01-14
created: 2026-08-14
description: "Learn guiding principles that Well-Architected architects should follow to be effective in their function."
tags:
  - "clippings"
---
## Solution Architect's Responsibilities and Guiding Principles

A cloud solution architect is responsible for translating requirements into technical plans.
`;

describe('parseObsidianWebClip', () => {
  it('maps Obsidian Web Clipper Markdown to fetched article content', () => {
    const parsed = parseObsidianWebClip(CLIP);

    expect(parsed.tags).toEqual(['clippings']);
    expect(parsed.article).toMatchObject({
      requestedUrl: 'https://learn.microsoft.com/en-us/azure/well-architected/architect-role/fundamentals',
      canonicalUrl: 'https://learn.microsoft.com/en-us/azure/well-architected/architect-role/fundamentals',
      finalUrl: 'https://learn.microsoft.com/en-us/azure/well-architected/architect-role/fundamentals',
      title:
        "Solution Architect's Responsibilities and Guiding Principles - Microsoft Azure Well-Architected Framework",
      byline: 'ckittel',
      siteName: 'learn.microsoft.com',
      publishedAt: '2026-01-14T00:00:00.000Z',
    });
    expect(parsed.article.markdown).toContain('## Solution Architect');
    expect(parsed.article.plainText).toContain('cloud solution architect');
    expect(parsed.article.contentHash).toMatch(/^[\da-f]{64}$/);
  });

  it('rejects clips without a source URL', () => {
    expect(() => parseObsidianWebClip('---\ntitle: "No source"\n---\nBody')).toThrow('missing a source URL');
  });
});

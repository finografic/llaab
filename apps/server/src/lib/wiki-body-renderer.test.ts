import { describe, expect, it } from 'vitest';

import {
  prepareWikiBodyMarkdown,
  renderWikiBodyToHtml,
  renderWikiSectionsToHtml,
  sourceRefHref,
} from './wiki-body-renderer.js';

describe('wiki-body-renderer', () => {
  it('maps source refs to internal vault paths', () => {
    expect(
      sourceRefHref({
        id: 'ref-1',
        kind: 'transcript',
        node_id: 'ep-72',
      }),
    ).toBe('/vault/transcripts/ep-72');
    expect(
      sourceRefHref({
        id: 'canonical-1',
        kind: 'canonical-idea',
      }),
    ).toBe('/vault/nodes/canonical-1');
  });

  it('strips section markers and rewrites citations to numbered links', () => {
    const markdown = [
      '<!-- wiki-section:overview -->',
      '',
      '## Overview',
      '',
      'Claim.[^ref-a] More.[^ref-a] Other.[^ref-b]',
    ].join('\n');
    const prepared = prepareWikiBodyMarkdown(markdown, [
      {
        id: 'ref-a',
        kind: 'transcript',
        node_id: 'ep-72',
        title: 'Episode',
        locator: '11:42',
      },
      {
        id: 'ref-b',
        kind: 'canonical-idea',
        title: 'Idea',
      },
    ]);
    expect(prepared).not.toContain('wiki-section');
    expect(prepared).toContain('href="/vault/transcripts/ep-72"');
    expect(prepared).toContain('[1: 11:42]');
    expect(prepared).toContain('href="/vault/nodes/ref-b"');
    expect(prepared).toContain('[2]');
    expect(prepared.match(/\[1: 11:42\]/g)).toHaveLength(2);
  });

  it('renders sanitized HTML with working citation links', async () => {
    const html = await renderWikiBodyToHtml(
      '<!-- wiki-section:overview -->\n\n## Overview\n\nClaim.[^ref-a]',
      [
        {
          id: 'ref-a',
          kind: 'transcript',
          node_id: 'ep-72',
          title: 'Episode',
          locator: '11:42',
        },
      ],
    );
    expect(html).toContain('<h2');
    expect(html).toContain('Overview');
    expect(html).toContain('href="/vault/transcripts/ep-72"');
    expect(html).toContain('wiki-cite');
    expect(html).not.toContain('wiki-section');
  });

  it('renders stable sections independently for review controls', async () => {
    const sections = await renderWikiSectionsToHtml(
      '<!-- wiki-section:first -->\n\n## First heading\n\nFirst.[^ref-a]\n\n<!-- wiki-section:second -->\n\n## Second heading\n\nSecond.[^ref-a]',
      [{ id: 'ref-a', kind: 'transcript', node_id: 'ep-72' }],
    );
    expect(sections.map(({ id, heading }) => ({ id, heading }))).toEqual([
      { id: 'first', heading: 'First heading' },
      { id: 'second', heading: 'Second heading' },
    ]);
    expect(sections[0]?.html).toContain('First');
    expect(sections[0]?.html).not.toContain('Second');
  });
});

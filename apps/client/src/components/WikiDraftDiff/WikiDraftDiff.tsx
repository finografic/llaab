import { PatchDiff } from '@pierre/diffs/react';
import { Col, Row } from 'components/ui/grid';
import { createTwoFilesPatch } from 'diff';
import { useKnowledgeWiki } from 'queries/knowledge';
import { useMemo } from 'react';

import { PIERRE_DIFFS_THEME_STYLE } from 'constants/pierre-diffs-theme';

interface WikiDraftDiffProps {
  targetWikiId: string;
  resultingBody: string;
}

export function WikiDraftDiff({ targetWikiId, resultingBody }: WikiDraftDiffProps) {
  const current = useKnowledgeWiki(targetWikiId);
  const patch = useMemo(
    () =>
      current.data
        ? createTwoFilesPatch(
            `${targetWikiId}.md`,
            `${targetWikiId}.md`,
            current.data.wiki.body,
            resultingBody,
            'promoted',
            'proposed',
          )
        : undefined,
    [current.data, resultingBody, targetWikiId],
  );

  return (
    <Row className="rounded-md border border-border">
      <Col>
        {current.isLoading ? <p className="p-3 text-sm text-muted-foreground">Loading update diff…</p> : null}
        {current.error ? <p className="p-3 text-sm text-destructive">{current.error.message}</p> : null}
        {patch ? (
          <PatchDiff
            patch={patch}
            style={{ ...PIERRE_DIFFS_THEME_STYLE, height: 'auto' }}
            options={{ diffStyle: 'unified', diffIndicators: 'bars', overflow: 'wrap', themeType: 'dark' }}
          />
        ) : null}
      </Col>
    </Row>
  );
}

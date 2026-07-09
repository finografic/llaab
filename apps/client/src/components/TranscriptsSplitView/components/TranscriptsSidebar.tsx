import { BadgeCheckIcon } from '@llaab/icons';
import { cn } from '@llaab/ui/lib/utils';
import { ExtractionModelCard } from 'components/ExtractionModelCard';
import { Col, Container, Row } from 'components/ui/grid';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
} from 'components/ui/sidebar';
import { usePersistedUiState } from 'queries/ui-state';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TranscriptNode } from '@llaab/schemas';
import type { ChangeEvent } from 'react';

import { fmtListDateNumeric } from '../transcript-split.utils';
import { AuthorFilter } from './AuthorFilter';

export interface TranscriptsSidebarProps {
  transcripts: TranscriptNode[];
  selectedId?: string;
}

function transcriptAuthor(transcript: TranscriptNode): string | undefined {
  return transcript.author ?? transcript.source_type;
}

export function TranscriptsSidebar({ transcripts, selectedId }: TranscriptsSidebarProps) {
  const [query, setQuery] = useState('');
  const { value: selectedAuthors, setValue: setSelectedAuthors } = usePersistedUiState<string[]>(
    'transcripts.authorFilter',
    [],
  );

  const authorOptions = useMemo(() => {
    const authors = new Set<string>();
    for (const transcript of transcripts) {
      const author = transcriptAuthor(transcript);
      if (author) authors.add(author);
    }
    return Array.from(authors).toSorted((a, b) => a.localeCompare(b));
  }, [transcripts]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return transcripts.filter((transcript) => {
      if (selectedAuthors.length > 0) {
        const author = transcriptAuthor(transcript);
        if (!author || !selectedAuthors.includes(author)) return false;
      }

      if (!normalized) return true;

      const haystack = [
        transcript.title,
        transcript.author,
        transcript.summary,
        transcript.source_type,
        ...transcript.tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [query, transcripts, selectedAuthors]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="gap-3.5 border-b p-4">
        <div className="flex w-full items-center justify-between">
          <div className="text-base font-medium text-foreground">Transcripts</div>
          <span className="font-mono text-xs text-muted-foreground">{transcripts.length}</span>
        </div>
        <SidebarInput
          placeholder="Search transcripts…"
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
        />
        <AuthorFilter authors={authorOptions} selected={selectedAuthors} onChange={setSelectedAuthors} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            {filtered.length === 0 ? (
              <p className="px-4 text-center text-sm text-muted-foreground">
                {query || selectedAuthors.length > 0
                  ? 'No transcripts match your filters.'
                  : 'No transcripts yet.'}
              </p>
            ) : (
              filtered.map((transcript) => {
                const isActive = transcript.id === selectedId;
                const subtitle = transcriptAuthor(transcript);
                const hasLatency = transcript.llm_duration_ms != null;
                const ideaCount = transcript.extracted_idea_ids.length;
                const isConsolidated = Boolean(transcript.canonical_coverage?.canonical_idea_ids.length);

                return (
                  <Link
                    key={transcript.id}
                    to={`/vault/transcripts/${transcript.id}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex w-full leading-tight border-b hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                    )}
                  >
                    <Container className="py-2">
                      <Row justify="space-between" className="px-3">
                        <Col xs={8} className="text-base line-clamp-2 font-medium py-1">
                          {transcript.title}
                        </Col>
                        <Col xs={4} className="text-sm text-foreground text-right py-2">
                          {subtitle}
                        </Col>

                        {transcript.summary ? (
                          <Col xs={12} className="pb-2">
                            <span className="text-base line-clamp-2 whitespace-normal text-muted-foreground">
                              {transcript.summary}
                            </span>
                          </Col>
                        ) : null}

                        <Col
                          xs={6}
                          className="my-1 self-center text-left text-xs font-mono text-muted-foreground"
                        >
                          {fmtListDateNumeric(transcript.created_at)}
                        </Col>
                        <Col
                          xs={6}
                          className="my-1 flex items-center justify-end gap-1 self-center text-xs font-mono text-muted-foreground"
                        >
                          {isConsolidated ? (
                            <BadgeCheckIcon
                              size={14}
                              className="mr-0.5 shrink-0 text-(--consolidation-text)"
                              aria-label="Canonical ideas consolidated"
                            />
                          ) : (
                            <span aria-hidden className="mr-0.5 inline-block w-3.5 shrink-0" />
                          )}
                          <span
                            className={
                              isConsolidated ? 'font-semibold text-(--consolidation-text)' : 'font-semibold'
                            }
                          >
                            {ideaCount} ideas
                          </span>
                        </Col>
                        <Col xs={12} className="flex items-center justify-end pt-2">
                          {hasLatency ? (
                            <ExtractionModelCard
                              variant="compact-bar"
                              model={transcript.llm_model}
                              provider={transcript.llm_provider}
                              promptTokens={transcript.llm_prompt_tokens}
                              completionTokens={transcript.llm_completion_tokens}
                              durationMs={transcript.llm_duration_ms}
                              showTotalTokens={false}
                            />
                          ) : null}
                        </Col>
                      </Row>
                    </Container>
                  </Link>
                );
              })
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </div>
  );
}

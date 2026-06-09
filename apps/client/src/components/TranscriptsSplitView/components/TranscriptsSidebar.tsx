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
import { useMemo, useState } from 'react';
import type { TranscriptNode } from '@llaab/schemas';
import type { ChangeEvent } from 'react';

import { fmtListDate } from '../transcript-split.utils';

export interface TranscriptsSidebarProps {
  transcripts: TranscriptNode[];
  selectedId?: string;
}

export function TranscriptsSidebar({ transcripts, selectedId }: TranscriptsSidebarProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return transcripts;

    return transcripts.filter((transcript) => {
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
  }, [query, transcripts]);

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
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-0">
          <SidebarGroupContent>
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {query ? 'No transcripts match your search.' : 'No transcripts yet.'}
              </p>
            ) : (
              filtered.map((transcript) => {
                const isActive = transcript.id === selectedId;
                const subtitle = transcript.author ?? transcript.source_type;
                const hasLatency = transcript.llm_duration_ms != null;

                // NEW: V2
                return (
                  <a
                    key={transcript.id}
                    href={`/vault/transcripts/${transcript.id}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex w-full border-b leading-tight last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                    )}
                  >
                    <Container className="py-2">
                      <Row justify="space-between" className="px-3">
                        <Col xs={8} className="text-sm">
                          {subtitle}
                        </Col>
                        <Col xs={4} className="text-sm text-muted-foreground text-align-right text-right">
                          + {fmtListDate(transcript.created_at)}
                        </Col>

                        <Col xs={12} className="py-1">
                          <span className="text-md line-clamp-2 font-medium">{transcript.title}</span>
                          {transcript.summary ? (
                            <span className="text-sm line-clamp-2 whitespace-normal text-xs text-muted-foreground">
                              {transcript.summary}
                            </span>
                          ) : null}
                        </Col>

                        <Col xs={12} className="flex items-center justify-end pt-1">
                          {hasLatency ? (
                            <div>
                              <ExtractionModelCard
                                variant="compact"
                                durationMs={transcript.llm_duration_ms}
                              />
                            </div>
                          ) : null}
                        </Col>
                      </Row>
                    </Container>
                  </a>
                );

                // NOTE: V1
                return (
                  <a
                    key={transcript.id}
                    href={`/vault/transcripts/${transcript.id}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex w-full border-b text-sm leading-tight last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                    )}
                  >
                    {/* Left 60%: transcript metadata */}
                    <div className="flex min-w-0 flex-3 flex-col gap-2 p-4 pr-2">
                      <div className="flex w-full items-center gap-2">
                        <span className="truncate">{subtitle}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {fmtListDate(transcript.created_at)}
                        </span>
                      </div>
                      <span className="line-clamp-1 font-medium">{transcript.title}</span>
                      {transcript.summary ? (
                        <span className="line-clamp-2 whitespace-normal text-xs text-muted-foreground">
                          {transcript.summary}
                        </span>
                      ) : null}
                    </div>
                    {/* Right 40%: extraction latency badge */}
                    {hasLatency ? (
                      <div className="flex flex-2 items-center justify-end border-l border-border p-3">
                        <ExtractionModelCard variant="compact" durationMs={transcript.llm_duration_ms} />
                      </div>
                    ) : null}
                  </a>
                );
              })
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </div>
  );
}

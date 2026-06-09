import { ExtractionModelCard } from 'components/ExtractionModelCard';
import { Button } from 'components/ui/button';
import { useState } from 'react';
import type { IdeaNode, TranscriptNode } from '@llaab/schemas';

import { fmtDetailDate, splitTags } from '../transcript-split.utils';
import styles from './TranscriptDetail.module.css';

export interface TranscriptDetailProps {
  transcript: TranscriptNode;
  extractedIdeas: IdeaNode[];
}

export function TranscriptDetail({ transcript, extractedIdeas }: TranscriptDetailProps) {
  const [extractStatus, setExtractStatus] = useState('');
  const [extractStatusClass, setExtractStatusClass] = useState('text-[11px]');
  const [isExtracting, setIsExtracting] = useState(false);

  const { domain, generated } = splitTags(transcript.tags);
  const hasModelMeta = Boolean(
    transcript.llm_model ||
    transcript.llm_provider ||
    transcript.llm_duration_ms != null ||
    transcript.llm_prompt_tokens != null ||
    transcript.llm_completion_tokens != null,
  );

  async function handleReExtract() {
    setIsExtracting(true);
    setExtractStatus('');
    setExtractStatusClass('text-[11px]');

    try {
      const res = await fetch(`/api/vault/transcripts/${transcript.id}/extract`, { method: 'POST' });
      const json = (await res.json()) as { success: boolean; ideaIds?: string[]; error?: string };

      if (json.success) {
        setExtractStatus(`✓ ${json.ideaIds?.length ?? 0} ideas extracted — reloading…`);
        setExtractStatusClass('text-[11px] text-emerald-600 dark:text-emerald-400');
        setTimeout(() => location.reload(), 1200);
      } else {
        setExtractStatus(json.error ?? 'Extraction failed');
        setExtractStatusClass('text-[11px] text-destructive');
        setIsExtracting(false);
      }
    } catch {
      setExtractStatus('Network error');
      setExtractStatusClass('text-[11px] text-destructive');
      setIsExtracting(false);
    }
  }

  return (
    <div className="page-detail flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">Vault</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{transcript.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className={`badge badge--${transcript.source_type}`}>{transcript.source_type}</span>
          {transcript.author ? <span className="meta-text">{transcript.author}</span> : null}
          <span className="meta-sep">·</span>
          <span className="meta-text">{fmtDetailDate(transcript.created_at)}</span>
        </div>
      </header>

      {transcript.tags.length > 0 ? (
        <div className="tags">
          {domain.length > 0 ? (
            <div className="tag-row tag-row--domain">
              {domain.map((tag) => (
                <span key={tag} className="tag" data-tag={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {generated.length > 0 ? (
            <div className="tag-row tag-row--topic">
              {generated.map((tag) => (
                <span key={tag} className="tag" data-tag={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="section">
        <h2 className="section__heading">Source</h2>
        <dl className="meta-grid">
          <dt>URL</dt>
          <dd>
            <a
              href={transcript.source_url}
              className="meta-link meta-mono"
              target="_blank"
              rel="noopener noreferrer"
            >
              {transcript.source_url}
            </a>
          </dd>
          {transcript.source_item_id ? (
            <>
              <dt>Item ID</dt>
              <dd className="meta-mono">{transcript.source_item_id}</dd>
            </>
          ) : null}
          {transcript.source_id ? (
            <>
              <dt>Source node</dt>
              <dd>
                <a href={`/vault/sources/${transcript.source_id}`} className="meta-link">
                  {transcript.source_id}
                </a>
              </dd>
            </>
          ) : null}
          {transcript.raw_length != null ||
          transcript.clean_length != null ||
          transcript.structured_paragraphs != null ? (
            <>
              <dt>Stats</dt>
              <dd>
                <span className={styles.statRow}>
                  {transcript.raw_length != null ? (
                    <span className={styles.stat}>{transcript.raw_length.toLocaleString()} raw chars</span>
                  ) : null}
                  {transcript.clean_length != null ? (
                    <span className={styles.stat}>
                      {transcript.clean_length.toLocaleString()} clean chars
                    </span>
                  ) : null}
                  {transcript.structured_paragraphs != null ? (
                    <span className={styles.stat}>{transcript.structured_paragraphs} §</span>
                  ) : null}
                </span>
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      {hasModelMeta ? (
        <ExtractionModelCard
          variant="full"
          model={transcript.llm_model}
          provider={transcript.llm_provider}
          durationMs={transcript.llm_duration_ms}
          promptTokens={transcript.llm_prompt_tokens}
          completionTokens={transcript.llm_completion_tokens}
        />
      ) : null}

      {transcript.summary ? (
        <section className="section">
          <h2 className="section__heading">Summary</h2>
          <p className="summary-text">{transcript.summary}</p>
        </section>
      ) : null}

      <section className="section">
        <h2 className="section__heading">
          Extracted ideas
          {transcript.extracted_idea_ids.length > 0 ? (
            <span className="section__count">{transcript.extracted_idea_ids.length}</span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-auto cursor-pointer rounded-sm border-border-subtle px-2.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-50"
            disabled={isExtracting}
            onClick={handleReExtract}
          >
            {isExtracting
              ? 'Extracting…'
              : transcript.extracted_idea_ids.length > 0
                ? 'Re-extract'
                : 'Extract now'}
          </Button>
          {extractStatus ? (
            <span className={`normal-case text-[11px] font-normal tracking-normal ${extractStatusClass}`}>
              {extractStatus}
            </span>
          ) : null}
        </h2>

        {transcript.extracted_idea_ids.length === 0 ? (
          <p className={styles.emptyNote}>No ideas extracted yet.</p>
        ) : null}
        {transcript.extracted_idea_ids.length > 0 && extractedIdeas.length > 0 ? (
          <ul className={styles.ideaList}>
            {extractedIdeas.map((idea) => {
              const ideaTags = splitTags(idea.tags);
              return (
                <li key={idea.id} className={styles.ideaItem}>
                  <a href={`/vault/nodes/${idea.id}`} className={styles.ideaLink}>
                    <p className={styles.ideaTitle}>{idea.title}</p>
                    <div className="tags">
                      {ideaTags.domain.length > 0 ? (
                        <span className={`${styles.ideaTags} idea-tags--domain`}>
                          {ideaTags.domain.map((tag) => (
                            <span key={tag} className="tag tag--sm" data-tag={tag}>
                              {tag}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      {ideaTags.generated.length > 0 ? (
                        <span className={`${styles.ideaTags} idea-tags--topic`}>
                          {ideaTags.generated.map((tag) => (
                            <span key={tag} className="tag tag--sm" data-tag={tag}>
                              {tag}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
        {transcript.extracted_idea_ids.length > 0 && extractedIdeas.length === 0 ? (
          <p className={styles.emptyNote}>Ideas listed in IDs but nodes not found in vault.</p>
        ) : null}
      </section>

      {transcript.body ? (
        <section className="section">
          <h2 className="section__heading">Transcript</h2>
          <pre className={`body-pre ${styles.bodyPre}`}>{transcript.body}</pre>
        </section>
      ) : null}
    </div>
  );
}

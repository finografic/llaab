import { Button } from 'components/ui/button';
import { useInboxEnrichment } from 'queries/inbox/useInboxEnrichment';
import { useUpdateVaultNode } from 'queries/vault';
import { toast } from 'sonner';

import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';
import { mergeSuggestedTags } from 'lib/inbox-enrichment.utils';

import styles from './InboxCaptureEnrichment.module.css';

export interface InboxCaptureEnrichmentProps {
  capture: ParsedInboxCapture;
}

export function InboxCaptureEnrichment({ capture }: InboxCaptureEnrichmentProps) {
  const enrich = useInboxEnrichment();
  const updateNode = useUpdateVaultNode();

  return (
    <section className="section">
      <h2 className="section__heading">AI enrichment</h2>
      <p className={styles.note}>
        Opt-in only. Deterministic route kind stays the first pass; enrichment never runs automatically on
        inbox drops.
      </p>
      <div className={styles.actions}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={enrich.isPending}
          onClick={() => {
            enrich.mutate(capture, {
              onError: (err) => {
                toast.error(err instanceof Error ? err.message : 'Enrichment failed.');
              },
              onSuccess: () => {
                toast.success('Enrichment suggestions ready');
              },
            });
          }}
        >
          {enrich.isPending ? 'Enriching…' : 'Suggest categories & tags'}
        </Button>
      </div>

      {enrich.data ? (
        <div className={styles.result}>
          <dl className="meta-grid">
            <dt>Suggested route</dt>
            <dd className="meta-mono">{enrich.data.suggestion.suggested_route_kind ?? '—'}</dd>
            <dt>Link category</dt>
            <dd>{enrich.data.suggestion.link_category ?? '—'}</dd>
            <dt>Markdown kind</dt>
            <dd>{enrich.data.suggestion.markdown_kind ?? '—'}</dd>
            <dt>Code language</dt>
            <dd>{enrich.data.suggestion.code_language ?? '—'}</dd>
            <dt>Destination</dt>
            <dd>{enrich.data.suggestion.destination ?? '—'}</dd>
            <dt>Suggested tags</dt>
            <dd>
              {enrich.data.suggestion.suggested_tags.length
                ? enrich.data.suggestion.suggested_tags.join(', ')
                : '—'}
            </dd>
            <dt>Model</dt>
            <dd className="meta-mono">
              {[enrich.data.provider, enrich.data.model].filter(Boolean).join(' / ') || '—'}
            </dd>
            <dt>Tokens</dt>
            <dd className="meta-mono">
              {enrich.data.usage
                ? `${enrich.data.usage.prompt_tokens ?? '?'} in / ${enrich.data.usage.completion_tokens ?? '?'} out`
                : '—'}
            </dd>
            {enrich.data.suggestion.rationale ? (
              <>
                <dt>Rationale</dt>
                <dd>{enrich.data.suggestion.rationale}</dd>
              </>
            ) : null}
          </dl>
          {enrich.data.suggestion.suggested_tags.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={updateNode.isPending}
              onClick={() => {
                void updateNode
                  .mutateAsync({
                    id: capture.node.id,
                    tags: mergeSuggestedTags(capture.node.tags, enrich.data.suggestion.suggested_tags),
                  })
                  .then(() => toast.success('Applied suggested tags'))
                  .catch((err: unknown) => {
                    toast.error(err instanceof Error ? err.message : 'Failed to apply tags.');
                  });
              }}
            >
              Apply suggested tags
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

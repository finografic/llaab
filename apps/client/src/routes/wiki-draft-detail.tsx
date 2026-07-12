import { PageHero } from 'components/PageHero/PageHero';
import { Button } from 'components/ui/button';
import { Col, Row } from 'components/ui/grid';
import { PageDetail } from 'layouts/PageDetail/PageDetail';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { CheckIcon, PencilIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import {
  useEditWikiDraft,
  usePromoteWikiDraft,
  useRegenerateWikiDraft,
  useRejectWikiDraft,
  useWikiDraft,
} from 'queries/wiki-drafts';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { usePageTitle } from 'lib/use-page-title';

export function WikiDraftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: draft, isLoading, error } = useWikiDraft(id);
  const promote = usePromoteWikiDraft();
  const reject = useRejectWikiDraft();
  const regenerate = useRegenerateWikiDraft();
  const edit = useEditWikiDraft();
  usePageTitle(draft?.title ?? 'Wiki draft');

  if (!id) return <Navigate to="/vault" replace />;
  if (!draft && !isLoading) return <Navigate to="/vault" replace />;

  async function apply(action: 'promote' | 'reject') {
    if (!draft) return;
    try {
      if (action === 'promote') {
        const result = (await promote.mutateAsync(draft.id)) as { wiki?: { id: string } };
        toast.success('Wiki promoted for review in knowledge.');
        if (result.wiki) navigate(`/knowledge/wikis/${result.wiki.id}`);
      } else {
        await reject.mutateAsync(draft.id);
        toast.success('Wiki draft rejected.');
      }
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Wiki review action failed.');
    }
  }

  async function regenerateDraft() {
    if (
      !draft ||
      !window.confirm(
        'Regenerate this draft? The current draft will be superseded after replacement succeeds.',
      )
    )
      {return;}
    try {
      const replacementId = await regenerate.mutateAsync(draft.id);
      toast.success('Replacement wiki draft created.');
      navigate(`/vault/wiki-drafts/${replacementId}`);
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Wiki regeneration failed.');
    }
  }

  async function editDraft() {
    if (!draft) return;
    const title = window.prompt('Wiki draft title', draft.title)?.trim();
    if (!title || title === draft.title) return;
    try {
      await edit.mutateAsync({ id: draft.id, title });
      toast.success('Wiki draft updated.');
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Wiki draft edit failed.');
    }
  }

  return (
    <PageLayout hero={<PageHero eyebrow="Vault review" title={draft?.title ?? 'Loading…'} />}>
      <PageDetail gap="lg">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading wiki draft…</p> : null}
        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
        {draft ? (
          <>
            <Row className="rounded-md border border-border p-3">
              <Col>
                <p className="text-sm text-muted-foreground">
                  {draft.change_summary || 'No summary supplied.'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {draft.operation} · quality {draft.quality_score ?? 'unscored'} · {draft.draft_status}
                </p>
              </Col>
              {draft.draft_status === 'proposed' ? (
                <Col className="flex gap-2">
                  <Button size="sm" onClick={() => void apply('promote')} disabled={promote.isPending}>
                    <CheckIcon aria-hidden="true" /> Promote
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void apply('reject')}
                    disabled={reject.isPending}
                  >
                    <XIcon aria-hidden="true" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void editDraft()}
                    disabled={edit.isPending}
                  >
                    <PencilIcon aria-hidden="true" /> Edit Draft
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void regenerateDraft()}
                    disabled={regenerate.isPending}
                  >
                    <RotateCcwIcon aria-hidden="true" /> Regenerate
                  </Button>
                </Col>
              ) : null}
            </Row>
            <section className="section">
              <h2 className="section__heading">Proposed article</h2>
              <pre className="body-pre">{draft.body}</pre>
            </section>
            <section className="section">
              <h2 className="section__heading">Provenance</h2>
              <p className="text-sm text-muted-foreground">
                {draft.source_canonical_idea_ids.length} canonical ideas ·{' '}
                {draft.source_transcript_ids.length} transcripts · {draft.source_refs.length} source
                references
              </p>
            </section>
            {draft.warning || draft.validation_issues.length > 0 ? (
              <section className="section">
                <h2 className="section__heading">Review warnings</h2>
                <p className="text-sm text-destructive">{draft.warning}</p>
                {draft.validation_issues.map((issue) => (
                  <p key={`${issue.code}-${issue.message}`} className="text-sm text-destructive">
                    {issue.message}
                  </p>
                ))}
              </section>
            ) : null}
          </>
        ) : null}
      </PageDetail>
    </PageLayout>
  );
}

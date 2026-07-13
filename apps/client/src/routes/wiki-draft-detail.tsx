import { PageHero } from 'components/PageHero/PageHero';
import { Button } from 'components/ui/button';
import { Col, Row } from 'components/ui/grid';
import { WikiDraftDiff } from 'components/WikiDraftDiff';
import { PageDetail } from 'layouts/PageDetail/PageDetail';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { CheckIcon, PencilIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import {
  useEditWikiDraft,
  usePromoteWikiDraft,
  useRegenerateWikiDraft,
  useResolveWikiDraft,
  useRejectWikiDraft,
  useWikiDraft,
} from 'queries/wiki-drafts';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { usePageTitle } from 'lib/use-page-title';

import {
  getWikiDraftReviewActions,
  knowledgeWikiDetailPath,
  wikiDraftDetailPath,
} from './wiki-draft-detail.utils';

export function WikiDraftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: draft, isLoading, error } = useWikiDraft(id);
  const promote = usePromoteWikiDraft();
  const reject = useRejectWikiDraft();
  const regenerate = useRegenerateWikiDraft();
  const edit = useEditWikiDraft();
  const resolveTopic = useResolveWikiDraft();
  const reviewActions = draft ? getWikiDraftReviewActions(draft) : [];
  usePageTitle(draft?.title ?? 'Wiki draft');

  if (!id) return <Navigate to="/vault" replace />;
  if (!draft && !isLoading) return <Navigate to="/vault" replace />;

  async function apply(action: 'promote' | 'reject') {
    if (!draft) return;
    try {
      if (action === 'promote') {
        const result = (await promote.mutateAsync(draft.id)) as { wiki?: { id: string } };
        toast.success('Wiki promoted for review in knowledge.');
        if (result.wiki) navigate(knowledgeWikiDetailPath(result.wiki.id));
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
    ) {
      return;
    }
    try {
      const replacementId = await regenerate.mutateAsync(draft.id);
      toast.success('Replacement wiki draft created.');
      navigate(wikiDraftDetailPath(replacementId));
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

  async function resolveDraftTopic() {
    if (!draft || draft.topic_matches.length === 0) return;
    const targetWikiId = window
      .prompt(
        `Choose an existing target (${draft.topic_matches.map((match) => match.wiki_id).join(', ')}) or leave blank to confirm a distinct topic.`,
        draft.topic_matches[0]?.wiki_id,
      )
      ?.trim();
    const distinctTopicKey = targetWikiId
      ? undefined
      : window.prompt('Distinct topic key', draft.topic_key)?.trim();
    if (!targetWikiId && !distinctTopicKey) return;
    try {
      const result = await resolveTopic.mutateAsync({ id: draft.id, targetWikiId, distinctTopicKey });
      toast.success(targetWikiId ? 'Replacement update draft created.' : 'Distinct topic confirmed.');
      if (result.draftId) navigate(wikiDraftDetailPath(result.draftId));
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Wiki topic resolution failed.');
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
              {reviewActions.length > 0 ? (
                <Col className="flex gap-2">
                  {reviewActions.includes('promote') ? (
                    <Button size="sm" onClick={() => void apply('promote')} disabled={promote.isPending}>
                      <CheckIcon aria-hidden="true" /> Promote
                    </Button>
                  ) : null}
                  {reviewActions.includes('reject') ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void apply('reject')}
                      disabled={reject.isPending}
                    >
                      <XIcon aria-hidden="true" /> Reject
                    </Button>
                  ) : null}
                  {reviewActions.includes('edit') ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void editDraft()}
                      disabled={edit.isPending}
                    >
                      <PencilIcon aria-hidden="true" /> Edit Draft
                    </Button>
                  ) : null}
                  {reviewActions.includes('regenerate') ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void regenerateDraft()}
                      disabled={regenerate.isPending}
                    >
                      <RotateCcwIcon aria-hidden="true" /> Regenerate
                    </Button>
                  ) : null}
                </Col>
              ) : null}
            </Row>
            <section className="section">
              <h2 className="section__heading">Proposed article</h2>
              <pre className="body-pre">{draft.body}</pre>
            </section>
            {draft.target_wiki_id && draft.resulting_body ? (
              <section className="section">
                <h2 className="section__heading">Proposed update diff</h2>
                <WikiDraftDiff targetWikiId={draft.target_wiki_id} resultingBody={draft.resulting_body} />
              </section>
            ) : null}
            <section className="section">
              <h2 className="section__heading">Review details</h2>
              <p className="text-sm text-muted-foreground">
                Target:{' '}
                <span className="font-mono">
                  knowledge/wikis/{draft.target_wiki_id ?? draft.topic_key}.md
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Canonical ideas: {draft.source_canonical_idea_ids.join(', ') || 'None'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Run: {draft.run_id ?? 'Unavailable'} · {draft.llm_provider ?? 'unknown'} /{' '}
                {draft.llm_model ?? 'unknown'}
              </p>
              {draft.novelty_reason ? (
                <p className="mt-1 text-sm text-muted-foreground">Novelty: {draft.novelty_reason}</p>
              ) : null}
            </section>
            {draft.topic_matches.length > 0 ? (
              <section className="section">
                <h2 className="section__heading">Possible update targets</h2>
                {draft.topic_matches.map((match) => (
                  <p key={`${match.wiki_id}-${match.kind}`} className="text-sm text-muted-foreground">
                    {match.wiki_id} · {match.kind} · {match.reason}
                  </p>
                ))}
                {reviewActions.includes('resolve-topic') ? (
                  <Button
                    className="mt-2"
                    size="sm"
                    variant="outline"
                    onClick={() => void resolveDraftTopic()}
                    disabled={resolveTopic.isPending}
                  >
                    Resolve topic
                  </Button>
                ) : null}
              </section>
            ) : null}
            <section className="section">
              <h2 className="section__heading">Provenance</h2>
              <p className="text-sm text-muted-foreground">
                {draft.source_canonical_idea_ids.length} canonical ideas ·{' '}
                {draft.source_transcript_ids.length} transcripts · {draft.source_refs.length} source
                references
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {draft.source_refs.map((ref) => (
                  <li key={ref.id}>
                    {ref.url ? (
                      <a className="underline" href={ref.url} target="_blank" rel="noreferrer">
                        {ref.title ?? ref.id}
                        {ref.locator ? ` · ${ref.locator}` : ''}
                      </a>
                    ) : (
                      <span>
                        {ref.title ?? ref.id}
                        {ref.locator ? ` · ${ref.locator}` : ''}
                      </span>
                    )}
                    <span className="text-muted-foreground"> · {ref.verification}</span>
                  </li>
                ))}
              </ul>
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
            {draft.proposed_links.length > 0 ||
            draft.unresolved_questions.length > 0 ||
            draft.contested_claims.length > 0 ? (
              <section className="section">
                <h2 className="section__heading">Open review items</h2>
                {draft.proposed_links.map((link) => (
                  <p
                    key={`${link.relation}-${link.target_wiki_id}`}
                    className="text-sm text-muted-foreground"
                  >
                    Link: {link.relation} → {link.target_wiki_id}
                  </p>
                ))}
                {draft.unresolved_questions.map((question) => (
                  <p key={question} className="text-sm text-muted-foreground">
                    Question: {question}
                  </p>
                ))}
                {draft.contested_claims.map((claim) => (
                  <p key={claim} className="text-sm text-destructive">
                    Contested: {claim}
                  </p>
                ))}
                {draft.contested_claim_evidence.map((item) => (
                  <Row key={item.claim} className="mt-2 rounded-md border border-border p-2">
                    <Col>
                      <p className="text-sm font-semibold">{item.claim}</p>
                      <p className="text-xs text-muted-foreground">
                        Existing evidence: {item.existing_source_ref_ids.join(', ') || 'None'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Incoming evidence: {item.incoming_source_ref_ids.join(', ') || 'None'}
                      </p>
                    </Col>
                  </Row>
                ))}
              </section>
            ) : null}
            {draft.review_decisions.length > 0 ? (
              <section className="section">
                <h2 className="section__heading">Review history</h2>
                {draft.review_decisions.map((decision) => (
                  <p key={`${decision.at}-${decision.decision}`} className="text-sm text-muted-foreground">
                    {decision.at} · {decision.decision} · {decision.reason}
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

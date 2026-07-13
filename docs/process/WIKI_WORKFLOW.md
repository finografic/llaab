# Wiki Workflow

## Operator path

1. Open a transcript with consolidated canonical ideas.
2. Select the ideas to synthesize and create a wiki draft.
3. Review the generated article, citation links, source references, quality warnings, and RunNode.
4. Use **Edit Draft**, **Regenerate**, **Reject**, or **Promote** explicitly. Nothing promotes automatically.
5. After promotion, inspect the parent worktree and commit the generated `knowledge/wikis/*.md` page only when
   it is ready for shared knowledge.

## Safety boundary

- Drafts, candidates, research requests, and execution traces remain in the nested vault repository.
- Promoted wiki pages live under `knowledge/wikis/` in the parent repository.
- Promotion is atomic per page and revision-safe; stale update drafts must be regenerated.
- Discovery only suggests vault candidates. Research requires an explicit approved request and cannot write a
  promoted page.

## External one-shot discovery

LLAAB does not schedule discovery itself. An external cron or launchd job may call the authenticated
one-shot endpoint below; it runs once, records a RunNode, and exits without compiling or promoting a page.

```sh
curl -fsS -X POST http://127.0.0.1:8888/api/vault/wiki-candidates/discover \
  -H "X-API-Key: $LLAAB_API_KEY"
```

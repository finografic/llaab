export function ArticleResourcesEmptyState() {
  return (
    <div className="page-detail flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 md:p-6">
      <p className="text-xs font-semibold tracking-widest text-accent uppercase">Vault</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Articles</h1>
      <p className="text-sm text-muted-foreground">
        Ingest a web URL or Obsidian Web Clip to create article resources.
      </p>
    </div>
  );
}

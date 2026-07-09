import { Button } from 'components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select';
import { usePromoteInboxCapture } from 'queries/vault/usePromoteInboxCapture';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { ResourceType } from '@llaab/schemas';

import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';

import styles from './InboxCapturePromote.module.css';

const RESOURCE_TYPES: ResourceType[] = [
  'reference',
  'article',
  'repo',
  'library',
  'tool',
  'api',
  'dataset',
  'other',
];

export interface InboxCapturePromoteProps {
  capture: ParsedInboxCapture;
}

export function InboxCapturePromote({ capture }: InboxCapturePromoteProps) {
  const promote = usePromoteInboxCapture();
  const url =
    typeof capture.provenance?.payload?.['url'] === 'string' ? capture.provenance.payload['url'] : undefined;
  const defaultType = defaultResourceType(capture.routeKind);
  const [resourceType, setResourceType] = useState<ResourceType>(defaultType);
  const [promotedId, setPromotedId] = useState<string | null>(null);

  const canPromote =
    capture.routeKind === 'docs_link' ||
    capture.routeKind === 'post_link' ||
    capture.routeKind === 'github_repo' ||
    capture.routeKind === 'web_link' ||
    capture.routeKind === 'code_link' ||
    Boolean(url);

  if (!canPromote) {
    return (
      <section className="section">
        <h2 className="section__heading">Promote</h2>
        <p className={styles.note}>
          Promotion to a resource is available for URL-backed captures. Snippets, attachments, and commands
          keep promote placeholders until dedicated destinations land.
        </p>
      </section>
    );
  }

  return (
    <section className="section">
      <h2 className="section__heading">Promote</h2>
      <p className={styles.note}>
        Creates a `ResourceNode` linked back to this inbox capture. Does not write to `knowledge/` yet —
        coordinate with the vault/knowledge split before promoting there.
      </p>
      <div className={styles.row}>
        <Select
          value={resourceType}
          onValueChange={(value) => setResourceType((value ?? defaultType) as ResourceType)}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESOURCE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          disabled={promote.isPending}
          onClick={() => {
            void promote
              .mutateAsync({
                captureId: capture.node.id,
                captureTags: capture.node.tags,
                title: capture.node.title,
                url,
                resourceType,
                description: capture.rawText.slice(0, 280) || undefined,
                tags: capture.node.tags.filter((tag) => !tag.startsWith('inbox:')),
                body: [
                  `# Promoted from inbox`,
                  '',
                  `Source capture: \`${capture.node.id}\``,
                  url ? `URL: ${url}` : '',
                  '',
                  capture.rawText,
                ]
                  .filter(Boolean)
                  .join('\n'),
              })
              .then((result) => {
                setPromotedId(result.resource.id);
                toast.success(`Promoted to resource ${result.resource.id}`);
                return undefined;
              })
              .catch((err: unknown) => {
                toast.error(err instanceof Error ? err.message : 'Promotion failed.');
              });
          }}
        >
          {promote.isPending ? 'Promoting…' : 'Promote to resource'}
        </Button>
      </div>
      {promotedId ? (
        <p className={styles.note}>
          Promoted:{' '}
          <Link to={`/vault/nodes/${promotedId}`} className="meta-link">
            {promotedId}
          </Link>
        </p>
      ) : null}
    </section>
  );
}

function defaultResourceType(routeKind: string): ResourceType {
  switch (routeKind) {
    case 'github_repo':
      return 'repo';
    case 'docs_link':
      return 'reference';
    case 'post_link':
      return 'article';
    case 'npm_package':
      return 'library';
    default:
      return 'reference';
  }
}

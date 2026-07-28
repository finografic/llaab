import type { ElementType } from 'react';

import { domainTagStyle } from 'utils/domain-tag-color.utils';

export interface TagListProps {
  tags: string[];
  size?: 'sm' | 'default';
  className?: string;
  ariaLabel?: string;
  /** Set false to render bare pills with no wrapping element (caller supplies the layout). */
  wrap?: boolean;
}

/** Shared vault tag chip — renders `<span class="tag" data-tag>` pills consuming `--tag-color`. */
export function TagList({
  tags,
  size = 'default',
  className = 'tag-row',
  ariaLabel,
  wrap = true,
}: TagListProps) {
  if (tags.length === 0) return null;

  const pills = tags.map((tag) => (
    <span
      key={tag}
      className={size === 'sm' ? 'tag tag--sm' : 'tag'}
      data-tag={tag}
      style={domainTagStyle(tag)}
    >
      {tag}
    </span>
  ));

  if (!wrap) return <>{pills}</>;

  return (
    <div className={className} aria-label={ariaLabel}>
      {pills}
    </div>
  );
}

function splitDomainTags(tags: string[]): { domain: string[]; generated: string[] } {
  return {
    domain: tags.filter((tag) => tag.startsWith('d:')),
    generated: tags.filter((tag) => !tag.startsWith('d:')),
  };
}

export interface SplitTagListProps {
  tags: string[];
  size?: 'sm' | 'default';
  domainClassName: string;
  generatedClassName: string;
  /** Wrapper element for each group — some call sites nest inline in a flex row (span), others stack (div). */
  as?: ElementType;
}

/** Domain (`d:*`) tags and auto-generated topic tags, rendered as two separately-classed groups. */
export function SplitTagList({
  tags,
  size = 'default',
  domainClassName,
  generatedClassName,
  as: Wrapper = 'div',
}: SplitTagListProps) {
  if (tags.length === 0) return null;

  const { domain, generated } = splitDomainTags(tags);
  if (domain.length === 0 && generated.length === 0) return null;

  return (
    <div className="tags">
      {domain.length > 0 ? (
        <Wrapper className={domainClassName}>
          <TagList tags={domain} size={size} wrap={false} />
        </Wrapper>
      ) : null}
      {generated.length > 0 ? (
        <Wrapper className={generatedClassName}>
          <TagList tags={generated} size={size} wrap={false} />
        </Wrapper>
      ) : null}
    </div>
  );
}

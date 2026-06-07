import type { ReactNode } from 'react';

import { splitMetadataTextWithUrls } from 'utils/metadata-rendering.utils';
import type { MetadataLinkTargetOptions } from 'utils/metadata-rendering.utils';

export interface MetadataLinkProps extends MetadataLinkTargetOptions {
  href: string;
  children?: ReactNode;
  className?: string;
  rel?: string;
}

export function MetadataLink({
  href,
  children,
  className,
  target = '_blank',
  rel,
}: MetadataLinkProps) {
  const linkRel = rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined);

  return (
    <a href={href} target={target} rel={linkRel} className={className}>
      {children ?? href}
    </a>
  );
}

export interface LinkifyMetadataTextProps extends MetadataLinkTargetOptions {
  text: string;
  className?: string;
  linkClassName?: string;
}

/** Render plain metadata text with embedded URLs converted to links. */
export function LinkifyMetadataText({
  text,
  className,
  linkClassName,
  target = '_blank',
}: LinkifyMetadataTextProps) {
  const segments = splitMetadataTextWithUrls(text);

  return (
    <span className={className}>
      {segments.map((segment) =>
        segment.type === 'url' ? (
          <MetadataLink
            key={`url-${segment.start}`}
            href={segment.value}
            target={target}
            className={linkClassName}
          >
            {segment.value}
          </MetadataLink>
        ) : (
          <span key={`text-${segment.start}`}>{segment.value}</span>
        ),
      )}
    </span>
  );
}

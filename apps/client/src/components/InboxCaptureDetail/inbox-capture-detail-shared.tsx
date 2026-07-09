import { Button } from 'components/ui/button';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';

import styles from './InboxCaptureDetail.module.css';

export function CaptureMetaGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="meta-grid">
      {items.map((item) => (
        <Fragment key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function CaptureSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2 className="section__heading">{title}</h2>
      {children}
    </section>
  );
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success('Copied');
        } catch {
          toast.error('Could not copy');
        }
      }}
    >
      {label}
    </Button>
  );
}

export function ExternalLinkButton({ href, label = 'Open source' }: { href: string; label?: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} target="_blank" rel="noreferrer">
        {label}
      </a>
    </Button>
  );
}

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const displayLanguage = normalizeDisplayLanguage(language);
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className="meta-mono">{displayLanguage ?? 'text'}</span>
        <CopyButton text={code} label="Copy code" />
      </div>
      <pre className={`body-pre ${styles.codePre}`}>{code}</pre>
    </div>
  );
}

export function normalizeDisplayLanguage(language?: string): string | undefined {
  if (!language) return undefined;
  const normalized = language.trim().toLowerCase();
  if (normalized === 'jsx' || normalized === 'javascriptreact') return 'tsx';
  if (normalized === 'js') return 'javascript';
  if (normalized === 'ts') return 'typescript';
  return normalized;
}

export function payloadString(capture: ParsedInboxCapture, key: string): string | undefined {
  const value = capture.provenance?.payload?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function attachmentRecord(capture: ParsedInboxCapture): Record<string, unknown> | undefined {
  const attachment = capture.provenance?.payload?.['attachment'];
  if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)) {
    return undefined;
  }
  return attachment as Record<string, unknown>;
}

export function attachmentString(capture: ParsedInboxCapture, key: string): string | undefined {
  const attachment = attachmentRecord(capture);
  const value = attachment?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

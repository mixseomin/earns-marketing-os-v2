// Wrapper cho mọi external link trong MOS2 — auto route qua href.li để strip referrer.
// Per global rule: feedback_href_li_wrap.md
//
// Usage:
//   <ExternalLink href="https://medium.com/...">Read on Medium</ExternalLink>
//   <ExternalLink href={url} className="btn ghost">↗ open</ExternalLink>
//
// Nếu href là internal path (/p/..., /inbox, mailto:, tel:, javascript:) → render plain <a>
// không wrap. Detect tự động.

import type { AnchorHTMLAttributes, ReactNode } from 'react';

const NON_EXTERNAL = /^(\/|#|mailto:|tel:|javascript:)/i;

export function wrapHref(url: string): string {
  if (!url || NON_EXTERNAL.test(url)) return url;
  if (url.startsWith('https://href.li/')) return url;        // already wrapped
  return `https://href.li/?${url}`;
}

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children?: ReactNode;
}

export function ExternalLink({ href, children, target, rel, title, ...rest }: Props) {
  const isExternal = !NON_EXTERNAL.test(href);
  const finalHref = isExternal ? wrapHref(href) : href;
  return (
    <a
      href={finalHref}
      target={target ?? (isExternal ? '_blank' : undefined)}
      rel={rel ?? (isExternal ? 'noopener noreferrer' : undefined)}
      title={title ?? (isExternal ? href : undefined)}
      {...rest}
    >
      {children}
    </a>
  );
}

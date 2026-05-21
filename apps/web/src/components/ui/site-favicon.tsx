'use client';

// SiteFavicon — favicon/brand icon thật cho habitat/platform, fallback
// emoji glyph khi load lỗi (không bao giờ vỡ layout).
//
// Resolve thứ tự:
//   1. iconSlug  → https://cdn.simpleicons.org/<slug>  (platform brand)
//   2. url host  → https://icons.duckduckgo.com/ip3/<host>.ico
//   3. kind→domain map → ip3 favicon
//   4. glyph emoji (KIND fallback)
//
// DuckDuckGo ip3 endpoint: không cần key, privacy hơn Google s2.

import { useState } from 'react';
import type { CSSProperties } from 'react';

// kind → domain khi habitat không có url (discord/hashtag…)
const KIND_DOMAIN: Record<string, string> = {
  'discord-server': 'discord.com', discord: 'discord.com',
  subreddit: 'reddit.com', reddit: 'reddit.com',
  'fb-group': 'facebook.com', facebook: 'facebook.com', 'fb_group': 'facebook.com',
  twitter: 'x.com', x: 'x.com', 'hashtag-community': 'x.com', hashtag: 'x.com',
  telegram: 'telegram.org', youtube: 'youtube.com', slack: 'slack.com',
  feed: 'bsky.app', bluesky: 'bsky.app',
};

function hostFromUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    const h = new URL(u.startsWith('http') ? u : `https://${u}`).hostname;
    return h.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

export function SiteFavicon({
  url, kind, iconSlug, glyph, size = 16, title, style,
}: {
  url?: string | null;
  kind?: string | null;
  iconSlug?: string | null;
  glyph?: string;          // emoji fallback (vd KIND_GLYPH[kind])
  size?: number;
  title?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);

  let src: string | null = null;
  if (iconSlug) src = `https://cdn.simpleicons.org/${encodeURIComponent(iconSlug)}`;
  if (!src) {
    const host = hostFromUrl(url) ?? (kind ? KIND_DOMAIN[kind] ?? null : null);
    if (host) src = `https://icons.duckduckgo.com/ip3/${host}.ico`;
  }

  const box: CSSProperties = {
    width: size, height: size, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, verticalAlign: 'text-bottom',
    fontSize: Math.round(size * 0.85), lineHeight: 1, ...style,
  };

  if (!src || failed) {
    return <span style={box} title={title} aria-hidden>{glyph || '🌐'}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      title={title}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{ ...box, objectFit: 'contain', borderRadius: 3 }}
    />
  );
}

// Co-located sites: rewrite a public URL to a loopback origin for server-side fetches, so an
// internal call skips the public Cloudflare hop (and its bot managed-challenge, which 403s
// datacenter server fetches). e.g. MOS2 + SteamSolo both on box3 → http://127.0.0.1:3816
// instead of https://steamsolo.com. Set the env only where the sibling app is actually local.
export function internalUrl(publicUrl: string): string {
  // Read env inside the fn (not a module-level const) so it's always the runtime value,
  // never a build-time snapshot. Only set the env where the sibling app is actually local.
  const overrides: Record<string, string | undefined> = {
    'steamsolo.com': process.env.STEAMSOLO_INTERNAL_ORIGIN,
  };
  try {
    const u = new URL(publicUrl);
    const alt = overrides[u.hostname];
    if (alt) return alt.replace(/\/$/, '') + u.pathname + u.search;
  } catch {
    // not a parseable absolute URL — leave as-is
  }
  return publicUrl;
}

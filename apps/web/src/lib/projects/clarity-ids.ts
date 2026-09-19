// Microsoft Clarity project id per host — read from the ONE place that owns it: the CLARITY
// map inside adfond's page-events.js (served at adfond.com; the same file loads Clarity on
// every site). No copy here: a new site = one line in that map, and this menu follows.
// Clarity has no API to list projects, so the map is the registry. Cached 10 min like the file's edge TTL.
export async function loadClarityIds(): Promise<Record<string, string>> {
  try {
    const r = await fetch('https://adfond.com/page-events.js', { next: { revalidate: 600 } });
    if (!r.ok) return {};
    const src = await r.text();
    const map = /var CLARITY = \{([\s\S]*?)\};/.exec(src)?.[1] ?? '';
    return Object.fromEntries([...map.matchAll(/'([a-z0-9.-]+)': '([a-z0-9]+)'/g)].map((m) => [m[1], m[2]]));
  } catch { return {}; }
}
export const clarityUrl = (id: string) => `https://clarity.microsoft.com/projects/view/${id}/dashboard`;

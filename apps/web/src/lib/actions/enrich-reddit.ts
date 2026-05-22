'use server';

// Reddit auto-enrich: gọi /about.json + /about/rules.json + /hot.json
// qua OAuth (Hetzner IP bị Reddit block, cần Bearer token). Parse →
// trả patch để client apply vào form (không write DB ở đây).
//
// Tách helper riêng vì warmup-checks.ts không export getRedditToken
// và là server-only different concern (user warming vs habitat enrich).

import 'server-only';

const REDDIT_TOKEN_TTL_MS = 50 * 60 * 1000;
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getRedditToken(): Promise<string | null> {
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const auth = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`,
  ).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': process.env.REDDIT_USER_AGENT || 'mos2-enrich/1.0',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`reddit token http ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + REDDIT_TOKEN_TTL_MS };
  return data.access_token;
}

async function fetchOAuth<T = unknown>(path: string): Promise<T> {
  const token = await getRedditToken();
  if (!token) throw new Error('REDDIT_CLIENT_ID/SECRET không có trong env');
  const res = await fetch(`https://oauth.reddit.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': process.env.REDDIT_USER_AGENT || 'mos2-enrich/1.0',
    },
  });
  if (!res.ok) throw new Error(`reddit ${path} http ${res.status}`);
  return (await res.json()) as T;
}

// Extract subreddit name từ URL hoặc raw input. r/foo | /r/foo | https://reddit.com/r/foo/
function extractSubName(input: string): string | null {
  const m = input.match(/(?:^|\/|^r\/|^\/r\/)r?\/?([a-zA-Z0-9_]{2,21})\/?/);
  if (m && m[1]) return m[1];
  const direct = input.replace(/^\/?r\//, '').replace(/^@/, '').trim();
  if (/^[a-zA-Z0-9_]{2,21}$/.test(direct)) return direct;
  return null;
}

// Parse rule description tìm gates: "X day old account" / "min X karma" / "X prior posts"
function parseGatesFromRules(rules: RedditRule[]): { minAccountAgeDays?: number; minKarma?: number; minPosts?: number } {
  const text = rules.map((r) => `${r.short_name}\n${r.description ?? ''}`).join('\n').toLowerCase();
  const out: { minAccountAgeDays?: number; minKarma?: number; minPosts?: number } = {};
  const age = text.match(/(\d+)\s*(?:day|d)\s*(?:old)?\s*account/);
  if (age) out.minAccountAgeDays = Number(age[1]);
  const karma = text.match(/(\d+)\s*(?:combined\s+)?karma/);
  if (karma) out.minKarma = Number(karma[1]);
  const posts = text.match(/(\d+)\s*(?:prior\s+|previous\s+)?posts?\s+(?:before|required|min)/);
  if (posts) out.minPosts = Number(posts[1]);
  return out;
}

// Top topics từ titles của hot posts — stopword filter + freq count.
const STOPWORDS = new Set(['the','a','an','i','is','of','to','and','in','for','on','my','you','what','how','why','when','with','this','that','it','at','as','be','are','was','were','can','do','does','if','or','but','not','so','no','any','all','new','first','last','one','two','three','your','their','our','his','her','from','about','into','out','up','down','over','under','than','then','now','just','also','very','more','most','some','few','many','much','only','too']);
function extractDominantTopics(titles: string[]): string[] {
  const freq = new Map<string, number>();
  for (const title of titles) {
    const words = title.toLowerCase().match(/[a-z]{4,}/g) ?? [];
    for (const w of words) {
      if (STOPWORDS.has(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}

interface AboutResp {
  data: {
    display_name: string;
    subscribers: number;
    public_description: string;
    description: string;
    subreddit_type: string;
    lang: string;
    over18: boolean;
    created_utc: number;
    url: string;
    icon_img?: string | null;
    community_icon?: string | null;
    accounts_active?: number;
  };
}

interface RedditRule {
  short_name: string;
  description: string;
  priority: number;
  kind: string;
}
interface RulesResp { rules: RedditRule[] }

interface HotResp {
  data: { children: Array<{ data: { title: string; created_utc: number; num_comments: number } }> };
}

export interface RedditEnrichResult {
  ok: boolean;
  error?: string;
  patch?: {
    name: string;
    members: number;
    activity: string;
    language: string;
    communityType: string;
    modStrictness: string;
    postingRules: string;
    postingRulesUrl: string;
    minAccountAgeDays?: number;
    minKarma?: number;
    minPosts?: number;
    dominantTopics: string[];
    iconUrl: string | null;
  };
  fields: string[];  // tên field đã fill, để client hiện toast
}

export async function enrichRedditHabitat(urlOrName: string): Promise<RedditEnrichResult> {
  const sub = extractSubName(urlOrName);
  if (!sub) return { ok: false, error: 'Không parse được subreddit từ URL/name', fields: [] };

  try {
    const [about, rulesData, hot] = await Promise.all([
      fetchOAuth<AboutResp>(`/r/${sub}/about`),
      fetchOAuth<RulesResp>(`/r/${sub}/about/rules`),
      fetchOAuth<HotResp>(`/r/${sub}/hot?limit=25`),
    ]);

    const a = about.data;
    const rules = rulesData.rules ?? [];

    // Posting rules markdown
    const postingRules = rules.length === 0
      ? ''
      : rules
          .sort((r1, r2) => r1.priority - r2.priority)
          .map((r) => `- **${r.short_name}** — ${(r.description ?? '').replace(/\n+/g, ' ').trim()}`)
          .join('\n');

    // Activity: posts/day suy từ hot top 25 (Reddit "hot" mix 24-48h)
    const hotPosts = hot.data.children.map((c) => c.data);
    const now = Date.now() / 1000;
    const recent = hotPosts.filter((p) => now - p.created_utc < 86400 * 2);
    const postsPerDay = Math.round((recent.length / 2) * 10) / 10;
    const activity = recent.length === 0
      ? 'low'
      : postsPerDay >= 50 ? `high · ${postsPerDay} posts/d`
      : postsPerDay >= 10 ? `medium · ${postsPerDay} posts/d`
      : `low · ${postsPerDay} posts/d`;

    // Community type heuristic
    const desc = (a.public_description + ' ' + a.description).toLowerCase();
    let communityType = 'discussion';
    if (desc.includes('question') || desc.includes('ask') || desc.includes('help')) communityType = 'q-a';
    else if (desc.includes('news') || desc.includes('update')) communityType = 'news';
    else if (desc.includes('share') || desc.includes('showcase') || desc.includes('portfolio')) communityType = 'sharing';

    // Mod strictness: nhiều rule + có ban-trigger từ keyword
    const strictKw = /(perma)?ban|removed|strictly|not allowed|forbidden|disallowed/i;
    const strictHits = rules.filter((r) => strictKw.test(r.description ?? '')).length;
    const modStrictness = rules.length >= 8 || strictHits >= 4 ? 'high'
      : rules.length >= 4 || strictHits >= 2 ? 'medium' : 'low';

    const gates = parseGatesFromRules(rules);
    const topics = extractDominantTopics(hotPosts.map((p) => p.title));

    // Icon: community_icon (custom) > icon_img (default)
    let iconUrl: string | null = a.community_icon || a.icon_img || null;
    if (iconUrl) iconUrl = iconUrl.split('?')[0] || null;  // strip Reddit CDN query

    const patch = {
      name: `r/${a.display_name}`,
      members: a.subscribers,
      activity,
      language: a.lang === '' ? 'en' : a.lang,
      communityType,
      modStrictness,
      postingRules,
      postingRulesUrl: `https://reddit.com/r/${a.display_name}/about/rules`,
      minAccountAgeDays: gates.minAccountAgeDays,
      minKarma: gates.minKarma,
      minPosts: gates.minPosts,
      dominantTopics: topics,
      iconUrl,
    };

    const fields: string[] = ['name', 'members', 'activity', 'language', 'communityType', 'modStrictness'];
    if (postingRules) fields.push(`postingRules (${rules.length} rules)`);
    if (gates.minAccountAgeDays) fields.push(`minAccountAgeDays=${gates.minAccountAgeDays}`);
    if (gates.minKarma) fields.push(`minKarma=${gates.minKarma}`);
    if (gates.minPosts) fields.push(`minPosts=${gates.minPosts}`);
    if (topics.length > 0) fields.push(`dominantTopics (${topics.length})`);
    if (iconUrl) fields.push('iconUrl');

    return { ok: true, patch, fields };
  } catch (e) {
    return { ok: false, error: (e as Error).message, fields: [] };
  }
}

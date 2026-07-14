// Platform-AGNOSTIC posting-gate inference from a community's About + Rules prose.
// Replaces the Reddit-only regex (karma/day/posts) — it reads TEXT, so the SAME call
// works on any platform (Reddit, phpBB/XenForo forum, FB group, Discord) whose rules
// copy the ext captured as `region_text`. One gpt-4o-mini json_object call, GROUNDED:
// every scalar value must quote evidence that actually appears in the source text, or
// it is dropped — so the model can't invent a karma/age number the community never set.
import { getOpenAI, DEFAULT_MODEL } from './openai';

export interface HabitatGates {
  minKarma: number | null;
  minAccountAgeDays: number | null;
  minPosts: number | null;
  modStrictness: string | null;      // low | medium | high
  communityType: string | null;      // discussion | q-a | news | sharing | other
  linksAllowedAfter: string | null;  // short phrase, e.g. "after 10 comments" / "established members only"
  forbiddenTopics: string[];
  dominantTopics: string[];
  usage: { prompt_tokens?: number; completion_tokens?: number } | null;
  model: string;
}

const CONF_FLOOR = 0.55;
const norm = (s: string) => s.toLowerCase().replace(/[^\w ]+/g, ' ').replace(/\s+/g, ' ').trim();
const MOD = new Set(['low', 'medium', 'high']);
const CTYPE = new Set(['discussion', 'q-a', 'news', 'sharing', 'other']);

type RawField = { value?: unknown; confidence?: number; evidence?: string };

export async function extractHabitatGates(regionText: string): Promise<HabitatGates | null> {
  const ai = getOpenAI();
  if (!ai) return null;
  const text = String(regionText || '').replace(/\s+/g, ' ').trim().slice(0, 6000);
  if (text.length < 60) return null;

  const sys =
    "You infer a community's POSTING GATES from its About + Rules text. Output strict JSON. " +
    'For EACH field give {"value": <typed>, "confidence": 0..1, "evidence": "<exact quote from the text>"}. ' +
    'If the text does not state or clearly imply a field, set value null, confidence 0, evidence "". ' +
    'NEVER invent a number the text does not support. Fields: ' +
    'min_karma (int — reputation/karma points required to post), ' +
    'min_account_age_days (int — account age in days required to post), ' +
    'min_posts (int — prior posts/comments required before posting or linking), ' +
    'mod_strictness ("low"|"medium"|"high" — how hard rules are enforced: many bans/removals/"strictly"/anti-self-promo/anti-spam ⇒ high), ' +
    'community_type ("discussion"|"q-a"|"news"|"sharing"|"other"), ' +
    'links_allowed_after (SHORT phrase for when self/external links are permitted, e.g. "after 10 comments", "established members only", "self-promo banned"), ' +
    'forbidden_topics (array of short tags for what is NOT allowed, from the rules), ' +
    'dominant_topics (array of short tags for what the community is about).';
  const usr = 'Community About + Rules text:\n"""\n' + text + '\n"""';

  let raw: Record<string, RawField> = {};
  let usage: { prompt_tokens?: number; completion_tokens?: number } | null = null;
  let model = DEFAULT_MODEL;
  try {
    const c = await ai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
      response_format: { type: 'json_object' }, temperature: 0.1, max_tokens: 600,
    });
    raw = JSON.parse(c.choices[0]?.message?.content || '{}') as Record<string, RawField>;
    usage = c.usage ? { prompt_tokens: c.usage.prompt_tokens, completion_tokens: c.usage.completion_tokens } : null;
    model = c.model || DEFAULT_MODEL;
  } catch { return null; }

  const hay = norm(text);
  // A scalar/enum/phrase survives ONLY if confidence ≥ floor AND its evidence quote is
  // actually in the source text (anti-hallucination). Topics stay ungrounded (low-risk tags).
  const grounded = (k: string): { v: unknown; ok: boolean } => {
    const f = raw[k];
    if (!f || f.value == null) return { v: null, ok: false };
    const conf = typeof f.confidence === 'number' ? f.confidence : 0;
    const ev = norm(String(f.evidence || ''));
    return { v: f.value, ok: conf >= CONF_FLOOR && ev.length >= 3 && hay.includes(ev) };
  };
  const intOf = (k: string): number | null => {
    const { v, ok } = grounded(k); if (!ok) return null;
    const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 0 && n < 1e7 ? n : null;
  };
  const enumOf = (k: string, set: Set<string>): string | null => {
    const { v, ok } = grounded(k); if (!ok) return null;
    const s = String(v).toLowerCase().trim(); return set.has(s) ? s : null;
  };
  const phraseOf = (k: string): string | null => {
    const { v, ok } = grounded(k); if (!ok) return null;
    const s = String(v).trim().slice(0, 60); return s || null;
  };
  const tagsOf = (k: string): string[] => {
    const arr = Array.isArray(raw[k]?.value) ? (raw[k]!.value as unknown[]) : [];
    return arr.map((x) => String(x).trim()).filter((s) => s && s.length <= 40).slice(0, 10);
  };

  return {
    minKarma: intOf('min_karma'),
    minAccountAgeDays: intOf('min_account_age_days'),
    minPosts: intOf('min_posts'),
    modStrictness: enumOf('mod_strictness', MOD),
    communityType: enumOf('community_type', CTYPE),
    linksAllowedAfter: phraseOf('links_allowed_after'),
    forbiddenTopics: tagsOf('forbidden_topics'),
    dominantTopics: tagsOf('dominant_topics'),
    usage, model,
  };
}

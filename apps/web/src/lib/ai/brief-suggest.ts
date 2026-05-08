'use server';

// Generate AI-suggested approach plan (community brief) for a given
// (account × habitat) pair. Aware of the EXISTING brief content so it
// can either fill gaps or propose alternatives — does NOT overwrite
// directly; the UI shows suggestions next to each field for the user
// to copy/replace manually.

import { getOpenAI, DEFAULT_MODEL, aiEnabled } from './openai';
import { getDb, platformAccounts, platforms, habitats, tribes, projects } from '@mos2/db';
import { eq } from 'drizzle-orm';

export interface BriefSuggestionLang {
  approachMd: string;
  cadence: string;
  tone: string;
  doMd: string;
  dontMd: string;
  rationale: string;
}

export interface BriefSuggestion {
  en: BriefSuggestionLang;
  vi: BriefSuggestionLang;
}

export interface BriefSuggestRequest {
  accountId: number;
  habitatId: number;
  current: {
    approachMd: string;
    cadence: string;
    tone: string;
    doMd: string;
    dontMd: string;
  };
  // Optional free-form instruction from the operator, e.g.
  // "more aggressive tone", "focus on Vietnamese moms", "avoid emojis".
  // Included in the user prompt with HIGH priority weight.
  extraInstruction?: string;
}

const SYSTEM_PROMPT = `You are a community-marketing strategist helping shape an outreach plan
for ONE specific (account-persona × community) pairing. Generate the SAME plan
in BOTH English and Vietnamese so the operator can pick whichever fits.

Output STRICT JSON (no markdown wrapper):
{
  "en": {
    "approachMd": "...",   // 4-8 line markdown narrative
    "cadence": "...",       // e.g. "3 replies/day"
    "tone": "...",          // 3-6 words
    "doMd": "...",          // 3-6 markdown bullets ("- ...")
    "dontMd": "...",        // 3-5 markdown bullets
    "rationale": "..."      // 1-2 sentences explaining WHY this fits
  },
  "vi": {
    "approachMd": "...",   // SAME meaning as en, but in Vietnamese
    "cadence": "...",
    "tone": "...",
    "doMd": "...",
    "dontMd": "...",
    "rationale": "..."
  }
}

RULES:
- Both versions express the SAME strategy — vi is not a literal word-for-word translation
  but a natural Vietnamese rendering with native idioms / register / flow.
- Be SPECIFIC to the platform, the community subject, and the persona/handle. Generic advice = useless.
- Respect community rules and self-promotion conventions of the platform. Reddit ≠ FB ≠ Discord.
- If a field is already filled by the user, propose an ALTERNATIVE / refinement, NOT a copy.
- If a field is empty, fill it from scratch.
- Keep approach 4-8 lines, no fluff.
- Use vi-VN with diacritics (có dấu) — never bị bỏ dấu.
- Keep platform-specific jargon as-is in BOTH versions (e.g. "subreddit", "upvote") — do not translate technical terms.`;

function buildUserPrompt(args: {
  accountHandle: string | null;
  accountStatus: string;
  accountTags: string[];
  platformKey: string;
  platformLabel: string;
  habitatName: string;
  habitatKind: string;
  habitatUrl: string | null;
  habitatMembers: number;
  habitatActivity: string;
  habitatLanguage: string;
  habitatCommunityType: string;
  habitatModStrictness: string;
  habitatPostingRules: string;
  habitatPostingRulesUrl: string;
  habitatMinAccountAgeDays: number;
  habitatMinKarma: number;
  habitatMinPosts: number;
  habitatLinksAllowedAfter: string;
  habitatDominantTopics: string[];
  habitatForbiddenTopics: string[];
  habitatBestPostTimes: string;
  tribeName: string | null;
  tribeDesc: string | null;
  tribePsychographic: string | null;
  tribeLexicon: string[];
  tribeAvoid: string[];
  projectName: string;
  projectOneLiner: string | null;
  projectBio: string | null;
  current: BriefSuggestRequest['current'];
  extraInstruction?: string;
}): string {
  const filled = (k: keyof BriefSuggestRequest['current']) => args.current[k]?.trim() ? '(FILLED — propose REFINEMENT)' : '(EMPTY — fill)';
  return [
    `PROJECT: ${args.projectName}`,
    args.projectOneLiner ? `ONE-LINER: ${args.projectOneLiner}` : null,
    args.projectBio ? `BIO: ${args.projectBio}` : null,
    '',
    `ACCOUNT (persona):`,
    `  handle: @${args.accountHandle ?? 'no-handle'}`,
    `  platform: ${args.platformLabel} (${args.platformKey})`,
    `  status: ${args.accountStatus}`,
    args.accountTags.length > 0 ? `  tags: ${args.accountTags.join(', ')}` : null,
    '',
    `COMMUNITY (habitat):`,
    `  name: ${args.habitatName}`,
    `  kind: ${args.habitatKind}`,
    args.habitatUrl ? `  url: ${args.habitatUrl}` : null,
    args.habitatMembers > 0 ? `  members: ${args.habitatMembers.toLocaleString()}` : null,
    args.habitatActivity ? `  activity: ${args.habitatActivity}` : null,
    args.habitatLanguage ? `  language: ${args.habitatLanguage}` : null,
    args.habitatCommunityType ? `  type: ${args.habitatCommunityType}` : null,
    args.habitatModStrictness ? `  mod strictness: ${args.habitatModStrictness}` : null,
    args.habitatBestPostTimes ? `  best post times: ${args.habitatBestPostTimes}` : null,
    args.habitatMinAccountAgeDays > 0 ? `  posting gate: account age ≥ ${args.habitatMinAccountAgeDays} days` : null,
    args.habitatMinKarma > 0 ? `  posting gate: karma ≥ ${args.habitatMinKarma}` : null,
    args.habitatMinPosts > 0 ? `  posting gate: prior posts ≥ ${args.habitatMinPosts}` : null,
    args.habitatLinksAllowedAfter ? `  links allowed: ${args.habitatLinksAllowedAfter}` : null,
    args.habitatDominantTopics.length > 0 ? `  dominant topics (use these angles): ${args.habitatDominantTopics.join(', ')}` : null,
    args.habitatForbiddenTopics.length > 0 ? `  FORBIDDEN topics (NEVER write about): ${args.habitatForbiddenTopics.join(', ')}` : null,
    args.habitatPostingRulesUrl ? `  rules page: ${args.habitatPostingRulesUrl}` : null,
    args.habitatPostingRules ? `  posting rules:\n${args.habitatPostingRules.split('\n').map((l) => `    ${l}`).join('\n')}` : null,
    args.tribeName ? `  audience tribe: ${args.tribeName}` : null,
    args.tribeDesc ? `  tribe desc: ${args.tribeDesc}` : null,
    args.tribePsychographic ? `  tribe psychographic: ${args.tribePsychographic}` : null,
    args.tribeLexicon.length > 0 ? `  tribe lexicon (use these words): ${args.tribeLexicon.join(', ')}` : null,
    args.tribeAvoid.length > 0 ? `  tribe avoid (do NOT say): ${args.tribeAvoid.join(', ')}` : null,
    '',
    `CURRENT BRIEF STATE:`,
    `  approachMd ${filled('approachMd')}: ${args.current.approachMd || '(empty)'}`,
    `  cadence ${filled('cadence')}: ${args.current.cadence || '(empty)'}`,
    `  tone ${filled('tone')}: ${args.current.tone || '(empty)'}`,
    `  doMd ${filled('doMd')}: ${args.current.doMd || '(empty)'}`,
    `  dontMd ${filled('dontMd')}: ${args.current.dontMd || '(empty)'}`,
    args.extraInstruction?.trim() ? '' : null,
    args.extraInstruction?.trim() ? `OPERATOR EXTRA INSTRUCTION (HIGH PRIORITY — apply on top of everything above):` : null,
    args.extraInstruction?.trim() ? `  ${args.extraInstruction.trim()}` : null,
    '',
    'Generate the JSON response now.',
  ].filter(Boolean).join('\n');
}

export async function suggestBrief(req: BriefSuggestRequest): Promise<{ ok: boolean; suggestion?: BriefSuggestion; error?: string }> {
  if (!aiEnabled()) return { ok: false, error: 'OpenAI key not configured (OPENAI_API_KEY).' };
  const openai = getOpenAI();
  if (!openai) return { ok: false, error: 'OpenAI client unavailable' };

  const db = getDb();
  if (!db) return { ok: false, error: 'DATABASE_URL not configured.' };

  // Hydrate context from DB
  const accRows = await db.select().from(platformAccounts).where(eq(platformAccounts.id, req.accountId)).limit(1);
  const acc = accRows[0];
  if (!acc) return { ok: false, error: 'account not found' };

  const pfRows = await db.select().from(platforms).where(eq(platforms.key, acc.platformKey)).limit(1);
  const pf = pfRows[0];

  const habRows = await db.select().from(habitats).where(eq(habitats.id, req.habitatId)).limit(1);
  const habitat = habRows[0];
  if (!habitat) return { ok: false, error: 'habitat not found' };

  let tribe: typeof tribes.$inferSelect | null = null;
  if (habitat.tribeId) {
    const tRows = await db.select().from(tribes).where(eq(tribes.id, habitat.tribeId)).limit(1);
    tribe = tRows[0] ?? null;
  }

  const projRows = await db.select().from(projects).where(eq(projects.id, habitat.projectId)).limit(1);
  const proj = projRows[0];

  const userPrompt = buildUserPrompt({
    accountHandle: acc.handle,
    accountStatus: acc.status,
    accountTags: (acc.tags as string[]) ?? [],
    platformKey: acc.platformKey,
    platformLabel: pf?.label ?? acc.platformKey,
    habitatName: habitat.name,
    habitatKind: habitat.kind,
    habitatUrl: habitat.url,
    habitatMembers: habitat.members,
    habitatActivity: habitat.activity,
    habitatLanguage: habitat.language ?? '',
    habitatCommunityType: habitat.communityType ?? '',
    habitatModStrictness: habitat.modStrictness ?? '',
    habitatPostingRules: habitat.postingRules ?? '',
    habitatPostingRulesUrl: habitat.postingRulesUrl ?? '',
    habitatMinAccountAgeDays: habitat.minAccountAgeDays ?? 0,
    habitatMinKarma: habitat.minKarma ?? 0,
    habitatMinPosts: habitat.minPosts ?? 0,
    habitatLinksAllowedAfter: habitat.linksAllowedAfter ?? '',
    habitatDominantTopics: (habitat.dominantTopics as string[]) ?? [],
    habitatForbiddenTopics: (habitat.forbiddenTopics as string[]) ?? [],
    habitatBestPostTimes: habitat.bestPostTimes ?? '',
    tribeName: tribe?.name ?? null,
    tribeDesc: tribe?.descText ?? null,
    tribePsychographic: tribe?.psychographic ?? null,
    tribeLexicon: (tribe?.lexicon as string[]) ?? [],
    tribeAvoid: (tribe?.avoid as string[]) ?? [],
    projectName: proj?.name ?? habitat.projectId,
    projectOneLiner: proj?.oneLiner ?? null,
    projectBio: proj?.bio ?? null,
    current: req.current,
    extraInstruction: req.extraInstruction,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.7,
    });
    const text = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(text) as { en?: Partial<BriefSuggestionLang>; vi?: Partial<BriefSuggestionLang> };
    const pick = (lang: 'en' | 'vi'): BriefSuggestionLang => {
      const o = parsed[lang] ?? {};
      return {
        approachMd: String(o.approachMd ?? ''),
        cadence:    String(o.cadence ?? ''),
        tone:       String(o.tone ?? ''),
        doMd:       String(o.doMd ?? ''),
        dontMd:     String(o.dontMd ?? ''),
        rationale:  String(o.rationale ?? ''),
      };
    };
    return { ok: true, suggestion: { en: pick('en'), vi: pick('vi') } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

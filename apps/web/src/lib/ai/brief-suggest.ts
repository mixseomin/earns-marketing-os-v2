'use server';

// Generate AI-suggested approach plan (community brief) for a given
// (account × habitat) pair. Aware of the EXISTING brief content so it
// can either fill gaps or propose alternatives — does NOT overwrite
// directly; the UI shows suggestions next to each field for the user
// to copy/replace manually.

import { getOpenAI, DEFAULT_MODEL, aiEnabled } from './openai';
import { getDb, platformAccounts, platforms, habitats, tribes, habitatTribes, projects, communityBriefs } from '@mos2/db';
import { and, eq } from 'drizzle-orm';
import { getFieldSchema } from '../habitat-field-schema';
import { getBriefFieldSchema } from '../brief-field-schema';
import { detectLang, LANG_LABEL, type Lang } from '../lang-detect';

export interface BriefSuggestionLang {
  approachMd: string;
  narrativeMd: string;
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
    narrativeMd: string;
    cadence: string;
    tone: string;
    doMd: string;
    dontMd: string;
  };
  // Optional free-form instruction from the operator, e.g.
  // "more aggressive tone", "focus on Vietnamese moms", "avoid emojis".
  // Included in the user prompt with HIGH priority weight.
  extraInstruction?: string;
  // Optional: when the user clicks per-field "↻ Regen" on a single
  // SuggestionInline card, we ask AI to focus refinement on just that
  // field. AI still returns the full bundle (we don't break the JSON
  // contract) but the named field gets the strongest variation.
  regenField?: keyof BriefSuggestionLang;
  // Optional: chỉ generate suggestion cho các field đang trống. Field
  // đã có nội dung được AI return empty string → client merge sẽ giữ
  // suggestion cũ. Tiết kiệm token + nhanh hơn full regen.
  regenEmptyOnly?: boolean;
}

const SYSTEM_PROMPT = `You are a community-marketing strategist helping shape an outreach plan
for ONE specific (account-persona × community) pairing. Generate the SAME plan
in BOTH English and Vietnamese so the operator can pick whichever fits.

Output STRICT JSON (no markdown wrapper):
{
  "en": {
    "approachMd":  "...",   // 4-8 line markdown - WHERE/WHEN to engage (tactical plan)
    "narrativeMd": "...",   // 5-10 line markdown - HOW to tell the story (story arc, voice, hooks, ending)
    "cadence": "...",       // e.g. "3 replies/day"
    "tone": "...",          // 3-6 words
    "doMd": "...",          // 3-6 markdown bullets ("- ...")
    "dontMd": "...",        // 3-5 markdown bullets
    "rationale": "..."      // 1-2 sentences explaining WHY this fits
  },
  "vi": {
    "approachMd":  "...",   // SAME meaning as en, but in Vietnamese
    "narrativeMd": "...",
    "cadence": "...",
    "tone": "...",
    "doMd": "...",
    "dontMd": "...",
    "rationale": "..."
  }
}

NARRATIVE FIELD GUIDANCE (narrativeMd):
- This is the STORYTELLING framework, NOT the engagement tactic.
- Structure as markdown with labelled sections:
  **Arc** (or **Vòng cung** in vi): the story arc the persona uses (hook → context → insight → invite)
  **Voice** (or **Giọng**): narrative voice DNA for this persona on this community
  **Opening hook** (or **Hook mở bài**): 1-3 example opening lines this persona would use
  **Climax**: the turning point or payoff style
  **Ending** (or **Kết**): how posts close (CTA / question / open)
  **Avoid** (or **Tránh**): patterns this persona must NOT use here
- Tailor to the community culture (scholarly forum vs lifestyle vs Reddit-meme).
- Reference specific persona traits if account context provides them.

RULES:
- Both versions express the SAME strategy — second slot is not a literal word-for-word translation
  but a natural rendering with native idioms / register / flow.
- The "vi" JSON key normally holds Vietnamese. HOWEVER, if a LOCALE OVERRIDE directive appears
  in the user message, the "vi" key MUST hold the specified locale (Spanish / French / etc.)
  instead of Vietnamese. Keep the JSON key name "vi" — change only the language of values.
- Be SPECIFIC to the platform, the community subject, and the persona/handle. Generic advice = useless.
- Respect community rules and self-promotion conventions of the platform. Reddit ≠ FB ≠ Discord.
- If a field is already filled by the user, propose an ALTERNATIVE / refinement, NOT a copy.
- If a field is empty, fill it from scratch.
- Keep approach 4-8 lines, narrative 5-10 lines, no fluff.
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
  habitatScrapedMeta: Record<string, unknown>;
  briefScrapedMeta: Record<string, unknown>;
  pageKind: string;
  detectedLang: Lang;
  detectedLangSource: 'db' | 'auto' | 'none';
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
  regenField?: keyof BriefSuggestionLang;
  regenEmptyOnly?: boolean;
}): string {
  const filled = (k: keyof BriefSuggestRequest['current']) => args.current[k]?.trim() ? '(FILLED — propose REFINEMENT)' : '(EMPTY — fill)';
  // Render scraped_meta with friendly labels từ schema; bỏ qua các key
  // đã có trong column hardcoded của habitat (để tránh duplicate).
  const habitatBuiltinKeys = new Set(getFieldSchema(args.pageKind).map((f) => f.key));
  const habitatExtraLines: string[] = [];
  for (const [k, v] of Object.entries(args.habitatScrapedMeta)) {
    if (habitatBuiltinKeys.has(k)) continue;
    if (v == null || v === '') continue;
    const labelEntry = getFieldSchema(args.pageKind).find((f) => f.key === k);
    const label = labelEntry?.label ?? k;
    habitatExtraLines.push(`  ${label} (${k}): ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  }
  const briefSchema = getBriefFieldSchema(args.pageKind);
  const briefExtraLines: string[] = [];
  for (const [k, v] of Object.entries(args.briefScrapedMeta)) {
    if (v == null || v === '') continue;
    if (k === 'join_status') continue; // đã có ở section RELATIONSHIP riêng
    const labelEntry = briefSchema.find((f) => f.key === k);
    const label = labelEntry?.label ?? k;
    briefExtraLines.push(`  ${label} (${k}): ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  }
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
    args.habitatLanguage ? `  language (declared): ${args.habitatLanguage}` : null,
    (args.detectedLang !== 'unknown' && args.detectedLang !== 'en') ? `  language (${args.detectedLangSource === 'db' ? 'from DB' : 'auto-detected from rules/description'}): ${LANG_LABEL[args.detectedLang]}` : null,
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
    habitatExtraLines.length > 0 ? '' : null,
    habitatExtraLines.length > 0 ? `HABITAT EXTRA SIGNALS (scraped custom fields — use as hints về văn hoá / external presence / mod culture):` : null,
    habitatExtraLines.length > 0 ? habitatExtraLines.join('\n') : null,
    briefExtraLines.length > 0 ? '' : null,
    briefExtraLines.length > 0 ? `VIEWER ↔ HABITAT RELATIONSHIP (scraped membership signals — use to gauge how warmed up the persona is):` : null,
    briefExtraLines.length > 0 ? briefExtraLines.join('\n') : null,
    '',
    `CURRENT BRIEF STATE:`,
    `  approachMd  ${filled('approachMd')}: ${args.current.approachMd || '(empty)'}`,
    `  narrativeMd ${filled('narrativeMd')}: ${args.current.narrativeMd || '(empty)'}`,
    `  cadence     ${filled('cadence')}: ${args.current.cadence || '(empty)'}`,
    `  tone        ${filled('tone')}: ${args.current.tone || '(empty)'}`,
    `  doMd        ${filled('doMd')}: ${args.current.doMd || '(empty)'}`,
    `  dontMd      ${filled('dontMd')}: ${args.current.dontMd || '(empty)'}`,
    args.extraInstruction?.trim() ? '' : null,
    args.extraInstruction?.trim() ? `OPERATOR EXTRA INSTRUCTION (HIGH PRIORITY — apply on top of everything above):` : null,
    args.extraInstruction?.trim() ? `  ${args.extraInstruction.trim()}` : null,
    args.regenField ? '' : null,
    args.regenField ? `FOCUS REGEN: the operator is refreshing ONLY the "${args.regenField}" field of the suggestion.` : null,
    args.regenField ? `  Generate a STRONG ALTERNATIVE for "${args.regenField}" that materially differs from the current value.` : null,
    args.regenField ? `  Other fields should stay close to their current state (mild refinement only — do not propose new directions for them).` : null,
    args.regenEmptyOnly ? '' : null,
    args.regenEmptyOnly ? `ENRICH-MISSING MODE: the operator wants suggestions ONLY for EMPTY fields.` : null,
    args.regenEmptyOnly ? `  For each field marked "(EMPTY — fill)" above: generate a high-quality suggestion as normal.` : null,
    args.regenEmptyOnly ? `  For each field marked "(FILLED — propose REFINEMENT)" above: return EMPTY STRING "" for that key in BOTH en and vi.` : null,
    args.regenEmptyOnly ? `  This applies to fields: approachMd, narrativeMd, cadence, tone, doMd, dontMd. Always include "rationale".` : null,
    '',
    // Locale override: community speaks non-en/non-vi language → second slot
    // phải là local language thay vì Vietnamese, vì community sẽ đọc + reply
    // bằng local. Operator vẫn đọc en để hiểu strategy.
    (args.detectedLang !== 'unknown' && args.detectedLang !== 'en' && args.detectedLang !== 'vi')
      ? `LOCALE OVERRIDE (CRITICAL): This community speaks ${LANG_LABEL[args.detectedLang]}, NOT English or Vietnamese.\n  Keep "en" field as English (operator reads it).\n  BUT replace "vi" field content with ${LANG_LABEL[args.detectedLang]} (native diacritics + idioms). DO NOT output Vietnamese — output ${LANG_LABEL[args.detectedLang]} in the vi slot.\n  Keep JSON key name "vi" (don't rename), only change the LANGUAGE of its values.\n  Hook examples, tone, narrative voice — all must be authentic ${LANG_LABEL[args.detectedLang]} natives would actually post in this community.`
      : null,
    '',
    'Generate the JSON response now.',
  ].filter(Boolean).join('\n');
}

export async function suggestBrief(req: BriefSuggestRequest): Promise<{
  ok: boolean;
  suggestion?: BriefSuggestion;
  error?: string;
  // Khi habitat community nói non-en/non-vi language, slot "vi" thực ra
  // chứa local language → client hiển thị label đúng (vd "ES" thay vì "VI").
  localeLang?: Lang;
  localeLabel?: string;
}> {
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

  // M2M: a habitat can span multiple tribes. Pull the FULL set (primary
  // first) and aggregate lexicon/avoid so the brief AI sees every
  // audience that hangs out there — not just the primary.
  const linkedTribes = await db
    .select({ t: tribes, isPrimary: habitatTribes.isPrimary })
    .from(habitatTribes)
    .innerJoin(tribes, eq(tribes.id, habitatTribes.tribeId))
    .where(eq(habitatTribes.habitatId, habitat.id));
  linkedTribes.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  // Fallback to the denormalized single tribe if no join rows yet.
  let tribeList = linkedTribes.map((x) => x.t);
  if (tribeList.length === 0 && habitat.tribeId) {
    const tRows = await db.select().from(tribes).where(eq(tribes.id, habitat.tribeId)).limit(1);
    if (tRows[0]) tribeList = [tRows[0]];
  }
  const primaryTribe = tribeList[0] ?? null;
  const uniq = (xs: string[]) => [...new Set(xs.map((s) => s.trim()).filter(Boolean))];
  const tribeNameAgg = primaryTribe
    ? (tribeList.length > 1
        ? `${primaryTribe.name} (+ ${tribeList.slice(1).map((t) => t.name).join(', ')})`
        : primaryTribe.name)
    : null;
  const tribeLexiconAgg = uniq(tribeList.flatMap((t) => (t.lexicon as string[]) ?? []));
  const tribeAvoidAgg = uniq(tribeList.flatMap((t) => (t.avoid as string[]) ?? []));

  const projRows = await db.select().from(projects).where(eq(projects.id, habitat.projectId)).limit(1);
  const proj = projRows[0];

  // Brief scraped_meta (relationship: join_status, member_role, karma_in_sub, ...)
  const briefRows = await db
    .select({ scrapedMeta: communityBriefs.scrapedMeta })
    .from(communityBriefs)
    .where(and(eq(communityBriefs.accountId, req.accountId), eq(communityBriefs.habitatId, req.habitatId)))
    .limit(1);
  const briefScrapedMeta = (briefRows[0]?.scrapedMeta as Record<string, unknown>) ?? {};

  // page_kind dùng để map label cho scraped_meta. Hiện cứng subreddit-about;
  // tương lai derive từ platformKey + habitat.kind.
  const pageKind = 'subreddit-about';

  // Language detection — ưu tiên habitat.language nếu set; fallback heuristic
  // detect từ description + postingRules + title (đủ context vì rules thường
  // dài 200-500 chars). Community Spanish/French/... cần brief đúng locale.
  // Khi field "language" trong DB là một chuỗi như "es" → tin tưởng DB.
  type LangSource = 'db' | 'auto' | 'none';
  let detectedLang: Lang = 'unknown';
  let detectedLangSource: LangSource = 'none';
  const dbLang = (habitat.language ?? '').trim().toLowerCase();
  const KNOWN: Lang[] = ['en', 'vi', 'es', 'fr', 'de', 'pt', 'it'];
  if ((KNOWN as string[]).includes(dbLang)) {
    detectedLang = dbLang as Lang;
    detectedLangSource = 'db';
  } else {
    const corpus = [
      habitat.title ?? '',
      habitat.description ?? '',
      habitat.postingRules ?? '',
    ].filter(Boolean).join('\n');
    const auto = detectLang(corpus);
    if (auto !== 'unknown') {
      detectedLang = auto;
      detectedLangSource = 'auto';
    }
  }

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
    habitatScrapedMeta: (habitat.scrapedMeta as Record<string, unknown>) ?? {},
    briefScrapedMeta,
    pageKind,
    detectedLang,
    detectedLangSource,
    tribeName: tribeNameAgg,
    tribeDesc: primaryTribe?.descText ?? null,
    tribePsychographic: primaryTribe?.psychographic ?? null,
    tribeLexicon: tribeLexiconAgg,
    tribeAvoid: tribeAvoidAgg,
    projectName: proj?.name ?? habitat.projectId,
    projectOneLiner: proj?.oneLiner ?? null,
    projectBio: proj?.bio ?? null,
    current: req.current,
    extraInstruction: req.extraInstruction,
    regenField: req.regenField,
    regenEmptyOnly: req.regenEmptyOnly,
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
        approachMd:  String(o.approachMd ?? ''),
        narrativeMd: String(o.narrativeMd ?? ''),
        cadence:     String(o.cadence ?? ''),
        tone:        String(o.tone ?? ''),
        doMd:        String(o.doMd ?? ''),
        dontMd:      String(o.dontMd ?? ''),
        rationale:   String(o.rationale ?? ''),
      };
    };
    // Khi locale override fired (community != en/vi), slot "vi" chứa local
    // language → trả về cho client để label tab/badge đúng (vd "ES" thay vì "VI").
    const localeOverride = detectedLang !== 'unknown' && detectedLang !== 'en' && detectedLang !== 'vi';
    return {
      ok: true,
      suggestion: { en: pick('en'), vi: pick('vi') },
      localeLang: localeOverride ? detectedLang : undefined,
      localeLabel: localeOverride ? LANG_LABEL[detectedLang] : undefined,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

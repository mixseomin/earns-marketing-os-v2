'use server';
// Send-ready package for an email-issue task, stored in human_tasks.prep_payload->'email'.
// Everything the real send needs, prepared up front: the actual email (from/subject/preheader/
// body), the recipient list, the send time, the offer link. Lazy-fetched by the drawer (like
// getOfferNote) so it never bloats the plays list. Standard shape → every 📧 card is identical.

import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { logAiUsage } from '@/lib/ai/usage';
// Type + empty default live in a PLAIN module — a 'use server' file may only export async functions,
// so the value/type must not be declared here (was crashing /plays + /communities at runtime).
import { type EmailPrep, type EmailSource, EMPTY_EMAIL_PREP, isFreshSource, MAX_SOURCE_AGE_DAYS } from '@/lib/email-prep-shape';

// CAN-SPAM physical postal address - the single shared usa2me virtual mailbox reused across the whole
// portfolio (see memory reference_usa2me_mailbox). Baked in so the footer auto-fills and is never asked for.
const CANSPAM_FOOTER = 'MilitaryCalc, 10685-B Hazelhurst Dr #43316, Houston, TX 77043, USA';

export async function getEmailPrep(taskId: number): Promise<EmailPrep | null> {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') return null;
  const db = getDb();
  if (!db) return null;
  const rows = (await db.execute(
    sql`SELECT prep_payload->'email' AS email FROM human_tasks WHERE id = ${taskId} LIMIT 1`,
  )) as unknown as Array<{ email: unknown }>;
  const e = rows[0]?.email;
  if (!e || typeof e !== 'object') return null;
  return { ...EMPTY_EMAIL_PREP, ...(e as Partial<EmailPrep>) };
}

// AI-write the real email from the card brief + the CHOSEN offer + audience. The offer is required:
// you pick a real offer first (from /offers), then the AI writes copy woven around BOTH that offer
// and the card's content theme. Hook goes on line 1 (no formal intro). Returns subject A/B, preheader,
// body, and 3-5 key points (the email's gist). English, human-voice (public content).
export async function generateEmailPrep(
  taskId: number,
  ctx: { offerLabel?: string; offerUrl?: string; segment?: string; audience?: string; sources?: EmailSource[]; articleUrl?: string },
): Promise<{ ok: boolean; subjectA?: string; subjectB?: string; preheader?: string; bodyMd?: string; articleMd?: string; keyPoints?: string[]; error?: string }> {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') return { ok: false, error: 'admin-only' };
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  // Offer-first: no email without a real offer to build around (the card content + offer must cohere).
  const offer = (ctx.offerLabel || '').trim();
  if (!offer) return { ok: false, error: 'Chọn offer trước — AI viết mail bám theo offer + nội dung.' };
  // Source-first: news must be verifiable and fresh. Write only from sources dated ≤1 month back.
  const fresh = (ctx.sources || []).filter((s) => s.url?.trim() && isFreshSource(s.date));
  if (!fresh.length) {
    const has = (ctx.sources || []).length > 0;
    return { ok: false, error: has ? `Nguồn tin đã cũ >${MAX_SOURCE_AGE_DAYS} ngày — cần nguồn ≤1 tháng để viết tin.` : 'Thêm ≥1 nguồn tin (có link + ngày ≤1 tháng) trước — mọi tin phải kiểm chứng được.' };
  }
  const client = getOpenAI();
  if (!client) return { ok: false, error: 'OpenAI client unavailable' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };

  const rows = (await db.execute(sql`
    SELECT ht.title, ht.instructions, ht.project_id, p.name, p.one_liner, p.website
      FROM human_tasks ht LEFT JOIN projects p ON p.id = ht.project_id
     WHERE ht.id = ${taskId} LIMIT 1`)) as unknown as Array<Record<string, string | null>>;
  const t = rows[0];
  if (!t) return { ok: false, error: 'task not found' };

  const audience = ctx.audience || t.name || 'the newsletter list';
  const articleLink = ctx.articleUrl?.trim() || 'ARTICLE_URL';
  const system = `You are the editor of a NEWSLETTER for a passive-income portfolio - genuine content, NOT an ad. You produce TWO things this run:
A) ARTICLE (articleMd): a full long-form piece for our OWN website (an SEO asset that also lets us measure interest). ~600-900 words, real value, clear H2 sections (use markdown ##). Deliver the actual news/insight/how-to. The offer appears ONCE, late, as the natural tool the topic makes relevant, plus a one-line disclosure ("Disclosure: we may earn a commission if you use this link, at no cost to you."). Ground every fact in the SOURCES.
B) EMAIL (bodyMd): a SHORT teaser of that article (~120-180 words) - greeting, a newsy hook, 2-3 sentences of the most useful takeaway (real value on its own), then a "read the full breakdown" link to the article, and ONE soft offer mention. It is a summary that drives the click to the article, not the whole article.
SHARED RULES:
- English only. Use "-" not em dashes. No AI-tell phrases ("in today's fast-paced world", "unlock", "dive in", "elevate", "moreover", "in conclusion"). Short paragraphs. No hype.
- LINKS: never paste a raw/naked URL as visible text. Every link is markdown anchor text [descriptive words](URL) - the offer tracking link especially.
- The SAME offer link is anchored in BOTH the article and the email.
- SOURCED NEWS ONLY: every factual claim comes from the SOURCES below. Do NOT invent statistics, dollar figures, dates, studies, or events beyond them.
- Subject lines are about the NEWS/VALUE, never the product name.`;
  const srcBlock = fresh.map((s, i) => `[${i + 1}] ${s.title || s.url} (${s.publisher || ''}${s.publisher ? ', ' : ''}${s.date}) ${s.url}`).join('\n');
  const user = `Produce the article + the email teaser for this audience.
Product/brand: ${t.name || ''}${t.website ? ` (${t.website})` : ''} — ${t.one_liner || ''}
Audience: ${audience}${ctx.segment ? ` · segment: ${ctx.segment}` : ''}
Issue topic / news angle: ${t.title || ''}
${t.instructions ? `Editor notes / angle (frame only - facts must trace to the sources):\n${t.instructions}` : ''}
SOURCES (write the news only from these - all are dated within the last month):
${srcBlock}
Ground the news in these sources and reference them naturally (e.g. "per ${fresh[0]?.publisher || 'reporting'}...").
OFFER (anchor once in BOTH, late, as the tool the topic makes relevant): ${offer}. Use markdown anchor [a few descriptive words](${ctx.offerUrl || 'OFFER_URL'}) - never the raw URL.
The email's "read the full breakdown" link points to: ${articleLink}

Return JSON: {
  "subjectA": "≤60 chars, about the news/value (NOT the product)",
  "subjectB": "≤60 chars, different news angle for A/B",
  "preheader": "≤90 chars inbox preview that extends the subject",
  "articleMd": "the full ~600-900 word article for our site: markdown with ## H2 sections, offer anchored once + disclosure line. No email greeting/footer - this is a web article.",
  "bodyMd": "the SHORT email teaser (~120-180 words): greeting, newsy hook, the key takeaway, a [read the full breakdown](${articleLink}) link, ONE soft offer anchor, then a footer line exactly: 'Unsubscribe 1-click {{unsubscribe_url}} - ${CANSPAM_FOOTER}'.",
  "keyPoints": ["3 to 5 very short bullets: the news/value beats first, then the single offer mention last"]
}`;

  try {
    const res = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2600, // article (~600-900w) + email teaser + keypoints
    });
    logAiUsage('email-prep', DEFAULT_MODEL, res.usage, t.project_id);
    const p = JSON.parse(res.choices[0]?.message?.content ?? '{}') as Record<string, unknown>;
    const s = (v: unknown) => (typeof v === 'string' ? v : '');
    const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, 5) : []);
    return { ok: true, subjectA: s(p.subjectA), subjectB: s(p.subjectB), preheader: s(p.preheader), bodyMd: s(p.bodyMd), articleMd: s(p.articleMd), keyPoints: arr(p.keyPoints) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Live send results for the card: pull Mailjet stats for this issue's CustomCampaign tag. Read-only.
// Returns nulls (not an error) when the issue has not been sent yet, so the panel can say "chưa gửi".
export interface SendStats { delivered: number; opened: number; clicked: number; bounced: number; unsub: number; spam: number; processed: number }
export interface LinkClick { url: string; label: string; clicks: number }
export async function getSendStats(taskId: number): Promise<{ ok: boolean; sentAt?: string; sentCount?: number; stats?: SendStats; links?: LinkClick[]; error?: string }> {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') return { ok: false, error: 'admin-only' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  const rows = (await db.execute(sql`
    SELECT prep_payload->'email'->>'campaignTag' AS tag,
           prep_payload->'email'->>'sentAt'      AS sent_at,
           (prep_payload->'email'->>'sentCount')::int AS sent_count
      FROM human_tasks WHERE id = ${taskId} LIMIT 1`)) as unknown as Array<{ tag: string | null; sent_at: string | null; sent_count: number | null }>;
  const r = rows[0];
  if (!r?.sent_at || !r?.tag) return { ok: true }; // not sent yet
  const MK = process.env.MAILJET_API_KEY, MS = process.env.MAILJET_SECRET;
  if (!MK || !MS) return { ok: false, error: 'Mailjet creds chưa cấu hình' };
  const auth = 'Basic ' + Buffer.from(`${MK}:${MS}`).toString('base64');
  try {
    // campaignTag is either a Mailjet CustomCampaign string (Send API) or a numeric CampaignID
    // (a newsletter's campaign). Numeric → use as SourceID directly; else resolve via /campaign.
    let cid: number | undefined;
    if (/^\d+$/.test(r.tag)) {
      cid = Number(r.tag);
    } else {
      const cr = await fetch(`https://api.mailjet.com/v3/REST/campaign?CustomCampaign=${encodeURIComponent(r.tag)}&Limit=1`, { headers: { Authorization: auth }, cache: 'no-store' });
      const cd = (await cr.json()) as { Data?: Array<{ ID: number }> };
      cid = cd.Data?.[0]?.ID;
    }
    if (!cid) return { ok: true, sentAt: r.sent_at, sentCount: r.sent_count ?? 0, stats: { delivered: 0, opened: 0, clicked: 0, bounced: 0, unsub: 0, spam: 0, processed: 0 } };
    const sr = await fetch(`https://api.mailjet.com/v3/REST/statcounters?CounterSource=Campaign&SourceID=${cid}&CounterTiming=Message&CounterResolution=Lifetime`, { headers: { Authorization: auth }, cache: 'no-store' });
    const sd = (await sr.json()) as { Data?: Array<Record<string, number>> };
    const s = sd.Data?.[0] ?? {};
    // Per-link clicks (which link pulled the click: guide vs offer vs internal).
    let links: LinkClick[] = [];
    try {
      const lr = await fetch(`https://api.mailjet.com/v3/REST/toplinkclicked?Campaign=${cid}&Limit=40`, { headers: { Authorization: auth }, cache: 'no-store' });
      const ld = (await lr.json()) as { Data?: Array<{ Url?: string; ClickedCount?: number }> };
      links = (ld.Data ?? []).map((x) => {
        const url = x.Url ?? '';
        const label = /awin1|awclick|\.(prf|pxf|sjv)\.|shareasale|anrdoezrs|dpbolvw/.test(url) ? 'Offer'
          : /\/guides\//.test(url) ? 'Bài full (guide)'
          : url.includes('/bah') ? 'BAH calc'
          : /unsub/i.test(url) ? 'Unsubscribe'
          : url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || 'link';
        return { url, label, clicks: x.ClickedCount ?? 0 };
      }).filter((l) => l.clicks > 0).sort((a, b) => b.clicks - a.clicks);
    } catch { /* per-link is best-effort */ }
    return { ok: true, sentAt: r.sent_at, sentCount: r.sent_count ?? 0, links, stats: {
      processed: s.MessageSentCount ?? 0,
      delivered: (s.MessageSentCount ?? 0) - (s.MessageHardBouncedCount ?? 0) - (s.MessageSoftBouncedCount ?? 0),
      opened: s.MessageOpenedCount ?? 0,
      clicked: s.MessageClickedCount ?? 0,
      bounced: (s.MessageHardBouncedCount ?? 0) + (s.MessageSoftBouncedCount ?? 0),
      unsub: s.MessageUnsubscribedCount ?? 0,
      spam: s.MessageSpamCount ?? 0,
    } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function saveEmailPrep(taskId: number, prep: EmailPrep): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') return { ok: false, error: 'admin-only' };
  // Can't mark an issue "ready" without a fresh, verifiable source behind the news. Draft is fine.
  if (prep.status === 'ready' && !(prep.sources || []).some((s) => s.url?.trim() && isFreshSource(s.date))) {
    return { ok: false, error: `Chưa thể "sẵn sàng gửi": cần ≥1 nguồn tin có link + ngày ≤${MAX_SOURCE_AGE_DAYS} ngày.` };
  }
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  await db.execute(sql`
    UPDATE human_tasks
       SET prep_payload = COALESCE(prep_payload, '{}'::jsonb) || jsonb_build_object('email', ${JSON.stringify(prep)}::jsonb),
           updated_at = now()
     WHERE id = ${taskId}`);
  return { ok: true };
}

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readDomains } from '@/lib/domains-store';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { logAiUsage } from '@/lib/ai/usage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const API = process.env.MAILWIZZ_API_URL || 'https://mail.on.tc/api/index.php';
const KEY = process.env.MAILWIZZ_API_KEY || '';

// Merge tags MailWizz requires in every campaign body; if the model omits them we append a footer.
const REQUIRED = ['[UNSUBSCRIBE_URL]', '[COMPANY_FULL_ADDRESS]'];

// POST /api/deliverability/generate { domain, prompt, subject? } — draft an email body with
// gpt-4o-mini from a free-form brief (promo, coupon, link to a specific page…). Admin-only.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!aiEnabled()) return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 503 });

  const { domain, prompt, subject, offers, model } = (await req.json().catch(() => ({}))) as { domain?: string; prompt?: string; subject?: string; offers?: Array<{ label?: string; url?: string; interest?: string }>; model?: string };
  const MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];
  const useModel = MODELS.includes(model || '') ? model! : DEFAULT_MODEL;
  const d = (domain || '').trim().toLowerCase();
  const brief = (prompt || '').trim();
  const links = (offers || []).filter((o) => o?.url?.trim() && o?.label?.trim());
  if (!brief && !links.length) return NextResponse.json({ error: 'Add a brief or at least one offer link' }, { status: 400 });
  const row = (await readDomains()).find((x) => x.domain === d);
  if (!row?.listUid) return NextResponse.json({ error: 'No MailWizz list mapped to this domain' }, { status: 400 });

  // Brand + sending identity from the list defaults.
  let brand = d.split('.').slice(-2).join('.');
  if (KEY) {
    const lj = await fetch(`${API}/lists/${row.listUid}`, { headers: { 'X-API-KEY': KEY }, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    brand = lj?.data?.record?.general?.display_name || lj?.data?.record?.general?.name || brand;
  }
  const site = `https://${d.split('.').slice(-2).join('.')}`;

  const sys = [
    `You write ONE marketing email for the brand "${brand}" (site ${site}).`,
    'Audience: existing opt-in subscribers who already know the brand (this is not their first email — never say "welcome" or "thanks for subscribing").',
    'Output STRICT JSON: {"subject": string, "html": string}. No markdown, no commentary.',
    'HTML rules: inline CSS only, email-safe, single container max-width 560px, system font stack.',
    'Language: English only.',
    'Personalization tag allowed: [FNAME].',
    `You MUST include these literal MailWizz tags exactly once: ${REQUIRED.join(' and ')} — put them in a small grey footer.`,
    'Every link must be a real absolute URL. If the brief names specific pages/offers, link to those; otherwise link to ' + site + '.',
    links.length
      ? 'Build the email AROUND these offer links — weave each one naturally into the copy where it fits (a sentence that leads into it), then also render it as a clear clickable CTA, using the exact URL and label. Clicks tell us each reader\'s interest:\n' + links.map((o) => `- ${o!.label} → ${o!.url}${o!.interest ? ` (interest: ${o!.interest})` : ''}`).join('\n')
      : '',
    'Keep it tight and genuinely useful — deliverability matters, so no spammy ALL-CAPS. With multiple offer links, present them as a short tidy list, not a wall.',
  ].filter(Boolean).join('\n');

  const client = getOpenAI()!;
  let res;
  try {
    res = await client.chat.completions.create({
      model: useModel,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: (brief ? `Brief: ${brief}` : 'Brief: a short, useful update that leads readers to the offer links below.') + (subject?.trim() ? `\nUse this subject verbatim: ${subject.trim()}` : '') },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 160) }, { status: 502 });
  }
  logAiUsage('warmup-email', useModel, res.usage);

  let out: { subject?: string; html?: string } = {};
  try { out = JSON.parse(res.choices[0]?.message?.content || '{}'); } catch { /* fall through */ }
  let html = (out.html || '').trim();
  const subj = (subject?.trim() || out.subject || `Update from ${brand}`).trim();
  if (!html) return NextResponse.json({ error: 'Model returned no HTML — try rephrasing the brief' }, { status: 502 });

  // Safety net: guarantee the required tags so MailWizz won't reject the draft.
  const missing = REQUIRED.filter((t) => !html.includes(t));
  if (missing.length) {
    html += `\n<p style="font-size:12px;color:#888;margin-top:24px"><a href="[UNSUBSCRIBE_URL]" style="color:#888">Unsubscribe</a>.<br>[COMPANY_FULL_ADDRESS]</p>`;
  }

  return NextResponse.json({ subject: subj, html, model: useModel, tokens: res.usage?.total_tokens ?? null });
}

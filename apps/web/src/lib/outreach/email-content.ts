// Per-project outreach EMAIL generator. The sibling touch generator (touch-content.ts) is the "poor"
// version (product + one-liner only); this is the "rich" one — it layers the project's Content Pillar
// substance (positioning / key messages / forbidden messages / voice notes) the same way the seeding
// post-draft engine does, so every project pitches ITS product, not a hardcoded MilitaryCalc template.
//
// Deliberately does NOT reuse the 6-enum community voice profiles (lurker/shitposter/…): those are
// persona voices for posting INTO a community. A 1:1 email to a site owner needs a constant, warm,
// professional founder tone — encoded fixed below. English only, human voice, no em dashes.
import { getOpenAI, DEFAULT_MODEL } from '@/lib/ai/openai';
import { stripAITells } from '@/lib/ai/humanizer';

export interface OutreachEmailCtx {
  product: string; website: string; oneLiner: string;
  ownerName: string; sourceTitle: string; sourceUrl: string; base: string;
  signer: string; isFollowup: boolean;
  // Content Pillar substance (optional — project may have no pillar yet).
  positioning?: string; keyMessages?: string[]; forbiddenMsgs?: string[]; voiceNotes?: string;
}

export async function genOutreachEmail(ctx: OutreachEmailCtx): Promise<{ subject: string; body: string } | null> {
  const ai = getOpenAI();
  if (!ai) return null;
  const site = (ctx.website || '').replace(/\/$/, '');
  const sys = [
    `You write ONE short, personal 1:1 outreach email from the founder of a product to the owner of a relevant website. You are a real person, not a marketing team.`,
    `Output ENGLISH only. Warm, specific, first person. No "I hope this finds you well", no corporate filler, no em dashes (use "-"). Never mention SEO, backlinks, or link-building.`,
    `Shape: greeting; one line who you are + the product; one line why THEIR specific page is a good fit; the concrete offer (what they get); one soft, low-pressure ask; sign off with just "${ctx.signer}".`,
    ctx.forbiddenMsgs && ctx.forbiddenMsgs.length ? `NEVER say or imply: ${ctx.forbiddenMsgs.join('; ')}.` : '',
    ctx.voiceNotes && ctx.voiceNotes.trim() ? `Voice notes for this project: ${ctx.voiceNotes.trim()}` : '',
  ].filter(Boolean).join('\n');
  const usr = [
    `PRODUCT: ${ctx.product || 'the product'}${site ? ` (${site})` : ''}${ctx.oneLiner ? ` - ${ctx.oneLiner}` : ''}`,
    ctx.positioning && ctx.positioning.trim() ? `POSITIONING: ${ctx.positioning.trim()}` : '',
    ctx.keyMessages && ctx.keyMessages.length ? `EMPHASIZE: ${ctx.keyMessages.join('; ')}` : '',
    `REACHING: ${ctx.ownerName || 'the owner'} of ${ctx.sourceTitle || ctx.sourceUrl || 'their site'}${ctx.base ? ` (topic/area: ${ctx.base})` : ''}`,
    ctx.isFollowup ? `This is a FOLLOW-UP - shorter and lighter, gently reference the earlier note without repeating it, and make it easy to say no.` : '',
    ``,
    `Return strict JSON: {"subject": "...", "body": "..."}. subject is one line, no "Re:". body is plain text with real newlines, no markdown, no placeholders like [Your Name].`,
  ].filter(Boolean).join('\n');
  try {
    const c = await ai.chat.completions.create({
      model: DEFAULT_MODEL, temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
    });
    const j = JSON.parse(c.choices[0]?.message?.content || '{}');
    const subject = stripAITells(String(j.subject || '')).trim();
    const body = stripAITells(String(j.body || '')).trim();
    if (!subject && !body) return null;
    return { subject, body };
  } catch { return null; }
}

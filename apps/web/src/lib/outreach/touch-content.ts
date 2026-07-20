// Per-channel outreach content — the voice differs sharply from email: a DM is 2-3 sentences, a
// comment ties to their post, a forum reply leads with value. English only (public content), human
// voice, no em dashes, no "backlink/SEO" mention. Reuses the channel taxonomy tip as the approach.
import { getOpenAI, DEFAULT_MODEL } from '@/lib/ai/openai';
import { CHANNEL_BY_KEY, type ChannelDef } from '@/lib/outreach/channels';

interface TouchCtx {
  product: string; website: string; oneLiner: string;
  ownerName: string; sourceTitle: string; sourceUrl: string; targetRef: string;
  channel: string; signer: string;
}

// Shape guidance per channel GROUP — keeps each message idiomatic to where it's sent.
function shapeFor(ch: ChannelDef): string {
  if (ch.key === 'comment') return 'A 1-2 sentence COMMENT under their post/page. React to their actual content first, then mention the tool in one natural clause. No greeting, no signature, no bare link dump.';
  if (ch.key === 'reddit') return 'A short REDDIT reply that leads with genuine value/answer, then mentions the tool only if it truly fits. No signature. Reddit hates ads - be a helpful peer.';
  if (ch.group === 'developer') return 'A short comment/message on a dev platform. Technical, specific, peer-to-peer. Mention the tool as something you built that fits their topic.';
  // social/messaging DM
  return 'A 2-3 sentence DIRECT MESSAGE. Warm, first person, casual. Reference their specific page/work, one line on the tool, one soft link. No formal subject, no long signature - a first name at most.';
}

export async function genChannelContent(ctx: TouchCtx): Promise<string | null> {
  const ai = getOpenAI();
  if (!ai) return null;
  const ch = CHANNEL_BY_KEY[ctx.channel];
  if (!ch) return null;
  const site = (ctx.website || '').replace(/\/$/, '');
  const sys = `You write ONE short outreach message for the "${ch.label}" channel. Output ENGLISH only. Human, specific, no "I hope this finds you well", no em dashes (use "-"), never mention SEO/backlinks/link-building.`;
  const usr = `PRODUCT: ${ctx.product}${site ? ` (${site})` : ''} - ${ctx.oneLiner}
REACHING: ${ctx.ownerName || 'the owner'} of ${ctx.sourceTitle || ctx.sourceUrl}${ctx.targetRef ? ` (via ${ctx.targetRef})` : ''}
CHANNEL: ${ch.label} - approach: ${ch.tip}
SHAPE: ${shapeFor(ch)}

Write only the message text (no quotes, no labels). Sign off with just "${ctx.signer}" only if the shape calls for a signature.`;
  try {
    const c = await ai.chat.completions.create({ model: DEFAULT_MODEL, temperature: 0.7, messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }] });
    return (c.choices[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '').trim() || null;
  } catch { return null; }
}

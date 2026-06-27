import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';
import { getOpenAI, aiEnabled } from '@/lib/ai/openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// LLM contact-resolver: trích MỌI cách liên hệ từ bio/about, GIẢI mọi kiểu obfuscation SÁNG TẠO mà regex thua
// (vd "hn @ <username> . com" + handle=tekacs → hn@tekacs.com; "on GitHub/Twitter as tekacs" → handle). Reuse
// OpenAI infra (như learn-selectors). Ext gọi khi heuristic (_collectChannels) ra thiếu → "cover lần tới không
// cần Claude thêm regex". Trả channels[] kiểu Orit (type/value/url) → ext merge vào scene_identities.scraped_meta.
export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  if (!aiEnabled()) return errorResponse('AI off', 503);

  const b = (await req.json().catch(() => ({}))) as { handle?: string; platformKey?: string; host?: string; bio?: string };
  const bio = String(b.bio || '').slice(0, 4000).trim();
  if (!bio) return errorResponse('bio required', 400);
  const handle = String(b.handle || '').trim();

  const ai = getOpenAI();
  if (!ai) return errorResponse('AI unavailable', 503);

  const sys = `Bạn trích MỌI cách liên hệ THẬT của 1 người từ profile bio (forum/HN/social). Người ta hay GIẤU email/handle kiểu sáng tạo — bạn phải GIẢI ra giá trị thật:
- "x at gmail" / "x [at] y [dot] z" → email x@gmail.com / x@y.z
- "hn @ <username> . com" (hoặc bất kỳ template có <username>/<handle>/[user]) với username = handle "${handle || '<handle>'}" → thay placeholder bằng handle thật (vd hn@${handle || '<handle>'}.com)
- "email me at X" / "reach: X" / "contact X" / "DM X" → email hoặc handle X
- "on GitHub/Twitter/Telegram/... as NAME" / "I'm NAME on X" / "@NAME on X" → handle NAME ở đúng platform đó
- link (meet.hn/..., personal site, t.me/..., keybase, gist...) → giữ nguyên url, phân loại type
QUY TẮC: CHỈ lấy contact của CHÍNH người này; BỎ placeholder không giải được, ví dụ minh hoạ, email generic (info@/noreply@/support@), và mọi thứ bịa. Nếu không chắc → bỏ.
OUTPUT JSON: {"channels":[{"type":"email|phone|website|github|twitter|linkedin|telegram|discord|mastodon|keybase|signal|youtube|instagram|...","value":"email/handle/số/host","url":"...(nếu có link)","confidence":0-100}]}. value = giá trị thật đã giải (KHÔNG kèm placeholder <...>).`;

  let channels: Array<Record<string, unknown>> = [];
  try {
    const c = await ai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: `handle: ${handle || '?'}\nplatform: ${b.platformKey || '?'}\nhost: ${b.host || '?'}\nbio:\n${bio}` },
      ],
    });
    const parsed = JSON.parse(c.choices[0]?.message?.content?.trim() || '{}');
    channels = Array.isArray(parsed.channels) ? parsed.channels : [];
  } catch (e) {
    return errorResponse((e as Error).message, 502);
  }

  // Sanitize: email phải đúng shape, value không còn placeholder <...>, dedupe.
  const out: Array<{ type: string; value: string; url: string; subtype: string; confidence: number }> = [];
  const seen = new Set<string>();
  for (const ch of channels) {
    if (!ch || !ch.type || !ch.value) continue;
    const type = String(ch.type).toLowerCase().trim();
    const value = String(ch.value).trim();
    if (!value || /[<>]/.test(value)) continue;                                  // còn placeholder → bỏ
    if (type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) continue;  // email hợp lệ
    if (type === 'email' && /^(info|noreply|no-reply|support|admin|sales|contact|hello|team|webmaster|postmaster|abuse)@/i.test(value)) continue; // generic
    const k = type + ':' + value.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    const url = ch.url ? String(ch.url) : (type === 'email' ? 'mailto:' + value : '');
    out.push({ type, value, url, subtype: 'llm', confidence: Number(ch.confidence) || 60 });
  }

  return NextResponse.json({ ok: true, channels: out.slice(0, 20) });
}

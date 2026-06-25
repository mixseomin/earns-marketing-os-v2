import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { firstRow, errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// Random password MẠNH (crypto, KHÔNG nhờ AI — AI sinh password yếu/đoán được). ≥1 mỗi lớp
// (hoa/thường/số/ký hiệu), bỏ ký tự dễ nhầm (0/O, 1/l/I). Site nào cấm symbol thì user sửa tay sau.
function genPassword(len = 16): string {
  const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', L = 'abcdefghijkmnpqrstuvwxyz', D = '23456789', S = '!@#$%^&*-_=+';
  const all = U + L + D + S;
  const b = Array.from(randomBytes(len + 4));
  const pick = (set: string, byte: number) => set.charAt(byte % set.length);
  let p = pick(U, b[0] ?? 0) + pick(L, b[1] ?? 0) + pick(D, b[2] ?? 0) + pick(S, b[3] ?? 0);
  for (let i = 0; i < len - 4; i++) p += pick(all, b[i + 4] ?? 0);
  return p;
}

// POST /api/ext/identities/generate { projectId, kind?, hint? }
// AI sinh persona preset (KHÔNG lưu) → ext fill vào form tạo identity, user review.
export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  if (!aiEnabled()) return errorResponse('AI chưa cấu hình (OPENAI_API_KEY)', 503);

  const body = await req.json().catch(() => ({})) as { projectId?: string; kind?: string; hint?: string };
  const projectId = String(body.projectId ?? '').trim();
  const kind = body.kind === 'brand' ? 'brand' : 'seeding';
  const hint = String(body.hint ?? '').trim();

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  let proj: Record<string, unknown> = {};
  if (projectId) {
    const rows = await db.execute(sql`SELECT name, bio, one_liner, persona, website FROM projects WHERE id = ${projectId} LIMIT 1`);
    proj = firstRow(rows) || {};
  }

  const ai = getOpenAI();
  if (!ai) return errorResponse('AI client unavailable', 503);
  const sys = `You generate ONE realistic online persona for ${kind === 'brand'
    ? 'an OFFICIAL brand account'
    : 'a community seeding account (an anonymous-feeling regular member, NOT obviously promotional)'}. Output STRICT JSON only.`;
  const user = `Project: ${proj.name ?? ''} — ${proj.one_liner ?? ''}
Brand bio: ${proj.bio ?? ''}
Brand persona/voice: ${proj.persona ?? ''}
Kind: ${kind}${hint ? `\nExtra hint: ${hint}` : ''}

Generate a persona to create a forum/social account. JSON shape EXACTLY:
{
  "name": "<short preset name, e.g. 'Founder Persona' or 'Astro Lurker 2'>",
  "handleBase": "<username, lowercase, letters/numbers/underscore, 4-16 chars, no spaces>",
  "email": "<plausible email matching handle>",
  "displayName": "<display name>",
  "bio": "<short bio 1-2 sentences, in English>",
  "persona": { "name_first": "", "name_last": "", "gender": "", "country": "", "city": "", "interests": ["",""], "backstory": "<2-3 sentence backstory>" }
}
${kind === 'seeding' ? 'Anonymous regular member vibe. Do NOT mention the brand.' : 'Professional brand representative.'}`;

  try {
    const completion = await ai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      temperature: 0.9,
    });
    let out: Record<string, unknown> = {};
    try { out = JSON.parse(completion.choices[0]?.message?.content || '{}'); } catch { /* ignore */ }
    out.password = genPassword();   // luôn kèm password random mạnh → tạo identity ko bị thiếu (create encrypt)
    return NextResponse.json({ ok: true, identity: out });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'AI gen fail', 500);
  }
}

import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getDb, identities } from '@mos2/db';
import { eq } from 'drizzle-orm';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';

export const dynamic = 'force-dynamic';

// POST /api/ext/profile-fields/suggest
// Body: { identityId?, fields:[{key,label,current?}] }
// → { ok, values:{ key: value } }
// AI điền giá trị HỒ SƠ (Location/Occupation/About you/Website…) khớp persona của
// identity. Field cần dữ liệu thật cá nhân / không liên quan (Steam ID, Friend Code,
// phone, dob) → để chuỗi RỖNG. User review rồi mới Lưu vào identity.customFields +
// account.persona (KHÔNG tự ghi đè — xem feedback_no_silent_overrides).
export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  if (!aiEnabled()) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not set' }, { status: 503 });
  const openai = getOpenAI();
  if (!openai) return NextResponse.json({ ok: false, error: 'AI unavailable' }, { status: 503 });

  const body = await req.json().catch(() => ({})) as { identityId?: number; fields?: Array<{ key?: string; label?: string; current?: string }> };
  const fields = (body.fields || []).filter((f) => f && (f.key || f.label)).slice(0, 24);
  if (!fields.length) return NextResponse.json({ ok: false, error: 'fields required' }, { status: 400 });

  // Context identity (persona) để AI điền cho khớp giọng/nhân vật.
  let idn: { name: string; handleBase: string; displayName: string; bio: string; persona: unknown; customFields: unknown } | undefined;
  if (body.identityId) {
    const db = getDb();
    if (db) {
      const [r] = await db.select({
        name: identities.name, handleBase: identities.handleBase, displayName: identities.displayName,
        bio: identities.bio, persona: identities.persona, customFields: identities.customFields,
      }).from(identities).where(eq(identities.id, Number(body.identityId))).limit(1);
      idn = r;
    }
  }
  // persona json có sẵn (sinh lúc tạo identity): country, city, gender, interests[],
  // backstory, name_first/last → ĐÂY là NGUỒN sự thật cho Location/About/Gender…
  const p = (idn?.persona && typeof idn.persona === 'object') ? idn.persona as Record<string, unknown> : {};
  const cf = (idn?.customFields && typeof idn.customFields === 'object') ? idn.customFields as Record<string, unknown> : {};
  const ctx = idn
    ? `Persona NHÂN VẬT (nguồn sự thật — derive từ đây, KHÔNG bịa mới):\n`
      + `- name: ${idn.name} | display: ${idn.displayName} | handle: ${idn.handleBase}\n`
      + `- bio: ${idn.bio}\n`
      + `- country: ${String(p.country ?? '')} | city: ${String(p.city ?? '')} | gender: ${String(p.gender ?? '')}\n`
      + `- interests: ${Array.isArray(p.interests) ? (p.interests as unknown[]).join(', ') : ''}\n`
      + `- backstory: ${typeof p.backstory === 'string' ? p.backstory : ''}\n`
      + `- persona (raw): ${JSON.stringify(idn.persona).slice(0, 400)}\n`
      + `- giá trị ĐÃ LƯU (canonical — TÁI DÙNG y hệt nếu khớp field): ${JSON.stringify(cf).slice(0, 400)}`
    : 'Persona: (chưa gắn identity — điền trung tính, tự nhiên)';
  const list = fields.map((f) => `- key=${f.key} | label="${f.label || f.key}"${f.current ? ` | đang có="${f.current}"` : ''}`).join('\n');
  const prompt = `Điền hồ sơ (profile) cho 1 tài khoản theo NHÂN VẬT persona dưới đây.\n${ctx}\n\n`
    + `Các field cần điền:\n${list}\n\n`
    + `Quy tắc DERIVE (suy từ persona, KHÔNG chế dữ liệu mới để giữ NHẤT QUÁN mọi site):\n`
    + `- location/place/từ địa lý → ghép "city, country" của persona (vd "Hanoi, Vietnam"). Thiếu city → chỉ country.\n`
    + `- about/bio/intro/description/summary → từ bio + backstory (1-2 câu, English tự nhiên, KHÔNG markdown/em-dash).\n`
    + `- gender → đúng gender persona. pronoun/pronouns → suy từ gender (he / she / they).\n`
    + `- occupation/job/work → suy hợp lý từ backstory/interests (1 nghề ngắn). website/url → "" trừ khi persona ngụ ý có.\n`
    + `- Nếu field trùng "giá trị ĐÃ LƯU" → trả ĐÚNG giá trị đó (canonical, không đổi). Giữ "đang có" nếu đã hợp lý.\n`
    + `- Field cần DỮ LIỆU THẬT/định danh ngoài (Steam ID, Friend Code, phone, ID số, ngày sinh nếu persona không có) → trả chuỗi RỖNG "" (user điền tay).\n`
    + `Trả JSON: {"values":{"<key>":"<value>"}}. CHỈ JSON, không giải thích.`;

  try {
    const res = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });
    const txt = res.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(txt) as { values?: Record<string, unknown> };
    const values: Record<string, string> = {};
    for (const f of fields) {
      const k = f.key || ''; if (!k) continue;
      const v = parsed.values?.[k];
      if (typeof v === 'string' && v.trim()) values[k] = v.trim().slice(0, 600);
    }
    return NextResponse.json({ ok: true, values });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

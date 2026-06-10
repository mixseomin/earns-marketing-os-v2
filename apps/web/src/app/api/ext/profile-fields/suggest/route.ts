import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getDb, identities, projects, platformAccounts } from '@mos2/db';
import { eq } from 'drizzle-orm';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';

// Field hồ sơ trỏ tới WEBSITE chính của dự án → fill thẳng project.website (canonical,
// ko để LLM bịa / bỏ trống). Account đại diện dự án nên dùng web chính thức.
const WEBSITE_FIELD = /(^|_)(website|url|site|homepage|link|web)($|_)?/i;

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

  const body = await req.json().catch(() => ({})) as { identityId?: number; projectId?: string; accountId?: number; fields?: Array<{ key?: string; label?: string; current?: string }> };
  const fields = (body.fields || []).filter((f) => f && (f.key || f.label)).slice(0, 24);
  if (!fields.length) return NextResponse.json({ ok: false, error: 'fields required' }, { status: 400 });

  // Brand DỰ ÁN = nguồn sự thật cho profile (account đại diện dự án). Load qua projectId
  // hoặc accountId → project. website/oneLiner/bio/hashtags dùng để fill + làm ngữ cảnh.
  let proj: { name: string; website: string; oneLiner: string; bio: string; hashtags: string; persona: string } | undefined;
  const db0 = getDb();
  if (db0) {
    let pid = (body.projectId || '').trim();
    if (!pid && body.accountId) {
      const [a] = await db0.select({ projectId: platformAccounts.projectId }).from(platformAccounts).where(eq(platformAccounts.id, Number(body.accountId))).limit(1);
      pid = a?.projectId || '';
    }
    if (pid) {
      const [pr] = await db0.select({ name: projects.name, website: projects.website, oneLiner: projects.oneLiner, bio: projects.bio, hashtags: projects.hashtags, persona: projects.persona })
        .from(projects).where(eq(projects.id, pid)).limit(1);
      proj = pr;
    }
  }

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
  // Ngữ cảnh DỰ ÁN (account đại diện dự án) — fill về brand chính thức.
  const brand = proj
    ? `\nDỰ ÁN account đại diện (DÙNG brand này, KHÔNG bịa):\n`
      + `- name: ${proj.name}\n- website CHÍNH THỨC: ${proj.website || '(chưa có)'}\n`
      + `- one-liner: ${proj.oneLiner}\n- bio: ${proj.bio}\n- hashtags: ${proj.hashtags}\n`
      + `- brand persona: ${proj.persona.slice(0, 300)}`
    : '\nDỰ ÁN: (chưa load brand)';

  // Website chính chủ → fill THẲNG từ project.website (canonical), bỏ qua LLM cho field này.
  const forced: Record<string, string> = {};
  if (proj?.website) {
    for (const f of fields) {
      const k = (f.key || '').toLowerCase(); const lb = (f.label || '').toLowerCase();
      if (WEBSITE_FIELD.test(k) || WEBSITE_FIELD.test(lb)) forced[f.key || ''] = proj.website;
    }
  }
  const llmFields = fields.filter((f) => !(f.key && forced[f.key]));

  const list = llmFields.map((f) => `- key=${f.key} | label="${f.label || f.key}"${f.current ? ` | đang có="${f.current}"` : ''}`).join('\n');
  const prompt = `Điền hồ sơ (profile) cho 1 tài khoản ĐẠI DIỆN DỰ ÁN dưới đây. Profile phục vụ dự án → ưu tiên brand dự án, persona nhân vật chỉ bổ trợ giọng.\n${ctx}\n${brand}\n\n`
    + `Các field cần điền:\n${list || '(không có — đã fill hết)'}\n\n`
    + `Quy tắc DERIVE (ưu tiên brand dự án → persona; KHÔNG chế dữ liệu mới để NHẤT QUÁN mọi site):\n`
    + `- website/url/link/homepage → website CHÍNH THỨC của dự án ("${proj?.website || ''}"). Trống thì "".\n`
    + `- about/bio/intro/description/summary → từ one-liner + bio của DỰ ÁN (account quảng bá dự án), pha giọng persona; 1-2 câu English tự nhiên, KHÔNG markdown/em-dash.\n`
    + `- location/place → "city, country" của persona (vd "Hanoi, Vietnam"). Thiếu city → chỉ country.\n`
    + `- gender → đúng gender persona. pronoun/pronouns → suy từ gender (he / she / they).\n`
    + `- occupation/job/headline/tagline → suy từ vai trò với dự án (vd founder/maker) + brand, ngắn gọn.\n`
    + `- Nếu field trùng "giá trị ĐÃ LƯU" → trả ĐÚNG giá trị đó. Giữ "đang có" nếu đã hợp lý.\n`
    + `- Field cần DỮ LIỆU THẬT/định danh ngoài (Steam ID, Friend Code, phone, ID số, dob nếu thiếu) → "" (user điền tay).\n`
    + `Trả JSON: {"values":{"<key>":"<value>"}}. CHỈ JSON, không giải thích.`;

  // Nếu LLM ko còn field nào (chỉ có website forced) → trả luôn forced.
  if (!llmFields.length) return NextResponse.json({ ok: true, values: forced });

  try {
    const res = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });
    const txt = res.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(txt) as { values?: Record<string, unknown> };
    const values: Record<string, string> = { ...forced };   // website canonical luôn thắng
    for (const f of fields) {
      const k = f.key || ''; if (!k || values[k]) continue;
      const v = parsed.values?.[k];
      if (typeof v === 'string' && v.trim()) values[k] = v.trim().slice(0, 600);
    }
    return NextResponse.json({ ok: true, values });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getDb, identities, projects, platformAccounts } from '@mos2/db';
import { eq } from 'drizzle-orm';
import { resolveProjectViaTask } from '@/lib/resolve-project-via-task';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { logAiUsage } from '@/lib/ai/usage';
import { errorResponse } from '@/lib/ext-route';

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
  const err = await checkAuth(req); if (err) return err;
  if (!aiEnabled()) return errorResponse('OPENAI_API_KEY not set', 503);
  const openai = getOpenAI();
  if (!openai) return errorResponse('AI unavailable', 503);

  const body = await req.json().catch(() => ({})) as { identityId?: number; projectId?: string; accountId?: number; pageIntent?: string; launchName?: string; platform?: string; pinnedProjectId?: string; launchPage?: boolean; host?: string; pinForce?: boolean; regenerate?: boolean; focus?: string; fields?: Array<{ key?: string; label?: string; current?: string; maxLen?: number }> };
  const regenerate = !!body.regenerate;   // 🤖 "Sinh mới" → BỎ tái dùng giá trị persona đã lưu, LLM sinh tươi mới
  const focus = ['project', 'task'].includes(String(body.focus)) ? String(body.focus) : 'full';   // nhấn brand / nhấn task / cân bằng
  const fields = (body.fields || []).filter((f) => f && (f.key || f.label)).slice(0, 24);
  if (!fields.length) return errorResponse('fields required', 400);
  const pageIntent = String(body.pageIntent || '').slice(0, 160);
  const launchName = String(body.launchName || '').trim().slice(0, 80);
  // Giới hạn ký tự per-field (ext gửi từ maxlength/counter) → nhắc AI + cap output.
  const maxByKey: Record<string, number> = {};
  for (const f of fields) { if (f.key && typeof f.maxLen === 'number' && f.maxLen > 0) maxByKey[f.key] = Math.floor(f.maxLen); }

  // Brand DỰ ÁN = nguồn sự thật cho profile (account đại diện dự án). Load qua projectId
  // hoặc accountId → project. website/oneLiner/bio/hashtags dùng để fill + làm ngữ cảnh.
  let proj: { name: string; website: string; oneLiner: string; bio: string; hashtags: string; persona: string } | undefined;
  // Giá trị ĐÃ LƯU trên account (cột email + persona jsonb) → AI TÁI DÙNG y hệt, ko sinh mới /
  // ko để trống (vd email đã lưu → điền lại đúng nó).
  let acctEmail = ''; let acctPersona: Record<string, unknown> = {};
  let taskCtx = '';   // nhiệm vụ account đang được giao (task title) → mission context cho AI
  const db0 = getDb();
  if (db0) {
    let pid = (body.projectId || '').trim();
    if (body.accountId) {
      const aid = Number(body.accountId);
      const [a] = await db0.select({ projectId: platformAccounts.projectId, email: platformAccounts.email, persona: platformAccounts.persona })
        .from(platformAccounts).where(eq(platformAccounts.id, aid)).limit(1);
      if (a) { if (!pid) pid = a.projectId || ''; acctEmail = a.email || ''; acctPersona = (a.persona && typeof a.persona === 'object') ? a.persona as Record<string, unknown> : {}; }
    }
    // Brand THEO TASK account đang được giao (account cá nhân launch nhiều SP) → launchName fallback → home.
    // Logic dùng CHUNG với /project-brand (SAVE) qua resolveProjectViaTask — không lệch fill↔save.
    const resolved = await resolveProjectViaTask(db0, { accountId: body.accountId, homeProjectId: pid, launchName, platform: (body.platform || '').trim(), pinnedProjectId: (body.pinnedProjectId || '').trim(), launchPage: !!body.launchPage, host: (body.host || '').trim(), pinForce: !!body.pinForce });
    pid = resolved.projectId; taskCtx = resolved.taskTitle;
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

  // Forced = giá trị CANONICAL, fill thẳng, bỏ qua LLM. Ưu tiên: giá trị account đã lưu
  // (email cột / persona) → website dự án. AI ko sinh lại / ko để trống cái đã có.
  const EMAIL_FIELD = /(^|_)e?mail($|_)/i;
  const forced: Record<string, string> = {};
  for (const f of fields) {
    const key = f.key || ''; if (!key) continue;
    const k = key.toLowerCase(); const lb = (f.label || '').toLowerCase();
    // 1) account.persona đã có key này → tái dùng y hệt (nhất quán mọi site). regenerate → BỎ, để LLM sinh mới.
    //    LAUNCH page: 1 account submit NHIỀU sản phẩm → brand-content (tagline/desc/name) là PER-PROJECT,
    //    KHÔNG tái dùng persona cũ (dính SP trước, vd tagline militarycalc khi launch visagps) → luôn derive
    //    từ project brand đã resolve. Email/website vẫn canonical ở nhánh 2/3 dưới.
    const pv = acctPersona[key]; if (!regenerate && !body.launchPage && typeof pv === 'string' && pv.trim()) { forced[key] = pv.trim(); continue; }
    // 2) email field + account.email đã lưu → điền lại.
    if ((EMAIL_FIELD.test(k) || EMAIL_FIELD.test(lb)) && acctEmail) { forced[key] = acctEmail; continue; }
    // 3) website field → website chính thức dự án.
    if ((WEBSITE_FIELD.test(k) || WEBSITE_FIELD.test(lb)) && proj?.website) { forced[key] = proj.website; continue; }
  }
  const llmFields = fields.filter((f) => !(f.key && forced[f.key]));

  const list = llmFields.map((f) => `- key=${f.key} | label="${f.label || f.key}"${f.current ? ` | đang có="${f.current}"` : ''}${f.maxLen ? ` | GIỚI HẠN ≤${Math.floor(f.maxLen)} KÝ TỰ` : ''}`).join('\n');
  const prompt = `Điền hồ sơ (profile) cho 1 tài khoản ĐẠI DIỆN DỰ ÁN dưới đây. Profile phục vụ dự án → ưu tiên brand dự án, persona nhân vật chỉ bổ trợ giọng.\n${ctx}\n${brand}${taskCtx ? `\nNHIỆM VỤ account đang được giao (task): "${taskCtx}" → sinh nội dung PHỤC VỤ nhiệm vụ này (brand ở trên đã theo project của task).` : ''}${launchName ? `\nSẢN PHẨM đang launch trên trang: "${launchName}".` : ''}${pageIntent ? `\nNgữ cảnh TRANG: ${pageIntent}` : ''}\n\n`
    + `Các field cần điền:\n${list || '(không có — đã fill hết)'}\n\n`
    + `Quy tắc DERIVE (ưu tiên brand dự án → persona; KHÔNG chế dữ liệu mới để NHẤT QUÁN mọi site):\n`
    + (regenerate ? `- SINH MỚI: BỎ QUA "đang có" + giá trị đã lưu — viết nội dung KHÁC, tươi mới, đa dạng (đừng lặp y hệt). Vẫn đúng brand/persona/task.\n` : '')
    + (focus === 'task' && taskCtx ? `- FOCUS TASK: viết BÁM SÁT nhiệm vụ "${taskCtx}" (mục tiêu/hành động của task này).\n` : '')
    + (focus === 'project' ? `- FOCUS PROJECT: tập trung mô tả SẢN PHẨM + giá trị brand dự án; persona nhân vật chỉ là giọng, ko lấn.\n` : '')
    + `- GIỚI HẠN ký tự: field ghi "≤N KÝ TỰ" thì kết quả PHẢI ≤ N ký tự (đếm cả dấu cách). Viết ngắn, súc tích, đủ ý — thà ngắn hơn còn hơn vượt.\n`
    + `- website/url/link/homepage → website CHÍNH THỨC của dự án ("${proj?.website || ''}"). Trống thì "".\n`
    + `- about/bio/intro/description/summary/headline/tagline → 1-2 câu English tự nhiên, KHÔNG markdown/em-dash. ƯU TIÊN one-liner + bio DỰ ÁN; nếu brand dự án THIẾU/RỖNG thì derive từ persona nhân vật (bio/backstory/interests). LUÔN sinh ra nội dung — KHÔNG để trống các field giới thiệu này.\n`
    + `- location/place → "city, country" của persona (vd "Hanoi, Vietnam"). Thiếu city → chỉ country.\n`
    + `- gender → đúng gender persona. pronoun/pronouns → suy từ gender (he / she / they).\n`
    + `- occupation/job/headline/tagline → suy từ vai trò với dự án (vd founder/maker) + brand, ngắn gọn.\n`
    + `- MỌI field VĂN BẢN TỰ DO mô tả bản thân (currently learning, available for, skills/languages, what I'm working on, currently hacking on, hobbies, interests, fun fact, "about you"…) → LUÔN sinh 1-2 câu English tự nhiên từ persona (interests/backstory/bio) + lĩnh vực dự án. TUYỆT ĐỐI KHÔNG để trống — field sáng tạo, suy diễn hợp lý được. KHÔNG markdown/em-dash.\n`
    + `- Nếu field trùng "giá trị ĐÃ LƯU" → trả ĐÚNG giá trị đó. Giữ "đang có" nếu đã hợp lý.\n`
    + `- CHỈ field định danh/dữ liệu THẬT ngoài đời (phone, government/Steam/Friend ID, mã số, 2FA, dob khi persona ko có) → "" (user nhập tay). Field mô tả/sáng tạo thì KHÔNG được trống.\n`
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
    logAiUsage('profile-fill', DEFAULT_MODEL, res.usage, body.projectId || null);
    const txt = res.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(txt) as { values?: Record<string, unknown> };
    // Cap theo maxLen (an toàn nếu LLM vẫn vượt) — cắt ở ranh giới từ gần nhất, ko giữa từ.
    const capLen = (s: string, max: number) => { if (!max || s.length <= max) return s; const cut = s.slice(0, max); const sp = cut.lastIndexOf(' '); return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trim(); };
    const values: Record<string, string> = { ...forced };   // website canonical luôn thắng
    for (const f of fields) {
      const k = f.key || ''; if (!k || values[k]) continue;
      const v = parsed.values?.[k];
      if (typeof v === 'string' && v.trim()) values[k] = capLen(v.trim().slice(0, 600), maxByKey[k] || 0);
    }
    return NextResponse.json({ ok: true, values });
  } catch (e) {
    return errorResponse((e as Error).message, 500);
  }
}

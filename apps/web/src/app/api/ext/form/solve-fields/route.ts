import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { getOpenAI, aiEnabled } from '@/lib/ai/openai';
import { firstRow, errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/form/solve-fields
// AI điền field đăng ký KHÔNG nằm sẵn trong identity — 2 loại trong 1 call multimodal:
//   1. CAPTCHA kiến thức (logic gate / điện / toán / "ảnh gì"): tính đáp án CHÍNH XÁC.
//      Volatile (đổi mỗi lần ĐK) → savable=false, ext KHÔNG lưu vào identity.
//   2. PERSONA field (Откуда/location, city, occupation, website…): sinh value KHỚP persona,
//      reuse được → savable=true, ext lưu identity.customFields dùng lại lần sau.
// Body: { projectId?, identityId?, fields: [{ key, label, question?, type?, options?[], images?[] }] }
//   images = data-URL base64 (ext fetch <img> với cookie session) hoặc http URL.
// Output: { ok, answers: [{ key, value, savable }] }
// Model gpt-4o (vision chuẩn cho mạch điện/linh kiện; mini đọc glyph nhỏ kém).

const MODEL = 'gpt-4o';
const MAX_FIELDS = 12;
const MAX_IMAGES = 6;

type InField = { key?: string; label?: string; question?: string; type?: string; options?: string[]; images?: string[] };

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;
  if (!aiEnabled()) return errorResponse('OPENAI_API_KEY chưa cấu hình', 503);

  const body = await req.json().catch(() => ({})) as { projectId?: string; identityId?: number; fields?: InField[] };
  const fields = Array.isArray(body.fields) ? body.fields.filter((f) => f && f.key).slice(0, MAX_FIELDS) : [];
  if (!fields.length) return errorResponse('fields required', 400);

  // Persona (nếu có identity) → field location/age/… sinh KHỚP, ko bịa lệch.
  let persona: Record<string, unknown> = {};
  if (body.identityId) {
    const db = getDb();
    if (db) {
      const r = firstRow(await db.execute(sql`
        SELECT name, handle_base, display_name, bio, persona, custom_fields
        FROM identities WHERE id = ${Number(body.identityId)} LIMIT 1`));
      if (r) persona = r;
    }
  }

  const client = getOpenAI()!;
  let imgBudget = MAX_IMAGES;
  // 1 message multimodal: mô tả persona + từng field (text) kèm ảnh của field đó ngay sau.
  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: 'high' } }> = [];
  content.push({ type: 'text', text: `PERSONA (dùng cho field hồ sơ, GIỮ NHẤT QUÁN — KHÔNG cho field captcha kiến thức):\n${JSON.stringify(persona)}` });
  for (const f of fields) {
    const opts = Array.isArray(f.options) && f.options.length ? `\n  options (CHỌN ĐÚNG 1): ${JSON.stringify(f.options.slice(0, 40))}` : '';
    content.push({ type: 'text', text: `FIELD key="${f.key}" | label/câu hỏi: ${f.label || ''}${f.question && f.question !== f.label ? ' — ' + f.question : ''} | type: ${f.type || 'text'}${opts}` });
    const imgs = Array.isArray(f.images) ? f.images.filter((u) => typeof u === 'string' && (u.startsWith('data:image') || /^https?:\/\//.test(u))) : [];
    for (const url of imgs) {
      if (imgBudget <= 0) break;
      imgBudget--;
      content.push({ type: 'image_url', image_url: { url, detail: 'high' } });
    }
  }

  const sys = `Bạn điền form đăng ký/anti-bot của diễn đàn. Với MỖI field trả về value TỐT NHẤT để nhập:
- CÂU HỎI KIẾN THỨC / CAPTCHA (toán, điện tử, logic gate, "ảnh là gì", giá trị điện trở/áp…): tính ĐÁP ÁN CHÍNH XÁC từ đề + ảnh. Đây là volatile → "savable": false.
- FIELD HỒ SƠ (location/Откуда, city, country, occupation, website, age…): sinh value KHỚP PERSONA (reuse thuộc tính persona nếu có). reuse được → "savable": true.
Quy tắc value:
- type select/radio + có options: trả về ĐÚNG 1 chuỗi trong options.
- Số: chỉ trả con số (kèm đơn vị CHỈ khi đề/đáp án ngầm yêu cầu, vd "5V" nếu hỏi điện áp; "1000" nếu hỏi "tính bằng ом").
- Ngắn gọn = đúng giá trị nhập vào ô, KHÔNG giải thích.
Trả về STRICT JSON: {"answers":[{"key":"<key>","value":"<giá trị>","savable":true|false}]}. Đủ MỌI field, đúng key.`;

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'system', content: sys }, { role: 'user', content }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 900,
    });
    let parsed: { answers?: Array<{ key?: string; value?: unknown; savable?: unknown }> } = {};
    try { parsed = JSON.parse(completion.choices[0]?.message?.content || '{}'); } catch { /* ignore */ }
    const valid = new Set(fields.map((f) => f.key));
    const answers = (parsed.answers || [])
      .filter((a) => a && a.key && valid.has(a.key))
      .map((a) => ({ key: String(a.key), value: a.value == null ? '' : String(a.value), savable: a.savable === true }));
    return NextResponse.json({ ok: true, answers });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'AI solve fail', 500);
  }
}

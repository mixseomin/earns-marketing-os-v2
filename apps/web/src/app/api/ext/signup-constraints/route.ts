import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, platforms } from '@mos2/db';
import { checkAuth } from '../_auth';
import { getEffectiveSignupFields, type SignupField } from '@/lib/actions/technologies';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { mechCanon } from '@/lib/selector-field-canon';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// Ràng buộc signup TÍCH LUỸ per-platform (lộ lúc submit: "password ≥15", "cần phone"…).
// Lưu vào platforms.signupFields (validation props minLength/maxLength/pattern/notes/required)
// → lần sau reg platform đó (project/account khác) HIỆN TRƯỚC + Fill chọn giá trị khớp.
// GET ?platformKey=  → effective signup fields (merge tech+platform) = "yêu cầu".
// POST { platformKey, field }            → upsert 1 field vào platforms.signupFields.
// POST { platformKey, parseError:"..." } → AI bóc lỗi → field constraint → upsert + trả.

async function upsertPlatformField(db: ReturnType<typeof getDb>, platformKey: string, field: Partial<SignupField> & { key: string }) {
  if (!db) return;
  const [p] = await db.select({ sf: platforms.signupFields }).from(platforms).where(eq(platforms.key, platformKey)).limit(1);
  if (!p) return;
  const cur = (Array.isArray(p.sf) ? p.sf : []) as SignupField[];
  const idx = cur.findIndex((f) => f.key === field.key);
  const existing = idx >= 0 ? cur[idx] : undefined;
  const { key: _k, ...fieldRest } = field;
  const merged = {
    ...(existing ?? {}),
    ...fieldRest,
    key: field.key,
    label: field.label ?? existing?.label ?? field.key,
    type: (field.type ?? existing?.type ?? 'text') as SignupField['type'],
    required: field.required ?? existing?.required ?? false,
  } as SignupField;
  const next = idx >= 0 ? cur.map((f, i) => (i === idx ? merged : f)) : [...cur, merged];
  await db.update(platforms).set({ signupFields: next, updatedAt: new Date() }).where(eq(platforms.key, platformKey));
}

export async function GET(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const key = (new URL(req.url).searchParams.get('platformKey') ?? '').trim();
  if (!key) return errorResponse('platformKey required', 400);
  const fields = await getEffectiveSignupFields(key);
  // "constraints" = field có ràng buộc đáng hiện (required / minLength / maxLength / pattern / notes).
  const constraints = fields.filter((f) => f.required || f.minLength != null || f.maxLength != null || f.pattern || f.notes);
  return NextResponse.json({ ok: true, platformKey: key, fields, constraints });
}

export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const body = await req.json().catch(() => ({})) as { platformKey?: string; field?: Partial<SignupField> & { key?: string }; parseError?: string };
  const key = (body.platformKey ?? '').trim();
  if (!key) return errorResponse('platformKey required', 400);

  // AI bóc lỗi submit → 1 field constraint.
  if (typeof body.parseError === 'string' && body.parseError.trim()) {
    if (!aiEnabled()) return errorResponse('OPENAI_API_KEY not set', 503);
    const openai = getOpenAI();
    if (!openai) return errorResponse('AI unavailable', 503);
    const prompt = `Thông báo lỗi khi đăng ký tài khoản: "${body.parseError.slice(0, 500)}".\n`
      + `Bóc thành 1 ràng buộc field signup. Field key chuẩn: username|email|password|password_confirm|display_name|phone|dob|captcha hoặc snake_case khác.\n`
      + `Trả JSON: {"key","label","type":"text|email|phone|date|select","required":bool,"minLength":number|null,"maxLength":number|null,"pattern":string|null,"notes":"mô tả ngắn tiếng Việt"}. CHỈ JSON.`;
    try {
      const res = await openai.chat.completions.create({ model: DEFAULT_MODEL, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.2 });
      const parsed = JSON.parse(res.choices?.[0]?.message?.content || '{}') as Partial<SignupField> & { key?: string };
      if (!parsed.key) return errorResponse('AI không bóc được field', 422);
      const field = {
        key: mechCanon(String(parsed.key)).slice(0, 28),
        label: String(parsed.label || parsed.key).slice(0, 60),
        type: (parsed.type || 'text') as SignupField['type'],
        required: !!parsed.required,
        ...(typeof parsed.minLength === 'number' ? { minLength: parsed.minLength } : {}),
        ...(typeof parsed.maxLength === 'number' ? { maxLength: parsed.maxLength } : {}),
        ...(parsed.pattern ? { pattern: String(parsed.pattern) } : {}),
        ...(parsed.notes ? { notes: String(parsed.notes).slice(0, 160) } : {}),
      };
      await upsertPlatformField(db, key, field);
      return NextResponse.json({ ok: true, platformKey: key, field });
    } catch (e) { return errorResponse((e as Error).message, 500); }
  }

  // Upsert field thủ công.
  if (body.field && typeof body.field === 'object' && body.field.key) {
    await upsertPlatformField(db, key, { ...body.field, key: String(body.field.key) });
    return NextResponse.json({ ok: true, platformKey: key, field: body.field });
  }
  return errorResponse('field or parseError required', 400);
}

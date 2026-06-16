import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { mechCanon } from '@/lib/selector-field-canon';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/reg-steps/suggest
// Body: { scope:'platform'|'habitat', context:{ name?, type?, rules? } }
// → { ok, steps:[{key,label}] } — AI gợi ý bước sau-đăng-ký (platform) / vào-nhóm
// (habitat) theo context. User review + lưu (không tự ghi đè). Cách "sinh steps cho
// platform/habitat MỚI": default có sẵn + nút này gợi ý đặc thù + sửa tay.
export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  if (!aiEnabled()) return errorResponse('OPENAI_API_KEY not set', 503);
  const openai = getOpenAI();
  if (!openai) return errorResponse('AI unavailable', 503);

  const body = await req.json().catch(() => ({})) as { scope?: string; context?: Record<string, unknown> };
  const scope = body.scope === 'habitat' ? 'habitat' : 'platform';
  const ctx = body.context || {};
  const what = scope === 'habitat'
    ? `các bước CẦN LÀM để được DUYỆT VÀO cộng đồng "${ctx.name ?? ''}" (loại: ${ctx.type ?? '?'}). Ví dụ: trả lời câu hỏi vào nhóm, đăng bài giới thiệu, chờ mod duyệt.`
    : `các bước SAU KHI ĐĂNG KÝ tài khoản trên nền tảng "${ctx.name ?? ''}" để dùng được. Ví dụ: xác minh email, xác minh SĐT, hoàn tất profile, chờ admin duyệt.`;
  const rules = ctx.rules ? `\nQuy định liên quan: ${String(ctx.rules).slice(0, 800)}` : '';
  const prompt = `Liệt kê 3-6 ${what}${rules}\n`
    + `Trả về JSON: {"steps":[{"key":"snake_case_ascii","label":"nhãn tiếng Việt ngắn gọn"}]}. CHỈ JSON, không giải thích.`;

  try {
    const res = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    const txt = res.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(txt) as { steps?: Array<{ key?: string; label?: string }> };
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps
        .filter((s) => s && s.label)
        .map((s) => ({ key: mechCanon(String(s.key || s.label)).slice(0, 28) || 'step', label: String(s.label).slice(0, 80) }))
        .slice(0, 8)
      : [];
    return NextResponse.json({ ok: true, scope, steps });
  } catch (e) {
    return errorResponse((e as Error).message, 500);
  }
}

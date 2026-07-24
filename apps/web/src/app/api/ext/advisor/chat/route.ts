import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { logAiUsage } from '@/lib/ai/usage';
import { firstRow, errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

type Msg = { role: 'user' | 'assistant'; content: string };

// POST /api/ext/advisor/chat { message, host?, platform?, projectId?, identityId?, accountHandle?, taskId?, history? }
// Kênh CHAT của Crew advisor (Artifact H4 "thread nhận xét" + §06 "A hỏi → học"). Trả lời NGẮN, tiếng Việt (chat nội bộ),
// grounded theo context site/identity/account/task. KHÔNG tự tạo/sửa data — chỉ tư vấn + chỉ chỗ thao tác (an toàn).
export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  if (!aiEnabled()) return errorResponse('AI chưa cấu hình (OPENAI_API_KEY)', 503);
  const b = (await req.json().catch(() => ({}))) as {
    message?: string; host?: string; platform?: string; projectId?: string;
    identityId?: string | number; accountHandle?: string; taskId?: string | number; history?: Msg[];
  };
  const message = String(b.message ?? '').trim();
  if (!message) return errorResponse('message required', 400);

  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const ctx: string[] = [];
  if (b.host) ctx.push(`Site đang mở: ${b.host}${b.platform ? ` (platform ${b.platform})` : ''}`);

  if (b.projectId) {
    try { const r = await db.execute(sql`SELECT name, one_liner, bio FROM projects WHERE id = ${String(b.projectId)} LIMIT 1`); const p = firstRow(r); if (p) ctx.push(`Project đang follow: ${p.name} — ${p.one_liner ?? p.bio ?? ''}`); } catch { /* ignore */ }
  }
  if (b.identityId) {
    try { const r = await db.execute(sql`SELECT name, handle_base, email, kind, bio FROM identities WHERE id = ${String(b.identityId)} LIMIT 1`); const i = firstRow(r); if (i) ctx.push(`Identity đang chọn: ${i.name} (@${i.handle_base ?? ''}, kind ${i.kind ?? ''}, email ${i.email || 'CHƯA CÓ'})`); } catch { /* ignore */ }
  }
  if (b.accountHandle && b.platform) {
    try { const r = await db.execute(sql`SELECT handle, status, account_type FROM platform_accounts WHERE handle = ${String(b.accountHandle)} AND platform_key = ${String(b.platform)} LIMIT 1`); const a = firstRow(r); if (a) ctx.push(`Account trên site: @${a.handle} (status ${a.status ?? ''}, loại ${a.account_type ?? ''})`); } catch { /* ignore */ }
  }
  if (b.taskId) {
    try { const r = await db.execute(sql`SELECT title, mechanism, instructions FROM human_tasks WHERE id = ${String(b.taskId)} LIMIT 1`); const t = firstRow(r); if (t) ctx.push(`Task backlink: ${t.title} — cách đặt: ${t.mechanism ?? ''}`); } catch { /* ignore */ }
  }
  if (b.platform) {
    try { const r = await db.execute(sql`SELECT notes FROM platforms WHERE key = ${String(b.platform)} LIMIT 1`); const p = firstRow(r); if (p && p.notes) ctx.push(`Ghi chú platform: ${String(p.notes).slice(0, 600)}`); } catch { /* ignore */ }
  }

  const ai = getOpenAI(); if (!ai) return errorResponse('AI chưa cấu hình', 503);
  const sys = `Bạn là "Crew Advisor" — trợ lý seeding/backlink của 1 operator solo, chạy trong extension trên trang web đang mở. Nhiệm vụ: giúp anh ấy XỬ LÝ TÀI KHOẢN (đăng ký / đăng nhập / chọn identity) + SEEDING + BACKLINK trên site này.
Quy tắc:
- Trả lời TIẾNG VIỆT, NGẮN GỌN (2-5 câu / vài gạch đầu dòng), thực dụng. Xưng "em", gọi user "anh".
- Bám context được cấp; KHÔNG bịa số liệu/handle/email.
- Advisor KHÔNG tự tạo/sửa dữ liệu. Nếu anh cần TẠO identity mới hoặc điền field còn thiếu (vd email) → chỉ chỗ: bấm "＋ Tạo danh tính mới" (có nút AI sinh persona) hoặc mục "📇 Quản lý" để thêm/sửa. Nếu anh mô tả cách đặt link / mechanism site lạ → tóm tắt lại thành các bước rõ để em ghi nhớ.
- Nếu thiếu thông tin để trả lời đúng → HỎI LẠI 1 câu cụ thể.
Context hiện tại:
${ctx.length ? ctx.map((c) => '- ' + c).join('\n') : '- (chưa có context cụ thể)'}`;

  const history = Array.isArray(b.history) ? b.history.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content).slice(-8) : [];
  const messages = [{ role: 'system' as const, content: sys }, ...history.map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) })), { role: 'user' as const, content: message.slice(0, 2000) }];
  try {
    const completion = await ai.chat.completions.create({ model: DEFAULT_MODEL, messages, temperature: 0.5, max_tokens: 500 });
    logAiUsage('advisor-chat', DEFAULT_MODEL, completion.usage, b.projectId ? String(b.projectId) : null);
    return NextResponse.json({ ok: true, reply: String(completion.choices[0]?.message?.content ?? '').trim() });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'AI chat fail', 500);
  }
}

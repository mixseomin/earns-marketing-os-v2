import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { logAiUsage } from '@/lib/ai/usage';
import { firstRow, rows, errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

type Msg = { role: 'user' | 'assistant'; content: string };

// POST /api/ext/advisor/chat { message, host?, platform?, projectId?, identityId?, accountHandle?, taskId?, history? }
// Kênh CHAT của Crew advisor (Artifact H4 "thread nhận xét" + §06 "A hỏi → học") + CRUD entity qua chat.
// AI = parse intent → PROPOSE 1 op CRUD (resolve target + check trùng). KHÔNG tự thực thi ở đây —
//   ext thực thi qua endpoint có sẵn + confirm (xoá phải confirm, tạo-trùng thì hỏi). Trả action:'entity_op'.
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
  let curProjectName = '';
  if (b.projectId) {
    try { const r = await db.execute(sql`SELECT name, one_liner, bio FROM projects WHERE id = ${String(b.projectId)} LIMIT 1`); const p = firstRow(r); if (p) { curProjectName = String(p.name); ctx.push(`Project đang follow: ${p.name} — ${p.one_liner ?? p.bio ?? ''}`); } } catch { /* ignore */ }
  }
  try { const r = await db.execute(sql`SELECT name FROM projects ORDER BY name LIMIT 40`); const names = rows<{ name?: string }>(r).map((x) => x.name).filter(Boolean); if (names.length) ctx.push(`Các project có sẵn: ${names.join(', ')}`); } catch { /* ignore */ }
  if (b.identityId) {
    try { const r = await db.execute(sql`SELECT name, handle_base, email, kind FROM identities WHERE id = ${String(b.identityId)} LIMIT 1`); const i = firstRow(r); if (i) ctx.push(`Identity đang chọn: ${i.name} (@${i.handle_base ?? ''}, kind ${i.kind ?? ''}, email ${i.email || 'CHƯA CÓ'})`); } catch { /* ignore */ }
  }
  if (b.accountHandle && b.platform) {
    try { const r = await db.execute(sql`SELECT handle, status, account_type FROM platform_accounts WHERE handle = ${String(b.accountHandle)} AND platform_key = ${String(b.platform)} LIMIT 1`); const a = firstRow(r); if (a) ctx.push(`Account trên site: @${a.handle} (status ${a.status ?? ''}, loại ${a.account_type ?? ''})`); } catch { /* ignore */ }
  }
  if (b.platform) {
    try { const r = await db.execute(sql`SELECT notes FROM platforms WHERE key = ${String(b.platform)} LIMIT 1`); const p = firstRow(r); if (p && p.notes) ctx.push(`Ghi chú platform: ${String(p.notes).slice(0, 500)}`); } catch { /* ignore */ }
  }

  const ai = getOpenAI(); if (!ai) return errorResponse('AI chưa cấu hình', 503);
  const sys = `Bạn là "Crew Advisor" — trợ lý seeding/backlink của 1 operator solo, chạy trong extension trên trang đang mở. Giúp anh ấy xử lý TÀI KHOẢN + SEEDING + BACKLINK, và QUẢN LÝ entity qua chat.
Quy tắc:
- Trả lời TIẾNG VIỆT, NGẮN GỌN, thực dụng. Xưng "em", gọi user "anh". KHÔNG bịa số liệu.
- Khi anh yêu cầu TẠO / SỬA / XOÁ entity (identity=danh tính · account=tài khoản · approach=phương án tiếp cận) → GỌI tool manage_entity với op tương ứng. Tự nghĩ field hợp lý khi tạo (name/handle/bio/voice hợp project+niche; email/password ĐỂ TRỐNG cho anh thêm alias thật).
- Tool CHỈ ĐỀ XUẤT — hệ thống sẽ hỏi xác nhận khi XOÁ, và hỏi lại khi TẠO trùng. Anh không cần lo, cứ nêu ý định.
- Xoá/sửa: nêu rõ entity nào (handle/tên/title) để em resolve đúng.
- Câu hỏi thường (tư vấn site/cách đặt link) → trả lời text, KHÔNG gọi tool. Thiếu info → hỏi lại 1 câu.
Context:
${ctx.length ? ctx.map((c) => '- ' + c).join('\n') : '- (chưa có context)'}`;

  const history = Array.isArray(b.history) ? b.history.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content).slice(-8) : [];
  const messages = [{ role: 'system' as const, content: sys }, ...history.map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) })), { role: 'user' as const, content: message.slice(0, 2000) }];
  const tools = [{
    type: 'function' as const,
    function: {
      name: 'manage_entity',
      description: 'Đề xuất 1 thao tác CRUD lên entity (identity/account/approach) khi operator yêu cầu tạo/sửa/xoá. Hệ thống sẽ xác nhận trước khi xoá & hỏi khi tạo trùng.',
      parameters: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['create', 'update', 'delete'] },
          entityType: { type: 'string', enum: ['identity', 'account', 'approach'] },
          match: { type: 'string', description: 'Với update/delete: handle/tên/title để tìm entity (vd "liquidator101").' },
          fields: {
            type: 'object', description: 'Với create/update. identity: {name,kind(personal|brand|seeding),handleBase,bio,voice,email,projectName}. account: {handle,platform,status,accountType(personal|brand|seeding),notes,projectName}. approach: {title,category,angle,tags(mảng)}.',
            properties: {
              name: { type: 'string' }, kind: { type: 'string' }, handleBase: { type: 'string' }, bio: { type: 'string' }, voice: { type: 'string' }, email: { type: 'string' }, projectName: { type: 'string' },
              handle: { type: 'string' }, platform: { type: 'string' }, status: { type: 'string' }, accountType: { type: 'string' }, notes: { type: 'string' },
              title: { type: 'string' }, category: { type: 'string' }, angle: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        required: ['op', 'entityType'],
      },
    },
  }];

  const resolveProject = async (nm?: string): Promise<{ id: string; name: string } | null> => {
    if (nm) { try { const r = await db.execute(sql`SELECT id, name FROM projects WHERE name ILIKE ${'%' + nm + '%'} OR id = ${nm} ORDER BY name LIMIT 1`); const p = firstRow(r); if (p) return { id: String(p.id), name: String(p.name) }; } catch { /* ignore */ } return null; }
    if (b.projectId) return { id: String(b.projectId), name: curProjectName };
    return null;
  };

  try {
    const completion = await ai.chat.completions.create({ model: DEFAULT_MODEL, messages, tools, tool_choice: 'auto', temperature: 0.4, max_tokens: 500 });
    logAiUsage('advisor-chat', DEFAULT_MODEL, completion.usage, b.projectId ? String(b.projectId) : null);
    const choice = completion.choices[0];
    const tc = (choice?.message?.tool_calls ?? []).find((t) => t.function?.name === 'manage_entity');
    if (!tc) return NextResponse.json({ ok: true, reply: String(choice?.message?.content ?? '').trim() || 'Anh nói rõ hơn giúp em nhé?' });

    let a: { op?: string; entityType?: string; match?: string; fields?: Record<string, unknown> } = {};
    try { a = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }
    const op = String(a.op || ''); const et = String(a.entityType || ''); const f = (a.fields || {}) as Record<string, unknown>;
    const str = (k: string) => String(f[k] ?? '').trim();

    // ── CREATE: dựng payload + check trùng (dup → ext hỏi) ──
    if (op === 'create') {
      if (et === 'identity') {
        const name = str('name'); const handleBase = str('handleBase').toLowerCase().replace(/[^a-z0-9_.-]+/g, '');
        if (!name || !handleBase) return NextResponse.json({ ok: true, reply: 'Em cần tên + handle để tạo identity. Anh cho gợi ý nhé?' });
        const proj = await resolveProject(str('projectName'));
        let dup = null; try { const r = await db.execute(sql`SELECT id, name FROM identities WHERE handle_base = ${handleBase} LIMIT 1`); const d = firstRow(r); if (d) dup = `${d.name} (@${handleBase})`; } catch { /* ignore */ }
        const payload = { name, kind: ['personal', 'brand', 'seeding'].includes(str('kind')) ? str('kind') : 'seeding', handleBase, bio: str('bio'), email: str('email'), projectId: proj?.id || null, persona: { voice: str('voice') } };
        return NextResponse.json({ ok: true, action: 'entity_op', op, entityType: et, fields: payload, label: `${payload.kind} ${name} @${handleBase}`, dup, reply: dup ? `Đã có identity ${dup}. Anh muốn vẫn TẠO MỚI hay dùng cái cũ?` : `Em chuẩn bị tạo identity ${name} @${handleBase}${proj ? ` cho ${proj.name}` : ''}.` });
      }
      if (et === 'account') {
        const handle = str('handle'); const platform = str('platform') || b.platform || '';
        if (!handle || !platform) return NextResponse.json({ ok: true, reply: 'Em cần handle + platform để tạo account. Anh cho biết nhé?' });
        const proj = await resolveProject(str('projectName'));
        let dup = null; try { const r = await db.execute(sql`SELECT id FROM platform_accounts WHERE handle = ${handle} AND platform_key = ${platform} LIMIT 1`); if (firstRow(r)) dup = `@${handle} trên ${platform}`; } catch { /* ignore */ }
        const payload = { handle, platform, status: str('status') || 'active', accountType: ['personal', 'brand', 'seeding'].includes(str('accountType')) ? str('accountType') : 'seeding', notes: str('notes'), authMethod: 'manual', projectId: proj?.id || null };
        return NextResponse.json({ ok: true, action: 'entity_op', op, entityType: et, fields: payload, label: `@${handle} · ${platform}`, dup, reply: dup ? `Đã có account ${dup}. Vẫn tạo mới?` : `Em chuẩn bị tạo account @${handle} trên ${platform}.` });
      }
      if (et === 'approach') {
        const title = str('title'); const angle = str('angle');
        if (!title) return NextResponse.json({ ok: true, reply: 'Em cần title cho approach. Anh đặt tên ngắn nhé?' });
        let dup = null; try { const r = await db.execute(sql`SELECT id FROM approach_playbooks WHERE title ILIKE ${title} LIMIT 1`); if (firstRow(r)) dup = `"${title}"`; } catch { /* ignore */ }
        const tags = Array.isArray(f.tags) ? (f.tags as unknown[]).map((t) => String(t)).filter(Boolean) : [];
        const payload = { title, angle: angle || title, category: str('category'), tags };
        return NextResponse.json({ ok: true, action: 'entity_op', op, entityType: et, fields: payload, label: `approach "${title}"`, dup, reply: dup ? `Đã có approach ${dup}. Vẫn tạo mới?` : `Em chuẩn bị tạo approach "${title}".` });
      }
    }

    // ── UPDATE / DELETE: resolve target theo match ──
    if (op === 'update' || op === 'delete') {
      const match = String(a.match || '').trim();
      if (!match) return NextResponse.json({ ok: true, reply: `Anh cho em biết ${et} nào cần ${op === 'delete' ? 'xoá' : 'sửa'} (handle/tên/title)?` });
      let id = 0, label = '';
      try {
        if (et === 'identity') { const r = await db.execute(sql`SELECT id, name, handle_base FROM identities WHERE handle_base ILIKE ${'%' + match + '%'} OR name ILIKE ${'%' + match + '%'} ORDER BY id LIMIT 2`); const rs = rows<{ id: number; name: string; handle_base: string }>(r); const o = rs[0]; if (rs.length > 1) return NextResponse.json({ ok: true, reply: `Có nhiều identity khớp "${match}". Anh nói rõ handle chính xác giúp em.` }); if (o) { id = o.id; label = `${o.name} (@${o.handle_base})`; } }
        else if (et === 'account') { const r = await db.execute(sql`SELECT id, handle, platform_key FROM platform_accounts WHERE handle ILIKE ${'%' + match + '%'}${b.platform ? sql` AND platform_key = ${b.platform}` : sql``} ORDER BY id LIMIT 2`); const rs = rows<{ id: number; handle: string; platform_key: string }>(r); const o = rs[0]; if (rs.length > 1) return NextResponse.json({ ok: true, reply: `Nhiều account khớp "${match}". Anh nói rõ platform/handle giúp em.` }); if (o) { id = o.id; label = `@${o.handle} · ${o.platform_key}`; } }
        else if (et === 'approach') { const r = await db.execute(sql`SELECT id, title FROM approach_playbooks WHERE title ILIKE ${'%' + match + '%'} ORDER BY id LIMIT 2`); const rs = rows<{ id: number; title: string }>(r); const o = rs[0]; if (rs.length > 1) return NextResponse.json({ ok: true, reply: `Nhiều approach khớp "${match}". Anh nói rõ title giúp em.` }); if (o) { id = o.id; label = `"${o.title}"`; } }
      } catch { /* ignore */ }
      if (!id) return NextResponse.json({ ok: true, reply: `Em không thấy ${et} nào khớp "${match}".` });
      if (op === 'update') {
        const fields: Record<string, unknown> = {};
        ['name', 'kind', 'handleBase', 'bio', 'email', 'status', 'accountType', 'notes', 'category', 'angle', 'title'].forEach((k) => { if (f[k] != null && String(f[k]).trim() !== '') fields[k] = f[k]; });
        if (str('voice')) fields.persona = { voice: str('voice') };
        if (Array.isArray(f.tags)) fields.tags = (f.tags as unknown[]).map((t) => String(t));
        if (!Object.keys(fields).length) return NextResponse.json({ ok: true, reply: `Anh muốn sửa field gì của ${label}?` });
        return NextResponse.json({ ok: true, action: 'entity_op', op, entityType: et, id, fields, label, reply: `Em cập nhật ${label}: ${Object.keys(fields).join(', ')}.` });
      }
      // delete → confirm phía ext
      return NextResponse.json({ ok: true, action: 'entity_op', op, entityType: et, id, label, reply: `Anh chắc chắn XOÁ ${et} ${label}? Bấm nút xoá để xác nhận.` });
    }

    return NextResponse.json({ ok: true, reply: String(choice?.message?.content ?? '').trim() || 'Em chưa rõ ý, anh nói lại giúp nhé?' });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'AI chat fail', 500);
  }
}

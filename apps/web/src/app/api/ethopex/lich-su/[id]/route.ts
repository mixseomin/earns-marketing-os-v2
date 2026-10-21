import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { goiEthopex } from '@mos2/db/ethopex';
import { getCurrentUser } from '@/lib/auth';

// NHẬT KÝ THAY ĐỔI MỘT CAMP Ethopex (anh 22/10/2026: "nhớ phải log mọi thay đổi trong từng camp") — ngăn chi tiết camp ở tab Ethopex gọi khi mở.
// Hai nguồn gộp lại: (1) lịch sử của chính Ethopex (/campaigns/<id>/history — MỌI thay đổi, kể cả người khác chỉnh tay trên Ethopex: ai, đổi gì,
// trước → sau) và (2) nhật ký luật của máy (studio xv_khoa_ngoai['ethopex_nhat_ky'] do lam-ethopex.py ghi: luật nào kích hoạt, ai duyệt / máy tự).
// Một thay đổi có ở cả hai nguồn (cùng ngân sách đích, cách nhau < 10 phút) thì ghép thành một dòng có kèm luật.
type Ls = { created_at: string; action_label?: string; actor_name?: string; actor_type?: string; source_label?: string; changes?: { field: string; field_label?: string; old: unknown; new: unknown }[] };
type Nk = { luc: string; viec: string; id: number; truoc: number | null; sau: number | null; ok: boolean; loi: string | null; luat: string; ai: string };
export type DongNhatKy = { luc: string; viec: string; truoc: string | null; sau: string | null; ai: string; luat: string | null; loi: string | null };

const vnIso = (s: string) => { const m = s.match(/^(\d{2}):(\d{2}) (\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[5]}-${m[4]}-${m[3]}T${m[1]}:${m[2]}:00+07:00` : s; };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') return NextResponse.json({ ok: false, error: 'admin-only' }, { status: 403 });
  const id = Number((await params).id); const db = getDb();
  if (!db || !id) return NextResponse.json({ ok: false, error: 'thiếu DB / id' }, { status: 400 });
  const [ls, nk] = await Promise.all([
    goiEthopex<{ data: Ls[] }>(db, `/api/v1/campaigns/${id}/history`),
    db.execute(sql`SELECT x FROM xv_khoa_ngoai, jsonb_array_elements(gia_tri) x WHERE ten = 'ethopex_nhat_ky' AND (x->>'id')::int = ${id}`) as unknown as Promise<{ x: Nk }[]>,
  ]);
  const luat = (nk as { x: Nk }[]).map((r) => r.x);
  const dung = new Set<number>();
  const ra: DongNhatKy[] = [];
  for (const h of ls.ok ? ls.data.data : []) {
    for (const c of h.changes ?? []) {
      if (h.action_label === 'Change requested') continue;   // dòng "yêu cầu" đi đôi với dòng đổi thật — chỉ giữ dòng đổi
      const la = /budget/.test(c.field) ? 'ngân sách' : c.field === 'state' ? 'trạng thái' : c.field === 'source_status' ? null : c.field_label ?? c.field;
      if (!la) continue;
      const t = Date.parse(h.created_at);
      const k = luat.findIndex((n, i) => !dung.has(i) && n.ok && Math.abs(Date.parse(vnIso(n.luc)) - t) < 10 * 60_000 && (la === 'ngân sách' ? String(n.sau) === String(c.new) : n.viec === 'tat'));
      if (k >= 0) dung.add(k);
      ra.push({ luc: h.created_at, viec: la, truoc: c.old == null ? null : String(c.old), sau: c.new == null ? null : String(c.new),
        ai: k >= 0 ? luat[k]!.ai : `${h.actor_name ?? h.actor_type ?? '?'}${h.source_label ? ` · ${h.source_label}` : ''}`, luat: k >= 0 ? luat[k]!.luat : null, loi: null });
    }
  }
  // dòng nhật ký máy không khớp lịch sử Ethopex (lệnh hỏng / bị chặn) — vẫn hiện để biết đã thử gì
  luat.forEach((n, i) => { if (!dung.has(i) && (!n.ok || !ls.ok)) ra.push({ luc: vnIso(n.luc), viec: n.viec === 'tat' ? 'trạng thái' : 'ngân sách', truoc: n.truoc == null ? null : String(n.truoc), sau: n.sau == null ? null : String(n.sau), ai: n.ai, luat: n.luat, loi: n.ok ? null : n.loi }); });
  ra.sort((a, b) => Date.parse(b.luc) - Date.parse(a.luc));
  return NextResponse.json({ ok: true, dong: ra, loi: ls.ok ? null : ls.loi });
}

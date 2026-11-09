'use server';
// BỐ CỤC WIDGET tab Tổng quan 2 etp (etp.bo_cuc, migration 0393): bố cục đang dùng tự lưu mỗi lần kéo thả · template riêng theo tên · bản mặc định cho team (chỉ chủ đặt).
// Mọi bố cục qua hopLe (sổ etp-widget.json) trước khi ghi — client gửi ô lạ / chồng / vượt màn thì từ chối.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import { hopLe, TEN_DANG, TEN_TEAM, type O } from '@/lib/etp-widget';

export type BoCucDoc = { dang: O[] | null; rieng: { ten: string; o: O[] }[]; team: O[] | null };

async function ai() { const me = await getCurrentUser(); const q = await quyenEtp(me); return me && q ? { id: me.id, q } : null; }

export async function docBoCuc(): Promise<BoCucDoc | { loi: string }> {
  const a = await ai(); if (!a) return { loi: 'không có quyền' };
  const rs = (await getDb()!.execute(sql`select user_id::int u, ten, o from etp.bo_cuc where user_id = ${a.id} or (user_id = 0 and ten = ${TEN_TEAM}) order by cap_nhat`)) as unknown as { u: number; ten: string; o: unknown }[];
  const ok = (v: unknown) => hopLe(v);   // sổ widget đổi (bỏ widget) thì bố cục cũ không còn hợp lệ → coi như chưa có, rơi về mặc định
  return {
    dang: ok(rs.find((r) => r.u === a.id && r.ten === TEN_DANG)?.o),
    rieng: rs.filter((r) => r.u === a.id && !r.ten.startsWith('__')).flatMap((r) => { const o = ok(r.o); return o ? [{ ten: r.ten, o }] : []; }),
    team: ok(rs.find((r) => r.u === 0 && r.ten === TEN_TEAM)?.o),
  };
}

/** ten = TEN_DANG (tự lưu) hoặc tên template riêng (≤ 40 ký tự, không bắt đầu bằng "__") */
export async function luuBoCuc(ten: string, o: unknown): Promise<{ ok: true } | { loi: string }> {
  const a = await ai(); if (!a) return { loi: 'không có quyền' };
  const t = String(ten ?? '').trim();
  if (t !== TEN_DANG && (!t || t.length > 40 || t.startsWith('__'))) return { loi: 'tên template 1–40 ký tự' };
  const v = hopLe(o); if (!v) return { loi: 'bố cục không hợp lệ (ô lạ, chồng nhau hoặc vượt màn)' };
  await getDb()!.execute(sql`insert into etp.bo_cuc (user_id, ten, o) values (${a.id}, ${t}, ${JSON.stringify(v)}::jsonb)
    on conflict (user_id, ten) do update set o = excluded.o, cap_nhat = now()`);
  return { ok: true };
}

/** bản mặc định cho team — chỉ chủ (admin mos2) */
export async function datBoCucTeam(o: unknown): Promise<{ ok: true } | { loi: string }> {
  const a = await ai(); if (!a || a.q.vai !== 'chu') return { loi: 'chỉ chủ đặt mặc định cho team' };
  const v = hopLe(o); if (!v) return { loi: 'bố cục không hợp lệ' };
  await getDb()!.execute(sql`insert into etp.bo_cuc (user_id, ten, o) values (0, ${TEN_TEAM}, ${JSON.stringify(v)}::jsonb)
    on conflict (user_id, ten) do update set o = excluded.o, cap_nhat = now()`);
  return { ok: true };
}

'use server';
// CHỜ ANH DUYỆT (anh 22/11/2026 "Tao cần duyệt trên page này cơ mà !"): creative máy giữ lại (etp.cho_anh_duyet, view etp.cham_cong cột cho_duyet — 0460)
// hiện ở etp2 › Camp. Duyệt = ghi cham_duyet ok (duyetCham — cùng nút Đạt cũ) rồi lên camp $1 bằng đúng đường nút "Lên camp" (lenCampCr → nhan-ban, giờ chạy theo lich_len:
// ngoài 07–12h VN hẹn 07:00). Loại = cham_duyet ok=false. Không tự lên khi chưa bấm — view chặn mọi đường lên camp khác.

import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { duyetCham } from '@/lib/actions/etp-cham';
import { lenCampCr } from '@/lib/actions/etp-dong';

export type ChoDuyet = {
  creative_id: number; content_id: number | null; phim: string | null; lang: string | null; dang: string | null; video: string | null; anh: string | null;
  ghi: string; tao: string; duyet: boolean | null; diem_thap: string | null; camp_id: number | null; trang_thai: string | null; nhat_ky: string | null;
  /** '1|5' = máy lên ★ ROAS 1 · $5 thay camp $1 (etp.cau_hinh.len_cr_roas, apps/etp/lenh_cho.py — anh 22/11/2026) */ roas: string | null;
};

const run = async <T,>(s: ReturnType<typeof sql>) => (await getDb()!.execute(s)) as unknown as T[];

/** tail nhật ký lên camp của nút (lenCampCr ghi /tmp/etp-len-cr-<cr>.log trên máy chạy web) — để lỗi KÊU TO dưới nút */
function nhatKy(cr: number): string | null {
  try { const t = readFileSync(`/tmp/etp-len-cr-${cr}.log`, 'utf8').trim(); return t ? t.split('\n').slice(-3).join('\n').slice(-400) : null; } catch { return null; }
}

/** creative đang giữ: chưa duyệt, hoặc đã duyệt mà chưa có camp (đang lên / lên hỏng), hoặc vừa lên camp trong 24 giờ (để anh thấy kết quả) */
export async function dsChoDuyet(): Promise<{ ds: ChoDuyet[]; dungKhan: boolean } | { loi: string }> {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') return { loi: 'chỉ admin' };
  const ds = await run<Omit<ChoDuyet, 'nhat_ky'>>(sql`select h.creative_id, r.content_id, f.ten phim, r.lang, r.dang, r.video, r.anh, h.ghi, h.tao::text tao, u.ok duyet,
      (select string_agg(e.k || ' ' || e.v, ', ' order by e.v::numeric) from etp.cham c, jsonb_each_text(c.diem) e(k, v)
        where c.creative_id = h.creative_id and (e.k like 'meta.%' or e.k like 'afs.%') and e.v::numeric <= 4) diem_thap,
      k.camp_id, k.trang_thai,
      (select (x.gia_tri -> h.creative_id::text ->> 'roas') || '|' || (x.gia_tri -> h.creative_id::text ->> 'ns') from etp.cau_hinh x where x.khoa = 'len_cr_roas') roas
    from etp.cho_anh_duyet_cr h join etp.creative r on r.creative_id = h.creative_id left join etp.phim f on f.content_id = r.content_id
      left join etp.cham_duyet u on u.creative_id = h.creative_id
      left join lateral (select c.camp_id, c.trang_thai from etp.camp c where c.creative_id = h.creative_id order by c.camp_id desc limit 1) k on true
    where (u.ok is null) or (u.ok and (k.camp_id is null or u.luc > now() - interval '24 hours'))
    order by (u.ok is null) desc, h.tao, h.creative_id`);
  const [dk] = await run<{ v: boolean }>(sql`select coalesce((select gia_tri = 'true'::jsonb from etp.cau_hinh where khoa = 'dung_khan'), false) v`);
  return { ds: ds.map((x) => ({ ...x, creative_id: Number(x.creative_id), camp_id: x.camp_id == null ? null : Number(x.camp_id), nhat_ky: x.duyet && !x.camp_id ? nhatKy(Number(x.creative_id)) : null })), dungKhan: !!dk?.v };
}

/** ✓ Duyệt → ghi duyệt + lên camp $1; ✕ Loại → ghi loại. Phanh đang bật (dừng khẩn…): duyệt = XẾP HÀNG, máy tự lên camp ở nhịp đầu phanh nhả
 *  (apps/etp/lenh_cho.py len_cr — anh 22/11/2026 "thằng ngu !": không bắt anh bấm lại) */
export async function duyetChoAnh(cr: number, ok: boolean): Promise<{ ok: true; chu: string } | { loi: string }> {
  const id = Math.trunc(Number(cr));
  const [h] = await run<{ x: number }>(sql`select 1 x from etp.cho_anh_duyet_cr where creative_id = ${id}`);
  if (!h) return { loi: `creative #${id} không nằm trong danh sách chờ anh duyệt` };
  const d = await duyetCham(id, ok);
  if ('loi' in d) return d;
  if (!ok) return { ok: true, chu: `đã loại creative #${id} — không lên camp` };
  return lenCamp(id);
}

/** lên camp cho creative đã duyệt (bấm lại sau khi lên hỏng / dừng khẩn) */
export async function lenCamp(cr: number): Promise<{ ok: true; chu: string } | { loi: string }> {
  const id = Math.trunc(Number(cr));
  const [dk] = await run<{ v: boolean }>(sql`select coalesce((select gia_tri = 'true'::jsonb from etp.cau_hinh where khoa = 'dung_khan'), false) v`);
  if (dk?.v) return { ok: true, chu: `đã duyệt #${id} — xếp hàng: máy tự lên camp ở nhịp đầu nhả dừng khẩn, giờ chạy theo lịch` };
  // creative trong sổ ★ ROAS (len_cr_roas): KHÔNG đi đường $1 — lenh_cho.py lên ★ ROAS ở nhịp worker kế (một creative một camp)
  const [ro] = await run<{ x: number }>(sql`select 1 x from etp.cau_hinh where khoa = 'len_cr_roas' and gia_tri ? ${String(id)}`);
  if (ro) return { ok: true, chu: `đã duyệt #${id} — máy lên ★ ROAS ở nhịp worker kế (apps/etp/lenh_cho.py), giờ chạy theo lịch` };
  const r = await lenCampCr(-1, id);
  if ('loi' in r) return { loi: `Đã ghi DUYỆT #${id}, nhưng chưa lên camp: ${r.loi}` };
  return { ok: true, chu: `đã gửi lệnh lên camp $1 cho creative #${id} — giờ chạy theo lịch (ngoài 07–12h VN hẹn 07:00); dòng này tự hiện số camp khi xong` };
}

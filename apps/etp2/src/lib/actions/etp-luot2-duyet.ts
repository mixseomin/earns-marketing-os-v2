'use server';
// LƯỢT 2 KIỂU K CHỜ ANH DUYỆT (anh 26/11/2026 "các camp + creative đều phải chờ duyệt mới được push lên" · "trừ creative clone, hoặc đã từng đc duyệt thì ko cần nữa.
// Camp lên kiểu Dol cũng ko cần duyệt nếu Creative đã passed"): apps/etp/luot2.py xếp dòng kiểu đích trong sổ luot2.duyet (kien) vào tt 'cho_duyet' (0483) — máy KHÔNG tạo
// creative / camp tới khi anh bấm. ✓ = tt 'dang' (máy DỰNG trong giờ luot2.khung 07–21h, camp hẹn CHẠY ở khung 22h — lich theo lich_len) · ✕ = tt 'bo'.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';

const run = async <T,>(s: ReturnType<typeof sql>) => (await getDb()!.execute(s)) as unknown as T[];

export type Luot2Cho = { cr_goc: number; camp_goc: number | null; content_id: number | null; phim: string | null; lang: string | null;
  kieu_goc: string | null; bo_goc: string | null; kieu_moi: string | null; bo_moi: string | null; tao: string | null; chi_goc: number | null; doanh_goc: number | null };

export async function dsLuot2Cho(): Promise<{ ds: Luot2Cho[] } | { loi: string }> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return { loi: 'chỉ admin' };
  try {
    const ds = await run<Luot2Cho>(sql`select l.cr_goc, l.camp_goc, l.content_id, f.ten phim, l.lang, l.kieu_goc, l.bo_goc, l.kieu_moi, l.bo_moi,
        to_char(l.luc at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') tao,
        (select round(sum(s.chi)::numeric, 2)::float from etp.so_ngay_ca s where s.camp_id = l.camp_goc) chi_goc,
        (select round(sum(s.thu)::numeric, 2)::float from etp.so_ngay_ca s where s.camp_id = l.camp_goc) doanh_goc
      from etp.luot2 l left join etp.phim f on f.content_id = l.content_id where l.tt = 'cho_duyet' order by f.ten nulls last, l.cr_goc`);
    return { ds };
  } catch (e) { return { loi: String((e as Error).message ?? e) }; }
}

export async function duyetLuot2(crs: number[], ok: boolean): Promise<{ ok: true; chu: string } | { loi: string }> {
  const me = await getCurrentUser(); if (me?.role !== 'admin') return { loi: 'chỉ admin được duyệt lượt 2' };
  const ids = crs.filter((c) => Number.isInteger(c) && c > 0); if (!ids.length) return { loi: 'không có creative nào' };
  const ai = me.email ?? String(me.id);
  try {
    const xs = sql.join(ids.map((c) => sql`${c}`), sql`, `);
    const r = await run<{ cr_goc: number }>(ok
      ? sql`update etp.luot2 set tt = 'dang', ly = null, lan = 0, duyet_ai = ${ai}, duyet_luc = now(), cap_nhat = now() where tt = 'cho_duyet' and cr_goc in (${xs}) returning cr_goc`
      : sql`update etp.luot2 set tt = 'bo', ly = 'anh không duyệt (camp kiểu K)', duyet_ai = ${ai}, duyet_luc = now(), cap_nhat = now() where tt = 'cho_duyet' and cr_goc in (${xs}) returning cr_goc`);
    if (!r.length) return { loi: 'không dòng nào đổi — đã có người duyệt / máy đã đổi trạng thái, tải lại ô' };
    return { ok: true, chu: ok ? `đã duyệt ${r.length} camp K — máy dựng sẵn trong giờ 07–21h VN (4 camp / nhịp), camp hẹn CHẠY ở khung 22h kế tiếp` : `đã bỏ ${r.length} camp K` };
  } catch (e) { return { loi: String((e as Error).message ?? e) }; }
}

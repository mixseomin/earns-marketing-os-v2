'use server';
// LỊCH TRIỂN KHAI + ĐIỀU KHIỂN TỪNG PHIM (anh 06/11/2026 "Show cái icon lịch. Hover vào thì xem được lịch triển khai của từng phim để đạt mục tiêu" ·
// "thêm chức năng … tăng camp loại A, B… giảm số camp… quá trình sx đang diễn ra có lỗi gì ko" · "các đồng hồ đang có chưa dùng đến à" ·
// "Phần có thể điều khiển + plan thì chỉ show ở tk của David"): bấm đồng hồ thị trường trên dòng phim (tab Camp) → bảng nổi lịch + nút.
// CHỈ VAI CHỦ — mọi hàm kiểm trên máy chủ. Đọc từ máy đang có: etp.phim.thu_vong (cat_phim) · etp.mo_rong (đồng hồ thị trường) · etp.thay_the (camp thay / chờ) ·
// etp.dong_phim + dong_buoc (sản xuất) · etp.nhat_ky (cổng lên camp chặn 24 giờ) · etp.cau_hinh khung_hoan (sổ hoãn của máy luật).
import { execFile } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import { chayDong } from '@/lib/actions/etp-dong';

export type LichDang = { dang: string; thu: number; chay: number; lai: number };
export type LichSx = { id: number; loai: string; so_camp: number | null; buoc: { buoc: string; trang_thai: string; ghi: string | null }[]; tao: string };
export type LichPhim = {
  content_id: number; ten: string | null; vong: string | null; ly: string | null; pha: string | null; muc_hut: number | null; chi_gan: number | null;
  chi: number; thu: number; moc_chi: number; so_thu: number; moc_thu: number; camp_lai: number; roas: number; dang: LichDang[];
  thay: { kieu: string; buoc: string; ghi: string | null } | null; sx: LichSx[]; chan: { luc: string; loi: string }[]; hoan: { camp_id: number; huong: string }[];
};

async function laChu() { const q = await quyenEtp(await getCurrentUser()); return q?.vai === 'chu'; }
const run = async <T,>(s: ReturnType<typeof sql>) => (await getDb()!.execute(s)) as unknown as T[];

export async function docLichPhim(contentId: number): Promise<LichPhim | { loi: string }> {
  if (!(await laChu())) return { loi: 'chỉ chủ xem lịch phim' };
  const id = Math.trunc(Number(contentId)); if (!(id > 0)) return { loi: 'mã phim không hợp lệ' };
  const [[p], dang, [thay], sx, chan, [kh], [mc]] = await Promise.all([
    run<Omit<LichPhim, 'dang' | 'thay' | 'sx' | 'chan' | 'hoan' | 'moc_chi' | 'moc_thu'>>(sql`
      with s as (select c.camp_id, c.la_roas, sum(n.chi) chi, sum(n.thu) thu from etp.camp c join etp.so_ngay n using (camp_id) where c.content_id = ${id} group by 1, 2)
      select ${id}::int content_id, p.ten, p.thu_vong vong, p.thu_ly ly, m.pha, m.muc_hut::float, m.chi_gan::float,
        coalesce((select sum(chi) from s), 0)::float chi, coalesce((select sum(thu) from s), 0)::float thu,
        (select count(*) from s where chi >= 1)::int so_thu, (select count(*) from s where chi >= 1 and thu > chi and not la_roas)::int camp_lai,   -- cùng cách đếm với thanh từng dạng (không tính ROAS — ROAS đếm riêng)
        (select count(*) from etp.camp where content_id = ${id} and la_roas and trang_thai = 'ACTIVE')::int roas
      from (select 1) o left join etp.phim p on p.content_id = ${id} left join etp.mo_rong m on m.content_id = ${id}`),
    run<LichDang>(sql`with s as (select c.camp_id, coalesce(r.dang, '?') dang, c.trang_thai, sum(n.chi) chi, sum(n.thu) thu from etp.camp c
        left join etp.creative r using (creative_id) left join etp.so_ngay n using (camp_id) where c.content_id = ${id} and not c.la_roas group by 1, 2, 3)
      select dang, count(*) filter (where chi >= 1)::int thu, count(*) filter (where trang_thai = 'ACTIVE')::int chay, count(*) filter (where chi >= 1 and thu > chi)::int lai
      from s group by 1 order by 1`),
    run<LichPhim['thay']>(sql`select kieu, buoc, ghi from etp.thay_the where content_id = ${id} and buoc not in ('chay', 'huy') order by id desc limit 1`),
    run<LichSx>(sql`select d.id, d.loai, d.so_camp, d.tao_luc::text tao, coalesce((select json_agg(json_build_object('buoc', b.buoc, 'trang_thai', b.trang_thai, 'ghi', left(b.ghi, 160)) order by b.thu_tu)
        from etp.dong_buoc b where b.dong_id = d.id), '[]') buoc from etp.dong_phim d where d.content_id = ${id} and d.trang_thai in ('chay', 'loi', 'dung') order by d.id desc limit 3`),
    run<{ luc: string; loi: string }>(sql`select distinct on (left(loi, 60)) luc::text, left(loi, 180) loi from etp.nhat_ky
      where viec = 'tao_camp' and ok is null and luc > now() - interval '24 hours' and (loi like ${`%phim ${id} %`} or loi like ${`%phim #${id} %`} or loi like ${`%phim ${id}'%`}
        or goc in (select camp_id from etp.camp where content_id = ${id})) order by left(loi, 60), luc desc limit 4`),
    run<{ g: Record<string, unknown> | null }>(sql`select gia_tri g from etp.cau_hinh where khoa = 'khung_hoan'`),
    run<{ chi: number; so: number }>(sql`select coalesce((gia_tri->>'chi')::float, 25) chi, coalesce((gia_tri->>'so_thu')::int, 4) so from etp.cau_hinh where khoa = 'cat_phim'`),
  ]);
  const ids = new Set((await run<{ camp_id: number }>(sql`select camp_id from etp.camp where content_id = ${id} and trang_thai = 'ACTIVE'`)).map((x) => Number(x.camp_id)));
  const hoan = (['tang', 'giam', 'tat'] as const).flatMap((h) => ((kh?.g?.[h] as number[] | undefined) ?? []).filter((c) => ids.has(Number(c))).map((c) => ({ camp_id: Number(c), huong: h })));
  return { ...p!, dang, thay: thay ?? null, sx, chan, hoan, moc_chi: mc?.chi ?? 25, moc_thu: mc?.so ?? 4 };
}

/** ＋ camp loại A / B: một dòng phim (CC cảnh cuối · KT kể chuyện) lên `so` camp — đường dòng phim (dùng lại creative sạch, thiếu thì cắt / sinh). Bấm = anh duyệt tiền camp $1 × so. */
export async function themCampPhim(contentId: number, loai: 'CC' | 'KT', so: number): Promise<{ ok: true; id: number } | { loi: string }> {
  if (!(await laChu())) return { loi: 'chỉ chủ điều khiển phim' };
  if (!['CC', 'KT'].includes(loai)) return { loi: 'loại lạ' };
  const n = Math.trunc(Number(so)); if (!(n >= 1 && n <= 10)) return { loi: 'số camp 1–10' };
  return chayDong(contentId, loai, '', n);
}

/** − BỚT CAMP LỖ NHẤT của phim (camp Nhà đang chạy, không ★ ROAS, ROI cả đời thấp nhất) — giữ camp cuối nếu nó lãi. Tắt qua lam-ethopex.py (đường nút Telegram). */
export async function botCampPhim(contentId: number): Promise<{ ok: true; camp_id: number } | { loi: string }> {
  if (!(await laChu())) return { loi: 'chỉ chủ điều khiển phim' };
  const id = Math.trunc(Number(contentId));
  const ds = await run<{ camp_id: number; chi: number; thu: number }>(sql`select c.camp_id, coalesce(sum(n.chi), 0)::float chi, coalesce(sum(n.thu), 0)::float thu
    from etp.camp c left join etp.so_ngay n using (camp_id) where c.content_id = ${id} and c.trang_thai = 'ACTIVE' and not c.la_roas group by 1
    order by case when sum(n.chi) >= 1 then (sum(n.thu) - sum(n.chi)) / sum(n.chi) else 0 end, c.camp_id`);
  const x = ds[0]; if (!x) return { loi: 'phim không có camp Nhà đang chạy' };
  if (ds.length === 1 && x.thu > x.chi) return { loi: `#${x.camp_id} là camp cuối và đang lãi — giữ` };
  const tep = `${process.env.REPO_DIR ?? '/opt/earns-marketing-os-v2'}/apps/xuong-video/scripts/ethopex/lam-ethopex.py`;
  const me = await getCurrentUser();
  const ra = await new Promise<string>((ok) => execFile('python3', [tep, 'tat', String(x.camp_id), '--luat', `anh bấm Bớt camp lỗ nhất ở etp.on.tc (phim ${id})`, '--ai', `anh (etp.on.tc ${me?.email ?? ''})`],
    { timeout: 120_000, env: process.env }, (_e, out) => ok(String(out ?? ''))));
  const dong = ra.trim().split('\n').reverse().find((l) => l.startsWith('{'));
  const k = dong ? (JSON.parse(dong) as { ok?: boolean; loi?: string }) : null;
  return k?.ok ? { ok: true, camp_id: x.camp_id } : { loi: k?.loi || 'máy tắt không trả kết quả' };
}

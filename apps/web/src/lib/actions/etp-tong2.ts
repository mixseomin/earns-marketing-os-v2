'use server';
// SỐ CHO TỔNG QUAN 2 (widget Người / Tài khoản / Thời gian — anh 01/11/2026 "cụm nhóm Insight dựa vào Người, Tài khoản và Time… nắm tình hình nhanh gọn nhất").
// Một gói nhẹ, gom sẵn trên máy chủ (không ship camp × ngày): người × ngày (etp.so_nguoi) · tài khoản QC × ngày (so_ngay + camp nhà, so_ngay_ngoai + camp_ngoai) ·
// tài khoản đang chạy (camp ACTIVE, ngân sách) · giờ × ngày nhà / đội (so_gio, so_gio_ngoai; giờ UTC) · luật nhịp tới (etp.bao theo sổ luật chung) · phim × người 7 ngày đã khép.
// Quyền: vai người chỉ nhận số của chính người đó (cắt ở đây, không chỉ ẩn), không có giờ / luật nhà.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp, xemNha } from '@/lib/etp-quyen';
import { luatDaLam } from '@/lib/etp-doc';
import BANG_LUAT from '@/lib/etp-bang-luat.json';

export type SoTong2 = {
  nay: string; gio: number;   // ngày Ethopex hôm nay (UTC) + giờ UTC hiện tại
  nguoi: { id: number; ten: string; nha: boolean }[];
  nguoiNgay: { n: number; d: string; chi: number; thu: number; camp: number }[];
  tk: { id: number; ten: string; n: number; nha: boolean; bo: string | null }[];
  tkNgay: { tk: number; d: string; chi: number; thu: number; c: number }[];
  tkNay: { tk: number; chay: number; ns: number; loi: number }[];
  gioNgay: { d: string; g: number; nha: boolean; chi: number; thu: number }[];
  luat: { tang: number; giam: number; tat: number } | null;
  /** thẻ luật nhịp tới theo nhóm (etp.bao) · việc máy đã làm theo luật từng ngày (etp.nhat_ky ok, tên luật theo sổ luật chung) — chỉ nhà */
  baoNhom: { nhom: string; n: number }[]; daLam: { d: string; viec: string; luat: string; n: number }[];
  phim: { p: number; ten: string; n: number; chi: number; thu: number }[];
};

const so = (v: unknown) => Number(v ?? 0) || 0;

export async function taiTong2(): Promise<SoTong2 | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  if (!q) return { loi: 'không có quyền' };
  const db = getDb()!, run = async <T,>(x: ReturnType<typeof sql>) => (await db.execute(x)) as unknown as T[];
  const nha = xemNha(q), chiNg = q.vai === 'nguoi' ? q.nguoiId : null;
  const [nguoi, nguoiNgay, tk, tkNgay, tkNay, gioNgay, bao, phim, boRow, lam] = await Promise.all([
    run<{ id: number; ten: string; nha: boolean }>(sql`select distinct on (nguoi_id) nguoi_id::int id, nguoi ten, nha from etp.so_nguoi order by nguoi_id, ngay desc`),
    run<{ n: number; d: string; chi: string; thu: string; camp: number }>(sql`select nguoi_id::int n, ngay::text d, chi, thu, camp::int camp from etp.so_nguoi where ngay >= current_date - 40`),
    run<{ id: number; ten: string | null; n: number; nha: boolean }>(sql`select t.ad_account_id::int id, r.ten, t.nguoi_id::int n, t.nha from etp.tai_khoan t left join etp.tai_nguyen r on r.loai = 'tk_qc' and r.id = t.ad_account_id`),
    run<{ tk: number; d: string; chi: string; thu: string; c: number }>(sql`
      select c.ad_account_id::int tk, s.ngay::text d, sum(s.chi) chi, sum(s.thu) thu, count(*) filter (where s.chi > 0)::int c from etp.so_ngay s join etp.camp c using (camp_id) where s.ngay >= current_date - 40 group by 1, 2
      union all
      select c.ad_account_id::int, s.ngay::text, sum(s.chi), sum(s.thu), count(*) filter (where s.chi > 0)::int from etp.so_ngay_ngoai s join etp.camp_ngoai c using (camp_id) where s.ngay >= current_date - 40 group by 1, 2`),
    run<{ tk: number; chay: number; ns: string; loi: number }>(sql`
      select ad_account_id::int tk, count(*)::int chay, sum(ngan_sach) ns, count(*) filter (where loi is not null)::int loi from etp.camp where trang_thai = 'ACTIVE' group by 1
      union all
      select ad_account_id::int, count(*)::int, sum(ngan_sach), 0 from etp.camp_ngoai where trang_thai = 'ACTIVE' group by 1`),
    run<{ d: string; g: number; nha: boolean; chi: string; thu: string }>(sql`
      select ngay::text d, gio::int g, true nha, sum(chi) chi, sum(thu) thu from etp.so_gio where ngay >= current_date - 14 group by 1, 2
      union all
      select ngay::text, gio::int, false, sum(chi), sum(thu) from etp.so_gio_ngoai where ngay >= current_date - 14 group by 1, 2`),
    run<{ nhom: string; n: number }>(sql`select nhom, count(distinct camp_id)::int n from etp.bao group by 1`),
    run<{ p: number; ten: string | null; n: number; chi: string; thu: string }>(sql`
      with x as (
        select c.content_id, t.nguoi_id, s.chi, s.thu from etp.so_ngay s join etp.camp c using (camp_id) join etp.tai_khoan t using (ad_account_id)
          where s.ngay >= current_date - 7 and s.ngay < current_date and c.content_id is not null
        union all
        select c.content_id, t.nguoi_id, s.chi, s.thu from etp.so_ngay_ngoai s join etp.camp_ngoai c using (camp_id) join etp.tai_khoan t using (ad_account_id)
          where s.ngay >= current_date - 7 and s.ngay < current_date and c.content_id is not null)
      select x.content_id::int p, max(p.ten) ten, x.nguoi_id::int n, sum(x.chi) chi, sum(x.thu) thu from x left join etp.phim p using (content_id) group by 1, 3 having sum(x.chi) >= 5`),
    run<{ gia_tri: Record<string, { tk: string | number }> | null }>(sql`select gia_tri from xv_khoa_ngoai where ten = 'ethopex_bo_tk'`),
    nha ? run<{ d: string; viec: string; luat: string | null; n: number }>(sql`select (luc at time zone 'UTC')::date::text d, viec, luat, count(distinct camp_id)::int n from etp.nhat_ky
      where luc > now() - interval '40 days' and viec in ('tat', 'giam', 'tang', 'nhan_ban') and (ok or (viec = 'giam' and loi like '%đọc lại%')) group by 1, 2, 3`) : Promise.resolve([]),
  ]);
  const boCua = new Map(Object.entries(boRow[0]?.gia_tri ?? {}).map(([k, b]) => [Number(b.tk), k]));
  const tkN = new Map(tk.map((t) => [t.id, t.n]));
  const cua = (n: number | undefined) => chiNg == null || n === chiNg;
  // luật nhịp tới của nhà: thẻ đậm (dang) theo hướng trong sổ luật chung
  const huong = BANG_LUAT.khoa as Record<string, { huong?: string; nhan?: string[] }>;
  const luat = { tang: 0, giam: 0, tat: 0 };
  for (const b of bao) { const k = huong[b.nhom]; if (k?.huong && k.nhan?.[3] === 'dang') luat[k.huong as keyof typeof luat] += b.n; }
  return {
    nay: new Date().toISOString().slice(0, 10), gio: new Date().getUTCHours(),
    nguoi: nguoi.filter((x) => cua(x.id)),
    nguoiNgay: nguoiNgay.filter((x) => cua(x.n)).map((x) => ({ ...x, chi: so(x.chi), thu: so(x.thu) })),
    tk: tk.filter((x) => cua(x.n)).map((x) => ({ id: x.id, ten: x.ten ?? String(x.id), n: x.n, nha: x.nha, bo: boCua.get(x.id) ?? null })),
    tkNgay: tkNgay.filter((x) => cua(tkN.get(x.tk))).map((x) => ({ ...x, chi: so(x.chi), thu: so(x.thu) })),
    tkNay: tkNay.filter((x) => cua(tkN.get(x.tk))).map((x) => ({ ...x, ns: so(x.ns) })),
    gioNgay: nha ? gioNgay.map((x) => ({ ...x, chi: so(x.chi), thu: so(x.thu) })) : [],
    luat: nha ? luat : null,
    baoNhom: nha ? bao : [],
    daLam: [...lam.reduce((m, r) => { const k = `${r.d}|${r.viec}|${luatDaLam(r.viec, r.luat)}`; m.set(k, (m.get(k) ?? 0) + r.n); return m; }, new Map<string, number>())]
      .map(([k, n]) => { const [d, viec, ten] = k.split('|'); return { d: d!, viec: viec!, luat: ten!, n }; }),
    phim: phim.filter((x) => cua(x.n)).map((x) => ({ p: x.p, ten: x.ten ?? `#${x.p}`, n: x.n, chi: so(x.chi), thu: so(x.thu) })),
  };
}

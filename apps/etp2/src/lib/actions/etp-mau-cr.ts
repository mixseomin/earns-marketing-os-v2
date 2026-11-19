'use server';
// MẪU CREATIVE (anh 19/11/2026: "Tạo 1 tab mới là Mẫu Creative và tổng hợp vào đó. Có bộ lọc đầy đủ"). Một danh sách gộp:
//   dạng creative (sổ dạng lib/etp-dang.json) + số thật của nhà (etp.creative → etp.camp → etp.so_ngay) + ảnh mẫu = creative thu nhiều nhất của dạng
//   bố cục / lớp phủ (sổ mẫu lib/etp-mau-cr.json) + QC đối thủ tham chiếu (kho Spy qc_meta: số ngày chạy, còn chạy; ảnh R2 etp.doi_thu_qc)
// CHỈ ĐỌC. Không khai lại bảng dạng ở đây — đọc từ sổ.
// tra-repo-ok: mã dán keo nội bộ — gộp hai sổ của nhà với số trong kho etp / Spy
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import { DS_DANG } from '@/lib/etp-dang';
import SO_MAU from '@/lib/etp-mau-cr.json';
import { spy } from '@/lib/spy-db';

export type LoaiMau = 'cong_thuc' | 'dang' | 'bo_cuc' | 'lop_phu';
export type NguonMau = 'nha' | 'doi_thu';
export type TrangThaiMau = 'chay' | 'may' | 'thu' | 'chua';
export type ThamChieu = { id: string; phim: string | null; ngay: number | null; con_chay: boolean; anh: string | null; video: string | null };
/** một creative mẫu hiện NGUYÊN trong thẻ (anh 19/11/2026 "phải show ngay ra" · "full creative"): ảnh + video nếu có, nhãn ngắn */
export type BanMau = { anh: string | null; video: string | null; nhan: string | null; link: string | null; con_chay?: boolean };
export type MauCr = {
  ma: string; ten: string; loai: LoaiMau; nguon: NguonMau; trang_thai: TrangThaiMau; nhom: string | null; mau: string | null;
  dung_cho: string[]; the_loai: string[]; mo_ta: string; may: string | null; ban: BanMau[];
  so: { cr: number; camp: number; dang_chay: number; chi: number; thu: number; moi: string | null } | null;
  tham_chieu: ThamChieu[];
};
type MucSo = { ma: string; ten: string; loai: 'cong_thuc' | 'bo_cuc' | 'lop_phu'; dang?: string; nguon: NguonMau; trang_thai: 'may' | 'thu' | 'chua'; dung_cho: string[]; the_loai?: string[]; mo_ta: string; may?: string; anh?: string; tham_chieu?: string[] };

const run = async <T,>(q: ReturnType<typeof sql>) => (await getDb()!.execute(q)) as unknown as T[];

export async function docMauCr(): Promise<{ mau: MauCr[]; luc: string } | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  if (!q || q.vai !== 'chu') return { loi: 'không có quyền' };
  try {
    const so = SO_MAU.mau as MucSo[];
    const ids = [...new Set(so.flatMap((x) => x.tham_chieu ?? []))];
    // creative → mẫu (etp.creative_mau — cổng len-creative.py ghi từ 19/11/2026); bảng chưa có thì coi như chưa creative nào gắn mẫu
    const coBangMau = (await run<{ c: boolean }>(sql`select to_regclass('etp.creative_mau') is not null c`))[0]?.c;
    const [soMau, anhMau] = coBangMau ? await Promise.all([
      run<{ mau: string; cr: number; camp: number; dang_chay: number; chi: number; thu: number; moi: string | null }>(sql`
        select m.mau, count(distinct m.creative_id)::int cr, count(distinct k.camp_id)::int camp, count(distinct k.camp_id) filter (where k.trang_thai = 'ACTIVE')::int dang_chay,
          coalesce(sum(s.chi), 0)::float chi, coalesce(sum(s.thu), 0)::float thu, max(m.luc)::text moi
        from etp.creative_mau m left join etp.camp k on k.creative_id = m.creative_id
        left join (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay group by 1) s on s.camp_id = k.camp_id group by 1`),
      run<{ mau: string; anh: string; video: string | null; thu: number }>(sql`
        select mau, anh, video, thu from (select m.mau, c.anh, c.video, coalesce(sum(s.thu), 0)::float thu, row_number() over (partition by m.mau order by coalesce(sum(s.thu), 0) desc, m.creative_id desc) h
          from etp.creative_mau m join etp.creative c on c.creative_id = m.creative_id left join etp.camp k on k.creative_id = m.creative_id left join etp.so_ngay s on s.camp_id = k.camp_id
          where c.anh is not null group by m.mau, c.anh, c.video, m.creative_id) x where h <= 3`),
    ]) : [[], []];
    const soTheoMau = new Map(soMau.map((x) => [x.mau, x]));
    const banTheoMau = new Map<string, BanMau[]>();
    for (const x of anhMau) banTheoMau.set(x.mau, [...(banTheoMau.get(x.mau) ?? []), { anh: x.anh, video: x.video, nhan: x.thu > 0 ? `thu $${x.thu.toFixed(0)}` : null, link: x.video ?? x.anh }]);
    const [soDang, anhDang, anhDt, qcDt, tenPhim] = await Promise.all([
      run<{ dang: string; cr: number; camp: number; dang_chay: number; chi: number; thu: number; moi: string | null }>(sql`
        select c.dang, count(distinct c.creative_id)::int cr, count(distinct k.camp_id)::int camp, count(distinct k.camp_id) filter (where k.trang_thai = 'ACTIVE')::int dang_chay,
          coalesce(sum(s.chi), 0)::float chi, coalesce(sum(s.thu), 0)::float thu, max(c.cap_nhat)::text moi
        from etp.creative c left join etp.camp k on k.creative_id = c.creative_id
        left join (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay group by 1) s on s.camp_id = k.camp_id
        where c.dang is not null group by 1`),
      // ảnh mẫu của dạng = 3 creative có ảnh, thu nhiều nhất
      run<{ dang: string; anh: string; video: string | null; thu: number }>(sql`
        select dang, anh, video, thu from (select c.dang, c.anh, c.video, coalesce(sum(s.thu), 0)::float thu, row_number() over (partition by c.dang order by coalesce(sum(s.thu), 0) desc, c.creative_id desc) h
          from etp.creative c left join etp.camp k on k.creative_id = c.creative_id left join etp.so_ngay s on s.camp_id = k.camp_id
          where c.dang is not null and c.anh is not null group by c.dang, c.anh, c.video, c.creative_id) x where h <= 3`),
      ids.length ? run<{ id: string; anh: string | null }>(sql`select library_id id, anh from etp.doi_thu_qc where library_id = any(${`{${ids.join(',')}}`}::text[])`) : Promise.resolve([]),
      ids.length ? spy().then((p) => p<{ id: string; mien: string; ma: string | null; ngay: number | null; con: boolean; video: string | null }[]>`
        select library_id id, mien, coalesce(video_kho, video_hd, video_sd) video, substring(dich from '/movie/([^/?#]+)') ma, (lan_cuoi::date - coalesce(bat_dau, lan_dau::date))::int ngay, lan_cuoi::date >= current_date - 2 con
        from qc_meta where library_id = any(${ids})`) : Promise.resolve([]),
      run<{ mien: string; ma: string; ten: string | null }>(sql`select mien, ma, ten from etp.doi_thu_phim`),
    ]);
    const soTheo = new Map(soDang.map((x) => [x.dang, x]));
    const banTheo = new Map<string, BanMau[]>();
    for (const x of anhDang) banTheo.set(x.dang, [...(banTheo.get(x.dang) ?? []), { anh: x.anh, video: x.video, nhan: x.thu > 0 ? `thu $${x.thu.toFixed(0)}` : null, link: x.video ?? x.anh }]);
    const anhQc = new Map(anhDt.map((x) => [x.id, x.anh]));
    const ten = new Map(tenPhim.map((x) => [`${x.mien}~${x.ma}`, x.ten]));
    const qc = new Map(qcDt.map((x) => [x.id, x]));
    const mau: MauCr[] = [
      ...DS_DANG.map((d): MauCr => {
        const s = soTheo.get(d.dang);
        return { ma: d.ma, ten: d.dang, loai: 'dang', nguon: 'nha', trang_thai: s?.dang_chay ? 'chay' : s?.camp ? 'may' : 'thu', nhom: d.nhom ?? null, mau: d.mau,
          dung_cho: [], the_loai: [], mo_ta: d.mo_ta ?? '', may: d.dong ? `dòng ${d.dong} (apps/etp/dong_phim.py)` : d.kieu ? `kiểu ${d.kieu} (kieu-moi.py)` : null,
          ban: banTheo.get(d.dang) ?? [], so: s ? { cr: s.cr, camp: s.camp, dang_chay: s.dang_chay, chi: s.chi, thu: s.thu, moi: s.moi } : null, tham_chieu: [] };
      }),
      ...so.map((m): MauCr => { const sm = soTheoMau.get(m.ma); return {
        ma: m.ma, ten: m.ten, loai: m.loai, nguon: m.nguon, trang_thai: sm?.dang_chay ? 'chay' : m.trang_thai, nhom: null, mau: null, dung_cho: m.dung_cho, the_loai: m.the_loai ?? [],
        mo_ta: m.mo_ta, may: m.may ?? null, ban: [...(m.anh ? [{ anh: m.anh, video: null, nhan: 'mẫu nhà', link: m.anh }] : []), ...(banTheoMau.get(m.ma) ?? [])],
        so: sm ? { cr: sm.cr, camp: sm.camp, dang_chay: sm.dang_chay, chi: sm.chi, thu: sm.thu, moi: sm.moi } : null,
        tham_chieu: (m.tham_chieu ?? []).map((id) => { const x = qc.get(id); return { id, phim: x?.ma ? ten.get(`${x.mien}~${x.ma}`) ?? null : null, ngay: x?.ngay ?? null, con_chay: !!x?.con, anh: anhQc.get(id) ?? null, video: x?.video ?? null }; }),
      }; }),
    ];
    // mẫu học từ đối thủ: hiện NGUYÊN mọi QC tham chiếu (ảnh + video), nhãn = số ngày chạy
    for (const m of mau) if (m.tham_chieu.length) m.ban = [...m.ban, ...m.tham_chieu.filter((t) => t.anh || t.video).map((t): BanMau => ({ anh: t.anh, video: t.video, nhan: `${t.ngay ?? '?'} ngày`, link: `https://www.facebook.com/ads/library/?id=${t.id}`, con_chay: t.con_chay }))];
    return { mau, luc: new Date().toISOString() };
  } catch (e) {
    return { loi: `đọc mẫu creative không được: ${(e as Error).message}` };
  }
}

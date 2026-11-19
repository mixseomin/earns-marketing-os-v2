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
import { chayDong } from '@/lib/actions/etp-dong';

export type LoaiMau = 'cong_thuc' | 'dang' | 'bo_cuc' | 'lop_phu';
export type NguonMau = 'nha' | 'doi_thu';
export type TrangThaiMau = 'chay' | 'may' | 'thu' | 'chua';
export type ThamChieu = { id: string; phim: string | null; ngay: number | null; con_chay: boolean; anh: string | null; video: string | null };
/** một creative mẫu hiện NGUYÊN trong thẻ (anh 19/11/2026 "phải show ngay ra" · "full creative"): ảnh + video nếu có, nhãn ngắn */
export type BanMau = { anh: string | null; video: string | null; nhan: string | null; link: string | null; con_chay?: boolean;
  /** goc = QC gốc của đối thủ · dung = bản máy dựng theo mẫu (so cạnh nhau — anh 19/11/2026 "Mẫu phải có poster gốc để so sánh mày dựng có đúng ko") */
  vai?: 'goc' | 'dung'; /** chữ rê chuột */ goi_y?: string };
export type MauCr = {
  ma: string; ten: string; loai: LoaiMau; nguon: NguonMau; trang_thai: TrangThaiMau; nhom: string | null; mau: string | null;
  /** NHÓM THIẾT KẾ hiện trên tab (anh 19/11/2026 "phải tổ chức trình bày cho khoa học hơn"): 1 công thức · 2 dạng · 3 tên phim · 4 nút / CTA · 5 băng chữ · 6 bố cục / key-art · 7 bố cục nhà */
  nhom_tk: string;
  dung_cho: string[]; the_loai: string[]; mo_ta: string; may: string | null; ban: BanMau[];
  so: { cr: number; camp: number; dang_chay: number; chi: number; thu: number; moi: string | null } | null;
  tham_chieu: ThamChieu[];
  /** mã dòng phim máy dựng được mẫu này (CC / KT / AT / ATT / PO / CTS / LT) — null = không đi dòng phim */
  dong: string | null;
  /** máy dựng theo mẫu (dung-mau.py trên iMac) dựng được mẫu này — mẫu học từ đối thủ đã có hàm vẽ */
  may_mau: boolean;
  /** PHIM SẢN XUẤT theo mẫu (anh 19/11/2026: "tao sẽ chọn phim, sau đó chúng mày phải sinh ra được creative mới. Mỗi phim có thể có nhiều creative") */
  phim_sx: PhimSx[];
};
export type CrSx = { id: number; anh: string | null; video: string | null; chay: boolean; camp: number; chi: number; thu: number };
/** trạng thái máy dựng theo mẫu (dung-mau.py, etp.mau_dung) — anh 19/11/2026 "Tao cần xem trạng thái quá trình dựng ở đó luôn" */
export type DungMau = { buoc: string; trang_thai: string; ghi: string | null; cap_nhat: string; creative_ids: number[] };
export type PhimSx = { content_id: number; ten: string | null; chon: boolean; dong_id: number | null; dong_tt: string | null; dong_ly: string | null; cr: CrSx[]; dung: DungMau | null };
type MucSo = { ma: string; ten: string; loai: 'cong_thuc' | 'bo_cuc' | 'lop_phu'; dang?: string; nhom?: string; anh_dung?: string; anh_dung_phim?: string; nguon: NguonMau; trang_thai: 'may' | 'thu' | 'chua'; dung_cho: string[]; the_loai?: string[]; mo_ta: string; may?: string; anh?: string; tham_chieu?: string[] };

const run = async <T,>(q: ReturnType<typeof sql>) => (await getDb()!.execute(q)) as unknown as T[];

const BANG_MAU_PHIM = sql`create table if not exists etp.mau_phim (mau text not null, content_id integer not null, ai text, dong_id integer, luc timestamptz not null default now(), primary key (mau, content_id))`;
/** mã dòng phim của một dạng (sổ dạng: trường dong) */
const dongCua = (dang: string | undefined | null) => DS_DANG.find((d) => d.dang === dang)?.dong ?? null;

export async function docMauCr(): Promise<{ mau: MauCr[]; phim: { id: number; ten: string }[]; luc: string } | { loi: string }> {
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
    const coBangChon = (await run<{ c: boolean }>(sql`select to_regclass('etp.mau_phim') is not null c`))[0]?.c;
    const chon = coBangChon ? await run<{ mau: string; content_id: number; dong_id: number | null; dong_tt: string | null; dong_ly: string | null; ten: string | null }>(sql`
      select m.mau, m.content_id, m.dong_id, d.trang_thai dong_tt, d.ly_do dong_ly, p.ten from etp.mau_phim m left join etp.dong_phim d on d.id = m.dong_id
      left join etp.phim p on p.content_id = m.content_id order by m.luc desc`) : [];
    // creative thật: theo mẫu ghi ở cổng (công thức) + theo dạng cho phim anh chọn ở thẻ dạng
    const crMau = coBangMau ? await run<{ mau: string; content_id: number; ten: string | null; id: number; anh: string | null; video: string | null; chay: boolean; camp: number; chi: number; thu: number }>(sql`
      select m.mau, c.content_id, p.ten, c.creative_id id, c.anh, c.video, bool_or(k.trang_thai = 'ACTIVE') chay, count(distinct k.camp_id)::int camp,
        coalesce(sum(s.chi), 0)::float chi, coalesce(sum(s.thu), 0)::float thu
      from etp.creative_mau m join etp.creative c on c.creative_id = m.creative_id left join etp.phim p on p.content_id = c.content_id
      left join etp.camp k on k.creative_id = c.creative_id left join (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay group by 1) s on s.camp_id = k.camp_id
      group by 1, 2, 3, 4, 5, 6 order by c.creative_id desc`) : [];
    const chonDang = chon.filter((x) => DS_DANG.some((d) => d.ma === x.mau));
    const crDang = chonDang.length ? await run<{ mau: string; content_id: number; ten: string | null; id: number; anh: string | null; video: string | null; chay: boolean; camp: number; chi: number; thu: number }>(sql`
      select x.mau, c.content_id, p.ten, c.creative_id id, c.anh, c.video, bool_or(k.trang_thai = 'ACTIVE') chay, count(distinct k.camp_id)::int camp,
        coalesce(sum(s.chi), 0)::float chi, coalesce(sum(s.thu), 0)::float thu
      from jsonb_to_recordset(${JSON.stringify(chonDang.map((x) => ({ mau: x.mau, content_id: x.content_id, dang: DS_DANG.find((d) => d.ma === x.mau)?.dang })))}::jsonb) x(mau text, content_id int, dang text)
      join etp.creative c on c.content_id = x.content_id and c.dang = x.dang left join etp.phim p on p.content_id = c.content_id
      left join etp.camp k on k.creative_id = c.creative_id left join (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay group by 1) s on s.camp_id = k.camp_id
      group by 1, 2, 3, 4, 5, 6 order by c.creative_id desc`) : [];
    const phimSx = new Map<string, Map<number, PhimSx>>();
    const lay = (mau: string, cid: number, ten: string | null) => { const m = phimSx.get(mau) ?? new Map<number, PhimSx>(); phimSx.set(mau, m);
      return m.get(cid) ?? (m.set(cid, { content_id: cid, ten, chon: false, dong_id: null, dong_tt: null, dong_ly: null, cr: [], dung: null }), m.get(cid)!); };
    for (const x of chon) Object.assign(lay(x.mau, x.content_id, x.ten), { chon: true, dong_id: x.dong_id, dong_tt: x.dong_tt, dong_ly: x.dong_ly });
    const coBangDung = (await run<{ c: boolean }>(sql`select to_regclass('etp.mau_dung') is not null c`))[0]?.c;
    const dung = coBangDung ? await run<DungMau & { mau: string; content_id: number; ten: string | null }>(sql`
      select d.mau, d.content_id, p.ten, d.buoc, d.trang_thai, d.ghi, d.cap_nhat::text cap_nhat, d.creative_ids from etp.mau_dung d left join etp.phim p using (content_id)`) : [];
    for (const x of dung) lay(x.mau, x.content_id, x.ten).dung = { buoc: x.buoc, trang_thai: x.trang_thai, ghi: x.ghi, cap_nhat: x.cap_nhat, creative_ids: x.creative_ids ?? [] };
    for (const x of [...crMau, ...crDang]) { const f = lay(x.mau, x.content_id, x.ten); if (!f.cr.some((c) => c.id === x.id)) f.cr.push({ id: x.id, anh: x.anh, video: x.video, chay: !!x.chay, camp: x.camp, chi: x.chi, thu: x.thu }); }
    const sxCua = (ma: string) => [...(phimSx.get(ma)?.values() ?? [])];
    const phim = await run<{ id: number; ten: string }>(sql`select content_id id, ten from etp.phim where ten is not null and coalesce(nhom_goc, 'au_my') = 'au_my' order by ten`);
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
        return { nhom_tk: '2 · Dạng creative', ma: d.ma, ten: d.dang, loai: 'dang', nguon: 'nha', trang_thai: s?.dang_chay ? 'chay' : s?.camp ? 'may' : 'thu', nhom: d.nhom ?? null, mau: d.mau,
          dung_cho: [], the_loai: [], mo_ta: d.mo_ta ?? '', may: d.dong ? `dòng ${d.dong} (apps/etp/dong_phim.py)` : d.kieu ? `kiểu ${d.kieu} (kieu-moi.py)` : null,
          ban: banTheo.get(d.dang) ?? [], so: s ? { cr: s.cr, camp: s.camp, dang_chay: s.dang_chay, chi: s.chi, thu: s.thu, moi: s.moi } : null, tham_chieu: [],
          dong: d.dong ?? null, may_mau: false, phim_sx: sxCua(d.ma) };
      }),
      ...so.map((m): MauCr => { const sm = soTheoMau.get(m.ma); return {
        nhom_tk: m.nhom ?? '6 · Bố cục / key-art', ma: m.ma, ten: m.ten, loai: m.loai, nguon: m.nguon, trang_thai: sm?.dang_chay ? 'chay' : m.trang_thai, nhom: null, mau: null, dung_cho: m.dung_cho, the_loai: m.the_loai ?? [],
        mo_ta: m.mo_ta, may: m.may ?? null, ban: [...(m.anh ? [{ anh: m.anh, video: null, nhan: 'mẫu nhà', link: m.anh }] : []), ...(banTheoMau.get(m.ma)
          // công thức chưa có creative nào ghi mẫu (cổng mới từ 19/11/2026) → mượn creative thu cao nhất của CÙNG DẠNG, nhãn ghi rõ là của dạng
          ?? (m.loai === 'cong_thuc' && m.dang ? (banTheo.get(m.dang) ?? []).map((b) => ({ ...b, nhan: `dạng · ${b.nhan ?? ''}`.trim() })) : []))],
        so: sm ? { cr: sm.cr, camp: sm.camp, dang_chay: sm.dang_chay, chi: sm.chi, thu: sm.thu, moi: sm.moi } : null,
        tham_chieu: (m.tham_chieu ?? []).map((id) => { const x = qc.get(id); return { id, phim: x?.ma ? ten.get(`${x.mien}~${x.ma}`) ?? null : null, ngay: x?.ngay ?? null, con_chay: !!x?.con, anh: anhQc.get(id) ?? null, video: x?.video ?? null }; }),
        dong: m.loai === 'cong_thuc' && m.trang_thai === 'may' ? dongCua(m.dang) : null, may_mau: m.loai !== 'cong_thuc' && m.trang_thai !== 'chua' && (m.may ?? '').startsWith('dung-mau.py'), phim_sx: sxCua(m.ma),
      }; }),
    ];
    // mẫu học từ đối thủ: hiện NGUYÊN mọi QC tham chiếu (ảnh + video), nhãn = số ngày chạy
    // SO GỐC ↔ MÁY DỰNG: QC gốc đối thủ đứng ĐẦU, bản máy dựng theo mẫu ngay cạnh, rồi các QC gốc còn lại — cùng cỡ ô, nhãn GỐC / MÁY DỰNG
    for (const m of mau) if (m.tham_chieu.length) {
      const goc = m.tham_chieu.filter((t) => t.anh || t.video).map((t): BanMau => ({ anh: t.anh, video: t.video, nhan: `gốc · ${t.ngay ?? '?'} ngày`, link: `https://www.facebook.com/ads/library/?id=${t.id}`, con_chay: t.con_chay, vai: 'goc' }));
      const s0 = so.find((x) => x.ma === m.ma), dung: BanMau[] = s0?.anh_dung ? [{ anh: s0.anh_dung, video: null, nhan: 'máy dựng', link: s0.anh_dung, vai: 'dung', goi_y: `bản máy dựng theo mẫu trên phim ${s0.anh_dung_phim ?? ''} — so với QC gốc đối thủ ô bên trái` }] : [];
      m.ban = [...m.ban, ...goc.slice(0, 1), ...dung, ...goc.slice(1)];
    }
    return { mau, phim, luc: new Date().toISOString() };
  } catch (e) {
    return { loi: `đọc mẫu creative không được: ${(e as Error).message}` };
  }
}

/** CHỌN PHIM cho một mẫu → máy sinh creative mới theo mẫu (anh 19/11/2026). Mẫu có máy dựng (mã dòng) → tạo dòng phim qua chayDong (cùng đường nút ＋ tab Sản xuất,
 *  mọi cổng của dòng giữ nguyên: nhận phim, soát 18+, soát đoạn, chấm, lên camp theo luật / phanh chợ); creative ra được cổng len-creative ghi mẫu → hiện ở chân thẻ.
 *  Mẫu chưa có máy dựng → chỉ ghi phim vào etp.mau_phim, báo rõ là chờ dựng mã mẫu (không sinh gì). */
export async function chonPhimMau(ma: string, contentId: number): Promise<{ ok: true; ghi: string } | { loi: string }> {
  const me = await getCurrentUser(), q = await quyenEtp(me);
  if (!q || q.vai !== 'chu') return { loi: 'không có quyền' };
  const cid = Math.trunc(Number(contentId)); if (!(cid > 0)) return { loi: 'mã phim không hợp lệ' };
  const so = (SO_MAU.mau as MucSo[]).find((x) => x.ma === ma), d = DS_DANG.find((x) => x.ma === ma);
  if (!so && !d) return { loi: `không có mẫu ${ma} trong sổ` };
  const dong = d ? d.dong ?? null : so!.loai === 'cong_thuc' && so!.trang_thai === 'may' ? dongCua(so!.dang) : null;
  await getDb()!.execute(BANG_MAU_PHIM);
  let dongId: number | null = null, ghi: string;
  if (dong) {
    const r = await chayDong(cid, dong, '');
    if ('loi' in r) return { loi: `chưa sinh được: ${r.loi}` };
    dongId = r.id; ghi = `đã tạo dòng phim #${r.id} (${dong}) — máy dòng phim sinh creative theo mẫu, xong hiện ở đây`;
  } else if (so && so.loai !== 'cong_thuc' && so.trang_thai !== 'chua' && (so.may ?? '').startsWith('dung-mau.py')) {
    await getDb()!.execute(sql`create table if not exists etp.mau_dung (mau text not null, content_id integer not null, buoc text not null default 'cho', trang_thai text not null default 'cho',
      ghi text, creative_ids integer[] not null default '{}', tv_ids integer[] not null default '{}', vnd integer not null default 0, bat_dau timestamptz, cap_nhat timestamptz not null default now(), primary key (mau, content_id))`);
    await getDb()!.execute(sql`insert into etp.mau_dung (mau, content_id, buoc, trang_thai, ghi) values (${ma}, ${cid}, 'cho', 'cho', 'chờ máy dựng theo mẫu (iMac) nhận')
      on conflict (mau, content_id) do update set buoc = 'cho', trang_thai = 'cho', ghi = excluded.ghi, cap_nhat = now() where etp.mau_dung.trang_thai in ('loi', 'cho')`);
    ghi = 'đã xếp hàng máy dựng theo mẫu — trạng thái từng bước hiện ở chân thẻ';
  } else ghi = 'đã ghi phim — mẫu này chưa có máy dựng nên chưa sinh được creative; dựng mã mẫu xong máy mới làm';
  await getDb()!.execute(sql`insert into etp.mau_phim (mau, content_id, ai, dong_id) values (${ma}, ${cid}, ${me?.displayName ?? me?.email ?? 'chủ'}, ${dongId})
    on conflict (mau, content_id) do update set dong_id = coalesce(excluded.dong_id, etp.mau_phim.dong_id), luc = now()`);
  return { ok: true, ghi };
}

/** BẢNG CHỌN PHIM cho một mẫu (anh 19/11/2026: "Bảng chọn phim đang ngu. Nhìn mỗi tên sẽ ko biết làm gì tiếp. Phải có chi tiết các cột, các thông số, chia nhóm…
 *  giống bên tab Phim đối thủ!! Phim nào đã có…"). Mỗi phim Âu-Mỹ của Ethopex: thể loại, tuổi, camp + ROI nhà / đội, creative của mẫu này / của dạng / tổng,
 *  dòng phim đang chạy, đã chọn cho mẫu chưa. Số đối thủ (QC đang chạy) ghép ở trình duyệt từ danh sách Phim đối thủ (useDoiThu, đã giữ trong máy). */
export type SoCamp = { dang: number; tong: number; chi: number; thu: number };
export type PhimChon = {
  id: number; ten: string; tl: string | null; locale: string | null; tuoi: number | null; nha: SoCamp; doi: SoCamp;
  cr_mau: number; cr_dang: number; cr_tong: number; dong_chay: { id: number; loai: string }[]; da_chon: boolean;
  /** có link tập trên Ethopex (etp.phim.url) — không có thì không máy nào tải được tập để dựng */
  co_link: boolean;
};
export async function docPhimChon(ma: string): Promise<{ mau: { ma: string; ten: string; dang: string | null; dong: string | null }; phim: PhimChon[]; luc: string } | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  if (!q || q.vai !== 'chu') return { loi: 'không có quyền' };
  const so = (SO_MAU.mau as MucSo[]).find((x) => x.ma === ma), d = DS_DANG.find((x) => x.ma === ma);
  if (!so && !d) return { loi: `không có mẫu ${ma} trong sổ` };
  const dang = d ? d.dang : so!.loai === 'cong_thuc' ? so!.dang ?? null : null;
  const dong = d ? d.dong ?? null : so!.loai === 'cong_thuc' && so!.trang_thai === 'may' ? dongCua(so!.dang) : null;
  try {
    const [coMau] = await run<{ m: boolean; c: boolean }>(sql`select to_regclass('etp.creative_mau') is not null m, to_regclass('etp.mau_phim') is not null c`);
    const [phim, nha, doi, tuoi, cr, crMau, dongR, chon, tlR] = await Promise.all([
      run<{ id: number; ten: string; the_loai: string | null; locale: string | null; co_link: boolean }>(sql`select content_id id, ten, the_loai, locale, url is not null co_link from etp.phim where ten is not null and coalesce(nhom_goc, 'au_my') = 'au_my'`),
      run<SoCamp & { id: number }>(sql`select k.content_id id, count(*) filter (where k.trang_thai = 'ACTIVE')::int dang, count(*)::int tong, coalesce(sum(s.chi), 0)::float chi, coalesce(sum(s.thu), 0)::float thu
        from etp.camp k left join (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay group by 1) s using (camp_id) where k.content_id is not null group by 1`),
      run<SoCamp & { id: number }>(sql`select k.content_id id, count(*) filter (where k.trang_thai = 'ACTIVE')::int dang, count(*)::int tong, coalesce(sum(s.chi), 0)::float chi, coalesce(sum(s.thu), 0)::float thu
        from etp.camp_ngoai k left join (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay_ngoai group by 1) s using (camp_id) where k.content_id is not null group by 1`),
      run<{ id: number; ngay: number }>(sql`select content_id::int id, (current_date - min(tao)::date)::int ngay from etp.trang_phim group by 1`),
      run<{ id: number; tong: number; dang: number }>(sql`select content_id id, count(*)::int tong, count(*) filter (where dang = ${dang ?? ''})::int dang from etp.creative where content_id is not null group by 1`),
      coMau?.m ? run<{ id: number; n: number }>(sql`select c.content_id id, count(*)::int n from etp.creative_mau m join etp.creative c using (creative_id) where m.mau = ${ma} group by 1`) : Promise.resolve([]),
      run<{ id: number; ds: { id: number; loai: string }[] }>(sql`select content_id id, json_agg(json_build_object('id', id, 'loai', loai) order by id) ds from etp.dong_phim where trang_thai = 'chay' group by 1`),
      coMau?.c ? run<{ id: number }>(sql`select content_id id from etp.mau_phim where mau = ${ma}`) : Promise.resolve([]),
      run<{ v: Record<string, string> | null }>(sql`select gia_tri->'the_loai' v from xv_khoa_ngoai where ten = 'ethopex_the_loai_thu'`),
    ]);
    const z: SoCamp = { dang: 0, tong: 0, chi: 0, thu: 0 }, tenTl = tlR[0]?.v ?? {};
    const M = <T extends { id: number }>(a: T[]) => new Map(a.map((x) => [Number(x.id), x]));
    // tuổi phim trên Ethopex: ethopex_content.tao (kho Spy — mọi phim), thiếu thì trang phim workspace sớm nhất (cùng cách tab Phim đối thủ)
    const tuoiSpy = await spy().then((p) => p<{ id: number; ngay: number }[]>`select id, (current_date - tao::date)::int ngay from ethopex_content where id = any(${phim.map((x) => Number(x.id))})`).catch(() => [] as { id: number; ngay: number }[]);
    const nhaM = M(nha), doiM = M(doi), tuoiM = M([...tuoi, ...tuoiSpy]), crM = M(cr), crMauM = M(crMau), dongM = M(dongR), chonS = new Set(chon.map((x) => Number(x.id)));
    const so_ = (x?: SoCamp) => (x ? { dang: Number(x.dang), tong: Number(x.tong), chi: Number(x.chi), thu: Number(x.thu) } : z);
    return { mau: { ma, ten: so?.ten ?? d!.dang, dang, dong }, luc: new Date().toISOString(), phim: phim.map((p) => { const id = Number(p.id); return {
      id, ten: p.ten, tl: p.the_loai ? tenTl[p.the_loai] ?? p.the_loai : null, locale: p.locale, tuoi: tuoiM.get(id)?.ngay ?? null, nha: so_(nhaM.get(id)), doi: so_(doiM.get(id)),
      cr_mau: crMauM.get(id)?.n ?? 0, cr_dang: crM.get(id)?.dang ?? 0, cr_tong: crM.get(id)?.tong ?? 0, dong_chay: dongM.get(id)?.ds ?? [], da_chon: chonS.has(id), co_link: !!p.co_link }; }) };
  } catch (e) {
    return { loi: `đọc danh sách phim không được: ${(e as Error).message}` };
  }
}

/** CHI TIẾT MỘT VIỆC DỰNG THEO MẪU (ngăn etp-mau-dung): trạng thái hiện tại + dòng thời gian từng bước (etp.mau_dung_nk) + creative đã ra (ảnh, camp, chi / thu) */
export type NkDung = { luc: string; buoc: string; trang_thai: string; ghi: string | null; may: string | null };
export async function docDungChiTiet(ma: string, contentId: number): Promise<{ mau: { ma: string; ten: string }; phim: { id: number; ten: string | null; url: string | null };
  hien: DungMau | null; nk: NkDung[]; cr: CrSx[] } | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  if (!q || q.vai !== 'chu') return { loi: 'không có quyền' };
  const cid = Math.trunc(Number(contentId)), so = (SO_MAU.mau as MucSo[]).find((x) => x.ma === ma);
  try {
    const [co] = await run<{ d: boolean; n: boolean; m: boolean }>(sql`select to_regclass('etp.mau_dung') is not null d, to_regclass('etp.mau_dung_nk') is not null n, to_regclass('etp.creative_mau') is not null m`);
    const [ph] = await run<{ ten: string | null; url: string | null }>(sql`select ten, url from etp.phim where content_id = ${cid}`);
    const hien = co?.d ? (await run<DungMau>(sql`select buoc, trang_thai, ghi, cap_nhat::text cap_nhat, creative_ids from etp.mau_dung where mau = ${ma} and content_id = ${cid}`))[0] ?? null : null;
    const nk = co?.n ? await run<NkDung>(sql`select luc::text luc, buoc, trang_thai, ghi, may from etp.mau_dung_nk where mau = ${ma} and content_id = ${cid} order by luc, id`) : [];
    const ids = [...new Set([...(hien?.creative_ids ?? []), ...(co?.m ? (await run<{ id: number }>(sql`select m.creative_id id from etp.creative_mau m join etp.creative c using (creative_id) where m.mau = ${ma} and c.content_id = ${cid}`)).map((x) => Number(x.id)) : [])])];
    const cr = ids.length ? await run<CrSx>(sql`select c.creative_id id, c.anh, c.video, coalesce(bool_or(k.trang_thai = 'ACTIVE'), false) chay, count(distinct k.camp_id)::int camp,
        coalesce(sum(s.chi), 0)::float chi, coalesce(sum(s.thu), 0)::float thu from etp.creative c left join etp.camp k on k.creative_id = c.creative_id
        left join (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay group by 1) s on s.camp_id = k.camp_id where c.creative_id = any(${`{${ids.join(',')}}`}::int[]) group by 1, 2, 3 order by 1 desc`) : [];
    return { mau: { ma, ten: so?.ten ?? ma }, phim: { id: cid, ten: ph?.ten ?? null, url: ph?.url ?? null }, hien, nk, cr };
  } catch (e) {
    return { loi: `đọc chi tiết việc dựng không được: ${(e as Error).message}` };
  }
}

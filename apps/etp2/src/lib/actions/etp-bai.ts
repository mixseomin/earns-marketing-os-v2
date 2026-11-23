'use server';
// BÀI QC NHƯ NGƯỜI DÙNG THẤY (anh 20/11/2026): Page · chữ QC (primary) · hình · tên miền · tiêu đề · mô tả · nút CTA của một creative.
// Nguồn THẬT, không chữ mẫu: etp.bai_cr (asset_spec creative trên Ethopex) + etp.bai_camp (Page + tên miền của camp) — apps/etp/bai-qc.py đồng bộ (chỉ GET);
// Page lấy tên + ảnh đại diện ở etp.tai_nguyen loai='page'. Creative chưa lên camp → chữ máy đã nạp (bai_cr) hoặc thu_vien.chu_qc, gắn "chưa lên camp — chữ dự kiến".
// Tải khi mở thẻ (một creative) — không nhét vào gói dữ liệu đầu trang.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';

export type BaiQc = {
  cr: number; camp: number | null; chuaCamp: boolean; dongBo: boolean;
  page: { ten: string | null; anh: string | null; link: string | null } | null;
  chinh: string[]; tieuDe: string[]; moTa: string[]; cta: string | null; tenMien: string | null; kieu: string | null;
  /** NỘI DUNG TRONG VIDEO + CHẤM (anh #1774): đọc từ etp.cham (máy chấm etp-cham: lớp chữ trên hình · giọng đọc · tóm tắt nội dung) — null khi creative chưa chấm */
  noiDung: NoiDungCr | null;
  /** BẢN DỊCH (anh #1778): khoá = mọi chữ ngoại ngữ trong thẻ (nguyên văn), giá trị = bản tiếng Việt đã nhớ ở etp.dich, null = chưa dịch (trang gọi dichChu gộp một lượt).
   *  Chữ không có trong đây = tiếng Việt / rỗng → không cần dịch. */
  dich: Record<string, string | null>;
};
export type DiemTc = { nhom: string; ma: string; ten: string; diem: number; lyDo: string | null };
export type NoiDungCr = { hook: string | null; chuVideo: string | null; loiDoc: string | null; sauHook: string | null; tomTat: string | null; meta: number | null; afs: number | null; ket: string | null; luc: string | null; diem: DiemTc[] };

// hook = câu mở video: câu đầu lời đọc (người xem nghe trước), không có giọng thì dòng chữ đầu trên hình
const cauDau = (s: string | null) => { const t = (s ?? '').trim(); if (!t) return null; const m = t.match(/^[\s\S]*?[.!?…](?=\s|$)/); return (m?.[0] ?? t.split('\n')[0] ?? '').trim() || null; };

// DỊCH HOOK (anh #1778 "các hook đều có thêm phần hiển thị tiếng Việt (dịch) để hiểu nghĩa"): câu có chữ cái riêng tiếng Việt thì không cần dịch
const laTiengViet = (s: string) => /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(s);
const TRAN_DICH = 4000, TRAN_SO_DICH = 60;
// MỌI chữ ngoại ngữ của thẻ (anh #1778 lần 2 "mở rộng thêm phần dịch cho các nội dung khác trong đó"): hook · chữ trên video · lời đọc · tóm tắt · lý do chấm · chữ QC · tiêu đề · mô tả
const canDichChu = (s: string | null | undefined): s is string => !!s && !!s.trim() && s.length <= TRAN_DICH && !laTiengViet(s);
const docDich = async (db: NonNullable<ReturnType<typeof getDb>>, ds: string[]): Promise<Record<string, string>> => {
  if (!ds.length) return {};
  const rows = (await db.execute(sql`select goc, vi from etp.dich where goc in (${sql.join(ds.map((d) => sql`${d}`), sql`, `)})`)) as unknown as { goc: string; vi: string }[];
  return Object.fromEntries(rows.map((r) => [r.goc, r.vi]));
};

/** Dịch GỘP các chữ ngoại ngữ của MỘT thẻ sang tiếng Việt trong MỘT lượt AI — nhớ ở etp.dich theo nguyên văn (câu trùng / mở lại thẻ không dịch lại).
 *  Cổng AI chung, dòng Haiku (~dưới 1₫ một thẻ). Trả bản dịch cho mọi câu xin (cả câu đã nhớ). */
export async function dichChu(dsGoc: string[]): Promise<{ vi: Record<string, string> } | { loi: string }> {
  if (!(await quyenEtp(await getCurrentUser()))) return { loi: 'không có quyền' };
  const ds = [...new Set((Array.isArray(dsGoc) ? dsGoc : []).map((x) => String(x ?? '')))].filter(canDichChu);
  if (ds.length > TRAN_SO_DICH) return { loi: `xin dịch ${ds.length} đoạn một lượt, trần ${TRAN_SO_DICH}` };
  if (!ds.length) return { vi: {} };
  const db = getDb(); if (!db) return { loi: 'không nối được kho' };
  const vi = await docDich(db, ds);
  const thieu = ds.filter((d) => !vi[d]);
  if (!thieu.length) return { vi };
  try {
    const { goiAi } = await import('@mos2/cong-ai');
    const r = await goiAi<{ vi: string[] }>({ viec: 'etp2-dich', model: 'haiku',
      max_tokens: Math.min(8000, 400 + Math.ceil(thieu.reduce((n, d) => n + d.length, 0) * 1.2)),
      system: 'Bạn dịch nội dung quảng cáo phim ngắn (câu hook, chữ trên video, lời thoại, tóm tắt, nhận xét chấm điểm, chữ bài quảng cáo) sang tiếng Việt tự nhiên. '
        + 'Vào là mảng JSON các đoạn; trả {"vi": [...]} đúng số đoạn, đúng thứ tự, mỗi phần tử là bản dịch của đoạn cùng vị trí. Giữ nguyên tên riêng / tên phim, giữ dấu " / " và xuống dòng, không thêm giải thích.',
      noi_dung: JSON.stringify(thieu),
      schema: { type: 'object', properties: { vi: { type: 'array', items: { type: 'string' } } }, required: ['vi'] } },
    { kiem: (kq) => (Array.isArray(kq?.vi) && kq.vi.length === thieu.length && kq.vi.every((x) => typeof x === 'string' && x.trim()) ? null : `cần đúng ${thieu.length} bản dịch không rỗng` ) });
    const chi = r.chi_usd != null ? r.chi_usd / thieu.length : null;
    for (const [k, goc] of thieu.entries()) {
      const v = String(r.kq.vi[k] ?? '').trim().replace(/^["“«]+|["”»]+$/g, '').trim(); if (!v) continue;
      vi[goc] = v;
      await db.execute(sql`insert into etp.dich (goc, vi, model, chi_usd) values (${goc}, ${v}, ${r.model ?? null}, ${chi}) on conflict (goc) do nothing`);
    }
    return { vi };
  } catch (e) { return { loi: `không dịch được: ${String((e as Error)?.message ?? e).slice(0, 200)}` }; }
}

const ds = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : []);

export async function docBaiQc(cr: number, camp?: number | null): Promise<BaiQc | { loi: string }> {
  if (!(await quyenEtp(await getCurrentUser()))) return { loi: 'không có quyền' };
  if (!Number.isInteger(cr) || cr <= 0) return { loi: 'thiếu creative' };
  const db = getDb(); if (!db) return { loi: 'không nối được kho' };
  const c = Number.isInteger(camp) && (camp as number) > 0 ? (camp as number) : null;
  // camp của bài: camp đang xem; không có thì camp nhà đang chạy mới nhất của creative này, rồi camp bất kỳ
  const r = ((await db.execute(sql`with k as (
      select x.camp_id from etp.camp x where x.creative_id = ${cr} and (${c}::int is null or x.camp_id = ${c}::int)
      order by (x.trang_thai = 'ACTIVE') desc, x.camp_id desc limit 1)
    select b.kieu, b.cta, b.link, b.chinh, b.tieu_de, b.mo_ta, (b.creative_id is not null and b.chinh is not null) dong_bo,
      (select camp_id from k) camp, bc.ten_mien, bc.final_url, p.ten pten, p.them->>'picture_url' panh, p.them->>'link' plink,
      (select tv.chu_qc from etp.thu_vien tv where tv.creative_id = ${cr} and tv.chu_qc is not null order by tv.id desc limit 1) chu_qc,
      ch.creative_id is not null co_cham, ch.lop->'chu'->>'noi_dung' chu_video, ch.lop->'giong'->>'noi_dung' loi_doc, ch.lop->'noi_dung'->>'tom_tat' tom_tat,
      ch.meta cmeta, ch.afs cafs, ch.ket cket, ch.luc cluc,
      (select coalesce(jsonb_agg(jsonb_build_object('nhom', tc.nhom, 'ma', tc.ma, 'ten', tc.ten, 'diem', ch.diem->(tc.nhom || '.' || tc.ma), 'ly_do', ch.ly_do->>(tc.nhom || '.' || tc.ma))
         order by tc.nhom desc, tc.thu_tu), '[]'::jsonb) from etp.tieu_chi tc where ch.diem -> (tc.nhom || '.' || tc.ma) is not null) cdiem
    from (select 1) o left join etp.bai_cr b on b.creative_id = ${cr}
      left join etp.cham ch on ch.creative_id = ${cr}
      left join etp.bai_camp bc on bc.camp_id = (select camp_id from k)
      left join etp.tai_nguyen p on p.loai = 'page' and (p.id = bc.page_id or p.external_id = bc.page_id::text)`)) as unknown as Record<string, unknown>[])[0] ?? {};
  const q = (r.chu_qc ?? {}) as { headline?: string; mo_ta?: string; chu_dau?: string; link?: string };
  const dongBo = r.dong_bo === true;
  const hookGoc = r.co_cham === true ? (cauDau(typeof r.loi_doc === 'string' ? r.loi_doc : null) ?? cauDau(typeof r.chu_video === 'string' ? r.chu_video : null)) : null;
  const tenMien = (r.ten_mien as string) || (() => { const u = (r.final_url as string) || (r.link as string) || q.link || ''; try { return u ? new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, '') : null; } catch { return null; } })();
  const chinh = dongBo ? ds(r.chinh) : ds([q.chu_dau]), tieuDe = dongBo ? ds(r.tieu_de) : ds([q.headline]), moTa = dongBo ? ds(r.mo_ta) : ds([q.mo_ta]);
  const noiDung: NoiDungCr | null = r.co_cham !== true ? null : (() => {
      const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
      const chuVideo = s(r.chu_video), loiDoc = s(r.loi_doc);
      const so = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
      return {
        // #1779 "sau hook là phần nội dung voice trong video cũng phải show ra": lời đọc PHÍA SAU câu hook (hook lấy từ lời đọc thì bỏ câu đó, lấy từ chữ trên hình thì giữ cả lời đọc)
        sauHook: (() => { const cd = cauDau(loiDoc); return loiDoc && cd && cd === hookGoc ? loiDoc.slice(loiDoc.indexOf(cd) + cd.length).trim() || null : loiDoc; })(),
        hook: hookGoc, chuVideo, loiDoc, tomTat: s(r.tom_tat), meta: so(r.cmeta), afs: so(r.cafs), ket: s(r.cket),
        luc: r.cluc == null ? null : String(r.cluc),
        diem: ((r.cdiem ?? []) as { nhom: string; ma: string; ten: string; diem: unknown; ly_do: string | null }[])
          .filter((d) => so(d.diem) != null).map((d) => ({ nhom: d.nhom, ma: d.ma, ten: d.ten, diem: so(d.diem) as number, lyDo: s(d.ly_do) })),
      };
    })();
  // #1778: gom mọi chữ ngoại ngữ trong thẻ — bản đã nhớ đi kèm luôn, chữ chưa dịch thì trang gọi dichChu MỘT lượt cho cả thẻ
  const canDich = [...new Set([noiDung?.hook, noiDung?.chuVideo, noiDung?.sauHook ?? noiDung?.loiDoc, noiDung?.tomTat, ...(noiDung?.diem ?? []).map((d) => d.lyDo),
    ...chinh, ...tieuDe, ...moTa].filter(canDichChu))].slice(0, TRAN_SO_DICH);
  const daNho = await docDich(db, canDich).catch(() => ({} as Record<string, string>));
  return {
    cr, camp: r.camp == null ? null : Number(r.camp), chuaCamp: r.camp == null, dongBo,
    page: r.pten || r.panh ? { ten: (r.pten as string) ?? null, anh: (r.panh as string) ?? null, link: (r.plink as string) ?? null } : null,
    chinh, tieuDe, moTa, cta: (r.cta as string) ?? null, tenMien, kieu: (r.kieu as string) ?? null, noiDung,
    dich: Object.fromEntries(canDich.map((d) => [d, daNho[d] ?? null])),
  };
}

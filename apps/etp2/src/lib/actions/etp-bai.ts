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
};
export type DiemTc = { nhom: string; ma: string; ten: string; diem: number; lyDo: string | null };
/** hookVi: bản dịch tiếng Việt đã nhớ ở etp.dich (anh #1778) — null khi chưa dịch; canDich = hook không phải tiếng Việt (trang gọi dichHook khi chưa có) */
export type NoiDungCr = { hook: string | null; hookVi: string | null; canDich: boolean; chuVideo: string | null; loiDoc: string | null; tomTat: string | null; meta: number | null; afs: number | null; ket: string | null; luc: string | null; diem: DiemTc[] };

// hook = câu mở video: câu đầu lời đọc (người xem nghe trước), không có giọng thì dòng chữ đầu trên hình
const cauDau = (s: string | null) => { const t = (s ?? '').trim(); if (!t) return null; const m = t.match(/^[\s\S]*?[.!?…](?=\s|$)/); return (m?.[0] ?? t.split('\n')[0] ?? '').trim() || null; };

// DỊCH HOOK (anh #1778 "các hook đều có thêm phần hiển thị tiếng Việt (dịch) để hiểu nghĩa"): câu có chữ cái riêng tiếng Việt thì không cần dịch
const laTiengViet = (s: string) => /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(s);
const docDich = async (db: NonNullable<ReturnType<typeof getDb>>, goc: string) =>
  (((await db.execute(sql`select vi from etp.dich where goc = ${goc}`)) as unknown as { vi: string }[])[0]?.vi ?? null);

/** Dịch MỘT câu hook sang tiếng Việt — nhớ ở etp.dich theo nguyên văn (câu trùng / mở lại thẻ không dịch lại). Cổng AI chung, dòng Haiku (~vài chục đồng một câu). */
export async function dichHook(goc: string): Promise<{ vi: string } | { loi: string }> {
  if (!(await quyenEtp(await getCurrentUser()))) return { loi: 'không có quyền' };
  const t = String(goc ?? '').trim();
  if (!t || t.length > 500) return { loi: 'câu hook rỗng hoặc dài quá 500 ký tự' };
  if (laTiengViet(t)) return { vi: t };
  const db = getDb(); if (!db) return { loi: 'không nối được kho' };
  const co = await docDich(db, t); if (co) return { vi: co };
  try {
    const { hoiChu } = await import('@mos2/cong-ai');
    const r = await hoiChu({ viec: 'etp2-dich-hook', model: 'haiku', max_tokens: 300,
      system: 'Bạn dịch câu mở đầu (hook) của video quảng cáo phim ngắn sang tiếng Việt tự nhiên, giữ nguyên tên riêng / tên phim. Chỉ trả đúng câu dịch, không ngoặc kép, không giải thích.',
      user: t });
    const vi = r.chu.trim().replace(/^["“'«]+|["”'»]+$/g, '').trim();
    if (!vi) return { loi: 'cổng AI trả bản dịch rỗng' };
    await db.execute(sql`insert into etp.dich (goc, vi, model, chi_usd) values (${t}, ${vi}, ${r.model ?? null}, ${r.chi_usd ?? null}) on conflict (goc) do nothing`);
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
  const hookVi = hookGoc && !laTiengViet(hookGoc) ? await docDich(db, hookGoc).catch(() => null) : null;
  const tenMien = (r.ten_mien as string) || (() => { const u = (r.final_url as string) || (r.link as string) || q.link || ''; try { return u ? new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, '') : null; } catch { return null; } })();
  return {
    cr, camp: r.camp == null ? null : Number(r.camp), chuaCamp: r.camp == null, dongBo,
    page: r.pten || r.panh ? { ten: (r.pten as string) ?? null, anh: (r.panh as string) ?? null, link: (r.plink as string) ?? null } : null,
    chinh: dongBo ? ds(r.chinh) : ds([q.chu_dau]), tieuDe: dongBo ? ds(r.tieu_de) : ds([q.headline]), moTa: dongBo ? ds(r.mo_ta) : ds([q.mo_ta]),
    cta: (r.cta as string) ?? null, tenMien, kieu: (r.kieu as string) ?? null,
    noiDung: r.co_cham !== true ? null : (() => {
      const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
      const chuVideo = s(r.chu_video), loiDoc = s(r.loi_doc);
      const so = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
      return {
        hook: hookGoc, hookVi, canDich: !!hookGoc && !laTiengViet(hookGoc), chuVideo, loiDoc, tomTat: s(r.tom_tat), meta: so(r.cmeta), afs: so(r.cafs), ket: s(r.cket),
        luc: r.cluc == null ? null : String(r.cluc),
        diem: ((r.cdiem ?? []) as { nhom: string; ma: string; ten: string; diem: unknown; ly_do: string | null }[])
          .filter((d) => so(d.diem) != null).map((d) => ({ nhom: d.nhom, ma: d.ma, ten: d.ten, diem: so(d.diem) as number, lyDo: s(d.ly_do) })),
      };
    })(),
  };
}

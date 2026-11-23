// BÀI QC + BẢN DỊCH CỦA MỘT CREATIVE — MỘT NGUỒN cho thẻ creative (actions/etp-bai.ts › docBaiQc) và máy dịch sẵn (scripts/dich-truoc.mts).
// Anh 23/11/2026: "Phần dịch thì phải làm ngay từ lúc sinh ra creative !! Nếu chưa dịch thì dịch 1 loạt luôn. Chỉ các creative đang, chuẩn bị và sẽ chạy !!"
// → máy dịch sẵn gom chữ ngoại ngữ ĐÚNG như thẻ gom (cùng hàm dungBaiQc), nên mở thẻ là có bản dịch, không chờ AI. Tệp này KHÔNG 'use server' và không import '@/…'
// để script chạy bằng tsx dùng chung được.
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';

type Db = NonNullable<ReturnType<typeof getDb>>;

export type DiemTc = { nhom: string; ma: string; ten: string; diem: number; lyDo: string | null };
/** giong: 'co' có lời đọc · 'khong' video không có tiếng nói · 'loi' chép giọng lỗi (Cloudflare từ chối) · 'chep_lai' máy đang chép lại giọng */
export type NoiDungCr = { hook: string | null; hookTu: 'giong' | 'chu' | null; giong: 'co' | 'khong' | 'loi' | 'chep_lai'; giongLoi: string | null;
  chuVideo: string | null; loiDoc: string | null; sauHook: string | null; tomTat: string | null; meta: number | null; afs: number | null; ket: string | null; luc: string | null; diem: DiemTc[] };
export type BaiQcTho = {
  cr: number; camp: number | null; chuaCamp: boolean; dongBo: boolean;
  page: { ten: string | null; anh: string | null; link: string | null } | null;
  chinh: string[]; tieuDe: string[]; moTa: string[]; cta: string | null; tenMien: string | null; kieu: string | null;
  /** NỘI DUNG TRONG VIDEO + CHẤM (anh #1774): đọc từ etp.cham — null khi creative chưa chấm */
  noiDung: NoiDungCr | null;
  /** mọi chữ ngoại ngữ trong thẻ (nguyên văn) — khoá của bản dịch */
  canDich: string[];
};

// hook = câu mở video: câu đầu lời đọc (người xem nghe trước), không có giọng thì dòng chữ đầu trên hình
export const cauDau = (s: string | null) => { const t = (s ?? '').trim(); if (!t) return null; const m = t.match(/^[\s\S]*?[.!?…](?=\s|$)/); return (m?.[0] ?? t.split('\n')[0] ?? '').trim() || null; };
// câu có chữ cái riêng tiếng Việt thì không cần dịch
const laTiengViet = (s: string) => /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(s);
export const TRAN_DICH = 4000, TRAN_SO_DICH = 60;
export const canDichChu = (s: string | null | undefined): s is string => !!s && !!s.trim() && s.length <= TRAN_DICH && !laTiengViet(s);

export async function docDich(db: Db, ds: string[]): Promise<Record<string, string>> {
  if (!ds.length) return {};
  const rows = (await db.execute(sql`select goc, vi from etp.dich where goc in (${sql.join(ds.map((d) => sql`${d}`), sql`, `)})`)) as unknown as { goc: string; vi: string }[];
  return Object.fromEntries(rows.map((r) => [r.goc, r.vi]));
}

/** Dịch các câu CHƯA nhớ trong ds (≤ TRAN_SO_DICH) bằng MỘT lượt AI (cổng chung, dòng Haiku) → nhớ etp.dich. Trả bản dịch mọi câu xin + tiền thật lượt đó. */
export async function dichKho(db: Db, dsGoc: string[], viec = 'etp2-dich'): Promise<{ vi: Record<string, string>; chi_usd: number; moi: number }> {
  const ds = [...new Set(dsGoc)].filter(canDichChu);
  if (ds.length > TRAN_SO_DICH) throw new Error(`xin dịch ${ds.length} đoạn một lượt, trần ${TRAN_SO_DICH}`);
  const vi = await docDich(db, ds);
  const thieu = ds.filter((d) => !vi[d]);
  if (!thieu.length) return { vi, chi_usd: 0, moi: 0 };
  const { goiAi } = await import('@mos2/cong-ai');
  const r = await goiAi({ viec, model: 'haiku',
    max_tokens: Math.min(8000, 400 + Math.ceil(thieu.reduce((n, d) => n + d.length, 0) * 1.2)),
    system: 'Bạn dịch nội dung quảng cáo phim ngắn (câu hook, chữ trên video, lời thoại, tóm tắt, nhận xét chấm điểm, chữ bài quảng cáo) sang tiếng Việt tự nhiên. '
      + 'Vào là mảng JSON các đoạn; trả {"vi": [...]} đúng số đoạn, đúng thứ tự, mỗi phần tử là bản dịch của đoạn cùng vị trí. Giữ nguyên tên riêng / tên phim, giữ dấu " / " và xuống dòng, không thêm giải thích.',
    noi_dung: JSON.stringify(thieu),
    schema: { type: 'object', properties: { vi: { type: 'array', items: { type: 'string' } } }, required: ['vi'] } },
  { kiem: (kq: { vi?: unknown[] } | null) => (Array.isArray(kq?.vi) && kq.vi.length === thieu.length && kq.vi.every((x) => typeof x === 'string' && x.trim()) ? null : `cần đúng ${thieu.length} bản dịch không rỗng`) }) as { kq: { vi: string[] }; model?: string; chi_usd?: number | null };
  const chi = r.chi_usd != null ? r.chi_usd / thieu.length : null; let moi = 0;
  for (const [k, goc] of thieu.entries()) {
    const v = String(r.kq.vi[k] ?? '').trim().replace(/^["“«]+|["”»]+$/g, '').trim(); if (!v) continue;
    vi[goc] = v; moi++;
    await db.execute(sql`insert into etp.dich (goc, vi, model, chi_usd) values (${goc}, ${v}, ${r.model ?? null}, ${chi}) on conflict (goc) do nothing`);
  }
  return { vi, chi_usd: r.chi_usd ?? 0, moi };
}

const ds = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : []);

/** Dựng bài QC + nội dung video của một creative từ kho (không quyền, không dịch) — thẻ và máy dịch sẵn cùng gọi. */
export async function dungBaiQc(db: Db, cr: number, camp: number | null): Promise<BaiQcTho> {
  const c = Number.isInteger(camp) && (camp as number) > 0 ? (camp as number) : null;
  // camp của bài: camp đang xem; không có thì camp nhà đang chạy mới nhất của creative này, rồi camp bất kỳ
  const r = ((await db.execute(sql`with k as (
      select x.camp_id from etp.camp x where x.creative_id = ${cr} and (${c}::int is null or x.camp_id = ${c}::int)
      order by (x.trang_thai = 'ACTIVE') desc, x.camp_id desc limit 1)
    select b.kieu, b.cta, b.link, b.chinh, b.tieu_de, b.mo_ta, (b.creative_id is not null and b.chinh is not null) dong_bo,
      (select camp_id from k) camp, bc.ten_mien, bc.final_url, p.ten pten, p.them->>'picture_url' panh, p.them->>'link' plink,
      (select tv.chu_qc from etp.thu_vien tv where tv.creative_id = ${cr} and tv.chu_qc is not null order by tv.id desc limit 1) chu_qc,
      ch.creative_id is not null co_cham, ch.lop->'chu'->>'noi_dung' chu_video, ch.lop->'giong'->>'noi_dung' loi_doc, ch.lop ? 'giong' co_giong, ch.lop->'noi_dung'->>'tom_tat' tom_tat,
      ch.meta cmeta, ch.afs cafs, ch.ket cket, ch.luc cluc, ch.loi cloi,
      (select h.trang_thai from etp.cham_hang h where h.creative_id = ${cr} and h.nguon = 'giong') hang_giong,
      (select coalesce(jsonb_agg(jsonb_build_object('nhom', tc.nhom, 'ma', tc.ma, 'ten', tc.ten, 'diem', ch.diem->(tc.nhom || '.' || tc.ma), 'ly_do', ch.ly_do->>(tc.nhom || '.' || tc.ma))
         order by tc.nhom desc, tc.thu_tu), '[]'::jsonb) from etp.tieu_chi tc where ch.diem -> (tc.nhom || '.' || tc.ma) is not null) cdiem
    from (select 1) o left join etp.bai_cr b on b.creative_id = ${cr}
      left join etp.cham ch on ch.creative_id = ${cr}
      left join etp.bai_camp bc on bc.camp_id = (select camp_id from k)
      left join etp.tai_nguyen p on p.loai = 'page' and (p.id = bc.page_id or p.external_id = bc.page_id::text)`)) as unknown as Record<string, unknown>[])[0] ?? {};
  const q = (r.chu_qc ?? {}) as { headline?: string; mo_ta?: string; chu_dau?: string; link?: string };
  const dongBo = r.dong_bo === true;
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const tenMien = (r.ten_mien as string) || (() => { const u = (r.final_url as string) || (r.link as string) || q.link || ''; try { return u ? new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, '') : null; } catch { return null; } })();
  const chinh = dongBo ? ds(r.chinh) : ds([q.chu_dau]), tieuDe = dongBo ? ds(r.tieu_de) : ds([q.headline]), moTa = dongBo ? ds(r.mo_ta) : ds([q.mo_ta]);
  const noiDung: NoiDungCr | null = r.co_cham !== true ? null : (() => {
    const chuVideo = s(r.chu_video), loiDoc = s(r.loi_doc);
    const hookGiong = cauDau(loiDoc), hook = hookGiong ?? cauDau(chuVideo);
    // giọng KHÔNG CÓ vì máy chép lỗi (Cloudflare 9423…) ≠ video không có tiếng — anh 23/11/2026 "Hook cũng ko giống với voice trong video?"
    const loiG = r.co_giong === true ? null : (String(r.cloi ?? '').match(/giọng: [^;]*/)?.[0] ?? null);
    const giong: NoiDungCr['giong'] = r.co_giong === true ? 'co' : r.hang_giong === 'cho' || r.hang_giong === 'dang' ? 'chep_lai' : loiG ? 'loi' : 'khong';
    const so = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
    return {
      // #1779: lời đọc PHÍA SAU câu hook (hook lấy từ lời đọc thì bỏ câu đó, lấy từ chữ trên hình thì giữ cả lời đọc)
      sauHook: loiDoc && hookGiong && hookGiong === hook ? loiDoc.slice(loiDoc.indexOf(hookGiong) + hookGiong.length).trim() || null : loiDoc,
      hook, hookTu: hook == null ? null : hookGiong ? 'giong' : 'chu', giong, giongLoi: giong === 'co' ? null : loiG,
      chuVideo, loiDoc, tomTat: s(r.tom_tat), meta: so(r.cmeta), afs: so(r.cafs), ket: s(r.cket),
      luc: r.cluc == null ? null : String(r.cluc),
      diem: ((r.cdiem ?? []) as { nhom: string; ma: string; ten: string; diem: unknown; ly_do: string | null }[])
        .filter((d) => so(d.diem) != null).map((d) => ({ nhom: d.nhom, ma: d.ma, ten: d.ten, diem: so(d.diem) as number, lyDo: s(d.ly_do) })),
    };
  })();
  // #1778: gom mọi chữ ngoại ngữ trong thẻ — hook · chữ trên video · lời đọc · tóm tắt · lý do chấm · chữ QC · tiêu đề · mô tả
  const canDich = [...new Set([noiDung?.hook, noiDung?.chuVideo, noiDung?.sauHook ?? noiDung?.loiDoc, noiDung?.tomTat, ...(noiDung?.diem ?? []).map((d) => d.lyDo),
    ...chinh, ...tieuDe, ...moTa].filter(canDichChu))].slice(0, TRAN_SO_DICH);
  return {
    cr, camp: r.camp == null ? null : Number(r.camp), chuaCamp: r.camp == null, dongBo,
    page: r.pten || r.panh ? { ten: (r.pten as string) ?? null, anh: (r.panh as string) ?? null, link: (r.plink as string) ?? null } : null,
    chinh, tieuDe, moTa, cta: (r.cta as string) ?? null, tenMien, kieu: (r.kieu as string) ?? null, noiDung, canDich,
  };
}

/** Creative "đang, chuẩn bị và sẽ chạy" (anh 23/11/2026): camp nhà đang ACTIVE · dòng thay thế đang chờ camp mới · hàng chờ lên camp (etp.cho_len_v, chưa bị từ chối). */
export const TAP_CHAY = sql`select creative_id from etp.camp where trang_thai = 'ACTIVE' and creative_id is not null
  union select creative_id from etp.thay_the where creative_id is not null and camp_moi is null and buoc <> 'huy'
  union select creative_id from etp.cho_len_v where tu_choi is null`;

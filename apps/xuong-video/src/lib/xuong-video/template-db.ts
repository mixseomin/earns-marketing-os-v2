// Template trên DB: dò ô của cả phim + CHÉP phim (phim · anchor · biến thể · tập · shot) kèm điền ô. Một hàm chép cho hai việc:
//   "Lưu thành template" (chép nguyên, đánh dấu template) và "Tạo phim từ template" (chép + điền ô, gắn tu_template).
// Chép theo DÒNG (mọi cột trừ id/thời điểm) → bảng thêm cột mới vẫn chép đủ, không phải sửa ở đây. 0đ: không gọi model nào.
// Hình/clip/giọng: giữ khi nội dung shot KHÔNG đổi (khối dùng chung: end card, shot sản phẩm…); nội dung đổi → bỏ media, shot về nháp.
import 'server-only';
import { sql } from 'drizzle-orm';
import { type Db, type Row, n, s } from './doc-db';
import { timO, dienSau, dsOTemplate, anchorGhiCung, type OTemplateDs } from './template';
import { ghepThoai, type CauHinhTemplate, type DongThoai, type KinhThanh } from './kieu';
import { thamKhaoSauDien, type NguonThamKhao, type ThamKhaoCau } from './tham-khao';
import { ganCtaTuDong } from './cta-db';

const BO = new Set(['id', 'created_at', 'updated_at']);
/** cột media của shot: còn đúng khi nội dung shot (chữ, prompt, anchor) không đổi */
const MEDIA_CANH: Record<string, unknown> = { keyframe_url: null, keyframe_uv: [], video_url: null, video_cuoi_url: null, video_phien_ban: [], nguon_video: {}, thoai_url: null, am_thanh_url: null, kiem_khung: null, chu_man_dich: {} };
const MEDIA_NV = new Set(['doi_chieu']);

const q = async (db: Db, s_: ReturnType<typeof sql>) => (await db.execute(s_)) as unknown as Row[];
const giong = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Chèn một dòng (object cột → giá trị) vào bảng, trả id. jsonb_populate_record lo kiểu từng cột. */
async function chen(db: Db, bang: 'xv_phim' | 'xv_nhan_vat' | 'xv_bien_the' | 'xv_tap' | 'xv_canh', dong: Row): Promise<number> {
  const cot = Object.keys(dong).filter((k) => !BO.has(k));
  if (cot.some((k) => !/^[a-z0-9_]+$/.test(k))) throw new Error(`tên cột lạ ở ${bang}`);
  const ds = sql.raw(cot.join(', '));
  const r = await q(db, sql`INSERT INTO ${sql.raw(bang)} (${ds}) SELECT ${ds} FROM jsonb_populate_record(null::${sql.raw(bang)}, ${JSON.stringify(dong)}::jsonb) RETURNING id`);
  return n(r[0]!.id);
}

async function docCaPhim(db: Db, phimId: number) {
  const phim = (await q(db, sql`SELECT * FROM xv_phim WHERE id = ${phimId}`))[0];
  if (!phim) return null;
  const nv = await q(db, sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`);
  const bt = nv.length ? await q(db, sql`SELECT * FROM xv_bien_the WHERE nhan_vat_id = ANY(${`{${nv.map((x) => n(x.id)).join(',')}}`}::int[]) ORDER BY id`) : [];
  const tap = await q(db, sql`SELECT * FROM xv_tap WHERE phim_id = ${phimId} ORDER BY so, id`);
  const canh = tap.length ? await q(db, sql`SELECT * FROM xv_canh WHERE tap_id = ANY(${`{${tap.map((x) => n(x.id)).join(',')}}`}::int[]) ORDER BY tap_id, thu_tu, id`) : [];
  return { phim, nv, bt, tap, canh };
}

/** kinh thánh không tính phần cấu hình template (nhãn/gợi ý của ô không phải nội dung phim) */
const ktNoiDung = (kt: KinhThanh) => { const { template: _t, tu_template: _u, ...con } = kt ?? {}; return con; };

/** Ô của template: dò trong mọi chữ của phim + nhãn đã khai. */
export type ShotKhung = { loai: string; giay: number; chu: string };
/** Ô + cấu trúc video (Hook → Nỗi đau → … → CTA: loại shot, giây, chữ màn của tập đầu) của template. */
export async function docOTemplate(db: Db, phimId: number): Promise<{ cfg: CauHinhTemplate | null; o: OTemplateDs[]; khung: ShotKhung[] } | null> {
  const d = await docCaPhim(db, phimId);
  if (!d) return null;
  const kt = (d.phim.kinh_thanh ?? {}) as KinhThanh;
  const thay = timO([ktNoiDung(kt), d.phim.mo_ta, d.nv, d.bt, d.tap, d.canh]);
  const tap1 = d.tap[0];
  const khung = tap1 ? d.canh.filter((c) => n(c.tap_id) === n(tap1.id) && (c.nhanh == null || c.nhanh === '' || c.nhanh === 'A')).map((c) => ({ loai: s(c.phan_doan), giay: Number(c.phat_s ?? c.thoi_luong_s ?? 0), chu: s(c.chu_man) })) : [];
  return { cfg: kt.template ?? null, o: dsOTemplate(kt.template, thay), khung };
}

export type KetQuaChep = { phimId: number; soShot: number; giuMedia: number; nhapLai: number };


/** Chép cả phim. laTemplate=true: bản sao là template (giữ nhãn ô). Ngược lại: điền `gt` vào mọi ô, gắn tu_template = nguồn. */
/** tk = nguồn tham khảo theo ô (tham-khao.ts): câu chữ của shot dùng ô nào thì mang nguồn của ô đó; câu cố định của template giữ nguồn của nó. */
export async function chepPhim(db: Db, nguonId: number, o: { ten: string; gt: Record<string, string>; laTemplate: boolean; tk?: Record<string, NguonThamKhao[]> }): Promise<KetQuaChep | null> {
  const d = await docCaPhim(db, nguonId);
  if (!d) return null;
  // Tạo phim TỪ template: anchor sản phẩm ghi cứng = phim mới mang sản phẩm của nguồn → dừng, không chép (lỗi nói rõ để sửa template).
  if (!o.laTemplate && (d.phim.kinh_thanh as KinhThanh | null)?.template) {
    const loi = anchorGhiCung(d.nv as { loai: unknown; ten: unknown; anh_ref?: unknown }[]);
    if (loi.length) throw new Error(`template #${nguonId} hỏng: ${loi.join('; ')} — sửa anchor của template (tab 📖 Phim) rồi tạo lại`);
  }
  const gt = o.gt;
  const kq = await db.transaction(async (tx) => {
    const t = tx as unknown as Db;
    // phim
    const ktCu = (d.phim.kinh_thanh ?? {}) as KinhThanh;
    const ktMoi: KinhThanh = { ...dienSau(ktNoiDung(ktCu), gt), luu_tru: false,
      template: o.laTemplate ? { mo_ta: ktCu.template?.mo_ta ?? '', o: ktCu.template?.o ?? {}, thu_tu: ktCu.template?.thu_tu ?? [] } : null,
      tu_template: o.laTemplate ? null : { id: nguonId, ten: s(d.phim.ten), gia_tri: gt, ...(o.tk ? { tham_khao: o.tk } : {}), luc: new Date().toISOString() } };
    const phimId = await chen(t, 'xv_phim', { ...d.phim, ten: o.ten, mo_ta: dienSau(s(d.phim.mo_ta), gt), kinh_thanh: ktMoi, poster_url: null, poster_uv: [] });
    // anchor + biến thể: anchor đổi chữ → ảnh biến thể cũ không còn đúng
    const doiNv = new Map<number, number>(); const nvDoi = new Set<number>(); const doiBt = new Map<number, number>(); const btDoi = new Set<number>();
    for (const v of d.nv) {
      const moi = dienSau(v, gt); const doi = !giong(v, moi);
      if (doi) nvDoi.add(n(v.id));
      doiNv.set(n(v.id), await chen(t, 'xv_nhan_vat', { ...moi, phim_id: phimId, ...(doi ? Object.fromEntries([...MEDIA_NV].map((k) => [k, null])) : {}) }));
    }
    for (const b of d.bt) {
      const moi = dienSau(b, gt); const coO = timO(b.anh_url).length > 0;
      const bo = !coO && (nvDoi.has(n(b.nhan_vat_id)) || !giong({ ...b, anh_url: null }, { ...moi, anh_url: null }));
      if (bo || coO) btDoi.add(n(b.id));
      doiBt.set(n(b.id), await chen(t, 'xv_bien_the', { ...moi, nhan_vat_id: doiNv.get(n(b.nhan_vat_id)), anh_url: bo ? null : moi.anh_url }));
    }
    // tập + shot
    let giuMedia = 0, nhapLai = 0;
    const doiTap = new Map<number, number>();
    for (const tp of d.tap) {
      const moi = dienSau(tp, gt); const doi = !giong(tp, moi);
      doiTap.set(n(tp.id), await chen(t, 'xv_tap', { ...moi, phim_id: phimId, xuat: [], video_url: null, ...(doi || !o.laTemplate ? { thu_nguoi_xem: null } : {}) }));
    }
    for (const c of d.canh) {
      const noiDung = Object.fromEntries(Object.entries(c).filter(([k]) => !(k in MEDIA_CANH)));
      const noiDungMoi = dienSau(noiDung, gt);
      const anchorDoi = ((c.nhan_vat as number[]) ?? []).some((id) => nvDoi.has(Number(id))) || ((c.bien_the as number[]) ?? []).some((id) => btDoi.has(Number(id)));
      const doi = anchorDoi || !giong(noiDung, noiDungMoi);
      const media = Object.fromEntries(Object.keys(MEDIA_CANH).map((k) => {
        const cu = c[k];
        if (timO(cu).length) return [k, dienSau(cu, gt)];   // media là ô (ảnh thật của sản phẩm) → điền
        return [k, doi ? MEDIA_CANH[k] : cu];
      }));
      // lời không đổi thì giữ file giọng của câu đó
      const thoaiCu = (c.thoai as { loi?: string; url?: string | null }[]) ?? [];
      const thoai = ((noiDungMoi.thoai as { loi?: string; url?: string | null }[]) ?? []).map((x, i) => (x.loi === thoaiCu[i]?.loi ? x : { ...x, url: null }));
      if (doi) nhapLai++; else giuMedia++;
      const tham_khao = o.laTemplate ? (c.tham_khao ?? []) : thamKhaoSauDien({ chu_man: s(c.chu_man), thoai: (c.thoai as { loi?: string }[]) ?? [], tham_khao: (c.tham_khao as ThamKhaoCau[]) ?? [] }, gt, o.tk);
      await chen(t, 'xv_canh', { ...noiDungMoi, ...media, thoai, tham_khao, tap_id: doiTap.get(n(c.tap_id)), chi_phi_cents: 0, loi: '', soat: null,
        nhan_vat: ((c.nhan_vat as number[]) ?? []).map((x) => doiNv.get(Number(x))).filter((x) => x != null),
        bien_the: ((c.bien_the as number[]) ?? []).map((x) => doiBt.get(Number(x))).filter((x) => x != null),
        trang_thai: doi ? (media.keyframe_url ? 'co_keyframe' : 'nhap') : c.trang_thai });
    }
    return { phimId, soShot: d.canh.length, giuMedia, nhapLai };
  });
  // QC mới: kiểu CTA ít dùng nhất cho cùng sản phẩm (thư viện CTA, cta-db.ts) → các video không trùng CTA
  if (!o.laTemplate) await ganCtaTuDong(db, kq.phimId);
  return kq;
}

/** ĐIỀN LẠI CHỮ từ template (anh 15/10/2026: câu chữ QC phải viết lại theo nguồn tham khảo): phim đã tạo từ template nhận giá trị ô mới + nguồn
 *  theo ô → mỗi shot lấy lại chữ màn + lời từ shot template cùng vị trí (tập theo thứ tự, shot theo thu_tu + nhánh), gắn tham_khao.
 *  CHỈ chữ (kiểu chữ CTA của phim giữ nguyên — cta-db.ts): keyframe / clip giữ nguyên; câu lời đổi thì bỏ file giọng câu đó (phải sinh giọng lại). Trả số shot đổi + số câu cần giọng mới. */
export async function dienLaiChu(db: Db, phimId: number, o: { gt: Record<string, string>; tk: Record<string, NguonThamKhao[]> }): Promise<{ shot: number; canGiong: number; lech: string[] } | null> {
  const phim = (await q(db, sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`))[0];
  const kt = (phim?.kinh_thanh ?? {}) as KinhThanh;
  if (!kt.tu_template?.id) return null;
  const tpl = await docCaPhim(db, kt.tu_template.id);
  if (!tpl) return null;
  const gt = { ...kt.tu_template.gia_tri, ...o.gt };
  const tk = { ...(kt.tu_template.tham_khao ?? {}), ...o.tk };
  const tapP = await q(db, sql`SELECT id FROM xv_tap WHERE phim_id = ${phimId} ORDER BY so, id`);
  let shot = 0, canGiong = 0; const lech: string[] = [];
  return db.transaction(async (tx) => {
    const t = tx as unknown as Db;
    for (const [i, tp] of tapP.entries()) {
      const tt = tpl.tap[i];
      if (!tt) { lech.push(`tập ${i + 1}: template không có`); continue; }
      const nguon = tpl.canh.filter((c) => n(c.tap_id) === n(tt.id));
      for (const c of await q(t, sql`SELECT id, thu_tu, nhanh, thoai FROM xv_canh WHERE tap_id = ${n(tp.id)} ORDER BY thu_tu, id`)) {
        const m = nguon.find((x) => n(x.thu_tu) === n(c.thu_tu) && s(x.nhanh) === s(c.nhanh));
        if (!m) { lech.push(`shot #${n(c.thu_tu)}: template không có`); continue; }
        const thoaiT = (m.thoai as { loi?: string }[]) ?? [];
        const thoaiCu = (c.thoai as { loi?: string; url?: string | null }[]) ?? [];
        const thoai = (dienSau(thoaiT, gt) as { loi?: string; url?: string | null }[]).map((x, j) => {
          const cu = thoaiCu[j];
          if (cu && cu.loi === x.loi) return { ...x, ...cu };   // giữ NGUYÊN câu cũ (file giọng + giọng đã đọc + độ dài) — trước chỉ giữ url, mất nhãn giọng
          if (x.loi?.trim()) canGiong++;
          return { ...x, url: null };
        });
        const tham_khao = thamKhaoSauDien({ chu_man: s(m.chu_man), thoai: thoaiT, tham_khao: (m.tham_khao as ThamKhaoCau[]) ?? [] }, gt, tk);
        await t.execute(sql`UPDATE xv_canh SET chu_man = ${dienSau(s(m.chu_man), gt)}, thoai = ${JSON.stringify(thoai)}::jsonb,
          loi_thoai = ${ghepThoai(thoai as DongThoai[])}, tham_khao = ${JSON.stringify(tham_khao)}::jsonb, updated_at = now() WHERE id = ${n(c.id)}`);
        shot++;
      }
    }
    await t.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(jsonb_set(kinh_thanh, '{tu_template,gia_tri}', ${JSON.stringify(gt)}::jsonb), '{tu_template,tham_khao}', ${JSON.stringify(tk)}::jsonb), updated_at = now() WHERE id = ${phimId}`);
    return { shot, canGiong, lech };
  });
}

/** ĐIỀN LẠI HÌNH từ template cho vài shot (sửa template trước rồi áp xuống phim): góc máy + prompt ảnh/video + nhân vật trong khung + kỹ thuật
 *  (cỡ cảnh, máy) lấy từ shot template cùng vị trí, điền ô của phim. KHÔNG đụng chữ / lời / hành động (giữ kết quả kiểm người xem), keyframe cũ
 *  giữ trong dải ứng viên — sinh keyframe lại là bước riêng. Anchor template ↔ anchor phim ghép theo thứ tự tạo (chepPhim chép theo thứ tự id). */
export async function dienLaiHinh(db: Db, phimId: number, thuTu: number[]): Promise<number> {
  const kt = ((await q(db, sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`))[0]?.kinh_thanh ?? {}) as KinhThanh;
  if (!kt.tu_template?.id) return 0;
  const tpl = await docCaPhim(db, kt.tu_template.id);
  if (!tpl) return 0;
  const nvP = await q(db, sql`SELECT id FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`);
  const doiNv = new Map(tpl.nv.map((v, i) => [n(v.id), nvP[i] ? n(nvP[i]!.id) : null]));
  const tap1 = tpl.tap[0]; const tapP = (await q(db, sql`SELECT id FROM xv_tap WHERE phim_id = ${phimId} ORDER BY so, id`))[0];
  if (!tap1 || !tapP) return 0;
  let sua = 0;
  for (const so of thuTu) {
    const m = tpl.canh.find((c) => n(c.tap_id) === n(tap1.id) && n(c.thu_tu) === so && !s(c.nhanh));
    if (!m) continue;
    const g = dienSau({ goc_may: s(m.goc_may), prompt_anh: s(m.prompt_anh), prompt_video: s(m.prompt_video) }, kt.tu_template.gia_tri);
    const nv = ((m.nhan_vat as number[]) ?? []).map((x) => doiNv.get(Number(x))).filter((x) => x != null);
    await db.execute(sql`UPDATE xv_canh SET goc_may = ${g.goc_may}, prompt_anh = ${g.prompt_anh}, prompt_video = ${g.prompt_video}, nhan_vat = ${JSON.stringify(nv)}::jsonb,
      ky_thuat = ${JSON.stringify(m.ky_thuat ?? {})}::jsonb, updated_at = now() WHERE tap_id = ${n(tapP.id)} AND thu_tu = ${so} AND coalesce(nhanh, '') = ''`);
    sua++;
  }
  return sua;
}

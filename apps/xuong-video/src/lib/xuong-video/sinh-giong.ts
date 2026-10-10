// Lõi sinh giọng đọc thoại theo dòng cho các shot — tách khỏi actions.ts để script trên box (scripts/sinh-shot.mts) và server action
// (sinhGiong) dùng CÙNG một đường; actions chỉ kiểm quyền rồi gọi vào đây. Mỗi dòng thoại một job 'am' → hàng đợi → file R2 → gắn vào dòng.
import 'server-only';
import { sql } from 'drizzle-orm';
import { dayViecAm } from './hoan-tat';
import { dongThoai, giaGiong, GIONG_MAC_DINH, timNv } from './am-thanh';
import { dsMoHinhGiong, giongCua, dauVaoGiongTheoModel, coElevenTrucTiep } from './giong';
import { boiCanhTap, mapCanh, taoJob, type Db, type Row } from './doc-db';
import { chanChuModel, coMau } from './kieu';

type Kq<T = undefined> = { ok: true; data: T } | { ok: false; loi: string };
const loi = (m: string): { ok: false; loi: string } => ({ ok: false, loi: m });
export const MODEL_GIONG_MAC_DINH = () => (coElevenTrucTiep() ? 'elevenlabs:eleven_v3' : GIONG_MAC_DINH.model);
export async function giongMacDinh(model: string): Promise<string> {
  const ds = await giongCua(model);
  return ds.find((g) => g.id === GIONG_MAC_DINH.voice)?.id ?? ds[0]?.id ?? '';
}

export type TuyGiong = { model?: string; voice?: string; camXuc?: number; chiThieu?: boolean;
  /** giọng cho từng người nói của lượt này (khoá = tên nhân vật, '' = lời dẫn) — chọn trong bảng ＋ (#1203) */
  theoNguoi?: Record<string, { model: string; voice: string }> };

/** tuy: chọn từ bảng ＋ trên timeline (#1202) — model/giọng cho lượt này (không đổi giọng cố định của nhân vật), cảm xúc, chỉ dòng chưa có giọng. */
export async function sinhGiongShots(db: Db, tapId: number, canhIds?: number[], tuy: TuyGiong = {}): Promise<Kq<number>> {
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh).filter((c) => (!canhIds || canhIds.includes(c.id)) && dongThoai(c, bc.nhanVat).length > 0);
  if (!ds.length) return loi('không có shot nào có lời thoại');
  for (const c of ds) { const chan = chanChuModel(bc.kt.ngon_ngu, { shot: { thu_tu: c.thu_tu, thoai: c.thoai, loi_thoai: c.loi_thoai } }); if (chan) return loi(chan); }
  const dm = await dsMoHinhGiong();
  // Lời dẫn = MỘT giọng cho cả phim (kt.giong_dan). Chọn giọng lời dẫn ở lượt này (bảng ＋ hoặc model/giọng chung của lượt) = đổi giọng
  // lời dẫn của cả phim; chưa có thì lượt đầu khoá giọng nó dùng. Phim có QC mẫu mà chưa chọn → dừng, không tự rơi về giọng mặc định
  // (10/10/2026: phim #5 đọc bằng George nam, QC mẫu giọng nữ).
  const coLoiDan = ds.some((c) => c.thoai.concat(c.thoai.length ? [] : dongThoai(c, bc.nhanVat)).some((d) => d.loi.trim() && !timNv(bc.nhanVat, d.nhan_vat) && !(tuy.chiThieu && d.url)));
  const chonDan = tuy.theoNguoi?.[''] ?? (tuy.model && tuy.voice ? { model: tuy.model, voice: tuy.voice } : null);
  let giongDan = chonDan ?? bc.kt.giong_dan ?? null;
  if (coLoiDan && !giongDan) {
    if (coMau(bc.kt.qc)) return loi('Phim có QC mẫu: chọn giọng LỜI DẪN cho cả phim trước (cùng giới tính với giọng của mẫu) — không tự dùng giọng mặc định');
    const m = MODEL_GIONG_MAC_DINH(); giongDan = { model: m, voice: await giongMacDinh(m) };
  }
  if (coLoiDan && giongDan && (giongDan.model !== bc.kt.giong_dan?.model || giongDan.voice !== bc.kt.giong_dan?.voice)) {
    await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(coalesce(kinh_thanh, '{}'::jsonb), '{giong_dan}', ${JSON.stringify(giongDan)}::jsonb), updated_at = now() WHERE id = ${bc.tap.phim_id}`);
  }
  let so = 0;
  for (const c of ds) {
    // Thoại theo dòng (kịch bản phim): mỗi dòng một file, giọng của đúng người nói dòng đó. Shot cũ chỉ có chuỗi → tách dòng và LƯU
    // vào c.thoai trước, để file giọng gắn đúng dòng (cùng một cách đọc với thẻ shot/timeline: dongThoai).
    if (!c.thoai.length && c.loi_thoai.trim()) {
      c.thoai = dongThoai(c, bc.nhanVat);
      await db.execute(sql`UPDATE xv_canh SET thoai = ${JSON.stringify(c.thoai)}::jsonb WHERE id = ${c.id}`);
    }
    if (c.thoai.length) {
      for (const [i, d] of c.thoai.entries()) {
        if (!d.loi.trim() || (tuy.chiThieu && d.url)) continue;
        const v = timNv(bc.nhanVat, d.nhan_vat) ?? null;
        const chon = v ? tuy.theoNguoi?.[d.nhan_vat.trim()] ?? tuy.theoNguoi?.[v.ten] : giongDan;
        const model = chon?.model || tuy.model || v?.giong_model || MODEL_GIONG_MAC_DINH();
        const voice = chon?.voice || (tuy.model ? tuy.voice : '') || (v?.giong_model === model ? v.giong_id : '') || await giongMacDinh(model);
        const text = d.loi.trim();
        const g = giaGiong(dm.find((m) => m.key === model), text.length);
        const gia = g ?? 0;   // model không công bố giá → sổ ghi 0 và nhãn job ghi "giá chưa rõ" để sổ chi phí không hiểu nhầm là miễn phí
        const job = await taoJob(db, { nhan: `Giọng · shot #${c.thu_tu} dòng ${i + 1} · ${v?.ten ?? 'lời dẫn'} (${voice})${g == null ? ' · giá chưa rõ' : ''}`, canh_id: c.id, nhan_vat_id: v?.id, loai: 'am', provider: model.startsWith('elevenlabs:') ? 'elevenlabs' : 'fal', model: model.startsWith('elevenlabs:') ? model : `fal:${model}`, request: { dich: 'thoai', dong: i, gia, text, voice, giong: `${model}|${voice}` } });
        await dayViecAm({ kieu: 'am', job, model, input: await dauVaoGiongTheoModel(model, { text: d.dien_xuat && /eleven/.test(model) && /v3/.test(model) ? `[${d.dien_xuat}] ${text}` : text, voice, ngonNgu: bc.kt.ngon_ngu ?? 'vi', camXuc: tuy.camXuc ?? c.cam_xuc, theLoai: bc.kt.the_loai ?? '' }), thuMuc: `thoai/${c.id}-${i}` });
        so++;
      }
    }
  }
  return { ok: true, data: so };
}

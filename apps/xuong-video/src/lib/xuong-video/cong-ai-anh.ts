// ẢNH QUA CỔNG AI CHUNG — phần CHẠY máy chủ / Worker của cong-ai.ts (cong-ai.ts còn được giao diện import lấy hằng số / tên nguồn; gói @mos2/cong-ai đọc node:fs
// nên không được kéo vào bản trình duyệt — deploy 294409378 đỏ "Reading from node:fs is not handled"). Studio không giữ khoá ảnh nào: chuỗi + khoá ở cổng
// (spy-on-tc/server/cong-anh.mjs: ckey → ShopAIKey → Google → OpenAI; ép đích danh một cổng bằng {cong, model}).
import { goiCong, loiCua } from './cong-ai-goi';
import { GIA_ANH_VND, TOI_DA_REF, VND_MOI_USD, centsCong, laHetTien, type BuocNguon, type CongKey, type NguonSinh } from './cong-ai';
import type { TiLeAnh } from './kieu';

type KqCong = { anh_b64: string; mime: string; model: string; chi_usd: number };
const tachModel = (m: string): { cong: CongKey; model: string } => { const [c, ...r] = String(m).split(':'); return { cong: (c as CongKey) || 'ckey', model: r.join(':') }; };

/** Ảnh "tự chọn rẻ nhất" QUA CỔNG: POST /api/ai {loai: 'anh'} — chuỗi người bán Nano Banana ckey → ShopAIKey → lưới cuối chính hãng nằm ở cổng (luật đã đo giữ
 *  nguyên: danh mục sống rẻ → đắt, người hỏng nghỉ 20 phút, có tham chiếu bỏ Pro + người lờ tham chiếu, ckey tối đa 3 ảnh) và ghi sổ ai_luot chung.
 *  modelGoogle giữ trong chữ ký cho nơi gọi cũ (cổng chọn dòng Nano Banana). Hỏng hết → null + câu lỗi của cổng. */
export async function sinhAnhQuaCong(_modelGoogle: string, o: { prompt: string; thamChieuUrl: string[]; tiLe: TiLeAnh }, boChinhHang = false): Promise<{ anh: { data: Buffer; mimeType: string } | null; nguon: NguonSinh | null; thu: BuocNguon[] }> {
  const t0 = Date.now();
  try {
    const r = await goiCong<KqCong>({ viec: 'xv-anh', loai: 'anh', prompt: o.prompt, ti_le: o.tiLe, tham_chieu: o.thamChieuUrl, bo_chinh_hang: boChinhHang }, 10 * 60e3);
    const giay = Math.round((Date.now() - t0) / 100) / 10; const { cong, model } = tachModel(r.model);
    const vnd = Math.round(r.chi_usd * VND_MOI_USD * 10) / 10;
    const thu: BuocNguon[] = [{ cong, model, ok: true, giay }];
    return { anh: { data: Buffer.from(r.anh_b64, 'base64'), mimeType: r.mime || 'image/png' }, thu,
      nguon: { cong, model, nguoi_ban: cong === 'ckey' ? model.split('/')[0] : undefined, vnd, cents: centsCong(vnd), giay, thu } };
  } catch (e) {
    const loi = loiCua(e);
    return { anh: null, nguon: null, thu: [{ cong: 'ckey', model: 'cổng AI chung', ok: false, loi: loi.slice(0, 300), het_tien: /hết tiền|insufficient/i.test(loi), giay: Math.round((Date.now() - t0) / 100) / 10 }] };
  }
}

/** MỘT cổng đích danh cho ảnh ('<cổng>:<model>' trên ô chọn, hoặc script chọn người bán): cổng gọi đúng một bước, không lùi sang cổng khác. Kèm nguồn.
 *  cong: ckey | shopaikey | plenxai | google | openai. */
export async function sinhAnhMotCong(cong: CongKey | 'openai', model: string, o: { prompt: string; thamChieuUrl: string[]; tiLe: TiLeAnh }): Promise<{ anh: { data: Buffer; mimeType: string } | null; nguon: NguonSinh; loi?: string }> {
  // Cổng nhận ít ảnh tham chiếu hơn shot cần → dừng NGAY, không gửi lượt chắc chắn bị từ chối (17/10/2026 tập 122 #13: ckey 400 hai lần với 5 ảnh);
  // không cắt bớt ảnh (bản đồ "ảnh N là gì" trong prompt sẽ sai) — chọn cổng nhận đủ ảnh.
  const toiDa = TOI_DA_REF[cong as CongKey];
  if (toiDa != null && o.thamChieuUrl.length > toiDa) { const loi = `cổng ${cong} nhận tối đa ${toiDa} ảnh tham chiếu, shot có ${o.thamChieuUrl.length} — chọn cổng khác (vd shopaikey:)`; return { anh: null, loi, nguon: { cong, model, thu: [{ cong, model, ok: false, loi, giay: 0 }] } }; }
  const t0 = Date.now();
  try {
    const r = await goiCong<KqCong>({ viec: 'xv-anh', loai: 'anh', cong, model, prompt: o.prompt, ti_le: o.tiLe, tham_chieu: o.thamChieuUrl }, 10 * 60e3);
    const giay = Math.round((Date.now() - t0) / 100) / 10; const that = tachModel(r.model).model;
    const vnd = GIA_ANH_VND[`${cong}:${model}`] ?? Math.round(r.chi_usd * VND_MOI_USD * 10) / 10;
    return { anh: { data: Buffer.from(r.anh_b64, 'base64'), mimeType: r.mime || 'image/png' },
      nguon: { cong, model, model_that: that !== model ? that : undefined, nguoi_ban: cong === 'ckey' ? model.split('/')[0] : undefined, vnd, cents: centsCong(vnd), giay, thu: [{ cong, model, ok: true, giay }] } };
  } catch (e) {
    const loi = loiCua(e).slice(0, 400), giay = Math.round((Date.now() - t0) / 100) / 10;
    return { anh: null, loi, nguon: { cong, model, thu: [{ cong, model, ok: false, loi, het_tien: laHetTien(cong, loi), giay }] } };
  }
}

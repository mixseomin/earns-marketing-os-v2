// ẢNH QUA CỔNG AI CHUNG — phần CHẠY máy chủ của cong-ai.ts (cong-ai.ts còn được giao diện import lấy hằng số / tên nguồn; gói @mos2/cong-ai đọc node:fs nên
// không được kéo vào bản trình duyệt — deploy 294409378 đỏ "Reading from node:fs is not handled"). Nơi gọi máy chủ: google.ts, dung-lop-may.ts, scripts.
import 'server-only';
import { goiAi } from '@mos2/cong-ai';
import { VND_MOI_USD, centsCong, type BuocNguon, type CongKey, type NguonSinh } from './cong-ai';
import type { TiLeAnh } from './kieu';

/** Ảnh "tự chọn rẻ nhất" QUA CỔNG AI CHUNG (anh 16/11/2026: một nguồn cho mọi model): POST /api/ai {loai: 'anh'} — chuỗi người bán Nano Banana ckey → ShopAIKey
 *  nay nằm ở cổng (spy-on-tc/server/cong-anh.mjs, chép từ bản cũ ở đây, giữ nguyên luật đã đo: danh mục sống rẻ → đắt, người hỏng nghỉ 20 phút, có tham chiếu bỏ
 *  Pro + người lờ tham chiếu, ckey tối đa 3 ảnh) và ghi sổ ai_luot chung. modelGoogle giữ trong chữ ký cho nơi gọi cũ (cổng chọn dòng Nano Banana).
 *  Hỏng hết → null + câu lỗi của cổng (google.ts › sinhAnh nối tiếp như trước). */
export async function sinhAnhQuaCong(_modelGoogle: string, o: { prompt: string; thamChieuUrl: string[]; tiLe: TiLeAnh }): Promise<{ anh: { data: Buffer; mimeType: string } | null; nguon: NguonSinh | null; thu: BuocNguon[] }> {
  const t0 = Date.now();
  try {
    const r = await goiAi({ viec: 'xv-anh', loai: 'anh', prompt: o.prompt, ti_le: o.tiLe, tham_chieu: o.thamChieuUrl } as never, { lan: 1, hanMs: 10 * 60e3 }) as unknown as { anh_b64: string; mime: string; model: string; chi_usd: number };
    const giay = Math.round((Date.now() - t0) / 100) / 10; const [cong, ...m] = String(r.model).split(':'); const model = m.join(':');
    const vnd = Math.round(r.chi_usd * VND_MOI_USD * 10) / 10;
    const thu: BuocNguon[] = [{ cong: (cong as CongKey) || 'ckey', model, ok: true, giay }];
    return { anh: { data: Buffer.from(r.anh_b64, 'base64'), mimeType: r.mime || 'image/png' }, thu,
      nguon: { cong: (cong as CongKey) || 'ckey', model, nguoi_ban: cong === 'ckey' ? model.split('/')[0] : undefined, vnd, cents: centsCong(vnd), giay, thu } };
  } catch (e) {
    const loi = (e instanceof Error ? e.message : String(e)).replace(/^cổng AI:\s*/, '');
    return { anh: null, nguon: null, thu: [{ cong: 'ckey', model: 'cổng AI chung', ok: false, loi: loi.slice(0, 300), het_tien: /hết tiền|insufficient/i.test(loi), giay: Math.round((Date.now() - t0) / 100) / 10 }] };
  }
}


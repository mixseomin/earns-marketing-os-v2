// Xuất một tập — MỘT đường cho nút ⬇ Xuất (actions.ts › xuatTap) và script (scripts/xuat-tap.mts): cùng cổng người xem + cổng tiếng,
// cùng job, cùng chỗ ghi bản xuất. Trước 15/10/2026 lõi nằm trong server action có kiểm phiên admin → máy không tự xuất được, phải nhờ anh bấm.
// 0đ (ffmpeg trên máy chủ, không gọi model).
import 'server-only';
import { sql } from 'drizzle-orm';
import { chayXuat, ghiBanXuat } from './xuat-chay';
import { kiemTieng } from './khop-giong';
import { chanNguoiXem } from './nguoi-xem';
import { kiemQc } from './kiem-qc';
import { docKinhThanh, locNhanh, type Canh } from './kieu';
import { boiCanhTap, taoJob, xongJob, mapCanh, type Db, type Row } from './doc-db';
import { khopGiongTap } from './hau-ky';

/** Kiểm cổng + tạo job; trả `chay` (promise dựng + ghi) để server action đẩy chạy nền, script thì đợi. */
export async function batDauXuatTap(db: Db, tapId: number, canh: Canh[], nhanh?: string | null): Promise<{ ok: true; job: number; chay: () => Promise<{ loi?: string }> } | { ok: false; loi: string }> {
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return { ok: false, loi: 'không thấy tập' };
  if (!canh.length) return { ok: false, loi: 'tập chưa có cảnh' };
  const dang = (await db.execute(sql`SELECT 1 FROM xv_job WHERE loai = 'xuat' AND trang_thai = 'cho' AND request->>'tap_id' = ${String(tapId)} AND created_at > now() - interval '20 minutes' LIMIT 1`)) as unknown as Row[];
  if (dang.length) return { ok: false, loi: 'đang có một bản xuất của tập này chạy dở — chờ xong rồi xuất lại' };
  // Cổng xuất: máy kiểm tiếng (khop-giong.ts › kiemTieng) — câu bị cắt / đè nhau / đọc quá nhanh thì không ra bản lỗi.
  const hieu = chanNguoiXem(bc.tap.thu_nguoi_xem, locNhanh(canh, 'A'));
  if (hieu.length) return { ok: false, loi: `Chưa xuất được — ${hieu[0]}` };
  let tieng = kiemTieng(locNhanh(canh, nhanh || 'A'), bc.nhanVat);
  // Giây shot đổi SAU lượt tự khớp lúc sinh giọng (điền lại từ template, sửa giây tay, đổi clip) → câu dẫn tràn sang shot sau. Trước 15/10/2026
  // cổng chỉ bảo "bấm ⏱ khớp giây theo giọng" và chờ người bấm; giờ tự khớp (0đ, có chụp trước để ↶ Hoàn tác) rồi đo lại, còn lỗi mới chặn.
  if (tieng.length) {
    const k = await khopGiongTap(db, tapId, 'tự khớp lúc xuất');
    if (k.ok) {
      canh = ((await db.execute(sql`SELECT c.* FROM xv_canh c WHERE c.tap_id = ${tapId} ORDER BY c.thu_tu, c.id`)) as unknown as Row[]).map(mapCanh);
      tieng = kiemTieng(locNhanh(canh, nhanh || 'A'), bc.nhanVat);
    }
  }
  if (tieng.length) return { ok: false, loi: `Chưa xuất được — tiếng còn lỗi: ${tieng.slice(0, 4).join('; ')}${tieng.length > 4 ? `; +${tieng.length - 4} lỗi nữa` : ''}` };
  const kt = docKinhThanh(bc.kt);
  // Luật QC máy chặn được (kiem-qc.ts) — chỉ những luật sai là ra bản hỏng, không phải gu: màn kết thiếu tên sản phẩm.
  const qcSai = kiemQc({ loai: bc.loai, canh: locNhanh(canh, nhanh || 'A'), nhanVat: bc.nhanVat, qc: kt.qc, nhanh }).filter((x) => !x.ok && ['ten_cuoi'].includes(x.key));
  if (qcSai.length) return { ok: false, loi: `Chưa xuất được — ${qcSai.map((x) => x.chiTiet ?? x.chu).join('; ')}` };
  const job = await taoJob(db, { phim_id: bc.tap.phim_id, nhan: `Xuất bản · tập ${bc.tap.so}${nhanh ? ` · hook ${nhanh}` : ''}`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { tap_id: tapId, nhanh: nhanh ?? '' } });
  return { ok: true, job, chay: async () => {
    const kq = await chayXuat({ loai: bc.loai, tiLe: kt.ti_le, nhipStopMotion: kt.nhip_stop_motion, canh, nhanVat: bc.nhanVat, tap: bc.tap, qc: kt.qc, nhanh });
    if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); return { loi: kq.loi }; }
    await ghiBanXuat(db, { tapId, job, nhanh: nhanh ?? '', kq });
    return {};
  } };
}

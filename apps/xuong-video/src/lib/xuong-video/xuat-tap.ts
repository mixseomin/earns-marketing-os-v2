// Xuất một tập — MỘT đường cho nút ⬇ Xuất (actions.ts › xuatTap) và script (scripts/xuat-tap.mts): cùng cổng người xem + cổng tiếng,
// cùng job, cùng chỗ ghi bản xuất. Trước 15/10/2026 lõi nằm trong server action có kiểm phiên admin → máy không tự xuất được, phải nhờ anh bấm.
// 0đ (ffmpeg trên máy chủ, không gọi model).
import { lookPhim } from './look';
import { doDiemNhinTap } from './diem-nhin-tap';
import { batCamXuc } from './qc-cam-xuc';
import { xuatMayDungTap } from './may-dung';
import 'server-only';
import { sql } from 'drizzle-orm';
import { chayXuat, ghiBanXuat, loiSoiXuat } from './xuat-chay';
import { kiemTieng } from './khop-giong';
import { chanNguoiXem } from './nguoi-xem';
import { kiemQc } from './kiem-qc';
import { docKinhThanh, locNhanh, type Canh } from './kieu';
import { soatClip } from './qc-cam-xuc';
import { chamMayShots } from './cham-may';
import { boiCanhTap, taoJob, xongJob, mapCanh, type Db, type Row } from './doc-db';
import { khopGiongTap } from './hau-ky';

/** Kiểm cổng + tạo job; trả `chay` (promise dựng + ghi) để server action đẩy chạy nền, script thì đợi. */
export async function batDauXuatTap(db: Db, tapId: number, canh: Canh[], nhanh?: string | null): Promise<{ ok: true; job: number; chay: () => Promise<{ loi?: string }> } | { ok: false; loi: string }> {
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return { ok: false, loi: 'không thấy tập' };
  if (!canh.length) return { ok: false, loi: 'tập chưa có cảnh' };
  const dang = (await db.execute(sql`SELECT 1 FROM xv_job WHERE loai = 'xuat' AND trang_thai = 'cho' AND request->>'tap_id' = ${String(tapId)} AND created_at > now() - interval '20 minutes' LIMIT 1`)) as unknown as Row[];
  if (dang.length) return { ok: false, loi: 'đang có một bản xuất của tập này chạy dở — chờ xong rồi xuất lại' };
  // Phim MÁY DỰNG (thể loại 'may_dung'): dựng bằng mẫu trên máy chủ (may-dung.ts, 0đ) + keyframe / clip từng shot cắt từ bản dựng. Các cổng bên dưới
  // (thử người xem, máy kiểm tiếng, soi clip, Murch QC) đo phim AI — Máy Dựng không có giọng / clip AI để đo.
  if (bc.loai === 'may_dung') {
    const job = await taoJob(db, { phim_id: bc.tap.phim_id, nhan: `Xuất Máy Dựng · tập ${bc.tap.so}`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { tap_id: tapId, nhanh: '' } });
    return { ok: true, job, chay: async () => {
      const kq = await xuatMayDungTap(db, tapId);
      if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); return { loi: kq.loi }; }
      await ghiBanXuat(db, { tapId, job, nhanh: '', kq });
      return {};
    } };
  }
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
  // Máy soi clip (soi-clip.ts): clip còn chữ lạ / mất sản phẩm thì không ra bản lỗi — sinh lại shot, hoặc bỏ qua nếu máy báo nhầm.
  // (cổng thật nằm trong chayXuat; báo sớm ở đây để không tạo job xuất hỏng)
  const soi = loiSoiXuat(canh, nhanh);
  if (soi.length) return { ok: false, loi: `Chưa xuất được — clip còn lỗi soi: ${soi.join('; ')}. Sinh lại shot đó, hoặc bấm "Bỏ qua lỗi soi" trên thẻ shot nếu máy báo nhầm` };
  const kt = docKinhThanh(bc.kt);
  // MURCH QC (qc-cam-xuc.ts): phim bật cam_xuc_qc thì mọi clip phải SOÁT ĐẠT (nét mặt đầu/cuối đúng kế hoạch, không biến dạng, sản phẩm giữ…).
  if (batCamXuc(bc.loai, kt)) {
    // Clip chưa có điểm (thay clip tay, clip cũ trước khi có máy chấm) → máy chấm ngay (cham-may.ts, 0đ) rồi mới xét.
    const chuaCham = locNhanh(canh, nhanh || 'A').filter((c) => !soatClip(c)).map((c) => c.id);
    if (chuaCham.length) {
      await chamMayShots(db, tapId, chuaCham).catch((e) => console.error(`chấm máy lúc xuất tập ${tapId}:`, e));
      canh = ((await db.execute(sql`SELECT c.* FROM xv_canh c WHERE c.tap_id = ${tapId} ORDER BY c.thu_tu, c.id`)) as unknown as Row[]).map(mapCanh);
    }
    const chua = locNhanh(canh, nhanh || 'A').flatMap((c) => { const k = soatClip(c); return !k ? [`#${c.thu_tu}: clip chưa soát`] : !k.dat ? [`#${c.thu_tu}: ${k.loi.join(' · ')}`] : []; });
    if (chua.length) return { ok: false, loi: `Chưa xuất được — Murch QC: ${chua.slice(0, 5).join('; ')}${chua.length > 5 ? `; +${chua.length - 5}` : ''}. Shot ◐ cần mắt: xem clip rồi bấm ✓ đạt / ✗ trượt ở dòng 🎭 trên thẻ shot; shot ✗ trượt: sinh lại` };
  }
  // Luật QC máy chặn được (kiem-qc.ts) — chỉ những luật sai là ra bản hỏng, không phải gu: màn kết thiếu tên sản phẩm.
  const qcSai = kiemQc({ loai: bc.loai, canh: locNhanh(canh, nhanh || 'A'), nhanVat: bc.nhanVat, qc: kt.qc, nhanh }).filter((x) => !x.ok && ['ten_cuoi'].includes(x.key));
  if (qcSai.length) return { ok: false, loi: `Chưa xuất được — ${qcSai.map((x) => x.chiTiet ?? x.chu).join('; ')}` };
  const job = await taoJob(db, { phim_id: bc.tap.phim_id, nhan: `Xuất bản · tập ${bc.tap.so}${nhanh ? ` · hook ${nhanh}` : ''}`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { tap_id: tapId, nhanh: nhanh ?? '' } });
  return { ok: true, job, chay: async () => {
    // ĐIỂM NHÌN QUA CÚ CẮT (diem-nhin-tap.ts, 0đ): đo mặt chủ thể hai bên mỗi cú cắt trên clip thật, lệch thì dựng lại khung (phóng + dịch) — shot đổi mới đo lại
    try { await doDiemNhinTap(db, tapId, { ghi: true }); canh = ((await db.execute(sql`SELECT c.* FROM xv_canh c WHERE c.tap_id = ${tapId} ORDER BY c.thu_tu, c.id`)) as unknown as Row[]).map(mapCanh); }
    catch (e) { console.error(`điểm nhìn lúc xuất tập ${tapId}:`, e); }
    const kq = await chayXuat({ loai: bc.loai, tiLe: kt.ti_le, nhipStopMotion: kt.nhip_stop_motion, look: lookPhim(kt), canh, nhanVat: bc.nhanVat, tap: bc.tap, qc: kt.qc, nhanh, phuDe: kt.phu_de });
    if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); return { loi: kq.loi }; }
    await ghiBanXuat(db, { tapId, job, nhanh: nhanh ?? '', kq });
    return {};
  } };
}

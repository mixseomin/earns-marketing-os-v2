// Lõi TÁCH CẢNH một tập (kịch bản → bảng shot): MỘT đường cho nút ✂ Tách cảnh (actions.ts) và script trên box. Cảnh đã có keyframe/video
// giữ nguyên (luu-canh.ts). TỐN TIỀN: 1 lượt Claude.
import 'server-only';
import { tachCanh } from './claude';
import { luuCanhTach } from './luu-canh';
import { dsKhuon, taKhuon, ghiKhuonTuCanh } from './khuon-shot';
import { boiCanhTap, ghiTienChu, type Db } from './doc-db';
import { docKinhThanh, coMau, giayMau, thieuQc } from './kieu';

type Kq<T> = { ok: true; data: T } | { ok: false; loi: string };
const loi = (m: string): { ok: false; loi: string } => ({ ok: false, loi: m });

export async function tachCanhTapDb(db: Db, tapId: number, soCanh: number, nguoi: string, thoiLuongS?: number): Promise<Kq<number>> {
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  const thieu = thieuQc(bc.loai, bc.kt);
  if (thieu) return loi(thieu);
  if (!bc.tap.kich_ban.trim()) return loi('tập chưa có kịch bản');
  // Có QC mẫu → thời lượng = tổng giây mẫu, số shot = số shot mẫu (tachCanh tự ép); không mẫu → theo ô nhập / tập.
  const kt = docKinhThanh(bc.kt);
  const mucTieu = coMau(kt.qc) ? giayMau(kt.qc.mau) : thoiLuongS && thoiLuongS > 0 ? Math.round(thoiLuongS) : bc.tap.thoi_luong_s ?? undefined;
  const kq = await tachCanh({ loai: bc.loai, kinhThanh: bc.kt, nhanVat: bc.nhanVat, kichBan: bc.tap.kich_ban, soCanh, tapTruoc: bc.tapTruoc, thoiLuongS: mucTieu, khuon: bc.loai === 'quang_cao' ? taKhuon(await dsKhuon(db, { toiDa: 60 })) : undefined });
  if (!kq.ok) return loi(kq.loi);
  const so = await luuCanhTach(db, { tapId, tenTap: bc.tap.ten, kq, nhanVat: bc.nhanVat, nguoi: nguoi, thoiLuongS: mucTieu });
  // Shot vừa tách có hình tả được → vào thư viện khuôn (gỡ tên anchor), không cần ai bấm.
  if (bc.loai === 'quang_cao') await ghiKhuonTuCanh(db, kq.canh, bc.nhanVat, kt.qc?.ten ?? '', `phim #${bc.tap.phim_id} tập ${bc.tap.so}`, bc.tap.phim_id);
  if (kq.model && kq.tokens) await ghiTienChu(db, bc.tap.phim_id, `Tách cảnh · tập ${bc.tap.so} (${so} cảnh${coMau(kt.qc) ? ', bám QC mẫu' : ''})`, kq.model, kq.tokens);
  return { ok: true, data: so };
}

// Lõi TÁCH CẢNH một tập (kịch bản → bảng shot): MỘT đường cho nút ✂ Tách cảnh (actions.ts) và script trên box. Cảnh đã có keyframe/video
// giữ nguyên (luu-canh.ts). TỐN TIỀN: 1 lượt Claude.
import 'server-only';
import { tachCanh } from './claude';
import { luuCanhTach } from './luu-canh';
import { dsKhuon, taKhuon, ghiKhuonTuCanh } from './khuon-shot';
import { boiCanhTap, ghiTienChu, type Db } from './doc-db';
import { docKinhThanh, coMau, giayMau, thieuQc } from './kieu';
import { soShotToiDa } from './nhip-hinh';
import { phanRaTapDb } from './phan-ra';

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
  // Số shot không vượt mức mỗi shot còn đủ giây đọc (nhip-hinh.ts › soShotToiDa): 20 shot / 48s phim không lời = 2,4s/shot → cắt khi
  // hành động chưa xong (Tango & Lint tập 1). Bám QC mẫu thì số shot = mẫu, không ép.
  if (soCanh > 0 && mucTieu && !coMau(kt.qc)) soCanh = Math.min(soCanh, soShotToiDa(mucTieu, { laQc: bc.loai === 'quang_cao', khong_loi: kt.khong_loi }));
  const kq = await tachCanh({ loai: bc.loai, kinhThanh: bc.kt, nhanVat: bc.nhanVat, kichBan: bc.tap.kich_ban, soCanh, tapTruoc: bc.tapTruoc, thoiLuongS: mucTieu, khuon: bc.loai === 'quang_cao' ? taKhuon(await dsKhuon(db, { toiDa: 60 })) : undefined });
  if (!kq.ok) return loi(kq.loi);
  const so = await luuCanhTach(db, { tapId, tenTap: bc.tap.ten, kq, nhanVat: bc.nhanVat, nguoi: nguoi, thoiLuongS: mucTieu });
  // Shot vừa tách có hình tả được → vào thư viện khuôn (gỡ tên anchor), không cần ai bấm.
  if (bc.loai === 'quang_cao') await ghiKhuonTuCanh(db, kq.canh, bc.nhanVat, kt.qc?.ten ?? '', `phim #${bc.tap.phim_id} tập ${bc.tap.so}`, bc.tap.phim_id);
  if (kq.model && kq.tokens) await ghiTienChu(db, bc.tap.phim_id, `Tách cảnh · tập ${bc.tap.so} (${so} cảnh${coMau(kt.qc) ? ', bám QC mẫu' : ''})`, kq.model, kq.tokens);
  // PHÂN RÃ KỊCH BẢN ngay sau tách (anh 31/10/2026: "làm sao để nó tự sinh ra và báo nếu thiếu"): gắn thẻ mọi phục trang / tóc / phụ kiện / vết / đạo cụ
  // của tập mới, tạo món thiếu, gắn đúng shot (~200₫). Hỏng không làm hỏng tách cảnh — báo cáo chuẩn bị sẽ hiện tập này "chưa phân rã".
  const pr = await phanRaTapDb(db, tapId, { nguoi }).catch((e: unknown) => ({ ok: false as const, loi: e instanceof Error ? e.message : String(e) }));
  if (!pr.ok) console.error(`[phân rã sau tách cảnh] tập ${bc.tap.so}:`, pr.loi);
  return { ok: true, data: so };
}

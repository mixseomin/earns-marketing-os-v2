// TÁCH NHỊP CHI TIẾT (anh 23/10/2026: "rà cả phim xem cần tách cảnh thế nào để các chi tiết không bị lỗi như vậy — chuẩn hoá vào rule chấm điểm của phim
// thành luật để scale nhiều phim"). Chuẩn ngành (coverage / cắt theo động tác): MỘT shot MỘT nhịp vật lý; thao tác đạo cụ tinh (tháo đồ đeo, trao / giật
// đồ) quay bằng CẬN CHÈN, không gói chung với đi lại trong khung rộng — #132 #15: Vivian đi 1 m + giật thẻ đeo cổ trong một toàn cảnh → model video kéo dây
// xuyên đầu Hạ (dù prompt đã tả cơ chế). Đọc từ máy 3D của shot (thao-do.ts › doiTayDo), không dò chữ. Thuần — tự kiểm: tach-nhip.test.mts
import { doiTayDo, CACH_THAO, type ViTriDo } from './thao-do';

/** Cỡ cảnh đủ gần để thấy tay + đạo cụ (dien-anh.ts › co_canh). */
export const CO_CAN_CHI_TIET = new Set(['insert', 'ecu', 'cu']);
/** Quãng đi (cm) coi là "đi lại trong shot". */
export const DI_LAI_CM = 40;
export type ShotNhip = { co_canh?: string; vi_tri: ViTriDo[]; /** máy chuyển chủ thể trong shot (may_3d.chuyen_toi) */ chuyen_toi?: string };
/** Lý do shot PHẢI tách (rỗng = một nhịp, qua). Mỗi lý do nói tách thành gì. */
export function canTachNhip(s: ShotNhip, laNguoi: (ten: string) => boolean): string[] {
  const out: string[] = [];
  const can = CO_CAN_CHI_TIET.has(s.co_canh ?? '');
  const di = s.vi_tri.filter((p) => !p.an && laNguoi(p.ten) && p.den?.length && Math.hypot(p.den[0]! - p.tam[0]!, p.den[1]! - p.tam[1]!) >= DI_LAI_CM);
  // CẬN CHÈN GIỮ MỘT CHI TIẾT (#132 #13: tay áo lộ chuỗi hạt rồi máy rời cổ tay sang Hạ xem điện thoại — hai chủ thể trong một insert)
  if ((s.co_canh === 'insert' || s.co_canh === 'ecu') && s.chuyen_toi) out.push(`cận chèn mà máy chuyển sang ${s.chuyen_toi} — cận chèn chỉ giữ một chi tiết: tách đoạn ${s.chuyen_toi} thành shot riêng`);
  // ĐỒ RỜI TAY (thả / đặt / ném xuống, không sang người khác) khi chính người cầm đi lại, ở khung không cận (#132 #27: Thần buông bút, bước tới, chống tay)
  if (!can) for (const m of s.vi_tri.filter((x) => x.cam && x.den?.length && !x.an && !laNguoi(x.ten) && !x.deo)) {
    const giu = di.find((p) => p.ten === m.cam);
    const sangNguoi = s.vi_tri.some((p) => laNguoi(p.ten) && p.ten !== m.cam && Math.hypot((p.den ?? p.tam)[0]! - m.den![0]!, (p.den ?? p.tam)[1]! - m.den![1]!) < 60);
    if (giu && !sangNguoi) out.push(`${m.cam} vừa buông / đặt ${m.ten} vừa đi lại trong cùng shot — tách: cận chèn đồ rời tay + shot đi lại`);
  }
  const doi = doiTayDo(s.vi_tri, laNguoi); if (!doi.length) return out;
  if (doi.length >= 2) out.push(`${doi.length} lần đồ đổi tay trong một shot (${doi.map((x) => x.mon).join(', ')}) — mỗi lần một shot`);
  for (const x of doi.filter((y) => y.deo && !can)) out.push(`tháo đồ đeo (${x.mon} của ${x.tu}${x.thao ? `, ${CACH_THAO[x.thao]?.vi}` : ''}) ở cỡ ${s.co_canh || 'chưa khai'} — tách thêm CẬN CHÈN cho cú tháo (model video không giữ được cơ chế ở khung rộng)`);
  if (di.length && !can) out.push(`${di.map((p) => p.ten).join(', ')} đi lại rồi ${doi.map((x) => `${x.den} lấy ${x.mon}`).join(', ')} trong cùng shot — cắt theo động tác: shot đi tới (dừng lúc chạm đồ) + shot cận trao / giật`);
  return out;
}

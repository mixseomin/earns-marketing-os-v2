// TÁCH NHỊP CHI TIẾT (anh 23/10/2026: "rà cả phim xem cần tách cảnh thế nào để các chi tiết không bị lỗi như vậy — chuẩn hoá vào rule chấm điểm của phim
// thành luật để scale nhiều phim"). Chuẩn ngành (coverage / cắt theo động tác): MỘT shot MỘT nhịp vật lý; thao tác đạo cụ tinh (tháo đồ đeo, trao / giật
// đồ) quay bằng CẬN CHÈN, không gói chung với đi lại trong khung rộng — #132 #15: Vivian đi 1 m + giật thẻ đeo cổ trong một toàn cảnh → model video kéo dây
// xuyên đầu Hạ (dù prompt đã tả cơ chế). Đọc từ máy 3D của shot (thao-do.ts › doiTayDo), không dò chữ. Thuần — tự kiểm: tach-nhip.test.mts
import { doiTayDo, CACH_THAO, type ViTriDo } from './thao-do';

/** Cỡ cảnh đủ gần để thấy tay + đạo cụ (dien-anh.ts › co_canh). */
export const CO_CAN_CHI_TIET = new Set(['insert', 'ecu', 'cu']);
/** Quãng đi (cm) coi là "đi lại trong shot". */
export const DI_LAI_CM = 40;
export type ShotNhip = { co_canh?: string; vi_tri: ViTriDo[] };
/** Lý do shot PHẢI tách (rỗng = một nhịp, qua). Mỗi lý do nói tách thành gì. */
export function canTachNhip(s: ShotNhip, laNguoi: (ten: string) => boolean): string[] {
  const doi = doiTayDo(s.vi_tri, laNguoi); if (!doi.length) return [];
  const out: string[] = [];
  const can = CO_CAN_CHI_TIET.has(s.co_canh ?? '');
  const di = s.vi_tri.filter((p) => !p.an && laNguoi(p.ten) && p.den?.length && Math.hypot(p.den[0]! - p.tam[0]!, p.den[1]! - p.tam[1]!) >= DI_LAI_CM);
  if (doi.length >= 2) out.push(`${doi.length} lần đồ đổi tay trong một shot (${doi.map((x) => x.mon).join(', ')}) — mỗi lần một shot`);
  for (const x of doi.filter((y) => y.deo && !can)) out.push(`tháo đồ đeo (${x.mon} của ${x.tu}${x.thao ? `, ${CACH_THAO[x.thao]?.vi}` : ''}) ở cỡ ${s.co_canh || 'chưa khai'} — tách thêm CẬN CHÈN cho cú tháo (model video không giữ được cơ chế ở khung rộng)`);
  if (di.length && !can) out.push(`${di.map((p) => p.ten).join(', ')} đi lại rồi ${doi.map((x) => `${x.den} lấy ${x.mon}`).join(', ')} trong cùng shot — cắt theo động tác: shot đi tới (dừng lúc chạm đồ) + shot cận trao / giật`);
  return out;
}

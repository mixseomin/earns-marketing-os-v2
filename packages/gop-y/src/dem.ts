// ĐẾM CHO NÚT 💬 (chuẩn packages/gop-y/CHUAN.md) — phần thuần, dùng ở cả máy chủ (server.ts) lẫn trình duyệt (client.tsx):
//  · working     = số việc AI đang làm (card claimed còn trong trần phiên kỹ sư + kỹ sư CLI phụ trách hòm đang chạy một lượt) → nút rung
//  · can_y_kien  = số card CỦA CHÍNH người xem đang chờ họ: tin cuối là kỹ sư hỏi (mở bằng ❓) mà chưa ai đáp; kẹt một mình không tính → số đỏ trên nút
// Tự kiểm: node_modules/.bin/tsx packages/gop-y/src/dem.test.mts

/** Trần phiên kỹ sư hòm (may/gop-y-ky-su tranPhut 40) + 5 phút: card claimed / lượt "▶ bắt đầu" quá trần coi là phiên đã chết — không rung mãi. */
export const TRAN_DANG_LAM_MS = 45 * 60_000;
/** Lượt quét hòm rỗng chạy ~6 giây rồi xong: chưa đủ 15 giây thì chưa tính "đang làm" (nút khỏi giật vì lượt nhìn qua rồi về). */
export const TOI_THIEU_LUOT_MS = 15_000;
/** Hòm → kỹ sư CLI phụ trách (nhật ký nhịp /var/lib/cty/nhip/<người>.json). */
export const KY_SU_HOM: Record<string, string> = { cty: 'khoi', mos2: 'dat', 'xuong-video': 'vinh', spy: 'hieu' };

export type DemGopY = {
  /** số việc AI đang làm ở hòm này */
  working: number;
  /** tiêu đề các việc đang làm (tooltip "AI đang làm: …") */
  dangLam: string[];
  /** số card của chính người xem đang chờ họ trả lời / bị kẹt */
  can_y_kien: number;
  /** id các card đó (đánh dấu trong tab Của tôi) */
  choYKien: number[];
  /** kỹ sư AI phụ trách hòm (tên từ SOUL.md, tat = đang tắt trên bảng nhân sự) — dải đầu hòm "Khôi đang rảnh" (góp ý #1673) */
  kySu?: { ten: string; tat: boolean } | null;
  /** card còn claimed mà QUÁ trần phiên — không phiên nào đang chạy nó nhưng tab vẫn ghi "Đang làm". Có thì dải đầu hòm KHÔNG được nói "rảnh"
   *  (#1746 23/11/2026: dải ghi "Đạt đang rảnh" trong khi tab Đang làm 1 · card claimed 2 giờ vì máy nộp bị cổng chặn). */
  treo?: string[];
};
export const DEM_RONG: DemGopY = { working: 0, dangLam: [], can_y_kien: 0, choYKien: [] };
/** Chữ dải đầu hòm: "<tên> đang tắt" / "<tên> đang làm:" / "<tên> đang rảnh"; chưa biết tên → "AI". */
export function chuDaiKySu(dem: DemGopY): { nhan: string; tat: boolean } {
  const ten = dem.kySu?.ten || 'AI';
  if (!dem.working && dem.treo?.length) return { nhan: `⚠ ${dem.treo.length} việc ghi Đang làm nhưng không phiên nào chạy:`, tat: false };
  if (dem.kySu?.tat && !dem.working) return { nhan: `⏸ ${ten} đang tắt`, tat: true };
  return { nhan: dem.working ? `${ten} đang làm:` : `🤖 ${ten} đang rảnh`, tat: false };
}

const MO = new Set(['pending', 'claimed', 'submitted', 'broken']);
/** Cờ hỏi rõ ràng: kỹ sư mở tin bằng "❓" khi hỏi người báo. */
export const CO_HOI = '❓';
/** Tin máy tự ghi ("[Khôi · …]", "[máy] …") — không bao giờ là câu hỏi cho người. */
const laTinMay = (noiDung: string) => /^\s*\[/.test(noiDung);
/** Card của tôi có đang chờ tôi không: CHỈ khi còn mở (kể cả kẹt) và tin cuối là kỹ sư HỎI tôi (mở bằng ❓, không phải tin máy, không phải của tôi).
 *  Kẹt một mình (vd deploy đỏ vì người khác) KHÔNG tính — anh 17/11/2026, góp ý #giao-20261117-0001-cho-ban. */
export function choToi(trangThai: string, tinCuoi: { nguoi: string; noiDung?: string; xuLy: string | null } | null, laToi: (nguoi: string) => boolean): boolean {
  if (!MO.has(trangThai) || !tinCuoi || tinCuoi.xuLy || laToi(tinCuoi.nguoi)) return false;
  const nd = String(tinCuoi.noiDung ?? '');
  return !laTinMay(nd) && nd.trimStart().startsWith(CO_HOI);
}

/** Dòng nhật ký nhịp cuối của kỹ sư (<người>.json) → tên việc đang chạy, hoặc null. */
export function luotDangChay(dong: { luc?: string; ket?: string } | null | undefined, bay = Date.now()): string | null {
  const ket = String(dong?.ket ?? ''), t = Date.parse(String(dong?.luc ?? ''));
  if (!/^▶/.test(ket) || !Number.isFinite(t)) return null;
  const tuoi = bay - t;
  if (tuoi < TOI_THIEU_LUOT_MS || tuoi > TRAN_DANG_LAM_MS) return null;
  return ket.replace(/^▶\s*bắt đầu:\s*/, '').trim() || 'kỹ sư AI đang chạy lượt';
}

/** Nhật ký nhịp đầy đủ <người>.jsonl → việc đang làm, hoặc null. Lượt = dòng "▶ bắt đầu" mới nhất chưa có "■" sau nó (luật luotDangChay);
 *  nếu sau ▶ có dòng "◆ nhận card #N: …" / "◆ nhận việc giao: …" (kỹ sư tự đẩy) thì lấy dòng ◆ mới nhất — đúng việc, không chỉ tên job. */
export function viecTuNhatKy(dong: Array<{ luc?: string; ket?: string }>, bay = Date.now()): string | null {
  let i = dong.length - 1;
  while (i >= 0 && !/^[▶■]/.test(String(dong[i]?.ket ?? ''))) i--;
  if (i < 0) return null;
  const luot = luotDangChay(dong[i], bay);
  if (!luot) return null;
  for (let j = dong.length - 1; j > i; j--) {
    const k = String(dong[j]?.ket ?? '');
    if (/^◆/.test(k)) return k.replace(/^◆\s*nhận\s*/, '').replace(/\s+·\s+\S+\s+(low|medium|high|xhigh|max)$/, '').trim() || luot;
  }
  return luot;
}

/** Card claimed còn trong trần phiên (updated_at đổi lúc claim / reply). */
export const conTrongTran = (capNhat: string, bay = Date.now()) => bay - Date.parse(capNhat) < TRAN_DANG_LAM_MS;
/** Nhãn card claimed quá trần: "#id tiêu đề (2 giờ)". */
export function nhanTreo(id: number, tieuDe: string, capNhat: string, bay = Date.now()): string {
  const phut = Math.max(0, Math.round((bay - Date.parse(capNhat)) / 60_000));
  return `#${id} ${tieuDe.split('\n')[0]!.slice(0, 60)} (${phut < 120 ? `${phut} phút` : `${Math.round(phut / 60)} giờ`})`;
}

/** Phương án dự phòng ở trình duyệt khi app chưa nối `demGopY` vào máy chủ: đếm từ chính danh sách "Của tôi". */
export function demTuDs(ds: Array<{ id: number; noiDung: string; trangThai: string; capNhat: string; choYKien?: boolean }>, bay = Date.now()): DemGopY {
  const lam = ds.filter((b) => b.trangThai === 'claimed' && conTrongTran(b.capNhat, bay));
  const treo = ds.filter((b) => b.trangThai === 'claimed' && !conTrongTran(b.capNhat, bay)).map((b) => nhanTreo(b.id, b.noiDung, b.capNhat, bay));
  const cho = ds.filter((b) => !!b.choYKien);
  return { working: lam.length, dangLam: lam.map((b) => `#${b.id} ${b.noiDung.split('\n')[0]!.slice(0, 60)}`), can_y_kien: cho.length, choYKien: cho.map((b) => b.id), treo };
}

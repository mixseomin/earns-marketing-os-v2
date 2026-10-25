// SỔ LIÊN TỤC ĐỒ VẬT (anh 24/10/2026, phim #353: "cảnh trước cầm dây thẻ, cảnh sau lại cầm cái thẻ · Hạ đang ôm hộp mà lúc sau không thấy hộp, sau đó
// vào thang lại thấy hộp… các đồ vật rõ ràng phải có mô tả thế nào chứ"). Gốc: không chỗ nào ghi trạng thái đồ theo mảnh — model tự quyết ai cầm, cầm
// kiểu gì, đồ ở đâu, mỗi khung một kiểu. Nghề: sổ liên tục của script supervisor — mỗi món một dòng thời gian (ai giữ · giữ thế nào), mọi lần ĐỔI phải
// có SỰ KIỆN hiện trên hình ở đúng mảnh đó. Sổ sinh câu trạng thái cho prompt mỗi mảnh + dòng đọc cho storyboard. Thuần — tự kiểm: so-vat.test.mts
export type MocVat = { /** từ mảnh (thu_tu) */ tu: number; /** ai đang giữ / đồ ở trên người ai; null = không ai (trên sàn, trên bàn…) */ ai: string | null;
  /** giữ / nằm thế nào — tiếng Anh cho prompt */ cach: string; /** cùng ý, tiếng Việt cho người đọc storyboard */ vi: string;
  /** SỰ KIỆN làm đổi trạng thái — bắt buộc với mọi mốc sau mốc đầu, phải diễn ra trên hình ở mảnh `tu` */ su_kien?: string };
export type SoVat = Record<string, MocVat[]>;

/** Thời điểm trong mảnh: ĐẦU (khung mở) hay CUỐI (khung kết). Sự kiện của mốc `tu` diễn ra TRONG mảnh đó: khung đầu còn trạng thái cũ, khung cuối đã mới. */
export type LucKhung = 'dau' | 'ket';
/** Trạng thái mỗi món ở mảnh thu_tu (mốc gần nhất có tu ≤ thu_tu; khung ĐẦU bỏ mốc có sự kiện ngay tại mảnh này — sự kiện chưa xảy ra). */
export function trangThai(so: SoVat, thuTu: number, luc: LucKhung = 'ket'): Record<string, MocVat> {
  const r: Record<string, MocVat> = {};
  for (const [ten, ds] of Object.entries(so)) { const m = [...ds].sort((a, b) => a.tu - b.tu).filter((x) => x.tu < thuTu || (x.tu === thuTu && (luc === 'ket' || !x.su_kien))).at(-1); if (m) r[ten] = m; }
  return r;
}
/** Món nào phải VẼ trong khung: người giữ nó đang trong khung, hoặc mảnh khai món đó (cận chèn). */
export function vatTrongKhung(so: SoVat, thuTu: number, nguoiTrongKhung: string[], khaiTrongKhung: string[] = [], luc: LucKhung = 'ket'): [string, MocVat][] {
  return Object.entries(trangThai(so, thuTu, luc)).filter(([ten, m]) => (m.ai ? nguoiTrongKhung.includes(m.ai) : false) || khaiTrongKhung.includes(ten));   // khai = món mảnh nhắc tên (cận chèn tay cầm thẻ: người giữ ngoài khung mà thẻ vẫn trong khung)
}
/** Câu trạng thái đồ cho prompt (tiếng Anh). tenEn = tên đưa model của món. */
/** Món người `ai` TỪNG giữ / đeo (tính tới đúng thời điểm khung) mà giờ đã sang tay khác — MỘT nguồn cho câu vắng mặt (cauVat) và câu hỏi kiểm khung
 *  (khong-gian.ts › doDaMat → cau-hoi-khung.ts). */
export function daMat(so: SoVat, thuTu: number, ai: string, luc: LucKhung = 'ket'): string[] {
  const nay = trangThai(so, thuTu, luc);
  return Object.entries(so).filter(([t, ms]) => nay[t]?.ai !== ai && ms.some((m) => m.ai === ai && (m.tu < thuTu || (m.tu === thuTu && (luc === 'ket' || !m.su_kien))))).map(([t]) => t);
}
/** nhan: đầu câu theo LOẠI sổ — đồ vật (mặc định) hay DÁNG người (SO_DANG: cùng cơ chế mốc + sự kiện, xem dung-phim-reelshort › so_dang). */
export const NHAN_DO_VAT = "OBJECT STATE in this frame (must match exactly, wherever that person's arms and hands are in frame)";
export const NHAN_DANG = 'BODY POSE in this frame (must match exactly — it continues unbroken from the previous shot; head tilt and arm positions as stated)';
export function cauVat(so: SoVat, thuTu: number, nguoiTrongKhung: string[], tenEn: (t: string) => string = (t) => t, khaiTrongKhung: string[] = [], luc: LucKhung = 'ket', nhan = NHAN_DO_VAT): string {
  const ds = vatTrongKhung(so, thuTu, nguoiTrongKhung, khaiTrongKhung, luc);
  // VẮNG MẶT: món người trong khung TỪNG giữ / đeo mà giờ đã sang tay khác — nói thẳng là không còn trên người họ (phim #353 #13: thẻ bị giật ở #7
  // mà Hạ vẫn đeo lại dây thẻ vì ảnh mẫu nhân vật có thẻ; sổ chỉ nói "Vivian giữ" thì model không biết Hạ phải trống cổ)
  const vang = nhan === NHAN_DO_VAT ? nguoiTrongKhung.flatMap((a) => daMat(so, thuTu, a, luc).map((t) => `${a} no longer has ${tenEn(t)} — it is NOT on ${a} anywhere`)) : [];
  const ve = [...ds.map(([t, m]) => `${tenEn(t)} — ${m.cach}`), ...vang];
  return ve.length ? `${nhan}: ${ve.join('; ')}.` : '';
}
/** Dòng đọc cho storyboard (tiếng Việt): mọi món có trạng thái ở mảnh này, đánh dấu ⚡ nếu đổi ngay tại mảnh này. */
export function dongVat(so: SoVat, thuTu: number, luc: LucKhung = 'ket'): string[] {
  return Object.entries(trangThai(so, thuTu, luc)).map(([t, m]) => `${m.tu === thuTu && m.su_kien ? `⚡ ${m.su_kien} → ` : ''}${t}: ${m.vi}`);
}
/** Lỗi sổ: mốc sau mốc đầu thiếu sự kiện · hai mốc cùng mảnh · sự kiện rơi vào mảnh không có người liên quan trong khung. */
/** TAY CẦM theo câu prompt của mốc ("in Vivian's right hand") — tay của CHÍNH người đó, không phải phía màn hình. */
export function benTay(cach: string): 'phai' | 'trai' | null {
  const p = /\bright\s+(hand|fist)\b/i.test(cach), t = /\bleft\s+(hand|fist)\b/i.test(cach);
  return p === t ? null : p ? 'phai' : 'trai';
}
const TAY_VI = /tay\s*(phải|trái)/i;
/** ĐỔI CHỖ ĐỨNG mà sổ không ghi (anh 25/10/2026 phim #353: "Hạ bước vào thang máy mà vẫn đứng ngoài"): hành động của shot có người đi vào / ra một
 *  nơi (thang máy, phòng, xe, cửa) nhưng sổ dáng / đồ vật không có mốc nào của người đó ở shot đó → prompt + cổng không biết người đã ở trong hay ngoài. */
const DI_CHUYEN = /\b(steps?|walks?|moves?|gets?|goes|go|comes?)\s+(in|into|inside|out|out of|through)\b|\b(enters?|exits?|boards?)\b|bước (vào|ra|qua)|đi (vào|ra)|vào trong|ra khỏi/i;
export function diChuyenKhongGhi(shots: { thu_tu: number; chu: string; nguoi: string[] }[], so: SoVat): string[] {
  return shots.flatMap((c) => {
    if (!DI_CHUYEN.test(c.chu)) return [];
    const ghi = Object.values(so).some((ds) => ds.some((m) => m.tu === c.thu_tu && m.ai != null && c.nguoi.includes(m.ai)));
    return ghi ? [] : [`#${c.thu_tu}: hành động có người đi vào / ra ("${(DI_CHUYEN.exec(c.chu)?.[0] ?? '').trim()}") mà sổ dáng / đồ vật không có mốc chỗ đứng mới ở shot này — thêm mốc (vd "đứng TRONG cabin thang, quay ra cửa") kèm sự kiện`];
  });
}
export function loiSoVat(so: SoVat, nguoiCua: (thuTu: number) => string[] | null): string[] {
  const out: string[] = [];
  for (const [ten, ds0] of Object.entries(so)) {
    const ds = [...ds0].sort((a, b) => a.tu - b.tu);
    ds.forEach((m, i) => {
      if (i > 0 && !m.su_kien?.trim()) out.push(`${ten}: đổi trạng thái ở #${m.tu} (${ds[i - 1]!.vi} → ${m.vi}) mà không khai sự kiện — khán giả không thấy vì sao đổi`);
      if (i > 0 && m.tu === ds[i - 1]!.tu) out.push(`${ten}: hai mốc cùng ở #${m.tu}`);
      // câu kiểm khung đọc dòng TIẾNG VIỆT — mốc nói tay nào thì dòng tiếng Việt phải nói đúng tay đó (phim #353: "right hand" mà vi bỏ tay → không ai hỏi, Vivian đổi tay)
      const bt = benTay(m.cach); if (bt && !(TAY_VI.exec(m.vi)?.[1] ?? '').toLowerCase().startsWith(bt === 'phai' ? 'ph' : 'tr')) out.push(`${ten}: mốc #${m.tu} nói ${bt === 'phai' ? 'TAY PHẢI' : 'TAY TRÁI'} (câu prompt) mà dòng tiếng Việt không ghi đúng tay — sửa "vi" cho khớp`);
      if (i > 0 && m.su_kien) { const ng = nguoiCua(m.tu); const lien = [ds[i - 1]!.ai, m.ai].filter((x): x is string => !!x);
        if (ng && lien.length && !lien.some((x) => ng.includes(x))) out.push(`${ten}: sự kiện "${m.su_kien}" ở #${m.tu} nhưng khung đó không có ${lien.join(' / ')} — sự kiện phải diễn ra trên hình`); }
    });
  }
  return out;
}

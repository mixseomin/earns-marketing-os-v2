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
/** nhan: đầu câu theo LOẠI sổ — đồ vật (mặc định) hay DÁNG người (SO_DANG: cùng cơ chế mốc + sự kiện, xem dung-phim-reelshort › so_dang). */
export const NHAN_VAT = "OBJECT STATE in this frame (must match exactly, wherever that person's arms and hands are in frame)";
export const NHAN_DANG = 'BODY POSE in this frame (must match exactly — it continues unbroken from the previous shot; head tilt and arm positions as stated)';
export function cauVat(so: SoVat, thuTu: number, nguoiTrongKhung: string[], tenEn: (t: string) => string = (t) => t, khaiTrongKhung: string[] = [], luc: LucKhung = 'ket', nhan = NHAN_VAT): string {
  const ds = vatTrongKhung(so, thuTu, nguoiTrongKhung, khaiTrongKhung, luc);
  return ds.length ? `${nhan}: ${ds.map(([t, m]) => `${tenEn(t)} — ${m.cach}`).join('; ')}.` : '';
}
/** Dòng đọc cho storyboard (tiếng Việt): mọi món có trạng thái ở mảnh này, đánh dấu ⚡ nếu đổi ngay tại mảnh này. */
export function dongVat(so: SoVat, thuTu: number, luc: LucKhung = 'ket'): string[] {
  return Object.entries(trangThai(so, thuTu, luc)).map(([t, m]) => `${m.tu === thuTu && m.su_kien ? `⚡ ${m.su_kien} → ` : ''}${t}: ${m.vi}`);
}
/** Lỗi sổ: mốc sau mốc đầu thiếu sự kiện · hai mốc cùng mảnh · sự kiện rơi vào mảnh không có người liên quan trong khung. */
export function loiSoVat(so: SoVat, nguoiCua: (thuTu: number) => string[] | null): string[] {
  const out: string[] = [];
  for (const [ten, ds0] of Object.entries(so)) {
    const ds = [...ds0].sort((a, b) => a.tu - b.tu);
    ds.forEach((m, i) => {
      if (i > 0 && !m.su_kien?.trim()) out.push(`${ten}: đổi trạng thái ở #${m.tu} (${ds[i - 1]!.vi} → ${m.vi}) mà không khai sự kiện — khán giả không thấy vì sao đổi`);
      if (i > 0 && m.tu === ds[i - 1]!.tu) out.push(`${ten}: hai mốc cùng ở #${m.tu}`);
      if (i > 0 && m.su_kien) { const ng = nguoiCua(m.tu); const lien = [ds[i - 1]!.ai, m.ai].filter((x): x is string => !!x);
        if (ng && lien.length && !lien.some((x) => ng.includes(x))) out.push(`${ten}: sự kiện "${m.su_kien}" ở #${m.tu} nhưng khung đó không có ${lien.join(' / ')} — sự kiện phải diễn ra trên hình`); }
    });
  }
  return out;
}

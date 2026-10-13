// BẢN PHỤ ĐỀ VIỆT để người review chỉ biết tiếng Việt xem hộ (13/10/2026 — "ai cũng được, nhưng họ chỉ biết tiếng Việt"): hình, nhịp, tiếng
// giữ nguyên; chữ màn dịch sang Việt, mọi câu nói có phụ đề Việt ở đáy khung (xuat.ts › tepAss phuDe). Người review chấm câu chuyện có rõ
// không — thứ không phụ thuộc ngôn ngữ; độ tự nhiên của câu tiếng Anh vẫn do bước kiểm người xem (Claude) lo.
// Thuần: chuỗi cần dịch + áp bản dịch. Phần máy chủ (dịch, xuất, ghi) ở review-vi.ts. Tự kiểm: phu-de.test.mts
import type { Canh } from './kieu';

/** Một dòng chữ màn = mốc "@1.2 " (tuỳ) + chữ; chỉ dịch phần chữ, giữ nguyên mốc. */
const MOC = /^(\s*@\d+(?:[.,]\d+)?s?\s+)?(.*)$/;
const tachDong = (chu: string) => chu.split('\n').map((d) => { const m = MOC.exec(d)!; return { moc: m[1] ?? '', chu: m[2] ?? '' }; });

type ShotPd = Pick<Canh, 'chu_man' | 'thoai'>;
export function chuoiCanDich(canh: ShotPd[]): string[] {
  const s = new Set<string>();
  for (const c of canh) {
    for (const d of tachDong(c.chu_man ?? '')) if (d.chu.trim()) s.add(d.chu.trim());
    for (const d of c.thoai ?? []) if (d.url && d.loi.trim()) s.add(d.loi.trim());
  }
  return [...s];
}
/** Áp bản dịch: shot mới có chữ màn tiếng Việt (giữ mốc giây) + bảng phụ đề url file giọng → câu Việt. Câu chưa dịch được giữ nguyên. */
export function apDich<T extends ShotPd>(canh: T[], dich: Map<string, string>): { canh: T[]; phuDe: Record<string, string> } {
  const phuDe: Record<string, string> = {};
  const moi = canh.map((c) => {
    for (const d of c.thoai ?? []) if (d.url && d.loi.trim()) phuDe[d.url] = dich.get(d.loi.trim()) ?? d.loi.trim();
    const chu = tachDong(c.chu_man ?? '').map((d) => (d.chu.trim() ? `${d.moc}${dich.get(d.chu.trim()) ?? d.chu}` : `${d.moc}${d.chu}`)).join('\n');
    return { ...c, chu_man: (c.chu_man ?? '') ? chu : '' };
  });
  return { canh: moi, phuDe };
}

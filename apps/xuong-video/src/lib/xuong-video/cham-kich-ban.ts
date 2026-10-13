// MÁY CHẤM KỊCH BẢN (13/10/2026 — anh: "kịch bản mới quan trọng"). Chấm một tập theo khung phim ngắn 45–60s trước khi tiêu tiền hình:
//   logline (ai · muốn gì · cái gì cản) · hook ≤ 3s · đủ 5 nhịp (hook → vấn đề → leo thang → lật ngược → kết/móc) · lật ngược rơi vào
//   55–92% thời lượng · tập series chưa phải tập cuối thì kết bằng MÓC sang tập sau · series có câu ĐỘNG CƠ.
// `cung` = mục chặn sinh keyframe (quy-trinh.ts › chanTienKy, khi phim có kinh thánh series); còn lại là gợi ý trên thanh 🎬 Quy trình.
// Thuần — tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/cham-kich-ban.test.mts
import type { Canh, PhanCanh, Series } from './kieu';
import type { Beat } from './dien-anh';
import { giayPhat } from './kieu';

export type NhipKb = 'hook' | 'van_de' | 'leo_thang' | 'lat_nguoc' | 'ket';
/** Tên beat (Anh/Việt, tự do) → nhịp chuẩn. Thứ tự dò quan trọng: "climax twist" là lật ngược, "cliffhanger" là kết/móc. */
const NHIP: [NhipKb, RegExp][] = [
  ['ket', /resolution|payoff|ending|\bend\b|kết|giải quyết|cta|cliff|móc|teaser|tease|\btag\b|next|chốt/i],
  ['lat_nguoc', /twist|turn|reversal|reveal|lật|bất ngờ|vỡ lẽ/i],
  ['hook', /hook|cold open|mở màn|mở đầu/i],
  ['van_de', /inciting|problem|setup|vấn đề|biến cố|khởi|conflict|xung đột/i],
  ['leo_thang', /escalat|rising|complication|stakes|climax|leo thang|cao trào|tệ hơn|thử|dồn/i],
];
export const nhipCua = (ten: string): NhipKb | null => NHIP.find(([, r]) => r.test(ten))?.[0] ?? null;
export const TEN_NHIP: Record<NhipKb, string> = { hook: 'Hook', van_de: 'Vấn đề', leo_thang: 'Leo thang', lat_nguoc: 'Lật ngược', ket: 'Kết / móc' };

export type MucKb = { key: string; ten: string; dat: boolean; ghi: string; cung: boolean };
export type VaoKb = {
  tap: { so?: number; beats: Pick<Beat, 'ten'>[]; phan_canh: Pick<PhanCanh, 'ten' | 'beat'>[] };
  canh: (Pick<Canh, 'phat_s' | 'thoi_luong_s' | 'phan_doan' | 'chu_man' | 'thoai' | 'loi_thoai'> & Partial<Pick<Canh, 'hanh_dong'>>)[];
  kt: { logline?: string; series?: Series | null; khong_loi?: boolean };
};
/** Logline của tập: series → logline tập trong kinh thánh series; phim lẻ → logline phim. */
export const loglineTap = (kt: VaoKb['kt'], so?: number): string => ((kt.series?.dong_co ? kt.series.tap.find((t) => t.so === so)?.logline : '') || kt.logline || '').trim();

export function chamKichBan(o: VaoKb): { muc: MucKb[]; diem: number; chan: string[] } {
  const { tap, canh, kt } = o;
  const series = !!kt.series?.dong_co?.trim();
  const m: MucKb[] = [];
  const ll = loglineTap(kt, tap.so);
  m.push({ key: 'logline', ten: 'Logline', dat: ll.length >= 25, ghi: ll.length >= 25 ? ll : series ? `tập ${tap.so ?? '?'} chưa có logline trong kinh thánh series (một câu: ai · muốn gì · cái gì cản)` : 'chưa có logline (một câu: ai · muốn gì · cái gì cản) — mục 1 Kinh thánh', cung: true });
  // nhịp: từ beats của tập, cộng beat gắn ở phân cảnh
  const co = new Set<NhipKb>([...tap.beats.map((b) => nhipCua(b.ten)), ...tap.phan_canh.map((p) => nhipCua(p.beat))].filter((x): x is NhipKb => !!x));
  const thieu = (Object.keys(TEN_NHIP) as NhipKb[]).filter((k) => !co.has(k));
  m.push({ key: 'nhip', ten: 'Đủ 5 nhịp', dat: !thieu.length, ghi: thieu.length ? `thiếu nhịp: ${thieu.map((k) => TEN_NHIP[k]).join(', ')} (hook → vấn đề → leo thang → lật ngược → kết/móc)` : 'hook → vấn đề → leo thang → lật ngược → kết/móc', cung: true });
  if (canh.length) {
    const s1 = canh[0]!; const g1 = giayPhat(s1);
    // Phim KHÔNG LỜI (Tango & Lint): móc bằng HÌNH — shot đầu có hành động là đủ, không đòi chữ/lời.
    const coChu = kt.khong_loi ? !!(s1.hanh_dong ?? '').trim() : !!(s1.chu_man.trim() || s1.loi_thoai.trim() || s1.thoai.some((d) => d.loi.trim()));
    // Hook = câu/chữ MÓC phải tới người xem trong 3 giây đầu — không phải shot đầu phải ngắn hơn 3s. Chữ màn hiện từ giây 0; câu nói thì
    // tính lúc câu đầu ĐỌC XONG (độ dài file đã đo, DongThoai.dai). Trước đây đo độ dài shot → khớp giọng chừa 0,5s thở làm shot 1 thành
    // 3,2s là chặn sinh keyframe cả tập (Fox Tales 13/10/2026), dù câu móc đã đọc xong ở 2,66s.
    const d1 = s1.thoai.find((d) => d.loi.trim());
    const moc = kt.khong_loi || s1.chu_man.trim() ? 0 : d1 && typeof d1.dai === 'number' ? (d1.tre ?? 0) + d1.dai : g1;
    m.push({ key: 'hook', ten: 'Hook ≤ 3 giây', dat: moc <= 3 && coChu, ghi: !coChu ? 'shot đầu chưa có chữ màn hay lời — 3 giây đầu cần một câu hỏi/hình lạ khiến người ta xem tiếp' : moc > 3 ? `câu móc tới người xem ở giây ${Math.round(moc * 10) / 10} — phải trong 3 giây đầu (câu ngắn lại, hoặc thêm chữ màn ở shot đầu)` : s1.chu_man.trim() ? 'chữ màn móc hiện từ giây 0' : `câu móc đọc xong ở giây ${Math.round(moc * 10) / 10}`, cung: true });
    // vị trí lật ngược theo thời gian
    const tong = canh.reduce((a, c) => a + giayPhat(c), 0);
    const pcLat = new Set(tap.phan_canh.filter((p) => nhipCua(p.beat) === 'lat_nguoc').map((p) => p.ten));
    let t = 0, tuLat = -1; for (const c of canh) { if (tuLat < 0 && pcLat.has(c.phan_doan)) tuLat = t; t += giayPhat(c); }
    if (tuLat >= 0 && tong > 0) { const r = tuLat / tong; m.push({ key: 'vi_tri_lat', ten: 'Lật ngược đúng chỗ', dat: r >= 0.55 && r <= 0.92, ghi: `lật ngược bắt đầu ở ${Math.round(r * 100)}% phim${r < 0.55 ? ' — quá sớm, chưa đủ leo thang' : r > 0.92 ? ' — quá muộn, không còn chỗ kết' : ''}`, cung: false }); }
  }
  if (series) {
    const conTap = (kt.series!.tap ?? []).some((x) => (x.so ?? 0) > (tap.so ?? 0));
    const cuoi = tap.beats[tap.beats.length - 1]?.ten ?? '';
    const moc = /cliff|móc|teaser|tease|next|tập sau|to be continued/i.test(cuoi);
    if (conTap) m.push({ key: 'moc', ten: 'Móc sang tập sau', dat: moc, ghi: moc ? `beat cuối: ${cuoi}` : 'tập chưa phải tập cuối mà beat cuối không phải móc (cliffhanger/teaser) — người xem không có lý do xem tập sau', cung: false });
    m.push({ key: 'dong_co', ten: 'Động cơ series', dat: true, ghi: kt.series!.dong_co, cung: false });
  }
  const dat = m.filter((x) => x.dat).length;
  return { muc: m, diem: m.length ? Math.round((dat / m.length) * 100) : 0, chan: m.filter((x) => x.cung && !x.dat).map((x) => `kịch bản: ${x.ghi}`) };
}

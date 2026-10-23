// MÁY CHẤM KỊCH BẢN (13/10/2026 — anh: "kịch bản mới quan trọng"). Chấm một tập theo khung phim ngắn 45–60s trước khi tiêu tiền hình:
//   logline (ai · muốn gì · cái gì cản) · hook ≤ 3s · đủ 5 nhịp (hook → vấn đề → leo thang → lật ngược → kết/móc) · lật ngược rơi vào
//   55–92% thời lượng · tập series chưa phải tập cuối thì kết bằng MÓC sang tập sau · series có câu ĐỘNG CƠ.
// `cung` = mục chặn sinh keyframe (quy-trinh.ts › chanTienKy, khi phim có kinh thánh series); còn lại là gợi ý trên thanh 🎬 Quy trình.
// Thuần — tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/cham-kich-ban.test.mts
import type { Canh, PhanCanh, Series } from './kieu';
import type { Beat } from './dien-anh';
import { giayPhat } from './kieu';
import { loiNoiNhip } from './noi-nhip';

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

/** Từ khoá khoảnh khắc CẢM XÚC MẠNH của phim ngắn dọc (đánh mặt / sỉ nhục / lật thân phận / tình cảm bùng) — Việt + Anh. */
export const CAM_XUC_MANH = /tát|quỳ|khóc|nức nở|sốc|lật mặt|vạch mặt|bẽ mặt|đánh mặt|sỉ nhục|thân phận|hôn|ôm chầm|đuổi việc|ly hôn|phản bội|nhục|slap|kneel|tears|cries|sob|shock|expos|humiliat|reveal|kiss|betray|divorce|fired/i;
/** BỘ CHẤM PHIM NGẮN DỌC (micro-drama kiểu tổng tài — dien-anh.ts › CAU_TRUC.phim_doc): độ dài tập · nút thắt dày (≤ 30s không có nút) ·
 *  cliffhanger cuối MỖI tập (trừ tập cuối series) · có khoảnh khắc cảm xúc mạnh. Cliffhanger là mục chặn — tập không móc thì cả chuỗi 60 tập gãy. */
export function chamPhimDoc(o: VaoKb): MucKb[] {
  const { tap, canh, kt } = o; const m: MucKb[] = [];
  const tong = canh.reduce((a, c) => a + giayPhat(c), 0);
  // CẮT CÓ CỚ (noi-nhip.ts): trong cùng phân cảnh, mỗi điểm cắt có đuôi gieo + đầu nhận (nhìn / tiếng / động tác / tiếp nhận) — không thì cảnh rời rạc
  { const loi = [...new Set(canh.map((c) => c.phan_doan))].flatMap((pd) => loiNoiNhip(canh.filter((c) => c.phan_doan === pd)));
    if (canh.length >= 2) m.push({ key: 'noi_cat', ten: 'Cắt có cớ (nhìn · tiếng · động tác · tiếp nhận)', dat: !loi.length, ghi: loi.length ? `${loi.length} điểm cắt rời: ${loi.slice(0, 4).join(' · ')}${loi.length > 4 ? ' …' : ''}` : 'mọi điểm cắt có đuôi gieo, đầu nhận', cung: false }); }
  if (canh.length) m.push({ key: 'do_dai_doc', ten: 'Độ dài tập 60–120s', dat: tong >= 55 && tong <= 135, ghi: `tập dài ${Math.round(tong)}s${tong < 55 ? ' — quá ngắn, chưa kịp dồn nén' : tong > 135 ? ' — quá dài, người xem lướt đi trước cliffhanger' : ''}`, cung: false });
  // nút = đầu mỗi phân cảnh mang nhịp vấn đề / leo thang / lật ngược / kết
  const batDau = new Map<string, number>(); let t = 0;
  for (const c of canh) { if (!batDau.has(c.phan_doan)) batDau.set(c.phan_doan, t); t += giayPhat(c); }
  const nut = tap.phan_canh.filter((p) => ['van_de', 'leo_thang', 'lat_nguoc', 'ket'].includes(nhipCua(p.beat) ?? '')).map((p) => batDau.get(p.ten)).filter((x): x is number => x != null).sort((a, b) => a - b);
  if (canh.length && tong > 0) {
    const moc = [0, ...nut, tong]; let lon = 0, tu = 0;
    for (let i = 1; i < moc.length; i++) if (moc[i]! - moc[i - 1]! > lon) { lon = moc[i]! - moc[i - 1]!; tu = moc[i - 1]!; }
    m.push({ key: 'nut_day', ten: 'Nút thắt mỗi 15–30s', dat: lon <= 30, ghi: lon <= 30 ? `${nut.length} nút, khoảng dài nhất ${Math.round(lon)}s` : `giây ${Math.round(tu)}–${Math.round(tu + lon)} dài ${Math.round(lon)}s không có nút thắt — chèn một cú ép / hé lộ / lật nhỏ`, cung: false });
  }
  const conTap = !kt.series?.tap?.length || kt.series.tap.some((x) => (x.so ?? 0) > (tap.so ?? 0));
  const cuoi = [tap.beats[tap.beats.length - 1]?.ten ?? '', tap.phan_canh[tap.phan_canh.length - 1]?.beat ?? ''].join(' ');
  const moc = /cliff|móc|teaser|tease|next|tập sau|bỏ lửng|to be continued/i.test(cuoi);
  if (conTap) m.push({ key: 'cliff_doc', ten: 'Cliffhanger cuối tập', dat: moc, ghi: moc ? `beat cuối: ${cuoi.trim()}` : 'phim ngắn dọc mà tập không kết bằng cliffhanger — người xem không bấm tập sau (beat cuối phải là móc / bỏ lửng)', cung: true });
  const manh = canh.find((c) => CAM_XUC_MANH.test([c.hanh_dong ?? '', c.loi_thoai, ...c.thoai.map((d) => d.loi)].join(' ')));
  m.push({ key: 'cam_xuc_manh', ten: 'Khoảnh khắc cảm xúc mạnh', dat: !!manh, ghi: manh ? `có: ${(manh.hanh_dong ?? manh.loi_thoai).slice(0, 80)}` : 'chưa có cú đánh mặt / sỉ nhục / lật thân phận / bùng cảm xúc nào — thể loại này sống nhờ những khoảnh khắc đó', cung: false });
  return m;
}

/** ĐẦU TƯ CẢM XÚC trước cú LẬT NGƯỢC (anh 18/10/2026, tập 122: "Lục Thần xuất hiện quá ít nên đến cảnh ngạc nhiên cũng chẳng ai quan tâm"):
 *  Hitchcock — bất ngờ chỉ có sức nặng khi người xem đã gắn với người bị bất ngờ; phim ngắn Trung Quốc 打脸 — người bị vả mặt phải là người đã
 *  trực tiếp làm nhục nhân vật chính TRÊN MÀN; gài–trả (Chekhov) — món dùng để lật phải lên hình trước. Chấm thuần từ shot: ai có mặt (may_3d.vi_tri
 *  không ẩn, không có 3D thì theo biểu cảm), lời thoại, biểu cảm, chủ thể khung. Nhân vật chính = người có mặt lâu nhất cả tập. */
const SOC = new Set(['soc', 'bat_ngo', 'ngo_vuc', 'nhuc_nha', 'lo_lang', 'that_vong', 'buon']);
export function chamDauTu(o: VaoKb): MucKb[] {
  const { tap, canh, kt } = o; const cung = kt.the_loai === 'phim_doc';
  const pcLat = new Set(tap.phan_canh.filter((p) => nhipCua(p.beat) === 'lat_nguoc').map((p) => p.ten));
  const iLat = canh.findIndex((c) => pcLat.has(c.phan_doan)); if (iLat <= 0) return [];
  const nguoi = new Set(canh.flatMap((c) => [...(c.bieu_cam ?? []).map((b) => b.nv), ...c.thoai.map((d) => d.nhan_vat)]).filter(Boolean));
  // CÓ MẶT = diễn trong shot (có biểu cảm) hoặc là chủ thể khung — không tính đứng trong set mà ngoài khung (Thần ở bàn họp khi máy quay Hạ)
  const co = (c: VaoKb['canh'][number]) => new Set([...(c.bieu_cam ?? []).map((b) => b.nv), ...(c.may_3d?.khung ?? [])]);
  const so = (i: number) => `#${canh[i]!.thu_tu ?? i + 1}`;
  const giay = new Map<string, number>(); canh.forEach((c) => { for (const t of co(c)) if (nguoi.has(t)) giay.set(t, (giay.get(t) ?? 0) + giayPhat(c)); });
  const chinh = [...giay].sort((a, b) => b[1] - a[1])[0]?.[0]; if (!chinh) return [];
  const sau = canh.map((c, i) => ({ c, i })).filter(({ i }) => i >= iLat);
  const muc: MucKb[] = [];
  // NGƯỜI BỊ LẬT = có biểu cảm sốc / mất thế ở cú lật (người giúp nhân vật chính — luật sư Trần — không phải người bị vả mặt)
  const biLat = [...new Set(sau.flatMap(({ c }) => (c.bieu_cam ?? []).filter((b) => b.nv !== chinh && (SOC.has(b.dau) || SOC.has(b.cuoi))).map((b) => b.nv)))];
  for (const t of biLat) {
    const truoc = canh.slice(0, iLat).map((c, i) => ({ c, i })).filter(({ c }) => co(c).has(t));
    let vang = 0, tu = -1, dai = 0, tuDai = -1;
    for (let i = truoc[0]?.i ?? iLat; i < iLat; i++) { if (co(canh[i]!).has(t)) { tu = -1; continue; } if (tu < 0) tu = i; vang = i - tu + 1; if (vang > dai) { dai = vang; tuDai = tu; } }
    const du = truoc.length >= 3 && dai <= 4;
    muc.push({ key: `dau_tu:${t}`, ten: `${t}: có mặt đủ trước cú lật`, dat: du, cung,
      ghi: `${t} có mặt ${truoc.length} shot trước cú lật ở ${so(iLat)} (${truoc.map((x) => so(x.i)).join(', ') || 'không shot nào'})${dai ? `, vắng liền ${dai} shot (${so(tuDai)}–${so(tuDai + dai - 1)})` : ''}${du ? '' : ' — người xem chưa kịp quan tâm khi người này bị lật: cần ≥ 3 nhịp, không vắng quá 4 shot liền'}` });
    const doiDau = truoc.find(({ c }) => co(c).has(chinh) && (c.thoai.some((d) => d.nhan_vat === t && d.loi.trim()) || CAM_XUC_MANH.test(c.hanh_dong ?? '')));
    muc.push({ key: `doi_dau:${t}`, ten: `${t}: đối đầu trực tiếp ${chinh}`, dat: !!doiDau, cung: false,
      ghi: doiDau ? `${so(doiDau.i)}: ${(doiDau.c.hanh_dong ?? '').slice(0, 80)}` : `${t} chưa lần nào cùng khung với ${chinh} mà nói / làm điều gì nặng — người bị vả mặt phải là người đã trực tiếp làm nhục nhân vật chính trên màn` });
    const pu = sau.find(({ c }) => co(c).has(t) && (c.bieu_cam ?? []).some((b) => b.nv === t && (SOC.has(b.cuoi) || b.dau !== b.cuoi)));
    muc.push({ key: `phan_ung:${t}`, ten: `${t}: có shot phản ứng`, dat: !!pu, cung: false, ghi: pu ? `${so(pu.i)}` : `cú lật không có shot ${t} đổi sắc mặt — người xem không thấy "cái tát" chạm tới ai` });
  }
  // GÀI–TRẢ: đạo cụ là CHỦ THỂ khung (may_3d.khung) ở cú lật / sau lật mà chưa từng lên hình trước đó
  // đạo cụ đã lên hình = có trong khung (vi_tri không ẩn) ở shot nào trước cú lật, không cần là chủ thể (ly cà phê từ #1)
  const truocCo = new Set(canh.slice(0, iLat).flatMap((c) => [...co(c), ...(c.may_3d?.vi_tri ?? []).filter((v) => !v.an).map((v) => v.ten)]));
  for (const { c, i } of sau) for (const v of c.may_3d?.khung ?? []) {
    if (nguoi.has(v) || truocCo.has(v) || muc.some((m) => m.key === `gai:${v}`)) continue;
    muc.push({ key: `gai:${v}`, ten: `Gài trước: ${v}`, dat: false, cung, ghi: `${v} là chủ thể ${so(i)} trong cú lật mà chưa lần nào lên hình trước đó — gài ít nhất 2 lần (một lần lướt, một lần cận) thì cú trả mới có nghĩa` });
  }
  return muc;
}

export type MucKb = { key: string; ten: string; dat: boolean; ghi: string; cung: boolean };
export type VaoKb = {
  tap: { so?: number; beats: Pick<Beat, 'ten'>[]; phan_canh: Pick<PhanCanh, 'ten' | 'beat'>[] };
  canh: (Pick<Canh, 'phat_s' | 'thoi_luong_s' | 'phan_doan' | 'chu_man' | 'thoai' | 'loi_thoai'> & Partial<Pick<Canh, 'hanh_dong' | 'thu_tu' | 'may_3d' | 'bieu_cam' | 'dan_dung' | 'ky_thuat'>>)[];
  kt: { logline?: string; series?: Series | null; khong_loi?: boolean; /** thể loại — 'phim_doc' (phim ngắn dọc) bật bộ chấm nhịp micro-drama */ the_loai?: string };
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
  if (kt.the_loai === 'phim_doc') m.push(...chamPhimDoc(o));
  m.push(...chamDauTu(o));
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

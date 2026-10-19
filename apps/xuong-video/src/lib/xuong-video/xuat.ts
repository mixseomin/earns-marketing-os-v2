// Bản xuất MP4 của một tập — phần THUẦN (không server-only): từ shot + nguyên liệu đã tải/đo → lệnh ffmpeg + các tệp chữ.
// Review 09/10/2026: studio chỉ "xem thử" trong trình duyệt, không có tệp nào gửi Meta/TikTok. Bản xuất làm đúng thứ timeline cho xem:
//   - mỗi shot phát đúng phat_s (cắt từ đầu clip), clip chưa có thì dùng keyframe tĩnh;
//   - giọng từng dòng thoại nối tiếp từ đầu shot, hiệu ứng từ đầu shot, tiếng sẵn của clip chỉ khi shot KHÔNG có tiếng riêng (cùng luật timeline);
//   - nhạc theo phân cảnh (ưu tiên) hoặc một bài cả tập, lặp nếu ngắn, nhỏ tiếng dưới giọng;
//   - trên hình CHỈ có chữ màn (chu_man, to ở 1/6 trên) — shot không có chữ màn thì không có chữ nào (anh chốt 09/10/2026, #1231); end card ưu đãi cho quảng cáo;
//   - chuẩn -14 LUFS, H.264 30fps, 1080×1920 (9:16) hoặc 1920×1080.
// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/xuat.test.mts
import { lookShot } from './look';
import type { Canh, KieuChu, LoaiPhim, Lop, NhanVat, PhanCanh, Tap, ThongTinQc, ViTriChu } from './kieu';
import { mauAss, gioAss, lopAss, lopAnhLoc, lopHieuUngLoc } from './lop';
import { chuyenCanhGiua } from './dien-anh';
import { giayPhat, locNhanh, doanHien, coMau, assVaoChu, gopKieu } from './kieu';
import { keHoachToc, bieuThucToc } from './toc-do';
import { ngatDong, dongChuMan, boChamCuoi } from './ngat-dong';
import { lichSfx, LUFS_GIONG, LUFS_NHAC_DUOI_GIONG, LUFS_CLIP_DUOI_GIONG } from './sfx';
export { doanChuMan, chuManHien } from './kieu';
import { giayGiuKet, dongThoai, phatTiengClip, lichGiong } from './am-thanh';

/** Một tệp nguyên liệu đã tải về + đo: dai = giây (âm/video), coAm = clip có luồng tiếng, lufs = độ to tích hợp (tệp chỉ có tiếng). */
export type NguyenLieu = { url: string; duong: string; dai: number | null; coAm: boolean; fps?: number | null; lufs?: number | null;
  /** độ sáng trung bình (Y 0–255, signalstats YAVG) của clip — cân màu theo cảnh (canMauCanh) */ yavg?: number | null;
  /** giây CẮT ĐUÔI bài nhạc (đoạn kết nhỏ dần + im, đo bằng duoiNhac) — null = đuôi không tụt */ catDuoi?: number | null };
export type TepChu = { duong: string; noiDung: string };
/** loi = không dựng được (args rỗng) và vì sao; canhBao = dựng được nhưng lệch chuẩn (lẫn giọng lời dẫn, bản nháp thiếu nhạc…). */
/** lich = chỗ nào kịch bản CÓ tiếng (giọng, hiệu ứng, tiếng clip có chủ ý) + mốc từng shot — để đo sau xuất (tiengLa) tìm tiếng không ai viết. */
export type LichTieng = { co: [number, number][]; shot: { thu_tu: number; tu: number; den: number }[] };
export type KeHoachXuat = { args: string[]; tep: TepChu[]; giay: number; canhThieu: string[]; canhBao: string[]; loi?: string; lich?: LichTieng };

/** Đọc chuỗi ebur128 độ to tức thời (ametadata lavfi.r128.M) → to NHẤT mỗi ô 0,5s. Một bộ đọc cho khoangIm và duoiNhac. */
function docM05(metadata: string): Map<number, number> {
  const o = new Map<number, number>(); let t: number | null = null;
  for (const dong of metadata.split('\n')) {
    const a = dong.match(/pts_time:([\d.]+)/); if (a) { t = Number(a[1]); continue; }
    const b = dong.match(/lavfi\.r128\.M=(\S+)/);
    if (b && t != null) { const v = Number(b[1]); const k = Math.floor(t * 2) / 2; o.set(k, Math.max(o.get(k) ?? -200, Number.isFinite(v) ? v : -200)); }
  }
  return o;
}

/** Đo sau xuất (máy tự kiểm, không ai phải nghe lại): đọc chuỗi độ to tức thời (ebur128 M, file ametadata) → các khoảng 0,5s mà
 *  to nhất vẫn dưới ngưỡng = khoảng im/đứt nền. QC mẫu Jett không có ô nào dưới -21 LUFS; bản #5 cũ có 9 ô -120 (10/10/2026).
 *  Bỏ 0,5s đầu (nhạc fade vào) và 0,5s cuối. Trả các đoạn đã gộp liền nhau, giây bắt đầu–kết thúc. */
export const NGUONG_IM_LUFS = -40;
export function khoangIm(metadata: string, giay: number): [number, number][] {
  const o = docM05(metadata);
  const im = [...o.entries()].filter(([k, v]) => k >= 0.5 && k + 0.5 <= giay - 0.5 && v < NGUONG_IM_LUFS).map(([k]) => k).sort((x, y) => x - y);
  const out: [number, number][] = [];
  for (const k of im) { const l = out[out.length - 1]; if (l && Math.abs(l[1] - k) < 1e-6) l[1] = k + 0.5; else out.push([k, k + 0.5]); }
  return out;
}

/** Đo sau xuất: TIẾNG LẠ = ô 0,5s không có giọng / hiệu ứng / tiếng clip có chủ ý nào trong kịch bản (lich.co, nới 0,3s) mà to hơn nền
 *  (trung vị các ô trống như vậy) quá NGUONG_TIENG_LA dB. Phim #36 15/10/2026: shot 8 tiếng gốc clip (nhạc riêng model video tự sinh) to hơn
 *  nền 6–9 dB, shot 5 tiếng đập +7 dB — phải người nghe mới biết; bản đã sửa nền phẳng ±1 dB. Bỏ 0,5s đầu và 1s cuối (nhạc fade). */
export const NGUONG_TIENG_LA = 5;
/** Đọc stderr của ffmpeg freezedetect → các đoạn hình đứng [từ, đến] (giây, làm tròn 0,1). Đoạn đứng tới hết tệp (không có freeze_end) → đến = giay. */
export function hinhDung(stderr: string, giay: number): [number, number][] {
  const out: [number, number][] = []; let tu: number | null = null;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  for (const dong of stderr.split('\n')) {
    const a = dong.match(/freeze_start:\s*([\d.]+)/); if (a) { tu = Number(a[1]); continue; }
    const b = dong.match(/freeze_end:\s*([\d.]+)/); if (b && tu != null) { out.push([r1(tu), r1(Number(b[1]))]); tu = null; }
  }
  if (tu != null && giay - tu >= 1) out.push([r1(tu), r1(giay)]);
  return out;
}
/** Clip ngắn hơn giây phát được phát chậm tối đa bấy nhiêu lần trước khi phải giữ khung cuối (1,6×: chuyển động AI vẫn trông tự nhiên). */
export const GIAN_TOI_DA = 1.6;
export function tiengLa(metadata: string, lich: LichTieng, giay: number): { tu: number; den: number; hon: number; shot: number[] }[] {
  const o = docM05(metadata);
  const coTieng = (k: number) => lich.co.some(([a, b]) => k < b + 0.3 && k + 0.5 > a - 0.3);
  const nen = [...o.entries()].filter(([k, v]) => k >= 0.5 && k + 0.5 <= giay - 1 && !coTieng(k) && v > -70).sort((x, y) => x[0] - y[0]);
  if (nen.length < 4) return [];
  const sx = nen.map(([, v]) => v).sort((x, y) => x - y); const tv = sx[Math.floor(sx.length / 2)]!;
  const out: { tu: number; den: number; hon: number; shot: number[] }[] = [];
  for (const [k, v] of nen) {
    if (v <= tv + NGUONG_TIENG_LA) continue;
    const l = out[out.length - 1];
    if (l && Math.abs(l.den - k) < 1e-6) { l.den = k + 0.5; l.hon = Math.max(l.hon, Math.round(v - tv)); }
    else out.push({ tu: k, den: k + 0.5, hon: Math.round(v - tv), shot: [] });
  }
  for (const x of out) x.shot = lich.shot.filter((s) => s.tu < x.den && s.den > x.tu).map((s) => s.thu_tu);
  return out;
}

/** Đuôi bài nhạc: giây cuối cùng bài còn giữ mức gần trung vị của chính nó (to nhất mỗi ô 0,5s ≥ trung vị − 3 LU), đọc từ chuỗi ebur128 M.
 *  Bài AI hay tự viết đoạn KẾT nhỏ dần rồi im (phim #5: từ ~51s nhạc rút, im hẳn 53,4s) → cắt ở đây rồi lặp, nền phủ kín tới end card.
 *  null = đuôi không tụt (không cần cắt) hoặc không đọc được. */
export function duoiNhac(metadata: string): number | null {
  const o = docM05(metadata);
  const ks = [...o.keys()].sort((x, y) => x - y);
  if (ks.length < 8) return null;
  const sx = ks.map((k) => o.get(k)!).sort((x, y) => x - y); const trungVi = sx[Math.floor(sx.length / 2)]!;
  let cuoi = -1; for (const k of ks) if (o.get(k)! >= trungVi - 3) cuoi = k;
  const het = ks[ks.length - 1]! + 0.5;
  return cuoi >= 0 && het - (cuoi + 0.5) >= 0.5 ? cuoi + 0.5 : null;
}

/** Mức to chuẩn của MỌI câu giọng trước khi trộn — câu nào ra từ model cũng về cùng mức, không câu to câu nhỏ. */
export { LUFS_GIONG };   // một chỗ ở sfx.ts (tiếng hiệu ứng đặt theo giọng)
/** Nhạc nền nằm dưới giọng bao nhiêu dB (trước ducking). 10 dB: nghe rõ nền liên tục như QC mẫu mà không lấn lời. */
export { LUFS_NHAC_DUOI_GIONG };   // một chỗ ở sfx.ts (phát thử trên timeline cũng dùng)

/** Giọng lời dẫn của các câu đã có file: lẫn nhiều giọng → cảnh báo (phim #5 10/10/2026: một shot nghe như người khác đọc).
 *  Thuần — bản xuất gắn vào kết quả, studio hiện cờ đỏ. */
export function kiemGiongLoiDan(canh: Canh[], nhanVat: NhanVat[]): string[] {
  const dem = new Map<string, number>(); let khongRo = 0;
  for (const c of canh) for (const d of dongThoai(c, nhanVat)) {
    if (!d.url || d.nhan_vat.trim()) continue;
    if (d.giong) dem.set(d.giong, (dem.get(d.giong) ?? 0) + 1); else khongRo++;
  }
  const out: string[] = [];
  if (dem.size > 1) out.push(`lời dẫn lẫn ${dem.size} giọng: ${[...dem.entries()].map(([g, n]) => `${g.split('|').pop()} (${n} câu)`).join(', ')} — đọc lại cho cùng một giọng`);
  if (khongRo && dem.size) out.push(`${khongRo} câu lời dẫn không rõ giọng đã đọc`);
  return out;
}

/** URL cần tải cho một bản xuất (clip/keyframe, giọng, hiệu ứng, nhạc) — tải trước, đo rồi mới dựng lệnh. */
export function urlCanXuat(canh: Canh[], nhanVat: NhanVat[], tap: Pick<Tap, 'nhac_url' | 'nhac_phan_canh'> & { lop?: Lop[] }, nhanh?: string | null, qc?: ThongTinQc | null): string[] {
  const ds = locNhanh(canh, nhanh);
  const out = new Set<string>();
  // Logo góc + ảnh sản phẩm cho end card (mục 0) — tải cùng nguyên liệu; thiếu thì xuất không có, không chặn.
  if (qc?.logo_url && /^https?:\/\//.test(qc.logo_url)) out.add(qc.logo_url);
  if (qc?.anh?.[0] && /^https?:\/\//.test(qc.anh[0])) out.add(qc.anh[0]);
  for (const c of ds) {
    const v = c.video_cuoi_url || c.video_url || c.keyframe_url;
    if (v) out.add(v);
    for (const d of dongThoai(c, nhanVat)) if (d.url) out.add(d.url);
    if (c.am_thanh_url) out.add(c.am_thanh_url);
  }
  const pc = new Set(ds.map((c) => c.phan_doan));
  const coNhacPc = [...pc].some((p) => tap.nhac_phan_canh?.[p]);
  if (coNhacPc) for (const p of pc) { const u = tap.nhac_phan_canh?.[p]; if (u) out.add(u); }
  else if (tap.nhac_url) out.add(tap.nhac_url);
  for (const l of tap.lop ?? []) if (l.loai === 'anh' && !l.an && l.url) out.add(l.url);
  return [...out];
}

/** Ngắt dòng cho drawtext: tham lam theo từ, tối đa `toiDa` ký tự một dòng. Mỗi dòng vẽ bằng MỘT drawtext riêng — ffmpeg 8 vẽ
 *  ký tự xuống dòng trong textfile thành ô vuông (thử trên box3 09/10/2026), nên không gộp nhiều dòng vào một textfile. */
export { ngatDong } from './ngat-dong';   // một thuật toán ngắt dòng cho bản xuất + xem trước (ngat-dong.ts)
// mauAss / gioAss: một chỗ ở lop.ts (lớp phủ dùng chung).
/** Tệp ASS (libass) cho chữ màn cả bản xuất. Mỗi kiểu chữ khác nhau (phim + shot) là một Style; mỗi câu một Dialogue đặt giữa ngang,
 *  dọc theo y của kiểu hoặc vị trí phim. "**chữ**" = đoạn nhấn: to gấp 1,8, nghiêng, màu nhấn (kiểu "YES!" của QC mẫu).
 *  nen = băng nền đặc sau chữ (BorderStyle 3). */
export function tepAss(o: { W: number; H: number; kieu?: KieuChu; viTri: ViTriChu; cau: { tu: number; den: number; dong: string[]; kieu?: KieuChu }[]; lop?: Lop[] }): string {
  const kieuStyle = new Map<string, { ten: string; k: ReturnType<typeof gopKieu> }>();
  const lp = lopAss(o.lop ?? [], o.W, o.H);   // lớp phủ chữ/hình — dưới chữ màn (lớp 100)
  const style = (kc?: KieuChu) => {
    const k = gopKieu(o.kieu, kc); const khoa = JSON.stringify(k);
    if (!kieuStyle.has(khoa)) kieuStyle.set(khoa, { ten: kieuStyle.size ? `Man${kieuStyle.size}` : 'Man', k });
    return kieuStyle.get(khoa)!;
  };
  const su = o.cau.map((c) => {
    const { ten, k } = style(c.kieu);
    const fs = Math.round(o.W * k.co);
    const tamY = (n: number) => Math.round(typeof k.y === 'number' ? o.H * k.y : o.viTri === 'giua' ? o.H / 2 : o.viTri === 'duoi' ? o.H * 0.62 : o.H * 0.15 + (n * fs * 1.25) / 2);
    const nhan = (t: string) => (k.nhan ? t.replace(/[0-9?$%]+/g, (m) => `{\\c${mauAss(k.nhan)}}${m}{\\c${mauAss(k.mau)}}`) : t);
    const to = (t: string) => t.replace(/\*\*(.+?)\*\*/g, (_, m: string) => `{\\fs${Math.round(fs * 1.8)}\\i1\\c${mauAss(k.nhan || k.mau)}}${m}{\\r}`);
    // Ngắt + đo theo bề rộng font thật (ngat-dong.ts › dongChuMan); dòng vẫn rộng hơn khung → cả câu thu nhỏ (\\fs) cho vừa.
    const ng = c.dong.map((d) => (/\*\*/.test(d) ? { dong: [d], co: 1 } : dongChuMan(d, o.W, k)));
    const dong = ng.flatMap((x) => x.dong).map((d) => d.replace(/[{}\\]/g, ''));
    const thu = Math.min(...ng.map((x) => x.co));
    return `Dialogue: 100,${gioAss(c.tu)},${gioAss(c.den)},${ten},,0,0,0,,{\\an5\\pos(${Math.round(o.W / 2)},${tamY(dong.length)})${thu < 1 ? `\\fs${Math.floor(fs * thu)}` : ''}${assVaoChu(k.vao, k.ngang)}}${dong.map((d) => to(nhan(d))).join('\\N')}`;
  });
  const dong = ['[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${o.W}`, `PlayResY: ${o.H}`, 'ScaledBorderAndShadow: yes', 'WrapStyle: 2', '',
    '[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ...[...kieuStyle.values()].map(({ ten, k }) => { const fs = Math.round(o.W * k.co); return `Style: ${ten},${k.font},${fs},${mauAss(k.mau)},${mauAss(k.mau)},${mauAss(k.nen || k.vien)},&H80000000&,-1,0,0,0,${k.ngang},100,0,0,${k.nen ? 3 : 1},${k.nen ? Math.round(fs * 0.35) : Math.max(1, Math.round(fs * k.vien_day))},0,5,0,0,0,1`; }),
    ...lp.styles,
    '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text', ...lp.events, ...su, ''];
  return dong.join('\n');
}
// drawtext expansion=none: '%' trong chữ ("giảm 70%") không bị hiểu là lệnh %{…} — thử '%%' trên ffmpeg 8 vẫn báo "Stray %" và end card ra đen.
const so = (x: number) => (Math.round(x * 1000) / 1000).toString();
/** Đường dẫn trong filter ffmpeg: thoát ':' '\' và dấu nháy. */
const duongFf = (p: string) => p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");

/** Độ lệch sáng cần bù cho từng shot (eq=brightness, −1…1) để mọi clip trong một phân cảnh về trung vị độ sáng của cảnh; chỉ shot lệch ≥ 4/255,
 *  kẹp ±0,08 (kéo quá tay làm bệt). Thuần: nhận hàm đo yavg của shot (null = không phải clip / chưa đo). */
export function canMauCanh<T extends { id: number; phan_doan: string }>(ds: T[], yavg: (c: T) => number | null): Map<number, number> {
  const out = new Map<number, number>(); const theoCanh = new Map<string, { c: T; y: number }[]>();
  for (const c of ds) { const y = yavg(c); if (y == null || !Number.isFinite(y)) continue; (theoCanh.get(c.phan_doan) ?? theoCanh.set(c.phan_doan, []).get(c.phan_doan)!).push({ c, y }); }
  for (const ds2 of theoCanh.values()) {
    if (ds2.length < 2) continue;
    const ys = ds2.map((x) => x.y).sort((a, b) => a - b); const tv = ys.length % 2 ? ys[(ys.length - 1) / 2]! : (ys[ys.length / 2 - 1]! + ys[ys.length / 2]!) / 2;   // trung vị (chẵn: giữa hai clip, không nghiêng về một clip)
    for (const { c, y } of ds2) { const d = tv - y; if (Math.abs(d) >= 4) out.set(c.id, Math.round(Math.max(-0.08, Math.min(0.08, d / 255)) * 1000) / 1000); }
  }
  return out;
}

export function keHoachXuat(o: {
  loai: LoaiPhim; tiLe: string; canh: Canh[]; nhanVat: NhanVat[]; tap: Pick<Tap, 'nhac_url' | 'nhac_phan_canh'> & { lop?: Lop[]; phan_canh?: Pick<PhanCanh, 'ten' | 'beat'>[] }; qc?: ThongTinQc | null;
  nhanh?: string | null; nguyenLieu: NguyenLieu[]; font: string; thuMuc: string; ra: string;
  /** thư mục font cho libass (assets/fonts); chiThuTu = chỉ xuất các shot này (xem thử từng shot, không end card). */
  fontsDir?: string; chiThuTu?: number[];
  /** thư mục tiếng hiệu ứng (public/sfx) — có thì trộn tiếng thật cho key âm thanh của shot (sfx.ts). */
  sfxDir?: string;
  /** cho xuất khi phim quảng cáo có lời dẫn mà chưa có nhạc nền (bản nháp để nghe thử) — mặc định chặn. */
  choThieuNhac?: boolean;
  /** nhịp stop-motion (kinh_thanh.nhip_stop_motion): mỗi hình giữ hai nhịp — fps=12 trước khi ra -r chuẩn */
  nhipStopMotion?: boolean;
  /** tông màu chung cả phim (kinh_thanh.look) — look.ts › lookShot, áp sau cân sáng */
  look?: string;
}): KeHoachXuat {
  const doc = o.tiLe !== '16:9';
  const W = doc ? 1080 : 1920, H = doc ? 1920 : 1080;
  const ds = locNhanh(o.canh, o.nhanh).slice().sort((a, b) => a.thu_tu - b.thu_tu).filter((c) => !o.chiThuTu?.length || o.chiThuTu.includes(c.thu_tu));
  const nl = new Map(o.nguyenLieu.map((x) => [x.url, x]));
  const canhBao = kiemGiongLoiDan(ds, o.nhanVat);
  // Nhạc nền là lớp liền mạch duy nhất của QC: giọng đọc ngắt quãng, clip mỗi cái một tiếng (đã tắt) → thiếu nhạc là có khoảng im tuyệt đối
  // giữa các câu (phim #5 10/10/2026: 9 đoạn -120 LUFS, bản gốc không đoạn nào dưới -21). Quảng cáo có lời dẫn mà thiếu nhạc → không xuất.
  const coNhac = locNhanh(o.canh, o.nhanh).some((c) => o.tap.nhac_phan_canh?.[c.phan_doan] && nl.has(o.tap.nhac_phan_canh[c.phan_doan]!)) || (!!o.tap.nhac_url && nl.has(o.tap.nhac_url));
  const coLoiDan = ds.some((c) => dongThoai(c, o.nhanVat).some((d) => d.url && !d.nhan_vat.trim()));
  if (o.loai === 'quang_cao' && coLoiDan && !coNhac && !o.chiThuTu?.length) {
    if (!o.choThieuNhac) return { args: [], tep: [], giay: 0, canhThieu: [], canhBao, loi: 'quảng cáo có lời dẫn nhưng chưa có nhạc nền — sinh/chọn nhạc cho tập trước (bản xuất sẽ có khoảng im giữa các câu)' };
    canhBao.push('bản nháp THIẾU nhạc nền — giữa các câu lời dẫn là khoảng im');
  }
  // ĐIỂM CẮT CUỐI (cat-cuoi.ts): shot khai phát dài hơn đoạn dùng được của clip → giayPhat đã cắt ở điểm cắt; báo để chỉnh giây / giọng.
  for (const c of ds) if (c.cat_cuoi_s && c.phat_s && c.phat_s > c.cat_cuoi_s + 0.05) canhBao.push(`#${c.thu_tu} khai phát ${c.phat_s}s nhưng clip chỉ dùng được tới ${c.cat_cuoi_s}s (sau đó hoà tan ra dải nhịp) — đã cắt ở ${c.cat_cuoi_s}s`);
  const dauVao: string[] = [];           // tham số -i theo thứ tự chỉ số
  const chiSo = new Map<string, number>();
  let soDauVao = 0;
  const them = (url: string, truoc: string[] = []): number => {
    const k = `${truoc.join(' ')} ${url}`;
    if (chiSo.has(k)) return chiSo.get(k)!;
    dauVao.push(...truoc, '-i', nl.get(url)!.duong); chiSo.set(k, soDauVao); return soDauVao++;
  };
  /** Tệp cục bộ không qua kho nguyên liệu (tiếng hiệu ứng trong repo). */
  const themTep = (duong: string): number => { const k = `tep ${duong}`; if (chiSo.has(k)) return chiSo.get(k)!; dauVao.push('-i', duong); chiSo.set(k, soDauVao); return soDauVao++; };
  const tep: TepChu[] = [];
  const tepChu = (ten: string, noiDung: string) => { const duong = `${o.thuMuc}/${ten}.txt`; tep.push({ duong, noiDung }); return duong; };
  const fsMan = Math.round(W * (doc ? 0.062 : 0.04));
  const wrapMan = doc ? 20 : 36;
  const font = duongFf(o.font);
  // Khối chữ nhiều dòng = nhiều drawtext, dòng i ở y = gốc + i·(cỡ chữ × 1,25); gốc tính theo tỉ lệ chiều cao (vùng an toàn 9:16) hoặc giữa màn.
  const khoiChu = (ten: string, dong: string[], fs: number, goc: (n: number) => string, them: string, chiBo: string) =>
    dong.map((d, i) => `drawtext=fontfile='${font}':textfile='${duongFf(tepChu(`${ten}_${i}`, d))}':expansion=none:fontsize=${fs}:fontcolor=white:${them}:x=(w-text_w)/2:y=${goc(dong.length)}+${Math.round(i * fs * 1.25)}${chiBo}`).join(',');
  // Vị trí chữ màn theo mục 0 (qc.vi_tri_chu): trên = 1/6 màn (mặc định), giữa, dưới ≈ 62% (kiểu QC UGC, chữ ngay dưới mặt/sản phẩm).
  const viTri = o.qc?.vi_tri_chu ?? 'tren';
  const gocMan = (n: number) => (viTri === 'giua' ? `(h-${Math.round(n * fsMan * 1.25)})/2` : viTri === 'duoi' ? `h*0.62-${Math.round(n * fsMan * 1.25 / 2)}` : 'h*0.15');
  const drawMan = (ten: string, dong: string[], giua = false) => khoiChu(ten, dong, fsMan, (n) => (giua ? `(h-${Math.round(n * fsMan * 1.25)})/2` : gocMan(n)), `borderw=${Math.round(fsMan / 14)}:bordercolor=black@0.85`, '');
  // Logo góc trên phải (qc.logo_url) đè lên MỌI shot + end card: cao 6% màn, cách mép 3%.
  const logoUrl = o.qc?.logo_url && nl.has(o.qc.logo_url) ? o.qc.logo_url : null;
  // Tốc độ khung của bản xuất = tốc độ phổ biến nhất của các clip nguồn (Veo 24) — ép 24→30 phải nhân đôi khung, hình giật nhẹ (10/10/2026).
  const demFps = new Map<number, number>();
  for (const c of ds) { const u = c.video_cuoi_url || c.video_url; const f = u ? nl.get(u)?.fps : null; if (f && f >= 15 && f <= 60) demFps.set(f, (demFps.get(f) ?? 0) + 1); }
  const fpsRa = [...demFps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 30;
  // PHÓNG TO (17/10/2026 — clip AI 720p lên 1080): lanczos sắc hơn bicubic mặc định; phim truyện thêm làm nét nhẹ (unsharp 0,4) — quảng cáo giữ
  // nguyên chất cũ. Phóng to bằng AI (trả phí) là tuỳ chọn riêng, không nằm ở đây.
  const net = o.loai === 'quang_cao' ? '' : ',unsharp=5:5:0.4:5:5:0';
  const khung = `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1${net},fps=${so(fpsRa)},format=yuv420p`;
  // NỘI SUY KHUNG cho đoạn LÀM CHẬM (speed ramp / kéo chậm clip phủ giây phát): setpts kéo dài rồi fps= chỉ nhân bản khung → giật; minterpolate
  // bù chuyển động (mci) dựng khung giữa thật — chỉ shot có đoạn chậm hơn 0,8× (đắt CPU, không áp đại trà).
  const noiSuy = `minterpolate=fps=${so(fpsRa)}:mi_mode=mci:mc_mode=aobmc:vsbmc=1,`;
  // Ảnh tĩnh: đặt VỪA khung + nền là chính ảnh phóng mờ — ảnh vuông thật của shop (lưới review, ảnh sản phẩm) không bị cắt mất hai bên;
  // keyframe đã 9:16 thì vừa khít, nền mờ không lộ (09/10/2026, dùng ảnh thật Orabra cho shot bằng chứng + end card).
  // Ảnh tĩnh đẩy máy chậm (zoom vào 6% suốt giây phát) — ảnh đứng im 3–4s giữa các clip động trông như video bị khựng (10/10/2026).
  // crop với w/h đổi theo từng khung làm libx264 báo lỗi -22 (kích thước khung thay đổi) → dùng zoompan; phóng 2× trước để zoompan làm tròn không rung.
  const dayMay = (phat: number) => { const n = Math.max(2, Math.round(phat * fpsRa)); return `,scale=${W * 2}:${H * 2},zoompan=z='1+0.06*on/${n}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${so(fpsRa)},setsar=1`; };
  const khungTinh = (i: number) => `split=2[nb${i}][nf${i}];[nb${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:2[nbb${i}];[nf${i}]scale=${W}:${H}:force_original_aspect_ratio=decrease[nff${i}];[nbb${i}][nff${i}]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=${so(fpsRa)},format=yuv420p`;

  const loc: string[] = [];
  const nhanhVideo: string[] = [];
  // CÂN MÀU THEO CẢNH (shot matching, luật can_mau_hau_ky): clip AI mỗi lần sinh một phơi sáng — kéo độ sáng trung bình mỗi clip về trung vị
  // của cảnh (eq=brightness, kẹp ±0,08), lệch < 4/255 thì để nguyên. Bước đầu của colorist, trước khi áp look.
  const mauCanh = canMauCanh(ds, (c) => { const u = c.video_cuoi_url || c.video_url; return u ? nl.get(u)?.yavg ?? null : null; });
  // Ba lớp tiếng trộn riêng: giọng (điều khiển nén nhạc), nhạc (nhỏ lại khi có giọng), còn lại (hiệu ứng, tiếng clip có người nói).
  const nhanhGiong: string[] = [];
  const nhanhNhac: string[] = [];
  const nhanhAm: string[] = [];
  const canhThieu: string[] = [];
  let t = 0; let soAm = 0;
  const lich: LichTieng = { co: [], shot: [] };
  const cauMan: { tu: number; den: number; dong: string[]; kieu?: KieuChu }[] = [];
  const themAm = (bieuThuc: string, lop: string[] = nhanhAm) => { const nhan = `a${soAm++}`; loc.push(`${bieuThuc},aformat=sample_rates=48000:channel_layouts=stereo[${nhan}]`); lop.push(`[${nhan}]`); };
  /** Đưa câu giọng về LUFS_GIONG theo độ to đã đo (±15 dB) — không đo được thì để nguyên. */
  const chuanGiong = (url: string) => { const l = nl.get(url)?.lufs; return l != null && Number.isFinite(l) && l > -70 ? `volume=${so(Math.max(-15, Math.min(15, LUFS_GIONG - l)))}dB,` : ''; };
  // Lịch giọng (mốc, tốc độ, điểm cắt) — CÙNG một hàm với timeline xem thử (lichGiong), trên đúng các shot có hình sẽ dựng.
  const coHinh = (c: Canh) => { const v = c.video_cuoi_url || c.video_url; return (!!v && nl.has(v)) || (!!c.keyframe_url && nl.has(c.keyframe_url)); };
  const lichG = lichGiong(ds.filter(coHinh), o.nhanVat, (u) => nl.get(u)?.dai ?? null);
  // Giữ hình kết GIU_KET giây sau câu cuối (am-thanh.ts) — kịch bản tự kết (không có end card tự động) thì kéo dài shot cuối, hình cuối đứng
  // (clip hết thì giữ khung cuối), chữ màn + logo + nhạc kéo theo vì mọi thứ phía dưới tính từ giây phát.
  if (!o.chiThuTu?.length && ds.length) {
    const cuoiDs = ds[ds.length - 1]!; const bCuoi = o.tap.phan_canh?.find((x) => x.ten === cuoiDs.phan_doan)?.beat ?? '';
    const tuKet = ['cta', 'end_card'].includes(cuoiDs.phan_doan) || /^(cta|end[\s_-]?card)$/i.test(bCuoi.trim());
    const endCardTuDong = o.loai === 'quang_cao' && !!o.qc?.uu_dai?.trim() && !coMau(o.qc) && !tuKet;
    const them = endCardTuDong ? 0 : giayGiuKet(ds.reduce((a, c) => a + giayPhat(c), 0), lichG);
    if (them > 0) { ds[ds.length - 1] = { ...cuoiDs, phat_s: Math.round((giayPhat(cuoiDs) + them) * 100) / 100 }; canhBao.push(`giữ hình kết thêm ${them}s sau câu cuối`); }
  }
  for (const g of lichG) {
    if (!nl.has(g.url)) continue;
    const ka = them(g.url);
    lich.co.push([g.tu, g.tu + (g.cat ?? (g.dai ?? nl.get(g.url)?.dai ?? 2) / g.nhanh)]);
    themAm(`[${ka}:a]${chuanGiong(g.url)}${g.nhanh > 1.001 ? `atempo=${so(g.nhanh)},` : ''}${g.cat != null ? `atrim=0:${so(g.cat)},` : ''}asetpts=PTS-STARTPTS,adelay=${Math.round(g.tu * 1000)}:all=1`, nhanhGiong);
  }
  // Chuyển cảnh (ky_thuat.chuyen_canh có xfade, dien-anh.ts): shot trước MƯỢN ĐUÔI d giây (clip còn dư, thiếu thì giữ khung cuối), shot sau vẫn
  // bắt đầu đúng giây cũ và được xfade hoà vào trong d giây đó → giọng, chữ màn, nhạc, lớp phủ không lệch.
  const dsHinh = ds.filter(coHinh);
  const chuyenSau = new Map<number, { xfade: string; d: number }>();
  dsHinh.forEach((c, r) => {
    const ke = dsHinh[r + 1]; const x = ke && chuyenCanhGiua(c.ky_thuat?.chuyen_canh, giayPhat(c), giayPhat(ke), c.ky_thuat?.giay_cc);
    if (x) chuyenSau.set(c.id, { xfade: x.xfade, d: x.d });
  });
  const mocSeg: number[] = []; const xSeg: ({ xfade: string; d: number } | null)[] = [];
  const amShot: { am?: string[]; tu: number; phat: number }[] = [];
  // Rung / zoom cần tách luồng (crop không có timeline) → áp lên TỪNG ĐOẠN shot trước khi nối: chỉ xử lý vài giây của đoạn, bộ đệm nhỏ.
  // Áp sau khi nối (cả phim) thì hoặc crop+scale toàn phim cho mỗi lớp (>15 phút), hoặc nhánh cắt làm overlay giữ cả phim trong RAM (SIGKILL) — 12/10/2026.
  const NANG = (l: Lop) => l.loai === 'hieu_ung' && (l.hu === 'rung' || l.hu === 'zoom');
  const lopNang = o.chiThuTu?.length ? [] : (o.tap.lop ?? []).filter((l) => !l.an && l.den > l.tu && NANG(l));
  ds.forEach((c, i) => {
    const phat = giayPhat(c);
    const cs = chuyenSau.get(c.id) ?? null; const dai = phat + (cs?.d ?? 0);
    const vUrl = c.video_cuoi_url || c.video_url;
    const kUrl = c.keyframe_url;
    const nguon = vUrl && nl.has(vUrl) ? vUrl : kUrl && nl.has(kUrl) ? kUrl : null;
    if (!nguon) { canhThieu.push(`#${c.thu_tu} ${c.canh}`); return; }
    const laVideo = nguon === vUrl;
    const k = laVideo ? them(nguon) : them(nguon, ['-loop', '1', '-framerate', '30', '-t', so(dai)]);
    // Clip sinh từ keyframe khởi động chậm ~0,3–0,5s (đo: chuyển động 0,5–1 rồi mới lên 2,5–4,6) → cắt vào đó cảnh nào cũng như khựng.
    // Bỏ tối đa 0,5s đầu khi clip còn dư so với giây phát — cảnh mở ra giữa chuyển động như QC thật.
    const daiClip = laVideo ? nl.get(nguon)?.dai ?? null : null;
    const boDau = laVideo && daiClip ? Math.max(0, Math.min(0.5, daiClip - phat - 0.02)) : 0;
    // Đổi tốc (ky_thuat.toc_do, toc-do.ts): lấy đủ giây nguồn cho kế hoạch tốc rồi dựng lại thời gian bằng setpts từng đoạn.
    const toc = laVideo ? keHoachToc(c.ky_thuat?.toc_do, phat, dai, daiClip != null ? daiClip - boDau : 8) : null;
    const canNguon = toc ? toc.canVao : dai;
    const cuoiThat = laVideo ? Math.min(daiClip ?? boDau + canNguon, boDau + canNguon) : 0; const dem = laVideo ? Math.max(0, boDau + canNguon - cuoiThat) : 0;
    const dungClip = phatTiengClip(c, o.nhanVat);
    // CLIP NGẮN HƠN GIÂY PHÁT (giữ hình kết sau câu cuối, khớp giây theo giọng kéo dài shot): trước đây đứng hẳn khung cuối (tpad clone) — anh
    // 15/10/2026 phim #36: "khung cuối tự dưng bị dừng hẳn lại". Giờ: (1) phát CHẬM clip tới GIAN_TOI_DA× cho phủ phần thiếu — hình vẫn chuyển
    // động; (2) còn thiếu nữa mới giữ khung cuối, và khi đó cả shot đẩy máy chậm (dayMay) để khung đứng không chết. Shot đang phát tiếng gốc
    // của clip thì không làm chậm (tiếng sẽ lệch hình).
    const conLai = cuoiThat - boDau;
    const gian = laVideo && !toc && !dungClip && dem > 0.01 && conLai > 0.3 ? Math.min(GIAN_TOI_DA, (conLai + dem) / conLai) : 1;
    const demCon = laVideo ? Math.max(0, dem - conLai * (gian - 1)) : 0;
    const cham = gian > 1.25 || !!toc?.doan.some((d) => d.toc < 0.8);
    const ve: string[] = [laVideo ? `[${k}:v]trim=${so(boDau)}:${so(cuoiThat)},setpts=PTS-STARTPTS,${gian > 1.001 ? `setpts=${so(gian)}*PTS,` : ''}${toc ? `setpts='(${bieuThucToc(toc)})/TB',` : ''}${cham ? noiSuy : ''}${khung}${mauCanh.get(c.id) ? `,eq=brightness=${so(mauCanh.get(c.id)!)}` : ''}${lookShot(o.look, c.ky_thuat?.mau) ? `,${lookShot(o.look, c.ky_thuat?.mau)}` : ''}${demCon > 0.01 ? `,tpad=stop_mode=clone:stop_duration=${so(demCon)}${dayMay(dai)}` : ''}` : `[${k}:v]${khungTinh(i)},trim=0:${so(dai)},setpts=PTS-STARTPTS${dayMay(dai)}`];
    for (const d of doanHien(c.chu_man, phat, gopKieu(o.qc?.kieu_chu, c.kieu_chu).tu)) cauMan.push({ tu: t + d.tu, den: t + d.den, dong: d.dong, kieu: c.kieu_chu });
    if (logoUrl) { const kl = them(logoUrl, ['-loop', '1', '-framerate', '30', '-t', so(dai)]); loc.push(`[${kl}:v]scale=-1:${Math.round(H * 0.06)},format=rgba[lg${i}]`); ve[ve.length - 1] += `[vv${i}];[vv${i}][lg${i}]overlay=W-w-${Math.round(W * 0.03)}:${Math.round(H * 0.03)}:shortest=1`; }
    if (c.am_thanh_url && nl.has(c.am_thanh_url)) { const ka = them(c.am_thanh_url); themAm(`[${ka}:a]atrim=0:${so(phat)},asetpts=PTS-STARTPTS,volume=0.8,adelay=${Math.round(t * 1000)}:all=1`); }
    amShot.push({ am: c.ky_thuat?.am_thanh, tu: t, phat });
    lich.shot.push({ thu_tu: c.thu_tu, tu: t, den: t + phat });
    if (c.am_thanh_url) lich.co.push([t, t + phat]);
    if (laVideo && dungClip && !toc && nl.get(nguon)?.coAm) lich.co.push([t, t + phat]);
    // Tiếng clip đặt THEO GIỌNG (đo được) — clip ghi nhỏ không còn lọt thỏm dưới nhạc; chưa đo → giữ mức gốc.
    const lnClip = nl.get(nguon)?.lufs; const mucClip = lnClip != null && Number.isFinite(lnClip) && lnClip > -70 ? `,volume=${so(Math.max(-10, Math.min(18, LUFS_GIONG - LUFS_CLIP_DUOI_GIONG - lnClip)))}dB` : '';
    // Fade 40/60 ms hai đầu: tiếng clip bật/tắt cắt ngang ở điểm cắt nghe như tiếng "bụp".
    if (laVideo && dungClip && !toc && nl.get(nguon)?.coAm) themAm(`[${k}:a]atrim=${so(boDau)}:${so(boDau + phat)},asetpts=PTS-STARTPTS${mucClip},afade=t=in:d=0.04,afade=t=out:st=${so(Math.max(0, phat - 0.06))}:d=0.06,adelay=${Math.round(t * 1000)}:all=1`);
    const nangDoan = lopNang.filter((l) => l.tu < t + dai && l.den > t);
    if (!nangDoan.length) loc.push(`${ve.join(',')},settb=AVTB[v${i}]`);
    else {
      loc.push(`${ve.join(',')},settb=AVTB[s${i}x0]`);
      nangDoan.forEach((l, k) => loc.push(lopHieuUngLoc({ ...l, tu: Math.max(0, l.tu - t), den: Math.min(dai, l.den - t) }, W, H, `s${i}x${k}`, k === nangDoan.length - 1 ? `v${i}` : `s${i}x${k + 1}`, i * 100 + k)));
    }
    nhanhVideo.push(`[v${i}]`); mocSeg.push(t); xSeg.push(cs);
    t += phat;
  });
  // Tiếng hiệu ứng thật (sfx.ts): cùng lịch với timeline xem trước; mức đặt theo giọng (dbSfx) và còn NÉN DƯỚI GIỌNG khi giọng đang đọc
  // (nhanhSfx → sidechain bên dưới) — 12/10/2026 phim #9 tiếng đập/vút đầu shot đè mất câu đọc.
  const nhanhSfx: string[] = [];
  if (o.sfxDir) for (const m of lichSfx(amShot)) {
    lich.co.push([m.tu, m.tu + m.dai]);
    const k = themTep(`${o.sfxDir}/${m.key}.mp3`);
    themAm(`[${k}:a]${m.lap ? 'aloop=loop=-1:size=2147483647,' : ''}atrim=${so(m.bo)}:${so(m.bo + m.dai)},asetpts=PTS-STARTPTS,${m.lap ? `afade=t=in:d=0.15,afade=t=out:st=${so(Math.max(0, m.dai - 0.25))}:d=0.25,` : ''}volume=${m.db}dB,adelay=${Math.round(m.tu * 1000)}:all=1`, nhanhSfx);
  }
  // Nhạc: theo phân cảnh (khối shot liền nhau cùng phan_doan) nếu có, không thì một bài; lặp khi ngắn, nhỏ tiếng, fade hai đầu.
  const khoi: { ten: string; tu: number; dai: number }[] = [];
  { let tt = 0; for (const c of ds) { const l = khoi[khoi.length - 1]; const g = giayPhat(c); if (l && l.ten === c.phan_doan) l.dai += g; else khoi.push({ ten: c.phan_doan, tu: tt, dai: g }); tt += g; } }
  const nhacPc = khoi.filter((kh) => o.tap.nhac_phan_canh?.[kh.ten] && nl.has(o.tap.nhac_phan_canh[kh.ten]!));
  // Mức nhạc theo độ to ĐO ĐƯỢC của bài: nằm dưới giọng LUFS_NHAC_DUOI_GIONG dB (hệ số cố định thì bài to/nhỏ ra mức khác nhau). Bài chưa đo → 0,35.
  // QC mẫu Jett: dải trầm (nhạc) đứng ~-24 LUFS suốt phim, gần như không lùi dưới giọng (10/10/2026).
  // Bài nhạc tự kết (đoạn im ở cuối tệp) → cắt phần im TRƯỚC khi lặp, kẻo phim câm ở cuối (phim #5: bài 56s im từ 53,8s, phim câm 1,5s cuối).
  const nhac = (url: string, tu: number, dai: number) => { const k = them(url); const ic = nl.get(url)?.catDuoi; const ln = nl.get(url)?.lufs; const muc = ln != null && Number.isFinite(ln) && ln > -70 ? `volume=${so(Math.max(-30, Math.min(6, LUFS_GIONG - LUFS_NHAC_DUOI_GIONG - ln)))}dB` : 'volume=0.35'; themAm(`[${k}:a]${ic && ic > 2 ? `atrim=0:${so(ic)},asetpts=PTS-STARTPTS,` : ''}aloop=loop=-1:size=2147483647,atrim=0:${so(dai)},asetpts=PTS-STARTPTS,afade=t=in:d=0.6,afade=t=out:st=${so(Math.max(0, dai - 1.2))}:d=1.2,${muc},adelay=${Math.round(tu * 1000)}:all=1`, nhanhNhac); };
  if (nhacPc.length) for (const kh of nhacPc) nhac(o.tap.nhac_phan_canh[kh.ten]!, kh.tu, kh.dai);
  else if (o.tap.nhac_url && nl.has(o.tap.nhac_url)) nhac(o.tap.nhac_url, 0, t);
  // End card quảng cáo: 2 giây, tên + ưu đãi (từ mục 0) — người xem tới cuối có một màn đọc được để bấm.
  let giay = t;
  // Có QC mẫu → phần kết theo đúng mẫu (mẫu có end card riêng trong các shot) — không gắn thêm end card tự động.
  // Kịch bản tự kết bằng shot CTA / end card (vd short Astrolas 12/10/2026) cũng vậy: gắn thêm là hai màn kết chồng nhau, dài thêm 2s.
  // Shot cuối là "kết" khi phan_doan là loại QC (cta/end_card) HOẶC thuộc phân cảnh mang beat CTA / End card (phân cảnh tên tự do, 12/10/2026).
  const cuoi = ds[ds.length - 1]; const beatCuoi = o.tap.phan_canh?.find((x) => x.ten === cuoi?.phan_doan)?.beat ?? '';
  const ketRieng = ['cta', 'end_card'].includes(cuoi?.phan_doan ?? '') || /^(cta|end[\s_-]?card)$/i.test(beatCuoi.trim());
  if (o.loai === 'quang_cao' && o.qc?.uu_dai?.trim() && nhanhVideo.length && !o.chiThuTu?.length && !coMau(o.qc) && !ketRieng) {
    const dong = [...(o.qc.ten ? ngatDong(boChamCuoi(o.qc.ten), wrapMan) : []), ' ', ...ngatDong(boChamCuoi(o.qc.uu_dai), wrapMan)];
    // Có ảnh sản phẩm (mục 0) → end card = ảnh phủ kín, tối 45%, chữ ở 1/4 dưới (kiểu "FLASH SALE · SHOP NOW" đè lên ảnh sản phẩm); không có → nền tối, chữ giữa.
    const anhEnd = o.qc.anh?.[0] && nl.has(o.qc.anh[0]) ? o.qc.anh[0] : null;
    if (anhEnd) {
      const ke = them(anhEnd, ['-loop', '1', '-framerate', '30', '-t', '2']);
      loc.push(`[${ke}:v]${khung},trim=0:2,setpts=PTS-STARTPTS,colorlevels=rimax=0.55:gimax=0.55:bimax=0.55,${khoiChu('end', dong, fsMan, (n) => `h*0.78-${Math.round(n * fsMan * 1.25 / 2)}`, `borderw=${Math.round(fsMan / 14)}:bordercolor=black@0.85`, '')},settb=AVTB[vend]`);
    } else loc.push(`color=c=0x101014:s=${W}x${H}:d=2:r=30,format=yuv420p,${drawMan('end', dong, true)},settb=AVTB[vend]`);
    nhanhVideo.push('[vend]'); mocSeg.push(giay); xSeg.push(null); giay += 2;
  }
  if (!nhanhVideo.length) return { args: [], tep, giay: 0, canhThieu, canhBao };
  // Chữ màn vẽ MỘT lần trên cả video bằng libass (màu chữ/viền/nhấn số, font, đổi chữ theo giây) — thay drawtext từng shot.
  // Lớp phủ (kieu.ts › Lop): ảnh phủ bằng overlay ngay sau ghép hình; chữ/hình vào CÙNG tệp ASS với chữ màn (chữ màn lớp 100, nằm trên).
  // Xem từng shot (chiThuTu) thì bỏ lớp phủ — giây của lớp tính trên cả tập.
  const lop = o.chiThuTu?.length ? [] : (o.tap.lop ?? []).filter((l) => !l.an && l.den > l.tu && l.tu < giay);
  if (!xSeg.some(Boolean)) loc.push(`${nhanhVideo.join('')}concat=n=${nhanhVideo.length}:v=1:a=0[vcat]`);
  else {
    // Nối từng cặp: có chuyển cảnh → xfade tại giây bắt đầu của shot sau (dòng tích luỹ dài đúng mốc + d); không → concat.
    let acc = nhanhVideo[0]!;
    for (let j = 1; j < nhanhVideo.length; j++) {
      const x = xSeg[j - 1]; const ra = j === nhanhVideo.length - 1 ? '[vcat]' : `[vx${j}]`;
      loc.push(x ? `${acc}${nhanhVideo[j]}xfade=transition=${x.xfade}:duration=${so(x.d)}:offset=${so(mocSeg[j]!)}${ra}` : `${acc}${nhanhVideo[j]}concat=n=2:v=1:a=0${ra}`);
      acc = ra;
    }
  }
  let nen = 'vcat';
  lop.filter((l) => l.loai === 'anh' && l.url && nl.has(l.url)).forEach((l, i) => {
    const k = them(l.url!, ['-loop', '1', '-framerate', so(fpsRa), '-t', so(giay)]);
    loc.push(lopAnhLoc(l, k, W, H, nen, `vla${i}`)); nen = `vla${i}`;
  });
  // Lớp hiệu ứng khung (rung, chớp, zoom…) áp lên video + lớp ảnh, DƯỚI chữ/hình/chữ màn — chữ vẫn đọc được khi rung/mờ.
  lop.filter((l) => l.loai === 'hieu_ung' && !NANG(l)).forEach((l, i) => { loc.push(lopHieuUngLoc(l, W, H, nen, `vhu${i}`, i)); nen = `vhu${i}`; });
  const raHinh = o.nhipStopMotion ? 'vsm' : 'vout';
  const coAss = cauMan.length || lop.some((l) => l.loai === 'chu' || l.loai === 'hinh');
  if (coAss) {
    const ass = tepChu('chu', tepAss({ W, H, kieu: o.qc?.kieu_chu, viTri, cau: cauMan, lop })).replace(/\.txt$/, '.ass');
    tep[tep.length - 1]!.duong = ass;
    loc.push(`[${nen}]ass=filename='${duongFf(ass)}'${o.fontsDir ? `:fontsdir='${duongFf(o.fontsDir)}'` : ''}[${raHinh}]`);
  } else loc.push(`[${nen}]null[${raHinh}]`);
  if (o.nhipStopMotion) loc.push(`[${raHinh}]fps=12[vout]`);   // mỗi hình giữ hai nhịp, -r chuẩn phía sau nhân đôi khung
  // Ducking NHẸ (2:1, ngưỡng cao): nhạc chỉ lùi vài dB khi có giọng. Trước đây 6:1 ngưỡng 0,03 → giọng đọc dày làm nhạc bị nén gần như suốt phim,
  // dải trầm tụt -30/-42 LUFS so với -24/-27 của QC mẫu — nghe như mất nền (10/10/2026).
  const tron = (ds2: string[], ten: string) => { if (ds2.length === 1) { loc.push(`${ds2[0]}anull[${ten}]`); return `[${ten}]`; } loc.push(`${ds2.join('')}amix=inputs=${ds2.length}:normalize=0:dropout_transition=0[${ten}]`); return `[${ten}]`; };
  const tangAm: string[] = [];
  // Nhánh [gscx] (giọng làm khoá nén tiếng hiệu ứng) CHỈ tách khi có hiệu ứng — tách mà không dùng thì ffmpeg báo "output unconnected" và
  // không ra bản nào (phim #35 15/10/2026: giọng + nhạc, không SFX).
  const coSfx = nhanhSfx.length > 0;
  if (nhanhGiong.length && nhanhNhac.length) {
    // apad: sidechaincompress dừng theo luồng NGẮN hơn — không đệm thì nhạc bị cắt khi câu giọng cuối hết (phim #5: tiếng 53,8s / hình 55,5s).
    loc.push(`${tron(nhanhGiong, 'giong')}asplit=${coSfx ? 3 : 2}[gm][gsc0]${coSfx ? '[gsc1]' : ''};[gsc0]apad[gsc]${coSfx ? ';[gsc1]apad[gscx]' : ''}`);
    loc.push(`${tron(nhanhNhac, 'nhac')}[gsc]sidechaincompress=threshold=0.125:ratio=2:attack=30:release=400[nhacnen]`);
    tangAm.push('[gm]', '[nhacnen]');
  } else if (nhanhGiong.length) {
    if (coSfx) loc.push(`${tron(nhanhGiong, 'giong')}asplit=2[gm][gsc1];[gsc1]apad[gscx]`); else loc.push(`${tron(nhanhGiong, 'giong')}anull[gm]`);
    tangAm.push('[gm]');
  } else tangAm.push(...nhanhNhac);
  // Tiếng hiệu ứng nén MẠNH dưới giọng (3:1, ngưỡng thấp, nhả nhanh): câu đọc luôn rõ, giữa hai câu cú đập vẫn đủ lực.
  if (nhanhSfx.length && nhanhGiong.length) { loc.push(`${tron(nhanhSfx, 'sfx')}[gscx]sidechaincompress=threshold=0.05:ratio=3:attack=5:release=250[sfxnen]`); tangAm.push('[sfxnen]'); }
  else tangAm.push(...nhanhSfx);
  tangAm.push(...nhanhAm);
  if (tangAm.length) loc.push(`${tangAm.join('')}amix=inputs=${tangAm.length}:normalize=0:dropout_transition=0,atrim=0:${so(giay)},loudnorm=I=-14:TP=-1.5:LRA=11[aout]`);
  else loc.push(`anullsrc=r=48000:cl=stereo,atrim=0:${so(giay)}[aout]`);
  const kichBan = tepChu('loc', loc.join(';\n'));
  const args = ['-y', '-hide_banner', '-loglevel', 'error', ...dauVao, '-/filter_complex', kichBan, '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', so(fpsRa), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', so(giay), o.ra];
  return { args, tep, giay, canhThieu, canhBao, lich };
}

// MẪU MÁY DỰNG "Lồng tiếng giải thích trên cảnh" (dạng giai-thich-giong trong kho dạng bài — bước 6 Dạng × Góc × Sản phẩm, 30/10/2026;
// anh chọn giọng heygen turbo "Vincent" sau khi nghe hai mẫu: ~$0,0009–0,0018 / video ~450 ký tự, dưới ngưỡng tự chạy $0,01).
// MẪU CHUNG cho mọi ngách: đề = từ khoá VIDEO nền thật (theo góc) + câu móc + 3–6 câu lời dẫn + dòng kết. Giọng đọc lời dẫn sinh MỘT lần ở xuatVideo
// (giong-heygen.ts → de.giong_url / de.giong_giay, dựng lại không tốn lại). THUẦN: đề → ASS + lệnh ffmpeg.
// Phụ đề: mỗi câu lời dẫn hiện đúng quãng nó được đọc — chia thời lượng giọng theo số ký tự từng câu (giọng đọc đều, không cần dấu thời gian từng chữ).
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-giai-thich.test.mts
import { alpha, bo, chu, giayDoc, mauAss, nayVao, ngat, rapAss, thoatLoc, type DongAss } from './may-dung-ass';

export interface DeGiaiThich {
  truy: string;            // từ khoá VIDEO nền Pexels (tiếng Anh, theo góc)
  moc: string;             // câu móc ở đầu video (20–80 ký tự)
  loi: string[];           // 3–6 câu lời dẫn, tổng 200–550 ký tự — giọng đọc nguyên văn, phụ đề hiện từng câu
  ket?: string;            // dòng kết ngắn (≤ 60 ký tự), không link
  giong_url?: string;      // tệp giọng đã sinh (R2) — xuatVideo điền
  giong_giay?: number;     // thời lượng tệp giọng (giây) — xuatVideo điền
  giong_vnd?: number;      // tiền sinh giọng (VNĐ thật theo bảng giá fal) — xuatVideo điền
  /** MỖI CÂU MỘT CẢNH (anh 31/10/2026: "sao ko dùng videoexpress sinh video? nội dung nhìn nhàm chán"): cảnh i đi với câu loi[i].
   *  truy = ảnh thật Pexels làm khung đầu (xuatVideo lấy → anh); prompt = chỉ đạo chuyển động 4–6s cho VideoExpress (vx-may.mts trên iMac gửi → uuid → tải clip → vx = mp4 R2).
   *  Đủ vx cho mọi câu thì dựng bằng clip VideoExpress; chưa đủ thì xuatVideo báo "chờ clip" (không dựng bản nhàm). */
  canh?: { truy: string; prompt: string; anh?: string; uuid?: string; vx?: string }[];
}
export const FPS = 30, CHU_MOI_GIAY = 15, T_DAU = 0.6, DEM_CUOI = 1.2;
const W = 1080, H = 1920, TRANG = '#F4F6F8', VANG = '#FFD24A';
const EM = 1.25, fs = (px: number) => `\\fs${Math.round(px * EM)}`;

/** Thời lượng giọng: tệp thật nếu đã sinh, chưa có thì ước theo ký tự (15 ký tự / giây). */
export const giayGiong = (de: DeGiaiThich) => de.giong_giay ?? Math.max(4, de.loi.join(' ').length / CHU_MOI_GIAY);
/** Mốc: giọng bắt đầu ở T_DAU; mỗi câu chiếm phần thời gian theo số ký tự; dòng kết nằm sau giọng, đủ thời gian đọc. */
export function nhipGiaiThich(de: DeGiaiThich) {
  const G = giayGiong(de), tong = de.loi.reduce((n, c) => n + Math.max(1, c.length), 0);
  let t = T_DAU; const cau = de.loi.map((c) => { const d = (G * Math.max(1, c.length)) / tong, x = { chu: c, tu: t, den: t + d }; t += d; return x; });
  const HET_GIONG = T_DAU + G, ket = de.ket?.trim() ? de.ket.trim() : null;
  const DAI = HET_GIONG + (ket ? Math.max(2.5, giayDoc(ket) - 0.5) : DEM_CUOI);
  return { G, cau, HET_GIONG, ket, DAI };
}
export const anhGiaiThich = (de: DeGiaiThich): { t: number; cat: [number, number, number, number] }[] => [{ t: Math.min(2, nhipGiaiThich(de).HET_GIONG * 0.3), cat: [0, 240, 1080, 1440] }];

/** Hook ĐỦ CHỮ (31/10/2026: video #842 cắt mất chữ cuối vì cố định 3 dòng × 18 ký tự): ngắt hẹp chữ to; dài hơn 3 dòng thì ngắt rộng hơn + thu cỡ — KHÔNG bao giờ cắt. */
export function dongHook(moc: string): { dong: string[]; co: number } {
  const t = moc.trim();
  for (const [rong, co] of [[18, 84], [22, 72], [27, 60], [34, 50]] as const) { const dong = ngat(t, rong); if (dong.length <= 3) return { dong, co }; }
  return { dong: ngat(t, 34), co: 44 };
}
/** Phụ đề CỤM NGẮN (chuẩn short-form, anh 31/10/2026 "không có hook… nhàm"): mỗi câu chia cụm ≤ 4 từ, cụm đứng đúng quãng của nó (theo số ký tự). */
export function cumPhuDe(cau: { chu: string; tu: number; den: number }[], toiDa = 4): { chu: string; tu: number; den: number }[] {
  return cau.flatMap((c) => {
    const tu = c.chu.split(/\s+/).filter(Boolean), cum: string[] = [];
    for (let i = 0; i < tu.length; i += toiDa) cum.push(tu.slice(i, i + toiDa).join(' '));
    const tong = cum.reduce((n, x) => n + x.length, 0) || 1; let t = c.tu;
    return cum.map((x) => { const d = ((c.den - c.tu) * x.length) / tong, r = { chu: x, tu: t, den: t + d }; t += d; return r; });
  });
}
export function assGiaiThich(de: DeGiaiThich): string {
  const { cau, HET_GIONG, ket, DAI } = nhipGiaiThich(de), d: DongAss[] = [];
  // HOOK: chữ TO giữa màn, nảy vào, đứng hết câu đầu (giọng đọc đúng câu hook) — người xem biết ngay vì sao phải xem tiếp
  const { dong: moc, co: coMoc } = dongHook(de.moc), hetMoc = Math.max(2.2, cau[0]?.den ?? 2.2), yMoc = 820 - Math.round(coMoc * 0.65) * (moc.length - 1);
  d.push([1, 0, hetMoc, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.28)}\\fad(0,250)\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
  d.push([2, 0, hetMoc, 'Den', `{\\an8\\pos(540,${yMoc})${fs(coMoc)}\\1c${mauAss(VANG)}\\3c&H000000&\\bord5\\shad2\\q2${nayVao(70, 0, 0.35)}\\fad(0,250)}${moc.map(chu).join('\\N')}`]);
  // phụ đề cụm ngắn, chữ to, viền đậm, không hộp — từ sau câu hook
  for (const c of cumPhuDe(cau.slice(1))) d.push([2, c.tu, c.den, 'Den', `{\\an5\\pos(540,1340)${fs(66)}\\1c&HFFFFFF&\\3c&H000000&\\bord5\\shad2\\q2${nayVao(88, 0, 0.12)}}${chu(c.chu)}`]);
  if (ket) {
    d.push([3, HET_GIONG, DAI, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.5)}\\fad(400,0)\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
    // dòng kết = lời gọi hành động: cùng cỡ + màu vàng + nảy vào như hook (trước: chữ trắng 56 không viền, #842 nhìn nhạt và nhỏ)
    const { dong: dk, co: ck } = dongHook(ket);
    d.push([4, HET_GIONG, DAI, 'Den', `{\\an5\\pos(540,940)${fs(ck)}\\1c${mauAss(VANG)}\\3c&H000000&\\bord5\\shad2\\q2${nayVao(70, 0, 0.35)}\\fad(300,0)}${dk.map(chu).join('\\N')}`]);
  }
  return rapAss(W, H, d);
}

/** Lệnh ffmpeg: VIDEO nền thật lặp đủ dài, tối nhẹ → ass; tiếng = tệp giọng (bắt đầu T_DAU), không nhạc. Không có video nền hoặc tệp giọng thì DỪNG. */
/** Quãng hình của từng cảnh khi mỗi câu một clip: cảnh 0 từ 0 (gồm đệm đầu), cảnh cuối kéo tới hết video (gồm dòng kết). */
export function quangCanh(de: DeGiaiThich): { tu: number; den: number }[] {
  const { cau, DAI } = nhipGiaiThich(de);
  return cau.map((c, i) => ({ tu: i === 0 ? 0 : c.tu, den: i === cau.length - 1 ? DAI : c.den }));
}
export function lenhGiaiThich(o: { de: DeGiaiThich; ass: string; nen?: string | null; nenThem?: string[]; am?: string | null; fontsDir: string; ra: string; khung?: number }): string[] {
  const { DAI } = nhipGiaiThich(o.de), dai = Number(DAI.toFixed(2));
  // MỖI CÂU MỘT CLIP (VideoExpress): đủ clip cho mọi câu → mỗi clip lặp / cắt đúng quãng câu của nó rồi nối; không đủ → một video nền (cũ)
  const clip = o.nenThem?.length && o.nenThem.length === o.de.loi.length ? o.nenThem : null;
  const chinh = (v: string, d: number) => `${v}scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},eq=brightness=-0.06:saturation=1.05,trim=0:${d.toFixed(2)},setpts=PTS-STARTPTS`;
  const vao = clip ? clip.flatMap((f) => ['-stream_loop', '-1', '-i', f]) : (() => { if (!o.nen) throw new Error('mẫu giai-thich cần VIDEO nền thật (nen_url Pexels video) hoặc clip VideoExpress cho mọi câu'); return ['-stream_loop', '-1', '-i', o.nen]; })();
  const nen = clip ? `${quangCanh(o.de).map((q, i) => `${chinh(`[${i}:v]`, q.den - q.tu)}[c${i}]`).join(';')};${clip.map((_, i) => `[c${i}]`).join('')}concat=n=${clip.length}:v=1:a=0` : chinh('[0:v]', dai);
  const loc = `${nen},ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`;
  if (o.khung != null) return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, '-filter_complex', loc, '-map', '[v]', '-ss', String(o.khung), '-frames:v', '1', '-q:v', '3', o.ra];
  if (!o.am) throw new Error('mẫu giai-thich cần TỆP GIỌNG (de.giong_url — giong-heygen.ts) trước khi dựng');
  const iAm = clip ? clip.length : 1;
  const am = `[${iAm}:a]adelay=${Math.round(T_DAU * 1000)}|${Math.round(T_DAU * 1000)},apad,atrim=0:${dai},loudnorm=I=-16:TP=-1.5:LRA=11[a]`;
  return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, '-i', o.am,
    '-filter_complex', `${loc};${am}`, '-map', '[v]', '-map', '[a]', '-r', String(FPS), '-t', String(dai), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', o.ra];
}

export function kichBanGiaiThich(de: DeGiaiThich) {
  const { cau, HET_GIONG, ket, DAI } = nhipGiaiThich(de);
  const shots = [{ tu: 0, den: cau[0]?.den ?? 2.5, canh: 'Móc + câu đầu', hanh_dong: `Video thật "${de.truy}", móc "${de.moc}", giọng đọc câu 1.` },
    { tu: cau[0]?.den ?? 2.5, den: HET_GIONG, canh: 'Giải thích', hanh_dong: `Giọng đọc ${cau.length - 1} câu còn lại, phụ đề theo câu.` }];
  if (ket) shots.push({ tu: HET_GIONG, den: DAI, canh: 'Dòng kết', hanh_dong: ket });
  return { tom_tat: `Lồng tiếng giải thích · ${de.truy}`, shots };
}
export const truyVanGiaiThich = (de: DeGiaiThich) => de.truy;
/** Lời đọc gửi máy giọng: các câu nối bằng dấu cách. */
export const loiDoc = (de: DeGiaiThich) => de.loi.map((c) => c.trim()).filter(Boolean).join(' ');

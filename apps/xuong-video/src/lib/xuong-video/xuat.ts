// Bản xuất MP4 của một tập — phần THUẦN (không server-only): từ shot + nguyên liệu đã tải/đo → lệnh ffmpeg + các tệp chữ.
// Review 09/10/2026: studio chỉ "xem thử" trong trình duyệt, không có tệp nào gửi Meta/TikTok. Bản xuất làm đúng thứ timeline cho xem:
//   - mỗi shot phát đúng phat_s (cắt từ đầu clip), clip chưa có thì dùng keyframe tĩnh;
//   - giọng từng dòng thoại nối tiếp từ đầu shot, hiệu ứng từ đầu shot, tiếng sẵn của clip chỉ khi shot KHÔNG có tiếng riêng (cùng luật timeline);
//   - nhạc theo phân cảnh (ưu tiên) hoặc một bài cả tập, lặp nếu ngắn, nhỏ tiếng dưới giọng;
//   - trên hình CHỈ có chữ màn (chu_man, to ở 1/6 trên) — shot không có chữ màn thì không có chữ nào (anh chốt 09/10/2026, #1231); end card ưu đãi cho quảng cáo;
//   - chuẩn -14 LUFS, H.264 30fps, 1080×1920 (9:16) hoặc 1920×1080.
// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/xuat.test.mts
import type { Canh, KieuChu, LoaiPhim, NhanVat, Tap, ThongTinQc, ViTriChu } from './kieu';
import { giayPhat, locNhanh, doanChuMan, KIEU_CHU_MAC_DINH } from './kieu';
export { doanChuMan, chuManHien } from './kieu';
import { dongThoai, coTiengRieng } from './am-thanh';

/** Một tệp nguyên liệu đã tải về + đo: dai = giây (âm/video), coAm = clip có luồng tiếng. */
export type NguyenLieu = { url: string; duong: string; dai: number | null; coAm: boolean };
export type TepChu = { duong: string; noiDung: string };
export type KeHoachXuat = { args: string[]; tep: TepChu[]; giay: number; canhThieu: string[] };

/** URL cần tải cho một bản xuất (clip/keyframe, giọng, hiệu ứng, nhạc) — tải trước, đo rồi mới dựng lệnh. */
export function urlCanXuat(canh: Canh[], nhanVat: NhanVat[], tap: Pick<Tap, 'nhac_url' | 'nhac_phan_canh'>, nhanh?: string | null, qc?: ThongTinQc | null): string[] {
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
  return [...out];
}

/** Ngắt dòng cho drawtext: tham lam theo từ, tối đa `toiDa` ký tự một dòng. Mỗi dòng vẽ bằng MỘT drawtext riêng — ffmpeg 8 vẽ
 *  ký tự xuống dòng trong textfile thành ô vuông (thử trên box3 09/10/2026), nên không gộp nhiều dòng vào một textfile. */
export function ngatDong(chu: string, toiDa: number): string[] {
  const dong: string[] = []; let hien = '';
  for (const tu of chu.trim().split(/\s+/)) {
    if (!hien) hien = tu;
    else if ((hien + ' ' + tu).length <= toiDa) hien += ' ' + tu;
    else { dong.push(hien); hien = tu; }
  }
  if (hien) dong.push(hien);
  return dong;
}
const mauAss = (hex: string): string => { const h = (hex || '#FFFFFF').replace('#', '').padEnd(6, 'F').slice(0, 6); return `&H00${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`.toUpperCase(); };
const gioAss = (t: number): string => { const cs = Math.max(0, Math.round(t * 100)); const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60, c = cs % 100; return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`; };
/** Gộp kiểu chữ: mặc định ← phim ← shot (giá trị rỗng không đè). */
export const gopKieu = (...ds: (KieuChu | undefined | null)[]): typeof KIEU_CHU_MAC_DINH & { y?: number; nen?: string } =>
  Object.assign({}, KIEU_CHU_MAC_DINH, ...ds.map((d) => Object.fromEntries(Object.entries(d ?? {}).filter(([, v]) => v !== '' && v != null))));
/** Tệp ASS (libass) cho chữ màn cả bản xuất. Mỗi kiểu chữ khác nhau (phim + shot) là một Style; mỗi câu một Dialogue đặt giữa ngang,
 *  dọc theo y của kiểu hoặc vị trí phim. "**chữ**" = đoạn nhấn: to gấp 1,8, nghiêng, màu nhấn (kiểu "YES!" của QC mẫu).
 *  nen = băng nền đặc sau chữ (BorderStyle 3). */
export function tepAss(o: { W: number; H: number; kieu?: KieuChu; viTri: ViTriChu; cau: { tu: number; den: number; dong: string[]; kieu?: KieuChu }[] }): string {
  const kieuStyle = new Map<string, { ten: string; k: ReturnType<typeof gopKieu> }>();
  const style = (kc?: KieuChu) => {
    const k = gopKieu(o.kieu, kc); const khoa = JSON.stringify(k);
    if (!kieuStyle.has(khoa)) kieuStyle.set(khoa, { ten: kieuStyle.size ? `Man${kieuStyle.size}` : 'Man', k });
    return kieuStyle.get(khoa)!;
  };
  const su = o.cau.map((c) => {
    const { ten, k } = style(c.kieu);
    const fs = Math.round(o.W * k.co);
    // Bề rộng một ký tự ≈ 0,4 × cỡ ASS × độ rộng chữ (đo 10/10/2026: "PAY 1 GET 3 PANTS" Montserrat Black cỡ 0,13W, ngang 86% phủ 75% khung).
    const wrap = Math.max(8, Math.floor((o.W * 0.92) / (fs * 0.4 * (k.ngang / 100))));
    const tamY = (n: number) => Math.round(typeof k.y === 'number' ? o.H * k.y : o.viTri === 'giua' ? o.H / 2 : o.viTri === 'duoi' ? o.H * 0.62 : o.H * 0.15 + (n * fs * 1.25) / 2);
    const nhan = (t: string) => (k.nhan ? t.replace(/[0-9?$%]+/g, (m) => `{\\c${mauAss(k.nhan)}}${m}{\\c${mauAss(k.mau)}}`) : t);
    const to = (t: string) => t.replace(/\*\*(.+?)\*\*/g, (_, m: string) => `{\\fs${Math.round(fs * 1.8)}\\i1\\c${mauAss(k.nhan || k.mau)}}${m}{\\r}`);
    const dong = c.dong.flatMap((d) => (/\*\*/.test(d) ? [d] : ngatDong(d, wrap))).map((d) => d.replace(/[{}\\]/g, ''));
    return `Dialogue: 0,${gioAss(c.tu)},${gioAss(c.den)},${ten},,0,0,0,,{\\an5\\pos(${Math.round(o.W / 2)},${tamY(dong.length)})}${dong.map((d) => to(nhan(d))).join('\\N')}`;
  });
  const dong = ['[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${o.W}`, `PlayResY: ${o.H}`, 'ScaledBorderAndShadow: yes', 'WrapStyle: 2', '',
    '[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ...[...kieuStyle.values()].map(({ ten, k }) => { const fs = Math.round(o.W * k.co); return `Style: ${ten},${k.font},${fs},${mauAss(k.mau)},${mauAss(k.mau)},${mauAss(k.nen || k.vien)},&H80000000&,-1,0,0,0,${k.ngang},100,0,0,${k.nen ? 3 : 1},${k.nen ? Math.round(fs * 0.35) : Math.max(1, Math.round(fs * k.vien_day))},0,5,0,0,0,1`; }),
    '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text', ...su, ''];
  return dong.join('\n');
}
// drawtext expansion=none: '%' trong chữ ("giảm 70%") không bị hiểu là lệnh %{…} — thử '%%' trên ffmpeg 8 vẫn báo "Stray %" và end card ra đen.
const so = (x: number) => (Math.round(x * 1000) / 1000).toString();
/** Đường dẫn trong filter ffmpeg: thoát ':' '\' và dấu nháy. */
const duongFf = (p: string) => p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");

export function keHoachXuat(o: {
  loai: LoaiPhim; tiLe: string; canh: Canh[]; nhanVat: NhanVat[]; tap: Pick<Tap, 'nhac_url' | 'nhac_phan_canh'>; qc?: ThongTinQc | null;
  nhanh?: string | null; nguyenLieu: NguyenLieu[]; font: string; thuMuc: string; ra: string;
  /** thư mục font cho libass (assets/fonts); chiThuTu = chỉ xuất các shot này (xem thử từng shot, không end card). */
  fontsDir?: string; chiThuTu?: number[];
}): KeHoachXuat {
  const doc = o.tiLe !== '16:9';
  const W = doc ? 1080 : 1920, H = doc ? 1920 : 1080;
  const ds = locNhanh(o.canh, o.nhanh).slice().sort((a, b) => a.thu_tu - b.thu_tu).filter((c) => !o.chiThuTu?.length || o.chiThuTu.includes(c.thu_tu));
  const nl = new Map(o.nguyenLieu.map((x) => [x.url, x]));
  const dauVao: string[] = [];           // tham số -i theo thứ tự chỉ số
  const chiSo = new Map<string, number>();
  let soDauVao = 0;
  const them = (url: string, truoc: string[] = []): number => {
    const k = `${truoc.join(' ')} ${url}`;
    if (chiSo.has(k)) return chiSo.get(k)!;
    dauVao.push(...truoc, '-i', nl.get(url)!.duong); chiSo.set(k, soDauVao); return soDauVao++;
  };
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
  const khung = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30,format=yuv420p`;
  // Ảnh tĩnh: đặt VỪA khung + nền là chính ảnh phóng mờ — ảnh vuông thật của shop (lưới review, ảnh sản phẩm) không bị cắt mất hai bên;
  // keyframe đã 9:16 thì vừa khít, nền mờ không lộ (09/10/2026, dùng ảnh thật Orabra cho shot bằng chứng + end card).
  const khungTinh = (i: number) => `split=2[nb${i}][nf${i}];[nb${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:2[nbb${i}];[nf${i}]scale=${W}:${H}:force_original_aspect_ratio=decrease[nff${i}];[nbb${i}][nff${i}]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=30,format=yuv420p`;

  const loc: string[] = [];
  const nhanhVideo: string[] = [];
  const nhanhAm: string[] = [];
  const canhThieu: string[] = [];
  let t = 0; let soAm = 0;
  const cauMan: { tu: number; den: number; dong: string[]; kieu?: KieuChu }[] = [];
  const themAm = (bieuThuc: string) => { const nhan = `a${soAm++}`; loc.push(`${bieuThuc},aformat=sample_rates=48000:channel_layouts=stereo[${nhan}]`); nhanhAm.push(`[${nhan}]`); };
  ds.forEach((c, i) => {
    const phat = giayPhat(c);
    const vUrl = c.video_cuoi_url || c.video_url;
    const kUrl = c.keyframe_url;
    const nguon = vUrl && nl.has(vUrl) ? vUrl : kUrl && nl.has(kUrl) ? kUrl : null;
    if (!nguon) { canhThieu.push(`#${c.thu_tu} ${c.canh}`); return; }
    const laVideo = nguon === vUrl;
    const k = laVideo ? them(nguon) : them(nguon, ['-loop', '1', '-framerate', '30', '-t', so(phat)]);
    const ve: string[] = [laVideo ? `[${k}:v]trim=0:${so(phat)},setpts=PTS-STARTPTS,${khung}` : `[${k}:v]${khungTinh(i)},trim=0:${so(phat)},setpts=PTS-STARTPTS`];
    for (const d of doanChuMan(c.chu_man, phat)) cauMan.push({ tu: t + d.tu, den: t + d.den, dong: d.dong, kieu: c.kieu_chu });
    if (logoUrl) { const kl = them(logoUrl, ['-loop', '1', '-framerate', '30', '-t', so(phat)]); loc.push(`[${kl}:v]scale=-1:${Math.round(H * 0.06)},format=rgba[lg${i}]`); ve[ve.length - 1] += `[vv${i}];[vv${i}][lg${i}]overlay=W-w-${Math.round(W * 0.03)}:${Math.round(H * 0.03)}:shortest=1`; }
    // Giọng từng dòng nối tiếp nhau trong shot (theo độ dài file giọng; chưa có giọng thì chia đều giây phát để giữ nhịp).
    const dong = dongThoai(c, o.nhanVat);
    let tDong = 0;
    const tiengRieng = coTiengRieng(c, o.nhanVat);
    dong.forEach((d) => {
      const daiGiong = d.url && nl.get(d.url)?.dai ? nl.get(d.url)!.dai! : phat / dong.length;
      if (typeof d.tre === 'number' && d.tre > tDong) tDong = Math.min(d.tre, Math.max(0, phat - 0.2));
      // Giọng dài hơn phần còn lại của shot → đọc nhanh lên (tối đa 1,35×, nghe vẫn tự nhiên) để giữ nhịp như QC mẫu thay vì bị cắt cụt
      // (10/10/2026: "Pay one, get three pants." TTS 1,96s, mẫu đọc 1,3s trong shot 2s).
      const conLai = Math.max(0.2, phat - tDong);
      // Lời dẫn (không người nói) = dải giọng đọc liên tục như QC mẫu: đọc TRỌN câu, vắt qua shot sau, không cắt không tăng tốc.
      const loiDan = !d.nhan_vat.trim();
      const nhanh = !loiDan && d.url && nl.get(d.url)?.dai && daiGiong > conLai + 0.05 ? Math.min(1.35, daiGiong / conLai) : 1;
      if (d.url && nl.has(d.url)) { const ka = them(d.url); themAm(`[${ka}:a]${nhanh > 1.001 ? `atempo=${so(nhanh)},` : ''}${loiDan ? '' : `atrim=0:${so(conLai + 0.3)},`}asetpts=PTS-STARTPTS,adelay=${Math.round((t + tDong) * 1000)}:all=1`); }
      tDong += daiGiong / nhanh + 0.15;
    });
    if (c.am_thanh_url && nl.has(c.am_thanh_url)) { const ka = them(c.am_thanh_url); themAm(`[${ka}:a]atrim=0:${so(phat)},asetpts=PTS-STARTPTS,volume=0.8,adelay=${Math.round(t * 1000)}:all=1`); }
    if (laVideo && !tiengRieng && nl.get(nguon)?.coAm) themAm(`[${k}:a]atrim=0:${so(phat)},asetpts=PTS-STARTPTS,adelay=${Math.round(t * 1000)}:all=1`);
    loc.push(`${ve.join(',')}[v${i}]`); nhanhVideo.push(`[v${i}]`);
    t += phat;
  });
  // Nhạc: theo phân cảnh (khối shot liền nhau cùng phan_doan) nếu có, không thì một bài; lặp khi ngắn, nhỏ tiếng, fade hai đầu.
  const khoi: { ten: string; tu: number; dai: number }[] = [];
  { let tt = 0; for (const c of ds) { const l = khoi[khoi.length - 1]; const g = giayPhat(c); if (l && l.ten === c.phan_doan) l.dai += g; else khoi.push({ ten: c.phan_doan, tu: tt, dai: g }); tt += g; } }
  const nhacPc = khoi.filter((kh) => o.tap.nhac_phan_canh?.[kh.ten] && nl.has(o.tap.nhac_phan_canh[kh.ten]!));
  const nhac = (url: string, tu: number, dai: number) => { const k = them(url); themAm(`[${k}:a]aloop=loop=-1:size=2147483647,atrim=0:${so(dai)},asetpts=PTS-STARTPTS,afade=t=in:d=0.6,afade=t=out:st=${so(Math.max(0, dai - 1.2))}:d=1.2,volume=0.22,adelay=${Math.round(tu * 1000)}:all=1`); };
  if (nhacPc.length) for (const kh of nhacPc) nhac(o.tap.nhac_phan_canh[kh.ten]!, kh.tu, kh.dai);
  else if (o.tap.nhac_url && nl.has(o.tap.nhac_url)) nhac(o.tap.nhac_url, 0, t);
  // End card quảng cáo: 2 giây, tên + ưu đãi (từ mục 0) — người xem tới cuối có một màn đọc được để bấm.
  let giay = t;
  if (o.loai === 'quang_cao' && o.qc?.uu_dai?.trim() && nhanhVideo.length && !o.chiThuTu?.length) {
    const dong = [...(o.qc.ten ? ngatDong(o.qc.ten, wrapMan) : []), ' ', ...ngatDong(o.qc.uu_dai, wrapMan)];
    // Có ảnh sản phẩm (mục 0) → end card = ảnh phủ kín, tối 45%, chữ ở 1/4 dưới (kiểu "FLASH SALE · SHOP NOW" đè lên ảnh sản phẩm); không có → nền tối, chữ giữa.
    const anhEnd = o.qc.anh?.[0] && nl.has(o.qc.anh[0]) ? o.qc.anh[0] : null;
    if (anhEnd) {
      const ke = them(anhEnd, ['-loop', '1', '-framerate', '30', '-t', '2']);
      loc.push(`[${ke}:v]${khung},trim=0:2,setpts=PTS-STARTPTS,colorlevels=rimax=0.55:gimax=0.55:bimax=0.55,${khoiChu('end', dong, fsMan, (n) => `h*0.78-${Math.round(n * fsMan * 1.25 / 2)}`, `borderw=${Math.round(fsMan / 14)}:bordercolor=black@0.85`, '')}[vend]`);
    } else loc.push(`color=c=0x101014:s=${W}x${H}:d=2:r=30,format=yuv420p,${drawMan('end', dong, true)}[vend]`);
    nhanhVideo.push('[vend]'); giay += 2;
  }
  if (!nhanhVideo.length) return { args: [], tep, giay: 0, canhThieu };
  // Chữ màn vẽ MỘT lần trên cả video bằng libass (màu chữ/viền/nhấn số, font, đổi chữ theo giây) — thay drawtext từng shot.
  if (cauMan.length) {
    const ass = tepChu('chu', tepAss({ W, H, kieu: o.qc?.kieu_chu, viTri, cau: cauMan })).replace(/\.txt$/, '.ass');
    tep[tep.length - 1]!.duong = ass;
    loc.push(`${nhanhVideo.join('')}concat=n=${nhanhVideo.length}:v=1:a=0[vcat]`);
    loc.push(`[vcat]ass=filename='${duongFf(ass)}'${o.fontsDir ? `:fontsdir='${duongFf(o.fontsDir)}'` : ''}[vout]`);
  } else loc.push(`${nhanhVideo.join('')}concat=n=${nhanhVideo.length}:v=1:a=0[vout]`);
  if (nhanhAm.length) loc.push(`${nhanhAm.join('')}amix=inputs=${nhanhAm.length}:normalize=0:dropout_transition=0,atrim=0:${so(giay)},loudnorm=I=-14:TP=-1.5:LRA=11[aout]`);
  else loc.push(`anullsrc=r=48000:cl=stereo,atrim=0:${so(giay)}[aout]`);
  const kichBan = tepChu('loc', loc.join(';\n'));
  const args = ['-y', '-hide_banner', '-loglevel', 'error', ...dauVao, '-/filter_complex', kichBan, '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', so(giay), o.ra];
  return { args, tep, giay, canhThieu };
}

// Bản xuất MP4 của một tập — phần THUẦN (không server-only): từ shot + nguyên liệu đã tải/đo → lệnh ffmpeg + các tệp chữ.
// Review 09/10/2026: studio chỉ "xem thử" trong trình duyệt, không có tệp nào gửi Meta/TikTok. Bản xuất làm đúng thứ timeline cho xem:
//   - mỗi shot phát đúng phat_s (cắt từ đầu clip), clip chưa có thì dùng keyframe tĩnh;
//   - giọng từng dòng thoại nối tiếp từ đầu shot, hiệu ứng từ đầu shot, tiếng sẵn của clip chỉ khi shot KHÔNG có tiếng riêng (cùng luật timeline);
//   - nhạc theo phân cảnh (ưu tiên) hoặc một bài cả tập, lặp nếu ngắn, nhỏ tiếng dưới giọng;
//   - chữ màn (chu_man) to ở 1/6 trên, phụ đề thoại ở 3/4 dưới (trong vùng an toàn 9:16), end card ưu đãi cho quảng cáo;
//   - chuẩn -14 LUFS, H.264 30fps, 1080×1920 (9:16) hoặc 1920×1080.
// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/xuat.test.mts
import type { Canh, LoaiPhim, NhanVat, Tap, ThongTinQc } from './kieu';
import { giayPhat, locNhanh } from './kieu';
import { dongThoai, coTiengRieng } from './am-thanh';

/** Một tệp nguyên liệu đã tải về + đo: dai = giây (âm/video), coAm = clip có luồng tiếng. */
export type NguyenLieu = { url: string; duong: string; dai: number | null; coAm: boolean };
export type TepChu = { duong: string; noiDung: string };
export type KeHoachXuat = { args: string[]; tep: TepChu[]; giay: number; canhThieu: string[] };

/** URL cần tải cho một bản xuất (clip/keyframe, giọng, hiệu ứng, nhạc) — tải trước, đo rồi mới dựng lệnh. */
export function urlCanXuat(canh: Canh[], nhanVat: NhanVat[], tap: Pick<Tap, 'nhac_url' | 'nhac_phan_canh'>, nhanh?: string | null): string[] {
  const ds = locNhanh(canh, nhanh);
  const out = new Set<string>();
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
/** Chữ trong textfile của drawtext: '%' mở chuỗi lệnh %{…} (end card "giảm 70%" ra đen thui) → thoát thành '%%'. */
const chuFf = (t: string) => t.replace(/%/g, '%%');
const so = (x: number) => (Math.round(x * 1000) / 1000).toString();
/** Đường dẫn trong filter ffmpeg: thoát ':' '\' và dấu nháy. */
const duongFf = (p: string) => p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");

export function keHoachXuat(o: {
  loai: LoaiPhim; tiLe: string; canh: Canh[]; nhanVat: NhanVat[]; tap: Pick<Tap, 'nhac_url' | 'nhac_phan_canh'>; qc?: ThongTinQc | null;
  nhanh?: string | null; nguyenLieu: NguyenLieu[]; font: string; thuMuc: string; ra: string;
}): KeHoachXuat {
  const doc = o.tiLe !== '16:9';
  const W = doc ? 1080 : 1920, H = doc ? 1920 : 1080;
  const ds = locNhanh(o.canh, o.nhanh).slice().sort((a, b) => a.thu_tu - b.thu_tu);
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
  const fsMan = Math.round(W * (doc ? 0.062 : 0.04)), fsPd = Math.round(W * (doc ? 0.042 : 0.028));
  const wrapMan = doc ? 20 : 36, wrapPd = doc ? 32 : 50;
  const font = duongFf(o.font);
  // Khối chữ nhiều dòng = nhiều drawtext, dòng i ở y = gốc + i·(cỡ chữ × 1,25); gốc tính theo tỉ lệ chiều cao (vùng an toàn 9:16) hoặc giữa màn.
  const khoiChu = (ten: string, dong: string[], fs: number, goc: (n: number) => string, them: string, chiBo: string) =>
    dong.map((d, i) => `drawtext=fontfile='${font}':textfile='${duongFf(tepChu(`${ten}_${i}`, chuFf(d)))}':fontsize=${fs}:fontcolor=white:${them}:x=(w-text_w)/2:y=${goc(dong.length)}+${Math.round(i * fs * 1.25)}${chiBo}`).join(',');
  const drawMan = (ten: string, dong: string[], giua = false) => khoiChu(ten, dong, fsMan, (n) => (giua ? `(h-${Math.round(n * fsMan * 1.25)})/2` : 'h*0.15'), `borderw=${Math.round(fsMan / 14)}:bordercolor=black@0.85`, '');
  const drawPd = (ten: string, dong: string[], tu: number, den: number) => khoiChu(ten, dong, fsPd, () => 'h*0.74', `box=1:boxcolor=black@0.55:boxborderw=${Math.round(fsPd / 3)}`, `:enable='between(t,${so(tu)},${so(den)})'`);
  const khung = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30,format=yuv420p`;

  const loc: string[] = [];
  const nhanhVideo: string[] = [];
  const nhanhAm: string[] = [];
  const canhThieu: string[] = [];
  let t = 0; let soAm = 0;
  const themAm = (bieuThuc: string) => { const nhan = `a${soAm++}`; loc.push(`${bieuThuc},aformat=sample_rates=48000:channel_layouts=stereo[${nhan}]`); nhanhAm.push(`[${nhan}]`); };
  ds.forEach((c, i) => {
    const phat = giayPhat(c);
    const vUrl = c.video_cuoi_url || c.video_url;
    const kUrl = c.keyframe_url;
    const nguon = vUrl && nl.has(vUrl) ? vUrl : kUrl && nl.has(kUrl) ? kUrl : null;
    if (!nguon) { canhThieu.push(`#${c.thu_tu} ${c.canh}`); return; }
    const laVideo = nguon === vUrl;
    const k = laVideo ? them(nguon) : them(nguon, ['-loop', '1', '-framerate', '30', '-t', so(phat)]);
    const ve: string[] = [laVideo ? `[${k}:v]trim=0:${so(phat)},setpts=PTS-STARTPTS,${khung}` : `[${k}:v]${khung},trim=0:${so(phat)},setpts=PTS-STARTPTS`];
    if (c.chu_man.trim()) ve.push(drawMan(`man_${i}`, ngatDong(c.chu_man, wrapMan)));
    // Phụ đề: theo độ dài file giọng từng dòng (nối tiếp), chưa có giọng thì chia đều giây phát.
    const dong = dongThoai(c, o.nhanVat);
    let tDong = 0;
    const tiengRieng = coTiengRieng(c, o.nhanVat);
    dong.forEach((d, j) => {
      const daiGiong = d.url && nl.get(d.url)?.dai ? nl.get(d.url)!.dai! : phat / dong.length;
      const tu = tDong, den = Math.min(phat, tDong + daiGiong);
      if (den > tu) ve.push(drawPd(`pd_${i}_${j}`, ngatDong(d.loi, wrapPd), tu, den));
      if (d.url && nl.has(d.url)) { const ka = them(d.url); themAm(`[${ka}:a]atrim=0:${so(Math.max(0.2, phat - tDong + 0.3))},asetpts=PTS-STARTPTS,adelay=${Math.round((t + tDong) * 1000)}:all=1`); }
      tDong += daiGiong + 0.15;
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
  if (o.loai === 'quang_cao' && o.qc?.uu_dai?.trim() && nhanhVideo.length) {
    const dong = [...(o.qc.ten ? ngatDong(o.qc.ten, wrapMan) : []), ' ', ...ngatDong(o.qc.uu_dai, wrapMan)];
    loc.push(`color=c=0x101014:s=${W}x${H}:d=2:r=30,format=yuv420p,${drawMan('end', dong, true)}[vend]`);
    nhanhVideo.push('[vend]'); giay += 2;
  }
  if (!nhanhVideo.length) return { args: [], tep, giay: 0, canhThieu };
  loc.push(`${nhanhVideo.join('')}concat=n=${nhanhVideo.length}:v=1:a=0[vout]`);
  if (nhanhAm.length) loc.push(`${nhanhAm.join('')}amix=inputs=${nhanhAm.length}:normalize=0:dropout_transition=0,atrim=0:${so(giay)},loudnorm=I=-14:TP=-1.5:LRA=11[aout]`);
  else loc.push(`anullsrc=r=48000:cl=stereo,atrim=0:${so(giay)}[aout]`);
  const kichBan = tepChu('loc', loc.join(';\n'));
  const args = ['-y', '-hide_banner', '-loglevel', 'error', ...dauVao, '-/filter_complex', kichBan, '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', so(giay), o.ra];
  return { args, tep, giay, canhThieu };
}

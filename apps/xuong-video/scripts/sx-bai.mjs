#!/usr/bin/env node
// LÕI LÀM BÀI của MÁY SẢN XUẤT (anh 11/11/2026) — MỖI DẠNG BÀI MỘT HÀM, đúng khuôn dang-br.mjs của máy đăng.
// Sổ dạng bài: apps/xuong-video/kieu-sx.json. Thêm dạng = một dòng sổ + một hàm ở bảng LAM dưới cùng; sx-may.mjs --tu-kiem đỏ nếu lệch.
// Hàm nhận `de` (đề bài) và trả { video_url?, anh?: string[], vnd } — KHÔNG tự ghi cơ sở dữ liệu, KHÔNG tự đăng (điều phối lo).
//   de = { slug, may, phim, phimTen, huong, title, description, binh_luan }
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const BOX = 'root@167.233.241.16';
const KHO = `${process.env.HOME}/.cache/sx-may`;      // tập phim tải về + bản dựng (KHÔNG để scratchpad: /private/tmp bị macOS xoá khi khởi động lại)
// Tự định vị theo CHÍNH TỆP NÀY, không ghép tên repo bằng tay (11/11/2026: ghép thừa một tầng → "No such file").
const TOI = path.dirname(new URL(import.meta.url).pathname);
const chay = (l, a, o = {}) => execFileSync(l, a, { encoding: 'utf8', timeout: 900_000, ...o });

/** Tải tập miễn phí của phim về kho (một lần cho mỗi phim) → thư mục chứa tap01.mp4… Dùng chính tai-tap.py đang có. */
export function taiTap(contentId, urlPhim) {
  const ra = `${KHO}/phim-${contentId}`;
  if (existsSync(`${ra}/tap01.mp4`)) return ra;
  if (!urlPhim) throw new Error(`phim ${contentId} chưa có link trang phim để tải tập`);
  mkdirSync(ra, { recursive: true });
  chay('python3', [path.join(TOI, 'ethopex', 'tai-tap.py'), urlPhim, ra, '2']);
  if (!existsSync(`${ra}/tap01.mp4`)) throw new Error(`tai-tap.py không lấy được tập nào của phim ${contentId}`);
  return ra;
}

/** TỪ MIỆT THỊ riêng của Page persona (11/11/2026: lượt đầu cắt trúng câu "let's see this cripple eat shit"). Cổng thoại chung
 *  ethopex/kiem-thoai.py chặn được "shit" nhưng KHÔNG chặn từ miệt thị người khuyết tật / chủng tộc / giới — danh sách đó là của Ethopex
 *  (đổi là đổi luôn creative đang chạy), nên bộ bổ sung nằm ở đây, chỉ áp cho Máy SX. */
export const MIET_THI = /\b(cripple[sd]?|retard(ed|s)?|spaz|midget|gimp|tranny|fag(got)?s?|n[i1]gg\w*|chinks?|spics?|wetbacks?)\b/i;

/** ĐỌC PHỤ ĐỀ CHÁY TRONG HÌNH, mỗi giây một dòng — DÙNG LẠI ethopex/kiem-thoai.py (doc-chu.swift = Vision macOS, 0₫; có sẵn <tệp>.chu.json thì đọc luôn)
 *  và cổng `soat` của nó (từ tục / bạo lực / tình dục / CTA dụ nhấp). Ghi lại <tệp>.chu.json để lượt sau và kiem-thoai dùng chung. → [{ s, chu, cam }] */
export function docPhuDe(tep) {
  const py = `
import importlib.util as u, json, os, subprocess, sys
s = u.spec_from_file_location("k", ${JSON.stringify(path.join(TOI, 'ethopex', 'kiem-thoai.py'))}); k = u.module_from_spec(s); s.loader.exec_module(k)
tep = ${JSON.stringify(tep)}
dur = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",tep],capture_output=True,text=True).stdout.strip())
ds = k.doc(tep, 0, int(dur))
f = os.path.splitext(tep)[0] + ".chu.json"
if not os.path.exists(f): json.dump({str(int(t)): c for t, c in ds}, open(f, "w"), ensure_ascii=False)
print(json.dumps([{"s": int(t), "chu": c or "", "cam": k.soat(c or "")} for t, c in ds], ensure_ascii=False))
`;
  const ds = JSON.parse(execFileSync('python3', ['-c', py], { encoding: 'utf8', timeout: 1_800_000, maxBuffer: 1 << 26 }).trim().split('\n').pop());
  return ds.map((x) => ({ ...x, cam: x.cam || (MIET_THI.exec(x.chu)?.[0] ?? null) }));
}

/** RMS từng giây của tiếng (PCM 8 kHz một lượt) — điểm "cao trào" phụ: chỗ quát / khóc / nhạc dồn to hơn. */
function doTo(tep) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', tep, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  const mau = 8000, soGiay = Math.floor(raw.length / 2 / mau), rms = [];
  for (let s = 0; s < soGiay; s++) { let t = 0; for (let i = s * mau; i < (s + 1) * mau; i++) { const v = raw.readInt16LE(i * 2); t += v * v; } rms.push(Math.sqrt(t / mau)); }
  return rms;
}

/** CÁC ĐOẠN SẠCH: cửa sổ `giay` giây không giây nào dính từ cấm (cổng thoại chung + MIET_THI), bỏ 20% đầu / 8% cuối tập;
 *  xếp theo độ to, giữ tối đa `toiDa` đoạn cách nhau ≥ 6 giây. Thuần — tự kiểm được không cần video. */
export function doanSach(rms, chu, giay = 9, toiDa = 10) {
  const n = rms.length, cam = new Set(chu.filter((x) => x.cam).map((x) => x.s)), chuCua = new Map(chu.map((x) => [x.s, x.chu]));
  const tu = Math.floor(n * 0.2), den = Math.floor(n * 0.92) - giay, ds = [];
  for (let s = tu; s <= den; s++) {
    let sach = true; for (let i = s; i < s + giay; i++) if (cam.has(i)) { sach = false; break; }
    if (!sach) continue;
    ds.push({ bat_dau: s, diem: rms.slice(s, s + giay).reduce((a, b) => a + b, 0) / giay,
      chu: [...new Set(Array.from({ length: giay }, (_, i) => (chuCua.get(s + i) ?? '').trim()).filter(Boolean))].join(' / ') });
  }
  ds.sort((a, b) => b.diem - a.diem);
  const ra = []; for (const d of ds) { if (ra.every((x) => Math.abs(x.bat_dau - d.bat_dau) >= 6)) ra.push(d); if (ra.length >= toiDa) break; }
  return ra;
}

/** CHỌN 9 GIÂY (11/11/2026, thay bản chỉ đo độ to — bản đó cắt ra cảnh SAI HƯỚNG và dính thoại miệt thị):
 *  1. đọc phụ đề, LOẠI mọi đoạn dính từ cấm · 2. lấy 10 đoạn sạch to tiếng nhất · 3. AI rẻ (ckey, box3) chọn đoạn khớp HƯỚNG NỘI DUNG.
 *  AI hỏng → lùi về đoạn sạch to nhất (vẫn sạch, chỉ chưa chắc khớp hướng — ghi rõ vào nhật ký). Không còn đoạn sạch nào → ném lỗi, KHÔNG cắt bừa. */
export function chonCanh(tep, giay = 9, huong = '') {
  const uv = doanSach(doTo(tep), docPhuDe(tep), giay);
  if (!uv.length) throw new Error('tập này không còn đoạn 9 giây nào sạch thoại (mọi đoạn dính từ cấm) — đổi tập / đổi phim');
  let r = {};
  try {
    r = JSON.parse(execFileSync('ssh', [BOX, 'cd /opt/earns-marketing-os-v2/apps/xuong-video && ../../node_modules/.bin/tsx scripts/sx-chon-canh.mts'],
      { input: JSON.stringify({ huong, ung_vien: uv.map(({ bat_dau, chu }) => ({ bat_dau, chu })) }), encoding: 'utf8', timeout: 300_000 }).trim().split('\n').pop());
  } catch (e) { r = { bat_dau: null, loi: String(e.message).split('\n')[0].slice(0, 160) }; }
  const chon = uv.find((x) => x.bat_dau === r.bat_dau);
  if (chon) return { batDau: chon.bat_dau, vnd: r.vnd ?? 0, ghi: `giây ${chon.bat_dau} · AI chọn khớp hướng: ${r.ly_do} · thoại: ${chon.chu.slice(0, 120)}` };
  return { batDau: uv[0].bat_dau, vnd: r.vnd ?? 0, ghi: `giây ${uv[0].bat_dau} · AI chưa chọn được (${r.loi ?? 'không rõ'}) → lấy đoạn sạch to tiếng nhất, CHƯA CHẮC khớp hướng · thoại: ${uv[0].chu.slice(0, 120)}` };
}

/** Lớp chữ phủ lên clip (PNG trong suốt 1080×1920) — dựng bằng PIL vì bản ffmpeg của máy này KHÔNG có drawtext. */
function lopChu(ra, { free = false, moi = 'full story is in the comments' } = {}) {
  const py = `
from PIL import Image, ImageDraw, ImageFont
W,H=1080,1920
im=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
B=lambda s: ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf",s)
R=lambda s: ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf",s)
if ${free ? 'True' : 'False'}:
    f1=B(52); t="FREE"; tw=d.textlength(t,font=f1); x,y=56,150
    d.rounded_rectangle([x,y,x+tw+60,y+74],radius=37,fill=(214,42,48,235))
    d.text((x+30,y+16),t,font=f1,fill=(255,255,255,255))
    f2=R(40); s=${JSON.stringify('watch free in comment')}; sx,sy=56,H-470
    for dx,dy in ((2,2),(-2,2),(2,-2),(-2,-2)): d.text((sx+dx,sy+dy),s,font=f2,fill=(0,0,0,150))
    d.text((sx,sy),s,font=f2,fill=(255,255,255,245))
else:
    for i in range(420):
        a=int(200*(i/420)**1.4); d.line([(0,H-420+i),(W,H-420+i)],fill=(0,0,0,a))
    f1=B(62); l1=${JSON.stringify('full story is in the comments')}
    w1=d.textlength(l1,font=f1); d.text(((W-w1)/2,H-250),l1,font=f1,fill=(255,255,255,255))
    f2=R(46); l2="↓ first comment ↓"; w2=d.textlength(l2,font=f2)
    d.text(((W-w2)/2,H-160),l2,font=f2,fill=(255,214,120,255))
im.save(${JSON.stringify(ra)})
`;
  chay('python3', ['-c', py]);
  return ra;
}

/** Dựng clip 9s: cắt → bỏ dải CTA cháy sẵn ở đáy (crop 84%) → 1080×1920 không méo (co theo chiều cao rồi cắt hai bên) → phủ lớp chữ. */
function dungClip({ tep, batDau, ra, free }) {
  const ov = `${path.dirname(ra)}/ov-${path.basename(ra, '.mp4')}.png`;
  lopChu(ov, { free });
  // free: chữ hiện từ đầu (huy hiệu góc) · thường: dải chữ mời hiện 2,7 giây cuối
  const fade = free ? 'fade=t=in:st=0.3:d=0.5:alpha=1' : 'fade=t=in:st=6.3:d=0.6:alpha=1';
  chay('ffmpeg', ['-y', '-v', 'error', '-ss', String(batDau), '-t', '9', '-i', tep, '-loop', '1', '-framerate', '30', '-t', '9', '-i', ov,
    '-filter_complex', `[0:v]crop=iw:ih*0.84:0:0,scale=-2:1920,crop=1080:1920,fps=30,setsar=1[v];[1:v]format=rgba,${fade},setsar=1[c];[v][c]overlay=0:0:shortest=1[o]`,
    '-map', '[o]', '-map', '0:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', ra]);
  return ra;
}

/** Đưa tệp lên R2 qua box3 (khoá R2 chỉ có ở đó) → url công khai img.on.tc. */
export function lenR2(tep, thuMuc = 'mia-reel') {
  const xa = `/tmp/sx-${path.basename(tep)}`;
  chay('scp', ['-q', tep, `${BOX}:${xa}`]);
  const u = chay('ssh', [BOX, `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/tai-len.mts ${xa} ${thuMuc}`]).trim();
  if (!u.startsWith('https://')) throw new Error(`R2 không nhận tệp: ${u.slice(0, 160)}`);
  return u;
}

// ———————————————————————— BẢNG HÀM: MỖI DẠNG BÀI MỘT HÀM ————————————————————————

async function lamReelCanh9(de, { free = false } = {}) {
  if (!de.phim) throw new Error(`${de.slug}: dạng Reel cắt cảnh cần dang.phim (content_id phim)`);
  const thu = taiTap(de.phim, de.urlPhim);
  const tep = `${thu}/tap01.mp4`;
  const c = chonCanh(tep, 9, de.huong ?? '');
  mkdirSync(`${KHO}/ra`, { recursive: true });
  const ra = dungClip({ tep, batDau: c.batDau, ra: `${KHO}/ra/${de.slug}.mp4`, free });
  return { video_url: lenR2(ra), vnd: c.vnd, ghi: `tập 1 · ${c.ghi}`, tepCuc: ra };
}

async function lamAnhDoiThuong(de) {
  if (!de.prompt) throw new Error(`${de.slug}: ảnh đời thường cần dang.prompt (mô tả cảnh cho AI)`);
  const ra = `/tmp/sx-${de.slug}.png`;
  const o = chay('ssh', [BOX, `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/anh-le.mts --prompt=${JSON.stringify(de.prompt)} --ti-le=4:5 --ra=${ra}`]);
  const url = (o.match(/https:\/\/img\.on\.tc\/\S+/) ?? [])[0];
  if (!url) throw new Error(`anh-le.mts không trả ảnh: ${o.slice(-200)}`);
  const vnd = Number((o.match(/(\d+)\s*₫/) ?? [])[1] ?? 110);
  return { anh: [url], vnd, ghi: 'ảnh sinh AI qua cổng rẻ' };
}

/** BẢNG HÀM — khoá phải khớp ĐÚNG sổ kieu-sx.json (sx-may.mjs --tu-kiem gác). */
export const LAM = {
  reel_canh9: (de) => lamReelCanh9(de, { free: false }),
  reel_canh9_free: (de) => lamReelCanh9(de, { free: true }),
  anh_doi_thuong: lamAnhDoiThuong,
};

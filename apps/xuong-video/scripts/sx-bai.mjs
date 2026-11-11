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

/** CHỌN 9 GIÂY CAO TRÀO — bằng ĐỘ TO của tiếng, không bằng cảm tính.
 *  Cao trào phim ngắn gần như luôn trùng chỗ tiếng to nhất (quát, khóc, va chạm, nhạc dồn). Đọc PCM 8 kHz một lượt,
 *  tính RMS từng giây, lấy cửa sổ 9 giây có trung bình lớn nhất — bỏ 25% đầu (giới thiệu) và 8% cuối (hậu đề). */
export function chonCanh(tep, giay = 9) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', tep, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  const n = Math.floor(raw.length / 2), mau = 8000, soGiay = Math.floor(n / mau);
  if (soGiay < giay + 4) throw new Error(`tập quá ngắn (${soGiay}s) để cắt ${giay}s`);
  const rms = [];
  for (let s = 0; s < soGiay; s++) {
    let t = 0; for (let i = s * mau; i < (s + 1) * mau; i++) { const v = raw.readInt16LE(i * 2); t += v * v; }
    rms.push(Math.sqrt(t / mau));
  }
  const tu = Math.floor(soGiay * 0.25), den = Math.floor(soGiay * 0.92) - giay;
  if (den <= tu) throw new Error('tập quá ngắn sau khi bỏ đầu/cuối');
  let best = tu, diem = -1;
  for (let s = tu; s <= den; s++) {
    const d = rms.slice(s, s + giay).reduce((a, b) => a + b, 0) / giay;
    if (d > diem) { diem = d; best = s; }
  }
  return best;
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
  const batDau = chonCanh(tep, 9);
  mkdirSync(`${KHO}/ra`, { recursive: true });
  const ra = dungClip({ tep, batDau, ra: `${KHO}/ra/${de.slug}.mp4`, free });
  return { video_url: lenR2(ra), vnd: 0, ghi: `cắt từ giây ${batDau} của tập 1 (chọn theo độ to của tiếng)`, tepCuc: ra };
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

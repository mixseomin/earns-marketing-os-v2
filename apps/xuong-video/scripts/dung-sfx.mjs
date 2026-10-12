// Dựng bộ TIẾNG HIỆU ỨNG (12/10/2026) bằng ffmpeg tổng hợp — 0đ, không bản quyền, chạy lại ra y nguyên.
// Tệp ra: public/sfx/<key>.mp3 — key trùng key nhóm "Âm thanh" của thư viện kỹ thuật (dien-anh.ts) và bảng SFX (src/lib/xuong-video/sfx.ts):
// bản xuất trộn từ thư mục này, timeline xem trước phát /sfx/<key>.mp3. Sửa tiếng = sửa công thức ở đây rồi chạy lại:
//   node apps/xuong-video/scripts/dung-sfx.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RA = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sfx');
mkdirSync(RA, { recursive: true });
const SR = 48000;
// Mỗi tiếng: nguồn lavfi (aevalsrc / anoisesrc) + chuỗi lọc. random(0) = nhiễu trắng trong aevalsrc.
const TIENG = {
  // Đập mạnh: trống trầm rơi cao độ 105→45 Hz + tiếng "chát" nhiễu rất ngắn — điểm cắt sốc, lộ chữ.
  dap: { src: `aevalsrc='0.95*sin(2*PI*(45*t+60/8*(1-exp(-8*t))))*exp(-3.2*t)+0.55*(random(0)*2-1)*exp(-38*t)':s=${SR}:d=1.6`, loc: 'lowpass=f=3200,aecho=0.6:0.4:40:0.25' },
  // Vút: nhiễu hồng phồng lên rồi tắt (đỉnh ở 60% độ dài) qua dải 600–4000 Hz — quất chuyển, chữ bay vào.
  vut: { src: `aevalsrc='(random(0)*2-1)*pow(sin(PI*pow(t/0.7,0.75)),3)':s=${SR}:d=0.7`, loc: 'highpass=f=600,lowpass=f=4000,aecho=0.5:0.3:25:0.2,volume=1.6' },
  // Dâng (riser): sin trượt 180→1500 Hz + nhiễu to dần, cắt phụt ở cuối — dồn tới điểm cắt.
  cuon_len: { src: `aevalsrc='0.35*sin(2*PI*(180*t+1320/(2*2.2)*t*t))*(t/2.2)+0.35*(random(0)*2-1)*pow(t/2.2,2)':s=${SR}:d=2.2`, loc: 'highpass=f=150,lowpass=f=6000,afade=t=in:d=0.3' },
  // Âm doạ (sting): hợp âm nghịch 3 nốt đánh gắt, ngân 1,6s.
  dap_doa: { src: `aevalsrc='(0.35*sin(2*PI*311*t)+0.3*sin(2*PI*330*t)+0.3*sin(2*PI*466*t)+0.25*sin(2*PI*622*t))*exp(-2.4*t)*(1-exp(-120*t))':s=${SR}:d=1.6`, loc: 'aecho=0.7:0.5:60|110:0.35|0.2' },
  // Nhịp tim: hai nhịp "thịch-thịch" mỗi 0,85s, 55 Hz — lặp suốt shot.
  tim_dap: { src: `aevalsrc='0.9*sin(2*PI*55*t)*(exp(-28*mod(t,0.85))+0.7*exp(-28*max(0,mod(t,0.85)-0.22))*gte(mod(t,0.85),0.22))':s=${SR}:d=3.4`, loc: 'lowpass=f=180,volume=2.2' },
  // Mưa: nhiễu hồng lọc dải — lặp suốt shot.
  mua: { src: `anoisesrc=c=pink:r=${SR}:a=0.5:d=6`, loc: 'highpass=f=400,lowpass=f=7000,volume=0.5' },
  // Vỡ kính: nhiễu cao tắt nhanh + 4 tiếng leng keng rơi.
  vo_kinh: { src: `aevalsrc='0.8*(random(0)*2-1)*exp(-14*t)+0.25*sin(2*PI*3900*t)*exp(-9*max(0,t-0.05))*gte(t,0.05)+0.2*sin(2*PI*5200*t)*exp(-10*max(0,t-0.18))*gte(t,0.18)+0.18*sin(2*PI*4500*t)*exp(-12*max(0,t-0.33))*gte(t,0.33)+0.15*sin(2*PI*6100*t)*exp(-14*max(0,t-0.47))*gte(t,0.47)':s=${SR}:d=1.2`, loc: 'highpass=f=1800,aecho=0.6:0.4:30:0.3' },
  // Chập điện: sóng vuông 90 Hz rung tần + nhiễu, tắt trong 0,6s.
  chop_dien: { src: `aevalsrc='0.5*sgn(sin(2*PI*(90+40*sin(2*PI*23*t))*t))*exp(-4.5*t)+0.4*(random(0)*2-1)*exp(-9*t)':s=${SR}:d=0.8`, loc: 'highpass=f=120,lowpass=f=5000,volume=0.9' },
  // Sấm: nhiễu nâu trầm, lên trong 0,08s, ngân 3s.
  sam: { src: `anoisesrc=c=brown:r=${SR}:a=0.9:d=3.2`, loc: "lowpass=f=320,volume='min(1,t/0.08)*exp(-1.2*t)*3':eval=frame" },
};
for (const [k, x] of Object.entries(TIENG)) {
  const ra = join(RA, `${k}.mp3`); const tam = join(RA, `.${k}.wav`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', x.src, '-af', `${x.loc},aformat=channel_layouts=stereo`, '-ar', String(SR), tam]);
  // Chuẩn hoá đỉnh về -3 dB: mọi tiếng cùng mốc, mức trộn trong bản xuất (sfx.ts › db) mới so được với nhau.
  const dinh = Number(/max_volume: (-?[\d.]+) dB/.exec(spawnSync('ffmpeg', ['-hide_banner', '-i', tam, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr)?.[1] ?? NaN);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tam, '-af', `volume=${Number.isFinite(dinh) ? (-3 - dinh).toFixed(1) : 0}dB,alimiter=limit=0.75`, '-c:a', 'libmp3lame', '-b:a', '128k', ra]);
  rmSync(tam);
  console.log(`✓ ${k}.mp3`);
}

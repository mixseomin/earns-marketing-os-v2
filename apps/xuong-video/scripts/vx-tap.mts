// VIDEO CẢ TẬP STUDIO QUA VIDEOEXPRESS ($0, tài khoản đã mua — anh 11/11/2026 "Dùng videoexpress"). Đọc thẳng shot của tập trong studio (xv_canh):
// keyframe đang chọn = khung đầu, prompt_video = chuyển động, thoai[] = lời thoại tiếng Việt (VideoExpress tự đọc + khớp môi, luật "VideoExpress TRƯỚC").
// Gửi ≤ 5 clip song song (trần render cùng lúc của VideoExpress), clip xong thì tải về → đẩy lên box → gan-clip-ngoai.mts --giu-nhip (R2 → video_url,
// tiếng gốc của clip → am_thanh_url, giữ phat_s của shot để bản xuất tự cắt). Sổ gửi nằm ở xv_canh.ky_thuat.vx {uuid, media_id, luc, prompt, xong}
// → chạy lại là đi tiếp đúng chỗ, không gửi trùng.
// Chạy trên iMac (br, profile riêng VideoExpress — videoexpress.mjs):
//   cd ~/Me/GitHub/earns-marketing-os-v2/apps/xuong-video && ../../node_modules/.bin/tsx scripts/vx-tap.mts --tap=2936 [--so=1,2] [--lai=12]
//   (bỏ VX_CHAY=1 = chỉ IN prompt từng shot, không gửi)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { napKhung, guiShot, getMedia, catId, trenApp, ngu } from './vx-br.mts';
import { moPhien } from './videoexpress.mjs';

const BOX = 'root@167.233.241.16';
const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const tapId = Number(gia('tap'));
if (!tapId) { console.error('cần --tap=<id tập>'); process.exit(1); }
const loc = gia('so').split(',').map(Number).filter(Boolean);
const lai = new Set(gia('lai').split(',').map(Number).filter(Boolean));   // --lai=12: gửi lại shot đó dù đã có clip
const SONG_SONG = 5, HAN_PHUT = Number(gia('phut') || 45);
const thu = join(tmpdir(), `vx-tap-${tapId}`); mkdirSync(thu, { recursive: true });

const psql = (cau: string): string => execFileSync('ssh', [BOX, 'cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -tA'], { input: cau, encoding: 'utf8', timeout: 60e3 }).trim();
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

type Thoai = { loi: string; nhan_vat?: string; dien_xuat?: string };
type Vx = { uuid?: string; media_id?: number; luc?: string; prompt?: string; xong?: string };
type DD = { mo?: string; ket?: string; huong?: string; dien?: string; vao_ra?: string; nhip?: string; vat?: Record<string, string> };
type Vat = { ten: string; mo_ta: string };
type Shot = { id: number; so: number; kf: string | null; pv: string | null; hd: string | null; thoai: Thoai[] | null; vx: Vx | null; dd: DD | null; vat: Vat[] | null };
const ttPhim = JSON.parse(psql(`SELECT json_build_object('ti_le', p.kinh_thanh->>'ti_le', 'chat', p.kinh_thanh->>'chat_lieu', 'pc', p.kinh_thanh->>'phong_cach')
  FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId};`) || '{}') as { ti_le?: string; chat?: string; pc?: string };
const kho = (['16:9', '9:16', '1:1'].includes(ttPhim.ti_le ?? '') ? ttPhim.ti_le : '9:16') as '16:9' | '9:16' | '1:1';
const docShot = (): Shot[] => JSON.parse(psql(`SELECT coalesce(json_agg(x ORDER BY x.so), '[]') FROM (SELECT id, thu_tu::int AS so, nullif(keyframe_url, '') AS kf,
  prompt_video AS pv, hanh_dong AS hd, thoai, ky_thuat->'vx' AS vx, dan_dung AS dd,
  (SELECT json_agg(json_build_object('ten', n.ten, 'mo_ta', n.mo_ta)) FROM xv_nhan_vat n WHERE n.id IN (SELECT jsonb_array_elements_text(c.nhan_vat)::int) AND n.loai = 'dao_cu') AS vat
  FROM xv_canh c WHERE tap_id = ${tapId}) x;`) || '[]') as Shot[];
const ghiVx = (id: number, vx: Vx) => psql(`UPDATE xv_canh SET ky_thuat = jsonb_set(coalesce(ky_thuat, '{}'::jsonb), '{vx}', ${q(JSON.stringify(vx))}::jsonb), updated_at = now() WHERE id = ${id};`);

/** Ai nói: tên nhân vật trong thoại → chủ ngữ tiếng Anh cho mô hình. */
const chuNgu = (ten = '') => (/^ch[úu]/i.test(ten) ? 'the man' : /nh[óo]c|ch[áa]u|b[ée]/i.test(ten) ? 'the boy' : ten || 'a character');
function cauPrompt(s: Shot): string {
  const hoat = ttPhim.chat === 'hoat_hinh';
  const nen = hoat
    ? `2D hand-drawn anime animation, ${kho} frame; the first frame is exact — keep the art style, characters, faces, outfits, props and background unchanged.`
    : `Cinematic live-action ${kho} clip; the first frame is exact — keep faces, outfits, props and background unchanged.`;
  const dong = (s.pv || s.hd || 'Subtle natural movement.').trim().replace(/\.?$/, '.');
  const loi = (s.thoai ?? []).filter((t) => t.loi?.trim()).map((t) => {
    const ngoai = /ngoài khung|off/i.test(t.dien_xuat ?? '');
    return ngoai ? `An off-screen voice (${chuNgu(t.nhan_vat)}) says in Vietnamese: "${t.loi}".` : `${chuNgu(t.nhan_vat)[0]!.toUpperCase()}${chuNgu(t.nhan_vat).slice(1)} says in Vietnamese with natural lip-sync: "${t.loi}".`;
  }).join(' ');
  const tieng = loi ? '' : ' No speech. Natural ambient sound.';
  // THẺ SHOT (dan_dung — cùng ô studio đưa vào prompt video, sinh-video.ts › promptVideoCanh): trạng thái mở → kết, hướng nhìn / hướng đi, diễn xuất.
  // 11/11/2026 bản đầu chỉ gửi prompt_video → tàu đang đỗ chờ lại chạy, chú nhìn ngược hướng nhóc chạy (anh chỉ). Thiếu ô thì bỏ câu đó.
  const d = s.dd ?? {};
  const the = [d.mo && d.ket ? `The shot runs from: ${d.mo} — to: ${d.ket}.` : '', d.dien ? `Acting: ${d.dien}.` : '', d.huong ? `Keep screen direction exactly: ${d.huong}.` : '',
    d.vao_ra ? `${d.vao_ra}.` : '', d.nhip ? `Timing: ${d.nhip}.` : ''].filter(Boolean).join(' ');
  // ĐỐI TƯỢNG THEO DÕI (anh 11/11/2026 "tàu tách thành 1 đối tượng để nó được follow trong prompt"): đạo cụ gắn shot có trạng thái khai ở dan_dung.vat
  // → một câu riêng tả nó + trạng thái của nó trong shot này; model không phải đoán từ câu hành động.
  const theo = (s.vat ?? []).filter((v) => d.vat?.[v.ten]).map((v) => `Tracked object — ${v.mo_ta.split('.')[0]}: in this shot it is ${d.vat![v.ten]}.`).join(' ');
  // WHITELIST (như studio): thứ hành động không nêu thì giữ nguyên như khung đầu — xe / tàu đang đỗ không tự chạy, người không tự quay hướng khác.
  const giu = 'Only what the action names changes; every vehicle, person and object it does not name stays exactly as in the first frame — parked vehicles stay parked, nobody turns to face a different direction.';
  return `${nen} ${dong} ${the} ${theo} ${giu} ${loi}${tieng} Natural motion and weight. No text, no subtitles, no captions, no logos, no watermarks.`.replace(/\s+/g, ' ').replace(/\.\./g, '.').slice(0, 2000);
}

let ds = docShot().filter((s) => !loc.length || loc.includes(s.so));
if (!ds.length) { console.error('không có shot nào'); process.exit(1); }
if (process.env.VX_CHAY !== '1') {
  console.log(`· CHẠY THỬ (không gửi — đặt VX_CHAY=1) · tập #${tapId} · khổ ${kho} · ${ds.length} shot`);
  for (const s of ds) console.log(`#${s.so}${s.kf ? '' : ' ⚠ CHƯA CÓ KEYFRAME'}${s.vx?.xong ? ' (đã có clip VX)' : ''}: ${cauPrompt(s)}`);
  process.exit(0);
}
if (!trenApp()) await moPhien();
const catDefault = catId('default'), catVideo = catId('my_ai_videos');
const batDau = Date.now();
const canGui = (s: Shot) => s.kf && (lai.has(s.so) || (!s.vx?.uuid && !s.vx?.xong));
for (const s of ds) if (lai.has(s.so)) s.vx = null;

/** Clip đã render xong → tải về, tách tiếng, đẩy lên box, gắn vào shot (gan-clip-ngoai --giu-nhip). */
function gan(s: Shot, mp4Url: string): string {
  const v = join(thu, `vx-${s.so}.mp4`), a = join(thu, `vx-${s.so}.wav`), n = join(thu, `vx-${s.so}.json`);
  execFileSync('curl', ['-sfL', '-o', v, mp4Url], { timeout: 180e3 });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', v, '-vn', '-ac', '2', '-ar', '48000', a]);
  writeFileSync(n, JSON.stringify({ model: 'videoexpress', uuid: s.vx?.uuid, prompt: s.vx?.prompt, goc: mp4Url }));
  const dich = `/tmp/vx-tap-${tapId}`;
  execFileSync('ssh', [BOX, `mkdir -p ${dich}`]);
  execFileSync('scp', ['-q', v, a, n, `${BOX}:${dich}/`]);
  const ra = execFileSync('ssh', [BOX, `cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/gan-clip-ngoai.mts --canh=${s.id} --video=${dich}/vx-${s.so}.mp4 --am=${dich}/vx-${s.so}.wav --nguon=${dich}/vx-${s.so}.json --giu-nhip && rm -f ${dich}/vx-${s.so}.*`], { encoding: 'utf8', timeout: 300e3 }).trim();
  return ra.split('\n').pop() ?? '';
}

let hetLuot = false;
while (Date.now() - batDau < HAN_PHUT * 60e3) {
  // 1) thu clip xong
  const dang = ds.filter((s) => s.vx?.uuid && !s.vx.xong);
  if (dang.length) {
    if (!trenApp()) await moPhien();
    const theoUuid = new Map(getMedia(catVideo, 100).results.map((r) => [r.uuid, r]));
    for (const s of dang) {
      const it = theoUuid.get(s.vx!.uuid!);
      if (!it || it.isPending || !it.mediaPath) continue;
      try { const kq = gan(s, it.mediaPath); s.vx = { ...s.vx!, xong: it.mediaPath }; ghiVx(s.id, s.vx); console.log(`#${s.so}: ✓ ${kq}`); }
      catch (e) { console.log(`#${s.so}: ✗ gắn clip hỏng — ${String(e).slice(0, 200)}`); }
    }
  }
  // 2) gửi tiếp tới khi đủ 5 đang render
  let cho = ds.filter((s) => s.vx?.uuid && !s.vx.xong).length;
  for (const s of ds) {
    if (hetLuot || cho >= SONG_SONG) break;
    if (!canGui(s)) continue;
    const f = join(thu, `kf-${s.so}.jpg`);
    execFileSync('curl', ['-sfL', '-o', f, s.kf!], { timeout: 120e3 });
    // tab có thể rời app giữa lượt (11/11/2026: fetch '/library/upload/4' hỏng 'Failed to parse URL' — trang không còn ở app) → kiểm phiên trước MỖI lần nạp
    if (!trenApp()) await moPhien();
    let mediaId: number | null = null;
    try { mediaId = await napKhung(f, catDefault); } catch (e) { console.log(`#${s.so}: ! nạp keyframe lỗi, thử lại nhịp sau — ${String(e).split('\n')[0]!.slice(0, 160)}`); break; }
    if (!mediaId) { console.log(`#${s.so}: ✗ nạp keyframe hỏng — DỪNG gửi`); hetLuot = true; break; }
    const prompt = cauPrompt(s);
    const uuid = guiShot(mediaId, prompt, false, 0, 0, kho);
    if (!uuid) { console.log(`#${s.so}: ✗ VideoExpress từ chối (có thể hết lượt ngày) — DỪNG gửi`); hetLuot = true; break; }
    s.vx = { uuid, media_id: mediaId, luc: new Date().toISOString(), prompt }; ghiVx(s.id, s.vx); lai.delete(s.so);
    console.log(`#${s.so}: → gửi job ${uuid.slice(0, 8)}`); cho++;
    await ngu(1500);
  }
  const con = ds.filter((s) => s.kf && !s.vx?.xong).length;
  if (!con) break;
  if (hetLuot && !ds.some((s) => s.vx?.uuid && !s.vx.xong)) break;
  console.log(`  ${new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · còn ${con} shot · đang render ${cho}`);
  await ngu(30e3);
  if (!trenApp()) await moPhien();
}
const xong = ds.filter((s) => s.vx?.xong).length;
console.log(`\nXong ${xong}/${ds.length} shot có clip VideoExpress.${xong < ds.length ? ' Chạy lại cùng lệnh để đi tiếp (sổ ở ky_thuat.vx).' : ''}`);
process.exit(0);

// MỘT CLIP VIDEOEXPRESS từ MỘT ảnh khung đầu (0₫, tài khoản đã mua) — cho máy dựng creative Ethopex (dung-mau.py › chuyen_dong, mẫu AD dt_anh_dong_logo).
// Anh 27/11/2026: "AD chỉ lên qua ckey hoặc VideoExpress · Dùng videoexpress để làm video" — ckey không bán video, cổng AI chung rơi xuống Kie 4.550₫/bản.
// Chạy trên iMac (br, profile riêng VideoExpress — videoexpress.mjs). Gửi → chờ render (~4 phút) → tải mp4 về --ra. In dòng `VX: {json}` cho nơi gọi.
//   ../../node_modules/.bin/tsx scripts/vx-mot.mts --anh khung.jpg --ra clip.mp4 --prompt-tep lenh.txt [--uuid <uuid đã gửi>] [--han 1200]
// --uuid: lượt trước đã gửi (nơi gọi giữ sổ) → không gửi lại, chỉ chờ + tải.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { napKhung, guiShot, getMedia, catId, trenApp, ngu } from './vx-br.mts';

const a = process.argv.slice(2);
const gia = (k: string) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : undefined; };
const anh = gia('anh'), ra = gia('ra'), tepLenh = gia('prompt-tep'), han = Number(gia('han')) || 1200;
let uuid = gia('uuid') || '';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const bao = (o: Record<string, unknown>) => console.log(`VX: ${JSON.stringify(o)}`);
if (!ra || (!uuid && (!anh || !tepLenh || !existsSync(anh) || !existsSync(tepLenh)))) { bao({ ok: false, loi: 'cần --ra và (--uuid | --anh <tệp> --prompt-tep <tệp>)' }); process.exit(2); }

// phiên tự đóng khi rảnh / tab rơi về about:blank giữa chừng (27/11/2026: 5 phim chạy song song, một việc đang chờ render gặp
// "Failed to parse URL from /api/library/…" vì trang không còn ở app) → mỗi lần đọc đều kiểm trang, rơi thì mở lại qua videoexpress.mjs.
const trenAppAnToan = () => { try { return trenApp(); } catch { return false; } };
function damBaoPhien(): boolean {
  if (trenAppAnToan()) return true;
  try { execFileSync('node', [join(import.meta.dirname, 'videoexpress.mjs'), 'mo'], { stdio: ['ignore', 'inherit', 'inherit'], timeout: 300e3 }); } catch {}
  return trenAppAnToan();
}
if (!damBaoPhien()) { bao({ ok: false, loi: 'không mở được phiên VideoExpress (videoexpress.mjs mo)' }); process.exit(3); }
if (!uuid) {
  const mediaId = await napKhung(anh!, catId('default'));
  if (!mediaId) { bao({ ok: false, loi: 'nạp ảnh khung đầu lên VideoExpress hỏng' }); process.exit(4); }
  // enhance tắt: giữ nguyên câu chuyển động của mẫu (không để máy họ viết lại thêm người / chữ)
  uuid = guiShot(mediaId, readFileSync(tepLenh!, 'utf8').trim(), false) || '';
  if (!uuid) { bao({ ok: false, loi: 'VideoExpress từ chối image2video (hết chỗ render song song / hết lượt)' }); process.exit(5); }
  bao({ gui: true, uuid });
}
const cat = catId('my_ai_videos'), t0 = Date.now();
let loiDoc = 0;
for (;;) {
  let ds: ReturnType<typeof getMedia>['results'];
  try { ds = getMedia(cat, 60).results; loiDoc = 0; }
  catch (e) {   // trang rơi khỏi app giữa lúc chờ render: việc vẫn chạy bên VideoExpress → mở lại phiên rồi đọc tiếp, không bỏ việc
    if (++loiDoc > 8) { bao({ ok: false, uuid, loi: `đọc My AI Videos hỏng 8 lần liền: ${String((e as Error).message).slice(0, 200)}` }); process.exit(9); }
    damBaoPhien(); await ngu(10_000); continue;
  }
  const it = ds.find((x) => x.uuid === uuid);
  if (it && !it.isPending && it.mediaPath) {
    execFileSync('curl', ['-sSL', '--fail', '-A', UA, '-o', ra, it.mediaPath], { timeout: 180e3 });
    if (!existsSync(ra) || statSync(ra).size < 20_000) { bao({ ok: false, uuid, loi: `tải clip về hỏng (${it.mediaPath})` }); process.exit(6); }
    bao({ ok: true, uuid, ra, giay: it.duration, kho: it.frameSize }); process.exit(0);
  }
  if (!it && Date.now() - t0 > 120e3) { bao({ ok: false, uuid, loi: 'không thấy việc trong My AI Videos sau 2 phút (VideoExpress bỏ việc)' }); process.exit(7); }
  if (Date.now() - t0 > han * 1000) { bao({ ok: false, uuid, treo: true, loi: `VideoExpress render quá ${Math.round(han / 60)} phút` }); process.exit(8); }
  await ngu(15_000);
}

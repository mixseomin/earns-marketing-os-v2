// ✚ CHÈN MỘT SHOT ngay sau một shot có sẵn (0đ) — dồn số các shot sau + MỌI sổ theo số shot (sổ đồ vật, sổ dáng, khối phân cảnh vẽ), chụp trước để ↶ hoàn tác.
// Tập dựng từ BẢNG MẢNH (dung-phim-reelshort.mts): thêm mảnh vào bảng TRƯỚC (một nguồn), chạy script này để có hàng shot, rồi --cap-nhat để DB khớp bảng.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/chen-shot.mts --sau=<canh_id> --hd="<hành động>" [--co=cu|mcu|ms…] [--phat=<giây>]
import { getDb } from '@mos2/db';
import { chenShotSauDb } from '../src/lib/xuong-video/tach-shot';
const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const sau = Number(gia('sau') || 0); const hd = gia('hd') ?? '';
if (!sau || !hd.trim()) { console.error('cần --sau=<canh_id> --hd="…"'); process.exit(1); }
const r = await chenShotSauDb(getDb()!, sau, { hanh_dong: hd, ky_thuat: { co_canh: gia('co') || 'ms' }, phat_s: gia('phat') ? Number(gia('phat')) : null }, 'script chen-shot');
console.log(r.ok ? `✓ shot mới id ${r.id}` : `✗ ${r.loi}`); process.exit(r.ok ? 0 : 1);

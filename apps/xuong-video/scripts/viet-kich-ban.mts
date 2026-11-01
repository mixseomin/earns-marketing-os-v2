// VIẾT + TỰ CHẤM KỊCH BẢN một tập bằng đúng đường nút ✍ trên studio (claude.ts › vietVaCham: sổ tay so-tay-kich-ban.ts → viết / sinh dư gag →
// chấm chéo + chấm ngược (model khác) → thử mù (gag) → kết luận) — lưu kich_ban + cham_kich_ban, ghi tiền sổ phim, chụp trước để ↶ Hoàn tác. Chạy trên box3:
//   cd apps/xuong-video && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/viet-kich-ban.mts --tap=1148 [--brief-tep=mau/x.md] [--so-gag=12] [--chay]
// Không --chay = chỉ in brief + góc spy sẽ dùng (0đ). TỐN TIỀN khi --chay (vài lượt Claude qua ckey).
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { vietVaCham } from '../src/lib/xuong-video/claude';
import { boiCanhTap, ghiTienChu, type Row } from '../src/lib/xuong-video/doc-db';
import { chupTruoc } from '../src/lib/xuong-video/hoan-tac';
import { docGocSpy } from '../src/lib/xuong-video/goc-spy';
import { vanGocSpyKb } from '../src/lib/xuong-video/spy-api';
import { docKinhThanh } from '../src/lib/xuong-video/kieu';

const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=').slice(1).join('=');
const tapId = Number(gia('tap')); if (!tapId) { console.error('thiếu --tap='); process.exit(1); }
const db = getDb()!;
const bc = await boiCanhTap(db, tapId); if (!bc) { console.error('không thấy tập'); process.exit(1); }
const brief = gia('brief-tep') ? readFileSync(gia('brief-tep'), 'utf8') : bc.tap.brief;
const gan = docGocSpy(((await db.execute(sql`SELECT goc_spy FROM xv_phim WHERE id = ${bc.tap.phim_id}`)) as unknown as Row[])[0]?.goc_spy);
const gocSpy = await vanGocSpyKb(gan);
console.log(`tập #${tapId} · phim #${bc.tap.phim_id} · gói ${docKinhThanh(bc.kt).goi || '(chưa chọn)'} · ${bc.nhanVat.length} anchor · góc spy: ${gan.length}\nBRIEF:\n${brief}\n${gocSpy}`);
if (!process.argv.includes('--chay')) process.exit(0);
const kq = await vietVaCham({ loai: bc.loai, kinhThanh: bc.kt, nhanVat: bc.nhanVat, brief, tapSo: bc.loai === 'phim' ? bc.tap.so : undefined, tapTruoc: bc.tapTruoc, thoiLuongS: bc.tap.thoi_luong_s ?? 45, gocSpy, soGag: Number(gia('so-gag')) || undefined });
if (!kq.ok) { console.error('LỖI', kq.loi); process.exit(1); }
await ghiTienChu(db, bc.tap.phim_id, `Viết + tự chấm kịch bản · tập ${bc.tap.so}`, kq.model, kq.tokens);
await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['brief', 'kich_ban', 'cham_kich_ban'], moTa: 'viết + tự chấm kịch bản (script)', nguoi: 'viet-kich-ban' });
await db.execute(sql`UPDATE xv_tap SET brief = ${brief}, kich_ban = ${kq.kichBan}, cham_kich_ban = ${JSON.stringify(kq.cham)}::jsonb, updated_at = now() WHERE id = ${tapId}`);
const c = kq.cham;
console.log(`\n${c.ket_luan}\n${c.nguoi_viet} viết · ${c.nguoi_cham} chấm${c.nguoi_thu ? ` · ${c.nguoi_thu} thử mù` : ''} · ${c.vong} vòng · ${kq.tokens.vnd != null ? `${Math.round(kq.tokens.vnd)}₫` : `${kq.tokens.in}/${kq.tokens.out} tok`}`);
for (const m of c.muc) console.log(`  ${m.ten}: ${m.diem}/2 — ${m.ly_do}`);
for (const x of c.nguoc) console.log(`  ngược: ${x}`);
for (const x of c.may) console.log(`  máy: ${x}`);
if (c.gag) { console.log(`  gag giữ ${c.gag.chon.length}/${c.gag.ung_vien}: ${c.gag.chon.join(' → ')}`); for (const l of c.gag.loai) console.log(`   ✗ ${l.ten} — ${l.vi}`); }
console.log(`\n${kq.kichBan}`);
process.exit(0);

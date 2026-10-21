// TỰ HOÀN THÀNH một phim QC qua đúng quy trình studio (tu-lam-phim.ts › lamPhimTuDau): người xem (Gemini) → ảnh gốc → keyframe → giọng → clip
// (vòng tự sửa) → nhạc → mọi shot sạch thì xuất MP4 → in tổng chi phí. Chạy cho tập đã có, hoặc tạo PHIM GỐC từ creative rồi chạy.
// TỐN TIỀN (video ~$0.17/shot/lần) — chạy khi anh đã bảo làm phim đó.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/tu-lam-phim.mts <tap_id> [--toi-da=3]
//     … scripts/tu-lam-phim.mts --creative=<sp_key>:<số creative> [--toi-da=3] [--ngan-sach=4]
// --video=<model> (vd shopaikey:grok-video-3-10s): model video cho các lượt sinh lại thay model của phim.
// --het-gio=<phút> (mặc định 25): dừng cứng khi quá giờ, in thời gian dự kiến lúc bắt đầu.
// --ngan-sach=<USD> (mặc định 4 ≈ một phim gốc sạch #120): lượt tiêu quá mức thì DỪNG, báo Telegram (MINE › Quản lý), chờ anh bảo chạy tiếp.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { lamPhimTuDau, tienPhim, uocPhut, BUOC_NGAN_SACH } from '../src/lib/xuong-video/tu-lam-phim';
import { baoTelegram, esc, gioVn } from '../src/lib/xuong-video/bao-het-tien';
import { taoPhimGocDb } from '../src/lib/xuong-video/concept-db';
import { boiCanhTap, mapCanh, taoJob, type Row } from '../src/lib/xuong-video/doc-db';
import { chayXuat, ghiBanXuat } from '../src/lib/xuong-video/xuat-chay';
import { lookPhim } from '../src/lib/xuong-video/look';
import { docKinhThanh, tien } from '../src/lib/xuong-video/kieu';

if (process.env.DUYET_SINH_1_LAN !== '1') { console.error('TỐN TIỀN — cần DUYET_SINH_1_LAN=1 sau khi anh bảo'); process.exit(1); }
const db = getDb()!;
const toiDa = Number((process.argv.find((a) => a.startsWith('--toi-da=')) ?? '').split('=')[1] || 3);
const moHinhVideo = (process.argv.find((a) => a.startsWith('--video=')) ?? '').slice(8) || undefined;
const nganSachCents = Math.round(Number((process.argv.find((a) => a.startsWith('--ngan-sach=')) ?? '').split('=')[1] || 4) * 100);
const cr = (process.argv.find((a) => a.startsWith('--creative=')) ?? '').slice(11);
let tapId = Number(process.argv[2]);
if (cr) {
  const i = cr.lastIndexOf(':'); const sp = cr.slice(0, i), so = Number(cr.slice(i + 1));
  const r = ((await db.execute(sql`SELECT id, phim_id, trang_thai FROM xv_creative WHERE sp_key = ${sp} AND so = ${so}`)) as unknown as Row[])[0];
  if (!r) { console.error(`không thấy creative #${so}`); process.exit(1); }
  let phim = r.phim_id == null ? null : Number(r.phim_id);
  if (phim == null) { const k = await taoPhimGocDb(db, Number(r.id)); if (!k.ok) { console.error(`✗ tạo phim gốc: ${k.loi}`); process.exit(1); } phim = k.data.phimId; console.log(`phim gốc #${phim} (${k.data.soShot} shot) từ creative #${so}`); }
  tapId = Number(((await db.execute(sql`SELECT id FROM xv_tap WHERE phim_id = ${phim} ORDER BY so, id LIMIT 1`)) as unknown as Row[])[0]?.id);
}
const bc = await boiCanhTap(db, tapId); if (!bc) { console.error('không thấy tập'); process.exit(1); }
const phimId = bc.tap.phim_id;
const tongPhim = () => tienPhim(db, phimId);
const truoc = await tongPhim();
// --het-gio=<phút> (mặc định 25): quá mốc thì dừng trước lần sinh kế. In thời gian dự kiến ngay đầu lượt (anh 21/10/2026).
const hetGioPhut = Number((process.argv.find((a) => a.startsWith('--het-gio=')) ?? '').split('=')[1] || 25);
const soShot = Number(((await db.execute(sql`SELECT count(*) AS n FROM xv_canh WHERE tap_id = ${tapId} AND video_url IS NULL`)) as unknown as Row[])[0]?.n ?? 0);
console.log(`dự kiến ~${uocPhut(soShot, Number(process.env.XV_CLIP_SONG_SONG || 4), 1)} phút cho ${soShot} shot chưa có clip · dừng cứng sau ${hetGioPhut} phút`);
const kq = await lamPhimTuDau(db, tapId, (s) => console.log(s), { toiDa, nganSachCents, moHinhVideo, hetGio: Date.now() + hetGioPhut * 60_000 });
if (!kq.ok) {
  console.log(`✗ dừng ở bước ${kq.buoc} — KHÔNG xuất:\n  ${kq.loi.join('\n  ')}`);
  if (kq.buoc === BUOC_NGAN_SACH) await baoTelegram(db, [
  `<b>Phim #${phimId} dừng: vượt ngân sách lượt chạy</b> (${tien(nganSachCents)})`,
  `Lượt này: ${tien((await tongPhim()) - truoc)} · tổng cả phim: ${tien(await tongPhim())}`,
  `Còn lỗi: ${esc(kq.loi.slice(1).map((l) => l.slice(0, 90)).join(' · ').slice(0, 900) || '—')}`,
  `Chờ anh bảo chạy tiếp · ${gioVn()}`,
].join('\n'));
} else {
  const b2 = (await boiCanhTap(db, tapId))!; const kt = docKinhThanh(b2.kt);
  const job = await taoJob(db, { phim_id: phimId, nhan: `Xuất bản · tập ${b2.tap.so} (tự hoàn thành)`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { tap_id: tapId, nhanh: 'A' } });
  const x = await chayXuat({ loai: b2.loai, tiLe: kt.ti_le, nhipStopMotion: kt.nhip_stop_motion, look: lookPhim(kt), canh: ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh), nhanVat: b2.nhanVat, tap: b2.tap, qc: kt.qc, nhanh: 'A' });
  if (!x.ok) { await db.execute(sql`UPDATE xv_job SET trang_thai = 'loi', loi = ${x.loi} WHERE id = ${job}`); console.log(`✗ xuất: ${x.loi}`); }
  else { await ghiBanXuat(db, { tapId, job, nhanh: 'A', kq: x }); console.log(`✓ MP4 ${x.giay}s → ${x.url}`); for (const c of x.canhBao) console.log(`  ⚠ ${c}`); }
}
console.log(`chi lượt này ${tien((await tongPhim()) - truoc)} · tổng cả phim #${phimId}: ${tien(await tongPhim())} · TONG_XONG`);
process.exit(kq.ok ? 0 : 1);

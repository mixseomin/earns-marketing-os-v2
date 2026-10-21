// TỰ HOÀN THÀNH một phim QC qua đúng quy trình studio (tu-lam-phim.ts › lamPhimTuDau): người xem (Gemini) → ảnh gốc → keyframe → giọng → clip
// (vòng tự sửa) → nhạc → mọi shot sạch thì xuất MP4 → in tổng chi phí. Chạy cho tập đã có, hoặc tạo PHIM GỐC từ creative rồi chạy.
// TỐN TIỀN (video ~$0.17/shot/lần) — chạy khi anh đã bảo làm phim đó.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/tu-lam-phim.mts <tap_id> [--toi-da=3]
//     … scripts/tu-lam-phim.mts --creative=<sp_key>:<số creative> [--toi-da=3] [--ngan-sach=4]
// --video=<model> (vd shopaikey:grok-video-3-10s): model video cho các lượt sinh lại thay model của phim.
// --het-gio=<phút> (mặc định 25): dừng cứng khi quá giờ, in thời gian dự kiến lúc bắt đầu.
// --ngan-sach=<USD> (mặc định 4 ≈ một phim gốc sạch #120): lượt tiêu quá mức thì DỪNG, báo Telegram (MINE › Quản lý) kèm nút ▶ Chạy tiếp / ⏹ Dừng: lệnh lượt
//   này ghi vào /var/lib/cty/phim-cho/<tap>.json, anh bấm thì cty (worker/phim-nut.mjs) chạy lại đúng lệnh đó một lượt, kết quả báo dưới tin (XV_BAO_TIN).
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { lamPhimTuDau, tienPhim, uocPhut, BUOC_NGAN_SACH } from '../src/lib/xuong-video/tu-lam-phim';
import { baoTelegram, esc, gioVn } from '../src/lib/xuong-video/bao-het-tien';
import fs from 'node:fs';
import { taoPhimGocDb } from '../src/lib/xuong-video/concept-db';
import { boiCanhTap, mapCanh, taoJob, type Row } from '../src/lib/xuong-video/doc-db';
import { chayXuat, ghiBanXuat } from '../src/lib/xuong-video/xuat-chay';
import { lookPhim } from '../src/lib/xuong-video/look';
import { docKinhThanh, tien } from '../src/lib/xuong-video/kieu';
import { giaVideoCong } from '../src/lib/xuong-video/cong-ai';

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
console.log(`dự kiến ~${uocPhut(soShot, Number(process.env.XV_CLIP_SONG_SONG || 10), 1)} phút cho ${soShot} shot chưa có clip · dừng cứng sau ${hetGioPhut} phút`);
// giá THẬT của đường sẽ đi (Veo trên PlenX đầy ô → tràn Kie): trần = PlenX lấy đủ ô, còn lại qua Kie (anh 21/10/2026)
{ const oP = Math.min(soShot, Math.max(1, Number(process.env.XV_PLENX_TOI_DA || 3))), vP = giaVideoCong('plenxai', 'veo3-lite').vnd ?? 800, vK = giaVideoCong('kie', 'veo3_lite').vnd ?? 4550;
  if (soShot) console.log(`giá clip (Veo Lite) tối đa ~${((oP * vP + (soShot - oP) * vK) / 1000).toFixed(1)}k₫: ${oP} shot PlenX × ${vP}₫ + ${soShot - oP} shot tràn Kie × ${vK}₫ (chưa tính sinh lại)`); }
// --chi=4,11,12 (thứ tự shot): vòng clip CHỈ chạy các shot này — anh duyệt chạy nốt N shot thì không sinh lại clip khác đang bị chấm lỗi (21/10/2026, #225)
// --xuat-du-loi: mọi shot đã có clip thì vẫn xuất bản (kèm cảnh báo) dù còn clip bị soi lỗi — bản để anh duyệt chất lượng cổng, không lên camp
const chiThuTu = ((process.argv.find((a) => a.startsWith('--chi=')) ?? '').slice(6)).split(',').map(Number).filter(Boolean);
const chi = chiThuTu.length ? ((await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId} AND thu_tu = ANY(${`{${chiThuTu.join(',')}}`}::int[])`)) as unknown as Row[]).map((r) => Number(r.id)) : undefined;
const xuatDuLoi = process.argv.includes('--xuat-du-loi');
const baoTin = Number(process.env.XV_BAO_TIN) || undefined;   // chạy từ nút ▶ trên Telegram: mọi kết cục báo dưới tin đó (cty phim-nut.mjs)
const kq0 = await lamPhimTuDau(db, tapId, (s) => console.log(s), { toiDa, nganSachCents, moHinhVideo, hetGio: Date.now() + hetGioPhut * 60_000, chi });
const duClip = Number(((await db.execute(sql`SELECT count(*) AS n FROM xv_canh WHERE tap_id = ${tapId} AND video_url IS NULL`)) as unknown as Row[])[0]?.n ?? 1) === 0;
const kq = xuatDuLoi && duClip && kq0.buoc === 'clip' ? { ...kq0, ok: true } : kq0;
if (xuatDuLoi && duClip && !kq0.ok && kq0.buoc === 'clip') console.log(`⚠ xuất bản dù còn clip lỗi (--xuat-du-loi):\n  ${kq0.loi.join('\n  ')}`);
if (!kq.ok) {
  console.log(`✗ dừng ở bước ${kq.buoc} — KHÔNG xuất:\n  ${kq.loi.join('\n  ')}`);
  if (kq.buoc === BUOC_NGAN_SACH) {
    // lệnh lượt này (bỏ --creative: phim gốc đã có, lượt sau chạy thẳng tập) → nút Chạy tiếp chạy lại đúng nó (anh 21/10/2026: trả lời trên Tele luôn)
    const cho = { phim: phimId, tran: tien(nganSachCents), argv: [String(tapId), ...process.argv.slice(2).filter((a) => a.startsWith('--') && !a.startsWith('--creative='))] };
    let coNut = true; try { const d = `${process.env.CTY_DATA_DIR || '/var/lib/cty'}/phim-cho`; fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(`${d}/${tapId}.json`, JSON.stringify(cho)); } catch { coNut = false; }
    await baoTelegram(db, [
      `<b>Phim #${phimId} dừng: vượt ngân sách lượt chạy</b> (${tien(nganSachCents)})`,
      `Lượt này: ${tien((await tongPhim()) - truoc)} · tổng cả phim: ${tien(await tongPhim())}`,
      `Còn lỗi: ${esc(kq.loi.slice(1).map((l) => l.slice(0, 90)).join(' · ').slice(0, 900) || '—')}`,
      `${coNut ? 'Bấm ▶ để chạy thêm một lượt (cùng trần)' : 'Chờ anh bảo chạy tiếp'} · ${gioVn()}`,
    ].join('\n'), coNut ? { nut: [{ text: `▶ Chạy tiếp (trần ${tien(nganSachCents)})`, callback_data: `ph:tiep:${tapId}` }, { text: '⏹ Dừng', callback_data: `ph:dung:${tapId}` }], traLoi: baoTin } : { traLoi: baoTin });
  } else if (baoTin) await baoTelegram(db, `⚠️ <b>Phim #${phimId} dừng ở bước ${esc(kq.buoc)}</b> — không xuất\n${esc(kq.loi.map((l) => l.slice(0, 120)).join('\n').slice(0, 900))}`, { traLoi: baoTin });
} else {
  const b2 = (await boiCanhTap(db, tapId))!; const kt = docKinhThanh(b2.kt);
  const job = await taoJob(db, { phim_id: phimId, nhan: `Xuất bản · tập ${b2.tap.so} (tự hoàn thành)`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { tap_id: tapId, nhanh: 'A' } });
  const x = await chayXuat({ loai: b2.loai, tiLe: kt.ti_le, nhipStopMotion: kt.nhip_stop_motion, look: lookPhim(kt), canh: ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh), nhanVat: b2.nhanVat, tap: b2.tap, qc: kt.qc, nhanh: 'A' });
  if (!x.ok) { await db.execute(sql`UPDATE xv_job SET trang_thai = 'loi', loi = ${x.loi} WHERE id = ${job}`); console.log(`✗ xuất: ${x.loi}`); }
  else { await ghiBanXuat(db, { tapId, job, nhanh: 'A', kq: x }); console.log(`✓ MP4 ${x.giay}s → ${x.url}`); for (const c of x.canhBao) console.log(`  ⚠ ${c}`); }
  if (baoTin) await baoTelegram(db, x.ok ? `✅ <b>Phim #${phimId} xong</b> — MP4 ${x.giay}s: ${esc(x.url)}\nLượt này ${tien((await tongPhim()) - truoc)} · tổng ${tien(await tongPhim())}` : `⚠️ Phim #${phimId} đủ clip nhưng xuất lỗi: ${esc(String(x.loi).slice(0, 300))}`, { traLoi: baoTin });
}
console.log(`chi lượt này ${tien((await tongPhim()) - truoc)} · tổng cả phim #${phimId}: ${tien(await tongPhim())} · TONG_XONG`);
process.exit(kq.ok ? 0 : 1);

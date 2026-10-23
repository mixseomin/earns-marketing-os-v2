// CHẤM CẢ TẬP (0đ, không gọi model — anh 24/10/2026: "các phiên bản trước đều có hệ chấm điểm khá chi tiết cho cả prompt? Đoạn này đã chấm chưa?"):
// một lệnh in đủ: điểm prompt từng shot (kiem-prompt.ts qua diem-prompt.ts: keyframe + video) · bộ chấm kịch bản / phim ngắn dọc (cham-kich-ban.ts —
// gồm cắt có cớ) · trạng thái đồ từng shot (ky_thuat.vat, so-vat.ts) · kỳ vọng hướng (ky_thuat.huong_so). Ghi diem_prompt vào xv_canh như thường.
//   … tsx scripts/cham-tap.mts <tap_id>
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { ghiDiemPromptTap } from '../src/lib/xuong-video/diem-prompt';
import { chamKichBan } from '../src/lib/xuong-video/cham-kich-ban';
import { mapCanh, mapTap, type Row } from '../src/lib/xuong-video/doc-db';
import { docKinhThanh } from '../src/lib/xuong-video/kieu';

const tapId = Number(process.argv[2]); if (!tapId) { console.error('cần <tap_id>'); process.exit(1); }
const db = getDb()!; const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
await ghiDiemPromptTap(db, tapId);
const tap = mapTap((await q(sql`SELECT * FROM xv_tap WHERE id = ${tapId}`))[0]!);
const phim = docKinhThanh((await q(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${tap.phim_id}`))[0]!.kinh_thanh);
const canh = (await q(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)).map(mapCanh);
console.log('── ĐIỂM PROMPT TỪNG SHOT (keyframe / video · lỗi phạt ≥ 20 là chặn sinh)');
for (const c of canh) { const d = c.diem_prompt; console.log(`#${c.thu_tu} ${d ? `${d.diem} (kf ${d.diem_keyframe} · video ${d.diem_video})` : '—'}${d?.loi.length ? ` — ${d.loi.map((l) => `[${l.buoc} −${l.phat}] ${l.chu}`).join(' · ')}` : ''}`); }
const kb = chamKichBan({ tap: { so: tap.so, beats: tap.beats, phan_canh: tap.phan_canh.map((p) => ({ ten: p.ten, beat: p.beat ?? '' })) }, canh, kt: { logline: phim.logline, series: phim.series, khong_loi: phim.khong_loi, the_loai: phim.the_loai } });
console.log(`── KỊCH BẢN / PHIM NGẮN DỌC: ${kb.diem} điểm${kb.chan.length ? ` · CHẶN: ${kb.chan.join(' · ')}` : ''}`);
for (const m of kb.muc) console.log(`${m.dat ? '✓' : '✗'}${m.cung ? ' (chặn)' : ''} ${m.ten}: ${m.ghi}`);
console.log('── ĐỒ VẬT / HƯỚNG TỪNG SHOT');
for (const c of canh) console.log(`#${c.thu_tu} ${(c.ky_thuat?.vat ?? []).join(' · ') || '(chưa có sổ đồ)'}${c.ky_thuat?.huong_so ? ` | hướng ${JSON.stringify(c.ky_thuat.huong_so)}` : ''}`);
process.exit(0);

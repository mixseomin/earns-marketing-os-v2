// ĐIỂM NHÌN QUA CÚ CẮT cả tập (eye trace — diem-nhin.ts + diem-nhin-tap.ts). 0đ. Bản dựng đã TỰ chạy mỗi lần xuất (xuat-tap.ts); script để xem bảng / ép đo lại.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/diem-nhin.mts <tap_id> [--ghi] [--lam-lai]
import { getDb } from '@mos2/db';
import { doDiemNhinTap } from '../src/lib/xuong-video/diem-nhin-tap';
import { NGUONG_LECH, type Diem } from '../src/lib/xuong-video/diem-nhin';

const tap = Number(process.argv[2]); if (!tap) { console.error('cần <tap_id>'); process.exit(1); }
const r = await doDiemNhinTap(getDb()!, tap, { ghi: process.argv.includes('--ghi'), lamLai: process.argv.includes('--lam-lai') });
const pt = (p: Diem | null | undefined) => (p ? `${p.x.toFixed(2)},${p.y.toFixed(2)}` : '—');
console.log(`ngưỡng lệch ${NGUONG_LECH} khung · shot: điểm mở (ai) → điểm đóng · lệch với cuối shot trước: gốc → sau khi dựng lại · khung`);
for (const s of r.shot) console.log(`#${s.thu_tu}: ${pt(s.dn?.dau)} (${s.dn?.ten_dau ?? '—'}) → ${pt(s.dn?.cuoi)} · lệch ${s.dn?.lech_goc ?? '—'} → ${s.dn?.lech_sau ?? '—'}${(s.dn?.lech_goc ?? 0) > NGUONG_LECH ? ' ⚠' : ''} · ${s.k.s > 1 ? `phóng ${s.k.s} tâm ${s.k.cx},${s.k.cy}` : 'giữ'}`);
if (process.argv.includes('--ghi')) console.log('đã ghi khung_lai + diem_nhin');
process.exit(0);

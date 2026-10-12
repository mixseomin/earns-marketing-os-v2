// Các bước dựng 0đ cho cả tập (12/10/2026) — cùng hàm với nút trên studio (hau-ky.ts, khop-nhip.ts). Thứ tự đúng khi chạy nhiều cờ:
// khớp giây theo giọng → khớp nhịp nhạc → nhịp hành động (impact đặt ở điểm cắt ĐÃ khớp).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/hau-ky.mts --tap=<id> [--khop-giong] [--khop-nhip] [--nhip-hanh-dong]
import { getDb } from '@mos2/db';
import { khopGiongTap, nhipHanhDongTap } from '../src/lib/xuong-video/hau-ky';
import { khopNhipTap } from '../src/lib/xuong-video/khop-nhip';

const arg = (k: string) => process.argv.includes(`--${k}`);
const tapId = Number((process.argv.find((a) => a.startsWith('--tap=')) ?? '').split('=')[1] || 0);
const db = getDb(); if (!db || !tapId) { console.error('thiếu --tap=<id> hoặc DATABASE_URL'); process.exit(1); }
const ai = 'script hau-ky';
if (arg('khop-giong')) { const r = await khopGiongTap(db, tapId, ai); console.log(r.ok ? `⏱ khớp giọng: ${r.data.doi} shot đổi giây · tổng ${r.data.tong}s${r.data.thieu ? ` · ${r.data.thieu} shot còn thiếu giọng` : ''}` : `✗ ${r.loi}`); }
if (arg('khop-nhip')) { const r = await khopNhipTap(db, tapId, ai); console.log(r.ok ? `🎯 khớp nhịp: ${r.data.khop}/${r.data.diemCat} điểm cắt trúng phách (${r.data.bpm.join(' / ')} BPM) · ${r.data.doi} shot đổi giây` : `✗ ${r.loi}`); }
if (arg('nhip-hanh-dong')) { const r = await nhipHanhDongTap(db, tapId, ai); console.log(r.ok ? `⚡ nhịp hành động: +${r.data.impact} impact · ${r.data.shot} shot thêm tiếng` : `✗ ${r.loi}`); }
process.exit(0);

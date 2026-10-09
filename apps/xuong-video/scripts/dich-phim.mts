// Dịch CẢ PHIM sang ngôn ngữ khác trên box — TỐN TIỀN (Claude, theo lô), chỉ chạy khi anh đã duyệt con số:
//   --phim=<id> --sang=en          : mặc định chỉ ƯỚC LƯỢNG (0đ): số chuỗi tiếng Việt còn lại, số lô, tiền.
//   --phim=<id> --sang=en --chay   : dịch mọi chuỗi tiếng Việt (anchor, kinh thánh, tập, shot, thoại), ghi DB, ↶ Hoàn tác được.
//   --canh=73,74                   : CHỈ chữ của các shot này + anchor trong shot + phong cách (làm từng shot cho đạt trước).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/dich-phim.mts --phim=5 --sang=en
import { getDb } from '@mos2/db';
import { docPhimDich, uocDichCents, chayDichPhim } from '../src/lib/xuong-video/dich-phim';
import { docKinhThanh, tien, tenNgonNgu, NGON_NGU } from '../src/lib/xuong-video/kieu';

const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? '';
const phimId = Number(gia('phim') || 0);
const sang = gia('sang') || 'en';
if (!phimId) { console.error('thiếu --phim=<id>'); process.exit(1); }
if (!NGON_NGU.some((x) => x.value === sang)) { console.error(`--sang lạ: ${sang}`); process.exit(1); }
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const chiShot = ((process.argv.find((a) => a.startsWith('--canh=')) ?? '').split('=')[1] ?? '').split(',').map(Number).filter((x) => x > 0);
const nd = await docPhimDich(db, phimId, chiShot.length ? chiShot : undefined);
if (!nd) { console.error('không thấy phim'); process.exit(1); }
const kt = docKinhThanh(nd.kt);
console.log(`phim #${phimId} · ${tenNgonNgu(kt.ngon_ngu)} → ${tenNgonNgu(sang)} · model ${kt.mo_hinh_chu}`);
console.log(`  còn ${nd.chuoi.length} chuỗi tiếng Việt · ${nd.chars} ký tự · ${nd.soLo} lô · ${nd.soCoGiong} shot có giọng tiếng Việt`);
console.log(`  ước ≈ ${tien(uocDichCents(kt.mo_hinh_chu, nd.chars, nd.soLo))}`);
console.log(`  ${chiShot.length ? `chỉ shot id ${chiShot.join(', ')} · ` : ''}mẫu: ${nd.chuoi.slice(0, 6).map((x) => JSON.stringify(x.slice(0, 50))).join(' · ')}`);
if (!process.argv.includes('--chay')) { console.log('(chỉ ước lượng — thêm --chay để dịch)'); process.exit(0); }
const r = await chayDichPhim(db, phimId, sang, 'script dich-phim', (i, n) => console.log(`  lô ${i}/${n}…`), chiShot.length ? chiShot : undefined);
if (!r.ok) { console.error('  ✗', r.loi); process.exit(1); }
console.log(`  ✓ ${r.data.soBanGhi} bản ghi · đã chi ${tien(r.data.cents)} · còn ${r.data.conViet} chuỗi tiếng Việt · ${r.data.boGiong} dòng thoại cần sinh lại giọng`);
console.log(`  https://studio.on.tc/?m=phim&mId=${phimId}`);
process.exit(0);

// Dịch cả tập sang ngôn ngữ khác trên box (không cần phiên đăng nhập) — TỐN TIỀN (một lượt Claude), chỉ chạy khi anh đã duyệt con số:
//   --tap=<id> --sang=en            : mặc định chỉ ƯỚC LƯỢNG (0đ): số ký tự, số shot, tiền theo model chữ của phim.
//   --tap=<id> --sang=en --chay     : gọi Claude dịch kịch bản + chữ màn + thoại + bài đăng, ghi DB, đổi ngon_ngu của phim; keyframe/video giữ nguyên.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/dich-tap.mts --tap=6 --sang=en
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { docNoiDungDich, uocDichCents, apDungDich } from '../src/lib/xuong-video/dich-tap';
import { dichNoiDung } from '../src/lib/xuong-video/claude';
import { docKinhThanh, giaChuCents, tien, tenNgonNgu, NGON_NGU } from '../src/lib/xuong-video/kieu';

const arg = (k: string) => process.argv.includes(`--${k}`);
const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? '';
const tapId = Number(gia('tap') || 0);
const sang = gia('sang') || 'en';
if (!tapId) { console.error('thiếu --tap=<id>'); process.exit(1); }
if (!NGON_NGU.some((x) => x.value === sang)) { console.error(`--sang lạ: ${sang} (có: ${NGON_NGU.map((x) => x.value).join(', ')})`); process.exit(1); }
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const nd = await docNoiDungDich(db, tapId);
if (!nd) { console.error('không thấy tập'); process.exit(1); }
const kt = docKinhThanh(nd.kt);
console.log(`tập #${tapId} · phim #${nd.phimId} · ${tenNgonNgu(kt.ngon_ngu)} → ${tenNgonNgu(sang)} · model ${kt.mo_hinh_chu}`);
console.log(`  kịch bản ${nd.dauVao.kichBan.length} ký tự · ${nd.dauVao.canh.length} shot · bài đăng ${nd.dauVao.baiDang ? 'có' : 'không'} · tổng ${nd.chars} ký tự · ${nd.soCoGiong} shot đã có giọng`);
console.log(`  ước ≈ ${tien(uocDichCents(kt.mo_hinh_chu, nd.chars))}`);
if (!arg('chay')) { console.log('(chỉ ước lượng — thêm --chay để dịch)'); process.exit(0); }
const kq = await dichNoiDung({ kinhThanh: nd.kt, sang, ...nd.dauVao });
if (!kq.ok) { console.error('lỗi:', kq.loi); process.exit(1); }
const cents = giaChuCents(kq.model, kq.tokens.in, kq.tokens.out);
await db.execute(sql`INSERT INTO xv_job (phim_id, nhan, loai, provider, model, trang_thai, chi_phi_cents, tokens_in, tokens_out)
  VALUES (${nd.phimId}, ${`Dịch tập sang ${tenNgonNgu(sang)} (${nd.dauVao.canh.length} shot)`}, 'chu', 'anthropic', ${kq.model}, 'xong', ${Math.round(cents * 100) / 100}, ${kq.tokens.in}, ${kq.tokens.out})`);
const r = await apDungDich(db, nd, tapId, sang, kq.data);
console.log(`  ✓ đã dịch ${r.soShot} shot${r.thieu ? ` (${r.thieu} shot bị bỏ sót, giữ chữ cũ)` : ''} · token ${kq.tokens.in}/${kq.tokens.out} · đã chi ${tien(cents)}${nd.soCoGiong ? ` · ${nd.soCoGiong} shot có giọng cũ cần sinh lại` : ''}`);
console.log(`  https://studio.on.tc/?m=phim&mId=${nd.phimId}`);
process.exit(0);

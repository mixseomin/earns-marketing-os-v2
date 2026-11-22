#!/usr/bin/env node
// MÁY VIẾT BÀI SUBSTACK / MEDIUM cho máy có nền bài viết dài trong xv_may.dang (19/11/2026, kho social:kho|militarycalc|substack).
// Gốc: puzzle-books sinh-bai.mjs chỉ viết câu trả lời Quora → máy có nền substack (militarycalc) không bao giờ có bài, kho luôn 0.
// Một lượt = một góc spy chưa dùng cho bài dài: studio --viet-bai-dai (chữ AI rẻ, tệp sự thật su-that/<máy>.md, ảnh ngang Pexels thật, link đích + UTM)
// → nạp qua đường chung puzzle-books nap-bai.mjs › napBai → Phòng Nội dung chấm → máy đăng dang-may tự đăng. Không bấm đăng ở đây.
//   node apps/xuong-video/scripts/sinh-bai-dai.mjs --may militarycalc [--nen substack] [--so 7] [--xem]     (iMac; --xem: chỉ in góc sẽ viết, 0đ)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { GIA_UOC_BAI_DAI_VND, NGUONG_TU_CHAY_VND } from '../src/lib/xuong-video/chot-tien-nguong.mjs';

const PB = '/Users/htuan/puzzle-books/scripts';
const a = process.argv.slice(2), lay = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] ?? '' : null; };
/** slug bài dài: dai-<góc>-<5 chữ đầu tiêu đề>. Thuần. */
export const slugDai = (goc, tieuDe) => `dai-${goc}-${String(tieuDe).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 5).join('-')}`;
/** id ảnh Pexels trong HTML bài. Thuần. */
export const idAnh = (h) => Number(String(h ?? '').match(/pexels\.com\/photos\/(\d+)\//)?.[1] ?? 0) || null;

export const duocTuChay = (tien) => tien + GIA_UOC_BAI_DAI_VND < NGUONG_TU_CHAY_VND;

if (a.includes('--tu-kiem')) {
  const t = (await import('node:assert')).strict;
  t.equal(slugDai(42939, 'How BAH Works: A Plain Guide for 2026'), 'dai-42939-how-bah-works-a-plain');
  t.equal(idAnh('<img src="https://images.pexels.com/photos/123/pexels-photo-123.jpeg?w=1600">'), 123); t.equal(idAnh('x'), null);
  t.equal(duocTuChay(0), true, 'bài 1: 2.000₫ còn dưới ngưỡng');
  t.equal(duocTuChay(2000), true, 'bài 2: cộng dồn 4.000₫ còn dưới ngưỡng');
  t.equal(duocTuChay(4000), false, 'bài 3: cộng dồn 6.000₫ phải dừng');
  console.log('sinh-bai-dai: 6/6 ok'); process.exit(0);
}
const may = lay('--may'); if (!may) { console.error('cần --may <mã máy>'); process.exit(2); }
const NEN = lay('--nen') ?? 'substack', SO = Math.max(1, Math.min(7, Number(lay('--so') ?? 1))), XEM = a.includes('--xem'), LAI = a.includes('--lai');
const { studio, dsMay, thongTinMay } = await import(`${PB}/day-studio.mjs`), { napBai } = await import(`${PB}/nap-bai.mjs`);
if (!thongTinMay(may).dang.some((d) => d.nen === NEN)) { console.error(`máy ${may} không có nền ${NEN} trong xv_may.dang`); process.exit(1); }
const ssh = (lenh) => execFileSync('ssh', ['-o', 'ControlMaster=no', '-o', 'ConnectTimeout=15', 'root@167.233.241.16', lenh], { encoding: 'utf8', timeout: 120_000 }).trim();
const goc_sp = JSON.parse(ssh(`cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -tA -c "select coalesce(json_agg(x), '[]') from unnest((select goc_sp from xv_may where ma = '${may}')) x"`) || '[]');
if (!goc_sp.length) { console.error(`máy ${may} chưa gắn nhóm góc spy (xv_may.goc_sp)`); process.exit(1); }
const gocs = JSON.parse(ssh(`U=$(grep ^DATABASE_URL= /root/.secrets/spy.env | cut -d= -f2-); psql "$U" -tA -c "select coalesce(json_agg(json_build_object('sp', sp_id, 'id', id, 'loai', loai, 'ten', ten) order by id), '[]') from goc where sp_id = any(array[${goc_sp.map(Number).join(',')}])"`) || '[]');
const bai = Object.entries(dsMay({ caLuuTru: true, may })).filter(([s, m]) => m.loai === 'bai' && s.startsWith('dai-')).map(([, m]) => m);
const baiLai = bai.filter((m) => !m.da_dang && (m.cham?.ket === 'SUA_LAI' || m.cham?.ket === 'KHONG_DUYET'));
const dsGocLai = new Map(baiLai.map((m) => [Number(m.goc?.id), m]));
const daGoc = new Set(bai.filter((m) => !LAI || !dsGocLai.has(Number(m.goc?.id))).map((m) => Number(m.goc?.id)).filter(Boolean)), tieuDeCu = bai.map((m) => m.title).filter(Boolean), anhDaDung = bai.map((m) => idAnh(m.html)).filter(Boolean);
// bài dài cần góc là NGƯỜI / TÌNH HUỐNG / NỖI ĐAU (viết được hướng dẫn); góc tiêu chí / phàn nàn app (quảng cáo, crash, phân số) để sau cùng — mổ kho militarycalc 19/11/2026
const UU = ['ai_tinh_huong', 'ai_noi_dau', 'ai_chan_dung', 'ai_cach_giai'], hang = (g) => (UU.indexOf(g.loai) + 1 || 99);
const chiGoc = lay('--goc') ? new Set(lay('--goc').split(',').map(Number)) : null;
let moi = 0, tien = 0;
for (const g of gocs.filter((x) => !daGoc.has(Number(x.id)) && (!chiGoc || chiGoc.has(Number(x.id)))).sort((x, y) => hang(x) - hang(y) || x.id - y.id)) {
  if (moi >= SO) break;
  if (XEM) { console.log(`→ góc #${g.id} "${g.ten}"`); moi++; continue; }
  if (process.env.DUYET_SINH_1_LAN !== '1' && tien + GIA_UOC_BAI_DAI_VND >= NGUONG_TU_CHAY_VND) {
    console.error(`dừng: cộng dồn ${Math.round(tien)}₫, vượt ngưỡng tự chạy ${NGUONG_TU_CHAY_VND}₫ — cần anh duyệt`);
    break;
  }
  const vb = JSON.parse(studio('--viet-bai-dai', JSON.stringify({ goc: g, slug: `dai-${g.id}`, tieu_de_cu: tieuDeCu, anh_da_dung: anhDaDung }), may).trim().split('\n').pop());
  tien += Number(vb.vnd ?? 0);
  if (!vb.ok) { console.log(`✗ góc #${g.id}: ${vb.loi} (${Math.round(vb.vnd ?? 0)}₫)`); if (/TỐN TIỀN/.test(vb.loi)) break; continue; }
  const slug = slugDai(g.id, vb.tieu_de), dir = `${PB}/../out/bai/${may}/`; mkdirSync(dir, { recursive: true });
  const tep = `${dir}${slug}.html`; writeFileSync(tep, vb.html);
  const cu = dsGocLai.get(Number(g.id));
  if (cu && cu.slug !== slug) {
    const q = `UPDATE xv_may_video SET luu_tru = true, dang = coalesce(dang, '{}'::jsonb) || jsonb_build_object('thay_bang', '${slug.replace(/'/g, "''")}'::text), updated_at = now() WHERE id = ${Number(cu.id)} AND coalesce(da_dang, '{}'::jsonb) = '{}'::jsonb`;
    ssh(`cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c '${q}'`);
  }
  napBai({ may, tep, noiDung: vb.html, goc: g, truy: vb.truy, slug, anh: vb.anh });
  console.log(`✓ ${slug} (${vb.model}, ${Math.round(vb.vnd)}₫) → Phòng Nội dung chấm · ${tep}`);
  tieuDeCu.push(vb.tieu_de); if (idAnh(vb.anh)) anhDaDung.push(idAnh(vb.anh)); moi++;
}
console.log(`sinh-bai-dai ${may} ${NEN}: ${moi}/${SO} bài${XEM ? ' (xem)' : ''} · tiền AI ${Math.round(tien)}₫`);

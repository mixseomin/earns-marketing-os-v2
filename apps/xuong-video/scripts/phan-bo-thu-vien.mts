// PHÂN BỔ thư viện bối cảnh + diễn viên cho mọi bộ hình (cặp đang bật × biến thể) của một sản phẩm (thu-vien-dien.ts › phanBo, 0đ):
// diễn viên chính hợp yeu_cau của concept, người phụ theo quan hệ (có cặp đồng giới), hai bối cảnh khác nhóm hợp dịp + hoạt động, áo đổi theo bộ hình.
// Ghi xv_bien_the_hinh (nguoi_chinh / nguoi_phu / boi_canh + o: tên, bối cảnh 2, giọng); bản cũ chép ra <tệp>.bien-the-<ngày>.json trước khi ghi.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/phan-bo-thu-vien.mts scripts/du-lieu/o-hinh/jettjeans.json [--ghi]
import { readFileSync, writeFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { phanBo, moTaChinh, moTaPhu, moTaGiong, SAC_TOC, NHOM_BOI_CANH, type YeuCau } from '../src/lib/xuong-video/thu-vien-dien';

type Row = Record<string, unknown>;
const tep = process.argv[2]!; const ghi = process.argv.includes('--ghi');
const d = JSON.parse(readFileSync(tep, 'utf8')) as { sp_key: string; concept: Record<string, { yeu_cau?: YeuCau }> };
const db = getDb()!;
const bt = (await db.execute(sql`SELECT b.*, k.ma AS k_ma FROM xv_bien_the_hinh b JOIN xv_cap c ON c.id = b.cap_id JOIN xv_concept k ON k.id = c.concept_id
  WHERE k.sp_key = ${d.sp_key} AND c.bat AND NOT b.an ORDER BY b.so, k.ma, c.template_id`)) as unknown as Row[];
const kq = phanBo(bt.map((b) => ({ key: String(b.id), concept: String(b.k_ma), yc: d.concept[String(b.k_ma)]?.yeu_cau ?? { gioi: ['nam'] } })));
const dem = (f: (x: (typeof kq)[number]) => string) => [...kq.reduce((m, x) => m.set(f(x), (m.get(f(x)) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
console.log(`${bt.length} bộ hình · ${new Set(kq.map((x) => x.chinh.ma)).size} diễn viên chính · ${new Set(kq.map((x) => x.boi_canh.ma)).size} bối cảnh chính · ${kq.filter((x) => x.phu.qh.lgbt).length} cặp đồng giới`);
console.log('  sắc tộc:', dem((x) => SAC_TOC[x.chinh.sac_toc] ?? x.chinh.sac_toc).map(([k, n]) => `${k} ${n}`).join(' · '));
console.log('  nhóm bối cảnh:', dem((x) => NHOM_BOI_CANH[x.boi_canh.nhom] ?? x.boi_canh.nhom).map(([k, n]) => `${k} ${n}`).join(' · '));
for (const x of kq.slice(0, 6)) console.log(`  #${x.key}: ${x.chinh.ten} — ${moTaChinh(x)} | ${x.phu.qh.vi}: ${x.phu.dv.ten} | ${x.boi_canh.ten} + ${x.boi_canh_2.ten}`);
if (!ghi) { console.log('(chưa ghi — thêm --ghi)'); process.exit(0); }
const saoLuu = tep.replace(/\.json$/, `.bien-the-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(saoLuu, JSON.stringify(bt.map((b) => ({ id: b.id, nguoi_chinh: b.nguoi_chinh, nguoi_phu: b.nguoi_phu, boi_canh: b.boi_canh, o: b.o })), null, 1));
for (const x of kq) {
  const o = { nhan_vat_ten: x.chinh.ten, nguoi_2_ten: x.phu.dv.ten, boi_canh_2: x.boi_canh_2.prompt, giong: moTaGiong(x.chinh), giong_2: moTaGiong(x.phu.dv),
    tv: JSON.stringify({ chinh: x.chinh.ma, phu: x.phu.dv.ma, qh: x.phu.qh.ma, bc: x.boi_canh.ma, bc2: x.boi_canh_2.ma, ao: x.ao }) };
  await db.execute(sql`UPDATE xv_bien_the_hinh SET nguoi_chinh = ${moTaChinh(x)}, nguoi_phu = ${moTaPhu(x)}, boi_canh = ${x.boi_canh.prompt}, o = ${JSON.stringify(o)}::jsonb WHERE id = ${Number(x.key)}`);
}
console.log(`✓ ghi ${kq.length} biến thể · sao lưu ${saoLuu}`);
process.exit(0);

// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/thu-vien-dien.test.mts
import assert from 'node:assert';
import { phanBo, BOI_CANH, DIEN_VIEN, SAC_TOC, moTaChinh } from './thu-vien-dien';
assert.ok(BOI_CANH.length >= 80 && DIEN_VIEN.length >= 140);
assert.strictEqual(new Set(DIEN_VIEN.map((d) => d.sac_toc)).size, Object.keys(SAC_TOC).length);
assert.ok(DIEN_VIEN.some((d) => d.gioi === 'phi_nhi_nguyen') && DIEN_VIEN.some((d) => d.tuoi >= 70) && DIEN_VIEN.some((d) => d.tuoi < 25));
// 40 bộ hình nam 30–45 → mọi sắc tộc đều có, không người chính nào lặp quá 2 lần, bối cảnh chính trải ≥ 25 nơi
const viec = Array.from({ length: 40 }, (_, i) => ({ key: String(i), concept: 'X', yc: { gioi: ['nam' as const], tuoi: [28, 50] as [number, number], hoat_dong: ['ngoi', 'xom'] } }));
const k = phanBo(viec);
assert.strictEqual(new Set(k.map((x) => x.chinh.sac_toc)).size, Object.keys(SAC_TOC).length, 'mọi sắc tộc');
assert.ok(Math.max(...[...k.reduce((m, x) => m.set(x.chinh.ma, (m.get(x.chinh.ma) ?? 0) + 1), new Map<string, number>()).values()]) <= 2);
assert.ok(new Set(k.map((x) => x.boi_canh.ma)).size >= 25, `bối cảnh chính ${new Set(k.map((x) => x.boi_canh.ma)).size}`);
assert.ok(k.every((x) => x.chinh.gioi === 'nam' && x.chinh.tuoi >= 28 && x.chinh.tuoi <= 50));
assert.ok(k.every((x) => x.boi_canh.nhom !== x.boi_canh_2.nhom), 'hai bối cảnh khác nhóm');
assert.ok(k.every((x) => x.boi_canh.hoat_dong.some((h) => ['ngoi', 'xom'].includes(h))));
const lg = k.filter((x) => x.phu.qh.lgbt).length; assert.ok(lg >= 6 && lg <= 10, `cặp đồng giới ${lg}/40`);
assert.ok(!moTaChinh(k[0]!).match(/jeans|pants|trousers/i), 'mô tả người không ghi quần');
console.log('thu-vien-dien.test: ok');

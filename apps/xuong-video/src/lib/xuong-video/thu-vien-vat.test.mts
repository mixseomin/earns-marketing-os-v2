// Tự kiểm thư viện vật dụng (vat-dung.json qua thu-vien-vat.ts): node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/thu-vien-vat.test.mts
import assert from 'node:assert';
import { VAT_DUNG, NHOM_VAT, KHO_VAT, PHOI_HOP, phoiHopCua, vanPhoiHop, vanKhoVat } from './thu-vien-vat';

assert.strictEqual(new Set(VAT_DUNG.map((v) => v.ma)).size, VAT_DUNG.length, 'mã vật trùng');
for (const v of VAT_DUNG) {
  assert.ok(NHOM_VAT[v.nhom], `${v.ma}: nhóm lạ "${v.nhom}"`);
  assert.ok(v.mo_ta.trim() && v.cong_nang.length, `${v.ma}: thiếu mô tả hình / công năng`);
  for (const b of v.bo_phan ?? []) for (const c of b.cong_nang) assert.ok(v.cong_nang.some((x) => x.ten === c), `${v.ma} › ${b.ten}: công năng "${c}" không có trong vật`);
}
for (const p of PHOI_HOP) { assert.ok(p.vat.length >= 2, `phối hợp "${p.ten}" cần ≥ 2 vật`); for (const m of p.vat) assert.ok(KHO_VAT[m], `phối hợp "${p.ten}": vật lạ "${m}"`); }
// phối hợp chỉ hiện khi đủ vật; khối dặn rỗng khi không đủ — kiểm có thể đỏ
assert.ok(phoiHopCua('don_ganh').length > phoiHopCua('don_ganh', ['don_ganh']).length);
assert.strictEqual(vanPhoiHop(['don_ganh']), '');
assert.ok(vanPhoiHop(['don_ganh', 'ghe_nhua_thap']).includes('Cáng'));
assert.ok(vanKhoVat('ghe_nhua_thap').includes('Bộ phận:') && vanKhoVat('khong_co') === '');
console.log(`✓ thu-vien-vat (${VAT_DUNG.length} vật · ${PHOI_HOP.length} phối hợp)`);

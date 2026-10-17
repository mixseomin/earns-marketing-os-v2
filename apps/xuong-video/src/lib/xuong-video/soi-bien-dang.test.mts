// cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx src/lib/xuong-video/soi-bien-dang.test.mts
// zodSangGemini đọc được zod v3 lẫn v4 ('zod/v4' — khuôn của claude.ts); bản đầu chỉ đọc v3 nên khuôn người xem thành STRING (17/10/2026).
import assert from 'node:assert';
import { z as z3 } from 'zod';
import { z as z4 } from 'zod/v4';
import { zodSangGemini } from './soi-bien-dang';
for (const z of [z3, z4] as const) {
  const zz = z as typeof z4;
  const sc = zodSangGemini(zz.object({ ai: zz.string().describe('Sản phẩm là gì'), ds: zz.array(zz.object({ s: zz.number() })), b: zz.boolean().optional() })) as { type: string; required: string[]; properties: Record<string, { type: string; description?: string; items?: { type: string } }> };
  assert.strictEqual(sc.type, 'OBJECT'); assert.strictEqual(sc.properties.ai!.description, 'Sản phẩm là gì');
  assert.strictEqual(sc.properties.ds!.items!.type, 'OBJECT'); assert.strictEqual(sc.properties.b!.type, 'BOOLEAN'); assert.deepStrictEqual(sc.required, ['ai', 'ds', 'b']);
}
console.log('soi-bien-dang.test: ok');
import { laChiTietNho, laLoiTay } from './soi-bien-dang';
assert.ok(laLoiTay('The right hand has deformed, overlapping extra fingers while grabbing the knee'), 'đầu gối chỉ là chỗ chạm — vẫn là lỗi tay');
assert.ok(laLoiTay('Right hand fingers are distorted'));
assert.ok(!laLoiTay('The pant legs merge into a single tube'));
assert.ok(!laLoiTay('Sock floats detached from hand mid-air', 'vat_the_la'), 'vật cầm tay là lỗi vật thể, không qua xác nhận');
assert.ok(!laLoiTay('The legs and hands merge into one limb'), 'nhắc chân → lỗi chân');
assert.ok(laChiTietNho('Folded pants morph to show denim scoop pocket and seams instead of flat dress pant design.', 'san_pham_doi_kieu', 'Medium-wide shot of two people'));
assert.ok(laChiTietNho('Pants have rounded scoop pockets instead of dress slash pockets.', 'san_pham_doi_kieu', 'Static shot of two people sitting'));
assert.ok(!laChiTietNho('Pants have rounded scoop pockets instead of dress slash pockets.', 'san_pham_doi_kieu', 'Extreme close-up of the front pocket'));
assert.ok(!laChiTietNho('The trousers turn into blue jeans shorts with pockets', 'san_pham_doi_kieu', 'medium shot'));
assert.ok(!laChiTietNho('The pants change color from black to grey with pockets', 'san_pham_doi_kieu', 'medium shot'));
assert.ok(!laChiTietNho('scoop pockets', 'trang_phuc_bien_dang', 'medium shot'));
console.log('laLoiTay: ok');

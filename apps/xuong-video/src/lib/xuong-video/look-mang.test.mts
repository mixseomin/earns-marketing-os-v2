// ../../node_modules/.bin/tsx src/lib/xuong-video/look-mang.test.mts (cwd apps/xuong-video, NODE_OPTIONS=--conditions=react-server) — bộ mặc định look theo tập (bo-set-3d.ts › lookMang)
import assert from 'node:assert';
import { lookMang } from './bo-set-3d';
const bt = (id: number, dung_tap: number[] | null) => ({ id, nhan_vat_id: 1, nhom: 'trang_phuc', ten: `a${id}`, mo_ta: `ao ${id}`, anh_url: null, dung_tap });
const nv = [{ id: 1, ten: 'Ha', loai: 'nhan_vat', bien_the: [bt(155, [1]), bt(156, null), bt(157, null)] }] as never;
const ds = [{ id: 10, nhan_vat: [1], bien_the: [] }];
assert.strictEqual(lookMang(ds, nv, [], 1).get(10)?.get('Ha')?.trang_phuc?.[0]?.id, 155);   // gắn đúng tập thắng
assert.strictEqual(lookMang(ds, nv, [], 2).get(10)?.get('Ha')?.trang_phuc, undefined);       // tập khác: 2 cái mọi tập → không seed
const nv2 = [{ id: 1, ten: 'Ha', loai: 'nhan_vat', bien_the: [bt(156, null), bt(157, null)] }] as never;
assert.strictEqual(lookMang(ds, nv2, [], 1).get(10)?.get('Ha')?.trang_phuc, undefined);      // phá thử: không cái nào gắn tập → giữ luật cũ
console.log('✓ look mặc định theo tập');

// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/luat-may-shot.test.mts
import assert from 'node:assert';
import { chamMayTap, nguonLuat, nguonKyThuat } from './luat-may-shot';
const sh = (id: number, thu_tu: number, co_canh: string, chuyen_dong: string, o: object = {}) => ({ id, thu_tu, phat_s: 3, thoi_luong_s: 4, nhan_vat: [], thoai: [], ky_thuat: { co_canh, chuyen_dong }, ...o }) as never;
// nhảy hình gắn shot sau (luat_30); chữ máy trái máy khai → co_may_mot_nguon; quảng cáo không chấm cỡ / máy
const ds = [sh(1, 1, 'ms', 'tinh'), sh(2, 2, 'ms', 'day_vao'), sh(3, 3, 'ws', 'tinh', { dan_dung: { huong: 'camera moves toward him' } })];
const m = chamMayTap(ds);
assert.deepStrictEqual(m.get(2)!.map((x) => x.luat), ['luat_30'], JSON.stringify([...m]));
assert.ok(m.get(3)!.some((x) => x.luat === 'co_may_mot_nguon' && x.chu.includes('camera moves toward')));
assert.ok(!chamMayTap(ds, { laQc: true }).get(3), 'QC không chấm cỡ / máy');
assert.ok(!m.get(1), 'shot đầu không lỗi');
// nguồn: luật có mục ngành, kỹ thuật có mục ngành
assert.ok(nguonLuat('may_co_dong_co').nguon.includes('indepthcine') && nguonLuat('luat_30').nguon.length > 10 && nguonLuat('co_may_mot_nguon').nguon.includes('LỆ RIÊNG STUDIO'));
assert.ok((nguonKyThuat('chuyen_dong', 'lia') ?? '').length > 10); assert.strictEqual(nguonKyThuat('chuyen_dong', null), null);
console.log('✓ luat-may-shot (lỗi máy theo shot + nguồn luật / kỹ thuật)');

// tự kiểm qc-trang: node_modules/.bin/tsx apps/etp2/src/lib/qc-trang.test.mts
import assert from 'node:assert';
import { gopQc, chiSo, chuoiQc } from './qc-trang';

const cho = { '2026-11-22': { i: 53.82, f: 55.45, p: 40, t: 0.0552 }, '2026-11-21': { i: 50, f: 60, p: 38, t: null } };

// Doblado 22/11 (đối chiếu báo cáo Ethopex): IRPM 40,07 · thấp hơn chợ 26% → trang yếu
const g = gopQc([{ d: '2026-11-22', chi: 24.33, thu: 16.27, x: 322, q: 748, h: 406, b: 0 }], cho)!;
const s = chiSo(g);
assert.ok(Math.abs(s.irpm! - 40.07) < 0.05, `irpm ${s.irpm}`);
assert.strictEqual(Math.round(s.irpmLech!), -26);
assert.strictEqual(s.nhan, 'trang yếu');
assert.strictEqual(s.cpc, null);   // < 20 lượt bấm thì không tính CPC

// có lượt xem mà không xin QC → trang hỏng
assert.strictEqual(chiSo(gopQc([{ d: '2026-11-22', chi: 5, thu: 0, x: 60, q: 0, h: 0, b: 0 }], cho)!).nhan, 'trang hỏng');
// lượt xem dưới ngưỡng → không kết luận
assert.strictEqual(chiSo(gopQc([{ d: '2026-11-22', chi: 5, thu: 0, x: 40, q: 0, h: 0, b: 0 }], cho)!).nhan, null);
// CPC trên trung vị nhà 30% → FB đắt (trang ổn)
assert.strictEqual(chiSo(gopQc([{ d: '2026-11-22', chi: 10, thu: 36, x: 500, q: 1000, h: 600, b: 100 }], cho)!).nhan, 'FB đắt');
// dòng không có số AdSense bị bỏ
assert.strictEqual(gopQc([{ d: '2026-11-22', chi: 5, thu: 1 }], cho), null);
// chợ cân theo trọng số; ngày thiếu trung vị CPC không kéo lệch
const g2 = gopQc([{ d: '2026-11-22', chi: 1, thu: 1, x: 10, q: 10, h: 100, b: 30 }, { d: '2026-11-21', chi: 1, thu: 1, x: 10, q: 10, h: 300, b: 30 }], cho)!;
assert.ok(Math.abs(g2.choI! - (53.82 * 100 + 50 * 300) / 400) < 1e-9);
assert.strictEqual(g2.choT, 0.0552);
assert.deepStrictEqual(chuoiQc([{ d: '2026-11-22', chi: 1, thu: 1, x: 1, q: 2, h: 1 }, { d: '2026-11-21', chi: 1, thu: 1, x: 1, q: 2, h: 1 }], cho).map((r) => r.d), ['2026-11-21', '2026-11-22']);
console.log('qc-trang: 11 bài xanh');

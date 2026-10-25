// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/diem-nhin.test.mts
import assert from 'node:assert';
import { khungDuaVe, khungCanh, lenMan, locKhungLai, NGUONG_LECH, PHONG_TOI_DA } from './diem-nhin';

// đưa điểm về đúng chỗ: mặt ở 0,62 cần hiện ở 0,5 (phóng chỉ dịch được ~(1−1/s)/2 mỗi phía — 1,35 lần ≈ 0,13 khung) → phóng đủ để dịch, sai ≤ ngưỡng, cửa sổ nằm trong khung gốc
const r = khungDuaVe({ x: 0.66, y: 0.4 }, { x: 0.5, y: 0.4 });
assert.ok(r.lech <= NGUONG_LECH, JSON.stringify(r)); assert.ok(r.k.s > 1 && r.k.s <= PHONG_TOI_DA);
const h = 0.5 / r.k.s; assert.ok(r.k.cx >= h - 1e-9 && r.k.cx <= 1 - h + 1e-9 && r.k.cy >= h - 1e-9 && r.k.cy <= 1 - h + 1e-9);
// lệch không gỡ nổi trong trần phóng → trả khung tốt nhất, báo lệch còn lại (không phóng quá trần)
const x = khungDuaVe({ x: 0.95, y: 0.5 }, { x: 0.05, y: 0.5 }); assert.ok(x.k.s <= PHONG_TOI_DA && x.lech > NGUONG_LECH);

// cả cảnh: shot đầu giữ nguyên; shot 2 lệch → dựng lại; shot 3 đã khớp với điểm cuối (đã dựng lại) của shot 2 → giữ nguyên
const kq = khungCanh([
  { thu_tu: 1, dau: { x: 0.45, y: 0.4 }, cuoi: { x: 0.45, y: 0.4 } },
  { thu_tu: 2, dau: { x: 0.62, y: 0.4 }, cuoi: { x: 0.62, y: 0.4 } },
  { thu_tu: 3, dau: null, cuoi: null },
  { thu_tu: 4, dau: { x: 0.5, y: 0.5 }, cuoi: { x: 0.5, y: 0.5 } },
]);
assert.strictEqual(kq[0]!.k.s, 1);
assert.ok(kq[1]!.k.s > 1 && kq[1]!.lech_truoc! <= NGUONG_LECH && kq[1]!.lech_goc! > NGUONG_LECH);
const man2 = lenMan({ x: 0.62, y: 0.4 }, kq[1]!.k); assert.ok(Math.hypot(man2.x - 0.45, man2.y - 0.4) <= NGUONG_LECH);
assert.strictEqual(kq[2]!.k.s, 1); assert.strictEqual(kq[2]!.lech_goc, null);   // không đo được → giữ nguyên
assert.strictEqual(kq[3]!.k.s, 1);   // sau shot không đo được, mắt đặt lại — không kéo theo
// lệch nhỏ dưới ngưỡng → không phóng vô cớ
assert.strictEqual(khungCanh([{ thu_tu: 1, dau: { x: 0.5, y: 0.5 }, cuoi: { x: 0.5, y: 0.5 } }, { thu_tu: 2, dau: { x: 0.55, y: 0.52 }, cuoi: null }])[1]!.k.s, 1);
// shot tắt khung dựng lại → giữ gốc, vẫn báo lệch
const t = khungCanh([{ thu_tu: 1, dau: { x: 0.45, y: 0.4 }, cuoi: { x: 0.45, y: 0.4 } }, { thu_tu: 2, dau: { x: 0.62, y: 0.4 }, cuoi: null, tat: true }]);
assert.strictEqual(t[1]!.k.s, 1); assert.ok(t[1]!.lech_goc! > NGUONG_LECH);
// bộ lọc: s=1 rỗng; s>1 có crop đúng cỡ cửa sổ
assert.strictEqual(locKhungLai({ s: 1, cx: 0.5, cy: 0.5 }), '');
assert.match(locKhungLai({ s: 1.25, cx: 0.55, cy: 0.5 }), /^crop=iw\*0\.8000:ih\*0\.8000:\(iw-iw\*0\.8000\)\*0\.7500:\(ih-ih\*0\.8000\)\*0\.5000,$/);
// KHÔNG cắt người: có người sát cả hai mép → phóng kiểu gì cũng cắt người → giữ khung gốc
assert.ok(khungDuaVe({ x: 0.66, y: 0.4 }, { x: 0.5, y: 0.4 }, { giu: [{ x0: 0.85, y0: 0.2, x1: 0.99, y1: 0.5 }] }).k.cx + 0.5 / khungDuaVe({ x: 0.66, y: 0.4 }, { x: 0.5, y: 0.4 }, { giu: [{ x0: 0.85, y0: 0.2, x1: 0.99, y1: 0.5 }] }).k.s >= 0.99, 'phóng được thì cửa sổ vẫn chứa người mép phải');
const giu = [{ x0: 0.02, y0: 0.2, x1: 0.15, y1: 0.5 }, { x0: 0.85, y0: 0.2, x1: 0.99, y1: 0.5 }];   // người sát CẢ HAI mép
const g = khungDuaVe({ x: 0.66, y: 0.4 }, { x: 0.5, y: 0.4 }, { giu }); assert.strictEqual(g.k.s, 1, JSON.stringify(g));
// người sơ đồ nói có mà không đo được chỗ → khoá, không phóng
assert.strictEqual(khungCanh([{ thu_tu: 1, dau: { x: 0.45, y: 0.4 }, cuoi: { x: 0.45, y: 0.4 } }, { thu_tu: 2, dau: { x: 0.62, y: 0.4 }, cuoi: null, khoa: true }])[1]!.k.s, 1);
console.log('✓ diem-nhin');

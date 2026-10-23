import assert from 'node:assert';
import { phanLoaiLan, nhoLanMoi, dauHieu } from './loai-lan';
const ev = (o: Partial<Parameters<typeof dauHieu>[0]>) => ({ deltaMode: 0, deltaX: 0, deltaY: 0, ctrlKey: false, timeStamp: 0, ...o });

// chuột Windows (100 px/nấc) và Firefox (dòng) → phóng
assert.equal(phanLoaiLan(ev({ deltaY: 100 }), nhoLanMoi()), 'phong');
assert.equal(phanLoaiLan(ev({ deltaY: 3, deltaMode: 1 }), nhoLanMoi()), 'phong');
// chuột thường macOS Chrome: deltaY nhỏ nhưng wheelDeltaY bội 120 → phóng
assert.equal(phanLoaiLan(ev({ deltaY: 4, wheelDeltaY: -120 }), nhoLanMoi()), 'phong');
// chuột macOS không có wheelDeltaY, máy chưa từng thấy touchpad → phóng (mặc định chuột)
assert.equal(phanLoaiLan(ev({ deltaY: 4 }), nhoLanMoi()), 'phong');
// touchpad: có trục ngang / delta lẻ / wheelDelta = −3·deltaY → trượt
assert.equal(phanLoaiLan(ev({ deltaY: 6, deltaX: 1 }), nhoLanMoi()), 'truot');
assert.equal(phanLoaiLan(ev({ deltaY: 2.5 }), nhoLanMoi()), 'truot');
assert.equal(phanLoaiLan(ev({ deltaY: 40, wheelDeltaY: -120 }), nhoLanMoi()), 'phong');   // ≥ 40 nguyên, trục ngang 0 → nấc chuột
assert.equal(dauHieu(ev({ deltaY: 4, wheelDeltaY: -12 })), null);
// chụm touchpad → phóng
assert.equal(phanLoaiLan(ev({ deltaY: 2.3, ctrlKey: true }), nhoLanMoi('pad')), 'phong');
// máy đã thấy touchpad: vuốt thẳng đứng nguyên (mơ hồ) → trượt; sau đó cầm chuột (bội 120) → phóng, rồi nấc mơ hồ lúc sau theo chuột
{ const n = nhoLanMoi(); phanLoaiLan(ev({ deltaY: 3, deltaX: 1, timeStamp: 0 }), n);
  assert.equal(phanLoaiLan(ev({ deltaY: 5, timeStamp: 2000 }), n), 'truot');
  assert.equal(phanLoaiLan(ev({ deltaY: 4, wheelDeltaY: -120, timeStamp: 5000 }), n), 'phong');
  assert.equal(phanLoaiLan(ev({ deltaY: 8, timeStamp: 9000 }), n), 'phong'); }
// giữa một cú vuốt liền: sự kiện mơ hồ giữ quyết định trượt
{ const n = nhoLanMoi('chuot'); assert.equal(phanLoaiLan(ev({ deltaY: 3.4, timeStamp: 0 }), n), 'truot');
  assert.equal(phanLoaiLan(ev({ deltaY: 6, timeStamp: 16 }), n), 'truot'); }
// chọn "lăn luôn là phóng": vuốt thẳng của touchpad cũng phóng, có trục ngang vẫn trượt
assert.equal(phanLoaiLan(ev({ deltaY: 2.5 }), nhoLanMoi('pad'), true), 'phong');
assert.equal(phanLoaiLan(ev({ deltaY: 2.5, deltaX: 3 }), nhoLanMoi('pad'), true), 'truot');
console.log('loai-lan: đạt');

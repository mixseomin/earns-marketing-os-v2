// node_modules/.bin/tsx apps/web/src/lib/outreach/so.test.mts
// Sổ widget + màn của outreach.on.tc: bố cục dựng sẵn hợp lệ (mã có thật, không lặp, trong lưới, đủ cỡ tối thiểu), không ô nào đè nhau,
// bảng rộng nằm trong ô đủ rộng, mọi widget có mặt trên ít nhất một màn, mã màn không trùng với màn của /home (bố cục lưu chung một bảng),
// và kiểu + nguồn trong sổ kiểu trỏ tới nhau đúng.
import assert from 'node:assert';
import { chamNhau, hopLe, maTrenMan } from '../home/luoi';
import { MAN, RONG_BANG } from '../home/so';
import { BO_SO, boCuaMan } from '../luoi-trang/bo-so';
import { MAN_OB, MAN_OB_MAC_DINH, NHOM_OB, WIDGET_OB, coWidgetOb } from './so';
import { KIEU, NGUON, kieuCua, maKieu, nguonCua, ttCua } from './kieu';

const rong = new Set(Object.entries(WIDGET_OB).filter(([, w]) => 'rong' in w && w.rong).map(([ma]) => ma));
const tren = new Set<string>();
assert.ok(MAN_OB.some((m) => m.id === MAN_OB_MAC_DINH), 'màn mặc định có trong sổ');
for (const m of MAN_OB) {
  assert.ok(m.id.startsWith('ob-'), `màn ${m.id}: mã phải có tiền tố ob-`);
  assert.ok(!MAN.some((h) => h.id === m.id), `màn ${m.id} trùng mã với một màn của /home`);
  assert.equal(boCuaMan(m.id), BO_SO.outreach, `màn ${m.id} phải thuộc bộ sổ outreach`);
  const v = hopLe(m.o, coWidgetOb);
  assert.ok(v && v.length === m.o.length && m.o.length > 0, `màn "${m.ten}": bố cục dựng sẵn không hợp lệ`);
  m.o.forEach((a, i) => m.o.forEach((b, j) => { if (i < j) assert.ok(!chamNhau(a, b), `màn "${m.ten}": ${a.ma} đè lên ${b.ma}`); }));
  for (const o of m.o) for (const t of o.tabs ?? [o.ma]) { tren.add(t); if (rong.has(t)) assert.ok(o.w >= RONG_BANG, `màn "${m.ten}": bảng rộng ${t} nằm trong ô ${o.w} cột (cần ≥ ${RONG_BANG})`); }
  assert.equal(new Set(maTrenMan(m.o)).size, maTrenMan(m.o).length, `màn "${m.ten}": widget lặp`);
}
for (const ma of Object.keys(WIDGET_OB)) {
  assert.ok(tren.has(ma), `widget ${ma} không nằm trên màn nào`);
  assert.ok(ma.replace(/\d+$/, '') in NHOM_OB, `widget ${ma}: nhóm chưa khai trong NHOM_OB`);
}
assert.equal(boCuaMan('sang'), BO_SO.home, 'màn của /home vẫn thuộc bộ sổ home');
assert.equal(boCuaMan('khong-co'), null);

// sổ kiểu: nguồn khai trong kiểu phải có trong sổ nguồn; mã cũ trong DB quy về kiểu có thật; mã lạ không làm vỡ
for (const [k, v] of Object.entries(KIEU)) for (const n of v.nguon) assert.ok(n in NGUON, `kiểu ${k}: nguồn ${n} chưa khai trong NGUON`);
assert.equal(maKieu('embed'), 'embed'); assert.equal(maKieu('custom'), 'khac'); assert.equal(maKieu('sales'), 'khach'); assert.equal(maKieu(null), 'khac'); assert.equal(maKieu('toString'), 'khac');
assert.equal(kieuCua('la-hoac').ten, 'Khác');
assert.equal(nguonCua('constructor').ten, 'constructor', 'nguồn lạ trùng tên hàm có sẵn vẫn ra nhãn chữ'); assert.equal(ttCua('valueOf').ten, 'valueOf'); assert.equal(ttCua('sent').ten, 'Đã gửi');
assert.equal(nguonCua('prospecting-2026-06-27').ten, 'Đợt tìm 27/06/2026'); assert.equal(nguonCua('pr-engine').ten, 'Máy tìm người viết'); assert.equal(nguonCua('').ten, 'không ghi nguồn');
console.log('✓ outreach so.test: ', MAN_OB.length, 'màn ·', Object.keys(WIDGET_OB).length, 'widget ·', Object.keys(KIEU).length, 'kiểu');

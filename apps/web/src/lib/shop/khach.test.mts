// node_modules/.bin/tsx apps/web/src/lib/shop/khach.test.mts — luật đổi tên chặng ngoài (anh chốt 01/10/2026)
import assert from 'node:assert';
import { moCuaKhach } from './khach';

const moc = [
  { ts: '2026-10-06T14:12:00Z', mo_ta: 'Out for delivery', noi: 'Austin, TX', nuoc: 'US', giai_doan: 'OutForDelivery' },
  { ts: '2026-10-03T02:00:00Z', mo_ta: 'Arrived at USPS Regional Facility', noi: 'Los Angeles, CA', nuoc: 'US', giai_doan: 'Arrival' },
  { ts: '2026-10-01T08:00:00Z', mo_ta: 'Flight departed', noi: '', nuoc: null, giai_doan: 'Departure' },          // chưa rõ nước, TRƯỚC khi vào Mỹ → chặng ngoài
  { ts: '2026-09-30T05:00:00Z', mo_ta: 'Departed Shenzhen sorting center', noi: 'Shenzhen, GD', nuoc: 'CN', giai_doan: 'Departure' },
  { ts: '2026-09-29T09:00:00Z', mo_ta: 'Received by LuWei', noi: 'Shenzhen, GD', nuoc: 'CN', giai_doan: 'InfoReceived' },
];
const ra = moCuaKhach(moc, 'US', 'Mellowstep');
assert.strictEqual(ra.length, 4, 'hai mốc "Departed" liền nhau ở chặng ngoài gộp thành một');
assert.deepStrictEqual(ra.map((m) => m.noi), ['Austin, TX', 'Los Angeles, CA', 'Mellowstep Center', 'Mellowstep Center']);
assert.ok(!JSON.stringify(ra).match(/Shenzhen|LuWei|CN\b/), 'không lộ nơi/hãng TQ');
assert.strictEqual(ra[2]!.mo_ta, 'Departed Mellowstep Center');
assert.strictEqual(ra[3]!.mo_ta, 'Order processed at Mellowstep Center');
assert.strictEqual(ra[0]!.mo_ta, 'Out for delivery', 'mốc trong nước khách giữ nguyên');
// mốc không rõ nước SAU khi đã vào Mỹ → coi là trong nước, giữ nguyên
const sau = moCuaKhach([...moc, { ts: '2026-10-04T00:00:00Z', mo_ta: 'In transit to next facility', noi: '', nuoc: null, giai_doan: 'InTransit' }], 'US', 'Mellowstep');
assert.ok(sau.some((m) => m.mo_ta === 'In transit to next facility'));
console.log('khach.test ok');

// Chạy: node scripts/check-network-readiness.ts   (Node tự bóc type, không cần thêm dep/test runner)
// Kiểm luật networkReadiness trong lib/affiliate-networks.ts — luật này quyết định cột "Làm network"
// trên bảng Network, nên nó lặng lẽ lệch thì cả bảng nói sai mà không ai biết.
import assert from 'node:assert';
import { NETWORK_PAYOUTS, networkReadiness, type NetworkTracking } from '../apps/web/src/lib/affiliate-networks.ts';

const t = (o: Partial<NetworkTracking>): NetworkTracking => ({
  slots: 2, params: null, readback: 'api', postback: true, subnetwork: 'yes', note: null, docUrl: null, ...o,
});

// Đủ ba điều kiện + postback → được.
assert.equal(networkReadiness(t({})).level, 'ok');
// Thiếu dữ liệu ≠ không được. Hai chuyện khác nhau, và bảng phải nói đúng chuyện nào.
assert.equal(networkReadiness(null).level, 'unknown');
assert.equal(networkReadiness(t({ slots: null })).level, 'unknown');
// Cấm sub-network / sub-id không quay về = chặn cứng, không phải "vướng".
assert.equal(networkReadiness(t({ subnetwork: 'no' })).level, 'no');
assert.equal(networkReadiness(t({ readback: 'none' })).level, 'no');
// Từng khoảng thiếu → 'partial' và PHẢI nói ra thiếu gì (cột chỉ hữu ích nhờ câu này).
for (const [patch, needle] of [
  [{ slots: 1 }, '1 ô sub-id'],
  [{ readback: 'report' as const }, 'báo cáo dashboard'],
  [{ postback: false }, 'không có postback'],
  [{ subnetwork: 'approval' as const }, 'xin duyệt'],
  [{ subnetwork: null }, 'chưa rõ điều khoản'],
] as const) {
  const r = networkReadiness(t(patch));
  assert.equal(r.level, 'partial', JSON.stringify(patch));
  assert.ok(r.why.includes(needle), `${JSON.stringify(patch)} → "${r.why}"`);
}

// Dữ liệu thật: mọi net phải có trường tracking (null = chưa điều tra, hợp lệ), không được thiếu.
assert.ok(NETWORK_PAYOUTS.length >= 12);
for (const n of NETWORK_PAYOUTS) assert.ok('tracking' in n, n.key);
// Awin là net duy nhất mình có inventory thật + đã xác minh 6 ô qua chính dữ liệu sync.
const awin = NETWORK_PAYOUTS.find((n) => n.key === 'awin')!;
assert.equal(awin.tracking?.slots, 6);
assert.equal(awin.tracking?.readback, 'api');

console.log('affiliate-networks.ts OK — networkReadiness + 12 net có tracking');

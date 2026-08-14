// Chạy: node scripts/check-network-revenue.ts   (Node tự bóc type, không cần thêm dep/test runner)
// Kiểm phần logic thuần của lib/revenue/networks.ts: cắt cửa sổ 31 ngày + parse XML CJ / JSON Awin.
import assert from 'node:assert';
import { windows, parseCj, parseAwin, xmlTag } from '../apps/web/src/lib/revenue/networks.ts';

// Cửa sổ: 30 ngày → 1 lần gọi; 400 ngày → chạm trần 13.
assert.equal(windows('2026-07-16', '2026-08-15').length, 1);
assert.equal(windows('2025-07-16', '2026-08-15').length, 13);
assert.deepEqual(windows('2026-08-15', '2026-08-15'), []);      // khoảng rỗng, không gọi API
const w = windows('2026-06-01', '2026-08-15');
assert.equal(w[0][1], '2026-08-15');                            // mới nhất trước
assert.ok(w.every(([s, e]) => (Date.parse(e) - Date.parse(s)) / 86400000 <= 31));

// XML THẬT lấy từ commission-detail v3 hôm nay.
const xml = `<?xml version="1.0" encoding="UTF-8"?><cj-api><commissions total-matched="1"><commission><action-status>new</action-status><action-type>sale</action-type><aid>15534820</aid><commission-id>3849384227</commission-id><country>VN</country><event-date>2026-08-14T07:27:35-0700</event-date><locking-date>9999-12-31</locking-date><order-id>1359047614952677</order-id><posting-date>2026-08-14T08:32:46-0700</posting-date><advertiser-name>Trip.com (Global)</advertiser-name><commission-amount>19.75</commission-amount><sale-amount>790.15</sale-amount></commission></commissions></cj-api>`;
const cj = parseCj(xml);
assert.equal(cj.length, 1);
assert.deepEqual({ ...cj[0] }, { id: '3849384227', date: '2026-08-14', source: 'affiliate', group: 'cj', channel: 'Trip.com (Global)', amount: 19.75, gross: 790.15 });
assert.equal(xmlTag(xml, 'action-status'), 'new');
assert.equal(parseCj('<commissions></commissions>').length, 0);

// Awin: declined bị loại, ngoại tệ BỎ chứ không quy đổi bừa.
const a = parseAwin([
  { id: 1, transactionDate: '2026-08-10T00:00:00', transactionStatus: 'pending', advertiserName: 'M', commissionAmount: { amount: 3, currency: 'USD' }, saleAmount: { amount: 30, currency: 'USD' } },
  { id: 2, transactionDate: '2026-08-11T00:00:00', transactionStatus: 'declined', advertiserName: 'M', commissionAmount: { amount: 9, currency: 'USD' } },
  { id: 3, transactionDate: '2026-08-12T00:00:00', transactionStatus: 'approved', advertiserName: 'K', commissionAmount: { amount: 5, currency: 'CZK' } },
]);
assert.equal(a.rows.length, 1);
assert.deepEqual({ ...a.rows[0] }, { id: '1', date: '2026-08-10', source: 'affiliate', group: 'awin', channel: 'M', amount: 3, gross: 30 });
assert.deepEqual([...a.skipped], ['CZK']);
assert.equal(parseAwin([]).rows.length, 0);

console.log('networks.ts OK — windows/parseCj/parseAwin');

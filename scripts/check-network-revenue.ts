// Chạy: node scripts/check-network-revenue.ts   (Node tự bóc type, không cần thêm dep/test runner)
// Kiểm phần logic thuần của lib/revenue/networks.ts: cắt cửa sổ 31 ngày + parse XML CJ / JSON Awin.
import assert from 'node:assert';
import { windows, parseCj, parseAwin, xmlTag, parseLinkPerf } from '../apps/web/src/lib/revenue/networks.ts';

// Cửa sổ: 30 ngày → 1 lần gọi; 400 ngày → chạm trần 13.
assert.equal(windows('2026-07-16', '2026-08-15').length, 1);
assert.equal(windows('2025-07-16', '2026-08-15').length, 13);
assert.deepEqual(windows('2026-08-15', '2026-08-15'), []);      // khoảng rỗng, không gọi API
const w = windows('2026-06-01', '2026-08-15');
assert.equal(w[0][1], '2026-08-15');                            // mới nhất trước
assert.ok(w.every(([s, e]) => (Date.parse(e) - Date.parse(s)) / 86400000 <= 31));

// XML THẬT lấy từ commission-detail v3 hôm nay.
const xml = `<?xml version="1.0" encoding="UTF-8"?><cj-api><commissions total-matched="1"><commission><action-status>new</action-status><action-type>sale</action-type><aid>15534820</aid><commission-id>3849384227</commission-id><country>VN</country><event-date>2026-08-14T07:27:35-0700</event-date><locking-date>9999-12-31</locking-date><order-id>1359047614952677</order-id><posting-date>2026-08-14T08:32:46-0700</posting-date><sid>CJ_Trip_HK_13.8</sid><advertiser-name>Trip.com (Global)</advertiser-name><commission-amount>19.75</commission-amount><sale-amount>790.15</sale-amount></commission></commissions></cj-api>`;
const cj = parseCj(xml);
assert.equal(cj.length, 1);
// `sub` = ô sid. Nó là KHOÁ QUY CÔNG duy nhất của CJ (không có postback, không có báo cáo click
// theo sid) — rớt trường này là mất luôn đường nối đơn về camp, mà bảng vẫn hiện đủ tiền nên không ai thấy.
assert.deepEqual({ ...cj[0] }, { id: '3849384227', date: '2026-08-14', source: 'affiliate', group: 'cj', channel: 'Trip.com (Global)', sub: 'CJ_Trip_HK_13.8', amount: 19.75, gross: 790.15 });
assert.equal(xmlTag(xml, 'action-status'), 'new');
assert.equal(parseCj('<commissions></commissions>').length, 0);
// Đơn không gắn sid vẫn phải vào sổ (tiền có thật), chỉ là không quy công được → sub bỏ trống.
assert.equal(parseCj(xml.replace('<sid>CJ_Trip_HK_13.8</sid>', ''))[0].sub, undefined);

// performanceReport/link.json — JSON THẬT hôm nay (trendPeriod=NoTrend, 365 ngày).
// CJ trộn kiểu trong cùng một trường: có tiền → số, không tiền → chuỗi "0.000".
const perf = parseLinkPerf({ records: { record: [
  { advertiserId: 4368684, advertiserName: 'Trip.com (Global)', linkId: 15534820, linkName: 'Trip.com HK Link', publisherCommission: 19.754, saleAmount: 790.148, sales: 1, clicks: 2 },
  { advertiserId: 4368684, advertiserName: 'Trip.com (Global)', linkId: 11999712, linkName: 'Low Cost Flight Deals with Trip.com in Asia!(HK)', publisherCommission: '0.000', saleAmount: '0.000', sales: 0, clicks: 1 },
] } });
assert.equal(perf.length, 2);
assert.equal(perf[0].linkId, '15534820');                    // sắp theo hoa hồng giảm dần
assert.deepEqual({ ...perf[0] }, { network: 'cj', advertiser: 'Trip.com (Global)', link: 'Trip.com HK Link', linkId: '15534820', clicks: 2, sales: 1, commission: 19.754, saleAmount: 790.148 });
assert.equal(perf[1].commission, 0);                          // "0.000" → 0, không phải NaN
// CJ trả OBJECT khi đúng MỘT dòng — tài khoản mới chỉ có một link thì rơi đúng vào ca này.
assert.equal(parseLinkPerf({ records: { record: { linkId: 7, linkName: 'x', clicks: 5 } } }).length, 1);
assert.equal(parseLinkPerf({ records: { record: { linkId: 7, linkName: 'x', clicks: 5 } } })[0].clicks, 5);
// Không có dữ liệu: CJ trả records rỗng (chuỗi), không phải mảng rỗng.
assert.deepEqual(parseLinkPerf({ records: '' }), []);
assert.deepEqual(parseLinkPerf({}), []);
assert.deepEqual(parseLinkPerf(null), []);
// Gọi theo ngày (trendPeriod=DoD) thì mỗi link nhiều dòng → phải CỘNG, không phải đè.
const daily = parseLinkPerf({ records: { record: [
  { linkId: 9, linkName: 'L', clicks: 3, sales: 0, publisherCommission: '0.000' },
  { linkId: 9, linkName: 'L', clicks: 4, sales: 1, publisherCommission: 12 },
] } });
assert.equal(daily.length, 1);
assert.equal(daily[0].clicks, 7);
assert.equal(daily[0].commission, 12);

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

console.log('networks.ts OK — windows/parseCj/parseAwin/parseLinkPerf');

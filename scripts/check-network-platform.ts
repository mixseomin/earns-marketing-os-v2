// Chạy: node scripts/check-network-platform.ts
// Kiểm phần logic thuần của nền tảng network: dựng link + vòng đời đối soát.
// Hai chỗ này sai thì tiền đi nhầm chỗ mà màn hình vẫn xanh, nên chúng phải có lưới.
import assert from 'node:assert';
import { newClickId, isClickId, upstreamUrl, trackingUrl, readUtm, SUB_PARAM, CLICK_ID_LEN,
  checkOffer, checkPublisher, checkSlug, newLinkToken, LINK_TOKEN_LEN } from '../apps/web/src/lib/network/link.ts';
import { cjSettleState } from '../apps/web/src/lib/network/status.ts';

// ── Mã click ────────────────────────────────────────────────────────────────
const id = newClickId();
assert.equal(id.length, CLICK_ID_LEN);
assert.ok(isClickId(id));
// Phải VỪA ô hẹp nhất đang dùng: ClickBank `tid` ≤ 24 ký tự. Dài hơn là cắt cụt → mất dấu.
assert.ok(CLICK_ID_LEN <= 24);
// sid đặt tay thời chưa có nền tảng KHÔNG được nhận nhầm là mã của mình.
assert.ok(!isClickId('CJ_Trip_HK_13.8'));
assert.ok(!isClickId(''));
assert.ok(!isClickId('ABC123456789'));      // chữ hoa
assert.ok(!isClickId('abc'));               // ngắn
// Không trùng nhau trong 2000 lần sinh liên tiếp.
assert.equal(new Set(Array.from({ length: 2000 }, () => newClickId())).size, 2000);

// ── Gắn mã vào link upstream ────────────────────────────────────────────────
assert.equal(
  upstreamUrl('cj', 'https://www.dpbolvw.net/kj122zw41w3JLKKLSQQQTJLPPNOSMK', 'abc123def456').url,
  'https://www.dpbolvw.net/kj122zw41w3JLKKLSQQQTJLPPNOSMK?sid=abc123def456');
// Link đã có query thì GIỮ, chỉ thêm ô sub-id.
assert.equal(
  upstreamUrl('awin', 'https://www.awin1.com/cread.php?awinmid=1&awinaffid=2', 'zzz999zzz999').url,
  'https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&clickref=zzz999zzz999');
// Link lỡ mang sẵn ô đó (dán nhầm sid cũ) phải bị ĐÈ. Để nguyên là gửi hai giá trị, upstream giữ
// cái nào tuỳ nó → mất dấu mà không có lỗi nào báo.
assert.equal(
  upstreamUrl('cj', 'https://x.com/click?sid=CU', 'aaaaaaaaaaaa').url,
  'https://x.com/click?sid=aaaaaaaaaaaa');
// Network không có ô sub-id dùng được → BÁO LỖI, không redirect mù.
assert.ok(upstreamUrl('travelpayouts', 'https://x.com/a', 'aaaaaaaaaaaa').error);
assert.ok(upstreamUrl('khong-ton-tai', 'https://x.com/a', 'aaaaaaaaaaaa').error);
assert.ok(upstreamUrl('cj', 'khong-phai-url', 'aaaaaaaaaaaa').error);
// Mọi network có ô đều phải là tên tham số THẬT (đã web-verify), không rỗng.
for (const [k, v] of Object.entries(SUB_PARAM)) if (v !== null) assert.ok(v.length > 0, k);
assert.equal(SUB_PARAM.cj, 'sid');
assert.equal(SUB_PARAM.awin, 'clickref');

// ── Link publisher dán ra ngoài ─────────────────────────────────────────────
// KHÔNG còn tham số nào để publisher sửa sai: cả người lẫn chiến dịch nằm trong token.
assert.equal(trackingUrl('https://pub.on.tc', 'a1b2c3d4e5f6'), 'https://pub.on.tc/t/a1b2c3d4e5f6');
assert.equal(
  trackingUrl('https://pub.on.tc', 'a1b2c3d4e5f6', { utm_source: 'google', utm_campaign: 'hk aug' }),
  'https://pub.on.tc/t/a1b2c3d4e5f6?utm_source=google&utm_campaign=hk+aug');
// Link KHÔNG được mang slug publisher ở đâu cả — còn `?p=` là còn cửa đổi sang người khác.
assert.ok(!trackingUrl('https://pub.on.tc', 'a1b2c3d4e5f6').includes('p='));
const tk = newLinkToken();
assert.equal(tk.length, LINK_TOKEN_LEN);
assert.match(tk, /^[0-9a-z]+$/);
assert.equal(new Set(Array.from({ length: 2000 }, () => newLinkToken())).size, 2000);
const u = readUtm(new URLSearchParams('utm_source=google&utm_medium=&utm_content=  banner3  &x=bo'));
assert.deepEqual(u, { utm_source: 'google', utm_content: 'banner3' });   // ô rỗng bỏ, khoảng trắng cắt
assert.equal(readUtm(new URLSearchParams(`utm_source=${'a'.repeat(500)}`)).utm_source.length, 200);

// ── Vòng đời đối soát ───────────────────────────────────────────────────────
const NOW = new Date('2026-08-15T00:00:00Z');
// CJ để locking-date = 9999-12-31 nghĩa là CHƯA ấn định ngày khoá — không phải khoá vào năm 9999.
assert.equal(cjSettleState('new', '9999-12-31', 19.75, NOW), 'pending');
assert.equal(cjSettleState('locked', '9999-12-31', 19.75, NOW), 'holding');
assert.equal(cjSettleState('extended', '9999-12-31', 19.75, NOW), 'holding');
// Ngày khoá đã qua = chốt, đây mới là tiền trả được.
assert.equal(cjSettleState('new', '2026-08-01', 19.75, NOW), 'approved');
assert.equal(cjSettleState('closed', '9999-12-31', 19.75, NOW), 'approved');
// Ngày khoá còn ở tương lai thì CHƯA chốt.
assert.equal(cjSettleState('locked', '2026-09-30', 19.75, NOW), 'holding');
// Về 0 hoặc âm = đơn bị đánh hỏng. Kể cả khi trạng thái là 'closed' — "chốt 0 đồng" là huỷ,
// không phải được duyệt; nhầm chỗ này là hứa trả publisher một khoản không tồn tại.
assert.equal(cjSettleState('closed', '2026-08-01', 0, NOW), 'cancelled');
assert.equal(cjSettleState('corrected', '2026-08-01', -19.75, NOW), 'cancelled');

// ── Kiểm dữ liệu trước khi ghi ──────────────────────────────────────────────
const okOffer = { slug: 'trip-hk', name: 'Trip.com HK', network: 'cj', upstreamUrl: 'https://www.dpbolvw.net/abc' };
assert.equal(checkOffer(okOffer), null);
// Network KHÔNG có ô sub-id phải bị chặn ngay lúc tạo. Cho qua = vài tuần sau mới biết tiền mất dấu.
assert.ok(checkOffer({ ...okOffer, network: 'travelpayouts' })?.includes('không có ô sub-id'));
assert.ok(checkOffer({ ...okOffer, network: 'bia-ra' })?.includes('Network lạ'));
assert.ok(checkOffer({ ...okOffer, upstreamUrl: 'khong-phai-url' })?.includes('URL hợp lệ'));
assert.ok(checkOffer({ ...okOffer, name: '   ' })?.includes('Thiếu tên'));
// Slug nằm trong link đã phát ra ngoài — khoảng trắng, gạch dưới, chấm, dấu tiếng Việt đều làm
// link gãy hoặc phải encode ở mọi chỗ dùng. Chữ HOA thì không chặn: tự hạ xuống (xem dưới).
for (const bad of ['trip hk', 'trip_hk', 'trip.hk', 'chien-dịch', 'a', '-abc', '', 'trip/hk', 'trip?hk']) {
  assert.ok(checkSlug(bad), `phải chặn slug: ${JSON.stringify(bad)}`);
}
for (const good of ['ab', 'trip-hk', 'a1', 'x'.repeat(41)]) assert.equal(checkSlug(good), null, good);
assert.ok(checkSlug('x'.repeat(42)));                       // quá dài
// Chữ hoa + khoảng trắng thừa được CHUẨN HOÁ chứ không bị chặn — bắt người gõ lại chỉ vì Shift
// là phiền vô ích, còn giá trị lưu xuống vẫn là 'trip-hk' (action .trim().toLowerCase()).
assert.equal(checkSlug('  TRIP-HK  '), null);
assert.equal(checkSlug('Trip-HK'), null);
assert.equal(checkPublisher({ slug: 'thoai', name: 'Thoai' }), null);
assert.ok(checkPublisher({ slug: 'thoai', name: '' })?.includes('Thiếu tên'));

console.log('network platform OK — link/clickId/upstream/utm + đối soát + validate');

// Chạy: node scripts/check-network-platform.ts
// Kiểm phần logic thuần của nền tảng network: dựng link + vòng đời đối soát.
// Hai chỗ này sai thì tiền đi nhầm chỗ mà màn hình vẫn xanh, nên chúng phải có lưới.
import assert from 'node:assert';
import { newClickId, isClickId, upstreamUrl, trackingUrl, readUtm, SUB_PARAM, CLICK_ID_LEN } from '../apps/web/src/lib/network/link.ts';
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
assert.equal(trackingUrl('https://pub.on.tc', 'trip-hk', 'thoai'), 'https://pub.on.tc/c/trip-hk?p=thoai');
assert.equal(
  trackingUrl('https://pub.on.tc', 'trip-hk', 'thoai', { utm_source: 'google', utm_campaign: 'hk aug' }),
  'https://pub.on.tc/c/trip-hk?p=thoai&utm_source=google&utm_campaign=hk+aug');
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

console.log('network platform OK — link/clickId/upstream/utm + vòng đời đối soát');

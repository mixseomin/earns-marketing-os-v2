<?php
/* Plugin Name: Mellowstep CJ — chuyển đơn đã trả tiền sang CJ + theo dõi vận đơn + báo khách.
 *
 * Luồng:
 *  1. Đơn Woo sang "processing" (Stripe đã thu) → Action Scheduler chạy ms_cj_tao: dựng đơn CJ createOrderV2
 *     payType=3 (CHỈ TẠO, CHƯA TRẢ). Hãng ship = rẻ nhất trong các tuyến giao ≤ MS_CJ_NGAY_MAX ngày (freightCalculate).
 *  2. Trả tiền CJ = tiêu tiền của anh → mặc định KHÔNG tự trả. MS_CJ_TU_TRA=true trong wp-config mới gọi payBalance.
 *     Không tự trả thì email anh "đơn cần thanh toán" kèm số tiền + link danh sách đơn CJ.
 *  3. Mỗi 30 phút ms_cj_theo_doi: getOrderDetail mọi đơn đã sang CJ chưa có mã → có trackNumber thì lưu meta,
 *     ghi ghi-chú-cho-khách (Woo tự gửi email) kèm link 17track, chuyển đơn sang completed.
 *  Cột "CJ" trong danh sách đơn admin để theo dõi.
 *
 *  4. Sổ MOS2 (report2 trên mos2.on.tc, KHÔNG be.adfond — anh chốt 01/10/2026): đơn đã sang CJ → phu_su_kien loai=don
 *     (amount = tổng khách trả, raw.gia_von/ship/phi), hoàn tiền → loai=hoan. Camp = utm của đơn (Woo order attribution).
 * Cấu hình wp-config: MS_CJ_TOKEN (CJ-Access-Token, hạn 180 ngày — cấp lại bằng getAccessToken), MS_CJ_TU_TRA, MS_MOS2_KEY.
 * Nguồn: earns-marketing-os-v2 scripts/shop/wp/mellowstep-cj.php → /var/www/mellowstep/wp-content/mu-plugins/ (box3).
 */
if (!defined('ABSPATH')) exit;
/* 01/10/2026: MOS2 (mos2.on.tc/shop) nắm luồng sau thanh toán — đặt CJ, theo dõi vận đơn, báo khách, sổ PHỦ. MS_QUA_MOS2=true trong
 * wp-config thì các bước 1/3/4 dưới đây nhường hết cho MOS2 (tránh đặt CJ hai lần); plugin chỉ còn cột "CJ" trong admin. */

const MS_CJ_API = 'https://developers.cjdropshipping.com/api2.0/v1/';
const MS_CJ_NGAY_MAX = 11;
const MS_CJ_DS_DON = 'https://www.cjdropshipping.com/mine/dropshipping/orderList?orderType=3&childType=1';

function ms_cj($path, $body = null) {
  $r = wp_remote_request(MS_CJ_API . $path, [
    'method' => $body === null ? 'GET' : 'POST', 'timeout' => 30,
    'headers' => ['CJ-Access-Token' => MS_CJ_TOKEN, 'Content-Type' => 'application/json'],
    'body' => $body === null ? null : wp_json_encode($body),
  ]);
  if (is_wp_error($r)) return ['result' => false, 'message' => $r->get_error_message()];
  return json_decode(wp_remote_retrieve_body($r), true) ?: ['result' => false, 'message' => 'HTTP ' . wp_remote_retrieve_response_code($r)];
}

/* Số ngày tối đa từ chuỗi "4-7" / "5-11". */
function ms_cj_ngay($s) { return max(array_map('intval', preg_split('/\D+/', (string)$s, -1, PREG_SPLIT_NO_EMPTY)) ?: [99]); }

function ms_cj_bao_anh($tieuDe, $noiDung) { wp_mail(get_option('admin_email'), "[Mellowstep] $tieuDe", $noiDung); }

/* Webhook Woo → MOS2 cùng box (http://127.0.0.1:3821/api/shop/woo/<khoa>): đi vòng qua mos2.on.tc thì Cloudflare trả 403 cho POST
 * từ máy chủ. Woo mặc định chặn URL nội bộ (reject_unsafe_urls) — chỉ mở đúng cửa 127.0.0.1:3821. */
/* wp_safe_remote_request (Woo dùng) luôn ép reject_unsafe_urls và chỉ cho cổng 80/443/8080 → mở đúng 127.0.0.1 cổng 3821. */
add_filter('http_request_host_is_external', fn($ok, $host, $url) => $ok || strpos($url, 'http://127.0.0.1:3821/api/shop/') === 0, 10, 3);
add_filter('http_allowed_safe_ports', function ($ports, $host, $url) { if (strpos($url, 'http://127.0.0.1:3821/api/shop/') === 0) $ports[] = 3821; return $ports; }, 10, 3);

/* 1 — đơn đã trả tiền → hàng đợi */
add_action('woocommerce_order_status_processing', function ($id) {
  if (defined('MS_QUA_MOS2') && MS_QUA_MOS2) return; 
  if (!defined('MS_CJ_TOKEN')) return;
  $o = wc_get_order($id);
  if ($o->get_meta('_cj_order_id')) return;
  as_enqueue_async_action('ms_cj_tao', [$id], 'mellowstep');
});

add_action('ms_cj_tao', function ($id) {
  if (defined('MS_QUA_MOS2') && MS_QUA_MOS2) return; 
  $o = wc_get_order($id);
  if (!$o || $o->get_meta('_cj_order_id')) return;
  ms_mos2_don($o); // vào sổ ngay cả khi bước CJ dưới đây lỗi; tạo CJ xong gửi lại kèm phí ship (upsert cùng ma_don)
  $sp = []; $thieu = [];
  foreach ($o->get_items() as $it) {
    $vid = get_post_meta($it->get_variation_id() ?: $it->get_product_id(), '_cj_vid', true);
    if (!$vid) { $thieu[] = $it->get_name(); continue; }
    $sp[] = ['vid' => $vid, 'quantity' => $it->get_quantity(), 'storeLineItemId' => (string)$it->get_id()];
  }
  if ($thieu || !$sp) {
    $o->add_order_note('CJ: không tạo được đơn — thiếu mã biến thể CJ: ' . implode(', ', $thieu));
    ms_cj_bao_anh("Đơn #$id KHÔNG sang được CJ", 'Thiếu mã biến thể CJ: ' . implode(', ', $thieu) . "\n" . $o->get_edit_order_url());
    return;
  }
  $f = ms_cj('logistic/freightCalculate', ['startCountryCode' => 'CN', 'endCountryCode' => $o->get_shipping_country() ?: 'US',
    'products' => array_map(fn($p) => ['vid' => $p['vid'], 'quantity' => $p['quantity']], $sp)]);
  $tuyen = array_filter($f['data'] ?? [], fn($t) => ms_cj_ngay($t['logisticAging'] ?? '') <= MS_CJ_NGAY_MAX);
  usort($tuyen, fn($a, $b) => $a['logisticPrice'] <=> $b['logisticPrice']);
  if (!$tuyen) { $o->add_order_note('CJ: không có tuyến ship ≤ ' . MS_CJ_NGAY_MAX . ' ngày: ' . ($f['message'] ?? '')); ms_cj_bao_anh("Đơn #$id: không có tuyến ship", $o->get_edit_order_url()); return; }
  $t = $tuyen[0];
  $ten = trim($o->get_shipping_first_name() . ' ' . $o->get_shipping_last_name()) ?: trim($o->get_billing_first_name() . ' ' . $o->get_billing_last_name());
  $r = ms_cj('shopping/order/createOrderV2', [
    'orderNumber' => 'MS' . $o->get_order_number(),
    'shippingCountryCode' => $o->get_shipping_country() ?: $o->get_billing_country(),
    'shippingCountry' => WC()->countries->get_countries()[$o->get_shipping_country() ?: 'US'] ?? 'United States',
    'shippingProvince' => $o->get_shipping_state() ?: $o->get_billing_state(),
    'shippingCity' => $o->get_shipping_city() ?: $o->get_billing_city(),
    'shippingAddress' => trim(($o->get_shipping_address_1() ?: $o->get_billing_address_1()) . ' ' . ($o->get_shipping_address_2() ?: $o->get_billing_address_2())),
    'shippingZip' => $o->get_shipping_postcode() ?: $o->get_billing_postcode(),
    'shippingCustomerName' => $ten,
    'shippingPhone' => $o->get_shipping_phone() ?: $o->get_billing_phone(),
    'email' => $o->get_billing_email(),
    'logisticName' => $t['logisticName'], 'fromCountryCode' => 'CN', 'payType' => 3, 'products' => $sp,
  ]);
  $cjId = $r['data']['orderId'] ?? null;
  if (!$cjId) {
    $o->add_order_note('CJ: tạo đơn LỖI — ' . ($r['message'] ?? 'không rõ'));
    ms_cj_bao_anh("Đơn #$id tạo bên CJ bị lỗi", ($r['message'] ?? '') . "\n" . $o->get_edit_order_url());
    return;
  }
  $o->update_meta_data('_cj_order_id', $cjId);
  $o->update_meta_data('_cj_trang_thai', 'UNPAID');
  $o->update_meta_data('_cj_tuyen', $t['logisticName'] . ' (' . $t['logisticAging'] . ' ngày)');
  $o->update_meta_data('_cj_ship', (float)$t['logisticPrice']);
  $o->save();
  $o->add_order_note("CJ: đã tạo đơn $cjId · {$t['logisticName']} {$t['logisticAging']} ngày · ship \${$t['logisticPrice']}");
  ms_mos2_don($o);
  if (defined('MS_CJ_TU_TRA') && MS_CJ_TU_TRA) {
    $p = ms_cj('shopping/order/payBalance', ['orderId' => $cjId]);
    $o->add_order_note('CJ: tự trả từ ví — ' . (!empty($p['result']) ? 'OK' : 'LỖI ' . ($p['message'] ?? '')));
    if (empty($p['result'])) ms_cj_bao_anh("Đơn #$id: tự trả CJ lỗi", ($p['message'] ?? '') . "\n" . MS_CJ_DS_DON);
  } else {
    ms_cj_bao_anh("Đơn #$id cần thanh toán bên CJ", "Đơn CJ $cjId đã tạo, chờ thanh toán.\nTuyến: {$t['logisticName']} ({$t['logisticAging']} ngày), ship \${$t['logisticPrice']}.\nThanh toán: " . MS_CJ_DS_DON . "\nĐơn shop: " . $o->get_edit_order_url());
  }
});

/* 3 — theo dõi vận đơn */
add_action('init', function () {
  if (function_exists('as_has_scheduled_action') && !as_has_scheduled_action('ms_cj_theo_doi', [], 'mellowstep'))
    as_schedule_recurring_action(time() + 300, 30 * MINUTE_IN_SECONDS, 'ms_cj_theo_doi', [], 'mellowstep');
});
add_action('ms_cj_theo_doi', function () {
  if (defined('MS_QUA_MOS2') && MS_QUA_MOS2) return; 
  if (!defined('MS_CJ_TOKEN')) return;
  $ds = wc_get_orders(['limit' => 100, 'status' => ['processing', 'completed'], 'meta_key' => '_cj_order_id', 'meta_compare' => 'EXISTS', 'date_created' => '>' . (time() - 60 * DAY_IN_SECONDS)]);
  foreach ($ds as $o) {
    if (in_array($o->get_meta('_cj_trang_thai'), ['DELIVERED', 'CANCELLED'], true)) continue;
    $d = ms_cj('shopping/order/getOrderDetail?orderId=' . rawurlencode($o->get_meta('_cj_order_id')))['data'] ?? null;
    if (!$d) continue;
    $tt = $d['orderStatus'] ?? '';
    if ($tt && $tt !== $o->get_meta('_cj_trang_thai')) { $o->update_meta_data('_cj_trang_thai', $tt); $o->add_order_note("CJ: trạng thái → $tt"); }
    $ma = $d['trackNumber'] ?? '';
    if ($ma && !$o->get_meta('_ms_tracking')) {
      $o->update_meta_data('_ms_tracking', $ma);
      $o->update_meta_data('_ms_hang', $d['trackingProvider'] ?? $d['logisticName'] ?? '');
      $link = 'https://t.17track.net/en#nums=' . rawurlencode($ma);
      $o->add_order_note("Good news, your order is on its way!\n\nTracking number: $ma\nTrack it here: $link\n\nTracking can take 2-3 days to show movement. Questions? Just reply to this email.", 1);
      $o->update_status('completed');
    }
    if ($tt === 'CANCELLED') ms_cj_bao_anh('Đơn #' . $o->get_id() . ' bị CJ huỷ', $o->get_edit_order_url());
    $o->save();
  }
});

/* Cột "CJ" trong danh sách đơn (HPOS + bảng cũ). */
foreach (['manage_woocommerce_page_wc-orders_columns', 'manage_edit-shop_order_columns'] as $h)
  add_filter($h, fn($c) => array_slice($c, 0, 3, true) + ['ms_cj' => 'CJ'] + $c);
$ms_cot = function ($cot, $o) {
  if ($cot !== 'ms_cj') return;
  $o = $o instanceof WC_Order ? $o : wc_get_order($o);
  $id = $o->get_meta('_cj_order_id');
  if (!$id) { echo '<span style="color:#a00">chưa sang CJ</span>'; return; }
  echo esc_html($o->get_meta('_cj_trang_thai') ?: '?');
  if ($m = $o->get_meta('_ms_tracking')) echo '<br><a target="_blank" href="https://t.17track.net/en#nums=' . esc_attr(rawurlencode($m)) . '">' . esc_html($m) . '</a>';
};
add_action('manage_woocommerce_page_wc-orders_custom_column', $ms_cot, 10, 2);
add_action('manage_shop_order_posts_custom_column', $ms_cot, 10, 2);

/* 4 — sổ MOS2 */
function ms_mos2($events) {
  if (defined('MS_QUA_MOS2') && MS_QUA_MOS2) return; 
  if (!defined('MS_MOS2_KEY') || !$events) return;
  $r = wp_remote_post('http://127.0.0.1:3821/api/phu/ingest', ['timeout' => 15, 'headers' => ['Authorization' => 'Bearer ' . MS_MOS2_KEY, 'Content-Type' => 'application/json'],
    'body' => wp_json_encode(['project' => 'mellowstep', 'events' => $events, 'adapter' => ['key' => 'woo-don', 'name' => 'Đơn WooCommerce mellowstep', 'loai' => 'api', 'lich' => 'khi có đơn / hoàn', 'ok' => true, 'note' => 'đơn #' . $events[0]['ma_don']]])]);
  if (is_wp_error($r) || wp_remote_retrieve_response_code($r) !== 200) error_log('mellowstep → MOS2 lỗi: ' . (is_wp_error($r) ? $r->get_error_message() : wp_remote_retrieve_body($r)));
}
function ms_sid($o) {
  $sach = fn($v) => trim(preg_replace('/[^A-Za-z0-9-]+/', '-', strtolower((string)$v)), '-');
  $src = $sach($o->get_meta('_wc_order_attribution_utm_source')); $camp = $sach($o->get_meta('_wc_order_attribution_utm_campaign'));
  if ($src || $camp) return ($src ?: 'utm') . '_' . ($camp ?: 'none');
  return $sach($o->get_meta('_wc_order_attribution_source_type')) ?: '';
}
function ms_mos2_don($o) {
  $gv = 0; $sp = [];
  foreach ($o->get_items() as $it) { $gv += (float)get_post_meta($it->get_variation_id() ?: $it->get_product_id(), '_cj_gia_von', true) * $it->get_quantity(); $sp[] = $it->get_name(); }
  $phi = (float)$o->get_meta('_stripe_fee') ?: round($o->get_total() * 0.029 + 0.30, 2); // chưa có phí thật từ Stripe → ước 2.9% + 30¢
  ms_mos2([['ts' => $o->get_date_paid() ? $o->get_date_paid()->format('c') : gmdate('c'), 'loai' => 'don', 'sid' => ms_sid($o), 'platform' => $sp[0] ?? '',
    'amount' => (float)$o->get_total(), 'ma_don' => (string)$o->get_id(), 'nguon_du_lieu' => 'woo:mellowstep',
    'raw' => ['gia_von' => round($gv, 2), 'ship' => (float)$o->get_meta('_cj_ship'), 'phi' => $phi, 'so_mon' => $o->get_item_count(), 'cj' => $o->get_meta('_cj_order_id')]]]);
}
add_action('woocommerce_order_refunded', function ($orderId, $refundId) {
  $o = wc_get_order($orderId); $rf = wc_get_order($refundId);
  if (!$o || !$rf) return;
  ms_mos2([['ts' => gmdate('c'), 'loai' => 'hoan', 'sid' => ms_sid($o), 'amount' => abs((float)$rf->get_amount()), 'ma_don' => 'hoan-' . $refundId,
    'nguon_du_lieu' => 'woo:mellowstep', 'raw' => ['don' => $orderId, 'ly_do' => $rf->get_reason()]]]);
}, 10, 2);

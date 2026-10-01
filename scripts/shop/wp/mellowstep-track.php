<?php
/* Plugin Name: Mellowstep Track — trang theo dõi đơn cho khách + khung hành trình trong My Account.
 *
 * Dữ liệu: MOS2 (/api/shop/khach/mellowstep, lib/shop/khach.ts) qua 127.0.0.1:3821 — cùng box, không đi vòng Cloudflare.
 * Luật anh chốt 01/10/2026: chặng ngoài Mỹ hiện là "Mellowstep Center" (MOS2 đổi tên trước khi trả về), chỉ MỘT email "đã gửi"
 * (MOS2 gửi, link thẳng tới trang này kèm order key — khách không phải gõ gì).
 *  - Trang /track-order/ : shortcode [mellowstep_track] — ?order=<số>&key=<order_key> mở thẳng; không có thì form số đơn + email.
 *  - My Account › đơn + trang cảm ơn: khung hành trình dưới bảng đơn.
 * Cấu hình wp-config: MS_SHOP_KEY (= SHOP_MELLOWSTEP_WEBHOOK bên MOS2).
 * Nguồn: earns-marketing-os-v2 scripts/shop/wp/mellowstep-track.php → /var/www/mellowstep/wp-content/mu-plugins/ (box3).
 */
if (!defined('ABSPATH')) exit;

function ms_track_lay($order, $chia) {
  if (!defined('MS_SHOP_KEY') || !$order) return null;
  $url = add_query_arg(array_merge(['order' => $order], $chia), 'http://127.0.0.1:3821/api/shop/khach/mellowstep');
  $r = wp_remote_get($url, ['timeout' => 8, 'headers' => ['x-shop-secret' => MS_SHOP_KEY]]);
  if (is_wp_error($r) || wp_remote_retrieve_response_code($r) !== 200) return null;
  $d = json_decode(wp_remote_retrieve_body($r), true);
  return $d['ban'] ?? null;
}

function ms_track_ngay($iso, $gio = false) {
  if (!$iso) return '';
  $t = strtotime($iso);
  // Ngày giờ theo múi của KHÁCH: <time> mang ISO, JS cuối trang đổi sang giờ máy khách; chữ sẵn (UTC) là bản dự phòng.
  return '<time datetime="' . esc_attr(gmdate('c', $t)) . '"' . ($gio ? ' data-gio="1"' : '') . '>' . esc_html(gmdate($gio ? 'M j, g:i A' : 'M j', $t)) . '</time>';
}

function ms_track_ve($b, $gon = false) {
  ob_start(); ?>
  <div class="ms-tr<?php echo $gon ? ' ms-tr-gon' : ''; ?>">
    <?php if (!$gon): ?><div class="ms-tr-dau"><b>Order #<?php echo esc_html($b['so_don']); ?></b><span>Placed <?php echo ms_track_ngay($b['ngay_dat']); ?></span></div><?php endif; ?>
    <ol class="ms-tr-buoc">
      <?php foreach ($b['buoc'] as $i => $s): ?>
        <li class="<?php echo $s['xong'] ? 'xong' : ''; ?><?php echo $i === $b['hien_tai'] ? ' nay' : ''; ?>"><i></i><span><?php echo esc_html($s['nhan']); ?></span></li>
      <?php endforeach; ?>
    </ol>
    <?php if (!empty($b['du_kien'])): ?>
      <p class="ms-tr-dk">Estimated delivery: <b><?php echo ms_track_ngay($b['du_kien']['tu']); ?> – <?php echo ms_track_ngay($b['du_kien']['den']); ?></b></p>
    <?php endif; ?>
    <?php if (!empty($b['ghi_chu'])): ?><p class="ms-tr-gc"><?php echo esc_html($b['ghi_chu']); ?></p><?php endif; ?>
    <ul class="ms-tr-moc">
      <?php foreach ($b['moc'] as $m): ?>
        <li><span class="t"><?php echo ms_track_ngay($m['ts'], true); ?></span><span class="m"><?php echo esc_html($m['mo_ta']); ?><?php if ($m['noi']): ?><em><?php echo esc_html($m['noi']); ?></em><?php endif; ?></span></li>
      <?php endforeach; ?>
    </ul>
    <?php if (!empty($b['chang_cuoi'])): ?>
      <p class="ms-tr-cc"><?php echo esc_html($b['chang_cuoi']['hang']); ?> tracking: <a href="<?php echo esc_url($b['chang_cuoi']['link']); ?>" target="_blank" rel="noopener"><?php echo esc_html($b['chang_cuoi']['ma']); ?></a></p>
    <?php endif; ?>
    <?php if (!$gon): ?>
      <div class="ms-tr-mon">
        <?php foreach ($b['mon'] as $x): ?>
          <div><?php if ($x['anh']): ?><img src="<?php echo esc_url($x['anh']); ?>" alt="" width="44" height="44" loading="lazy"><?php endif; ?><span><?php echo esc_html($x['ten']); ?><?php echo $x['sl'] > 1 ? ' × ' . (int)$x['sl'] : ''; ?></span></div>
        <?php endforeach; ?>
      </div>
      <p class="ms-tr-hoi">Questions about your order? <a href="<?php echo esc_url(home_url('/contact/')); ?>">Contact us</a> or just reply to your shipping email.</p>
    <?php endif; ?>
  </div>
  <?php return ob_get_clean();
}

add_shortcode('mellowstep_track', function () {
  $order = sanitize_text_field(wp_unslash($_REQUEST['order'] ?? ''));
  $key = sanitize_text_field(wp_unslash($_GET['key'] ?? ''));
  $email = sanitize_email(wp_unslash($_POST['email'] ?? ''));
  $ban = null; $loi = '';
  if ($order && ($key || $email)) {
    $ban = ms_track_lay(ltrim($order, '#'), $key ? ['key' => $key] : ['email' => $email]);
    if (!$ban) $loi = 'We could not find an order with those details. Please check the order number (in your confirmation email) and the email you used at checkout.';
  }
  if ($ban) return ms_track_ve($ban) . ms_track_css_js();
  ob_start(); ?>
  <form class="ms-tr-form" method="post" action="<?php echo esc_url(get_permalink()); ?>">
    <p>Enter your order number and the email you used at checkout.</p>
    <?php if ($loi): ?><p class="ms-tr-loi"><?php echo esc_html($loi); ?></p><?php endif; ?>
    <label for="ms-tr-order">Order number</label><input id="ms-tr-order" name="order" value="<?php echo esc_attr($order); ?>" placeholder="e.g. 1042" required>
    <label for="ms-tr-email">Email</label><input id="ms-tr-email" name="email" type="email" value="<?php echo esc_attr($email); ?>" required>
    <button type="submit">Track order</button>
  </form>
  <?php return ob_get_clean() . ms_track_css_js();
});

/* My Account › xem đơn + trang cảm ơn: khung gọn dưới bảng đơn (đơn đã trả tiền). */
add_action('woocommerce_order_details_after_order_table', function ($o) {
  if (!$o || !in_array($o->get_status(), ['processing', 'completed'], true)) return;
  $ban = ms_track_lay($o->get_order_number(), ['key' => $o->get_order_key()]);
  if (!$ban) return;
  echo '<h2 class="woocommerce-column__title">Shipping progress</h2>' . ms_track_ve($ban, true) . ms_track_css_js();
});

function ms_track_css_js() {
  static $xong = false;
  if ($xong) return '';
  $xong = true;
  return '<style>
.ms-tr{max-width:640px;margin:8px 0 28px;font-size:15px;color:#1d1d1f}
.ms-tr-dau{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:18px}.ms-tr-dau b{font-size:20px}.ms-tr-dau span{color:#666;font-size:13px}
.ms-tr-buoc{display:flex;list-style:none;margin:0 0 18px;padding:0;counter-reset:b}
.ms-tr-buoc li{flex:1;position:relative;text-align:center;font-size:12px;color:#999}
.ms-tr-buoc li i{display:block;width:12px;height:12px;border-radius:50%;background:#ddd;margin:0 auto 6px;position:relative;z-index:1}
.ms-tr-buoc li:not(:first-child)::before{content:"";position:absolute;top:5px;right:50%;width:100%;height:2px;background:#ddd}
.ms-tr-buoc li.xong{color:#1d1d1f}.ms-tr-buoc li.xong i,.ms-tr-buoc li.xong::before{background:#1d1d1f}
.ms-tr-buoc li.nay i{box-shadow:0 0 0 4px rgba(29,29,31,.15)}.ms-tr-buoc li.nay span{font-weight:700}
.ms-tr-dk{margin:0 0 6px}.ms-tr-gc{margin:0 0 12px;color:#666;font-size:13px}
.ms-tr-moc{list-style:none;margin:0;padding:0;border-top:1px solid #e5e5e5}
.ms-tr-moc li{display:grid;grid-template-columns:120px 1fr;gap:12px;padding:10px 0;border-bottom:1px solid #eee}
.ms-tr-moc li:first-child .m{font-weight:700}.ms-tr-moc .t{color:#666;font-size:13px}.ms-tr-moc em{display:block;font-style:normal;color:#666;font-size:13px}
.ms-tr-cc{margin:12px 0 0;font-size:13px;color:#555}
.ms-tr-mon{display:grid;gap:8px;margin:18px 0 0;padding-top:14px;border-top:1px solid #e5e5e5}.ms-tr-mon div{display:flex;align-items:center;gap:10px}.ms-tr-mon img{object-fit:cover;border-radius:4px}
.ms-tr-hoi{margin:16px 0 0;font-size:13px;color:#555}
.ms-tr-gon .ms-tr-buoc{margin-top:6px}
.ms-tr-form{max-width:420px;display:grid;gap:6px}.ms-tr-form input{padding:9px 10px;border:1px solid #ccc;border-radius:4px;font-size:15px}
.ms-tr-form button{margin-top:8px;background:#1d1d1f;color:#fff;border:0;border-radius:4px;padding:11px 16px;font-weight:600;cursor:pointer}
.ms-tr-loi{color:#b00020;font-size:14px}
@media (max-width:480px){.ms-tr-moc li{grid-template-columns:1fr;gap:2px}.ms-tr-buoc li span{font-size:10px}}
</style><script>document.querySelectorAll(".ms-tr time").forEach(function(t){var d=new Date(t.getAttribute("datetime"));if(isNaN(d))return;
var o=t.dataset.gio?{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}:{month:"short",day:"numeric"};t.textContent=d.toLocaleString("en-US",o);});</script>';
}

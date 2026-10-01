<?php
/* Plugin Name: Mellowstep UI
 * Layout trang sản phẩm theo khuôn orabra (anh chốt 01/10/2026): thanh thông báo · ảnh trái dính · cột phải = giá +
 * ưu đãi mua nhiều + nút màu/size + mô tả khối ảnh/chữ + bảng size · cam kết · FAQ · hỗ trợ. Không thêm plugin ngoài.
 * Đặt ở wp-content/mu-plugins/ (nguồn: earns-marketing-os-v2 scripts/shop/wp/mellowstep-ui.php → /var/www/mellowstep/wp-content/mu-plugins/, box3).
 */
if (!defined('ABSPATH')) exit;

const MS_BAC = [4 => 20, 3 => 15, 2 => 10]; // số đôi ≥ key → giảm % (cộng mọi mẫu, mọi màu/size)

add_action('wp_body_open', fn() => print '<div class="ms-bar">Free US shipping · 30-day easy returns</div>');
/* Ảnh dính (sticky) chỉ được dính trong HÀNG TRÊN (ảnh + cột mua hàng). Không có khung này thì nó dính theo cả div.product —
 * gồm luôn tab Reviews + sản phẩm liên quan — và trôi xuống đè lên các đường kẻ/ô review khi cuộn (anh chụp 01/10/2026). */
add_action('woocommerce_before_single_product_summary', fn() => print '<div class="ms-tren">', 1);
add_action('woocommerce_after_single_product_summary', fn() => print '</div>', 1);

/* Ưu đãi mua nhiều: dòng dưới giá + giảm thật trong giỏ. */
add_action('woocommerce_single_product_summary', function () {
  echo '<p class="ms-bundle">BUY 2, SAVE 10% · BUY 3, SAVE 15% · BUY 4+, SAVE 20%<br><span>Mix any style, color and size</span></p>';
}, 11);
add_action('woocommerce_cart_calculate_fees', function ($cart) {
  if (is_admin() && !defined('DOING_AJAX')) return;
  $n = 0; $tong = 0;
  foreach ($cart->get_cart() as $d) { $n += $d['quantity']; $tong += $d['line_subtotal']; }
  foreach (MS_BAC as $sl => $pt) if ($n >= $sl) { $cart->add_fee("Bundle discount ($n pairs, -$pt%)", -round($tong * $pt / 100, 2)); break; }
});

/* Mô tả sang cột phải (dưới nút mua), bỏ tab mô tả; khối chung theo sau. */
add_filter('woocommerce_product_tabs', function ($t) { unset($t['description'], $t['additional_information']); return $t; }, 98);
add_action('woocommerce_single_product_summary', function () {
  global $product;
  echo '<div class="ms-trust"><span>🚚 Free US shipping</span><span>↩ 30-day returns</span><span>🔒 Secure checkout</span></div>';
  echo '<div class="ms-desc">' . wpautop(do_shortcode($product->get_description())) . '</div>';
  ms_bang_size($product);
  echo <<<HTML
<div class="ms-sec"><h3>Our Guarantee</h3><p>If they don't feel right, tell us within 30 days of delivery. Wrong size, defect, or you just don't love them, we'll make it right with a replacement or a refund. Details in our <a href="/refund-policy/">Refund &amp; Returns Policy</a>.</p></div>
<div class="ms-sec"><h3>FAQ</h3>
<details><summary>How long does shipping take?</summary><p>Orders leave within 1-3 business days and usually arrive in 7-15 business days. You'll get a tracking number by email.</p></details>
<details><summary>How do I pick my size?</summary><p>Measure your foot from heel to longest toe and use the size guide above. Between sizes, go one up.</p></details>
<details><summary>What if they don't fit?</summary><p>Email us within 30 days. We'll send another size or refund you.</p></details>
<details><summary>Can I mix styles for the bundle discount?</summary><p>Yes. Any styles, colors and sizes count toward the discount.</p></details>
</div>
<div class="ms-sec"><h3>Need Help?</h3><p>Email <a href="mailto:support@mellowstep.com">support@mellowstep.com</a>. A real person answers within one business day.</p></div>
HTML;
}, 45);

/* Bảng size đọc từ chính các nhãn size của sản phẩm ("US W8 / M6.5 · 24.5 cm"). */
function ms_bang_size($product) {
  if (!$product->is_type('variable')) return;
  $a = $product->get_attributes()['size'] ?? null;
  if (!$a) return;
  $dong = '';
  foreach ($a->get_options() as $o) {
    if (!preg_match('/US (.+?) · ([\d.]+) cm/', $o, $m)) continue;
    $dong .= sprintf('<tr><td>%s</td><td>%s cm</td><td>%.1f"</td></tr>', esc_html($m[1]), $m[2], $m[2] / 2.54);
  }
  if ($dong) echo '<div class="ms-sec"><h3>Easy Sizing</h3><p>Measure your foot from heel to longest toe, then pick the matching length. Between sizes? Go one up.</p><table class="ms-size"><tr><th>US size</th><th>Foot length</th><th></th></tr>' . $dong . '</table></div>';
}

add_action('wp_head', function () { ?>
<style>
.ms-bar{background:#1d1d1f;color:#fff;text-align:center;font-size:13px;padding:7px 12px;letter-spacing:.02em}
.ms-bundle{font-weight:700;font-size:14px;margin:6px 0 14px}.ms-bundle span{font-weight:400;font-size:12px;color:#555}
.ms-trust{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:#333;margin:14px 0 22px}
.ms-lead{font-size:16px;margin:0 0 18px}
.ms-blk{margin:0 0 26px}.ms-blk img{width:100%;height:auto;border-radius:6px;display:block}
.ms-blk h3,.ms-sec h3{font-size:22px;font-weight:800;margin:14px 0 6px}
.ms-sec{border-top:1px solid #e5e5e5;padding-top:14px;margin-top:22px}
.ms-sec details{border-bottom:1px solid #eee;padding:10px 0}.ms-sec summary{cursor:pointer;font-weight:600}
.ms-size{width:100%;border-collapse:collapse;font-size:14px}.ms-size td,.ms-size th{border:1px solid #e5e5e5;padding:6px 8px;text-align:left}
@media(min-width:1025px){.single-product div.product .woocommerce-product-gallery{position:sticky!important;top:20px}.ms-tren{display:flow-root}.single-product div.product{overflow:visible}.single-product .content-container,.single-product .site-main{overflow:visible}}
.ms-sw{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}
.ms-sw button{border:1px solid #ccc;background:#fff;color:#111;padding:7px 11px;border-radius:4px;font-size:13px;cursor:pointer;line-height:1.2}
.ms-sw button.on{border:2px solid #1d1d1f;padding:6px 10px;font-weight:600}.ms-sw button:disabled{opacity:.35;text-decoration:line-through;cursor:not-allowed}
.variations select.ms-an{position:absolute!important;opacity:0;pointer-events:none;height:1px;width:1px}
</style>
<?php });

/* Nút màu/size thay <select> — select vẫn là nguồn sự thật, Woo tự xử lý biến thể + hết hàng. */
add_action('wp_footer', function () { if (!is_product()) return; ?>
<script>
(function(){
  var f=document.querySelector('form.variations_form'); if(!f) return;
  function ve(){
    f.querySelectorAll('.variations select').forEach(function(s){
      var w=s.parentNode.querySelector('.ms-sw'); if(!w){w=document.createElement('div');w.className='ms-sw';s.parentNode.insertBefore(w,s);s.classList.add('ms-an');}
      w.innerHTML='';
      [].forEach.call(s.options,function(o){ if(!o.value) return;
        var b=document.createElement('button'); b.type='button'; b.textContent=o.text; b.disabled=o.disabled;
        if(o.value===s.value) b.className='on';
        b.onclick=function(){ s.value=(s.value===o.value?'':o.value); jQuery(s).trigger('change'); };
        w.appendChild(b);
      });
    });
  }
  jQuery(f).on('woocommerce_update_variation_values reset_data', function(){ setTimeout(ve,0); });
  ve();
})();
</script>
<?php });

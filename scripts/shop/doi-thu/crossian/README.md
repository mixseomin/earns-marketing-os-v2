# Crossian — khuôn mặt tiền để CLONE Y NGUYÊN (khảo sát 01/10/2026)

Anh chốt 01/10/2026: shop độc lập (mellowstep…) KHÔNG tự thiết kế trên WordPress — clone y nguyên thành phần site Crossian đã tối ưu.

## Nền của họ
- Mọi brand (fionacharm, jeadora, senistyle, darachic, manbrave, sirmale, senrosa…) chạy **CÙNG MỘT bản dựng Next.js**
  (buildId `puLnh4DreFQ7GAG9myY-y` giống hệt) — chân trang "Powered by Selless", tài nguyên ở `cdn.selless.us`.
  Mỗi brand = tên miền + dữ liệu; sửa một lần → mọi site đổi.
- Đường dẫn: `/` · `/<slug-sản-phẩm>` (vd /daisy-bra) · `/<slug>/checkout` · `/c/clearance` · `/trackings/search` · `/static/{exchanges-returns,orders-shipping,privacy,terms-of-service}` · `/contact`.
- Thanh toán NGAY trên tên miền: Stripe Elements tách ô (số thẻ / hạn / CVV, font Poppins 16px) + Express Checkout Apple Pay
  (Google Pay tắt) + PayPal SDK (tắt card/paylater). MỘT khoá Stripe live cho mọi brand. Google Ads bắn begin_checkout.

## Trang sản phẩm (desktop 1366, cao ~7.500px) — khoi-desktop.json, khoi-mua-desktop.json, ảnh *.png
1. Thanh trên đen: "80% OFF Today + Extra 5% Off at Checkout".
2. Header: menu ☰ trái · logo giữa (không giỏ hàng nổi).
3. Hàng chính 960px: ảnh 452px trái (+ dải thumbnail 69px) · cột mua 452px phải:
   "Rated ★★★★★" → H1 dài kiểu "<Brand> - LAST DAY SALE 80% OFF - <lợi ích>" (Poppins đậm ~44px) → giá 24px + giá gạch →
   "Clearance - Sale ends in 00h 12m 38s" (đỏ, đếm ngược) → khối căn giữa 22px đậm đỏ/cam "Only 286 Left - SUPER SALE /
   80% OFF Today + Buy More Save More" → chọn biến thể dạng NÚT (nhãn trái 71px, nút phải; nút chọn viền xanh + dấu ✓ góc) →
   dải xanh nhạt (#E8F5E9) "ADD 2 ITEMS TO CART TO GET 81% OFF / Apply to any …" (sau khi có món: "EXTRA 10% OFF FOR NEXT ITEM
   IN CART") → nút "Add to cart" cao 55px có icon → "Limited stock! 208 people are viewing this and 2387 purchased it." 13px.
4. Description: nhãn trái 320px · nội dung 640px = xen kẽ H3 + đoạn ngắn + ẢNH LỚN (457–570px) — câu chuyện dạng ảnh.
5. Reviews: "4.9 Based on 325 ratings · Write your review" + thẻ review (tên, Verified Buyer, tiêu đề, nội dung) + "Show more".
6. Shipping & Returns: nhãn trái · đoạn chữ + 2 link "here".
7. Footer: "How can we help you? Contact Us" + địa chỉ · Order (Order Tracking, Exchanges & Returns, Order & Shipping) ·
   Resources (Terms, Privacy) · "© 2026 <Brand>".
## Giỏ: ngăn kéo bên phải (không sang trang) — món + "EXTRA 10% OFF for next item · Select now" · Subtotal gạch giá ·
   nút "PROCEED TO SECURE CHECKOUT" · khối bán thêm "NEW CLEARANCE SALE 79% OFF!".
## Checkout (/<slug>/checkout, 2 cột): trái nền xám = logo + huy hiệu Google Trusted Store + BBB A+ · "Order Summary" ·
   hộp xanh "Nice! You saved $64.79 on this order!" + "This offer ends in 09m 56s" · món · Subtotal / "Secured Express Shipping
   $6.99" / Discount (HAPPY SHOPPING) / Tax / Total gạch giá. Phải: Apple Pay → "CONTINUE TO PAY WITH DEBIT OR CREDIT CARD" ·
   Contact (Email) · Shipping (First/Last, Address, Apartment, City, State ▾, Postal, United States khoá, +1 Phone, ô "Text me order
   updates") · Card information · nút "Pay $22.19 now" · "All transactions are secure and encrypted".

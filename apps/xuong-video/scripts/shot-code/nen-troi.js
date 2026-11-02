// NỀN TRỜI CHUYỂN ĐỘNG dùng chung (anh 03/11/2026 "nền trời có chuyển động… đc ko" → "làm đi"): mọi trang dựng có nền trời thật (shot-code/la-so.html,
// lich-su/brand/astrolas/ve-brand.html đoạn mở đầu) gọi đây, không chép lại. Thuần theo t (quay từng khung được).
//   ảnh thật xoay chậm quanh một tâm như trời đêm quay quanh cực: ±xoay độ, chu kỳ chuKy giây — có giới hạn nên phóng `phong` là che kín góc ở mọi độ dài video;
//   thở nhẹ 1,5% chu kỳ 37 s; `day` = phóng thêm mỗi giây (đoạn ngắn như mở đầu 1,6 s cần nó mới thấy chuyển động);
//   lớp sao lấp lánh theo hạt giống, xoay nhanh hơn ảnh 1,4 lần (thị sai), ~18% sao ánh vàng.
window.NenTroi = {
  tao({ w, h, n, hat = 11 }) {
    let s = hat; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: n ?? Math.round((w * h) / 12200) }, () => { const z = rnd();
      return { x: -0.2 * w + rnd() * 1.4 * w, y: -0.1 * h + rnd() * 1.2 * h, r: 0.6 + z * z * 2.2, m: 0.35 + z * 0.6, f: 0.8 + rnd() * 2.6, p: rnd() * 6.283, v: rnd() < 0.18 }; });
  },
  ve(t, { anh, cv, sao, w, h, tam = [0.5, 0.38], xoay = 6, chuKy = 120, phong = 1.22, day = 0 }) {
    const goc = xoay * Math.sin((2 * Math.PI * t) / chuKy), tho = 1 + 0.015 * Math.sin((2 * Math.PI * t) / 37), to = phong * tho * (1 + day * t);
    if (anh) { anh.style.transformOrigin = `${tam[0] * 100}% ${tam[1] * 100}%`; anh.style.transform = `rotate(${goc.toFixed(4)}deg) scale(${to.toFixed(4)})`; }
    if (!cv) return;
    const g = cv.getContext('2d'); g.clearRect(0, 0, w, h);
    const a = (goc * 1.4 * Math.PI) / 180, cx = tam[0] * w, cy = tam[1] * h, ca = Math.cos(a), sa = Math.sin(a), k = 1 + day * t * 1.3;
    for (const s of sao) {
      const dx = (s.x - cx) * k, dy = (s.y - cy) * k, x = cx + dx * ca - dy * sa, y = cy + dx * sa + dy * ca;
      const sang = s.m * (0.55 + 0.45 * Math.sin(t * s.f + s.p)) ** 2;
      g.globalAlpha = sang; g.fillStyle = s.v ? '#FFE9B0' : '#FFFFFF';
      g.beginPath(); g.arc(x, y, s.r, 0, 2 * Math.PI); g.fill();
      if (s.r > 1.6) { g.globalAlpha = sang * 0.25; g.beginPath(); g.arc(x, y, s.r * 3.2, 0, 2 * Math.PI); g.fill(); }
    }
    g.globalAlpha = 1;
  },
};

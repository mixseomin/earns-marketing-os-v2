// Bản đồ nhỏ: nền (đảo, tường, tháp, phố, nhà, quán, chợ, lò rèn, giếng, cầu) vẽ MỘT lần ra canvas phụ;
// mỗi lần vẽ chỉ chồng người chơi (mũi tên theo hướng) + chấm người gần. Bắc ở trên. Bấm vào để phóng to / thu nhỏ.
const PHAM_VI = 66; // mét từ tâm tới mép bản đồ

export function taoBanDo(el, d) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const nen = document.createElement('canvas'), g0 = nen.getContext('2d');
  const cv = el.querySelector('canvas'), g = cv.getContext('2d');
  let co = 0;
  const sang = (x, z, S) => [S / 2 + (x / PHAM_VI) * (S / 2), S / 2 + (z / PHAM_VI) * (S / 2)];
  function veNen(S) {
    nen.width = nen.height = S; const k = S / 2 / PHAM_VI;
    g0.clearRect(0, 0, S, S);
    g0.fillStyle = '#5a1a06'; g0.fillRect(0, 0, S, S);                                   // dung nham
    const p = (x, z) => sang(x, z, S);
    g0.fillStyle = '#3a3029'; g0.beginPath(); g0.arc(S / 2, S / 2, 62 * k, 0, 7); g0.fill();  // đảo
    g0.fillStyle = '#4a3f36'; g0.fillRect(p(-3, 0)[0], p(0, 55)[1], 6 * k, (110 - 55) * k);   // cầu
    g0.beginPath(); g0.arc(...p(0, 110), 9.5 * k, 0, 7); g0.fill();
    g0.strokeStyle = '#6a5a4a'; g0.lineWidth = 3 * k;                                       // vành phố
    for (const r of [15.6, 31.7, 48.6]) { g0.beginPath(); g0.arc(S / 2, S / 2, r * k, 0, 7); g0.stroke(); }
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) { g0.beginPath(); g0.moveTo(...p(Math.cos(a) * 12, Math.sin(a) * 12)); g0.lineTo(...p(Math.cos(a) * 52, Math.sin(a) * 52)); g0.stroke(); }
    g0.fillStyle = '#b08a6a';                                                               // nhà
    for (const [x, z] of d.nha) { const [a, b] = p(x, z); g0.fillRect(a - 2.6 * k, b - 2.6 * k, 5.2 * k, 5.2 * k); }
    g0.strokeStyle = '#8a8078'; g0.lineWidth = 3 * k; g0.beginPath();                       // tường thành + tháp
    d.thap.forEach(([x, z], i) => { const [a, b] = p(x, z); i ? g0.lineTo(a, b) : g0.moveTo(a, b); }); g0.closePath(); g0.stroke();
    g0.fillStyle = '#a09890'; for (const [x, z] of d.thap) { g0.beginPath(); g0.arc(...p(x, z), 4.4 * k, 0, 7); g0.fill(); }
    g0.fillStyle = '#7a7a90'; g0.beginPath(); g0.arc(S / 2, S / 2, 10.4 * k, 0, 7); g0.fill(); // thành chính
    const nhan = (x, z, chu) => { const [a, b] = p(x, z); g0.font = `${Math.max(11, 7 * k)}px system-ui, sans-serif`; g0.textAlign = 'center'; g0.textBaseline = 'middle'; g0.fillText(chu, a, b); };
    nhan(d.quan[0], d.quan[1], '🍺'); nhan(...d.ren, '⚒️'); nhan(...d.gieng, '💧'); nhan(...d.cho, '🛒'); nhan(0, 52, '🚪');
  }
  function to(lon) { co = lon ? 260 : 150; el.style.width = el.style.height = co + 'px'; cv.width = cv.height = co * dpr; veNen(co * dpr); }
  to(false);
  el.addEventListener('click', (e) => { e.stopPropagation(); to(co < 200); });
  return {
    ve(nguoiChoi, huong, chamNguoi) {
      const S = cv.width; g.clearRect(0, 0, S, S); g.drawImage(nen, 0, 0);
      g.fillStyle = '#f3d6a8'; for (const [x, z] of chamNguoi) { const [a, b] = sang(x, z, S); g.fillRect(a - 1.5 * dpr, b - 1.5 * dpr, 3 * dpr, 3 * dpr); }
      if (nguoiChoi) {
        const [a, b] = sang(nguoiChoi.x, nguoiChoi.z, S);
        g.save(); g.translate(a, b); g.rotate(-huong + Math.PI); // huong: góc hướng nhìn quanh trục y (0 = nhìn về -z = bắc)
        g.fillStyle = '#ff8a3d'; g.strokeStyle = '#1a0d06'; g.lineWidth = 1.5 * dpr;
        g.beginPath(); g.moveTo(0, -8 * dpr); g.lineTo(5.5 * dpr, 6 * dpr); g.lineTo(0, 3 * dpr); g.lineTo(-5.5 * dpr, 6 * dpr); g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
    },
  };
}

// Bản đồ (dùng chung cho mọi cảnh): nền do cảnh vẽ MỘT lần ra canvas phụ (d.veNen), mỗi lần vẽ chỉ chồng người chơi (mũi tên theo
// hướng) + chấm người gần. Bắc ở trên. Bấm bản đồ nhỏ → phóng to (phủ rộng hơn); trên bản đồ lớn bấm vào đâu là DI CHUYỂN NHANH tới
// đó (d.khiChon(x, z)), nút ✕ thu nhỏ. Bản đồ lớn có dòng nhắc + điểm đến nhanh (d.diem: [[tên, x, z]]).
export function taoBanDo(el, d) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const nen = document.createElement('canvas'), g0 = nen.getContext('2d');
  const cv = el.querySelector('canvas'), g = cv.getContext('2d');
  const [PV_NHO, PV_LON] = d.phamVi || [66, 66], TAM = d.tam || [0, 0];
  // tâm: bản đồ LỚN = toàn cảnh cố định (d.tam); bản đồ NHỎ đi theo người chơi (đi xa quá nửa bán kính thì vẽ lại nền quanh chỗ đứng) —
  // trước đây bản đồ nhỏ cũng cố định ở d.tam nên ra rừng / lên cầu / lên cây là mũi tên rơi ra ngoài, không thấy mình ở đâu (anh 15/11/2026)
  let co = 0, lon = false, pv = PV_NHO, tam = [...TAM];
  const sang = (x, z, S) => [S / 2 + ((x - tam[0]) / pv) * (S / 2), S / 2 + ((z - tam[1]) / pv) * (S / 2)];
  const raThe = (a, b, S) => [tam[0] + (a - S / 2) / (S / 2) * pv, tam[1] + (b - S / 2) / (S / 2) * pv];
  // phần phụ của bản đồ lớn: nút ✕, dòng nhắc, điểm đến nhanh
  const phu = document.createElement('div'); phu.className = 'bd-phu'; phu.style.display = 'none';
  phu.innerHTML = `<button class="bd-dong" title="Thu nhỏ">✕</button><div class="bd-nhac">Bấm vào bản đồ để tới đó</div><div class="bd-diem">${(d.diem || []).map(([t], i) => `<button data-i="${i}">${t}</button>`).join('')}</div>`;
  el.appendChild(phu);
  function veNen(S) {
    nen.width = nen.height = S; const k = S / 2 / pv;
    g0.clearRect(0, 0, S, S);
    d.veNen(g0, S, (x, z) => sang(x, z, S), k);
  }
  function to(l) {
    lon = l; pv = l ? PV_LON : PV_NHO; if (l) tam = [...TAM]; co = l ? Math.min(420, innerWidth - 24, innerHeight - 150) : 150;
    el.style.width = el.style.height = co + 'px'; el.classList.toggle('lon', l); phu.style.display = l ? '' : 'none';
    cv.width = cv.height = co * dpr; veNen(co * dpr);
  }
  to(false);
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const nut = e.target.closest('button');
    if (nut?.classList.contains('bd-dong')) return to(false);
    if (nut?.dataset.i != null) { const [, x, z, y] = d.diem[+nut.dataset.i]; d.khiChon?.(x, z, y); return to(false); } // điểm có y = đi thẳng vào trong nhà (tầng)
    if (!lon) return to(true);
    if (e.target !== cv) return;
    const r = cv.getBoundingClientRect(), S = cv.width, [x, z] = raThe((e.clientX - r.left) * S / r.width, (e.clientY - r.top) * S / r.height, S);
    if (d.khiChon?.(x, z) !== false) to(false);
  });
  return {
    get lon() { return lon; },
    ve(nguoiChoi, huong, chamNguoi) {
      const S = cv.width;
      if (!lon && nguoiChoi && Math.hypot(nguoiChoi.x - tam[0], nguoiChoi.z - tam[1]) > pv * 0.4) { tam = [nguoiChoi.x, nguoiChoi.z]; veNen(S); }
      g.clearRect(0, 0, S, S); g.drawImage(nen, 0, 0);
      if (!lon) { // lâu đài (d.tam) ra khỏi bản đồ nhỏ → dấu 🏰 dính mép chỉ hướng về lâu đài
        const [a, b] = sang(TAM[0], TAM[1], S), dx = a - S / 2, dy = b - S / 2, l = Math.hypot(dx, dy), r = S / 2 - 12 * dpr;
        if (l > r) { g.font = `${13 * dpr}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🏰', S / 2 + dx / l * r, S / 2 + dy / l * r); }
      }
      g.fillStyle = '#f3d6a8'; for (const [x, z] of chamNguoi) { const [a, b] = sang(x, z, S); g.fillRect(a - 1.5 * dpr, b - 1.5 * dpr, 3 * dpr, 3 * dpr); }
      if (nguoiChoi) {
        let [a, b] = sang(nguoiChoi.x, nguoiChoi.z, S);
        { const r = S / 2 - 9 * dpr, dx = a - S / 2, dy = b - S / 2, l = Math.hypot(dx, dy); if (l > r) { a = S / 2 + dx / l * r; b = S / 2 + dy / l * r; } } // ngoài vùng vẽ: dính ở mép, không biến mất
        g.save(); g.translate(a, b); g.rotate(-huong + Math.PI); // huong: góc hướng nhìn quanh trục y (0 = nhìn về -z = bắc)
        g.fillStyle = '#ff8a3d'; g.strokeStyle = '#1a0d06'; g.lineWidth = 1.5 * dpr;
        g.beginPath(); g.moveTo(0, -8 * dpr); g.lineTo(5.5 * dpr, 6 * dpr); g.lineTo(0, 3 * dpr); g.lineTo(-5.5 * dpr, 6 * dpr); g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
    },
  };
}

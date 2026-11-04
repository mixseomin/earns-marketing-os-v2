// BẦU TRỜI LÚC SINH — phần TÍNH (thuần, dùng chung trang bau-troi.html + tự kiểm node). Anh 02/11/2026 duyệt dạng video "giải thích bầu trời lúc sinh"
// cho kênh YouTube Astrolas. Công thức vị trí thấp-chính-xác của Paul Schlyter ("How to compute planetary positions") — Mặt Trời/Trăng sai < 0,1°,
// hành tinh < 1°: đủ để đặt đúng CUNG, KHÔNG thay Swiss Ephemeris của astrolas.com (video chỉ minh hoạ, số lá số thật xem trên site).
//   node apps/xuong-video/scripts/shot-code/bau-troi-tinh.js --tu-kiem
(function (g) {
  const R = Math.PI / 180, chuan = (x) => ((x % 360) + 360) % 360;
  const sin = (x) => Math.sin(x * R), cos = (x) => Math.cos(x * R), atan2 = (y, x) => Math.atan2(y, x) / R;
  const ngaySchlyter = (ms) => ms / 86400000 + 2440587.5 - 2451543.5;   // ngày kể từ 2000-01-00 0h UT
  const PT = {   // N, i, w, a, e, M (độ / AU) + biến thiên mỗi ngày
    Moon: [125.1228, -0.0529538083, 5.1454, 0, 318.0634, 0.1643573223, 60.2666, 0, 0.0549, 0, 115.3654, 13.0649929509],
    Mercury: [48.3313, 3.24587e-5, 7.0047, 5.0e-8, 29.1241, 1.01444e-5, 0.387098, 0, 0.205635, 5.59e-10, 168.6562, 4.0923344368],
    Venus: [76.6799, 2.4659e-5, 3.3946, 2.75e-8, 54.891, 1.38374e-5, 0.72333, 0, 0.006773, -1.302e-9, 48.0052, 1.6021302244],
    Mars: [49.5574, 2.11081e-5, 1.8497, -1.78e-8, 286.5016, 2.92961e-5, 1.523688, 0, 0.093405, 2.516e-9, 18.6021, 0.5240207766],
    Jupiter: [100.4542, 2.76854e-5, 1.303, -1.557e-7, 273.8777, 1.64505e-5, 5.20256, 0, 0.048498, 4.469e-9, 19.895, 0.0830853001],
    Saturn: [113.6634, 2.3898e-5, 2.4886, -1.081e-7, 339.3939, 2.97661e-5, 9.55475, 0, 0.055546, -9.499e-9, 316.967, 0.0334442282],
  };
  const pt = (ten, d) => { const p = PT[ten]; return { N: p[0] + p[1] * d, i: p[2] + p[3] * d, w: p[4] + p[5] * d, a: p[6] + p[7] * d, e: p[8] + p[9] * d, M: chuan(p[10] + p[11] * d) }; };
  const kepler = (M, e) => { let E = M + (e / R) * sin(M) * (1 + e * cos(M)); for (let k = 0; k < 8; k++) E = E - (E - (e / R) * sin(E) - M) / (1 - e * cos(E)); return E; };
  // tọa độ hoàng đạo nhật tâm (hoặc địa tâm với Trăng) từ phần tử quỹ đạo
  const viTri = (o) => {
    const E = kepler(o.M, o.e), xv = o.a * (cos(E) - o.e), yv = o.a * Math.sqrt(1 - o.e * o.e) * sin(E);
    const v = atan2(yv, xv), r = Math.hypot(xv, yv);
    const x = r * (cos(o.N) * cos(v + o.w) - sin(o.N) * sin(v + o.w) * cos(o.i));
    const y = r * (sin(o.N) * cos(v + o.w) + cos(o.N) * sin(v + o.w) * cos(o.i));
    const z = r * sin(v + o.w) * sin(o.i);
    return { x, y, z, M: o.M, w: o.w, N: o.N };
  };
  function matTroi(d) {
    const w = 282.9404 + 4.70935e-5 * d, e = 0.016709 - 1.151e-9 * d, M = chuan(356.047 + 0.9856002585 * d);
    const E = M + (e / R) * sin(M) * (1 + e * cos(M)), xv = cos(E) - e, yv = Math.sqrt(1 - e * e) * sin(E);
    const v = atan2(yv, xv), r = Math.hypot(xv, yv), lon = chuan(v + w);
    return { lon, r, x: r * cos(lon), y: r * sin(lon), M, L: chuan(M + w) };
  }
  /** Kinh độ hoàng đạo địa tâm (độ, xuân phân của ngày) của Mặt Trời, Mặt Trăng, 5 hành tinh lúc ms (UTC). */
  function kinhDo(ms) {
    const d = ngaySchlyter(ms), s = matTroi(d), ra = { Sun: s.lon };
    // Mặt Trăng + các nhiễu chính
    const m = viTri(pt('Moon', d)); let lon = chuan(atan2(m.y, m.x));
    const Ms = s.M, Mm = m.M, Lm = chuan(m.N + m.w + Mm), Ls = s.L, D = chuan(Lm - Ls), F = chuan(Lm - m.N);
    lon += -1.274 * sin(Mm - 2 * D) + 0.658 * sin(2 * D) - 0.186 * sin(Ms) - 0.059 * sin(2 * Mm - 2 * D) - 0.057 * sin(Mm - 2 * D + Ms)
      + 0.053 * sin(Mm + 2 * D) + 0.046 * sin(2 * D - Ms) + 0.041 * sin(Mm - Ms) - 0.035 * sin(D) - 0.031 * sin(Mm + Ms) - 0.015 * sin(2 * F - 2 * D) + 0.011 * sin(Mm - 4 * D);
    ra.Moon = chuan(lon);
    for (const ten of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) {
      const p = viTri(pt(ten, d)); let l = atan2(p.y, p.x);
      if (ten === 'Jupiter' || ten === 'Saturn') {   // nhiễu Mộc–Thổ lớn nhất
        const Mj = pt('Jupiter', d).M, Mt = pt('Saturn', d).M;
        l += ten === 'Jupiter'
          ? -0.332 * sin(2 * Mj - 5 * Mt - 67.6) - 0.056 * sin(2 * Mj - 2 * Mt + 21) + 0.042 * sin(3 * Mj - 5 * Mt + 21) - 0.036 * sin(Mj - 2 * Mt) + 0.022 * cos(Mj - Mt) + 0.023 * sin(2 * Mj - 3 * Mt + 52) - 0.016 * sin(Mj - 5 * Mt - 69)
          : 0.812 * sin(2 * Mj - 5 * Mt - 67.6) - 0.229 * cos(2 * Mj - 4 * Mt - 2) + 0.119 * sin(Mj - 2 * Mt - 3) + 0.046 * sin(2 * Mj - 6 * Mt - 69) + 0.014 * sin(Mj - 3 * Mt + 32);
      }
      const r = Math.hypot(p.x, p.y, p.z), lat = Math.asin(p.z / r) / R;
      const xh = r * cos(l) * cos(lat), yh = r * sin(l) * cos(lat);
      ra[ten] = chuan(atan2(yh + s.y, xh + s.x));   // nhật tâm → địa tâm
    }
    // phần tử Schlyter đã theo xuân phân CỦA NGÀY (N, w tăng theo tuế sai) — không cộng tuế sai lần nữa (bản đầu cộng → lệch 0,1° ở mốc Meeus)
    return ra;
  }
  /** Cung Mọc (Ascendant, độ hoàng đạo) lúc ms tại vĩ độ / kinh độ (độ, Đông dương). */
  function cungMoc(ms, vi, kinh) {
    const jd = ms / 86400000 + 2440587.5, T = (jd - 2451545) / 36525;
    const gmst = chuan(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T), ramc = chuan(gmst + kinh);
    const eps = 23.4392911 - 0.0130042 * T;
    return chuan(atan2(cos(ramc), -(sin(ramc) * cos(eps) + Math.tan(vi * R) * sin(eps))));
  }
  const CUNG = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const cungCua = (lon) => CUNG[Math.floor(chuan(lon) / 30)];
  // ĐỔI TOẠ ĐỘ dùng chung (bau-troi-dem.html + lich-su/dai/sinh-dem.mjs): giờ sao địa phương (rad), hoàng đạo → xích đạo (vĩ hoàng đạo 0), xích đạo → chân trời
  const lstRad = (ms, kinh) => { const jd = ms / 86400000 + 2440587.5, T = (jd - 2451545) / 36525; return chuan(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T + kinh) * R; };
  const hoangSangXich = (lamRad) => { const e = 23.4393 * R; return { ra: Math.atan2(Math.sin(lamRad) * Math.cos(e), Math.cos(lamRad)), dec: Math.asin(Math.sin(e) * Math.sin(lamRad)) }; };
  const chanTroi = (ra, dec, L, phi) => { const h = L - ra, sd = Math.sin(dec), cd = Math.cos(dec), sp = Math.sin(phi), cp = Math.cos(phi);
    const alt = Math.asin(sp * sd + cp * cd * Math.cos(h)), az = Math.atan2(-cd * Math.sin(h), sd * cp - cd * Math.cos(h) * sp); return [alt, (az + 2 * Math.PI) % (2 * Math.PI)]; };   // [độ cao, phương vị từ bắc qua đông] (rad)
  const doCao = (ms, ten, vi, kinh) => { const k = kinhDo(ms), e = hoangSangXich(k[ten] * R); return chanTroi(e.ra, e.dec, lstRad(ms, kinh), vi * R); };
  const api = { kinhDo, cungMoc, cungCua, CUNG, chuan, lstRad, hoangSangXich, chanTroi, doCao };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.BauTroi = api;

  if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('bau-troi-tinh.js') && process.argv.includes('--tu-kiem')) {
    const t = process.getBuiltinModule('node:assert').strict, gan = (a, b, sai) => t.ok(Math.abs(((a - b + 540) % 360) - 180) < sai, `${a.toFixed(2)} ≈ ${b}`);
    // Mốc Meeus: 1992-10-13 0h TD Mặt Trời λ = 199,906° (ví dụ 25.a); 1992-04-12 0h TD Mặt Trăng λ = 133,162° (ví dụ 47.a)
    gan(kinhDo(Date.UTC(1992, 9, 13)).Sun, 199.906, 0.05);
    gan(kinhDo(Date.UTC(1992, 3, 12)).Moon, 133.162, 0.3);
    // Meeus 33.a: 1992-12-20 0h TD Sao Kim λ địa tâm ≈ 313,08°
    gan(kinhDo(Date.UTC(1992, 11, 20)).Venus, 313.08, 1);
    // cung Mọc: xích đạo, RAMC = 0 → 90°; công thức đối xứng
    t.equal(cungCua(100), 'Cancer'); t.equal(cungCua(359), 'Pisces');
    const asc = cungMoc(Date.UTC(1990, 6, 14, 10, 30), 40.7128, -74.006);   // 6:30 sáng giờ New York (EDT)
    gan(asc, kinhDo(Date.UTC(1990, 6, 14, 10, 30)).Sun + 12, 12);   // Mặt Trời vừa mọc ~55 phút → cung Mọc ngay sau Mặt Trời
    console.log('bau-troi-tinh: 6 ca đạt'); process.exit(0);
  }
})(typeof window !== 'undefined' ? window : globalThis);

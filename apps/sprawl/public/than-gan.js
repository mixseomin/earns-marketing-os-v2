// Sprawl · Red Spires: chi tiết thân tháp nhìn gần (anh 23/11/2026: "đến gần phải thấy rõ, trên đó có người hoạt động, cửa sổ, đoạn nhô ra vào hợp lý").
// Shader thân (redspires vatThap) chỉ VẼ cửa sổ phẳng; ở đây, với tháp đứng gần camera (< 170 m), dựng hình 3D thật đúng các ô cửa shader:
//   - cửa sổ: khung nổi (hai đố + mi trên), bậu đá nhô, kính phản chiếu lùi sau mép khung, đố giữa → cửa nhìn LÕM vào thân;
//   - đoạn nhô: hộp bay cửa nhô 1,1–1,6 m có kính mặt trước + mái hắt dốc (một số cao hai tầng);
//   - ban công nhỏ: sàn đua 1,6 m, thanh chống chéo dưới bụng, lan can, cửa kính xuống sàn;
//   - người: đứng / đi tới lui trên ban công nhỏ, đi vòng trên các ban công vòng + trong đài kính + trên mái đài kính.
// Ô cửa lấy đúng hàm băm của shader (bam) chép sang JS bằng Math.fround → khung 3D trùng ô kính vẽ. Ra xa > 230 m thì ẩn, giữ tối đa 4 tháp đã dựng.
// tra-repo-ok: mã dán keo giữa hồ sơ tháp nhà (rTai, gen nhịp cửa, ban công vòng) và lớp người instanced có sẵn; không có thư viện ngoài cho phần nối này.
import * as THREE from 'three';

const f = Math.fround, fr = (x) => f(x - Math.floor(x));
// bam(p) của shader: q = fract(p.xyx * 0.1031); q += dot(q, q.yzx + 33.33); fract((q.x + q.y) * q.z)
export function bam(px, py) {
  let x = fr(f(px * f(0.1031))), y = fr(f(py * f(0.1031))), z = x;
  const d = f(f(f(x * f(y + f(33.33))) + f(y * f(z + f(33.33)))) + f(z * f(x + f(33.33))));
  x = f(x + d); y = f(y + d); z = f(z + d);
  return fr(f(f(x + y) * z));
}

const G_HOP = new THREE.BoxGeometry(1, 1, 1), G_KINH = new THREE.PlaneGeometry(1, 1), G_COT = new THREE.CylinderGeometry(0.04, 0.04, 1, 5);
const V_KHUNG = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0.08 });
const V_KINH = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.06, metalness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
const V_KIM = new THREE.MeshStandardMaterial({ color: '#2f2b29', roughness: 0.55, metalness: 0.6 });
const GAN = 170, XA = 230, GIU = 4;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _c = new THREE.Color(), _w = new THREE.Vector3();

export function taoThanGan({ dsThap, tang, geos, vatLieu, mau }) {
  const daDung = new Map(); // bản ghi tháp → { nhom: [Group], nguoi: [...], lop: [...], t }
  let tKiem = 0, tg = 0;

  // dựng chi tiết cho MỘT thân (tháp chính hoặc vệ tinh): nut = Group chứa thân (toạ độ cục bộ trùng vLo của shader)
  function dungThan({ nut, hs, gen, bc }, ds) {
    const nhom = new THREE.Group(); nhom.name = 'than-gan';
    const hop = [], kinh = [], cot = [], nguoi = [];
    const oR = gen.oRong, mDo = new THREE.Color(gen.mau), mVien = new THREE.Color(gen.vien);
    const ww = oR * 0.34, wh = tang * 0.64; // ô kính shader: x 0,33–0,67 ô · y 0,2–0,84 tầng
    const doc = (y) => (hs.rTai(y + 0.5) - hs.rTai(y - 0.5)); // dr/dy: thân thon dần → khung nghiêng theo mặt
    // đặt một khối bám mặt thân: góc a, độ cao y (trên mặt), d = nhô ra theo pháp tuyến, t = lệch ngang theo tiếp tuyến, nghiêng thêm ph quanh trục ngang
    const dat = (arr, a, y, d, t, sx, sy, sz, ph = 0, mau = null) => {
      const r = hs.rTai(y), phi = Math.atan(doc(y)), aa = a + t / Math.max(r, 1);
      const rr = r + d * Math.cos(phi), yy = y - d * Math.sin(phi);
      _q.setFromEuler(_e.set(phi + ph, Math.PI / 2 - aa, 0));
      arr.push({ m: _m.compose(_p.set(Math.cos(aa) * rr, yy, Math.sin(aa) * rr), _q, _s.set(sx, sy, sz)).clone(), c: mau ? mau.clone() : null });
    };
    // ô KHÔNG có cửa shader (phần lớn thân, ảnh mẫu): lá chớp nổi đúng chỗ shader vẽ, cặp cửa nhỏ hẹp, nắp kỹ thuật, cục máy lạnh
    const mXam = (k) => _c.set('#6f6a64').multiplyScalar(0.8 + k * 0.35).clone(), mToi = _c.set('#1a1716').clone();
    const oTrong = (cx, ti, a, r) => {
      const yS = ti * tang, k = bam(cx + 1.3, ti + 4.2), mK = _c.copy(mVien).multiplyScalar(0.7 + k * 0.35).clone();
      if (bam(cx + 9.1, ti + 9.1) >= 0.6) { // lá chớp thông gió: ô shader f.x 0,3–0,7 · f.y 0,35–0,75
        const w = oR * 0.4, y0 = yS + tang * 0.35, h = tang * 0.4, yc = y0 + h / 2, n = 7;
        dat(hop, a, yc, 0.03, 0, w, h, 0.06, 0, mToi);
        for (const s of [-1, 1]) dat(hop, a, yc, 0.12, s * (w / 2 + 0.07), 0.14, h + 0.28, 0.24, 0, mK);
        dat(hop, a, y0 + h + 0.07, 0.12, 0, w + 0.28, 0.14, 0.24, 0, mK); dat(hop, a, y0 - 0.07, 0.14, 0, w + 0.28, 0.14, 0.28, 0, mK);
        for (let j = 0; j < n; j++) dat(hop, a, y0 + (j + 0.5) * h / n, 0.11, 0, w, 0.04, h / n * 1.3, 0.75, mK);
        return;
      }
      const q = bam(cx + 21.7, ti + 3.3);
      if (q > 0.62) { // cặp / bộ ba cửa nhỏ hẹp (ảnh mẫu: cửa con lõm, có khung)
        const ba = q > 0.88, n = ba ? 3 : 2, cw = 0.75, ch = 1.35, gap = 1.25, t0 = (k - 0.5) * oR * 0.35, yc = yS + tang * (0.45 + (q - 0.62) * 0.4);
        for (let j = 0; j < n; j++) { const t = t0 + (j - (n - 1) / 2) * gap;
          for (const s of [-1, 1]) dat(hop, a, yc, 0.1, t + s * (cw / 2 + 0.05), 0.1, ch + 0.2, 0.2, 0, mK);
          dat(hop, a, yc + ch / 2 + 0.06, 0.12, t, cw + 0.2, 0.12, 0.24, 0, mK); dat(hop, a, yc - ch / 2 - 0.06, 0.16, t, cw + 0.3, 0.1, 0.32, 0, mK);
          dat(kinh, a, yc, 0.02, t, cw, ch, 1, 0, _c.set(bam(cx + j, ti + 0.7) < 0.5 ? '#26323a' : '#3a4a52').clone()); }
        return;
      }
      if (q >= 0.16 && q < 0.36) { // KHỐI NHÔ BỪA (anh 23/11/2026: "cửa sổ, ban công nhô ra một cách nham nhở"): phòng con thò ra thân, to nhỏ / sâu nông / cao thấp lệch nhau, không thẳng tầng
        const u = (q - 0.16) / 0.2, v = bam(cx + 17.3, ti + 5.1), w2 = bam(cx + 2.9, ti + 11.7);
        const W = 1.6 + v * 3.8, H = tang * (0.55 + w2 * 1.25), D = 0.7 + u * 2.2, t = (k - 0.5) * oR * 0.45, yb = yS + 0.3 + H / 2 + (v - 0.5) * 0.9;
        const mT = v < 0.25 ? _c.copy(mVien).multiplyScalar(0.75 + w2 * 0.3).clone() : _c.copy(mDo).multiplyScalar(0.7 + w2 * 0.38).clone();
        const khoi = (bw, bh, bd, bt, by, m) => {
          dat(hop, a, by, bd / 2, bt, bw, bh, bd, 0, m);
          dat(hop, a, by + bh / 2 + 0.06, bd / 2 + 0.06, bt, bw + 0.16, 0.12, bd + 0.14, 0, _c.copy(m).multiplyScalar(0.7).clone()); // nóc gờ
          const nw = Math.max(1, Math.min(3, Math.floor(bw / 1.4))), cw = Math.min(0.9, bw / nw - 0.4), ch = Math.min(1.3, bh - 0.7);
          if (ch > 0.4) for (let j = 0; j < nw; j++) { const tt = bt + (j - (nw - 1) / 2) * (bw / nw), yy = by + (bam(cx + j, ti + by) - 0.5) * 0.3;
            dat(kinh, a, yy, bd + 0.02, tt, cw, ch, 1, 0, _c.set(bam(cx + j * 2, ti + 1.9) < 0.6 ? '#1f2a31' : '#4a5960').clone());
            dat(hop, a, yy + ch / 2 + 0.05, bd + 0.05, tt, cw + 0.16, 0.1, 0.1, 0, mK); dat(hop, a, yy - ch / 2 - 0.05, bd + 0.08, tt, cw + 0.22, 0.08, 0.16, 0, mK); }
          if (bd > 1.2) for (const sg of [-1, 1]) { const L = Math.hypot(bd * 0.8, bh * 0.5); dat(hop, a, by - bh / 2 - bh * 0.25, bd * 0.4, bt + sg * (bw / 2 - 0.15), 0.12, 0.12, L, -Math.atan2(bh * 0.5, bd * 0.8), mToi); } // thanh chống chéo dưới bụng
        };
        khoi(W, H, D, t, yb, mT);
        if (v > 0.55) { const s2 = bam(cx + 4.4, ti + 2.2) < 0.5 ? -1 : 1; khoi(W * (0.4 + w2 * 0.3), H * 0.6, D * (0.5 + u * 0.3), t + s2 * W * 0.35, yb + H / 2 + H * 0.3 + 0.12, _c.copy(mT).multiplyScalar(0.85 + v * 0.25).clone()); } // khối con chồng lệch
        if (w2 > 0.7) dat(hop, a, yb, D * 0.5, t + (v < 0.5 ? -1 : 1) * (W / 2 + 0.35), 0.7, H * 0.5, D * 0.5, 0, mXam(w2)); // hộp phụ bên hông
        return;
      }
      if (q >= 0.36 && q < 0.44) { // SÀN THÉP ĐUA RA ở độ cao lẻ: sàn lưới + lan can + chống chéo, có người
        const u = (q - 0.36) / 0.08, D = 1.8 + u * 1.6, W = 2.6 + bam(cx + 8.8, ti) * 3, t = (k - 0.5) * oR * 0.4, yd = yS + (bam(cx + 6.1, ti + 1.4) - 0.5) * 1.2;
        dat(hop, a, yd, D / 2, t, W, 0.14, D, 0, _c.set('#4a4440').clone()); dat(hop, a, yd - 0.12, D - 0.05, t, W, 0.18, 0.1, 0, mToi);
        for (let j = 0; j <= 5; j++) dat(cot, a, yd + 0.6, D - 0.06, t - W / 2 + 0.05 + j * (W - 0.1) / 5, 1, 1.1, 1);
        for (const sg of [-1, 1]) { for (const dd of [0.4, D * 0.5, D - 0.4]) dat(cot, a, yd + 0.6, dd, t + sg * (W / 2 - 0.05), 1, 1.1, 1);
          const L = Math.hypot(D * 0.85, 1.6); dat(hop, a, yd - 0.85, D * 0.43, t + sg * (W / 2 - 0.2), 0.1, 0.1, L, -Math.atan2(1.6, D * 0.85), mToi);
          dat(hop, a, yd + 1.15, D / 2, t + sg * (W / 2 - 0.05), 0.06, 0.06, D, 0, mToi); }
        dat(hop, a, yd + 1.15, D - 0.06, t, W, 0.06, 0.06, 0, mToi);
        dat(hop, a, yd + 1.05, 0.06, t + (u - 0.5) * W * 0.5, 0.9, 2.05, 0.1, 0, mToi); // cửa ra sàn
        const p = bam(cx + 3.7, ti + 9.2), rS = hs.rTai(yd) + 0.7;
        if (p < 0.75) nguoi.push({ kieu: p < 0.35 ? 'qua' : 'dung', a: a + t / r, r: rS + p * (D - 1.2), y: yd + 0.07, nua: W / 2 - 0.6, t: p * 5, v: 0.5 + p, h: p * 30 });
        if (p < 0.3) nguoi.push({ kieu: 'dung', a: a + (t + W * 0.25) / r, r: rS + D * 0.55, y: yd + 0.07, t: 0, v: 0, h: p * 70 });
        return;
      }
      if (q < 0.08) { const t = (k - 0.5) * oR * 0.5, yc = yS + tang * 0.5; // nắp kỹ thuật vuông + tay nắm
        dat(hop, a, yc, 0.04, t, 1.3, 1.3, 0.08, 0, _c.copy(mDo).multiplyScalar(0.7).clone());
        dat(hop, a, yc, 0.1, t + 0.45, 0.08, 0.35, 0.08, 0, mXam(k)); return; }
      if (q < 0.16) { const t = (k - 0.5) * oR * 0.6, yc = yS + tang * 0.3; // cục máy lạnh treo + giá đỡ
        dat(hop, a, yc, 0.4, t, 0.95, 0.65, 0.72, 0, mXam(k)); dat(hop, a, yc, 0.77, t, 0.6, 0.45, 0.02, 0, mToi);
        for (const s of [-1, 1]) dat(hop, a, yc - 0.38, 0.35, t + s * 0.38, 0.06, 0.06, 0.7, 0, mToi); }
    };
    const ngoaiBC = (y) => bc.some((b) => y > b.y - 1.2 && y < b.y + b.cao + 1.5); // ban công vòng đã che dải này
    const nT = Math.floor(gen.than / tang), yS0 = (ti) => ti * tang;
    for (let ti = 2; ti < nT; ti++) {
      const yc = (ti + 0.52) * tang; if (yc + wh / 2 > gen.than - 0.5 || ngoaiBC(yc)) continue;
      const r = hs.rTai(yc), C = Math.PI * r, c0 = Math.ceil(-C / oR), c1 = Math.floor(C / oR) - 1;
      for (let cx = c0; cx <= c1; cx++) {
        if (bam(cx + 31.3, 7.7) > 0.86) { // ống chạy dọc thân theo mép ô, mỗi tầng một đai kẹp
          const ae = cx * oR / r, mO = mXam(bam(cx, 1.1));
          dat(hop, ae, yS0(ti) + tang / 2, 0.32, 0, 0.3, tang + 0.02, 0.3, 0, mO);
          dat(hop, ae, yS0(ti) + 0.4, 0.22, 0, 0.5, 0.1, 0.44, 0, mToi);
        }
        if (bam(cx, ti) <= 0.8) { oTrong(cx, ti, (cx + 0.5) * oR / r, r); continue; }
        const a = (cx + 0.5) * oR / r, k = bam(cx + 13.1, ti + 2.7), k2 = bam(cx + 5.9, ti + 8.3);
        const mK = _c.set(k2 < 0.5 ? '#26323a' : '#33424b').multiplyScalar(0.8 + k2 * 0.4).clone();
        if (k < 0.13) { // đoạn nhô: hộp bay cửa
          const hai = k < 0.035 && ti + 2 < nT && !ngoaiBC(yc + tang), H = hai ? tang * 2 - 0.5 : wh + 0.9, yb = hai ? ti * tang + 0.25 + H / 2 : yc;
          const sau = 1.1 + k2 * 0.5, rong = ww + 1.2, mThan = k2 < 0.3 ? mVien : _c.copy(mDo).multiplyScalar(0.78 + k2 * 0.2).clone();
          dat(hop, a, yb, sau / 2, 0, rong, H, sau, 0, mThan);
          dat(kinh, a, yb, sau + 0.02, 0, ww, H - 0.9, 1, 0, mK);
          for (const s of [-1, 1]) dat(hop, a, yb, sau + 0.06, s * (ww / 2 + 0.07), 0.14, H - 0.75, 0.12, 0, mVien); // khung mặt hộp
          dat(hop, a, yb + H / 2 - 0.38, sau + 0.06, 0, ww + 0.28, 0.12, 0.12, 0, mVien);
          dat(hop, a, yb - H / 2 + 0.38, sau + 0.12, 0, ww + 0.4, 0.1, 0.24, 0, mVien);
          if (hai) dat(hop, a, ti * tang + tang + 0.1, sau + 0.06, 0, ww + 0.28, 0.16, 0.14, 0, mVien); // dầm giữa hai tầng
          dat(hop, a, yb + H / 2 + 0.16, (sau + 0.45) / 2, 0, rong + 0.4, 0.14, sau + 0.45, -0.22, mVien); // mái hắt dốc ra ngoài
          dat(hop, a, yb - H / 2 - 0.12, sau / 2, 0, rong - 0.3, 0.24, sau - 0.1, 0, _c.copy(mDo).multiplyScalar(0.55).clone()); // đáy hộp tối
          if (k2 > 0.7) dat(hop, a, yb - H / 2 + 0.5, 0.35, (rong / 2 + 0.55) * (k2 > 0.85 ? 1 : -1), 0.9, 0.6, 0.7, 0, _c.set('#8f8a82').clone()); // cục máy lạnh cạnh hộp
          continue;
        }
        const ban = k < 0.25; // ban công nhỏ: cửa đi xuống sàn
        const yS = ti * tang; // sàn tầng
        const hc = ban ? (0.84 * tang - 0.25) : wh, ycua = ban ? yS + 0.25 + hc / 2 : yc;
        // khung nổi: hai đố đứng + mi trên + bậu → kính lùi sau mép khung 0,3 m nhìn như lõm vào thân
        const mKhung = _c.copy(mVien).multiplyScalar(0.85 + k2 * 0.25).clone();
        for (const s of [-1, 1]) dat(hop, a, ycua, 0.16, s * (ww / 2 + 0.09), 0.18, hc + 0.36, 0.32, 0, mKhung);
        dat(hop, a, ycua + hc / 2 + 0.1, 0.18, 0, ww + 0.36, 0.2, 0.36, 0, mKhung);
        if (k2 > 0.55) dat(hop, a, ycua + hc / 2 + 0.3, 0.3, 0, ww + 0.7, 0.1, 0.6, -0.3, mKhung); // mi hắt nước
        dat(kinh, a, ycua, 0.03, 0, ww, hc, 1, 0, mK);
        dat(hop, a, ycua, 0.07, 0, 0.07, hc, 0.08, 0, mKhung); // đố giữa
        if (k2 < 0.5) dat(hop, a, ycua + hc * 0.22, 0.07, 0, ww, 0.06, 0.08, 0, mKhung); // đố ngang
        if (!ban) { dat(hop, a, ycua - hc / 2 - 0.07, 0.28, 0, ww + 0.55, 0.13, 0.56, 0, _c.set('#c9bba6').multiplyScalar(0.8 + k2 * 0.3).clone()); continue; }
        // ban công nhỏ: sàn đua + chống chéo + lan can
        const sau = 1.6, rong = ww + 1.8, mSan = _c.set('#857c72').multiplyScalar(0.85 + k2 * 0.3).clone();
        dat(hop, a, yS + 0.12, sau / 2, 0, rong, 0.24, sau, 0, mSan);
        dat(hop, a, yS - 0.02, sau / 2 + 0.05, 0, rong + 0.1, 0.06, sau + 0.1, 0, mVien); // gờ mép sàn
        for (const s of [-1, 1]) { const L = Math.hypot(1.35, 1.2); dat(hop, a, yS - 0.6, 0.68, s * (rong / 2 - 0.25), 0.12, 0.12, L, -Math.atan2(1.2, 1.35), mVien); }
        for (let j = 0; j <= 4; j++) dat(cot, a, yS + 0.25 + 0.55, sau - 0.06, -rong / 2 + 0.05 + j * (rong - 0.1) / 4, 1, 1.1, 1);
        for (const s of [-1, 1]) for (const dd of [0.5, 1.05]) dat(cot, a, yS + 0.25 + 0.55, dd, s * (rong / 2 - 0.05), 1, 1.1, 1);
        dat(hop, a, yS + 1.38, sau - 0.06, 0, rong, 0.06, 0.07, 0, mVien); // tay vịn
        dat(hop, a, yS + 0.85, sau - 0.06, 0, rong, 0.04, 0.04, 0, mVien);
        for (const s of [-1, 1]) dat(hop, a, yS + 1.38, sau / 2, s * (rong / 2 - 0.05), 0.07, 0.06, sau, 0, mVien);
        // người trên ban công nhỏ: đứng ngắm phố / đi tới lui / tựa lan can
        const p = bam(cx + 2.2, ti + 6.6);
        if (p < 0.65) nguoi.push({ kieu: p < 0.25 ? 'qua' : 'dung', a, r: hs.rTai(yS) + 0.6 + p * 1.1, y: yS + 0.25, nua: rong / 2 - 0.6, t: p * 7, v: 0.6 + p, h: p * 40 });
        if (p < 0.2) nguoi.push({ kieu: 'dung', a: a + 0.9 / hs.rTai(yS), r: hs.rTai(yS) + 1.1, y: yS + 0.25, t: 0, v: 0, h: p * 90 });
      }
    }
    // người trên ban công vòng / trong đài kính / trên mái đài kính
    for (const b of bc) for (const san of b.san) {
      const rv = hs.rTai(san.y) + 0.6, ro = san.ro - 0.6; if (ro - rv < 0.6) continue;
      const n = Math.round(Math.PI * 2 * ro / san.thua);
      for (let i = 0; i < n; i++) { const h = bam(i + 3.3, san.y), hh = bam(i + 7.1, san.y + 1);
        nguoi.push(hh < 0.22 ? { kieu: 'dung', a: (i + h) / n * Math.PI * 2, r: rv + (ro - rv) * (0.6 + 0.4 * h), y: san.y, t: 0, v: 0, h: h * 50 }
          : { kieu: 'vong', a: (i + h) / n * Math.PI * 2, r: rv + (ro - rv) * h, y: san.y, v: (0.9 + hh * 0.7) * (h < 0.5 ? 1 : -1), t: h * 9 }); }
    }
    const lam = (geo, mat, ds) => { if (!ds.length) return; const im = new THREE.InstancedMesh(geo, mat, ds.length);
      ds.forEach((o, i) => { im.setMatrixAt(i, o.m); if (o.c) im.setColorAt(i, o.c); else if (im.instanceColor || mat !== V_KIM) im.setColorAt(i, _c.set('#ffffff')); });
      im.computeBoundingSphere(); nhom.add(im); };
    lam(G_HOP, V_KHUNG, hop); lam(G_KINH, V_KINH, kinh); lam(G_COT, V_KIM, cot);
    // lớp người: 4 InstancedMesh chung ma trận, aDi = (tốc độ, pha bước) như nguoi-gan.js
    let lop = [];
    if (nguoi.length) {
      const n = nguoi.length, aDi = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2); aDi.setUsage(THREE.DynamicDrawUsage);
      lop = geos.map((g) => { const g2 = g.clone(); g2.setAttribute('aDi', aDi); const m = new THREE.InstancedMesh(g2, vatLieu, n); m.frustumCulled = false; return m; });
      lop[0].instanceMatrix.setUsage(THREE.DynamicDrawUsage); for (const m of lop.slice(1)) m.instanceMatrix = lop[0].instanceMatrix;
      const bang = [mau.quan, mau.ao, mau.da, mau.toc];
      nguoi.forEach((o, i) => { const s = bam(i + 1.1, o.y); o.s = 0.92 + s * 0.16; lop.forEach((m, j) => m.setColorAt(i, _c.set(bang[j][(bam(i + j * 3.7, o.y + j) * bang[j].length) | 0]))); });
      nhom.add(...lop);
    }
    nut.add(nhom); ds.push({ nhom, nguoi, lop });
  }

  function dung(d) { const ds = []; for (const ct of d.chiTiet) dungThan(ct, ds); return { ds, t: 0 }; }
  function bo(d, x) { for (const { nhom } of x.ds) { nhom.parent?.remove(nhom); nhom.traverse((o) => { if (o.isInstancedMesh) { o.dispose(); if (o.geometry !== G_HOP && o.geometry !== G_KINH && o.geometry !== G_COT) o.geometry.dispose(); } }); } daDung.delete(d); }

  function chay(x, dt) { // đi người: vòng quanh ban công vòng · tới lui trên ban công nhỏ · đứng xoay nhẹ
    for (const { nguoi, lop } of x.ds) { if (!lop.length) continue; const aDi = lop[0].geometry.attributes.aDi;
      nguoi.forEach((o, i) => { let a = o.a, r = o.r, hg, v = 0;
        if (o.kieu === 'vong') { o.a += o.v / o.r * dt; a = o.a; v = Math.abs(o.v); hg = o.v > 0 ? -a : Math.PI - a; o.t += v * 5.2 * dt; }
        else if (o.kieu === 'qua') { o.t += dt * 0.35 * o.v; const ph = o.t % 2, di = ph < 1 ? ph : 2 - ph; const s = (di * 2 - 1) * o.nua; a = o.a + s / r;
          const toi = ph < 1; v = Math.abs(Math.sin(Math.PI * di)) > 0.08 ? o.v : 0; hg = toi ? -a : Math.PI - a; o.buoc = (o.buoc || 0) + v * 5.2 * dt; }
        else { hg = Math.PI / 2 - a + Math.sin(tg * 0.3 + o.h) * 0.6; } // đứng ngắm phố, quay đầu chậm
        aDi.setXY(i, v, o.kieu === 'vong' ? o.t : o.buoc || 0);
        _q.setFromEuler(_e.set(0, hg, 0)); lop[0].setMatrixAt(i, _m.compose(_p.set(Math.cos(a) * r, o.y, Math.sin(a) * r), _q, _s.setScalar(o.s))); });
      lop[0].instanceMatrix.needsUpdate = true; aDi.needsUpdate = true; }
  }

  return {
    khung(dt, cam) {
      tg += dt; tKiem -= dt;
      if (tKiem <= 0) { tKiem = 0.4; const cx = cam.position.x, cz = cam.position.z;
        for (const d of dsThap) { if (!d.g.visible) continue; d.g.getWorldPosition(_w); const kc = Math.hypot(_w.x - cx, _w.z - cz) - d.R; const x = daDung.get(d);
          if (kc < GAN && !x) daDung.set(d, dung(d)); else if (x) for (const { nhom } of x.ds) nhom.visible = kc < XA; }
        if (daDung.size > GIU) { const xep = [...daDung.keys()].map((d) => { d.g.getWorldPosition(_w); return [d, Math.hypot(_w.x - cx, _w.z - cz) - d.R]; }).sort((p, q) => q[1] - p[1]);
          for (const [d] of xep.slice(0, daDung.size - GIU)) bo(d, daDung.get(d)); } }
      for (const x of daDung.values()) if (x.ds[0]?.nhom.visible) chay(x, dt);
    },
    get tk() { let n = 0, ng = 0; for (const x of daDung.values()) for (const t of x.ds) { n++; ng += t.nguoi.length; } return { thapGan: daDung.size, than: n, nguoi: ng }; },
  };
}

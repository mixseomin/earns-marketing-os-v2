// Âm thanh sinh bằng Web Audio — không tệp âm thanh. Rì rầm đông người, lửa lách tách, đàn gảy (Karplus–Strong),
// gió và dung nham ầm ì ngoài trời. Âm quán có vị trí 3D; đứng ngoài quán thì nghe nghẹt (lọc thấp).
export function taoAmThanh() {
  const C = new (window.AudioContext || window.webkitAudioContext)();
  const tong = C.createGain(); tong.gain.value = 0.8; tong.connect(C.destination);
  const nhieu = (giay, mau = 'trang') => { const b = C.createBuffer(1, C.sampleRate * giay, C.sampleRate), d = b.getChannelData(0); let o = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (mau === 'nau') { o = (o + 0.02 * w) / 1.02; d[i] = o * 3.5; } else d[i] = w; } return b; };
  const vong = (buf) => { const s = C.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
  const NAU = nhieu(4, 'nau'), TRANG = nhieu(2);

  // ngoài trời: gió + dung nham
  { const s = vong(NAU), f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 90; const g = C.createGain(); g.gain.value = 0.35; s.connect(f).connect(g).connect(tong); }
  const gio = C.createGain(); gio.gain.value = 0.08;
  { const s = vong(TRANG), f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6; s.connect(f).connect(gio).connect(tong);
    setInterval(() => gio.gain.setTargetAtTime(0.03 + Math.random() * 0.09, C.currentTime, 1.5), 2000); }

  // bus quán: lọc thấp khi đứng ngoài
  const loc = C.createBiquadFilter(); loc.type = 'lowpass'; loc.frequency.value = 900;
  const quan = C.createGain(); quan.gain.value = 0; quan.connect(loc).connect(tong);
  const diem = (x, y, z, ref = 1.5) => { const p = C.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1.2;
    p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; p.connect(quan); return p; };

  return {
    C,
    gan(q) { // gắn nguồn âm của quán (gọi một lần)
      const [tx, tz] = q.tam;
      // rì rầm: 4 "giọng" nhiễu lọc dải, đóng mở theo nhịp âm tiết ngẫu nhiên
      const r = diem(tx, 1.5, tz, 3);
      for (const f0 of [260, 420, 650, 900]) {
        const s = vong(TRANG), f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = f0; f.Q.value = 3; const g = C.createGain(); g.gain.value = 0;
        s.connect(f).connect(g).connect(r);
        const nhip = () => { const t = C.currentTime; g.gain.setTargetAtTime(Math.random() < 0.35 ? 0 : 0.18 + Math.random() * 0.3, t, 0.03); f.frequency.setTargetAtTime(f0 * (0.8 + Math.random() * 0.5), t, 0.05); setTimeout(nhip, 90 + Math.random() * 180); };
        nhip();
      }
      // tiếng cười bật lên thỉnh thoảng
      const cuoi = () => { const t = C.currentTime, o = C.createOscillator(), g = C.createGain(); o.type = 'sawtooth'; const f = 180 + Math.random() * 120; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
        o.connect(lp).connect(g).connect(r); g.gain.value = 0;
        for (let k = 0; k < 5; k++) { g.gain.setTargetAtTime(0.05, t + k * 0.16, 0.01); g.gain.setTargetAtTime(0, t + k * 0.16 + 0.08, 0.02); o.frequency.setValueAtTime(f * (1 - k * 0.04), t + k * 0.16); }
        o.start(t); o.stop(t + 1); setTimeout(cuoi, 4000 + Math.random() * 9000); };
      setTimeout(cuoi, 3000);
      // lửa lách tách
      const lp = diem(q.lua[0], 0.6, q.lua[1], 1);
      { const s = vong(NAU), f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; const g = C.createGain(); g.gain.value = 0.5; s.connect(f).connect(g).connect(lp); }
      const tach = () => { const t = C.currentTime, s = C.createBufferSource(); s.buffer = TRANG; const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500 + Math.random() * 3000; const g = C.createGain();
        g.gain.setValueAtTime(0.25 + Math.random() * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03 + Math.random() * 0.05);
        s.connect(f).connect(g).connect(lp); s.start(t, Math.random()); s.stop(t + 0.1); setTimeout(tach, 30 + Math.random() * 260); };
      tach();
      // đàn gảy: dây đàn Karplus–Strong, giai điệu ngũ cung đi ngẫu nhiên
      const [dx, dz] = q.W_(q.dan.x, q.dan.z), dp = diem(dx, 1.1, dz, 2);
      const day = (hz) => { const n = Math.round(C.sampleRate / hz), b = C.createBuffer(1, C.sampleRate * 1.6, C.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = i < n ? Math.random() * 2 - 1 : (d[i - n] + d[i - n + 1]) * 0.497; return b; };
      const NOT = [196, 220, 247, 294, 330, 392, 440, 494].map(day);
      let i = 3, nhipDan = 0;
      const choi = () => { const t = C.currentTime; i = Math.max(0, Math.min(NOT.length - 1, i + Math.floor(Math.random() * 5) - 2));
        for (const k of nhipDan % 4 === 0 ? [i, Math.max(0, i - 2)] : [i]) { const s = C.createBufferSource(), g = C.createGain(); g.gain.value = 0.35; s.buffer = NOT[k]; s.connect(g).connect(dp); s.start(t); }
        nhipDan++; setTimeout(choi, nhipDan % 8 === 7 ? 900 : 300 + (Math.random() < 0.3 ? 150 : 0)); };
      choi();
    },
    capNhat(cam, trongQuan, kcQuan) {
      const l = C.listener, p = cam.position, f = cam.getWorldDirection(new cam.position.constructor()), t = C.currentTime;
      if (l.positionX) { l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z; l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
      else { l.setPosition(p.x, p.y, p.z); l.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
      loc.frequency.setTargetAtTime(trongQuan ? 16000 : 700, t, 0.15);
      quan.gain.setTargetAtTime(trongQuan ? 1 : Math.max(0, 1 - kcQuan / 40) * 0.8, t, 0.2);
    },
    // tiếng ngắn có vị trí: 'ren' búa gõ đe (kim loại, các hoạ âm lệch) · 'ga' gà cục tác · 'cho' chó sủa
    tieng(kieu, x, y, z) {
      const t = C.currentTime, p = C.createPanner(); p.panningModel = 'HRTF'; p.refDistance = 2; p.rolloffFactor = 1.4; p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; p.connect(tong);
      if (kieu === 'ren') for (const [f, a, d] of [[1180, 0.18, 0.9], [2630, 0.1, 0.6], [3870, 0.06, 0.4], [520, 0.08, 0.3]]) { const o = C.createOscillator(), g = C.createGain(); o.frequency.value = f * (0.98 + Math.random() * 0.04); g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(p); o.start(t); o.stop(t + d); }
      else if (kieu === 'ga') for (let k = 0; k < 3; k++) { const o = C.createOscillator(), g = C.createGain(); o.type = 'square'; const t0 = t + k * 0.11; o.frequency.setValueAtTime(700 + Math.random() * 200, t0); o.frequency.exponentialRampToValueAtTime(420, t0 + 0.08); g.gain.setValueAtTime(0.04, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09); const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; o.connect(f).connect(g).connect(p); o.start(t0); o.stop(t0 + 0.1); }
      else if (kieu === 'cho') for (let k = 0; k < 2; k++) { const o = C.createOscillator(), g = C.createGain(); o.type = 'sawtooth'; const t0 = t + k * 0.22; o.frequency.setValueAtTime(320, t0); o.frequency.exponentialRampToValueAtTime(180, t0 + 0.12); g.gain.setValueAtTime(0.09, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14); const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; o.connect(f).connect(g).connect(p); o.start(t0); o.stop(t0 + 0.15); }
      setTimeout(() => p.disconnect(), 1500);
    },
    tat(b) { tong.gain.setTargetAtTime(b ? 0 : 0.8, C.currentTime, 0.1); },
  };
}

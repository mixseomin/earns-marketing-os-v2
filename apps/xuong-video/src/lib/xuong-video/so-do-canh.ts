// SƠ ĐỒ CẢNH 2D (anh 23/10/2026, phim #322: "chưa được về không gian, vị trí… Vivian liếc sang trái để thấy Thần nhưng video sau thì nó lại đi vào
// từ bên phải. Phi logic"). Gốc: mỗi mảnh tự ghi trái / phải bằng tay, không có một mặt bằng chung. Lần 3D trước hỏng vì bắt model CHÉP hình render;
// ở đây sơ đồ KHÔNG đi vào model dưới dạng hình — chỉ sinh (1) câu hướng cho prompt (ai bên nào màn, nhìn về phía nào, vào từ phía nào) và (2) kỳ vọng
// để cổng đo trên keyframe (soi-mat.py: tâm mặt + hướng nhìn) so. Mặt bằng nhìn từ trên: x sang đông (m), y sang bắc (m); máy = chỗ đặt + điểm nhìn.
// Trục 180° (Film Art ch.6): hai shot liền nhau có cặp người nhìn nhau thì hai máy cùng một phía đường nối hai người. Thuần — tự kiểm: so-do-canh.test.mts
export type Diem = [number, number];
export type SoDo = { moc: Record<string, Diem>; may: Record<string, { dat: Diem; nhin: Diem; /** tiêu cự tương đương mm (mặc định 35): cận mặt 60–85, toàn 24–28 */ ong?: number }>; /** tên đưa model của mốc ('thang' → 'the elevator door') */ ten?: Record<string, string> };
/** Một mảnh theo sơ đồ: máy nào · ai / cái gì ở đâu (tên mốc hoặc toạ độ) · ai nhìn ai / cái gì · ai đi vào khung từ mốc nào. */
export type ManhSoDo = { may: string; o: Record<string, string | Diem>; nhin?: Record<string, string>; vao?: Record<string, string>; /** ai THẤY trong khung (mặc định: mọi người trong o) — người ngoài khung vẫn có chỗ để tính hướng nhìn */ khung?: string[] };
export type KyVong = { ben: -1 | 0 | 1; nhin?: -1 | 0 | 1 };

const tru = (a: Diem, b: Diem): Diem => [a[0] - b[0], a[1] - b[1]];
const cham = (a: Diem, b: Diem) => a[0] * b[0] + a[1] * b[1];
const diem = (s: SoDo, m: ManhSoDo, x: string | Diem): Diem | null => (Array.isArray(x) ? x : m.o[x] != null ? diem(s, m, m.o[x]!) : s.moc[x] ?? null);
const truc = (s: SoDo, ten: string) => { const c = s.may[ten]; if (!c) throw new Error(`sơ đồ không có máy "${ten}"`); const f = tru(c.nhin, c.dat); const l = Math.hypot(...f) || 1; const fw: Diem = [f[0] / l, f[1] / l]; return { dat: c.dat, fw, phai: [fw[1], -fw[0]] as Diem, k: (0.36 * 35) / (c.ong ?? 35) }; };
/** Vị trí ngang trên màn (−1 trái … +1 phải): chiếu lên trục phải của máy chia độ sâu. Khung DỌC 9:16, ống ~35 mm → nửa góc ngang ≈ 20° (tan 0,36). */
export function viTriMan(s: SoDo, m: ManhSoDo, x: string | Diem): number | null {
  const p = diem(s, m, x); if (!p) return null; const t = truc(s, m.may); const v = tru(p, t.dat); const sau = cham(v, t.fw); if (sau <= 0.05) return null;
  return Math.max(-1.5, Math.min(1.5, cham(v, t.phai) / sau / t.k));
}
/** Hướng trên màn khi A nhìn / đi về B: −1 sang trái màn, +1 sang phải, 0 = gần như thẳng về phía máy. */
export function huongMan(s: SoDo, m: ManhSoDo, a: string | Diem, b: string | Diem): -1 | 0 | 1 {
  const pa = diem(s, m, a), pb = diem(s, m, b); if (!pa || !pb) return 0; const t = truc(s, m.may); const d = tru(pb, pa); const l = Math.hypot(...d) || 1;
  const x = cham(d, t.phai) / l; return Math.abs(x) < 0.2 ? 0 : x > 0 ? 1 : -1;
}
/** Độ SÂU của ánh nhìn A→B so với máy: +1 = nhìn thẳng vào sâu khung (quay lưng về máy), −1 = nhìn về phía máy, 0 = nghiêng ngang. */
const doSau = (s: SoDo, m: ManhSoDo, a: string | Diem, b: string | Diem): number | null => { const pa = diem(s, m, a), pb = diem(s, m, b); if (!pa || !pb) return null; const d = tru(pb, pa); return cham(d, truc(s, m.may).fw) / (Math.hypot(...d) || 1); };
/** Nhìn RA XA máy (quay lưng về máy): sâu > 0,7 — không thấy mặt, không kỳ vọng hướng mắt. */
const raXa = (s: SoDo, m: ManhSoDo, a: string | Diem, b: string | Diem) => (doSau(s, m, a, b) ?? 0) > 0.7;
/** NỬA LƯNG (sâu 0,3–0,7 ≈ 45–72° khỏi trục máy): vẫn có phía trái / phải nhưng mặt quay vào trong khung. Tả như "looks toward screen right" thì model vẽ
 *  mặt nghiêng hẳn và đẩy vật được nhìn ra SAU LƯNG (phim #353 shot #2, 24/10/2026: #1 Hạ quay lưng nhìn thang, #2 nghiêng phải với thang sau lưng). */
const NUA_LUNG = 0.3;
const BEN = (x: number) => (x < -0.33 ? 'screen left' : x > 0.33 ? 'screen right' : 'center frame');
const PHIA = (h: -1 | 0 | 1) => (h < 0 ? 'toward screen left' : h > 0 ? 'toward screen right' : 'straight ahead past the lens');
/** Câu hướng tiếng Anh cho prompt (dan_dung.huong): chỗ đứng trên màn, ánh mắt, phía đi vào. tenEn = tên đưa model cho mốc / đồ (tiếng Anh). */
export function cauHuong(s: SoDo, m: ManhSoDo, nguoi: string[], tenEn: (t: string) => string = (t) => t): string {
  const out: string[] = [];
  const thay = (n: string) => m.o[n] != null && (!m.khung || m.khung.includes(n));
  const dung = nguoi.filter((n) => thay(n) && !m.vao?.[n]).map((n) => { const x = viTriMan(s, m, n); return x == null ? '' : `${n} at ${BEN(x)}`; }).filter(Boolean);
  if (dung.length) out.push(`Placement on screen: ${dung.join(', ')}`);
  const ten = (b: string) => (nguoi.includes(b) ? b : tenEn(b) === b ? s.ten?.[b] ?? b : tenEn(b));
  for (const [a, b] of Object.entries(m.nhin ?? {})) {
    const sau = doSau(s, m, a, b) ?? 0; const la = !nguoi.includes(b); // nhìn vào MỐC / đồ: nói luôn mốc nằm trước hay sau người (model hay đặt ngược)
    if (sau > 0.7) out.push(`${a} faces away from the camera toward ${ten(b)}, back half turned to us${la ? `; ${ten(b)} is in front of ${a}, deeper in the frame, never behind ${a}` : ''}`);
    else if (sau > NUA_LUNG) out.push(`${a} is turned three-quarters away from the camera, looking ${PHIA(huongMan(s, m, a, b))} and deeper into the frame at ${ten(b)}; we see the back of ${a}'s head, ear and cheek line, not the full face${la ? `; ${ten(b)} is in front of ${a}, never behind ${a}` : ''}`);
    else out.push(`${a} looks ${PHIA(huongMan(s, m, a, b))} at ${ten(b)}, eyes on ${la ? 'it' : 'them'}, not at the camera${la && sau < -NUA_LUNG ? `; ${ten(b)} is off screen on the camera side` : ''}`);
  }
  for (const [a, tu] of Object.entries(m.vao ?? {})) { const x = viTriMan(s, m, tu); const h = huongMan(s, m, tu, a); out.push(`${a} enters from ${x == null ? (h < 0 ? 'screen right' : 'screen left') : x < 0 ? 'screen left' : 'screen right'}, moving ${PHIA(h).replace(' past the lens', '')}`); }
  return out.join('; ');
}
/** Thay ký hiệu {A→B} trong câu đầu / đuôi bằng phía màn tính từ sơ đồ ('toward screen left'…) — hướng trong chữ không viết tay. */
export const thayHuong = (s: SoDo, m: ManhSoDo, chu: string): string => chu.replace(/\{([^{}→]+)→([^{}]+)\}/g, (_, a: string, b: string) => PHIA(huongMan(s, m, a.trim(), b.trim())));
/** Kỳ vọng cho cổng đo keyframe: người trong khung → phía màn (+ phía nhìn nếu khai). */
export function kyVong(s: SoDo, m: ManhSoDo, nguoi: string[]): Record<string, KyVong> {
  const r: Record<string, KyVong> = {};
  for (const n of nguoi) { if (m.o[n] == null || (m.khung && !m.khung.includes(n))) continue; const x = m.vao?.[n] ? viTriMan(s, m, m.vao[n]!) : viTriMan(s, m, n); if (x == null) continue;
    r[n] = { ben: x < -0.33 ? -1 : x > 0.33 ? 1 : 0, ...(m.nhin?.[n] && !raXa(s, m, n, m.nhin[n]!) ? { nhin: huongMan(s, m, n, m.nhin[n]!) } : {}) }; }
  return r;
}
/** Trục 180°: mảnh liền nhau cùng có hai người A, B (đứng trong sơ đồ) → hai máy phải cùng phía đường A–B. Trả lỗi theo cặp. */
export function loiTruc(s: SoDo, ds: (ManhSoDo & { thu_tu: number })[], nguoi: string[]): string[] {
  const out: string[] = [];
  const phia = (m: ManhSoDo, a: string, b: string) => { const pa = diem(s, m, a)!, pb = diem(s, m, b)!; const c = s.may[m.may]!.dat; const v = tru(pb, pa), w = tru(c, pa); return Math.sign(v[0] * w[1] - v[1] * w[0]); };
  for (let i = 0; i + 1 < ds.length; i++) {
    const x = ds[i]!, y = ds[i + 1]!;
    const chung = nguoi.filter((n) => x.o[n] != null && y.o[n] != null);
    for (let a = 0; a < chung.length; a++) for (let b = a + 1; b < chung.length; b++) {
      const A = chung[a]!, B = chung[b]!; const p1 = phia(x, A, B), p2 = phia(y, A, B);
      if (p1 && p2 && p1 !== p2) out.push(`#${x.thu_tu}→#${y.thu_tu}: máy "${x.may}" và "${y.may}" ở hai phía đường ${A}–${B} — vượt trục 180°, trái / phải trên màn đảo`);
    }
  }
  return out;
}
/** So kỳ vọng với đo trên keyframe (soi-mat: tâm mặt o.x 0..1, nhin.g độ: + = phải màn). Lệch phía đứng / phía nhìn → lỗi. */
export const NGUONG_NHIN_SO_DO = 8;
export function loiDoHuong(kv: Record<string, KyVong>, ket: { ten: string; o?: { x: number }; nhin?: { g: number } }[]): string[] {
  const out: string[] = [];
  for (const [ten, k] of Object.entries(kv)) {
    const m = ket.find((x) => x.ten === ten); if (!m) continue;
    if (k.ben && m.o) { const ben = m.o.x < 0.42 ? -1 : m.o.x > 0.58 ? 1 : 0; if (ben !== k.ben && ben !== 0) out.push(`${ten} đứng ${ben < 0 ? 'TRÁI' : 'PHẢI'} màn, sơ đồ cần ${k.ben < 0 ? 'TRÁI' : 'PHẢI'}`); }
    if (k.nhin && m.nhin) { const g = m.nhin.g; if (Math.abs(g) < NGUONG_NHIN_SO_DO) out.push(`${ten} nhìn thẳng ống kính (${g}°), sơ đồ cần nhìn sang ${k.nhin < 0 ? 'TRÁI' : 'PHẢI'}`); else if (Math.sign(g) !== k.nhin) out.push(`${ten} nhìn sang ${g < 0 ? 'TRÁI' : 'PHẢI'} (${g}°), sơ đồ cần ${k.nhin < 0 ? 'TRÁI' : 'PHẢI'}`); }
  }
  return out;
}

// ── TỜ PHÁC BỐ TRÍ (anh 24/10/2026: "hướng các nhân vật so với bối cảnh và các nhân vật còn lại đang không đồng nhất"): chữ "bên trái màn / nhìn sang phải"
// không đủ — model không tự dựng lại góc máy, mỗi khung tự đặt người + nền. Máy vẽ từ sơ đồ một khung PHÁC (nét thô như phác chì của người vẽ phân cảnh):
// tường + cửa + mảng nhận diện chiếu đúng góc máy, mỗi người một bóng màu đúng chỗ / đúng cỡ theo độ sâu, mũi tên = hướng nhìn. Chỉ dẫn tầng THUMBNAIL
// (scripts/bang-gom.mts tầng 1), không phải ảnh để model chép điểm ảnh (bài học khung 3D xám).
export type MangPhong = { loai: 'tuong' | 'cua' | 'tranh' | 'cot'; tu: Diem; den: Diem; z0?: number; z1: number; mau?: string };
const MAU_MANG: Record<MangPhong['loai'], string> = { tuong: '#3c3c44', cua: '#b9bec6', tranh: '#d9b44a', cot: '#55555f' };
/** SVG khung phác W×H của một mảnh. mau = màu bóng từng người; cao máy 1,5 m, khung dọc nửa góc ngang tan 0,36 / dọc tan 0,64. */
export function svgPhac(s: SoDo & { phong?: MangPhong[] }, m: ManhSoDo, nguoi: string[], mau: Record<string, string>, W = 360, H = 640): string {
  const t = truc(s, m.may); const CAO = 1.5;
  const chieu = (p: Diem, z: number): [number, number] | null => { const v = tru(p, t.dat); const sau = cham(v, t.fw); if (sau < 0.3) return null;
    return [W / 2 + (cham(v, t.phai) / sau / t.k) * (W / 2), H / 2 - ((z - CAO) / sau / ((t.k * 16) / 9)) * (H / 2)]; };
  const out: string[] = [`<rect width="${W}" height="${H}" fill="#e9e9ec"/>`];
  const chan = chieu(diem(s, m, m.o[nguoi.find((n) => m.o[n] != null) ?? ''] ?? '') ?? (s.may[m.may]!.nhin as Diem), 0); const ngang = chan ? Math.min(H, Math.max(H * 0.35, chan[1])) : H * 0.6;
  out.push(`<rect y="${ngang}" width="${W}" height="${H - ngang}" fill="#a7a7ae"/>`);   // sàn
  for (const mg of s.phong ?? []) {   // mảng phòng: lấy mẫu dọc cạnh, chỉ vẽ phần trước máy
    const n = 24; const tren: string[] = []; const duoi: string[] = [];
    for (let i = 0; i <= n; i++) { const p: Diem = [mg.tu[0] + ((mg.den[0] - mg.tu[0]) * i) / n, mg.tu[1] + ((mg.den[1] - mg.tu[1]) * i) / n]; const a = chieu(p, mg.z1), b = chieu(p, mg.z0 ?? 0); if (a && b) { tren.push(`${a[0].toFixed(1)},${a[1].toFixed(1)}`); duoi.unshift(`${b[0].toFixed(1)},${b[1].toFixed(1)}`); } }
    if (tren.length >= 2) out.push(`<polygon points="${[...tren, ...duoi].join(' ')}" fill="${mg.mau ?? MAU_MANG[mg.loai]}" stroke="#222" stroke-width="2"/>`);
  }
  // người: xa vẽ trước, gần vẽ sau
  const ds = nguoi.filter((n) => m.o[n] != null && (!m.khung || m.khung.includes(n))).map((n) => ({ n, p: diem(s, m, m.vao?.[n] ? m.o[n]! : n)! })).filter((x) => x.p)
    .map((x) => ({ ...x, sau: cham(tru(x.p, t.dat), t.fw) })).filter((x) => x.sau > 0.3).sort((a, b) => b.sau - a.sau);
  for (const { n, p } of ds) {
    const dau = chieu(p, 1.62), chanN = chieu(p, 0), vai = chieu(p, 1.38); if (!dau || !chanN || !vai) continue;
    const r = Math.abs(chanN[1] - dau[1]) * 0.075; const ngangThan = r * 2.3; const c = mau[n] ?? '#888';
    out.push(`<rect x="${(vai[0] - ngangThan).toFixed(1)}" y="${vai[1].toFixed(1)}" width="${(ngangThan * 2).toFixed(1)}" height="${(chanN[1] - vai[1]).toFixed(1)}" rx="${(r * 0.8).toFixed(1)}" fill="${c}" stroke="#111" stroke-width="3"/>`);
    out.push(`<circle cx="${dau[0].toFixed(1)}" cy="${dau[1].toFixed(1)}" r="${r.toFixed(1)}" fill="${c}" stroke="#111" stroke-width="3"/>`);
    // DẤU MẶT (#353 #2: chỉ một hình tròn → model vẽ Hạ quay lưng ở cận mặt): quay về phía máy = hai mắt lệch theo hướng nhìn; quay lưng = mái tóc phủ kín đầu
    { const dich0 = m.nhin?.[n]; const lung = dich0 ? raXa(s, m, n, dich0) : false; const h0 = dich0 ? huongMan(s, m, n, dich0) : 0;
      if (lung) out.push(`<circle cx="${dau[0].toFixed(1)}" cy="${dau[1].toFixed(1)}" r="${(r * 0.92).toFixed(1)}" fill="#1b1b1b"/>`);
      else { const dx = h0 * r * 0.35, mr = Math.max(2, r * 0.13); for (const sx of [-1, 1]) out.push(`<circle cx="${(dau[0] + dx + sx * r * 0.33).toFixed(1)}" cy="${(dau[1] - r * 0.1).toFixed(1)}" r="${mr.toFixed(1)}" fill="#111"/>`); } }
    const dich = m.nhin?.[n]; if (dich) { const h = huongMan(s, m, n, dich); const L = Math.max(30, r * 2.4) * (h || 0); if (h) out.push(`<line x1="${dau[0]}" y1="${dau[1]}" x2="${dau[0] + L}" y2="${dau[1]}" stroke="#e8212b" stroke-width="${Math.max(4, r / 5)}"/><polygon points="${dau[0] + L},${dau[1] - r / 2.5} ${dau[0] + L + Math.sign(L) * r / 1.6},${dau[1]} ${dau[0] + L},${dau[1] + r / 2.5}" fill="#e8212b"/>`); }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${out.join('')}</svg>`;
}

/** CẬN MẶT QUAY LƯNG (#353 #2 — cận Hạ nghe tiếng giày mà hình chỉ thấy gáy): cỡ cận (cu / mcu / ecu) mà người đang nhìn RA XA máy → không đọc được mặt.
 *  Sửa ở sơ đồ: đặt máy cận về phía người đó đang nhìn tới. Trả lỗi theo mảnh. */
export function loiCanMat(s: SoDo, ds: (ManhSoDo & { thu_tu: number; co?: string })[]): string[] {
  return ds.flatMap((m) => (/^(cu|mcu|ecu)$/.test(m.co ?? '') ? Object.entries(m.nhin ?? {}).filter(([a, b]) => (!m.khung || m.khung.includes(a)) && raXa(s, m, a, b))
    .map(([a]) => `#${m.thu_tu}: cận "${m.may}" mà ${a} quay lưng về máy (đang nhìn ra xa) — đặt máy về phía ${a} đang nhìn tới` ) : []));
}
/** CHỮ TRÁI SƠ ĐỒ: câu viết tay (ảnh / diễn / đầu / đuôi) đặt mốc A đang nhìn vào "behind her/him" trong khi sơ đồ nói mốc ở phía trước (sâu > NUA_LUNG),
 *  hoặc "in front of" khi mốc ở phía máy. Câu hướng máy đúng mà chữ tay ngược thì model nghe chữ tay (phim #353 #2: "the door softly blurred behind her"). */
export function loiChuSoDo(s: SoDo, m: ManhSoDo, chu: string): string[] {
  const out: string[] = []; const cau = chu.split(/(?<=[.;!?])\s+/);
  for (const [a, b] of Object.entries(m.nhin ?? {})) {
    if (!s.moc[b] || m.o[b] != null) continue; const sau = doSau(s, m, a, b); if (sau == null) continue;
    const ten = (s.ten?.[b] ?? b).replace(/^the\s+/i, '').toLowerCase(); const loi = ten.split(/\s+/).pop()!; // "elevator door" → khớp "door"
    for (const c of cau) { const l = c.toLowerCase(); if (!l.includes(loi)) continue;
      if (sau > NUA_LUNG && /\bbehind (her|him|them)\b|\bat (her|his|their) back\b/.test(l)) out.push(`"${c.trim()}" — ${a} đang nhìn ${ten} ở PHÍA TRƯỚC (trong sâu khung), chữ lại đặt nó sau lưng`);
      if (sau < -NUA_LUNG && /\bin front of (her|him|them)\b/.test(l)) out.push(`"${c.trim()}" — ${ten} ở phía MÁY (sau lưng ống kính), chữ lại đặt trước mặt ${a}`); }
  }
  return out;
}

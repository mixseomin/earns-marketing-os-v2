// SƠ ĐỒ CẢNH 2D (anh 23/10/2026, phim #322: "chưa được về không gian, vị trí… Vivian liếc sang trái để thấy Thần nhưng video sau thì nó lại đi vào
// từ bên phải. Phi logic"). Gốc: mỗi mảnh tự ghi trái / phải bằng tay, không có một mặt bằng chung. Lần 3D trước hỏng vì bắt model CHÉP hình render;
// ở đây sơ đồ KHÔNG đi vào model dưới dạng hình — chỉ sinh (1) câu hướng cho prompt (ai bên nào màn, nhìn về phía nào, vào từ phía nào) và (2) kỳ vọng
// để cổng đo trên keyframe (soi-mat.py: tâm mặt + hướng nhìn) so. Mặt bằng nhìn từ trên: x sang đông (m), y sang bắc (m); máy = chỗ đặt + điểm nhìn.
// Trục 180° (Film Art ch.6): hai shot liền nhau có cặp người nhìn nhau thì hai máy cùng một phía đường nối hai người. Thuần — tự kiểm: so-do-canh.test.mts
export type Diem = [number, number];
export type SoDo = { moc: Record<string, Diem>; may: Record<string, { dat: Diem; nhin: Diem; /** tiêu cự tương đương mm (mặc định 35): cận mặt 60–85, toàn 24–28 */ ong?: number;
    /** ĐỘ CAO MÁY (m, mặc định ngang mắt chủ thể): cao hơn mắt ≥ 0,25 = máy cao nhìn xuống (thu nhỏ nhân vật), thấp hơn ≥ 0,25 = máy thấp nhìn lên (trao quyền lực) */ cao?: number }>;
  /** tên đưa model của mốc ('thang' → 'the elevator door') */ ten?: Record<string, string>;
  /** CHIỀU CAO MẮT từng nhân vật (m, tính cả giày) — ánh nhìn theo chiều dọc: người thấp ngước lên nhìn người cao (eyeline match dọc) */ mat_cao?: Record<string, number>;
  /** ĐÈN CHÍNH của cảnh (key light): đứng ở đâu trên mặt bằng — mọi góc máy giữ cùng một phía sáng (lighting continuity) */ den?: { tu: Diem; ten?: string };
  /** CẤU KIỆN CỐ ĐỊNH của địa điểm (tường / cửa / tranh / cột) — mỗi món một đoạn tu→den trên mặt bằng + chiều cao. Hình học KHÔNG đổi giữa mọi shot:
   *  viTriMan dịch điểm giữa mỗi món ra trái / giữa / phải / ngoài khung THEO TỪNG MÁY → câu "FIXED LAYOUT" (prompt) + lá đối chiếu, nên đổi góc máy cửa không lật
   *  (anh 31/10/2026, phim #353 thang máy: nền "2 cửa" mà cửa nhảy trái / phải mỗi khung vì `phong` chỉ dùng vẽ SVG debug, chưa bao giờ vào prompt). Nguồn duy nhất với svgPhac. */
  phong?: MangPhong[] };
/** Một mảnh theo sơ đồ: máy nào · ai / cái gì ở đâu (tên mốc hoặc toạ độ) · ai nhìn ai / cái gì · ai đi vào khung từ mốc nào. */
export type ManhSoDo = { may: string; o: Record<string, string | Diem>; nhin?: Record<string, string>; vao?: Record<string, string>; /** người CỐ Ý không nhìn người vừa nói (khong-gian.ts › luật người nghe nhìn người nói) */ ne_nhin?: string[]; /** ai THẤY trong khung (mặc định: mọi người trong o) — người ngoài khung vẫn có chỗ để tính hướng nhìn */ khung?: string[] };
export type KyVong = { ben: -1 | 0 | 1; nhin?: -1 | 0 | 1; /** quay lưng / nửa lưng — không có mặt để đo, đừng đưa tên cho bộ so mặt (gán nhầm mặt người khác) */ lung?: true; /** quay lưng HẲN (sâu > 0,7) — không thể thấy mặt; nửa lưng thì có thể lộ má / nghiêng */ han?: true; /** KHUNG QUA VAI: người này quay lưng ở TIỀN CẢNH (gần máy hơn người được nhìn, người kia trong khung) — má / tai lộ ra là bình thường, cổng đếm mặt không tính */ ots?: true };

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
export const doSau = (s: SoDo, m: ManhSoDo, a: string | Diem, b: string | Diem): number | null => { const pa = diem(s, m, a), pb = diem(s, m, b); if (!pa || !pb) return null; const d = tru(pb, pa); return cham(d, truc(s, m.may).fw) / (Math.hypot(...d) || 1); };
/** Nhìn RA XA máy (quay lưng về máy): sâu > 0,7 — không thấy mặt, không kỳ vọng hướng mắt. */
const raXa = (s: SoDo, m: ManhSoDo, a: string | Diem, b: string | Diem) => (doSau(s, m, a, b) ?? 0) > 0.7;
/** NỬA LƯNG (sâu 0,3–0,7 ≈ 45–72° khỏi trục máy): vẫn có phía trái / phải nhưng mặt quay vào trong khung. Tả như "looks toward screen right" thì model vẽ
 *  mặt nghiêng hẳn và đẩy vật được nhìn ra SAU LƯNG (phim #353 shot #2, 24/10/2026: #1 Hạ quay lưng nhìn thang, #2 nghiêng phải với thang sau lưng). */
export const NUA_LUNG = 0.3;
const BEN = (x: number) => (x < -0.33 ? 'screen left' : x > 0.33 ? 'screen right' : 'center frame');
const PHIA = (h: -1 | 0 | 1) => (h < 0 ? 'toward screen left' : h > 0 ? 'toward screen right' : 'straight ahead past the lens');
/** PHÍA ĐÈN CHÍNH so với máy: ngang −1..1 (+ = từ phải màn), sâu (+ = sau chủ thể) — MỘT nguồn cho câu prompt (cauHuong) và máy đo phía sáng mặt (khong-gian.ts). */
export function phiaSang(s: SoDo, m: ManhSoDo, nguoi: string[]): { ngang: number; sau: number } | null {
  if (!s.den) return null; const thay = (n: string) => m.o[n] != null && (!m.khung || m.khung.includes(n));
  const ps = nguoi.filter(thay).map((n) => diem(s, m, n)).filter((p): p is Diem => !!p);
  const tam: Diem | null = ps.length ? [ps.reduce((x, p) => x + p[0], 0) / ps.length, ps.reduce((y, p) => y + p[1], 0) / ps.length] : s.may[m.may]?.nhin ?? null; if (!tam) return null;
  const t2 = truc(s, m.may); const v = tru(s.den.tu, tam); const l = Math.hypot(...v) || 1; return { ngang: cham(v, t2.phai) / l, sau: cham(v, t2.fw) / l };
}
/** KHOẢNG CÁCH giữa hai người trong sơ đồ (m). */
export const khoangCach = (s: SoDo, m: ManhSoDo, a: string, b: string): number | null => { const pa = diem(s, m, a), pb = diem(s, m, b); return pa && pb ? Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) : null; };
/** Câu hướng tiếng Anh cho prompt (dan_dung.huong): chỗ đứng trên màn, ánh mắt, phía đi vào. tenEn = tên đưa model cho mốc / đồ (tiếng Anh). */
export function cauHuong(s: SoDo, m: ManhSoDo, nguoi: string[], tenEn: (t: string) => string = (t) => t): string {
  const out: string[] = [];
  const thay = (n: string) => m.o[n] != null && (!m.khung || m.khung.includes(n));
  const dung = nguoi.filter((n) => thay(n)).map((n) => { if (m.vao?.[n]) { const x = viTriMan(s, m, m.vao[n]!); const h = huongMan(s, m, m.vao[n]!, n);
    // người ĐANG VÀO: đứng sát mép phía mốc vào, mới bước vào — không ghi thì model đặt giữa khung (phim #353 #3: Vivian đứng giữa sảnh ngay khung đầu)
    return `${n} at the very ${x == null ? (h < 0 ? 'screen-right' : 'screen-left') : x < 0 ? 'screen-left' : 'screen-right'} edge, only just stepping into frame`; }
    const x = viTriMan(s, m, n); return x == null ? '' : `${n} at ${BEN(x)}`; }).filter(Boolean);
  if (dung.length) out.push(`Placement on screen: ${dung.join(', ')}`);
  // KHOẢNG CÁCH giữa hai người cùng khung (sơ đồ): sát (≤ 1,2 m) / xa (≥ 3 m) — không nói thì model tự đặt (#353 #7: Vivian đứng cách cả sải tay khi đang giật thẻ)
  { const tk = nguoi.filter((n) => thay(n) && !m.vao?.[n]);
    for (let i = 0; i < tk.length; i++) for (let j = i + 1; j < tk.length; j++) { const pa = diem(s, m, tk[i]!), pb = diem(s, m, tk[j]!); if (!pa || !pb) continue; const kc = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
      if (kc <= 1.2) out.push(`${tk[i]} and ${tk[j]} stand close together, within arm's reach of each other`); else if (kc >= 3) out.push(`${tk[i]} and ${tk[j]} stand far apart (about ${Math.round(kc)} m)`); } }
  // người CÓ chỗ trong cảnh nhưng NGOÀI khung: nói thẳng là không thấy — không nói thì model tự thêm vào khi câu diễn nhắc tên (phim #353 #16: "mắt nhìn
  // theo Hạ" → model vẽ Hạ đứng cạnh Vivian dù #15 Hạ đã quay đi)
  // cận chèn (khung rỗng): tay / đồ của người vẫn trong khung — không ghi OFF SCREEN (câu ảnh của cận chèn tự nói phần nào thấy)
  const ngoai = m.khung?.length ? nguoi.filter((n) => m.o[n] != null && !m.khung!.includes(n)) : [];
  if (ngoai.length) out.push(`${ngoai.join(' and ')} ${ngoai.length > 1 ? 'are' : 'is'} OFF SCREEN — not visible anywhere in this frame`);
  const ten = (b: string) => (nguoi.includes(b) ? b : tenEn(b) === b ? s.ten?.[b] ?? b : tenEn(b));
  for (const [a, b] of Object.entries(m.nhin ?? {})) {
    const sau = doSau(s, m, a, b) ?? 0; const la = !nguoi.includes(b); // nhìn vào MỐC / đồ: nói luôn mốc nằm trước hay sau người (model hay đặt ngược)
    if (sau > 0.7) out.push(`${a} faces away from the camera toward ${ten(b)}, back half turned to us${la ? `; ${ten(b)} is in front of ${a}, deeper in the frame, never behind ${a}` : ''}`);
    else if (sau > NUA_LUNG) out.push(`${a} is turned three-quarters away from the camera, looking ${PHIA(huongMan(s, m, a, b))} and deeper into the frame at ${ten(b)}; we see the back of ${a}'s head, ear and cheek line, not the full face${la ? `; ${ten(b)} is in front of ${a}, never behind ${a}` : ''}`);
    else out.push(`${a} looks ${PHIA(huongMan(s, m, a, b))} at ${ten(b)}, eyes on ${la ? 'it' : 'them'}, not at the camera${la && sau < -NUA_LUNG ? `; ${ten(b)} is off screen on the camera side` : ''}`);
  }
  for (const [a, tu] of Object.entries(m.vao ?? {})) { const x = viTriMan(s, m, tu); const h = huongMan(s, m, tu, a); out.push(`${a} enters from ${x == null ? (h < 0 ? 'screen right' : 'screen left') : x < 0 ? 'screen left' : 'screen right'}, moving ${PHIA(h).replace(' past the lens', '')}`); }
  // ÁNH NHÌN DỌC (eyeline theo chiều cao): A nhìn người B cao / thấp hơn rõ → ngước lên / nhìn xuống
  for (const [a, b] of Object.entries(m.nhin ?? {})) { const ha = s.mat_cao?.[a], hb = s.mat_cao?.[b]; if (ha == null || hb == null || !thay(a)) continue;
    if (hb - ha >= 0.08) out.push(`${a} tilts the eyes slightly UP to meet ${b}'s eyes (${b} is taller)`); else if (ha - hb >= 0.08) out.push(`${a} looks slightly DOWN at ${b} (${b} is shorter)`); }
  // GÓC MÁY THEO ĐỘ CAO (power angle): máy so với mắt chủ thể chính (người đầu tiên trong khung)
  { const may = s.may[m.may]; const chinh = nguoi.find((n) => thay(n) && !m.vao?.[n]); const hm = chinh ? s.mat_cao?.[chinh] : undefined;
    if (may?.cao != null && chinh && hm != null) { const d = may.cao - hm;
      out.push(d >= 0.25 ? `High angle: the camera is above ${chinh}'s eyes and looks down on ${chinh}` : d <= -0.25 ? `Low angle: the camera is below ${chinh}'s eyes and looks up at ${chinh}` : 'Eye-level camera'); } }
  // ĐÈN CHÍNH (lighting continuity): phía sáng trên màn tính từ chỗ đèn so với chủ thể — mọi góc máy cùng cảnh giữ đúng một phía
  if (s.den) { const ps = phiaSang(s, m, nguoi);
    if (ps) { const phia = Math.abs(ps.ngang) < 0.25 ? (ps.sau > 0 ? 'from behind the subjects (backlight, rim on hair and shoulders)' : 'from the camera side, frontal') : `from screen ${ps.ngang < 0 ? 'left' : 'right'}${ps.sau > 0.4 ? ' and slightly behind (rim light)' : ''}`;
      out.push(`Key light${s.den.ten ? ` (${s.den.ten})` : ''} comes ${phia} — faces are lit on that side; keep this light direction`); } }
  return out.join('; ');
}
/** Thay ký hiệu {A→B} trong câu đầu / đuôi bằng phía màn tính từ sơ đồ ('toward screen left'…) — hướng trong chữ không viết tay. */
export const thayHuong = (s: SoDo, m: ManhSoDo, chu: string): string => chu.replace(/\{([^{}→]+)→([^{}]+)\}/g, (_, a: string, b: string) => PHIA(huongMan(s, m, a.trim(), b.trim())));
// ── CẤU KIỆN CỐ ĐỊNH (so_do.phong): hình học bất biến của địa điểm → dịch ra phía màn theo TỪNG máy cho prompt + đối chiếu ──────────────────────
// Nguồn = `phong` (đã có, trước chỉ dùng vẽ SVG debug). Mỗi món một đoạn tu→den; điểm giữa chiếu qua viTriMan nên đổi góc máy chỗ-màn đổi đúng hình học, KHÔNG lật bậy.
// Danh từ cho LOẠI hình học (cửa/tranh/cột). Cấu kiện có hình riêng (loai 'vat') mang danh từ của chính nó qua `ten`/`ten_en`, không tra bảng này.
const NEN_EN: Record<'cua' | 'tranh' | 'cot', readonly [string, string]> = { cua: ['door', 'doors'], tranh: ['framed picture on the wall', 'framed pictures on the wall'], cot: ['column', 'columns'] };
const NEN_VI: Record<'cua' | 'tranh' | 'cot', string> = { cua: 'cửa', tranh: 'tranh treo tường', cot: 'cột' };
const giuaMon = (p: MangPhong): Diem => [(p.tu[0] + p.den[0]) / 2, (p.tu[1] + p.den[1]) / 2];
/** Chỗ của một điểm (tên mốc hoặc toạ độ) so với KHUNG của máy m: trước / sau máy, lệch ngang (nx: âm = trái, dương = phải; |nx|>1 = ngoài mép khung). null khi thiếu máy / điểm. */
function choMan(s: SoDo, m: ManhSoDo, mon: string | Diem): { sau: number; nx: number } | null {
  if (!s.may[m.may]) return null; const p = diem(s, m, mon); if (!p) return null;
  const t = truc(s, m.may); const v = tru(p, t.dat); const sau = cham(v, t.fw);
  return { sau, nx: sau <= 0.05 ? 0 : cham(v, t.phai) / sau / t.k };
}
/** Chỗ trên màn của một ĐIỂM (kể cả ngoài khung): 'trai'|'giua'|'phai' nếu ở trước máy, null nếu sau lưng / ngay máy (không thấy). */
export function benMan(s: SoDo, m: ManhSoDo, mon: string | Diem): 'trai' | 'giua' | 'phai' | null {
  const c = choMan(s, m, mon); if (!c || c.sau <= 0.05) return null;
  return c.nx < -0.33 ? 'trai' : c.nx > 0.33 ? 'phai' : 'giua';
}
const choEn = (c: { sau: number; nx: number }) => c.sau <= 0.05 ? 'behind the camera, not in this frame'
  : c.nx < -1 ? 'just off-screen to the left' : c.nx > 1 ? 'just off-screen to the right'
  : c.nx < -0.33 ? 'at screen-left' : c.nx > 0.33 ? 'at screen-right' : 'at screen-center';
const choVi = (c: { sau: number; nx: number }) => c.sau <= 0.05 ? 'sau lưng máy, ngoài khung'
  : c.nx < -1 ? 'ngoài khung bên trái' : c.nx > 1 ? 'ngoài khung bên phải'
  : c.nx < -0.33 ? 'trái màn' : c.nx > 0.33 ? 'phải màn' : 'giữa màn';
/** Một nhóm cấu kiện cùng tên/loại sau khi chiếu theo máy: danh từ EN (1 / nhiều), danh từ VI, có-phải-cửa, số lượng, chỗ-màn gộp. */
type NhomNen = { en1: string; enN: string; vi: string; laCua: boolean; n: number; c: { sau: number; nx: number } };
/** Gom `phong` + điểm-giữa-gộp chiếu theo máy. Bỏ tường TRƠN (không tên); cấu kiện có `ten` (bục lan / logo / bảng) gom theo TÊN để giữ đồng nhất, loại hình học (cửa/tranh/cột) gom theo loại. */
function nhomPhong(s: SoDo, m: ManhSoDo): NhomNen[] {
  if (!s.may[m.may]) return [];
  const g = new Map<string, { en1: string; enN: string; vi: string; laCua: boolean; items: MangPhong[] }>();
  for (const p of s.phong ?? []) {
    if (p.loai === 'tuong' && !p.ten) continue;   // tường trơn không là cấu kiện để nhắc
    const co = p.loai === 'cua' || p.loai === 'tranh' || p.loai === 'cot' ? p.loai : null;
    const key = p.ten ? `t:${p.ten}` : p.loai;
    const en1 = p.ten_en ?? p.ten ?? (co ? NEN_EN[co][0] : 'fixture');
    const enN = p.ten_en ? `${p.ten_en}s` : p.ten ?? (co ? NEN_EN[co][1] : 'fixtures');   // tên EN số nhiều = +s; tên VI không biến đổi
    const vi = p.ten ?? (co ? NEN_VI[co] : 'vật');
    const e = g.get(key) ?? { en1, enN, vi, laCua: p.loai === 'cua', items: [] };
    e.items.push(p); g.set(key, e);
  }
  return [...g.values()].flatMap((e) => {
    const cs = e.items.map((p) => choMan(s, m, giuaMon(p))).filter((c): c is { sau: number; nx: number } => !!c);
    if (!cs.length) return [];
    return [{ en1: e.en1, enN: e.enN, vi: e.vi, laCua: e.laCua, n: e.items.length, c: { sau: cs.reduce((a, c) => a + c.sau, 0) / cs.length, nx: cs.reduce((a, c) => a + c.nx, 0) / cs.length } }];
  });
}
/** Câu "FIXED LAYOUT" cho prompt keyframe: mỗi cấu kiện → tên + số lượng + CHỖ TRÊN MÀN tính theo máy m. Cửa kèm "chỉ bấy nhiêu cửa, cùng một tường".
 *  Giữ bất biến hình học qua mọi góc: đổi máy thì chỗ-màn đổi đúng hình học, nhưng số lượng không đổi và không cửa nào mọc thêm / nhảy tường. */
export function cauBoiCanhCoDinh(s: SoDo, m: ManhSoDo): string {
  const cum = nhomPhong(s, m).map(({ en1, enN, laCua, n, c }) => {
    const ten = n > 1 ? `the ${n} ${enN}` : `the ${en1}`;
    const chi = laCua ? ` — these are the ONLY doors in this location, all set into this one wall; add no door anywhere else and never flip them to another wall` : '';
    return `${ten}: ${choEn(c)}${chi}`;
  });
  if (!cum.length) return '';
  return `FIXED LAYOUT of this location — the real walls and fixtures, identical in every shot: ${cum.join('; ')}.`;
}
/** Lá đối chiếu cho cấu kiện cố định (một lá mỗi cấu kiện): thanh_phan "Cấu kiện cố định · <tên vi>" · du_kien "<n> <tên vi>, <chỗ màn>". */
export function coDinhDuKien(s: SoDo, m: ManhSoDo): { thanh_phan: string; du_kien: string }[] {
  return nhomPhong(s, m).map(({ vi, n, c }) => ({ thanh_phan: `Cấu kiện cố định · ${vi}`, du_kien: `${n} ${vi}, ${choVi(c)}` }));
}
/** Một cấu kiện sau khi chiếu theo máy, kèm cờ TRONG KHUNG (Bước 3). Bước 4 dùng: trong=true → tả + vị trí; trong=false → dòng "không vẽ". */
export type NenKhung = { en1: string; enN: string; vi: string; n: number; choEn: string; choVi: string; trong: boolean };
/** Tách cấu kiện của địa điểm theo máy m: cái nào LỌT KHUNG (trước máy, trong mép |nx|≤1), cái nào ngoài / sau lưng. Nguồn vị trí = sơ đồ 2D (shot tĩnh) hoặc máy 3D (shot động). */
export function nenTheoKhung(s: SoDo, m: ManhSoDo): NenKhung[] {
  return nhomPhong(s, m).map(({ en1, enN, vi, n, c }) => ({ en1, enN, vi, n, choEn: choEn(c), choVi: choVi(c), trong: c.sau > 0.05 && Math.abs(c.nx) <= 1 }));
}
/** Kỳ vọng cho cổng đo keyframe: người trong khung → phía màn (+ phía nhìn nếu khai). */
export function kyVong(s: SoDo, m: ManhSoDo, nguoi: string[]): Record<string, KyVong> {
  const r: Record<string, KyVong> = {};
  for (const n of nguoi) { if (m.o[n] == null || (m.khung && !m.khung.includes(n))) continue; const x = m.vao?.[n] ? viTriMan(s, m, m.vao[n]!) : viTriMan(s, m, n); if (x == null) continue;
    const b = m.nhin?.[n]; const lung = !!b && (doSau(s, m, n, b) ?? 0) > NUA_LUNG;
    // qua vai: n quay lưng, người được nhìn b cũng trong khung và XA máy hơn n
    const ots = lung && !!b && nguoi.includes(b) && m.o[b] != null && (!m.khung || m.khung.includes(b)) && (() => { const c = s.may[m.may]!.dat; const pn = diem(s, m, n)!, pb = diem(s, m, b)!; return Math.hypot(pn[0] - c[0], pn[1] - c[1]) < Math.hypot(pb[0] - c[0], pb[1] - c[1]); })();
    r[n] = { ben: x < -0.33 ? -1 : x > 0.33 ? 1 : 0, ...(b && !raXa(s, m, n, b) ? { nhin: huongMan(s, m, n, b) } : {}), ...(lung ? { lung: true as const, ...(raXa(s, m, n, b!) ? { han: true as const } : {}), ...(ots ? { ots: true as const } : {}) } : {}) }; }
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
// CẤU KIỆN của một địa điểm (bộ bối cảnh). Hình học tu→den + z nằm trong sơ đồ (per tập); DANH TÍNH (ảnh anchor, mô tả) nằm ở xv_nhan_vat loai 'cau_kien' cùng phim,
// NỐI BẰNG `ten` (khai một lần/phim, 100 cảnh dùng lại). `vat_lieu` = bề mặt khi không cần ảnh riêng (marble đen, thép chải). loai 'vat' = cấu kiện có hình riêng
// (bục lan / ghế / bảng chỉ dẫn / logo / cây) — khác cửa/tranh/cột là loại hình học thuần.
export type MangPhong = { loai: 'tuong' | 'cua' | 'tranh' | 'cot' | 'vat'; tu: Diem; den: Diem; z0?: number; z1: number; mau?: string;
  /** tên cấu kiện — khớp xv_nhan_vat loai 'cau_kien' cùng phim để lấy ảnh anchor + mô tả (đồng nhất qua mọi shot) */ ten?: string;
  /** danh từ tiếng Anh ngắn cho prompt (vd "white-orchid pedestal"); thiếu thì dùng `ten` */ ten_en?: string;
  /** vật liệu bề mặt khi cấu kiện không cần ảnh riêng (vd "black marble", "brushed steel") */ vat_lieu?: string };
const MAU_MANG: Record<MangPhong['loai'], string> = { tuong: '#3c3c44', cua: '#b9bec6', tranh: '#d9b44a', cot: '#55555f', vat: '#6a8f5a' };
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
  return ds.flatMap((m) => (/^(cu|mcu|ecu)$/.test(m.co ?? '') ? Object.entries(m.nhin ?? {}).filter(([a, b]) => (!m.khung || m.khung.includes(a)) && raXa(s, m, a, b) && !(m.o[b] != null && (!m.khung || m.khung.includes(b))))   // quay lưng nhìn người KHÁC trong khung = vai tiền cảnh của khung qua vai, đúng ý
    .map(([a]) => `#${m.thu_tu}: cận "${m.may}" mà ${a} quay lưng về máy (đang nhìn ra xa) — đặt máy về phía ${a} đang nhìn tới` ) : []));
}
/** CHỮ TRÁI SƠ ĐỒ: câu viết tay (ảnh / diễn / đầu / đuôi) đặt mốc A đang nhìn vào "behind her/him" trong khi sơ đồ nói mốc ở phía trước (sâu > NUA_LUNG),
 *  hoặc "in front of" khi mốc ở phía máy. Câu hướng máy đúng mà chữ tay ngược thì model nghe chữ tay (phim #353 #2: "the door softly blurred behind her"). */
export function loiChuSoDo(s: SoDo, m: ManhSoDo, chu: string): string[] {
  const out: string[] = []; const cau = chu.split(/[.;:,!?]\s*/); // từng VẾ câu: "from behind her right shoulder, … the door" là chỗ máy, không phải chỗ cửa
  for (const [a, b] of Object.entries(m.nhin ?? {})) {
    if (!s.moc[b] || m.o[b] != null) continue; const sau = doSau(s, m, a, b); if (sau == null) continue;
    const ten = (s.ten?.[b] ?? b).replace(/^the\s+/i, '').toLowerCase(); const loi = ten.split(/\s+/).pop()!; // "elevator door" → khớp "door"
    for (const c of cau) { const l = c.toLowerCase(); if (!l.includes(loi)) continue;
      if (sau > NUA_LUNG && /\bbehind (her|him|them)\b(?! (right |left )?(shoulder|head|back|ear))|\bat (her|his|their) back\b/.test(l)) out.push(`"${c.trim()}" — ${a} đang nhìn ${ten} ở PHÍA TRƯỚC (trong sâu khung), chữ lại đặt nó sau lưng`);
      if (sau < -NUA_LUNG && /\bin front of (her|him|them)\b/.test(l)) out.push(`"${c.trim()}" — ${ten} ở phía MÁY (sau lưng ống kính), chữ lại đặt trước mặt ${a}`); }
  }
  return out;
}
/** KẾ THỪA ÁNH NHÌN qua đường cắt (phim #353 #2→#3, 24/10/2026: cuối #2 Hạ đã quay sang lối vào, đầu #3 lại quay lưng nhìn vách thang vì #3 không khai Hạ
 *  nhìn gì). Mảnh sau có người A trong khung mà không khai nhin[A] → lấy đích nhìn ở khung CUỐI mảnh trước; đích là mốc mà trong mảnh này có người đi vào
 *  từ mốc đó → A nhìn người đang vào. Giữ qua cả shot người đó vắng khung (cận chèn), hết khi người đó đổi chỗ đứng. Đích là người không có chỗ trong mảnh này thì để trống (không tính được hướng). Trả bản sao, không sửa đầu vào. */
export function keThuaNhin<T extends { sd?: ManhSoDo; sd_ket?: Partial<ManhSoDo> }>(s: SoDo, ds: T[]): T[] {
  const out = ds.map((m) => (m.sd ? { ...m, sd: { ...m.sd, nhin: { ...(m.sd.nhin ?? {}) } } } : m));
  // ánh nhìn GẦN NHẤT của từng người, giữ qua shot họ không trong khung (cận chèn #6 không có mặt → #7 vẫn biết Hạ đang nhìn Vivian)
  // Chỉ giữ khi người đó còn ĐỨNG CHỖ CŨ — đổi chỗ (Hạ vào trong thang ở #17) là ánh nhìn cũ hết nghĩa.
  const cuoi = new Map<string, { b: string; o: string }>(); const cho = (m: ManhSoDo, a: string) => JSON.stringify(m.o[a] ?? null);
  for (const cu of out) {
    if (!cu.sd) continue;
    for (const [a, { b, o }] of cuoi) {
      if (cu.sd.o[a] == null || (cu.sd.khung && !cu.sd.khung.includes(a)) || cu.sd.nhin![a] || cho(cu.sd, a) !== o) continue;
      const vao = Object.entries(cu.sd.vao ?? {}).find(([, tu]) => tu === b)?.[0];
      const dich = vao ?? (cu.sd.o[b] != null || s.moc[b] ? b : null);
      if (dich && dich !== a) cu.sd.nhin![a] = dich;
    }
    const ket = { ...cu.sd, ...(cu.sd_ket ?? {}), o: { ...cu.sd.o, ...(cu.sd_ket?.o ?? {}) } } as ManhSoDo;
    for (const [a, b] of Object.entries({ ...(cu.sd.nhin ?? {}), ...(cu.sd_ket?.nhin ?? {}) })) cuoi.set(a, { b, o: cho(ket, a) });
  }
  return out;
}

// SƠ ĐỒ CẢNH 2D (anh 23/10/2026, phim #322: "chưa được về không gian, vị trí… Vivian liếc sang trái để thấy Thần nhưng video sau thì nó lại đi vào
// từ bên phải. Phi logic"). Gốc: mỗi mảnh tự ghi trái / phải bằng tay, không có một mặt bằng chung. Lần 3D trước hỏng vì bắt model CHÉP hình render;
// ở đây sơ đồ KHÔNG đi vào model dưới dạng hình — chỉ sinh (1) câu hướng cho prompt (ai bên nào màn, nhìn về phía nào, vào từ phía nào) và (2) kỳ vọng
// để cổng đo trên keyframe (soi-mat.py: tâm mặt + hướng nhìn) so. Mặt bằng nhìn từ trên: x sang đông (m), y sang bắc (m); máy = chỗ đặt + điểm nhìn.
// Trục 180° (Film Art ch.6): hai shot liền nhau có cặp người nhìn nhau thì hai máy cùng một phía đường nối hai người. Thuần — tự kiểm: so-do-canh.test.mts
export type Diem = [number, number];
export type SoDo = { moc: Record<string, Diem>; may: Record<string, { dat: Diem; nhin: Diem }>; /** tên đưa model của mốc ('thang' → 'the elevator door') */ ten?: Record<string, string> };
/** Một mảnh theo sơ đồ: máy nào · ai / cái gì ở đâu (tên mốc hoặc toạ độ) · ai nhìn ai / cái gì · ai đi vào khung từ mốc nào. */
export type ManhSoDo = { may: string; o: Record<string, string | Diem>; nhin?: Record<string, string>; vao?: Record<string, string>; /** ai THẤY trong khung (mặc định: mọi người trong o) — người ngoài khung vẫn có chỗ để tính hướng nhìn */ khung?: string[] };
export type KyVong = { ben: -1 | 0 | 1; nhin?: -1 | 0 | 1 };

const tru = (a: Diem, b: Diem): Diem => [a[0] - b[0], a[1] - b[1]];
const cham = (a: Diem, b: Diem) => a[0] * b[0] + a[1] * b[1];
const diem = (s: SoDo, m: ManhSoDo, x: string | Diem): Diem | null => (Array.isArray(x) ? x : m.o[x] != null ? diem(s, m, m.o[x]!) : s.moc[x] ?? null);
const truc = (s: SoDo, ten: string) => { const c = s.may[ten]; if (!c) throw new Error(`sơ đồ không có máy "${ten}"`); const f = tru(c.nhin, c.dat); const l = Math.hypot(...f) || 1; const fw: Diem = [f[0] / l, f[1] / l]; return { dat: c.dat, fw, phai: [fw[1], -fw[0]] as Diem }; };
/** Vị trí ngang trên màn (−1 trái … +1 phải): chiếu lên trục phải của máy chia độ sâu. Khung DỌC 9:16, ống ~35 mm → nửa góc ngang ≈ 20° (tan 0,36). */
export function viTriMan(s: SoDo, m: ManhSoDo, x: string | Diem): number | null {
  const p = diem(s, m, x); if (!p) return null; const t = truc(s, m.may); const v = tru(p, t.dat); const sau = cham(v, t.fw); if (sau <= 0.05) return null;
  return Math.max(-1.5, Math.min(1.5, cham(v, t.phai) / sau / 0.36));
}
/** Hướng trên màn khi A nhìn / đi về B: −1 sang trái màn, +1 sang phải, 0 = gần như thẳng về phía máy. */
export function huongMan(s: SoDo, m: ManhSoDo, a: string | Diem, b: string | Diem): -1 | 0 | 1 {
  const pa = diem(s, m, a), pb = diem(s, m, b); if (!pa || !pb) return 0; const t = truc(s, m.may); const d = tru(pb, pa); const l = Math.hypot(...d) || 1;
  const x = cham(d, t.phai) / l; return Math.abs(x) < 0.2 ? 0 : x > 0 ? 1 : -1;
}
/** Nhìn RA XA máy (quay lưng / nửa lưng về máy): thành phần sâu > 0,7 — không thấy mặt, không kỳ vọng hướng mắt. */
const raXa = (s: SoDo, m: ManhSoDo, a: string | Diem, b: string | Diem) => { const pa = diem(s, m, a), pb = diem(s, m, b); if (!pa || !pb) return false; const d = tru(pb, pa); return cham(d, truc(s, m.may).fw) / (Math.hypot(...d) || 1) > 0.7; };
const BEN = (x: number) => (x < -0.33 ? 'screen left' : x > 0.33 ? 'screen right' : 'center frame');
const PHIA = (h: -1 | 0 | 1) => (h < 0 ? 'toward screen left' : h > 0 ? 'toward screen right' : 'straight ahead past the lens');
/** Câu hướng tiếng Anh cho prompt (dan_dung.huong): chỗ đứng trên màn, ánh mắt, phía đi vào. tenEn = tên đưa model cho mốc / đồ (tiếng Anh). */
export function cauHuong(s: SoDo, m: ManhSoDo, nguoi: string[], tenEn: (t: string) => string = (t) => t): string {
  const out: string[] = [];
  const thay = (n: string) => m.o[n] != null && (!m.khung || m.khung.includes(n));
  const dung = nguoi.filter((n) => thay(n) && !m.vao?.[n]).map((n) => { const x = viTriMan(s, m, n); return x == null ? '' : `${n} at ${BEN(x)}`; }).filter(Boolean);
  if (dung.length) out.push(`Placement on screen: ${dung.join(', ')}`);
  const ten = (b: string) => (nguoi.includes(b) ? b : tenEn(b) === b ? s.ten?.[b] ?? b : tenEn(b));
  for (const [a, b] of Object.entries(m.nhin ?? {})) out.push(raXa(s, m, a, b) ? `${a} faces away from the camera toward ${ten(b)}, back half turned to us` : `${a} looks ${PHIA(huongMan(s, m, a, b))} at ${ten(b)}, eyes on ${nguoi.includes(b) ? 'them' : 'it'}, not at the camera`);
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

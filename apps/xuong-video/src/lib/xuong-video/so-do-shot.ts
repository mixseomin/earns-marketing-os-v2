// SƠ ĐỒ SHOT (anh 26/10/2026: "có kiểu vẽ nào $0 mà lột tả đủ yêu cầu" → "gắn vào studio để dùng lại"). Vẽ SVG bằng code từ DỮ LIỆU shot — không gọi AI,
// nên không có người lạ, không đổi áo, không lệch trục. Mỗi khung: cỡ cảnh đúng tỉ lệ, ai đứng trái / phải màn, đầu quay đâu, nét mặt (mã BIEU_CAM —
// qc-cam-xuc.ts), mũi tên ánh nhìn tới người / vật được nhìn, đồ trên người (sổ đồ vật), dấu điểm neo mắt NEO_MAT, ô nét mặt cuối shot.
// Nguồn dữ liệu là chính các hàm mà prompt dùng (khong-gian.ts: nguoiKhung · viTri · thayMat · nhinCan · dichNhin · doCam) → hình và chữ không lệch nhau.
// sach = khung trơn làm ảnh bố cục cho model (bỏ chữ, dấu neo, mũi tên, ô cuối — model hay vẽ lại chúng thành vật thật). Thuần — tự kiểm: so-do-shot.test.mts
import { NEO_MAT } from './diem-nhin';
import { dichNhin, doCam, nguoiKhung, nhinCan, thayMat, viTri, type KhongGian } from './khong-gian';
import type { Canh, NhanVat } from './kieu';

export type VeNguoi = { ten: string; x: number; lung?: boolean; quay?: number; nhin_vao?: string | null; nhin_huong?: -1 | 0 | 1 | 'len' | 'xuong' | null;
  mat?: [string, string]; ao: string; toc?: 'dai' | 'ngan' | 'duoi_ngua'; do?: { mon: string; cam: boolean }[];
  /** cuối shot nối động tác sang shot sau: đầu đã bắt đầu quay về phía này (−1 trái màn, +1 phải màn) — vẽ mũi tên cong */ bat_dau_quay?: -1 | 1 };
export type VeShot = { so?: number | string; co: string; goc?: string; nguoi: VeNguoi[]; khai?: string[]; dien?: string; thoai?: string; /** khung nào của shot */ luc?: 'dau' | 'ket' };

const DA = '#e8c4a8', TOC = '#121010', DEN = '#141414';
// cỡ cảnh → bán kính đầu (phần bề ngang khung); null = toàn (thân đủ, chân ở 0,86 khung). Mã co_canh studio (dien-anh.ts).
const R: Record<string, number | null> = { cu: 0.17, ecu: 0.26, mcu: 0.11, ots: 0.1, ms: 0.09, two: 0.08, trung_toan: 0.055, ws: null, ews: null, toan_than: null, pov: 0.09 };
// nét mặt theo mã BIEU_CAM: [mày nghiêng (âm = đầu trong nhướn lên — lo, buồn), mày cao], mắt, miệng
const NET: Record<string, [number, number, 'to' | 'hip' | 'sup' | 'thuong', string]> = {
  binh_thuong: [0, 0, 'thuong', 'thang'], vui: [0, 0.05, 'thuong', 'cuoi'], cuoi_lon: [0, 0.08, 'hip', 'ha_cuoi'], hao_huc: [0, 0.1, 'to', 'cuoi'], am_ap: [0, 0.03, 'thuong', 'cuoi_nho'],
  nhe_nhom: [-0.1, 0, 'sup', 'cuoi_nho'], bat_ngo: [0, 0.2, 'to', 'ha_nho'], ngo_vuc: [0.25, 0.05, 'thuong', 'thang'], tu_tin: [0, 0, 'thuong', 'cuoi_nho'],
  lo_lang: [-0.35, 0.05, 'thuong', 'tre'], dau: [-0.4, -0.05, 'hip', 'mim'], met: [-0.15, -0.05, 'sup', 'thang'], buon: [-0.35, 0, 'sup', 'tre'], that_vong: [-0.3, -0.05, 'sup', 'tre'],
  lanh_lung: [0.15, -0.08, 'hip', 'mim'], khinh_bi: [0.05, 0.02, 'hip', 'nhech'], dac_y: [0.05, 0.03, 'thuong', 'nhech_cuoi'], nhuc_nha: [-0.4, 0, 'sup', 'tre'],
  nhan_nhin: [0, -0.03, 'thuong', 'mim'], gian: [0.45, -0.1, 'thuong', 'mim'], soc: [-0.1, 0.25, 'to', 'ha'], quyet_tam: [0.2, -0.05, 'thuong', 'mim'],
  nhech_moi: [0, 0.02, 'thuong', 'nhech'], dap_tra_lanh: [0.2, -0.06, 'hip', 'nhech'], khoc_tham: [-0.5, 0.05, 'hip', 'ha'], cuoi_dau: [-0.5, 0, 'hip', 'ha_cuoi'],
};
const MAU_AO = ['#f2f2f0', '#7a1325', '#16181d', '#2f5d8a', '#6b4f2a', '#4d6b3a'];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f = (n: number) => Math.round(n * 10) / 10;

/** Mặt: lông mày · mắt (con ngươi lệch theo hướng nhìn) · mũi · miệng theo mã nét; quay đầu dời cụm nét, nghiêng hẳn thì khuất mắt xa. */
function mat(cx: number, ey: number, r: number, ma: string, quay = 0, nhinX = 0, nhinY = 0): string {
  const [ng, cao, mt, mi] = NET[ma] ?? NET.binh_thuong!; const q = (Math.max(-80, Math.min(80, quay)) * Math.PI) / 180;
  const fx = Math.sin(q) * 0.5 * r, gian = 0.38 * r * Math.max(0.35, Math.cos(q)), gx = nhinX * 0.12 * r + Math.sin(q) * 0.06 * r, gy = nhinY * 0.09 * r, w = Math.max(1.5, r / 14);
  let o = '';
  for (const s of [-1, 1]) {
    if (Math.abs(quay) > 60 && s === (quay > 0 ? -1 : 1)) continue;
    const x = cx + fx + s * gian, rw = 0.2 * r, rh = ({ to: 0.15, hip: 0.06, sup: 0.09, thuong: 0.11 } as const)[mt] * r, pr = Math.min(rh, 0.08 * r);
    o += `<ellipse cx="${f(x)}" cy="${f(ey)}" rx="${f(rw)}" ry="${f(rh)}" fill="#fafafa" stroke="${DEN}" stroke-width="1"/><circle cx="${f(x + gx)}" cy="${f(ey + gy)}" r="${f(pr)}" fill="${DEN}"/>`;
    if (mt === 'sup') o += `<rect x="${f(x - rw)}" y="${f(ey - rh - 1)}" width="${f(2 * rw)}" height="${f(rh * 0.8)}" fill="${DA}"/><line x1="${f(x - rw)}" y1="${f(ey - 0.2 * rh)}" x2="${f(x + rw)}" y2="${f(ey - 0.2 * rh)}" stroke="${DEN}" stroke-width="${f(w)}"/>`;
    const by = ey - (0.3 + cao) * r;
    o += `<line x1="${f(x - s * rw)}" y1="${f(by + ng * 0.25 * r)}" x2="${f(x + s * rw)}" y2="${f(by - ng * 0.05 * r)}" stroke="${DEN}" stroke-width="${f(Math.max(2.5, r / 9))}" stroke-linecap="round"/>`;
  }
  const nx = cx + fx * 1.3; o += `<line x1="${f(nx)}" y1="${f(ey + 0.1 * r)}" x2="${f(nx + Math.sin(q) * 0.12 * r)}" y2="${f(ey + 0.38 * r)}" stroke="#96705a" stroke-width="${f(w)}"/>`;
  const mx = cx + fx * 1.15, my = ey + 0.62 * r, mw = 0.32 * r * Math.max(0.5, Math.cos(q)), b = quay < 0 ? -1 : 1;
  const duong = (d: string, day = w) => `<path d="${d}" fill="none" stroke="${DEN}" stroke-width="${f(day)}" stroke-linecap="round"/>`;
  if (mi === 'thang') o += duong(`M${f(mx - mw)} ${f(my)}H${f(mx + mw)}`);
  else if (mi === 'mim') o += duong(`M${f(mx - mw * 0.8)} ${f(my)}H${f(mx + mw * 0.8)}`, w + 1.5);
  else if (mi === 'cuoi' || mi === 'cuoi_nho') o += duong(`M${f(mx - mw)} ${f(my - 0.03 * r)}Q${f(mx)} ${f(my + (mi === 'cuoi' ? 0.22 : 0.12) * r)} ${f(mx + mw)} ${f(my - 0.03 * r)}`);
  else if (mi === 'tre') o += duong(`M${f(mx - mw)} ${f(my + 0.08 * r)}Q${f(mx)} ${f(my - 0.1 * r)} ${f(mx + mw)} ${f(my + 0.08 * r)}`);
  else if (mi === 'ha' || mi === 'ha_nho') { const k = mi === 'ha' ? 0.16 : 0.09; o += `<ellipse cx="${f(mx)}" cy="${f(my + 0.03 * r)}" rx="${f(k * r)}" ry="${f(k * r)}" fill="#5a1e1e"/>`; }
  else if (mi === 'ha_cuoi') o += `<path d="M${f(mx - mw)} ${f(my)}Q${f(mx)} ${f(my + 0.3 * r)} ${f(mx + mw)} ${f(my)}Z" fill="#5a1e1e"/>`;
  else o += duong(`M${f(mx - b * mw)} ${f(my + 0.02 * r)}L${f(mx + b * mw * 0.2)} ${f(my)}L${f(mx + b * mw)} ${f(my - (mi === 'nhech_cuoi' ? 0.14 : 0.1) * r)}`);
  if (ma === 'nhuc_nha' || ma === 'khoc_tham' || ma === 'cuoi_dau') for (const s of [-1, 1]) o += `<ellipse cx="${f(cx + fx + s * 0.55 * r)}" cy="${f(ey + 0.36 * r)}" rx="${f(0.14 * r)}" ry="${f(0.06 * r)}" fill="#e18c82" opacity="0.8"/>`;
  return o;
}

/** SVG một khung (W × H, mặc định 360 × 640 dọc). Khung trơn (sach) không chữ / dấu / mũi tên. */
export function svgSoDoShot(s: VeShot, o: { W?: number; H?: number; sach?: boolean } = {}): string {
  // rr null = shot toàn (thân đủ) — không dùng ?? vì null là giá trị thật
  const W = o.W ?? 360, H = o.H ?? 640, rr = s.co in R ? R[s.co]! : 0.09; const dau: Record<string, { x: number; y: number; r: number; lung?: boolean }> = {};
  let g = `<rect width="${W}" height="${H}" fill="#2a2a2e"/>`;
  if (rr == null || rr <= 0.06) g += `<rect y="${f(H * 0.62)}" width="${W}" height="${f(H * 0.38)}" fill="#1e1e21"/>`;
  const ds = [...s.nguoi].sort((a, b) => Number(!!a.lung) - Number(!!b.lung));   // người quay lưng (tiền cảnh) vẽ sau cùng
  for (const n of ds) {
    const r = (n.lung && s.co === 'ots' ? 0.17 : rr ?? 0.03) * W, cx = n.x * W, toan = rr == null;
    const ey = toan ? H * 0.86 - 14.4 * r : H * NEO_MAT.y, cy = ey + 0.15 * r;
    if (n.toc === 'dai') g += `<rect x="${f(cx - 1.15 * r)}" y="${f(cy - 0.3 * r)}" width="${f(2.3 * r)}" height="${f(2.3 * r)}" fill="${TOC}"/>`;
    g += toan ? `<path d="M${f(cx - 1.6 * r)} ${f(cy + 1.3 * r)}H${f(cx + 1.6 * r)}L${f(cx + 1.4 * r)} ${f(cy + 13.4 * r)}H${f(cx - 1.4 * r)}Z" fill="${n.ao}"/>`
      : `<path d="M${f(cx - 2.6 * r)} ${H}L${f(cx - 2.2 * r)} ${f(cy + 1.7 * r)}L${f(cx - 0.5 * r)} ${f(cy + 1.1 * r)}H${f(cx + 0.5 * r)}L${f(cx + 2.2 * r)} ${f(cy + 1.7 * r)}L${f(cx + 2.6 * r)} ${H}Z" fill="${n.ao}"/>`;
    g += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r)}" ry="${f(1.1 * r)}" fill="${n.lung ? TOC : DA}"/><path d="M${f(cx - 1.05 * r)} ${f(cy - 0.5 * r)}A${f(1.05 * r)} ${f(0.7 * r)} 0 0 1 ${f(cx + 1.05 * r)} ${f(cy - 0.5 * r)}Z" fill="${TOC}"/>`;
    if (n.toc === 'duoi_ngua') { const hb = (n.quay ?? 0) < 0 ? 1 : -1; g += `<circle cx="${f(cx + hb * 0.95 * r)}" cy="${f(cy - 0.55 * r)}" r="${f(0.35 * r)}" fill="${TOC}"/>`; }
    if (!n.lung) {
      const nx = typeof n.nhin_huong === 'number' ? n.nhin_huong : 0, ny = n.nhin_huong === 'xuong' ? 1 : n.nhin_huong === 'len' ? -1 : 0;
      g += mat(cx, ey, r, n.mat?.[0] ?? 'binh_thuong', n.quay ?? 0, nx, ny);
    }
    for (const [i, d] of (n.do ?? []).entries()) {   // đồ trên người: thẻ chữ nhỏ ở ngực (đeo) / cạnh tay (cầm) — món nào cũng vẽ được, không cần hình riêng
      const tx = d.cam ? cx + ((n.quay ?? 0) < 0 ? -1.9 : 1.9) * r : cx, ty = cy + (toan ? 3 : 2.6) * r + i * 0.7 * r, tw = Math.max(26, Math.min(110, d.mon.length * 6.5));
      g += `<rect x="${f(tx - tw / 2)}" y="${f(ty)}" width="${f(tw)}" height="16" rx="3" fill="#fff8e6" stroke="#b08a3a"/>${o.sach ? '' : `<text x="${f(tx)}" y="${f(ty + 12)}" font-size="10" text-anchor="middle" fill="#5a4410">${esc(d.mon)}</text>`}`;
    }
    if (n.bat_dau_quay && !o.sach) {   // mũi tên cong trên đầu: động tác quay đầu đã BẮT ĐẦU ở cuối shot này, shot sau quay tiếp (cắt giữa động tác)
      const b = n.bat_dau_quay, y0 = cy - 1.45 * r;
      g += `<path d="M${f(cx - b * 0.7 * r)} ${f(y0 + 0.2 * r)}Q${f(cx)} ${f(y0 - 0.35 * r)} ${f(cx + b * 0.9 * r)} ${f(y0 + 0.1 * r)}" fill="none" stroke="#ff6a3c" stroke-width="4" marker-end="url(#mq)"/>`
        + `<text x="${f(cx)}" y="${f(y0 - 0.45 * r)}" font-size="12" font-weight="700" text-anchor="middle" fill="#ff8a5c" stroke="#1e1e1e" stroke-width="3" paint-order="stroke">bắt đầu quay ${b > 0 ? '→' : '←'}</text>`;
    }
    dau[n.ten] = { x: cx, y: ey, r, lung: n.lung };
  }
  if (s.co === 'insert') for (const [i, m] of (s.khai ?? []).entries()) g += `<rect x="${f(W * 0.2)}" y="${f(H * (0.3 + i * 0.25))}" width="${f(W * 0.6)}" height="${f(H * 0.2)}" rx="8" fill="#f5f2ea" stroke="#b08a3a" stroke-width="3"/>${o.sach ? '' : `<text x="${f(W / 2)}" y="${f(H * (0.41 + i * 0.25))}" font-size="18" text-anchor="middle" fill="#5a4410">${esc(m)}</text>`}`;
  if (!o.sach) {
    for (const n of s.nguoi) {   // mũi tên ánh nhìn: vào đầu người được nhìn nếu trong khung, không thì ra mép + tên
      const a = dau[n.ten]; if (!a || a.lung || !n.nhin_vao) continue; const t = dau[n.nhin_vao];
      const hx = typeof n.nhin_huong === 'number' ? n.nhin_huong : 0;
      const [x1, y1] = t ? [t.x, t.y] : n.nhin_huong === 'len' ? [a.x, 10] : n.nhin_huong === 'xuong' ? [a.x, H * 0.97] : hx === 0 ? [a.x, a.y] : [hx < 0 ? 8 : W - 8, a.y];
      if (x1 === a.x && y1 === a.y) continue;
      g += `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(x1)}" y2="${f(y1)}" stroke="#ffd228" stroke-width="3" stroke-dasharray="8 6" marker-end="url(#mt)"/>`;
      if (!t) g += `<text x="${f(hx < 0 ? 8 : hx > 0 ? W - 8 : x1)}" y="${f(n.nhin_huong === 'len' ? 26 : y1 - 10)}" font-size="12" font-weight="700" text-anchor="${hx < 0 ? 'start' : hx > 0 ? 'end' : 'middle'}" fill="#ffdc50" stroke="#1e1e1e" stroke-width="3" paint-order="stroke">${esc(`${n.nhin_vao} (ngoài khung)`)}</text>`;
    }
    if (rr != null && s.co !== 'insert') g += `<path d="M${f(W * NEO_MAT.x - 14)} ${f(H * NEO_MAT.y)}h28M${f(W * NEO_MAT.x)} ${f(H * NEO_MAT.y - 14)}v28" stroke="#3cc8ff" stroke-width="2"/>`;
    const doi = s.nguoi.filter((n) => !n.lung && n.mat && n.mat[1] !== n.mat[0]);
    for (const [i, n] of doi.entries()) {   // ô nét mặt CUỐI shot
      const ox = W - 46 - i * 86, oy = 62, r = 28;
      g += `<rect x="${ox - 42}" y="${oy - 46}" width="84" height="98" rx="8" fill="#f5f5f0" stroke="#ffd228" stroke-width="2"/><ellipse cx="${ox}" cy="${oy}" rx="${r}" ry="${f(1.1 * r)}" fill="${DA}"/><path d="M${f(ox - 1.05 * r)} ${f(oy - 0.5 * r)}A${f(1.05 * r)} ${f(0.7 * r)} 0 0 1 ${f(ox + 1.05 * r)} ${f(oy - 0.5 * r)}Z" fill="${TOC}"/>`
        + mat(ox, oy - 0.15 * r, r, n.mat![1], n.quay ?? 0) + `<text x="${ox}" y="${oy + 46}" font-size="10" text-anchor="middle" fill="#785a00">${esc(`cuối · ${n.ten}`)}</text>`;
    }
    if (s.luc) g += `<text x="8" y="18" font-size="12" font-weight="700" fill="#9fe0ff" stroke="#1e1e1e" stroke-width="3" paint-order="stroke">${s.luc === 'ket' ? 'CUỐI shot' : 'ĐẦU shot'}</text>`;
    if (s.goc === 'thap' || s.goc === 'cao') g += `<text x="${W - 8}" y="18" font-size="12" font-weight="700" text-anchor="end" fill="#ffdc50">${s.goc === 'thap' ? 'MÁY THẤP ↑' : 'MÁY CAO ↓'}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><marker id="mt" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#ffd228"/></marker><marker id="mq" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#ff6a3c"/></marker></defs>${g}</svg>`;
}

/** Sơ đồ của một shot studio từ sổ không gian của cảnh (sơ đồ 2D + sổ đồ vật) + kế hoạch biểu cảm. null = shot không có sơ đồ cảnh.
 *  luc = khung ĐẦU / CUỐI. Khung cuối của shot nối động tác (dan_dung.noi = 'dong_tac' — cùng điều kiện sinh-video.ts › catDongTac) mà shot SAU người đó
 *  quay đầu: đầu đã quay một phần (~1/3) về hướng mới + mũi tên "bắt đầu quay" — cắt giữa động tác, xem được trên sơ đồ trước khi sinh ảnh / video. */
export function veShotTuCanh(c: Canh, kg: KhongGian | null | undefined, nhanVat: Pick<NhanVat, 'id' | 'ten' | 'loai'>[] = [], o: { luc?: 'dau' | 'ket'; sau?: Canh | null } = {}): VeShot | null {
  const luc = o.luc ?? 'dau';
  if (!kg) return null; const ai = nguoiKhung(kg, c, luc); if (!ai) return null;
  const bc = (c.bieu_cam ?? []) as { nv: string; dau: string; cuoi: string }[];
  const noiSau = luc === 'ket' && c.dan_dung?.noi === 'dong_tac' && !!o.sau && o.sau.phan_doan === c.phan_doan;
  const nguoi: VeNguoi[] = ai.map((ten) => {
    const v = viTri(kg, c, ten, luc); const lung = thayMat(kg, c, ten, luc) === false; const h = nhinCan(kg, c, ten, luc); const b = bc.find((x) => x.nv === ten);
    const dich = dichNhin(c, ten, luc);   // nhìn MỐC của cảnh (cửa, lối vào…) → tên đọc được của mốc thay mã
    // hướng người đó nhìn khi shot sau MỞ (hoặc khi shot sau kết nếu shot sau mới quay) — khác hướng hiện tại = động tác quay đầu nối qua cú cắt
    let quay = h == null ? 0 : h * 40, bat: -1 | 1 | undefined;
    // người QUAY LƯNG cũng bắt đầu xoay đầu được (khán giả thấy má lộ dần — #353 #1 → #2: Hạ quay lưng nhìn thang, shot sau quay sang phải): coi hướng hiện tại là 0
    if (noiSau) {
      const h0 = h ?? 0; const sd = nhinCan(kg, o.sau!, ten, 'dau'), sk = nhinCan(kg, o.sau!, ten, 'ket'); const toi = sd != null && sd !== h0 ? sd : sk != null && sk !== h0 ? sk : null;
      if (toi != null && toi !== 0) { bat = toi > h0 ? 1 : -1; quay = h0 * 40 + (toi - h0) * 40 * 0.35; } else if (toi === 0 && h0 !== 0) { bat = h0 > 0 ? -1 : 1; quay = h0 * 40 * 0.65; }
    }
    return { ten, x: v == null ? 0.5 : Math.max(0.08, Math.min(0.92, (v + 1) / 2)), lung, quay, nhin_vao: dich && !kg.nguoi.includes(dich) ? kg.so_do.ten?.[dich] ?? dich : dich, nhin_huong: h,
      mat: b ? (luc === 'ket' ? [b.cuoi, b.cuoi] : [b.dau, b.cuoi]) : undefined, ao: MAU_AO[Math.max(0, kg.nguoi.indexOf(ten)) % MAU_AO.length]!,
      do: doCam(kg, c.thu_tu, ten, luc).map((d) => ({ mon: d.mon, cam: !!d.tay })), bat_dau_quay: bat };
  });
  const khai = (c.nhan_vat ?? []).map((id) => nhanVat.find((x) => x.id === id)).filter((x) => x && (x.loai === 'dao_cu' || x.loai === 'san_pham')).map((x) => x!.ten);   // đạo cụ gắn vào shot
  return { so: c.thu_tu, co: String(c.ky_thuat?.co_canh ?? 'ms'), nguoi, khai, luc };
}

/** Câu prompt cho KHUNG CUỐI của shot nối động tác (cùng dữ liệu với mũi tên cam trên sơ đồ): đầu vừa bắt đầu quay, shot sau quay tiếp. Rỗng = không có. */
export function cauBatDauQuay(v: VeShot | null): string {
  const ds = (v?.nguoi ?? []).filter((n) => n.bat_dau_quay);
  return ds.map((n) => `At this last moment ${n.ten}'s head has JUST begun turning toward screen ${n.bat_dau_quay! > 0 ? 'right' : 'left'} (about a third of the way) — the turn is caught in motion and continues in the next shot.`).join(' ');
}

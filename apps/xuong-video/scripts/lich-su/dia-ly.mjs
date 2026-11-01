// DỮ LIỆU BẢN ĐỒ DÙNG CHUNG cho máy kênh lịch sử (02/11/2026): dung-tap.mjs (dựng) + lam-tap.mjs (kiểm tập máy viết trước khi tốn tiền giọng / ảnh).
// Natural Earth ở /Users/htuan/.cache/lich-su/ (iMac): ne_50m.geojson (nước, ADM0_A3) + ne_50m_places.geojson (thành phố).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const KHO = `${process.env.HOME}/.cache/lich-su`;
export const geo = JSON.parse(readFileSync(join(KHO, 'ne_50m.geojson'), 'utf8'));
// mảnh của một nước: khai vung thì lấy mảnh chạm khung đó; không khai thì lấy CỤM CHÍNH (mảnh lớn nhất + mảnh trong 12° quanh nó) — Pháp không kéo
// theo Guyane, Mỹ không kéo theo Hawaii. Đảo vắt qua kinh tuyến 180 bị bỏ.
export const dienTich = (r) => { let A = 0; for (let i = 0; i < r.length - 1; i++) A += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(A / 2); };
// TẬP VẮT QUA KINH TUYẾN 180 (Alaska ↔ Nga, Thái Bình Dương): datThaiBinh(true) → mọi mảnh / điểm / khung có tâm ở kinh độ < -30 cộng 360 (châu Mỹ dời
// sang 180..330), cả tập nằm trên một lưới liền; dung-tap.mjs tự bật khi các đích của tập nằm cả hai phía kinh tuyến 180.
export let THAI_BINH = false;
export const datThaiBinh = (b) => { THAI_BINH = b; };
export const kinh = (o) => (THAI_BINH && o[0] < -30 ? [o[0] + 360, o[1]] : o);
export const vong = (r) => { if (!THAI_BINH) return r; const cx = r.reduce((a, q) => a + q[0], 0) / r.length; return cx < -30 ? r.map(([a, b]) => [a + 360, b]) : r; };
const khungDoi = (v) => (v && THAI_BINH && (v[0] + v[2]) / 2 < -30 ? [v[0] + 360, v[1], v[2] + 360, v[3]] : v);
export const manh = ({ iso, vung: v0 }) => { const ds = [], vung = khungDoi(v0);
  for (const f of geo.features) { if (f.properties.ADM0_A3 !== iso) continue; const ps = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of ps) { const r = vong(p[0]), xs = r.map((q) => q[0]), ys = r.map((q) => q[1]), h = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      if (h[2] - h[0] > 300) continue; if (vung && (h[2] < vung[0] || h[0] > vung[2] || h[3] < vung[1] || h[1] > vung[3])) continue; ds.push({ r, h, A: dienTich(r) }); } }
  if (!ds.length) throw new Error(`không tìm thấy vùng ${iso} ${vung ?? ''}`); if (vung) return ds;
  const lon = ds.reduce((m, d) => (d.A > m.A ? d : m)); const t = [(lon.h[0] + lon.h[2]) / 2, (lon.h[1] + lon.h[3]) / 2];
  return ds.filter((d) => d === lon || (Math.abs((d.h[0] + d.h[2]) / 2 - t[0]) < (lon.h[2] - lon.h[0]) / 2 + 12 && Math.abs((d.h[1] + d.h[3]) / 2 - t[1]) < (lon.h[3] - lon.h[1]) / 2 + 12)); };
export const tamVung = (v) => { let A = 0, X = 0, Y = 0;
  for (const { r } of manh(v)) for (let i = 0; i < r.length - 1; i++) { const c = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; A += c; X += (r[i][0] + r[i + 1][0]) * c; Y += (r[i][1] + r[i + 1][1]) * c; }
  return [Math.round((X / (3 * A)) * 1000) / 1000, Math.round((Y / (3 * A)) * 1000) / 1000]; };
export const hopVung = (v) => manh(v).reduce((h, d) => [Math.min(h[0], d.h[0]), Math.min(h[1], d.h[1]), Math.max(h[2], d.h[2]), Math.max(h[3], d.h[3])], [999, 999, -999, -999]);
export const boDau = (t) => String(t).normalize('NFD').replace(/\p{M}/gu, '');
export const chuan = (w) => boDau(w).toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, '');
// thành phố: Natural Earth 10m (7.300 nơi, có Ceuta / Melilla / Nuuk…) — trùng tên thì lấy nơi đông dân hơn. TP = mọi nơi (đích khai "@Tên");
// TP_NHAC = nơi ≥ 150 N dân hoặc thủ đô (máy tự chấm khi lời đọc nhắc tên — tránh nhận nhầm chữ thường như "Florida", "Victoria")
export const TP = new Map(), TP_NHAC = new Map();
for (const f of JSON.parse(readFileSync(join(KHO, 'ne_10m_places.geojson'), 'utf8')).features) { const p = f.properties, v = { ten: p.name, o: f.geometry.coordinates, pop: p.pop_max };
  for (const t of [p.name, p.nameascii, ...(p.namealt || '').split('|')]) { if (!t || t.length <= 3) continue; const k = chuan(t);
    if (!TP.has(k) || p.pop_max > TP.get(k).pop) TP.set(k, v); if ((p.pop_max >= 150000 || p.adm0cap) && (!TP_NHAC.has(k) || p.pop_max > TP_NHAC.get(k).pop)) TP_NHAC.set(k, v); } }
// ĐÍCH VIẾT BẰNG CHỮ (máy viết tập khai): "RUS" nước · "RUS@19,54,23,56" mảnh nước trong khung lon/lat · "@Ceuta" thành phố Natural Earth · "20.5,54.7" toạ độ
export const dichCua = (v) => { if (Array.isArray(v)) return { o: v, h: [v[0], v[1], v[0], v[1]] };
  if (typeof v !== 'string') return { o: tamVung(v), h: hopVung(v) };
  if (v.startsWith('@')) { const c = TP.get(chuan(v.slice(1))); if (!c) throw new Error(`không có thành phố "${v.slice(1)}" trong Natural Earth`); const o = kinh(c.o); return { o, h: [o[0], o[1], o[0], o[1]] }; }
  if (/^-?\d/.test(v)) { const o = kinh(v.split(',').map(Number)); return { o, h: [o[0], o[1], o[0], o[1]] }; }
  const [iso, vg] = v.split('@'); const q = { iso, vung: vg ? vg.split(',').map(Number) : undefined }; return { o: tamVung(q), h: hopVung(q) }; };
export const diem = (v) => dichCua(v).o;
export const isoVung = (v) => { const [iso, vg] = v.split('@'); return { iso, ...(vg ? { vung: vg.split(',').map(Number) } : {}) }; };

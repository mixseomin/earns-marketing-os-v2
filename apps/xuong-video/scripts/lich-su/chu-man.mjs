// CHỮ TRÊN MỘT KHUNG (anh 05/11/2026: "ko hiện nhiều chữ vậy trên 1 khung, ai mà đọc được"): mỗi khung chỉ một ý ngắn đọc kịp.
// MỘT cơ chế cho mọi máy viết + máy gác:
//   tachCanh(tap)  → câu dài tách thành nhiều cảnh liên tiếp (cùng cảnh nhìn), ngắt ở ranh giới câu → dấu phẩy / chấm phẩy / hai chấm → từ;
//                    câu trích “…” tách thành nhiều mảnh trích, mảnh nào cũng là chữ NGUYÊN VĂN site (luật nguồn vẫn kiểm được); dòng thẻ dài chuyển xuống câu chữ;
//                    thời lượng mỗi cảnh theo lượng chữ (giây đọc) — có giọng thì long-tieng.mjs căn lại theo tiếng
//   kiemChuMan(tap) → lỗi: khung nào quá TRẦN chữ (máy gác kiemTap chặn trước khi ghi)
import { loiHook, sachHook } from '../../src/lib/xuong-video/hook-qc.mjs';
/** câu HOOK trên màn (0–2 giây đầu): câu đầu NGẮN NHẤT của QC gốc mà vẫn qua luật hook (giữ ≥ 35% chữ gốc, không thêm số) — QC dài 2–3 câu không lên hết khung đầu */
export function hookNgan(goc) {
  const sach = sachHook(goc).replace(/\s*\p{Extended_Pictographic}+\s*$/u, ''), cau = sach.split(/(?<=[.!?])\s+/);
  for (let n = 1; n <= cau.length; n++) { const t = cau.slice(0, n).join(' '); if (!loiHook([t], goc).length) return t; }
  return sach;
}
/** hook ưu tiên: bản ngắn (hookNgan) nằm gọn MỘT khung Short; không còn cái nào gọn thì giữ cả danh sách */
export const hookGon = (ds) => { const g = ds.filter((h) => hookNgan(h.chu).length <= 60); return g.length ? g : ds; };
export const TRAN = { doc: 64, ngang: 90, the: 44, nhan: 50, lon: 22 };
const bo = (s) => String(s ?? '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const giay = (s) => Math.max(2.4, Math.round((1.0 + bo(s).length / 14) * 10) / 10), tron = (x) => Math.round(x * 100) / 100;   // ~14 ký tự / giây + 1 giây nhìn hình

/** tách một đoạn (không ngoặc trích) thành các mảnh ≤ toiDa: chọn điểm ngắt GẦN GIỮA nhất, ưu tiên cuối câu → ; : → dấu phẩy → trước từ nối → khoảng trắng;
 *  hai bên tối thiểu 15 ký tự (không để "Sometimes," hay "the same." đứng một mình một khung) */
function chiaTran(t, toiDa) {
  if (t.length <= toiDa) return [t];
  const diem = [];
  for (const m of t.matchAll(/\s+/g)) { const i = m.index, truoc = t.slice(0, i), sau = t.slice(i + m[0].length);
    const w = /[.!?]$/.test(truoc) ? 0 : /[;:]$/.test(truoc) ? 1 : /[,—]$/.test(truoc) ? 2 : /^(and|but|or|which|that|who|where|when|while|because|so|with)\b/i.test(sau) ? 3 : 4;
    if (truoc.length >= 15 && sau.length >= 15) diem.push({ i, j: i + m[0].length, d: w * 12 + Math.abs(i - t.length / 2) / t.length * 30 }); }
  if (!diem.length) return [t];
  const c = diem.sort((x, y) => x.d - y.d)[0];
  return [...chiaTran(t.slice(0, c.i), toiDa), ...chiaTran(t.slice(c.j), toiDa)];
}
/** tách cả câu có lẫn phần trích “…”: mỗi mảnh giữ ngoặc trích của mình (mảnh nối tiếp mở bằng … ngoài ngoặc) */
export function chiaCau(chu, toiDa) {
  const t = bo(chu); if (t.length <= toiDa) return [t];
  const khuc = [...t.matchAll(/“([^”]+)”|([^“]+)/g)].map((m) => (m[1] != null ? { trich: true, s: m[1], duoi: '' } : { trich: false, s: m[2].trim() })).filter((k) => k.s);
  // dấu câu đứng ngay sau ngoặc trích (“Where it clicks”: …) dính về mảnh trích trước, không thành một mảnh riêng
  for (let i = 1; i < khuc.length; i++) { const k = khuc[i], p = khuc[i - 1]; const m = !k.trich && p.trich && /^[:;,.!?]+/.exec(k.s); if (m) { p.duoi = m[0]; k.s = k.s.slice(m[0].length).trim(); } }
  const manh = khuc.filter((k) => k.s).flatMap((k) => chiaTran(k.s, toiDa - (k.trich ? 3 : 0)).map((s, i, a) => (k.trich ? `${i ? '…' : ''}“${s}”${i === a.length - 1 ? k.duoi : ''}` : s)));
  const ra = []; let cur = '';   // gộp lại các mảnh ngắn liền nhau cho khỏi vụn
  // hai mảnh trích liền nhau của CÙNG một câu trích gộp vào một ngoặc ("…“and agriculture,” …“who was…”" → "…“and agriculture, who was…”")
  const noi = (a, b) => (/”[,.;:!?]?$/.test(a) && /^…“/.test(b) ? `${a.replace(/”([,.;:!?]?)$/, '$1')} ${b.slice(2)}` : `${a} ${b}`);
  for (const m of manh) { if (cur && noi(cur, m).length > toiDa) { ra.push(cur); cur = m; } else cur = cur ? noi(cur, m) : m; }
  return cur ? [...ra, cur] : ra;
}

/** áp lên một tập (CAU): câu dài → q.manh = các mảnh hiện NỐI NHAU trong cùng cảnh (cảnh + máy quay giữ nguyên, trang dựng đổi chữ theo thời gian);
 *  q.chu giữ nguyên câu đủ (giọng đọc một lượt, luật nguồn kiểm cả câu). Dòng thẻ dài chuyển xuống chữ; nhãn dài cắt ở ranh giới từ. Thời lượng theo lượng chữ. */
export function tachCanh(tap) {
  if (!tap.cau?.length) return tap;
  const toiDa = tap.khung === 'ngang' ? TRAN.ngang : TRAN.doc; let t = 0;
  const cau = tap.cau.map((q) => {
    const dongThe = (q.the?.dong ?? []).join(' '), dai = (q.the?.dong ?? []).some((d) => bo(d).length > TRAN.the);   // đo TỪNG dòng thẻ: thẻ nhiều dòng ngắn (bảng 12 cung Mọc) giữ trên thẻ
    const chu = dai ? `${bo(q.chu)} ${dongThe}`.trim() : bo(q.chu), manh = chiaCau(chu, toiDa);
    const o = { ...q, chu, ...(q.the ? { the: { ...q.the, dong: dai ? [] : q.the.dong } } : {}) };
    if (manh.length > 1) o.manh = manh; else delete o.manh;
    if (q.nhan && q.nhan.length > TRAN.nhan) o.nhan = q.nhan.slice(0, q.nhan.lastIndexOf(' ', TRAN.nhan)).replace(/[\s·,]+$/, '');
    // không rút cảnh: trang chạy hoạt cảnh dài (bầu trời đêm, quỹ đạo) giữ thời lượng gốc
    const d = Math.max(q.den - q.tu || 0, manh.reduce((s, m) => s + giay(m), 0)); o.tu = tron(t); o.den = tron(t + d); t = tron(t + d); return o;
  });
  // không câu nào phải đổi → giữ nguyên mốc gốc (trang có đoạn chỉ có hình, không chữ — Tonight's Sky 90 s chỉ 3 câu)
  if (cau.every((o, i) => !o.manh && JSON.stringify(o.the) === JSON.stringify(tap.cau[i].the) && o.nhan === tap.cau[i].nhan)) return tap;
  return { ...tap, cau, DAI: Math.max(tap.DAI ?? 0, cau.at(-1).den) };
}
/** mảnh đang hiện ở giây t của một câu (chia theo lượng chữ) — trang dựng gọi bản sao của hàm này */
export function manhTai(q, t) {
  const ds = q.manh ?? [q.chu], n = ds.map((m) => bo(m).length), tong = n.reduce((a, b) => a + b, 0); let u = q.tu;
  for (let i = 0; i < ds.length; i++) { const d = ((q.den - q.tu) * n[i]) / tong; if (t < u + d || i === ds.length - 1) return { i, tu: u, den: u + d, chu: ds[i] }; u += d; }
}

export function kiemChuMan(tap) {
  const toiDa = tap.khung === 'ngang' ? TRAN.ngang : TRAN.doc, loi = [];
  (tap.cau ?? []).forEach((q, i) => {
    for (const c of (q.manh ?? [q.chu]).map(bo)) if (c.length > toiDa) loi.push(`câu ${i + 1}: ${c.length} ký tự trên một khung (trần ${toiDa}) — tách cảnh (chu-man.mjs › tachCanh)`);
    for (const d of q.the?.dong ?? []) if (bo(d).length > TRAN.the) loi.push(`câu ${i + 1}: dòng thẻ ${bo(d).length} ký tự (trần ${TRAN.the})`);
    if (q.the?.lon && bo(q.the.lon).length > TRAN.lon) loi.push(`câu ${i + 1}: chữ to trên thẻ ${bo(q.the.lon).length} ký tự (trần ${TRAN.lon})`);
    if (q.nhan && bo(q.nhan).length > TRAN.nhan) loi.push(`câu ${i + 1}: nhãn ${bo(q.nhan).length} ký tự (trần ${TRAN.nhan})`);
  });
  return loi;
}

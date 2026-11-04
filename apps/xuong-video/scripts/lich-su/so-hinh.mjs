// SỐ THÀNH HÌNH (mẫu Full Story 2.0, anh 05/11/2026: "ngoài chữ, các con số có thể nổi bật thêm… minh hoạ bằng hình cho sinh động"). Thuần, không I/O.
// Lấy con số từ su_that CỦA CHÍNH CÂU (đã có trích nguyên văn nguồn — không bao giờ có số bịa), đoán loại theo chữ đơn vị, gắn mốc giây = lúc giọng đọc tới số đó.
// dung-tap.mjs gọi khi hồ sơ tập bật `hinh_so` (kenh.json › mau_khuon[…].hinh_so) → ban-do.html vẽ: thẻ số đếm chạy + hình theo loại (tiền / người / thời gian / khoảng cách),
// hai số cùng loại người trong một câu → hai cột so sánh. Tự kiểm: node so-hinh.mjs
const NHAN = { million: 1e6, millions: 1e6, billion: 1e9, billions: 1e9, thousand: 1e3, thousands: 1e3, hundred: 100, k: 1e3, m: 1e6, bn: 1e9 };
const LOAI = [
  ['tien', /\$|£|€|dollar|pound|guilder|florin|franc|ducat|peso|livre|crown|shilling|rouble|ruble|mark|gold|silver|cost|price|paid/i],
  ['nguoi', /\b(men|man|soldiers?|troops|people|archers?|knights?|sailors?|settlers?|dead|killed|deaths?|casualt|prisoners?|warriors?|army|janissar|colonists?|inhabitants|residents|slaves?|crew|men-at-arms|horsemen|cavalry|(long)?bowmen|footmen|infantry|survivors?|marines?|militia|mercenar(y|ies)|refugees?|citizens|population)\b/i],
  ['thoi_gian', /\b(minutes?|hours?|days?|weeks?|months?|years?|decades?|centur(y|ies))\b/i],
  ['khoang_cach', /\b(km|kilomet(er|re)s?|miles?|leagues?)\b/i],
  ['dien_tich', /\b(square|acres?|hectares?|km2|km²)\b/i],
  ['phan_tram', /%|\bper ?cent\b/i],
];
/** đọc số từ chữ giá trị: "7.2 million dollars" → 7200000, "$7,200,000" → 7200000, "38 minutes" → 38; không có số → null */
export function docSo(s) {
  const m = String(s).replace(/(\d),(?=\d{3}\b)/g, '$1').match(/(\d+(?:\.\d+)?)\s*(million|millions|billion|billions|thousand|thousands|hundred|bn|k|m)?\b/i);
  if (!m) return null; const v = Number(m[1]) * (m[2] ? NHAN[m[2].toLowerCase()] ?? 1 : 1);
  return Number.isFinite(v) ? v : null;
}
export function loaiSo(s) { for (const [l, re] of LOAI) if (re.test(s)) return l; return 'so'; }
/** năm trơn (gia_tri chỉ là 3–4 chữ số 800–2100, không đơn vị) — ô năm đã hiện, không làm thẻ */
const laNam = (g) => /^\s*(c\.\s*)?\d{3,4}\s*(AD|BC|CE)?\s*$/i.test(g) && (() => { const n = Number(g.match(/\d{3,4}/)[0]); return n >= 800 && n <= 2100; })();
/** chữ hiện trên thẻ: tiền "$7.2M", người "6,000", thời gian "38 MIN"… */
export function chuSo(v, loai, goc) {
  const gon = (n) => (n >= 1e9 ? `${+(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n.toLocaleString('en-US'));
  if (loai === 'tien') { const ky = /£/.test(goc) ? '£' : /€/.test(goc) ? '€' : /\$|dollar/i.test(goc) ? '$' : ''; return ky ? `${ky}${gon(v)}` : `${gon(v)} ${(goc.match(/(guilders?|florins?|francs?|ducats?|pesos?|livres?|crowns?|shillings?|roubles?|rubles?|marks?)/i)?.[1] ?? '').toUpperCase()}`.trim(); }
  if (loai === 'thoi_gian') { const d = goc.match(/(minute|hour|day|week|month|year|centur)/i)?.[1]?.toUpperCase() ?? ''; return `${gon(v)} ${({ MINUTE: 'MIN', HOUR: 'HRS', DAY: 'DAYS', WEEK: 'WEEKS', MONTH: 'MONTHS', YEAR: 'YEARS', CENTUR: 'CENTURIES' })[d] ?? ''}`.trim(); }
  if (loai === 'phan_tram') return `${+v.toFixed(1)}%`;
  if (loai === 'khoang_cach') return `${gon(v)} ${/mile/i.test(goc) ? 'MILES' : /league/i.test(goc) ? 'LEAGUES' : 'KM'}`;
  return gon(v);
}
/** nhãn ngắn sau số trong chữ giá trị ("6,000 English archers" → "English archers") cho cột so sánh */
const nhanSau = (g) => (String(g).replace(/(\d),(?=\d{3})/g, '$1').match(/\d+(?:\.\d+)?\s*(?:million|thousand|hundred)?\s+([A-Za-z][A-Za-z' -]{2,28})/i)?.[1] ?? '').trim();
const SO_CHU = new Set('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion'.split(' '));
const chuan = (w) => String(w).toLowerCase().replace(/[^a-z0-9.$£€-]/g, '');
const GIA = Object.fromEntries([...'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ').map((w, i) => [w, i]),
  ...'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ').map((w, i) => [w, 20 + 10 * i])]);
/** CỤM SỐ giọng đọc trong câu: [{ i, j, v }] — chữ số ("6,000"), chữ đếm ("seven point two million", "fifteen hundred"), kiểu năm ("fourteen fifteen" → 1415) */
export function cumSo(words) {
  const ra = []; let i = 0;
  const la = (w) => /\d/.test(w) || SO_CHU.has(chuan(w).replace(/-/g, '')) || chuan(w).split('-').every((x) => x in GIA);
  while (i < words.length) {
    if (!la(words[i].chu)) { i++; continue; }
    let j = i; const ws = []; while (j < words.length && (la(words[j].chu) || (/^(and|point)$/i.test(chuan(words[j].chu)) && j + 1 < words.length && la(words[j + 1].chu)))) ws.push(chuan(words[j++].chu));
    let v = null; const so = ws.join(' ').replace(/,/g, '');
    if (/^\$?\d+(\.\d+)?$/.test(so.split(' ')[0]) ) v = docSo(ws.join(' '));
    else { const t = ws.flatMap((x) => x.split('-')).filter((x) => x !== 'and');
      if (t.length >= 2 && !t.some((x) => /^(hundred|thousand|million|billion|point)$/.test(x)) && GIA[t[0]] >= 10 && !(GIA[t[0]] >= 20 && t.length === 2 && GIA[t[1]] < 10)) v = GIA[t[0]] * 100 + t.slice(1).reduce((s, x) => s + (GIA[x] ?? 0), 0);   // kiểu năm
      else { let tong = 0, nay = 0, thap = null; for (const x of t) { if (x === 'point') { thap = ''; continue; } if (thap != null && x in GIA) { thap += String(GIA[x]); continue; }
        if (x === 'hundred') nay = (nay || 1) * 100; else if (/^(thousand|million|billion)$/.test(x)) { tong += (nay + (thap ? Number(`0.${thap}`) : 0) || 1) * { thousand: 1e3, million: 1e6, billion: 1e9 }[x]; nay = 0; thap = null; } else nay += GIA[x] ?? 0; }
        v = tong + nay + (thap ? Number(`0.${thap}`) : 0); } }
    ra.push({ i, j, v }); i = j;
  }
  return ra;
}
/** các số thành hình của MỘT câu: [{ gia_tri, loai, chu, nhan, t }] — t = giây (tuyệt đối) lúc giọng đọc tới số; words = [{ chu, a, b }] của câu */
export function soHinhCau(cau, words) {
  const ra = [], dung = new Set();
  // NGÀY THÁNG ("25 October 1415", "August 1422") không làm thẻ; một giá trị có NHIỀU số ("1,500 men-at-arms and 7,000 longbowmen") tách từng số
  const THANG = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
  const tach = (g) => String(g).replace(/(\d),(?=\d{3})/g, '$1').split(/\s+(?:and|plus|vs\.?|versus|against)\s+|,\s+|;\s*/i).filter((x) => /\d/.test(x));
  for (const s of cau.su_that ?? []) for (const g of tach(s.gia_tri ?? '')) {
    if (laNam(g) || THANG.test(g)) continue;
    const v = docSo(g); if (v == null || v < 2) continue;
    // mốc: CỤM SỐ giọng đọc có giá trị khớp số này (±2%) — năm "fourteen fifteen" đứng trước "twelve thousand" không bị bắt nhầm
    const cum = cumSo(words).find((c) => !dung.has(c.i) && c.v != null && Math.abs(c.v - v) <= Math.max(1, v * 0.02));
    if (!cum) continue;   // câu không đọc con số này → không bật thẻ (thẻ phải trùng lúc người xem nghe số)
    dung.add(cum.i); const i = cum.i;
    // loại: theo đơn vị trong giá trị → chữ ngay sau số trong câu ("nine thousand survivors") → đoạn trích nguồn
    const sau = words.slice(cum.j, cum.j + 3).map((w) => w.chu).join(' ');
    const lo = [loaiSo(g), loaiSo(sau), loaiSo(`${s.trich ?? ''}`.slice(0, 160))].find((x) => x !== 'so') ?? 'so';
    ra.push({ gia_tri: v, loai: lo, chu: chuSo(v, lo, `${g} ${sau}`), nhan: nhanSau(g) || sau.replace(/[^A-Za-z' -]/g, '').trim(), t: words[i].a });
  }
  return ra;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const assert = (await import('node:assert')).default;
  assert.strictEqual(docSo('7.2 million dollars'), 7.2e6); assert.strictEqual(docSo('$7,200,000'), 7.2e6); assert.strictEqual(docSo('38 minutes'), 38); assert.strictEqual(docSo('Henry V'), null);
  assert.strictEqual(loaiSo('7.2 million dollars'), 'tien'); assert.strictEqual(loaiSo('6,000 English archers'), 'nguoi'); assert.strictEqual(loaiSo('38 minutes'), 'thoi_gian'); assert.strictEqual(loaiSo('20 km'), 'khoang_cach');
  assert.strictEqual(chuSo(7.2e6, 'tien', '7.2 million dollars'), '$7.2M'); assert.strictEqual(chuSo(38, 'thoi_gian', '38 minutes'), '38 MIN'); assert.strictEqual(chuSo(60, 'tien', '60 guilders'), '60 GUILDERS');
  const w = 'Russia sold Alaska for seven point two million dollars in 1867'.split(' ').map((chu, k) => ({ chu, a: k, b: k + 1 }));
  const r = soHinhCau({ su_that: [{ gia_tri: '7.2 million dollars' }, { gia_tri: '1867' }] }, w);
  assert.deepStrictEqual(r.map((x) => [x.chu, x.loai, x.t]), [['$7.2M', 'tien', 4]]);   // năm 1867 không làm thẻ; mốc = chữ "seven"
  const w2 = 'About 6,000 English archers faced 20,000 French knights'.split(' ').map((chu, k) => ({ chu, a: k, b: k + 1 }));
  const r2 = soHinhCau({ su_that: [{ gia_tri: '6,000 English archers' }, { gia_tri: '20,000 French knights' }] }, w2);
  assert.deepStrictEqual(r2.map((x) => [x.gia_tri, x.loai, x.nhan, x.t]), [[6000, 'nguoi', 'English archers', 1], [20000, 'nguoi', 'French knights', 5]]);
  assert.deepStrictEqual(soHinhCau({ su_that: [{ gia_tri: 'Henry V' }] }, w), []);   // không có số → không thẻ
  const w3 = 'Henry deployed around fifteen hundred men at arms and seven thousand longbowmen on 25 October'.split(' ').map((chu, k) => ({ chu, a: k, b: k + 1 }));
  const r3 = soHinhCau({ su_that: [{ gia_tri: '1,500 men-at-arms and 7,000 longbowmen' }, { gia_tri: '25 October 1415' }] }, w3);
  assert.deepStrictEqual(r3.map((x) => [x.gia_tri, x.loai, x.t]), [[1500, 'nguoi', 3], [7000, 'nguoi', 9]]);   // tách hai số, bỏ ngày tháng
  assert.deepStrictEqual(soHinhCau({ su_that: [{ gia_tri: '80 percent' }] }, 'nearly eighty percent'.split(' ').map((chu, k) => ({ chu, a: k, b: k + 1 }))).map((x) => x.chu), ['80%']);
  assert.deepStrictEqual(soHinhCau({ su_that: [{ gia_tri: 'about 5,000 men' }] }, 'The vanguard was packed'.split(' ').map((chu, k) => ({ chu, a: k, b: k + 1 }))), []);   // câu không đọc số → không thẻ
  console.log('so-hinh: đạt');
}

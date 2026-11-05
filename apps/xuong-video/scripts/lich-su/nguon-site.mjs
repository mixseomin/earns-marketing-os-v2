// NGUỒN SITE cho kênh chiêm tinh (anh 05/11/2026: "video dùng chart của astrolas thì phải dùng diễn giải trên site · đăng bài về một tool phải kèm mô tả và link
// cụ thể đến đúng page · mọi thứ phải đúng mô tả trong tool của astrolas, cấm bịa dựa vào kiến thức chiêm tinh tổng quan" + "cơ chế sinh video về sau phải khớp").
// MỘT lõi cho máy viết bài lẫn máy gác (kiem-so-kenh.mjs › kiemTap):
//   linkCongCu(ma, nguoi | [a, b], them)  → link mở THẲNG kết quả của đúng người / cặp trên trang công cụ (tham số GET theo sổ công cụ cong-cu/so-cong-cu.json)
//   khoChuSite(tap)                        → chữ NGUYÊN VĂN của site mà tập được phép dùng: lời giải synastry (la-so/hop), nghĩa 12 nhà (la-so/y-nghia-nha.json),
//                                            bài ghép cung (la-so/cung-cap.json), bài blog khai ở tap.nguon_bai (lấy về la-so/bai/), mô tả công cụ
//   kiemNguon(tap)                         → lỗi: (1) câu có từ chiêm tinh mà phần diễn giải không phải chữ của site; (2) trích “…” không khớp nguyên văn;
//                                            (3) thiếu dang.mo_ta / dang.link, link không mở đúng trang + đúng người, mô tả không mang câu mô tả công cụ của site
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)), doc = (p) => JSON.parse(readFileSync(join(DIR, p), 'utf8'));
export const SO_CONG_CU = () => doc('cong-cu/so-cong-cu.json').cong_cu;
const NGUOI = () => doc('la-so/nguoi.json').nguoi;

/** tham số sinh của một người theo đúng tên ô trên form site (hau = '' người A, '2' người B ở synastry; compatibility dùng tiền tố a_ / b_) */
function thamNguoi(n, hau = '', tien = '') {
  const s = n.sinh, k = (x) => `${tien}${x}${hau}`, o = { [k('name')]: n.ten, [k('day')]: s.ngay, [k('month')]: s.thang, [k('year')]: s.nam, [k('location')]: s.noi, [k('lat')]: s.vi, [k('lng')]: s.kinh };
  if (s.gio == null) Object.assign(o, { [k('hour')]: 12, [k('minute')]: 0, [k('unknown_time')]: 'on' }); else Object.assign(o, { [k('hour')]: s.gio, [k('minute')]: s.phut });
  return o;
}
/** link mở thẳng kết quả trên trang công cụ: ma = mã trong sổ công cụ; ai = slug | [slugA, slugB]; them = tham số riêng của công cụ (lot, year_target, rel_type…) */
export function linkCongCu(ma, ai, them = {}) {
  const c = SO_CONG_CU().find((x) => x.ma === ma); if (!c) throw new Error(`công cụ ${ma} không có trong sổ công cụ`);
  const tim = (sl) => { const n = NGUOI().find((x) => x.slug === sl); if (!n) throw new Error(`${sl} không có trong la-so/nguoi.json`); return n; };
  let p = {};
  if (Array.isArray(ai)) { const [a, b] = ai.map(tim); p = ma === 'compatibility' ? { ...thamNguoi(a, '', 'a_'), ...thamNguoi(b, '', 'b_') } : { ...thamNguoi(a), ...thamNguoi(b, '2') }; }
  else if (ai) p = thamNguoi(tim(ai));
  const thua = Object.keys({ ...p, ...them }).filter((x) => !c.tham.includes(x)); if (thua.length) throw new Error(`${ma}: trang không có ô ${thua.join(', ')}`);
  const q = new URLSearchParams({ ...p, ...them }).toString(); return q ? `${c.url}?${q}` : c.url;
}

/** phần BÀI ĐĂNG của một tập: mô tả = tên + câu mô tả NGUYÊN VĂN của công cụ trên site + link mở thẳng kết quả (+ dòng dẫn tự viết). Máy sinh nào cũng gọi hàm này. */
export function dangCongCu(ma, ai, tham = {}, dan = '') {
  const c = SO_CONG_CU().find((x) => x.ma === ma); if (!c?.mo_ta) throw new Error(`công cụ ${ma}: site chưa có mô tả riêng — chưa đăng bài về công cụ này`);
  const link = linkCongCu(ma, ai, tham);
  return { cong_cu: ma, ...(ai ? { ai } : {}), ...(Object.keys(tham).length ? { tham } : {}), link, mo_ta: `${dan ? `${dan}\n\n` : ''}${c.ten}: ${c.mo_ta}.\n${link}` };
}
const sach = (s) => String(s ?? '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/[“”"]/g, ' ').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const tu = (s) => sach(s).toLowerCase().match(/[a-z0-9°'$.,%-]+/g)?.map((w) => w.replace(/^[.,]+|[.,:;!?]+$/g, '').replace(/'s$/, '')).filter(Boolean) ?? [];

/** chữ site tập được dùng — mảng đoạn văn nguyên văn */
export function khoChuSite(tap) {
  const kho = [];
  const ls = tap.la_so?.split('/').pop()?.replace(/\.svg$/, '');
  if (ls && existsSync(join(DIR, 'la-so/hop', `${ls}.json`))) { const h = doc(`la-so/hop/${ls}.json`); for (const g of h.giai ?? []) kho.push(g.chu); for (const d of h.diem ?? []) kho.push(`${d.ten} ${d.mo_ta}`); }
  // nghĩa 12 nhà KHÔNG vào kho chung: chỉ dùng được cho đúng nhà được nhắc trong câu (phanBia › nghiaNha) — "home and family" có ở đâu đó trên site không có nghĩa nhà 4 là vậy
  if (/^sx-/.test(tap.y_tuong ?? '')) { const c = doc('la-so/cung-cap.json').cap.find((x) => x.ma === tap.y_tuong); if (c) kho.push(...c.mo, ...c.muc.flatMap((m) => [m.ten, ...m.doan])); }
  // bài blog của site: bài giải thích chung (luôn dùng được) + bài lá số của người trong tập + bài tập khai thêm ở nguon_bai
  const nguoiTap = [ls?.split('--')].flat().filter(Boolean), BAI = join(DIR, 'la-so/bai');
  const baiTap = existsSync(BAI) ? readdirSync(BAI).filter((f) => !/-birth-chart\.json$/.test(f) || nguoiTap.some((n) => f === `${n}-birth-chart.json`)).map((f) => f.replace(/\.json$/, '')) : [];
  for (const u of [...baiTap, ...(tap.nguon_bai ?? [])]) { const f = join(DIR, 'la-so/bai', `${u.split('/').filter(Boolean).pop()}.json`); if (existsSync(f)) { const b = JSON.parse(readFileSync(f, 'utf8')); kho.push(b.tieu_de, ...b.mo, ...b.muc.flatMap((m) => [m.ten, ...m.doan])); } }
  for (const c of SO_CONG_CU()) kho.push(`${c.ten} ${c.mo_ta}`);
  // mốc đời / mốc cặp đôi có nguồn (Wikipedia…) — chuyện đời người, không phải lời chiêm tinh, nhưng cũng chỉ được kể theo sổ
  if (ls && existsSync(join(DIR, 'la-so/hop', `${ls}.json`))) for (const m of doc(`la-so/hop/${ls}.json`).moc ?? []) kho.push(m.chu);
  for (const f of tap.nguon_moc ?? []) if (existsSync(join(DIR, f))) for (const m of doc(f).moc ?? []) kho.push(m.chu);
  return kho.filter(Boolean);
}

// TỪ CHIÊM TINH: câu chứa một từ này là câu chiêm tinh → phải theo luật nguồn
const CHIEM = /\b(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|lilith|node|houses?|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|rising|ascendant|descendant|midheaven|mc|ic|trine|squares?|opposes?|opposition|conjunct(ion)?|sextile|quincunx|retrograde|direct|profections?|lord|ruler|lot|spirit|fortune|releasing|peak|synastry|composite|zodiac|signs?|aspects?|transits?|lunation|eclipse)\b/i;
// câu DỮ LIỆU: chỉ gồm tên sao / cung / nhà / góc, số, ký hiệu và từ nối — không mang nghĩa. Dư từ khác = lời diễn giải → phải là chữ site
const DU_LIEU = new Set(('a an the his her their its your my our this that these those in on at of to and or with from by into is are was were be been it he she they you we '
  + 'sits sit lies lands landed falls holds hold has have had sitting on-top tight exact almost apart half degree degrees minutes minute orb ° \' age aged year years month day week this-week '
  + 'house houses sign signs planet planets point counted count from rising there here one two three four five six seven eight nine ten twelve first second third '
  + 'level l1 l2 l3 period chart charts wheel both each every all same again also too just only now then when while '
  // dẫn đường / công cụ (không mang nghĩa chiêm tinh)
  + "that's it's what's there's let's already inside outside about for per as so if not no yes than more most less "
  + 'means mean called calls call shows show says say scores score site tool tools page open enter find see pick choose set list type click tap watch look date birth born time place free '
  + 'astrolas.com astrolas compare yours own new next last today tonight tomorrow week weekly month months annual daily natal return solar lunar progressed '
  + 'monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec '
  // nguyên tố / tính chất / hướng / ký hiệu trên hình — dữ liệu lá số
  + 'semi-square sesquiquadrate semi-sextile quintile biquintile turns turn enters enter begins begin season full utc hours hour dates against across here part shown ac dc angle angles fire earth air water cardinal fixed mutable element elements modality north south east west left right up down gold yellow red blue line circle ring dot glyph symbol number numbers rx '
  + 'ari tau gem can vir lib sco sag cap aqu pis').split(/\s+/));
// TỪ NGHĨA: lời diễn giải chiêm tinh hay gặp — câu KHUNG (mở đầu / kết / dẫn chuyện, khai khung: true) được tự viết nhưng không được mang từ nào ở đây
const NGHIA = /\b(career|reputation|public|status|home|family|parents?|father|mother|children|creativity|joy|love|romance|romantic|marriage|spouse|partners?|partnership|relations?|relationships?|money|wealth|income|values?|health|illness|work|service|duty|communication|siblings|travel|education|religion|faith|beliefs?|friends?|hopes?|wishes|enemies|secrets?|hidden|calamit\w*|imprisonment|death|sex\w*|intimacy|debts?|transformation|power|control|identity|ego|self|emotions?|feelings?|moods?|instincts?|intuition|dreams?|spirit\w*|luck\w*|lucky|fortune|growth|expansion|restriction|discipline|lessons?|karma\w*|destiny|fate|wound\w*|healing|teacher|rebellion|freedom|change|chaos|harmony|conflict|tension|challenges?|chemistry|compatib\w*|attraction|passion|energy|desire|beauty|pleasure|wisdom|mind|thinking|stress|slow|decisions?|good|bad|easy|hard|trouble|best|worst|ideal|perfect)\b/i;
const laSo = (w) => /^[0-9$°'.,%-]+$/.test(w) || /^\d+(st|nd|rd|th)$/.test(w) || /^\d+°\d*'?$/.test(w);

/** từ còn lại sau khi bỏ mọi khúc ≥ 3 từ trùng NGUYÊN VĂN kho chữ site; câu chiêm tinh còn từ nghĩa → lỗi */
const THU_TU = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 };
/** nghĩa nhà của site cho các nhà được nhắc trong câu ("10th house", "the 7th", "seventh house") — chỉ những từ này được dùng lẻ, đúng nhà */
function nghiaNha(cau) {
  if (!existsSync(join(DIR, 'la-so/y-nghia-nha.json'))) return [];
  const y = doc('la-so/y-nghia-nha.json').nha, so = new Set([...sach(cau).toLowerCase().matchAll(/\b(\d{1,2})(?:st|nd|rd|th)\b|\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\b/g)].map((m) => Number(m[1] ?? THU_TU[m[2]])));
  return [...so].filter((n) => y[n]).map((n) => y[n]);
}
/** khúc trùng nguyên văn kho chữ site phải dài ≥ 5 từ (cụm ngắn như "home and family" có ở đâu đó trên site không chứng minh được gì) */
const KHUC_TOI_THIEU = 5;
export function phanBia(cau, kho, them = new Set()) {
  const w = tu(cau), khoTu = kho.map((k) => ` ${tu(k).join(' ')} `), dung = new Array(w.length).fill(false);
  const nha = new Set(nghiaNha(cau).flatMap(tu));
  for (let i = 0; i < w.length; i++) for (let j = w.length; j - i >= KHUC_TOI_THIEU; j--) { if (dung[i]) break; const khuc = ` ${w.slice(i, j).join(' ')} `; if (khoTu.some((k) => k.includes(khuc))) { for (let x = i; x < j; x++) dung[x] = true; break; } }
  return w.filter((x, i) => !dung[i] && !laSo(x) && !DU_LIEU.has(x) && !them.has(x) && !nha.has(x) && !CHIEM.test(x));
}

/** từ riêng của tập được dùng lẻ: tên người trong sổ, tên công cụ, chữ trong mốc đời (chuyện đời có nguồn — không phải lời chiêm tinh) */
function tuRieng(tap) {
  const ls = tap.la_so?.split('/').pop()?.replace(/\.svg$/, ''), o = new Set();
  for (const n of NGUOI()) for (const w of tu(n.ten)) o.add(w);
  for (const c of SO_CONG_CU()) for (const w of tu(c.ten)) o.add(w);
  const moc = [...(ls && existsSync(join(DIR, 'la-so/hop', `${ls}.json`)) ? doc(`la-so/hop/${ls}.json`).moc ?? [] : []), ...(tap.nguon_moc ?? []).flatMap((f) => (existsSync(join(DIR, f)) ? doc(f).moc ?? [] : []))];
  for (const m of moc) for (const w of tu(m.chu)) if (!NGHIA.test(w)) o.add(w);
  // câu HOOK là dòng đầu QC spy (luật hook — hook-qc.mjs giữ ≥ 35% chữ gốc): chữ của QC gốc là nguồn hợp lệ cho câu khung
  for (const w of tu(tap.hook?.goc ?? '')) o.add(w);
  return o;
}
export function kiemNguon(tap) {
  const loi = [], kho = khoChuSite(tap), khoTu = kho.map((k) => ` ${tu(k).join(' ')} `), rieng = tuRieng(tap);
  for (const [i, q] of (tap.cau ?? []).entries()) {   // chữ trên màn: câu kể + nhãn nhỏ trên cảnh + thẻ số
    const dong = [q.doc ?? q.chu, q.nhan, ...(q.the ? [q.the.lon, q.the.duoi, ...(q.the.dong ?? [])] : [])].map((x) => String(x ?? '')).join(' ');
    let conLai = dong;   // trích “…” khớp nguyên văn thì trừ ra, phần còn lại mới kiểm
    const khoCau = [...khoTu, ...nghiaNha(dong).map((n) => ` ${tu(n).join(' ')} `), ...(q.khung && tap.hook?.goc ? [` ${tu(tap.hook.goc).join(' ')} `] : [])];   // nghĩa nhà của site chỉ hợp lệ với đúng nhà câu này nhắc
    for (const m of dong.matchAll(/“([^”]+)”/g)) { if (!khoCau.some((k) => k.includes(` ${tu(m[1]).join(' ')} `))) loi.push(`câu ${i + 1}: trích “${m[1]}” không khớp nguyên văn chữ site của tập`); else conLai = conLai.replace(m[0], ' '); }
    const bia = phanBia(conLai, kho, rieng);
    if (q.khung) { const n = bia.filter((x) => NGHIA.test(x)); if (n.length) loi.push(`câu ${i + 1} (khung): tự viết nhưng mang nghĩa chiêm tinh (${n.join(' ')}) — nghĩa phải là chữ nguyên văn site`); }
    else if (CHIEM.test(sach(dong)) && bia.length) loi.push(`câu ${i + 1}: lời chiêm tinh không phải chữ của site (${bia.slice(0, 6).join(' ')}) — lấy nguyên văn site, chỉ nêu dữ liệu lá số, hoặc khai khung: true nếu là câu dẫn không mang nghĩa`);
  }
  // bài đăng: mô tả + link mở thẳng trang công cụ của tập
  const d = tap.dang, cc = SO_CONG_CU().find((x) => x.ma === d?.cong_cu);
  if (!d?.mo_ta || !d?.link) loi.push('thiếu dang.mo_ta + dang.link (bài đăng phải kèm mô tả và link đúng trang công cụ)');
  else if (!cc) loi.push(`dang.cong_cu "${d?.cong_cu}" không có trong sổ công cụ (cong-cu/so-cong-cu.json)`);
  else {
    if (!cc.mo_ta) loi.push(`công cụ ${cc.ma}: site chưa có mô tả riêng — chưa đăng bài về công cụ này`);
    else if (!d.mo_ta.includes(cc.mo_ta)) loi.push(`mô tả bài đăng phải có câu mô tả công cụ của site: "${cc.mo_ta}"`);
    if (!d.link.startsWith(cc.url)) loi.push(`dang.link không mở trang ${cc.url}`);
    if (!d.mo_ta.includes(d.link)) loi.push('mô tả bài đăng phải chứa đúng dang.link');
    if (d.ai && d.link !== linkCongCu(cc.ma, d.ai, d.tham ?? {})) loi.push(`dang.link không mở thẳng kết quả của ${[d.ai].flat().join(' × ')} (dùng linkCongCu)`);
  }
  return loi;
}

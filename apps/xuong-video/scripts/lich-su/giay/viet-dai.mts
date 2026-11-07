// MÁY VIẾT TẬP DÀI 16:9 "ENTIRE STORY" (mẫu ghép giấy, 06/11/2026, anh: "bối cảnh kiểu tranh ghép giấy theo lớp… nhân vật nổi tiếng… tìm một sự kiện / câu chuyện"). Chạy trên box3:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/giay/viet-dai.mts <ra.json> --chu-de "<sự kiện>" --nguon "Tựa wiki|Tựa wiki" --id <id> [--tu 1650]
// Nguồn: Wikipedia (đủ các mục) + ảnh thật trong bài (giấy phép công cộng / CC). Một lượt dàn ý (chương, bối cảnh, vai) → mỗi chương một lượt (song song).
// Mọi su_that phải NGUYÊN VĂN trong nguồn, mọi mã cảnh phải có trong dàn ý: máy kiểm, sai thì trả lỗi cho chương đó viết lại (tối đa 3 lượt).
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { z } from 'zod/v4';
import { sinhJson } from '../../../src/lib/xuong-video/claude';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const ra = process.argv[2], chuDe = arg('chu-de'), id = arg('id'), tuDich = Number(arg('tu') ?? 1650), tua = (arg('nguon') ?? '').split('|').filter(Boolean);
if (!ra || !chuDe || !id || !tua.length) { console.error('tsx viet-dai.mts <ra.json> --chu-de … --nguon "A|B" --id …'); process.exit(2); }
const UA = { 'User-Agent': 'studio-lich-su/1.0 (studio.on.tc; admin@mixseo.net)' }, API = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2&';
const json = async (u: string): Promise<any> => { for (let i = 1; ; i++) { const r = await fetch(u, { headers: UA }); const t = await r.text(); try { if (r.ok) return JSON.parse(t); } catch { /* thử lại */ } if (i >= 5) throw new Error(`Wikipedia ${r.status}`); await new Promise((o) => setTimeout(o, 3000 * i)); } };
const phang = (s: string) => s.toLowerCase().replace(/[“”"'‘’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// ---------- nguồn: các mục + ảnh thật ----------
const MUC: { ten: string; chu: string; bai: string }[] = [], ANH: Record<string, { file: string; cap: string; thumb: string; giay_phep: string; tac_gia: string; nguon: string; rong: number; cao: number }> = {}, URL_NGUON: string[] = [];
const BO = /icon|logo|ambox|symbol|flag|locator|portal|padlock|disambig|stub|signature|coat of arms|\.svg/i, GIAY = /public domain|^pd|cc0|cc by/i;
for (const t of tua) {
  const p = (await json(`${API}action=query&redirects=1&prop=extracts&explaintext=1&exsectionformat=wiki&titles=${encodeURIComponent(t)}`)).query.pages[0];
  if (!p.extract) throw new Error(`không có bài "${t}"`);
  URL_NGUON.push(`https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`);
  for (const k of p.extract.split(/\n(?=={2,}[^=])/)) { const m = k.match(/^(={2,})\s*(.+?)\s*\1/), ten = m ? m[2] : 'Lead', chu = (m ? k.slice(m[0].length) : k).trim();
    if (chu.length > 150 && !/^(see also|references|notes|bibliography|external links|further reading|citations|sources)$/i.test(ten)) MUC.push({ ten: `${p.title} › ${ten}`, chu, bai: p.title }); }
  const html = await (await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(p.title.replace(/ /g, '_'))}`, { headers: UA })).text();
  for (const m of html.matchAll(/<figure[^>]*typeof="mw:File\/Thumb"[^>]*>([\s\S]*?)<\/figure>/g)) { const f = m[1].match(/href="\.\/(File:[^"#?]+)"/)?.[1], cap = (m[1].match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/)?.[1] ?? '').replace(/<[^>]+>/g, '').replace(/&[#a-z0-9]+;/g, ' ').trim();
    if (!f || BO.test(f) || !/\.(jpe?g|png|tiff?)$/i.test(f) || Object.keys(ANH).length >= 45) continue; const file = decodeURIComponent(f).replace(/_/g, ' ');
    if (Object.values(ANH).some((a) => a.file === file)) continue;
    const ii = (await json(`${API}action=query&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1600&titles=${encodeURIComponent(file)}`)).query.pages[0]?.imageinfo?.[0], md = ii?.extmetadata ?? {}, gp = md.LicenseShortName?.value ?? '';
    if (!ii || !GIAY.test(gp) || ii.width < 600 || /\bmap\b|karte|carte/i.test(`${file} ${cap}`)) continue;
    ANH[`A${Object.keys(ANH).length + 1}`] = { file, cap: cap.slice(0, 160), thumb: ii.thumburl ?? ii.url, giay_phep: gp, tac_gia: String(md.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 100), nguon: ii.descriptionurl, rong: ii.thumbwidth ?? ii.width, cao: ii.thumbheight ?? ii.height }; } }
console.log(`nguồn ${MUC.length} mục · ${MUC.reduce((s, m) => s + m.chu.length, 0)} ký tự · ${Object.keys(ANH).length} ảnh thật`);
let tien = 0;

// ---------- dàn ý ----------
const DanY = z.object({
  tieu_de: z.string().describe('"The ENTIRE Story of <sự kiện có tên người nổi tiếng> in {N} Minutes" — giữ nguyên {N}'),
  nam_dau: z.number().int(), nam_cuoi: z.number().int(),
  thumb: z.object({ chu: z.string().describe('2–3 chữ IN HOA to'), nam: z.string().describe('vd "JUNE – DECEMBER 1812"'), nhan_vat: z.string(), boi_canh: z.string() }),
  chuong: z.array(z.object({ ten: z.string().describe('tên chương TIẾNG ANH, 2–6 từ'), muc: z.array(z.string()).describe('tên mục nguồn đúng y danh sách'), y: z.string() })).describe('7–9 chương; chương đầu là hook lớn'),
  boi_canh: z.array(z.object({ id: z.string(), mo_ta_en: z.string().describe('nền xa KHÔNG người, KHÔNG chữ: chỗ, thời tiết, giờ, ánh sáng, đúng thời'), mau_dat: z.string().describe('màu dải đất trước, hex'), tien_canh: z.enum(['khong', 'rem', 'la', 'da', 'tuyet']),
    hieu_ung: z.array(z.enum(['may', 'tuyet', 'lua', 'khoi', 'song', 'bui'])),
    vat: z.array(z.object({ id: z.string(), mo_ta_en: z.string().describe('MỘT vật rời nhìn ra ngay khi cắt khỏi nền (xe, pháo, nhà, lều, bàn…), đúng thời, không chữ; KHÔNG phải mảng cảnh như sông, đường, khói, rừng xa, cánh đồng'), x: z.number().describe('0–1 ngang'), cao: z.number().describe('0,15–0,75 chiều cao khung'), sau: z.number().describe('0 xa – 1 gần') })).describe('2–3 lớp') })).describe('18–26 bối cảnh RẤT khác nhau: ngoài trời, trong nhà, cung điện, doanh trại, sông, thành cháy, bão tuyết…'),
  nhan_vat: z.array(z.object({ id: z.string().describe('chữ thường, gạch dưới'), ten: z.string(), chan_dung: z.string().nullable().describe('tựa bài en.wikipedia.org đúng y của người có thật; vai chung (lính, dân) để null'), mo_ta_en: z.string().describe('dáng, tuổi, mặt, trang phục đúng năm — tả đủ để nhận ra ngay người nổi tiếng'), tu: z.number().int(), den: z.number().int(), dang: z.array(z.enum(['chi_tay', 'khoanh_tay', 'nam_dam', 'ngac_nhien', 'suy_nghi', 'buon', 'cuoi'])) })).describe('6–10 vai có tên trong nguồn, gồm cả vài vai dân thường / lính'),
});
const dsMuc = MUC.map((m) => `- ${m.ten} (${m.chu.length} ký tự)`).join('\n'), dsAnh = Object.entries(ANH).map(([k, a]) => `${k}: ${a.file.replace(/^File:/, '')} — ${a.cap}`).join('\n');
const LOI = 'Giọng: người kể chuyện tài liệu dí dỏm tỉnh bơ, nói thẳng, câu ngắn. Đùa về QUYẾT ĐỊNH của kẻ có quyền, KHÔNG đùa về người chết / nạn nhân. Tiếng Anh tự nhiên, không sáo AI, không gạch dài.';
// LƯU TẠM (06/11/2026: một trích dẫn sai ở chương 2 làm sập cả lượt, mất tiền các chương đã viết): dàn ý + từng chương ghi cạnh tệp ra, chạy lại không viết lại phần đã đạt
const tepDy = `${ra}.dan-y.json`, tepCh = (i: number) => `${ra}.chuong-${i}.json`;
const dy: any = existsSync(tepDy) ? { ok: true, data: JSON.parse(readFileSync(tepDy, 'utf8')) } : await sinhJson({ schema: DanY, model: 'claude-sonnet-5-5', max_tokens: 24000, ten: 'dàn ý tập dài ghép giấy',
  system: `Mọi tên chương, tiêu đề, chữ thumbnail bằng TIẾNG ANH. Bạn dựng dàn ý video YouTube tài liệu ~${Math.round(tuDich / 140)} phút, tổng ${tuDich} từ, hình ghép giấy nhiều lớp. Chương có căng thẳng tăng dần, mỗi chương kết bằng câu móc sang chương sau. ${LOI}`,
  user: `SỰ KIỆN: ${chuDe}\nMỤC NGUỒN:\n${dsMuc}\nTÓM TẮT:\n${MUC.slice(0, 2).map((m) => m.chu.slice(0, 5000)).join('\n')}` });
if (!dy.ok) { console.error(`✗ dàn ý: ${dy.loi}`); process.exit(1); }
const D: z.infer<typeof DanY> = dy.data; writeFileSync(tepDy, JSON.stringify(D)); tien += dy.tokens?.vnd ?? 0; console.log(`dàn ý: ${D.chuong.length} chương · ${D.boi_canh.length} bối cảnh · ${D.nhan_vat.length} vai`);
if (D.chuong.some((c) => /[^\x00-\x7F’–]/.test(c.ten))) { rmSync(tepDy, { force: true }); console.error('✗ dàn ý: tên chương không phải tiếng Anh'); process.exit(1); }
const idBc = new Set(D.boi_canh.map((b) => b.id)), idNv = new Map(D.nhan_vat.map((n) => [n.id, n]));

// ---------- từng chương ----------
const Cau = z.object({ chu: z.string().describe('MỘT câu đọc, ≤ 24 từ'), su_that: z.array(z.string()).describe('trích NGUYÊN VĂN 4–20 từ từ nguồn; câu đùa / chuyển ý để []'),
  loai: z.enum(['san_khau', 'ban_do', 'ho_so']), nam: z.number().int().nullable(),
  boi_canh: z.string().nullable(), nguoi: z.array(z.object({ id: z.string(), dang: z.enum(['goc', 'chi_tay', 'khoanh_tay', 'nam_dam', 'ngac_nhien', 'suy_nghi', 'buon', 'cuoi']), x: z.number().describe('0,15–0,85') })).describe('san_khau: 0–3 người'),
  so: z.object({ chu: z.string(), nhan: z.string() }).nullable().describe('số lớn đáng nhớ có trong câu'), dau: z.string().nullable().describe('con dấu 1–2 chữ cho khoảnh khắc lật ngược'),
  ban_do: z.object({ tam: z.array(z.number()).describe('[lon, lat]'), zoom: z.number().describe('1 cả châu Âu – 6 một vùng'), ten: z.array(z.object({ tu: z.array(z.number()), den: z.array(z.number()) })), ghim: z.array(z.object({ o: z.array(z.number()), chu: z.string() })) }).nullable(),
  anh: z.string().nullable().describe('ho_so: mã ảnh A…') });
const Chuong = z.object({ cau: z.array(Cau) });
const kiemChuong = (cs: z.infer<typeof Cau>[], nguon: string, tuCan: number) => { const loi: string[] = [], p = phang(nguon), so = cs.map((c) => c.chu).join(' ').split(/\s+/).length;
  if (so < tuCan * 0.75 || so > tuCan * 1.25) loi.push(`chương có ${so} từ, cần ~${tuCan}`);
  let lien = 0, bcTruoc: string | null = null, bang = 0;
  cs.forEach((c, i) => { const K = `câu ${i + 1}`; if (c.chu.split(/\s+/).length > 28) loi.push(`${K}: dài quá 28 từ`); if (/[—–]/.test(c.chu)) loi.push(`${K}: có gạch dài`);
    for (const s of c.su_that) if (!p.includes(phang(s))) loi.push(`${K}: su_that không nguyên văn trong nguồn: "${s.slice(0, 70)}"`);
    if (c.su_that.length === 0) bang++;
    if (c.loai === 'san_khau') { if (!c.boi_canh || !idBc.has(c.boi_canh)) loi.push(`${K}: boi_canh "${c.boi_canh}" không có`); for (const n of c.nguoi) { const v = idNv.get(n.id); if (!v) loi.push(`${K}: vai "${n.id}" không có`); }
      lien = c.boi_canh === bcTruoc ? lien + 1 : 1; bcTruoc = c.boi_canh; if (lien > 7) loi.push(`${K}: quá 7 câu liền một bối cảnh`); }
    else { bcTruoc = null; lien = 0; }
    if (c.loai === 'ban_do' && (!c.ban_do || c.ban_do.tam.length !== 2)) loi.push(`${K}: thiếu ban_do`); for (const x of [c.so?.chu, c.so?.nhan, c.dau]) if (x && /[^\x20-\x7E°−–—’‘“”éèêëàâäîïôöùûüçÉÈ]/.test(x)) loi.push(`${K}: chữ trên hình phải tiếng Anh, không emoji: ${x}`);
    if (c.loai === 'ho_so' && (!c.anh || !ANH[c.anh])) loi.push(`${K}: ảnh "${c.anh}" không có`); });
  if (bang > cs.length * 0.3) loi.push(`quá nhiều câu không su_that (${bang}/${cs.length})`);
  return loi; };
const vietChuong = async (ch: typeof D.chuong[number], i: number) => { const nguon = MUC.filter((m) => ch.muc.some((x) => m.ten === x || m.ten.endsWith(x))); const dung = (nguon.length ? nguon : MUC.slice(0, 3)).map((m) => m.chu).join('\n\n').slice(0, 26000), tuCan = Math.round(tuDich / D.chuong.length);   // chia đều: 06/11/2026 máy tự khai số từ kiểu cộng dồn (0, 87, 170…) làm chương đầu cụt
  if (existsSync(tepCh(i))) return JSON.parse(readFileSync(tepCh(i), 'utf8')) as z.infer<typeof Cau>[];
  let loi: string[] = [], cu: z.infer<typeof Cau>[] | null = null;
  for (let lan = 1; lan <= 3; lan++) {
    const r = await sinhJson({ schema: Chuong, model: 'claude-sonnet-5-5', max_tokens: 20000, ten: `chương ${i + 1} tập dài ghép giấy`,
      system: `Viết MỘT chương video tài liệu, mỗi phần tử = một câu đọc kèm hình. Câu 12–22 từ, đầy đủ ý, đan vài câu ngắn để tạo nhịp; KHÔNG viết toàn câu cụt. ${LOI}\nNhịp hình: ~55% san_khau (người diễn trong bối cảnh, đổi dáng theo chữ), ~20% ban_do, ~20% ho_so (tranh / ảnh thật), đan xen, không quá 3 câu bản đồ liền. Khi kể tới người có tên phải có người đó trên sân khấu. Đổi bối cảnh sau 3–6 câu. Dùng nhiều bối cảnh khác nhau trong chương.${i === 0 ? ' Câu 1 là HOOK sốc: con số hoặc nghịch lý lớn nhất của cả chuyện, rồi mới lùi về đầu.' : ''} Tập ${D.nam_dau}–${D.nam_cuoi}.`,
      user: `CHƯƠNG ${i + 1}/${D.chuong.length}: ${ch.ten}\nÝ: ${ch.y}\nĐỘ DÀI BẮT BUỘC: ${tuCan} từ, khoảng ${Math.round(tuCan / 15)} câu\nCHƯƠNG KHÁC: ${D.chuong.map((c) => c.ten).join(' · ')}\nBỐI CẢNH: ${D.boi_canh.map((b) => `${b.id} (${b.mo_ta_en.slice(0, 70)})`).join('; ')}\nVAI: ${D.nhan_vat.map((n) => `${n.id}=${n.ten} [goc,${n.dang.join(',')}] ${n.tu}-${n.den}`).join('; ')}\nẢNH THẬT:\n${dsAnh}\n${loi.length ? `\nBẢN TRƯỚC SAI, SỬA:\n${loi.join('\n')}\nBản trước: ${JSON.stringify(cu).slice(0, 12000)}\n` : ''}\nNGUỒN:\n${dung}` });
    if (!r.ok) { loi = [r.loi]; continue; } tien += r.tokens?.vnd ?? 0; cu = r.data.cau; loi = kiemChuong(r.data.cau, MUC.map((m) => m.chu).join('\n'), tuCan);
    console.log(`chương ${i + 1} lượt ${lan}: ${r.data.cau.length} câu · ${loi.length} lỗi`); if (!loi.length) { writeFileSync(tepCh(i), JSON.stringify(r.data.cau)); return r.data.cau; } }
  // còn lỗi nhỏ sau 3 lượt: chỉ giữ tập nếu toàn lỗi độ dài; lỗi sự thật thì dừng
  // CÂU KHÔNG CÓ NGUỒN NGUYÊN VĂN sau 3 lượt: bỏ đúng câu đó (không giữ câu chưa kiểm được, không sập cả tập); lỗi còn lại vẫn dừng
  if (cu) { const p = phang(MUC.map((m) => m.chu).join('\n')), sach = cu.filter((c) => c.su_that.every((x) => p.includes(phang(x)))); if (sach.length < cu.length) console.log(`chương ${i + 1}: bỏ ${cu.length - sach.length} câu không có nguồn nguyên văn`);
    const con = kiemChuong(sach, MUC.map((m) => m.chu).join('\n'), tuCan); if (sach.length >= cu.length - 3 && sach.map((c) => c.chu).join(' ').split(/\s+/).length >= tuCan * 0.65 && con.every((l) => /từ, cần|quá nhiều câu không su_that/.test(l))) { writeFileSync(tepCh(i), JSON.stringify(sach)); return sach; } loi = con; }
  throw new Error(`chương ${i + 1} còn lỗi: ${loi.slice(0, 8).join(' | ')}`); };
const kqCh = await Promise.allSettled(D.chuong.map(vietChuong)), hongCh = kqCh.flatMap((x) => (x.status === 'rejected' ? [String(x.reason?.message ?? x.reason)] : []));
if (hongCh.length) { console.error(`✗ ${hongCh.join('\n✗ ')}`); process.exit(1); }
const cac = kqCh.map((x) => (x as PromiseFulfilledResult<z.infer<typeof Cau>[]>).value);
for (const c of cac.flat()) for (const n of c.nguoi) { const v = idNv.get(n.id)!; if (n.dang !== 'goc' && !(v.dang as string[]).includes(n.dang)) (v.dang as string[]).push(n.dang); }
const dung = new Set(cac.flat().map((c) => c.anh).filter(Boolean));
const tap = { id, kenh: 'parody', mau: 'entire-story', ngon_ngu: 'en', giong: { voice: 'Daniel' }, chu_de: chuDe, tieu_de: D.tieu_de, thumb: D.thumb, nam_dau: D.nam_dau, nam_cuoi: D.nam_cuoi, nguon: URL_NGUON, boi_canh: D.boi_canh, nhan_vat: D.nhan_vat,
  anh: Object.fromEntries(Object.entries(ANH).filter(([k]) => dung.has(k))), chuong: D.chuong.map((c, i) => ({ ten: c.ten, cau: cac[i]!.length })), cau: cac.flatMap((cs, i) => cs.map((c) => ({ ...c, chuong: i }))) };
writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n');
try { execFileSync('rm', ['-f', tepDy, ...D.chuong.map((_, i) => tepCh(i))]); } catch { /* tệp tạm */ }
console.log(`✓ ${ra} · ${tap.cau.length} câu · ${tap.cau.map((c) => c.chu).join(' ').split(/\s+/).length} từ ~${Math.round(tien)}₫`);

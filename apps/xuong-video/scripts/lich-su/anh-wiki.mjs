// ẢNH THẬT TỪ WIKIPEDIA (06/11/2026, luật "mọi bài có ảnh minh hoạ thật") — MỘT lõi cho mọi máy viết cần ảnh của chuyện / người (Sky Calendar, Chart Chapters…).
// Lấy theo thứ tự: ảnh đầu trang của các trang nguồn → ảnh minh hoạ trong THÂN bài (figure mw:File/Thumb; ảnh hộp điều hướng cuối trang là span, không vào) → trang lấp
// (chỉ khi chủ đề cho phép ảnh chung, vd nhật thực). CHỈ giữ giấy phép công cộng / CC0 / CC BY(-SA) theo Commons, rộng ≥ 700, bỏ biểu tượng / cờ / bản đồ. 0đ.
// → brand/astrolas/tranh/<ma>-<i>.jpg (rộng 1400, sips) · trả [{ tep, trang, file, giay_phep, tac_gia, nguon }] — CC BY phải ghi tác giả trong bài đăng (ghiTacGia)
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TRANH = join(dirname(fileURLToPath(import.meta.url)), 'brand/astrolas/tranh');
const UA = { 'User-Agent': 'AstrolasStudio/1.0 (https://astrolas.com)' }, API = 'https://en.wikipedia.org/w/api.php?format=json&';
const lay = async (u) => (await fetch(u, { headers: UA })).json();
const BO = /icon|logo|ambox|symbol|edit-ltr|question|wiki|flag|map of|locator|portal|padlock|disambig|stub|signature|autograph/i, GIAY = /public domain|^pd|cc0|cc by/i;
/** tên trang từ link Wikipedia (https://en.wikipedia.org/wiki/Brad_Pitt#Career → "Brad Pitt") */
export const tenTrang = (url) => decodeURIComponent(url.split('/wiki/')[1].split('#')[0]).replace(/_/g, ' ');
/** dòng ghi tác giả cho bài đăng (ảnh CC BY bắt buộc ghi) */
export const ghiTacGia = (anh) => anh.filter((a) => /cc by/i.test(a.giay_phep)).map((a) => `${a.file.replace(/^File:/, '')} by ${a.tac_gia || 'unknown'} (${a.giay_phep}) ${a.nguon}`);

export async function layAnhWiki(trang, { ma, toiDa = 3, lap = [] } = {}) {
  const ung = [];   // ưu tiên: ảnh đầu trang nguồn (0) → ảnh trong thân bài nguồn (1) → trang lấp (2)
  for (const t of [...trang, ...lap]) {
    const uu = trang.includes(t) ? 0 : 2, p = Object.values((await lay(`${API}action=query&redirects=1&prop=pageimages&piprop=name&titles=${encodeURIComponent(t)}`)).query.pages)[0];
    if (p.pageimage) ung.push({ trang: t, file: `File:${p.pageimage.replace(/_/g, ' ')}`, uu });
    const html = await (await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(t.replace(/ /g, '_'))}`, { headers: UA })).text();
    for (const m of html.matchAll(/<figure[^>]*typeof="mw:File\/Thumb"[^>]*>[\s\S]*?href="\.\/(File:[^"#?]+)"/g)) ung.push({ trang: t, file: decodeURIComponent(m[1]).replace(/_/g, ' '), uu: uu || 1 });
  }
  const chon = [], da = new Set();
  for (const u of ung.sort((a, b) => a.uu - b.uu)) {
    if (chon.length >= toiDa || da.has(u.file) || !/\.(jpe?g|png|tiff?)$/i.test(u.file) || BO.test(u.file)) continue; da.add(u.file);
    const ii = Object.values((await lay(`${API}action=query&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1600&titles=${encodeURIComponent(u.file)}`)).query.pages)[0]?.imageinfo?.[0];
    const md = ii?.extmetadata ?? {}, gp = md.LicenseShortName?.value ?? '';
    if (!ii || !GIAY.test(gp) || ii.width < 700) continue;
    const tep = `${ma}-${chon.length + 1}.jpg`, tam = join(TRANH, `.tai-${tep}`);
    writeFileSync(tam, Buffer.from(await (await fetch(ii.thumburl ?? ii.url, { headers: UA })).arrayBuffer()));
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '72', '--resampleWidth', '1400', tam, '--out', join(TRANH, tep)], { stdio: 'ignore' });
    execFileSync('rm', ['-f', tam]);
    chon.push({ tep: `brand/astrolas/tranh/${tep}`, trang: u.trang, file: u.file, giay_phep: gp, tac_gia: (md.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 120), nguon: ii.descriptionurl });
  }
  return chon;
}

// BỘ HỒ SƠ TIỀN KỲ MỘT TẬP (14/10/2026 — anh: "ngành họ làm thế nào mình phải làm chi tiết đến như vậy", "sao lại cứ gộp như vậy?").
// Mỗi tài liệu của ngành là một lớp RIÊNG, của một người riêng — không gộp:
//   1. Kịch bản (biên kịch)            — định dạng screenplay: tiêu đề cảnh, hành động, nhân vật + diễn xuất + lời/âm hiệu, chuyển cảnh. KHÔNG máy.
//   2. Phân tích cảnh (đạo diễn)        — mục tiêu, xung đột, nhịp hành động–phản ứng, giá trị đổi, điểm xoay.
//   3. Bóc tách sản xuất (breakdown)    — nhân vật, đạo cụ, bối cảnh, hiệu ứng từng cảnh; ref ĐÚNG tên anchor của phim.
//   4. Shot list (đạo diễn + quay phim) — số, vai kể, cỡ cảnh, góc, chuyển động, ống kính, giây, chuyển cảnh, máy làm gì/vì sao, mã luật.
//   5. Bảng liên tục (thư ký trường quay) — trạng thái mở/kết, hướng nhìn·hướng đi, bố cục 3 lớp.
//   6. Color script                     — ánh sáng + màu từng cảnh theo cung cảm xúc.
//   7. Bảng âm thanh (cue sheet)         — âm từng shot, nhạc từng cảnh.
// Từ MỘT file JSON (scripts/du-lieu/<phim>-tap<n>.json) → chữ KỊCH BẢN thuần cho ô Kịch bản của tập + trang HTML 7 tab để duyệt. Mọi mã
// (vai, cỡ cảnh, máy, luật, ánh sáng, màu, nhạc) kiểm theo thư viện; tên anchor kiểm theo danh sách anchor của phim; nhịp đọc + nhịp hình
// kiểm bằng đúng cổng của studio. Sai là dừng, không sinh bản lệch. 0đ, không gọi model:
//   node_modules/.bin/tsx apps/xuong-video/scripts/kich-ban-the.mts <kb.json> <ra.md> <ra.html>
import { readFileSync, writeFileSync } from 'node:fs';
import { kyThuat, type NhomKyThuat } from '../src/lib/xuong-video/dien-anh';
import { luatDung, LUAT_DUNG_CANH } from '../src/lib/xuong-video/luat-dung';
import { giayDoc, kiemNhipHinh } from '../src/lib/xuong-video/nhip-hinh';

type May = { goc: string; chuyen_dong: string; ong_kinh: string; chuyen_canh: string; mo_ta: string };
type Shot = { may: May; vai: string; co: string; giay: number; luat: string[]; thay: string; bo_cuc: string; mo: string; ket: string; huong: string; am: string; muc_dich: string; motif: string };
type DongKb = { loai: 'hd' | 'am' | 'chuyen'; chu: string } | { loai: 'nv'; ten: string; dien: string; loi: string };
type Canh = {
  so: number; ten: string; noi: string; luc: string; doi: string; xoay: string; shot: Shot[]; kich_ban: DongKb[];
  dao_dien: { muc_tieu: string; xung_dot: string; nhip: string[] }; boc_tach: { nhan_vat: string[]; dao_cu: string[]; boi_canh: string[]; hieu_ung: string[] };
  mau: { anh_sang: string; mau: string; mo_ta: string }; nhac: string;
};
type Kb = { ten: string; tap: number; thoi_gian: string; duong_di: string; motif: string; cung: string; canh: Canh[]; anchor_phim: { nhan_vat: string[]; dao_cu: string[]; boi_canh: string[] } };

const [vao, raMd, raHtml] = process.argv.slice(2);
if (!vao || !raMd || !raHtml) { console.error('cần <kb.json> <ra.md> <ra.html>'); process.exit(1); }
const kb = JSON.parse(readFileSync(vao, 'utf8')) as Kb;
const shots = kb.canh.flatMap((c) => c.shot);

// ── Kiểm theo thư viện + anchor phim + cổng studio
const loi: string[] = [];
const coMa = (k: string, n: NhomKyThuat, o: string) => { if (!kyThuat(k, n)) loi.push(`${o}: ${n} "${k}" không có trong thư viện`); };
shots.forEach((s, i) => {
  const o = `shot ${i + 1}`;
  coMa(s.vai, 'vai', o); coMa(s.co, 'co_canh', o);
  for (const k of ['goc', 'chuyen_dong', 'ong_kinh', 'chuyen_canh'] as const) coMa(s.may?.[k], k, o);
  if (!s.may?.mo_ta?.trim()) loi.push(`${o}: thiếu mô tả máy`);
  for (const l of s.luat) if (!luatDung(l)) loi.push(`${o}: luật "${l}" không có trong thư viện`);
  if (s.giay < giayDoc({ khong_loi: true })) loi.push(`${o}: ${s.giay}s dưới nhịp đọc`);
  for (const k of ['bo_cuc', 'mo', 'ket', 'huong', 'muc_dich'] as const) if (!s[k].trim()) loi.push(`${o}: thiếu ${k}`);
});
for (const c of kb.canh) {
  const o = `cảnh ${c.so}`;
  coMa(c.mau.anh_sang, 'anh_sang', o); coMa(c.mau.mau, 'mau', o); coMa(c.nhac, 'nhac', o);
  for (const [nhom, ds] of [['nhan_vat', c.boc_tach.nhan_vat], ['dao_cu', c.boc_tach.dao_cu], ['boi_canh', c.boc_tach.boi_canh]] as const)
    for (const t of ds) if (!kb.anchor_phim[nhom].includes(t)) loi.push(`${o}: "${t}" không phải anchor ${nhom} của phim`);
  if (!c.kich_ban.length) loi.push(`${o}: thiếu kịch bản`);
}
loi.push(...kiemNhipHinh(shots.map((s, i) => ({ thu_tu: i + 1, ky_thuat: { co_canh: s.co, chuyen_dong: s.may?.chuyen_dong } }))));
if (loi.length) { console.error(loi.join('\n')); process.exit(1); }

const ten = (k: string, n: NhomKyThuat) => kyThuat(k, n)!.ten.replace(/\s*\(.*\)$/, '');
const tenLuat = (k: string) => luatDung(k)!.ten.replace(/\s*\(.*\)$/, '');
const tong = shots.reduce((a, s) => a + s.giay, 0);

// ── 1. KỊCH BẢN thuần cho ô Kịch bản của tập (screenplay — không máy, không số shot)
const md = [
  `**${kb.ten.toUpperCase()}**`, `*Tango & Lint — Tập ${kb.tap} · phim không lời · ~${Math.round(tong)} giây*`, '',
  ...kb.canh.flatMap((c) => ['---', `**CẢNH ${c.so}**`, `**NỘI. ${c.noi.toUpperCase()} – ${c.luc.toUpperCase()}**`, '',
    ...c.kich_ban.flatMap((d) => d.loai === 'nv' ? [`${d.ten}`, ...(d.dien ? [`  (${d.dien})`] : []), `  ${d.loi}`, ''] : d.loai === 'chuyen' ? [`${' '.repeat(40)}${d.chu}`, ''] : d.loai === 'am' ? [`*${d.chu}*`, ''] : [d.chu, ''])]),
  '**HẾT**',
].join('\n');
writeFileSync(raMd, md);

// ── 2. Trang 7 tab
const e = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let so = 0; let t = 0;
const moc = shots.map((s) => { const a = t; t += s.giay; return [a, t] as const; });
const soCua = new Map(shots.map((s, i) => [s, i + 1]));

const tabKb = kb.canh.map((c) => `
    <section class="sp-canh">
      <p class="sp-dau">${c.so}. NỘI. ${e(c.noi.toUpperCase())} – ${e(c.luc.toUpperCase())}</p>
      ${c.kich_ban.map((d) => d.loai === 'nv'
        ? `<div class="sp-thoai"><p class="sp-ten">${e(d.ten)}</p>${d.dien ? `<p class="sp-dien">(${e(d.dien)})</p>` : ''}<p class="sp-loi">${e(d.loi)}</p></div>`
        : d.loai === 'chuyen' ? `<p class="sp-chuyen">${e(d.chu)}</p>` : d.loai === 'am' ? `<p class="sp-am">${e(d.chu)}</p>` : `<p class="sp-hd">${e(d.chu)}</p>`).join('')}
    </section>`).join('');

const tabDd = kb.canh.map((c) => `
    <section class="khoi">
      <h3>Cảnh ${c.so} · ${e(c.ten)}</h3>
      <dl class="cap">
        <div><dt>Mục tiêu</dt><dd>${e(c.dao_dien.muc_tieu)}</dd></div>
        <div><dt>Xung đột</dt><dd>${e(c.dao_dien.xung_dot)}</dd></div>
        <div><dt>Giá trị đổi</dt><dd>${e(c.doi)}</dd></div>
        <div><dt>Điểm xoay</dt><dd>${e(c.xoay)}</dd></div>
      </dl>
      <p class="nhan-nho">Nhịp (hành động → phản ứng)</p>
      <ol class="nhip">${c.dao_dien.nhip.map((n) => `<li>${e(n)}</li>`).join('')}</ol>
    </section>`).join('');

const the = (ds: string[], lop: string) => ds.length ? ds.map((x) => `<span class="the ${lop}">${e(x)}</span>`).join('') : '<span class="trong">—</span>';
const tabBt = `
    <div class="cuon"><table class="bang">
      <thead><tr><th>Cảnh</th><th>Bối cảnh</th><th>Nhân vật</th><th>Đạo cụ</th><th>Hiệu ứng</th><th>Shot</th><th>Giây</th></tr></thead>
      <tbody>${kb.canh.map((c) => `<tr>
        <td><b>${c.so}</b> ${e(c.ten)}<br><span class="phu">${e(c.luc)}</span></td>
        <td>${the(c.boc_tach.boi_canh, 'bc')}</td><td>${the(c.boc_tach.nhan_vat, 'nv')}</td><td>${the(c.boc_tach.dao_cu, 'dc')}</td>
        <td>${c.boc_tach.hieu_ung.length ? `<ul class="gon">${c.boc_tach.hieu_ung.map((h) => `<li>${e(h)}</li>`).join('')}</ul>` : '<span class="trong">—</span>'}</td>
        <td class="so">${c.shot.length}</td><td class="so">${c.shot.reduce((a, s) => a + s.giay, 0)}</td></tr>`).join('')}
      </tbody></table></div>
    <p class="phu">Màu thẻ: <span class="the bc">bối cảnh</span> <span class="the nv">nhân vật</span> <span class="the dc">đạo cụ</span> — đều là anchor có ảnh mẫu trong tab Phim của studio; keyframe tham chiếu đúng các ảnh đó.</p>`;

const tabSl = `
    <div class="cuon"><table class="bang sl">
      <thead><tr><th>#</th><th>Cảnh</th><th>Giây</th><th>Vai kể</th><th>Cỡ cảnh</th><th>Góc</th><th>Chuyển động</th><th>Ống kính</th><th>Thấy gì</th><th>Máy làm gì · vì sao</th><th>Sang shot sau</th><th>Luật</th></tr></thead>
      <tbody>${kb.canh.map((c) => c.shot.map((s) => { so++; const [a, b] = moc[so - 1]!; return `<tr>
        <td class="so"><b>${so}</b></td><td class="so">${c.so}</td><td class="so">${s.giay}<br><span class="phu">${a.toFixed(1)}–${b.toFixed(1)}</span></td>
        <td>${e(ten(s.vai, 'vai'))}</td><td>${e(ten(s.co, 'co_canh'))}</td><td>${e(ten(s.may.goc, 'goc'))}</td><td>${e(ten(s.may.chuyen_dong, 'chuyen_dong'))}</td><td>${e(ten(s.may.ong_kinh, 'ong_kinh'))}</td>
        <td class="rong">${e(s.thay)}</td><td class="rong">${e(s.may.mo_ta)}</td><td>${e(ten(s.may.chuyen_canh, 'chuyen_canh'))}</td>
        <td>${s.luat.map((l) => `<span class="the luat" title="${e(luatDung(l)!.luat)}">${e(tenLuat(l))}</span>`).join('')}</td></tr>`; }).join('')).join('')}
      </tbody></table></div>`;

const tabLt = `
    <p class="phu">Trạng thái kết của shot trước phải khớp trạng thái mở của shot sau. Bốn cột này viết tiếng Anh vì đi thẳng vào prompt ảnh và video.</p>
    <div class="cuon"><table class="bang lt">
      <thead><tr><th>#</th><th>Trạng thái mở</th><th>Trạng thái kết</th><th>Hướng nhìn · hướng đi</th><th>Bố cục (tiền / trung / hậu)</th><th>Motif · gài</th></tr></thead>
      <tbody>${shots.map((s, i) => `<tr><td class="so"><b>${i + 1}</b></td><td lang="en">${e(s.mo)}</td><td lang="en">${e(s.ket)}</td><td lang="en">${e(s.huong)}</td><td lang="en">${e(s.bo_cuc)}</td><td>${e(s.motif || '—')}</td></tr>`).join('')}
      </tbody></table></div>`;

const MAU_DAI: Record<string, string> = { am: 'linear-gradient(90deg,#f2b35b,#e07b39)', lanh: 'linear-gradient(90deg,#4a6b8a,#1f3448)', teal_cam: 'linear-gradient(90deg,#1d6f74,#e07b39)', xanh_benh: 'linear-gradient(90deg,#3f6b5a,#1c2f2a)', pastel: 'linear-gradient(90deg,#f5d0d8,#cfe3f2)', tu_nhien: 'linear-gradient(90deg,#b7a68a,#6f7f63)', tuong_phan_cao: 'linear-gradient(90deg,#111,#f4f4f4)', den_trang: 'linear-gradient(90deg,#222,#bbb)' };
const tabMau = `
    <p class="phu">${e(kb.cung)}</p>
    <div class="dai-mau">${kb.canh.map((c) => `
      <div class="o-mau"><div class="vet" style="background:${MAU_DAI[c.mau.mau] ?? '#777'}"></div>
        <p class="tieu"><b>${c.so}. ${e(c.ten)}</b></p>
        <p class="phu">${e(ten(c.mau.anh_sang, 'anh_sang'))} · ${e(ten(c.mau.mau, 'mau'))}</p>
        <p>${e(c.mau.mo_ta)}</p></div>`).join('')}
    </div>`;

let so2 = 0;
const tabAm = `
    <div class="cuon"><table class="bang">
      <thead><tr><th>#</th><th>Mốc</th><th>Âm hiệu · tiếng động · khoảng lặng</th><th>Nhạc của cảnh</th></tr></thead>
      <tbody>${kb.canh.map((c) => c.shot.map((s, j) => { so2++; const [a, b] = moc[so2 - 1]!; return `<tr><td class="so"><b>${so2}</b></td><td class="so">${a.toFixed(1)}–${b.toFixed(1)}</td><td>${e(s.am)}</td>${j === 0 ? `<td rowspan="${c.shot.length}">${e(ten(c.nhac, 'nhac'))}<br><span class="phu">cảnh ${c.so}</span></td>` : ''}</tr>`; }).join('')).join('')}
      </tbody></table></div>`;
void soCua;

const TAB = [['kich-ban', 'Kịch bản', tabKb], ['dao-dien', 'Phân tích cảnh', tabDd], ['boc-tach', 'Bóc tách', tabBt], ['shot-list', 'Shot list', tabSl], ['lien-tuc', 'Bảng liên tục', tabLt], ['mau', 'Color script', tabMau], ['am', 'Âm thanh', tabAm]] as const;
const AI: Record<string, string> = { 'kich-ban': 'Biên kịch · chỉ có truyện, không ghi máy', 'dao-dien': 'Đạo diễn · mỗi cảnh đổi giá trị qua một điểm xoay', 'boc-tach': 'Sản xuất · mọi thứ cần dựng, ref đúng anchor', 'shot-list': 'Đạo diễn + quay phim · máy cho từng shot', 'lien-tuc': 'Thư ký trường quay · nối shot với shot', mau: 'Ánh sáng + màu theo cung cảm xúc', am: 'Âm thanh · cue sheet' };

const html = `<title>${e(kb.ten)} · Tập ${kb.tap}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;700;800&family=Courier+Prime:wght@400;700&display=swap">
<style>
/* Bố cục: bìa hồ sơ tiền kỳ của xưởng — bảy tài liệu là bảy tab (mỗi tab ghi rõ của ai), kịch bản đặt kiểu trang máy chữ chuẩn screenplay,
   các bảng sản xuất kiểu shot list. */
:root {
  --nen: #f2f1ee; --giay: #fffefb; --chu: #22201d; --chu-2: #6b655d; --vien: #dedad3; --cam: #c8611c; --cam-nhat: #faeadf; --xanh: #2b5c88; --tim: #6a4c93; --la: #3f7a4a;
  --f-tieu-de: "Be Vietnam Pro", system-ui, sans-serif; --f-than: "Be Vietnam Pro", system-ui, sans-serif; --f-may: "Courier Prime", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --nen: #16140f; --giay: #1f1c17; --chu: #ebe6dd; --chu-2: #a39b90; --vien: #38322a; --cam: #ef8a3f; --cam-nhat: #3a2615; --xanh: #8db9e2; --tim: #b79be0; --la: #8cc797; color-scheme: dark; } }
:root[data-theme="dark"] { --nen: #16140f; --giay: #1f1c17; --chu: #ebe6dd; --chu-2: #a39b90; --vien: #38322a; --cam: #ef8a3f; --cam-nhat: #3a2615; --xanh: #8db9e2; --tim: #b79be0; --la: #8cc797; color-scheme: dark; }
body { background: var(--nen); color: var(--chu); font-family: var(--f-than); font-size: 15px; line-height: 1.55; }
.trang { max-width: 1240px; margin: 0 auto; padding-inline: 16px; padding-block: 26px 72px; }
h1 { font-family: var(--f-tieu-de); font-weight: 800; font-size: clamp(28px, 5vw, 40px); margin: 0; letter-spacing: -0.015em; }
.phu { color: var(--chu-2); font-size: 13px; margin: 4px 0; font-variant-numeric: tabular-nums; }
.kinh { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin: 14px 0 6px; }
.kinh div { background: var(--giay); border: 1px solid var(--vien); border-radius: 8px; padding: 10px 12px; min-width: 0; }
.kinh dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--cam); font-weight: 700; } .kinh dd { margin: 2px 0 0; font-size: 13.5px; }
.tabs { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 2; background: var(--nen); display: flex; gap: 4px; overflow-x: auto; padding-block: 10px; border-bottom: 1px solid var(--vien); margin-top: 14px; }
.tabs button { font: inherit; font-size: 13.5px; white-space: nowrap; border: 1px solid var(--vien); background: var(--giay); color: var(--chu-2); padding: 6px 12px; border-radius: 999px; cursor: pointer; }
.tabs button[aria-selected="true"] { background: var(--chu); color: var(--giay); border-color: var(--chu); }
.tabs button:focus-visible { outline: 2px solid var(--cam); outline-offset: 2px; }
.ai { margin: 14px 0 10px; font-size: 13px; color: var(--cam); font-weight: 700; letter-spacing: 0.02em; }
/* screenplay */
.sp { background: var(--giay); border: 1px solid var(--vien); border-radius: 4px; max-width: 760px; margin: 0 auto; padding: 40px clamp(16px, 7vw, 72px); font-family: var(--f-may); font-size: 15px; line-height: 1.5; }
.sp-tieu { text-align: center; font-weight: 700; margin: 0 0 4px; } .sp-phu { text-align: center; margin: 0 0 30px; color: var(--chu-2); }
.sp-canh { margin-bottom: 26px; } .sp-dau { font-weight: 700; margin: 0 0 12px; }
.sp-hd { margin: 0 0 12px; } .sp-am { margin: 0 0 12px; font-style: italic; color: var(--chu-2); }
.sp-thoai { margin: 0 auto 12px; max-width: 34ch; } .sp-thoai p { margin: 0; } .sp-ten { text-align: center; font-weight: 700; } .sp-dien { text-align: center; color: var(--chu-2); } .sp-loi { text-align: center; }
.sp-chuyen { text-align: right; font-weight: 700; margin: 0 0 12px; }
/* bảng */
.cuon { overflow-x: auto; border: 1px solid var(--vien); border-radius: 8px; background: var(--giay); }
.bang { border-collapse: collapse; width: 100%; font-size: 13px; }
.bang th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--chu-2); background: var(--nen); padding: 8px 10px; border-bottom: 1px solid var(--vien); position: sticky; top: 0; white-space: nowrap; }
.bang td { padding: 8px 10px; border-bottom: 1px solid var(--vien); vertical-align: top; }
.bang tr:last-child td { border-bottom: 0; }
.bang td.so { font-variant-numeric: tabular-nums; white-space: nowrap; }
.sl td { min-width: 96px; } .sl td.rong { min-width: 240px; } .lt td { min-width: 200px; } .lt td.so { min-width: 0; }
td[lang="en"] { font-family: var(--f-may); font-size: 12.5px; }
.the { display: inline-block; font-size: 12px; border-radius: 999px; padding: 1px 8px; margin: 0 4px 4px 0; border: 1px solid currentColor; white-space: nowrap; }
.the.bc { color: var(--la); } .the.nv { color: var(--cam); } .the.dc { color: var(--xanh); } .the.luat { color: var(--tim); cursor: help; }
.trong { color: var(--chu-2); } ul.gon { margin: 0; padding-left: 16px; }
/* đạo diễn */
.khoi { background: var(--giay); border: 1px solid var(--vien); border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; }
.khoi h3 { margin: 0 0 8px; font-size: 16px; }
.cap { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin: 0; }
.cap div { border-left: 3px solid var(--cam); background: var(--cam-nhat); padding: 6px 10px; border-radius: 0 6px 6px 0; min-width: 0; }
.cap dt { font-size: 11px; font-weight: 700; color: var(--chu-2); text-transform: uppercase; letter-spacing: 0.06em; } .cap dd { margin: 0; font-size: 14px; }
.nhan-nho { font-size: 12px; color: var(--chu-2); margin: 10px 0 4px; } .nhip { margin: 0; padding-left: 20px; font-size: 14px; }
/* color script */
.dai-mau { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
.o-mau { background: var(--giay); border: 1px solid var(--vien); border-radius: 8px; overflow: hidden; min-width: 0; }
.o-mau .vet { height: 72px; } .o-mau p { margin: 6px 12px; font-size: 13px; } .o-mau .tieu { margin-top: 10px; }
[hidden] { display: none !important; }
</style>
<div class="trang">
  <h1>${e(kb.ten)}</h1>
  <p class="phu">Tango &amp; Lint · Tập ${kb.tap} · không lời · 9:16 · ${kb.canh.length} cảnh · ${shots.length} shot · ~${Math.round(tong)} giây · hồ sơ tiền kỳ, chưa sinh hình</p>
  <dl class="kinh">
    <div><dt>Thời gian</dt><dd>${e(kb.thoi_gian)}</dd></div>
    <div><dt>Đường đi trên bàn</dt><dd>${e(kb.duong_di)}</dd></div>
    <div><dt>Motif</dt><dd>${e(kb.motif)}</dd></div>
  </dl>
  <div class="tabs" role="tablist">${TAB.map(([id, chu], i) => `<button id="t-${id}" role="tab" aria-selected="${i === 0}" aria-controls="p-${id}" data-tab="${id}">${i + 1}. ${chu}</button>`).join('')}</div>
  ${TAB.map(([id, , noi], i) => `<section id="p-${id}" role="tabpanel" aria-labelledby="t-${id}"${i ? ' hidden' : ''}>
    <p class="ai">${AI[id]}</p>
    ${id === 'kich-ban' ? `<div class="sp"><p class="sp-tieu">${e(kb.ten.toUpperCase())}</p><p class="sp-phu">Tango &amp; Lint — Tập ${kb.tap}</p>${noi}<p class="sp-chuyen">HẾT</p></div>` : noi}
  </section>`).join('')}
  <p class="phu" style="margin-top:24px">Rê chuột lên nhãn luật để đọc nội dung luật. Thư viện: ${LUAT_DUNG_CANH.length} luật dựng cảnh.</p>
</div>
<script>
const nut = [...document.querySelectorAll('[data-tab]')];
function mo(id) { nut.forEach((b) => { const on = b.dataset.tab === id; b.setAttribute('aria-selected', on); document.getElementById('p-' + b.dataset.tab).hidden = !on; }); }
nut.forEach((b) => b.addEventListener('click', () => { mo(b.dataset.tab); try { history.replaceState(null, '', '#' + b.dataset.tab); } catch (_) {} }));
const h = location.hash.slice(1); if (nut.some((b) => b.dataset.tab === h)) mo(h);
</script>
`;
writeFileSync(raHtml, html);
console.log(`${kb.canh.length} cảnh · ${shots.length} shot · ${tong}s`);

// KỊCH BẢN THEO THẺ SHOT (14/10/2026): một file JSON kịch bản (cảnh = nơi + thời điểm + giá trị đổi + điểm xoay; mỗi shot = thẻ đủ ô
// kieu.ts › DanDung + vai kể + cỡ cảnh + mã luật thư viện) → (1) chữ kịch bản cho ô Kịch bản của tập (có dòng "Shot dự kiến" để tách cảnh
// bám theo) và (2) trang HTML để đọc/duyệt. Nhãn vai/cỡ cảnh/luật lấy THẲNG từ thư viện (dien-anh.ts, luat-dung.ts) — mã sai là báo lỗi.
// 0đ, không gọi model:  node_modules/.bin/tsx apps/xuong-video/scripts/kich-ban-the.mts <kb.json> <ra.md> <ra.html>
import { readFileSync, writeFileSync } from 'node:fs';
import { kyThuat } from '../src/lib/xuong-video/dien-anh';
import { luatDung, LUAT_DUNG_CANH } from '../src/lib/xuong-video/luat-dung';
import { giayDoc, kiemNhipHinh } from '../src/lib/xuong-video/nhip-hinh';

/** may = dòng MÁY của thẻ (khuôn shot list của ngành): góc, chuyển động, ống kính, chuyển cảnh sang shot sau — mã thư viện; mo_ta = máy làm gì và vì sao. */
type May = { goc: string; chuyen_dong: string; ong_kinh: string; chuyen_canh: string; mo_ta: string };
type Shot = { may: May; vai: string; co: string; giay: number; luat: string[]; thay: string; bo_cuc: string; mo: string; ket: string; huong: string; am: string; muc_dich: string; motif: string };
type Canh = { so: number; ten: string; noi: string; luc: string; doi: string; xoay: string; shot: Shot[] };
type Kb = { ten: string; tap: number; thoi_gian: string; duong_di: string; motif: string; cung: string; canh: Canh[] };

const [vao, raMd, raHtml] = process.argv.slice(2);
if (!vao || !raMd || !raHtml) { console.error('cần <kb.json> <ra.md> <ra.html>'); process.exit(1); }
const kb = JSON.parse(readFileSync(vao, 'utf8')) as Kb;

// Kiểm mã theo thư viện + nhịp đọc phim không lời — sai thì dừng, không sinh bản lệch thư viện.
const loi: string[] = []; let n = 0;
for (const c of kb.canh) for (const s of c.shot) {
  n++;
  if (!kyThuat(s.vai, 'vai')) loi.push(`shot ${n}: vai "${s.vai}" không có trong thư viện`);
  if (!kyThuat(s.co, 'co_canh')) loi.push(`shot ${n}: cỡ cảnh "${s.co}" không có trong thư viện`);
  for (const k of ['goc', 'chuyen_dong', 'ong_kinh', 'chuyen_canh'] as const) if (!kyThuat(s.may?.[k], k)) loi.push(`shot ${n}: ${k} "${s.may?.[k]}" không có trong thư viện`);
  if (!s.may?.mo_ta?.trim()) loi.push(`shot ${n}: thiếu mô tả máy`);
  for (const l of s.luat) if (!luatDung(l)) loi.push(`shot ${n}: luật "${l}" không có trong thư viện`);
  if (s.giay < giayDoc({ khong_loi: true })) loi.push(`shot ${n}: ${s.giay}s dưới nhịp đọc`);
  for (const k of ['bo_cuc', 'mo', 'ket', 'huong', 'muc_dich'] as const) if (!s[k].trim()) loi.push(`shot ${n}: thiếu ${k}`);
}
// Nhịp hình cả tập (trùng cỡ cảnh + chuyển động liền nhau, quá nhiều shot máy đứng yên) — cùng cổng với studio.
loi.push(...kiemNhipHinh(kb.canh.flatMap((c) => c.shot).map((s, i) => ({ thu_tu: i + 1, ky_thuat: { co_canh: s.co, chuyen_dong: s.may?.chuyen_dong } }))));
if (loi.length) { console.error(loi.join('\n')); process.exit(1); }

const tenVai = (k: string) => kyThuat(k, 'vai')!.ten.replace(/\s*\(.*\)$/, '');
const tenCo = (k: string) => kyThuat(k, 'co_canh')!.ten.replace(/\s*\(.*\)$/, '');
const tenKt = (k: string, n: 'goc' | 'chuyen_dong' | 'ong_kinh' | 'chuyen_canh') => kyThuat(k, n)!.ten.replace(/\s*\(.*\)$/, '');
const tenLuat = (k: string) => luatDung(k)!.ten.replace(/\s*\(.*\)$/, '');
const tong = kb.canh.flatMap((c) => c.shot).reduce((a, s) => a + s.giay, 0);
const soShot = kb.canh.reduce((a, c) => a + c.shot.length, 0);

// ── 1. Chữ kịch bản cho DB (tách cảnh đọc "Shot dự kiến")
let so = 0;
const md = [
  `**${kb.ten.toUpperCase()}**`, `*Tập ${kb.tap} · không lời · 9:16 · ${soShot} shot · ~${Math.round(tong)} giây · kịch bản theo thẻ shot*`, '',
  `THỜI GIAN: ${kb.thoi_gian}`, `ĐƯỜNG ĐI: ${kb.duong_di}`, `MOTIF: ${kb.motif}`, `CUNG CẢM XÚC: ${kb.cung}`, '',
  ...kb.canh.flatMap((c) => [
    '---', `**CẢNH ${c.so} — ${c.ten.toUpperCase()}**`, `**INT. ${c.noi} – ${c.luc}**`, `*Giá trị đổi: ${c.doi}. Điểm xoay: ${c.xoay}*`, '', 'Shot dự kiến:',
    ...c.shot.map((s) => { so++; return [
      `${so}. vai=${s.vai} · co_canh=${s.co} · goc=${s.may.goc} · chuyen_dong=${s.may.chuyen_dong} · ong_kinh=${s.may.ong_kinh} · chuyen_canh=${s.may.chuyen_canh} · ${s.giay}s · luat=${s.luat.join(',')}`,
      `   Máy: ${s.may.mo_ta}`,
      `   Thấy: ${s.thay}`, `   bo_cuc: ${s.bo_cuc}`, `   mo: ${s.mo}`, `   ket: ${s.ket}`, `   huong: ${s.huong}`,
      `   Âm/ánh sáng: ${s.am}`, `   muc_dich: ${s.muc_dich}`, ...(s.motif ? [`   motif: ${s.motif}`] : []),
    ].join('\n'); }), '',
  ]),
  `**HẾT TẬP ${kb.tap}**`,
].join('\n');
writeFileSync(raMd, md);

// ── 2. Trang đọc
const e = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let sh = 0; let t = 0;
const canhHtml = kb.canh.map((c) => `
  <section class="canh" id="canh-${c.so}">
    <header class="dau-canh">
      <p class="nhan">Cảnh ${c.so} · ${e(c.noi)}</p>
      <h2>${e(c.ten)}</h2>
      <p class="luc">${e(c.luc)}</p>
      <dl class="doi"><div><dt>Giá trị đổi</dt><dd>${e(c.doi)}</dd></div><div><dt>Điểm xoay</dt><dd>${e(c.xoay)}</dd></div></dl>
    </header>
    <ol class="the-ds">${c.shot.map((s) => { sh++; const tu = t; t += s.giay; return `
      <li class="the">
        <div class="cot-trai">
          <span class="so">${sh}</span>
          <span class="giay">${s.giay}s</span>
          <span class="moc">${tu.toFixed(1)}–${t.toFixed(1)}</span>
        </div>
        <div class="noi-dung">
          <p class="vai"><b>${e(tenVai(s.vai))}</b> · ${e(tenCo(s.co))}</p>
          <p class="thay">${e(s.thay)}</p>
          <dl class="o">
            <div class="may"><dt>Máy</dt><dd><b>${e(tenKt(s.may.goc, 'goc'))} · ${e(tenKt(s.may.chuyen_dong, 'chuyen_dong'))} · ${e(tenKt(s.may.ong_kinh, 'ong_kinh'))}</b>${s.may.chuyen_canh !== 'cat' ? ` · sang shot sau: ${e(tenKt(s.may.chuyen_canh, 'chuyen_canh'))}` : ''}<br>${e(s.may.mo_ta)}</dd></div>
            <div><dt>Mở</dt><dd lang="en">${e(s.mo)}</dd></div>
            <div><dt>Kết</dt><dd lang="en">${e(s.ket)}</dd></div>
            <div><dt>Bố cục</dt><dd lang="en">${e(s.bo_cuc)}</dd></div>
            <div><dt>Hướng</dt><dd lang="en">${e(s.huong)}</dd></div>
            <div><dt>Âm · sáng</dt><dd>${e(s.am)}</dd></div>
            <div class="cam"><dt>Cảm xúc</dt><dd>${e(s.muc_dich)}</dd></div>
            ${s.motif ? `<div><dt>Motif · gài</dt><dd>${e(s.motif)}</dd></div>` : ''}
          </dl>
          <p class="luat">${s.luat.map((l) => `<span title="${e(luatDung(l)!.luat)}">${e(tenLuat(l))}</span>`).join('')}</p>
        </div>
      </li>`; }).join('')}
    </ol>
  </section>`).join('');

const html = `<title>${e(kb.ten)} · Tập ${kb.tap}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;700;800&family=Courier+Prime:wght@400;700&display=swap">
<style>
/* Bố cục: kịch bản phân cảnh của xưởng stop-motion — đầu trang là "bảng kinh thánh" của tập, mỗi cảnh một khối có dải giá trị đổi, mỗi shot một thẻ
   với cột số + giây + mốc thời gian bên trái như tờ shot list; chữ đi vào model đặt kiểu máy chữ. */
:root {
  --nen: #f4f2ee; --giay: #fffdf9; --chu: #23201c; --chu-2: #6a625a; --vien: #e2ddd5; --cam: #d2691e; --cam-nhat: #fbe9dc; --xanh: #2c5d8a;
  --f-tieu-de: "Be Vietnam Pro", system-ui, sans-serif; --f-than: "Be Vietnam Pro", system-ui, sans-serif; --f-may: "Courier Prime", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --nen: #17140f; --giay: #211d17; --chu: #ece6dc; --chu-2: #a89e92; --vien: #3a332a; --cam: #f08a3c; --cam-nhat: #3a2614; --xanh: #8bb8e3; color-scheme: dark; } }
:root[data-theme="dark"] { --nen: #17140f; --giay: #211d17; --chu: #ece6dc; --chu-2: #a89e92; --vien: #3a332a; --cam: #f08a3c; --cam-nhat: #3a2614; --xanh: #8bb8e3; color-scheme: dark; }
body { background: var(--nen); color: var(--chu); font-family: var(--f-than); font-size: 15px; line-height: 1.55; }
.trang { max-width: 920px; margin: 0 auto; padding-inline: 16px; padding-block: 28px 72px; }
.mo-dau h1 { font-family: var(--f-tieu-de); font-weight: 800; font-size: clamp(28px, 5vw, 42px); margin: 0; letter-spacing: -0.015em; text-wrap: balance; }
.mo-dau .phu { color: var(--chu-2); margin: 4px 0 18px; font-variant-numeric: tabular-nums; }
.kinh { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin: 0 0 8px; }
.kinh div { background: var(--giay); border: 1px solid var(--vien); border-radius: 8px; padding: 10px 12px; min-width: 0; }
.kinh dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--cam); font-weight: 700; margin-bottom: 3px; }
.kinh dd { margin: 0; font-size: 13.5px; }
nav.muc { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 18px 0 0; font-size: 13px; position: sticky; top: env(safe-area-inset-top, 0px); background: var(--nen); padding-block: 10px; border-bottom: 1px solid var(--vien); z-index: 2; }
nav.muc a { color: var(--chu-2); text-decoration: none; } nav.muc a:hover, nav.muc a:focus-visible { color: var(--cam); text-decoration: underline; }
.canh { margin-top: 34px; scroll-margin-top: 56px; }
.dau-canh .nhan { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--cam); font-weight: 700; }
.dau-canh h2 { font-family: var(--f-tieu-de); font-size: 24px; font-weight: 800; margin: 2px 0 0; text-wrap: balance; }
.dau-canh .luc { font-family: var(--f-may); color: var(--chu-2); margin: 2px 0 10px; font-size: 14px; }
.doi { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px; margin: 0 0 12px; }
.doi div { border-left: 3px solid var(--cam); background: var(--cam-nhat); padding: 6px 10px; border-radius: 0 6px 6px 0; min-width: 0; }
.doi dt { font-size: 11px; font-weight: 700; color: var(--chu-2); text-transform: uppercase; letter-spacing: 0.06em; }
.doi dd { margin: 0; font-size: 14px; }
.the-ds { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.the { display: grid; grid-template-columns: 64px minmax(0, 1fr); background: var(--giay); border: 1px solid var(--vien); border-radius: 8px; overflow: hidden; }
.cot-trai { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 12px 4px; border-right: 1px dashed var(--vien); font-variant-numeric: tabular-nums; }
.cot-trai .so { font-family: var(--f-tieu-de); font-weight: 800; font-size: 22px; line-height: 1; }
.cot-trai .giay { font-size: 13px; font-weight: 700; color: var(--cam); }
.cot-trai .moc { font-size: 10.5px; color: var(--chu-2); }
.noi-dung { padding: 10px 14px 12px; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.vai { margin: 0; font-size: 13px; color: var(--chu-2); } .vai b { color: var(--xanh); }
.thay { margin: 0; font-size: 15px; }
.o { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 3px 10px; margin: 2px 0 0; font-size: 13px; }
.o div { display: contents; }
.o dt { color: var(--chu-2); font-size: 12px; padding-top: 1px; }
.o dd { margin: 0; overflow-wrap: anywhere; }
.o dd[lang="en"] { font-family: var(--f-may); font-size: 12.5px; }
.o .cam dd { font-weight: 600; }
.o .may dd b { color: var(--xanh); font-weight: 600; }
.luat { margin: 4px 0 0; display: flex; flex-wrap: wrap; gap: 4px; }
.luat span { font-size: 11.5px; border: 1px solid var(--vien); border-radius: 999px; padding: 1px 8px; color: var(--chu-2); cursor: help; }
@media (max-width: 520px) { .the { grid-template-columns: 1fr; } .cot-trai { flex-direction: row; justify-content: flex-start; gap: 10px; border-right: 0; border-bottom: 1px dashed var(--vien); padding: 8px 14px; } .o { grid-template-columns: 1fr; } .o dt { padding-top: 6px; } }
</style>
<div class="trang">
  <header class="mo-dau">
    <h1>${e(kb.ten)}</h1>
    <p class="phu">Tango &amp; Lint · Tập ${kb.tap} · không lời · 9:16 · ${kb.canh.length} cảnh · ${soShot} shot · ~${Math.round(tong)} giây · bản duyệt kịch bản (chưa sinh hình)</p>
    <dl class="kinh">
      <div><dt>Thời gian</dt><dd>${e(kb.thoi_gian)}</dd></div>
      <div><dt>Đường đi trên bàn</dt><dd>${e(kb.duong_di)}</dd></div>
      <div><dt>Motif</dt><dd>${e(kb.motif)}</dd></div>
      <div><dt>Cung cảm xúc</dt><dd>${e(kb.cung)}</dd></div>
    </dl>
  </header>
  <nav class="muc">${kb.canh.map((c) => `<a href="#canh-${c.so}">${c.so}. ${e(c.ten)}</a>`).join('')}</nav>
  ${canhHtml}
  <p class="phu" style="margin-top:28px">Rê chuột lên tên luật để đọc nội dung luật. Thư viện: ${LUAT_DUNG_CANH.length} luật dựng cảnh. Mở, Kết, Bố cục, Hướng viết tiếng Anh vì đi thẳng vào prompt ảnh và video. Dòng Máy: góc · chuyển động · ống kính (mã thư viện) và máy làm gì, vì sao.</p>
</div>
`;
writeFileSync(raHtml, html);
console.log(`${soShot} shot · ${tong}s · ${kb.canh.length} cảnh`);

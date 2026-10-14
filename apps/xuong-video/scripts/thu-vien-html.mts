// BẢN ĐỌC TIẾNG VIỆT của thư viện điện ảnh (14/10/2026 — anh: "thư viện thì thêm một bản tiếng Việt để xem"): sinh trang HTML THẲNG từ dữ
// liệu thư viện (luat-dung.ts + dien-anh.ts) nên luôn khớp đúng thứ Claude đang dùng; thư viện đổi thì chạy lại rồi đăng lại cùng file.
// Chỉ đọc, 0đ, không cần DB:  node_modules/.bin/tsx apps/xuong-video/scripts/thu-vien-html.mts <file ra.html>
import { writeFileSync } from 'node:fs';
import { LUAT_DUNG_CANH } from '../src/lib/xuong-video/luat-dung';
import { THU_VIEN, NHOM_KY_THUAT, THE_LOAI, CAU_TRUC } from '../src/lib/xuong-video/dien-anh';

const ra = process.argv[2];
if (!ra) { console.error('cần đường dẫn file ra'); process.exit(1); }
const e = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tenTl = (k: string) => THE_LOAI.find((t) => t.key === k)?.ten ?? k;
// "Tên việt (tên ngành)" → tách tên ngành ra dòng nhỏ
const tach = (s: string) => { const m = s.match(/^(.*?)\s*\(([^()]*)\)\s*$/); return m ? { viet: m[1]!, nganh: m[2]! } : { viet: s, nganh: '' }; };

const luat = LUAT_DUNG_CANH.map((l, i) => { const t = tach(l.ten); return `
      <article class="muc" data-tim="${e(`${l.key} ${l.ten} ${l.luat}`.toLowerCase())}">
        <header><span class="so">${i + 1}</span><h3>${e(t.viet)}</h3></header>
        ${t.nganh ? `<p class="nganh">${e(t.nganh)}</p>` : ''}
        <p>${e(l.luat)}</p>
        <footer><code>${e(l.key)}</code><span>Máy kiểm: ${e(l.may)}</span></footer>
      </article>`; }).join('');

const nhom = NHOM_KY_THUAT.map((n) => {
  const ds = THU_VIEN.filter((x) => x.nhom === n.key);
  if (!ds.length) return '';
  return `
    <section class="khoi" id="nhom-${n.key}">
      <h2>${e(n.ten)} <small>${ds.length}</small></h2>
      <div class="luoi">${ds.map((x) => { const t = tach(x.ten); return `
        <article class="muc nho" data-tim="${e(`${x.key} ${x.ten} ${x.mo_ta}`.toLowerCase())}">
          <h3>${e(t.viet)}</h3>
          ${t.nganh ? `<p class="nganh">${e(t.nganh)}</p>` : ''}
          <p>${e(x.mo_ta)}</p>
          <footer><code>${e(x.key)}</code><span>${x.the_loai === 'tat_ca' ? 'Mọi thể loại' : e(x.the_loai.map(tenTl).join(' · '))}</span></footer>
        </article>`; }).join('')}
      </div>
    </section>`;
}).join('');

const beat = Object.values(CAU_TRUC).map((c) => `
      <div class="beat"><h3>${e(c.ten)}</h3><ol>${c.beats.map((b) => `<li><b>${e(b.ten)}</b> — ${e(b.mo_ta)}</li>`).join('')}</ol></div>`).join('');

const muc = [`<a href="#luat">Luật dựng cảnh</a>`, ...NHOM_KY_THUAT.filter((n) => THU_VIEN.some((x) => x.nhom === n.key)).map((n) => `<a href="#nhom-${n.key}">${e(n.ten)}</a>`), `<a href="#beat">Khung beat</a>`].join('');

const html = `<title>Thư viện điện ảnh Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* Bố cục: sổ tay đạo diễn — thanh mục lục dính trên, luật dựng cảnh trước (cách kể), kỹ thuật sau (công cụ), tìm nhanh một ô. */
:root {
  --nen: #f3f5f7; --mat: #ffffff; --chu: #18202a; --chu-2: #4d5a68; --vien: #d8dee5; --nhan: #0d6e6e; --nhan-nhat: #e0f0ef;
  --f-tieu-de: "Be Vietnam Pro", system-ui, sans-serif; --f-than: "Be Vietnam Pro", system-ui, sans-serif; --f-ma: "JetBrains Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --nen: #12171d; --mat: #1a2129; --chu: #e6ebf0; --chu-2: #9aa7b4; --vien: #2b3540; --nhan: #5cc4c0; --nhan-nhat: #173232; color-scheme: dark; } }
:root[data-theme="dark"] { --nen: #12171d; --mat: #1a2129; --chu: #e6ebf0; --chu-2: #9aa7b4; --vien: #2b3540; --nhan: #5cc4c0; --nhan-nhat: #173232; color-scheme: dark; }
body { background: var(--nen); color: var(--chu); font-family: var(--f-than); font-size: 15px; line-height: 1.55; }
.trang { max-width: 1180px; margin: 0 auto; padding-inline: 16px; padding-block: 28px 64px; }
h1 { font-family: var(--f-tieu-de); font-weight: 800; font-size: clamp(26px, 4vw, 36px); letter-spacing: -0.01em; margin: 0 0 6px; text-wrap: balance; }
.dan { color: var(--chu-2); max-width: 68ch; margin: 0 0 18px; }
.thanh { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 2; background: var(--nen); padding-block: 10px; border-bottom: 1px solid var(--vien); display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; }
.thanh nav { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 13px; }
.thanh a { color: var(--chu-2); text-decoration: none; } .thanh a:hover, .thanh a:focus-visible { color: var(--nhan); text-decoration: underline; }
#tim { flex: 1 1 220px; min-width: 0; max-width: 340px; font: inherit; font-size: 14px; padding: 7px 10px; border: 1px solid var(--vien); border-radius: 6px; background: var(--mat); color: var(--chu); }
#tim:focus-visible { outline: 2px solid var(--nhan); outline-offset: 1px; }
h2 { font-family: var(--f-tieu-de); font-size: 20px; font-weight: 700; margin: 34px 0 12px; scroll-margin-top: 70px; }
h2 small { font-family: var(--f-ma); font-size: 12px; color: var(--chu-2); font-weight: 400; margin-left: 6px; }
.khoi { scroll-margin-top: 70px; }
.luoi { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.luoi.rong { grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); }
.muc { background: var(--mat); border: 1px solid var(--vien); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.muc header { display: flex; gap: 10px; align-items: baseline; }
.muc .so { font-family: var(--f-ma); font-size: 12px; color: var(--nhan); font-weight: 500; min-width: 1.6em; }
.muc h3 { margin: 0; font-size: 15px; font-weight: 700; line-height: 1.35; }
.muc.nho h3 { font-size: 14px; }
.muc p { margin: 0; font-size: 13.5px; color: var(--chu); }
.muc .nganh { font-family: var(--f-ma); font-size: 11.5px; color: var(--chu-2); }
.muc footer { margin-top: auto; padding-top: 4px; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; font-size: 12px; color: var(--chu-2); }
code { font-family: var(--f-ma); font-size: 11.5px; background: var(--nhan-nhat); color: var(--nhan); padding: 1px 6px; border-radius: 4px; }
.beat { background: var(--mat); border: 1px solid var(--vien); border-radius: 8px; padding: 12px 14px; }
.beat h3 { margin: 0 0 6px; font-size: 14px; } .beat ol { margin: 0; padding-left: 20px; font-size: 13.5px; } .beat li { margin: 2px 0; }
.trong { color: var(--chu-2); font-size: 14px; } [hidden] { display: none !important; }
</style>
<div class="trang">
  <h1>Thư viện điện ảnh của Studio</h1>
  <p class="dan">Bản đọc tiếng Việt, sinh thẳng từ thư viện Claude đang dùng. Khi viết kịch bản, tách cảnh và xem thử, mỗi shot phải ghi <b>mã luật</b> và <b>mã kỹ thuật</b> (ô chữ xanh) mà nó thực hiện. ${LUAT_DUNG_CANH.length} luật dựng cảnh · ${THU_VIEN.length} kỹ thuật · ${THE_LOAI.length} thể loại.</p>
  <div class="thanh"><input id="tim" type="search" placeholder="Tìm: phản ứng, trục 180, toàn cảnh…" aria-label="Tìm trong thư viện"><nav>${muc}</nav></div>
  <p class="trong" id="khong-thay" hidden>Không có mục nào khớp.</p>
  <section class="khoi" id="luat">
    <h2>Luật dựng cảnh <small>${LUAT_DUNG_CANH.length}</small></h2>
    <div class="luoi rong">${luat}
    </div>
  </section>
  ${nhom}
  <section class="khoi" id="beat">
    <h2>Khung beat theo loại phim <small>${Object.keys(CAU_TRUC).length}</small></h2>
    <div class="luoi rong">${beat}
    </div>
  </section>
</div>
<script>
const o = document.getElementById('tim');
o.addEventListener('input', () => {
  const q = o.value.trim().toLowerCase(); let con = 0;
  document.querySelectorAll('[data-tim]').forEach((m) => { const ok = !q || m.dataset.tim.includes(q); m.hidden = !ok; if (ok) con++; });
  document.querySelectorAll('.khoi').forEach((k) => { const c = k.querySelectorAll('[data-tim]'); if (c.length) k.hidden = [...c].every((m) => m.hidden); });
  document.getElementById('khong-thay').hidden = con > 0;
});
</script>
`;
writeFileSync(ra, html);
console.log(`đã ghi ${ra} — ${LUAT_DUNG_CANH.length} luật, ${THU_VIEN.length} kỹ thuật`);

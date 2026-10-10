// Đo "chữ dính viền" trên cty.on.tc (anh chửi 10/10/2026, card #1267): mọi hộp có viền/nền → khoảng cách từ chữ bên trong
// tới mép trong của cạnh có viền. < 9.5px = dính, exit 1. Chạy trên bản dev máy:
//   CTY_DEV_USER=1 CTY_DATA_DIR=<thư mục có log/ + nhat-ky/> npx next dev -p 3870   rồi   node scripts/sat-vien.mjs . http://localhost:3870
// Đã phá thử: --le 3px → 97 chỗ dính (đỏ); --le 14px → 0.
// repo không cài playwright (nặng, chỉ máy anh cần) → trỏ tới bản có sẵn qua PLAYWRIGHT, mặc định bản của courseforge-demo.
const { chromium } = await import(process.env.PLAYWRIGHT || '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs');
const base = process.argv[3] || 'http://localhost:3870';
const TRANG = ['/', '/phong/thu-nghiem', '/phong/sach', '/nhan-su/hung', '/nhan-su/tam', '/nhat-ky', '/luat', '/muc-tieu'];
const b = await chromium.launch({ channel: 'chrome' });
let tong = 0;
for (const w of [1200, 390]) for (const t of TRANG) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, colorScheme: 'dark' });
  await p.goto(base + t, { waitUntil: 'networkidle' });
  await p.$$eval('details', (ds) => ds.forEach((d) => { d.open = true; }));
  if (t === '/') { await p.click('button[aria-label="Góp ý / báo lỗi"]').catch(() => {}); await p.waitForTimeout(300); }
  const loi = await p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      const coVien = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none');
      const coNen = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && el !== document.body;
      if (!coVien && !coNen) continue;
      if (/^(INPUT|TEXTAREA|SELECT|BUTTON|IMG|svg|HR)$/i.test(el.tagName) || el.closest('svg,button,select,textarea,input')) continue;
      if (el.classList.contains('cty-pill') || el.closest('.cty-pill') || el.tagName === 'CODE') continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      if (r.width < 36 && r.height < 36) continue;   // huy hiệu tròn / icon (số bước…), như pill
      const bl = parseFloat(cs.borderLeftWidth), br = parseFloat(cs.borderRightWidth), bt = parseFloat(cs.borderTopWidth), bb = parseFloat(cs.borderBottomWidth);
      const vungCuon = el.scrollWidth > el.clientWidth + 2;
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let min = Infinity, mau = '';
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        if (!n.textContent.trim()) continue;
        const pe = n.parentElement; if (pe.closest('svg,button,select,textarea,input,.cty-pill')) continue;
        if (getComputedStyle(pe).textOverflow === 'ellipsis') continue;   // chữ cắt '…': khung chữ đo dài hơn phần hiện
        // chữ thuộc một hộp có viền/nền khác nằm bên trong el → hộp đó tự đo
        let a = pe, rieng = false; while (a && a !== el) { const c = getComputedStyle(a); if (c.borderLeftWidth !== '0px' || c.backgroundColor !== 'rgba(0, 0, 0, 0)') { rieng = true; break; } a = a.parentElement; }
        if (rieng) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) {
          if (!q.width) continue;
                    // chỉ tính cạnh có viền thật (hoặc cả 4 cạnh khi có nền); dọc nới 4px vì line-height đã tạo khoảng
          const canh = (w) => coNen || w > 0;
          const ds = [];
          if (canh(bl)) ds.push(q.left - (r.left + bl));
          if (canh(br) && !vungCuon) ds.push((r.right - br) - q.right);
          if (canh(bt)) ds.push(q.top - (r.top + bt) + 4);
          if (canh(bb)) ds.push((r.bottom - bb) - q.bottom + 4);
          const dd = ds.length ? Math.min(...ds) : 99;
          if (dd < min) { min = dd; mau = n.textContent.trim().slice(0, 40); }
        }
      }
      if (min < 9.5) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${min.toFixed(0)}px «${mau}»`);
    }
    return [...new Set(out)];
  });
  const ngang = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);   // trang không được cuộn ngang
  if (ngang > 0) loi.push(`trang cuộn ngang ${ngang}px`);
  if (loi.length) { console.log(`--- ${w}px ${t}`); loi.slice(0, 12).forEach((x) => console.log('  ' + x)); tong += loi.length; }
  await p.close();
}
console.log('TỔNG chỗ dính:', tong);
await b.close();
process.exit(tong ? 1 : 0);

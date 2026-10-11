// Đo "chữ không thẳng hàng" (#1294, 11/10/2026): chip người (ảnh + tên) và viên nhãn đứng giữa dòng chữ phải chung CHÂN CHỮ với
// chữ đứng cạnh. Cách đo: chèn một mốc cao 0 (inline-block, canh chân chữ) ngay trong chữ của chip và một mốc ngay sau chip →
// hai mốc nằm đúng trên hai chân chữ; lệch > 1.5px = lệch hàng, exit 1. Chạy giống sat-vien.mjs:
//   CTY_DEV_USER=1 CTY_DATA_DIR=<dữ liệu> npx next dev -p 3870   rồi   node scripts/thang-hang.mjs . http://localhost:3870
const { chromium } = await import(process.env.PLAYWRIGHT || '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs');
const base = process.argv[3] || 'http://localhost:3870';
const TRANG = ['/?ngan=phong:thu-nghiem', '/?ngan=nhan-su:tam', '/', '/phong/thu-nghiem', '/quy-trinh', '/nhat-ky', '/nhan-su/ky', '/nhan-su'];
const NGUONG = 1.5;
const PHA = process.argv.includes('--pha');   // phá thử: dán lại kiểu chip cũ (inline-flex) → phải đỏ
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext(); const tok = process.argv[4];
if (tok) await ctx.addCookies([{ name: 'mos2-session', value: tok, url: base }]);
let tong = 0, soDo = 0;
for (const w of [1200, 390]) for (const t of TRANG) {
  const p = await ctx.newPage(); await p.setViewportSize({ width: w, height: 900 });
  await p.goto(base + t, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
  if (PHA) await p.addStyleTag({ content: '.cty-nguoi-link{display:inline-flex!important;align-items:center;gap:5px}' });
  const kq = await p.evaluate((NG) => {
    const moc = () => { const m = document.createElement('span'); m.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;margin:0;padding:0'; return m; };
    const out = []; let n = 0;
    const chuDau = (el) => { if (!el) return null; if (el.nodeType === 3) return el.textContent.trim() ? el : null;
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let x = tw.nextNode(); x; x = tw.nextNode()) if (x.textContent.trim()) return x; return null; };
    // Mốc chân chữ: bọc nút chữ vào span + mốc cao 0 → mốc nằm đúng chân chữ của CHÍNH nút chữ đó, dù cha là flex hay inline
    const danMoc = (tn) => { const boc = document.createElement('span'); tn.replaceWith(boc); const m = moc(); boc.append(m, tn);
      const rg = document.createRange(); rg.selectNodeContents(tn); return { y: m.getBoundingClientRect().top, khung: rg.getBoundingClientRect(), go: () => boc.replaceWith(tn) }; };
    for (const chip of document.querySelectorAll('.cty-nguoi-link, .cty-pill')) {
      const r = chip.getBoundingClientRect(); if (!r.width || chip.closest('[hidden], svg')) continue;
      const t1 = chuDau(chip), t2 = chuDau(chip.nextSibling); if (!t1 || !t2) continue;   // chỉ đo chip có chữ đứng ngay sau
      const a = danMoc(t1), b2 = danMoc(t2);
      const cungDong = a.khung.bottom > b2.khung.top + 2 && b2.khung.bottom > a.khung.top + 2;   // hai khung chữ chồng nhau theo chiều dọc
      if (cungDong) { n++; if (Math.abs(a.y - b2.y) > NG) out.push({ lech: Math.round((a.y - b2.y) * 10) / 10, chu: chip.textContent.trim().slice(0, 30), cach: chip.className, cha: `${chip.parentElement.tagName.toLowerCase()}.${chip.parentElement.className}` }); }
      b2.go(); a.go();
    }
    return { n, out };
  }, NGUONG);
  soDo += kq.n; tong += kq.out.length;
  if (kq.out.length) console.log(`✗ ${w}px ${t}: ${kq.out.length}/${kq.n} lệch — ${kq.out.slice(0, 4).map((x) => `"${x.chu}" ${x.lech}px (${x.cach} trong ${x.cha})`).join(' · ')}`);
  await p.close();
}
await b.close();
console.log(tong ? `✗ thẳng hàng: ${tong}/${soDo} chip lệch chân chữ > ${NGUONG}px` : `✓ thẳng hàng: ${soDo} chip/nhãn chung chân chữ với chữ đứng cạnh (≤ ${NGUONG}px)`);
process.exit(tong ? 1 : 0);

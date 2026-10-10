// Đo "bố cục đứng yên" (YDNI) trên sơ đồ quy trình: mở một bước thì các ô bước khác không được dịch chỗ, ở khổ máy tính và điện thoại.
//   node scripts/thu-so-do.mjs <base> <phiên>    — exit 1 nếu dịch. Đã phá thử: ép bước mở chiếm cả hàng → đỏ ở cả hai khổ.
const { chromium } = await import(process.env.PLAYWRIGHT || '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs');
const [base, tok] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' }); let sai = 0;
for (const w of [1440, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); await ctx.addCookies([{ name: 'mos2-session', value: tok, url: base }]);
  const p = await ctx.newPage(); await p.goto(base + '/?ngan=quy-trinh:thu-nghiem/lam-viec', { waitUntil: 'networkidle' });
  const moc = async () => p.$$eval('.nk .cty-qt-buoc', (bs) => bs.map((x) => { const r = x.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)}`; }).join(' '));
  const truoc = await moc(); await p.locator('.nk .cty-qt-buoc > summary').first().click(); await p.waitForTimeout(300);
  const mo = await p.locator('.nk .cty-qt-buoc[open]').count(); const sau = await moc();
  const ok = mo === 1 && truoc === sau; if (!ok) sai++;
  console.log(`${ok ? '✓' : '✗'} ${w}px mở bước 1: ${mo} bước mở, các ô ${truoc === sau ? 'đứng yên' : 'DỊCH: ' + truoc + ' → ' + sau}`);
  await ctx.close();
}
await b.close(); console.log(sai ? `✗ ${sai} khổ bị dịch` : '✓ sơ đồ đứng yên khi mở bước'); process.exit(sai ? 1 : 0);

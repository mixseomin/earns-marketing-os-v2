// MỞ TRANG CÔNG CỤ THẬT (audit 07/11/2026: phần này từng chép ở doc-ap.mjs + doc-natal.mjs): Playwright của máy, khổ điện thoại, bỏ banner cookie, ẩn thanh dính để ảnh cả trang không lặp, và hàm đo khung trong trang.
import { createRequire } from 'node:module';
export function layChromium() {
  const PW = process.env.DO_MAN_PW || `${process.env.HOME}/Me/Earns/courseforge-demo/node_modules/playwright`;
  try { return createRequire(import.meta.url)(PW).chromium; } catch { return createRequire(import.meta.url)('playwright').chromium; }
}
export const TI_LE = 2;
/** mở một trang công cụ sẵn để đọc + chụp; window.__tim(re, cha) trả khung [x, y, w, h] của phần tử NHỎ NHẤT còn hiện mà chữ khớp (cha = số tầng bọc ngoài), không có thì null */
export async function moTrangCongCu(tr, url) {
  const p = await tr.newPage({ viewport: { width: 540, height: 1100 }, deviceScaleFactor: TI_LE });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await p.evaluate(() => { [...document.querySelectorAll('button, a')].find((e) => /^got it!?$/i.test(e.textContent.trim()))?.click(); });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { const v = getComputedStyle(e).position; if (v === 'fixed' || v === 'sticky') e.style.setProperty('display', 'none', 'important'); }
    window.__tim = (re, cha = 0) => { let el = [...document.querySelectorAll('body *')].filter((e) => e.offsetParent !== null && re.test(e.innerText || '')).sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0];
      if (!el) return null; for (let i = 0; i < cha && el.parentElement; i++) el = el.parentElement; const b = el.getBoundingClientRect();
      return [b.left - 8, b.top + window.scrollY - 8, b.width + 16, b.height + 16].map(Math.round); }; });
  await p.waitForTimeout(300);
  return p;
}

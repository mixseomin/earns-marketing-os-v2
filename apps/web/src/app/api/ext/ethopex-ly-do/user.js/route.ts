import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

// USERSCRIPT CHO SAFARI iPHONE (anh 23/10/2026 chọn cách 1: app "Userscripts" trên App Store). Cài bằng cách mở link này trong Safari iPhone:
//   https://mos2.on.tc/api/ext/ethopex-ly-do/user.js?k=<khoá extension>
// Script là VỎ NẠP: mỗi lần mở app.ethopex.dev tải ly-do.js mới nhất từ /js (deploy = iPhone có bản mới, không phải cài lại);
// tải hỏng thì chạy bản kèm sẵn trong chính script. Có khoá → chỉ phát khi đúng khoá (studio xv_khoa_ngoai['ethopex_ext'].token).
export async function GET(req: Request) {
  const u = new URL(req.url); const k = u.searchParams.get('k') ?? ''; const db = getDb();
  const r = db ? ((await db.execute(sql`SELECT gia_tri->>'token' AS t FROM xv_khoa_ngoai WHERE ten = 'ethopex_ext'`)) as unknown as { t: string | null }[]) : [];
  if (!r[0]?.t || k !== r[0].t) return new Response('sai mã', { status: 403 });
  console.log(`ethopex-nap lan=ios-cai ua=${(req.headers.get('user-agent') ?? '').slice(0, 90)}`);
  const goc = process.env.MOS2_DIR || path.resolve(process.cwd(), '../..'); const f = path.join(goc, 'apps/ethopex-ext/ly-do.js');
  let js = "console.warn('ethopex-ly-do: chưa đọc được mã trên mos2');", ban = '1';
  try { js = readFileSync(f, 'utf8'); ban = String(Math.floor(statSync(f).mtimeMs / 1000)); } catch { /* giữ thông báo */ }
  const link = `https://mos2.on.tc/api/ext/ethopex-ly-do/user.js?k=${encodeURIComponent(k)}`;
  const out = `// ==UserScript==
// @name         Ethopex · lý do + creative
// @description  Lý do đóng camp, creative + chỉ số theo phim, bộ tài khoản — trang Report / List campaigns của app.ethopex.dev (mos2)
// @match        https://app.ethopex.dev/*
// @version      ${ban}
// @run-at       document-end
// @noframes
// @updateURL    ${link}
// @downloadURL  ${link}
// ==/UserScript==
window.ETHOPEX_LY_DO_KHOA = ${JSON.stringify(k)}; window.__etpGoiThang = true; window.__etpIos = true;
(async () => {
  if (document.getElementById('etp-mark')) return;
  try {
    const r = await fetch('https://mos2.on.tc/api/ext/ethopex-ly-do/js?lan=ios&t=' + Date.now(), { cache: 'no-store' });
    if (r.ok) { new Function(await r.text())(); return; }
  } catch (e) { console.warn('ethopex-ly-do: tải bản mới lỗi, chạy bản kèm sẵn', e); }
  if (document.getElementById('etp-mark')) return;
  (function () {
${js}
  })();
})();
`;
  return new Response(out, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' } });
}

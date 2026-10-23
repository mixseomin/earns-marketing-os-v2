#!/usr/bin/env node
// SỐ MICROSOFT STORE → MOS2 (anh 23/10/2026: "làm sao có đủ report này" — Partner Center › Insights). Mỗi ngày đọc Microsoft Store
// analytics API cho MỌI app Windows trong sổ Tài sản (Directus products platform 'ms-store', sku = Store ID), ghi vào product_stats
// (platform 'ms-store'), cùng khuôn với scripts/app-store-so.mjs để tab Tài sản / báo cáo app đọc chung:
//   views     = lượt xem trang Store (pageViews, từ funnel)     downloads = lượt cài (acquisitions)
//   raw_data  = { cai_theo_nuoc, cai_theo_nguon, xem_trang, cai, danh_gia, diem_tb, so_danh_gia, loi }
// Khoá: /root/.secrets/msstore.env (tenant Entra codecrate.onmicrosoft.com — vault #567 — app "mos2 analytics", quyền Developer +
// Business Contributor + Marketer trên Partner Center, KHÔNG có quyền thuế / nhận tiền). Chạy trong app-store-so.service (cùng timer).
//   node scripts/ms-store-so.mjs [--days 35] [--dry]
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const DAYS = Number(args[args.indexOf('--days') + 1]) || 35;
const DRY = args.includes('--dry');
const log = (...a) => console.log(new Date().toISOString().slice(0, 19), ...a);
const env = Object.fromEntries(readFileSync(process.env.MSSTORE_ENV || '/root/.secrets/msstore.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2)));

const ngay = (d) => d.toISOString().slice(0, 10);
const den = new Date(), tu = new Date(Date.now() - DAYS * 86400_000);

async function token() {
  const r = await fetch(`https://login.microsoftonline.com/${env.MSSTORE_TENANT_ID}/oauth2/token`, { method: 'POST',
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.MSSTORE_CLIENT_ID, client_secret: env.MSSTORE_CLIENT_SECRET, resource: 'https://manage.devcenter.microsoft.com' }) });
  const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error_description?.slice(0, 200)}`); return j.access_token;
}
const T = await token();
/** GET một báo cáo, theo hết trang (@nextLink). Báo 429 thì đợi rồi thử lại. */
async function bao(path) {
  let url = `https://manage.devcenter.microsoft.com/v1.0/my/analytics/${path}`, out = [];
  for (let lan = 0; url && lan < 40; lan++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${T}` } });
    if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 3000)); lan--; continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${path.split('?')[0]} ${r.status} ${JSON.stringify(j).slice(0, 160)}`);
    out = out.concat(j.Value ?? []); url = j['@nextLink'] ? `https://manage.devcenter.microsoft.com/v1.0/my/analytics/${j['@nextLink']}` : null;
  }
  return out;
}

const U = process.env.DIRECTUS_URL || 'https://as.on.tc';
const H = { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' };
const pr = await fetch(`${U}/items/products?limit=-1&fields=id,sku,title&filter[platform][_eq]=ms-store`, { headers: H });
if (!pr.ok) throw new Error(`Directus products → ${pr.status}`);
const sp = (await pr.json()).data.filter((p) => /^9[0-9A-Z]{11}$/.test(String(p.sku ?? '')));

const stats = [];
for (const p of sp) {
  const q = `applicationId=${p.sku}&startDate=${ngay(tu)}&endDate=${ngay(den)}`;
  const theoNgay = new Map(), lay = (d) => { const k = String(d).slice(0, 10); if (!theoNgay.has(k)) theoNgay.set(k, { cai: 0, xem_trang: 0, cai_theo_nuoc: {}, cai_theo_nguon: {}, loi: [] }); return theoNgay.get(k); };
  try {
    for (const r of await bao(`appacquisitions?${q}&aggregationLevel=day&groupby=date,market,acquisitionType`)) {
      const x = lay(r.date), n = Number(r.acquisitionQuantity) || 0;
      x.cai += n; if (r.market) x.cai_theo_nuoc[r.market] = (x.cai_theo_nuoc[r.market] ?? 0) + n;
      if (r.acquisitionType) x.cai_theo_nguon[r.acquisitionType] = (x.cai_theo_nguon[r.acquisitionType] ?? 0) + n;
    }
  } catch (e) { log(`${p.title}: acquisitions lỗi ${e.message}`); }
  try {
    for (const r of await bao(`funnel?${q}`)) if (/page ?view/i.test(r.MetricType ?? r.metricType ?? '')) lay(r.date ?? den).xem_trang += Number(r.UserCount ?? r.userCount) || 0;
  } catch (e) { log(`${p.title}: funnel lỗi ${e.message}`); }
  try {
    for (const r of await bao(`ratings?${q}&aggregationLevel=day`)) {
      const x = lay(r.date), so = ['oneStar', 'twoStars', 'threeStars', 'fourStars', 'fiveStars'].map((k) => Number(r[k]) || 0);
      const tong = so.reduce((a, b) => a + b, 0); if (tong) { x.so_danh_gia = tong; x.diem_tb = +(so.reduce((a, b, i) => a + b * (i + 1), 0) / tong).toFixed(2); }
    }
  } catch (e) { log(`${p.title}: ratings lỗi ${e.message}`); }
  try {
    for (const r of await bao(`failurehits?${q}&aggregationLevel=day`)) lay(r.date).loi.push({ ten: r.failureName, so: Number(r.eventCount) || 0 });
  } catch (e) { log(`${p.title}: failurehits lỗi ${e.message}`); }
  for (const [d, x] of theoNgay) stats.push({ pid: p.id, date: d, views: x.xem_trang, downloads: x.cai, raw: x });
  const t = [...theoNgay.values()].reduce((a, x) => ({ c: a.c + x.cai, v: a.v + x.xem_trang }), { c: 0, v: 0 });
  log(`${p.title} (${p.sku}): ${theoNgay.size} ngày · xem trang ${t.v} · cài ${t.c}`);
}

if (DRY || !stats.length) { log(DRY ? `--dry: ${stats.length} dòng, không ghi` : 'không có gì để ghi'); process.exit(0); }
let moi = 0, sua = 0;
for (const r of stats) {
  const cur = (await (await fetch(`${U}/items/product_stats?limit=1&fields=id&filter[product_id][_eq]=${r.pid}&filter[date][_eq]=${r.date}&filter[platform][_eq]=ms-store`, { headers: H })).json()).data[0];
  const body = JSON.stringify({ product_id: r.pid, date: r.date, platform: 'ms-store', views: r.views, downloads: r.downloads, raw_data: r.raw });
  const res = await fetch(cur ? `${U}/items/product_stats/${cur.id}` : `${U}/items/product_stats`, { method: cur ? 'PATCH' : 'POST', headers: H, body });
  if (!res.ok) { log('lỗi ghi', r.date, res.status); continue; }
  cur ? sua++ : moi++;
}
log(`Directus product_stats (ms-store): mới ${moi} · cập nhật ${sua}`);

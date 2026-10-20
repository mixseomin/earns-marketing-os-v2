#!/usr/bin/env node
// DOANH THU ADMOB → MOS2 (I04 #6, anh cho phép đọc AdMob 20/10/2026). Mỗi ngày đọc AdMob API (networkReport, DATE × APP) của
// tài khoản htuan82 (pub-9893054287799556), ghi vào Directus product_stats cạnh số App Store của app-store-so.mjs:
//   platform 'admob', product_id = dòng products (platform app-store) có sku = Apple ID mà app AdMob đã liên kết,
//   revenue = ESTIMATED_EARNINGS (USD), raw_data = { impressions, requests, matched, clicks, admobApp }.
// Tab Tài sản cộng revenue như mọi nền khác (lib/products/data.ts); dòng app-store có revenue null nên không cộng trùng.
// App AdMob chưa liên kết App Store (app chưa lên store) thì không có Apple ID để gắn → báo "chưa liên kết", không ghi.
//
// Khoá: OAuth client GSC_CLIENT_ID/SECRET (.env.production) + ADMOB_REFRESH_TOKEN trong /root/.secrets/admob.env
// (cấp qua OAuth Playground, scope admob.readonly; ADMOB_ENV ghi đè đường dẫn). Chạy cùng timer app-store-so (ExecStart thứ hai).
//   node scripts/admob-doanh-thu.mjs [--days 35] [--dry]
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const DAYS = Number(args[args.indexOf('--days') + 1]) || 35;
const DRY = args.includes('--dry');
const PUB = process.env.ADMOB_PUB || 'pub-9893054287799556';
const log = (...a) => console.log(new Date().toISOString().slice(0, 19), ...a);

for (const l of readFileSync(process.env.ADMOB_ENV || '/root/.secrets/admob.env', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const need = (k) => { if (!process.env[k]) throw new Error(`thiếu ${k}`); return process.env[k]; };

const tok = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: need('GSC_CLIENT_ID'), client_secret: need('GSC_CLIENT_SECRET'),
    refresh_token: need('ADMOB_REFRESH_TOKEN'), grant_type: 'refresh_token' }),
});
if (!tok.ok) throw new Error(`OAuth → ${tok.status} ${(await tok.text()).slice(0, 200)}`);
const AT = (await tok.json()).access_token;

async function admob(path, body) {
  const r = await fetch(`https://admob.googleapis.com/v1/accounts/${PUB}${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${AT}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`AdMob ${path} → ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

// app AdMob → Apple ID (chỉ app đã liên kết store mới có appStoreId)
const appleId = {};
for (const a of (await admob('/apps?pageSize=100')).apps || []) {
  if (a.platform === 'IOS' && a.linkedAppInfo?.appStoreId) appleId[a.appId] = String(a.linkedAppInfo.appStoreId);
}

const d = (x) => ({ year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate() });
const end = new Date(), start = new Date(Date.now() - (DAYS - 1) * 864e5);
const rep = await admob('/networkReport:generate', { reportSpec: {
  dateRange: { startDate: d(start), endDate: d(end) },
  dimensions: ['DATE', 'APP'],
  metrics: ['ESTIMATED_EARNINGS', 'IMPRESSIONS', 'AD_REQUESTS', 'MATCHED_REQUESTS', 'CLICKS'],
} });

const stats = [], chuaLk = new Set();
for (const x of rep) {
  const r = x.row; if (!r) continue;
  const app = r.dimensionValues.APP, id = app.value, m = r.metricValues;
  const ngay = r.dimensionValues.DATE.value;                      // YYYYMMDD theo múi giờ báo cáo của tài khoản (Asia/Saigon)
  const sku = appleId[id]; if (!sku) { chuaLk.add(app.displayLabel || id); continue; }
  stats.push({ sku, ten: app.displayLabel, date: `${ngay.slice(0, 4)}-${ngay.slice(4, 6)}-${ngay.slice(6, 8)}`,
    revenue: Number(m.ESTIMATED_EARNINGS?.microsValue || 0) / 1e6,
    raw: { impressions: Number(m.IMPRESSIONS?.integerValue || 0), requests: Number(m.AD_REQUESTS?.integerValue || 0),
      matched: Number(m.MATCHED_REQUESTS?.integerValue || 0), clicks: Number(m.CLICKS?.integerValue || 0), admobApp: id } });
}
const tong = stats.reduce((s, r) => s + r.revenue, 0);
log(`AdMob ${DAYS} ngày: ${stats.length} dòng app×ngày, $${tong.toFixed(2)}` + (chuaLk.size ? ` · chưa liên kết App Store: ${[...chuaLk].join(', ')}` : ''));
if (DRY) { for (const r of stats) console.log(r.date, r.ten, r.sku, r.revenue, r.raw); process.exit(0); }

const U = process.env.DIRECTUS_URL || 'https://as.on.tc';
const H = { Authorization: `Bearer ${need('DIRECTUS_TOKEN')}`, 'Content-Type': 'application/json' };
const pr = await fetch(`${U}/items/products?limit=-1&fields=id,sku&filter[platform][_eq]=app-store`, { headers: H });
if (!pr.ok) throw new Error(`Directus products → ${pr.status} ${(await pr.text()).slice(0, 200)}`);
const bySku = Object.fromEntries((await pr.json()).data.filter((p) => p.sku).map((p) => [String(p.sku), p.id]));
let moi = 0, sua = 0, bo = 0;
for (const r of stats) {
  const pid = bySku[r.sku]; if (!pid) { bo++; continue; }
  const cur = (await (await fetch(`${U}/items/product_stats?limit=1&fields=id&filter[product_id][_eq]=${pid}&filter[date][_eq]=${r.date}&filter[platform][_eq]=admob`, { headers: H })).json()).data[0];
  const body = JSON.stringify({ product_id: pid, date: r.date, platform: 'admob', revenue: r.revenue, gross_revenue: r.revenue, raw_data: r.raw });
  const res = await fetch(cur ? `${U}/items/product_stats/${cur.id}` : `${U}/items/product_stats`, { method: cur ? 'PATCH' : 'POST', headers: H, body });
  if (!res.ok) { log('lỗi', r.sku, r.date, res.status, (await res.text()).slice(0, 200)); continue; }
  cur ? sua++ : moi++;
}
log(`Directus product_stats (admob): mới ${moi} · cập nhật ${sua}${bo ? ` · bỏ ${bo} (không có dòng products sku khớp)` : ''}`);

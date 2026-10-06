#!/usr/bin/env node
// SỐ APP STORE → MOS2 (anh duyệt 06/10/2026). Mỗi ngày đọc Analytics Reports API của Apple cho MỌI app trong tài khoản
// nhà phát triển (#470), ghi vào Directus product_stats (platform 'app-store', product_id = dòng products có sku = Apple ID):
//   views     = lượt xem trang sản phẩm (Page view)       downloads = tải lần đầu (First-time download)
//   raw_data  = { impressions, pageViews, firstTime, redownloads, updates, source }
// Tab Tài sản đọc hai cột này như mọi nền khác (lib/products/data.ts → views7d / đơn).
//
// Chạy trên box3 (anh chốt 06/10/2026: việc đọc data nằm trên box, không ở máy anh) bằng systemd timer app-store-so.timer.
// Khoá ASC: /root/.secrets/asc/{asc.env,AuthKey_<KEY_ID>.p8} (ASC_DIR ghi đè); token Directus từ .env.production qua EnvironmentFile.
// App chưa có "yêu cầu báo cáo" thì script tự tạo (ONGOING + ONE_TIME_SNAPSHOT lấy lại từ ngày ra mắt); Apple cần 1–2 ngày
// để dựng lần đầu — trong lúc đó script chỉ báo "chưa có" chứ không ghi số 0 (chưa đo ≠ 0).
//   node scripts/app-store-so.mjs [--days 35] [--dry]
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const DAYS = Number(args[args.indexOf('--days') + 1]) || 35;
const DRY = args.includes('--dry');
const ASC_DIR = process.env.ASC_DIR || '/root/.secrets/asc';
const log = (...a) => console.log(new Date().toISOString().slice(0, 19), ...a);

// ---- ASC JWT (ES256) ----
const env = Object.fromEntries(readFileSync(`${ASC_DIR}/asc.env`, 'utf8').split('\n')
  .map((l) => l.match(/^\s*([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const KEY = readFileSync(`${ASC_DIR}/AuthKey_${env.ASC_KEY_ID}.p8`, 'utf8');
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid: env.ASC_KEY_ID, typ: 'JWT' }), body = b64({ iss: env.ASC_ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' });
  const s = createSign('SHA256'); s.update(`${head}.${body}`);
  return `${head}.${body}.${s.sign({ key: KEY, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
async function api(method, path, body) {
  const r = await fetch(path.startsWith('http') ? path : `https://api.appstoreconnect.apple.com${path}`, {
    method, headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.status === 204 ? null : r.json();
}
async function all(path) {
  let out = [], next = path;
  while (next) { const j = await api('GET', next); out = out.concat(j.data); next = j.links?.next; }
  return out;
}

// ---- đọc một báo cáo: mọi instance DAILY trong cửa sổ → dòng TSV ----
async function rows(requestId, name, since) {
  const rep = (await all(`/v1/analyticsReportRequests/${requestId}/reports?filter[name]=${encodeURIComponent(name)}`))[0];
  if (!rep) return null;
  const inst = (await all(`/v1/analyticsReports/${rep.id}/instances?filter[granularity]=DAILY&limit=200`))
    .filter((i) => i.attributes.processingDate >= since);
  const out = [];
  for (const i of inst) {
    for (const seg of await all(`/v1/analyticsReportInstances/${i.id}/segments`)) {
      const buf = Buffer.from(await (await fetch(seg.attributes.url)).arrayBuffer());
      const [head, ...lines] = gunzipSync(buf).toString('utf8').split('\n').filter(Boolean);
      const cols = head.split('\t');
      for (const l of lines) out.push(Object.fromEntries(l.split('\t').map((v, k) => [cols[k], v])));
    }
  }
  return out;
}

const since = new Date(Date.now() - DAYS * 86400_000).toISOString().slice(0, 10);
const apps = await all('/v1/apps?limit=200');
const stats = [];   // { sku, date, views, downloads, raw }
for (const app of apps) {
  const id = app.id, ten = app.attributes.name;
  let reqs = await all(`/v1/apps/${id}/analyticsReportRequests`);
  for (const t of ['ONGOING', 'ONE_TIME_SNAPSHOT']) {
    if (reqs.some((r) => r.attributes.accessType === t) || DRY) continue;
    await api('POST', '/v1/analyticsReportRequests', { data: { type: 'analyticsReportRequests', attributes: { accessType: t },
      relationships: { app: { data: { type: 'apps', id } } } } });
    log(`${ten}: tạo yêu cầu báo cáo ${t} (Apple dựng lần đầu mất 1–2 ngày)`);
  }
  reqs = await all(`/v1/apps/${id}/analyticsReportRequests`);
  const ngay = new Map();   // date → số
  const cong = (d, k, n) => { const x = ngay.get(d) ?? { impressions: 0, pageViews: 0, firstTime: 0, redownloads: 0, updates: 0 }; x[k] += n; ngay.set(d, x); };
  let coSo = false;
  for (const r of reqs.filter((x) => !x.attributes.stoppedDueToInactivity)) {
    const eng = await rows(r.id, 'App Store Discovery and Engagement Standard', since).catch((e) => (log(ten, 'engagement:', e.message), null));
    for (const x of eng ?? []) {
      if (x['App Apple Identifier'] && x['App Apple Identifier'] !== id) continue;
      const n = Number(x.Counts) || 0;
      if (x.Event === 'Impression') cong(x.Date, 'impressions', n);
      else if (x.Event === 'Page view') cong(x.Date, 'pageViews', n);
    }
    const dl = await rows(r.id, 'App Downloads Standard', since).catch((e) => (log(ten, 'downloads:', e.message), null));
    for (const x of dl ?? []) {
      if (x['App Apple Identifier'] && x['App Apple Identifier'] !== id) continue;
      const n = Number(x.Counts) || 0, t = x['Download Type'] ?? '';
      if (/first/i.test(t)) cong(x.Date, 'firstTime', n);
      else if (/redownload|restore/i.test(t)) cong(x.Date, 'redownloads', n);
      else if (/update/i.test(t)) cong(x.Date, 'updates', n);
    }
    // Tên cột/sự kiện lấy theo tài liệu Apple, chưa soát trên tệp thật (06/10) → lệch thì NÓI, đừng ra số 0 im lặng.
    const ev = new Set((eng ?? []).map((x) => x.Event)), ty = new Set((dl ?? []).map((x) => x['Download Type']));
    if (eng?.length && !ev.has('Impression') && !ev.has('Page view')) log(`${ten}: CỘT LẠ engagement — cột ${Object.keys(eng[0]).join('|')} · Event ${[...ev].join('|')}`);
    if (dl?.length && ![...ty].some((t) => /first/i.test(t ?? ''))) log(`${ten}: CỘT LẠ downloads — cột ${Object.keys(dl[0]).join('|')} · Download Type ${[...ty].join('|')}`);
    if (eng?.length || dl?.length) coSo = true;
  }
  if (!coSo) { log(`${ten}: Apple chưa có báo cáo nào (chưa đo — không ghi 0)`); continue; }
  for (const [date, x] of ngay) stats.push({ sku: id, date, views: x.pageViews, downloads: x.firstTime, raw: { ...x, source: 'asc analyticsReports' } });
  const t = [...ngay.values()].reduce((a, x) => ({ i: a.i + x.impressions, v: a.v + x.pageViews, f: a.f + x.firstTime }), { i: 0, v: 0, f: 0 });
  log(`${ten}: ${ngay.size} ngày · hiển thị ${t.i} · xem trang ${t.v} · tải mới ${t.f}`);
}

if (DRY || !stats.length) { log(DRY ? `--dry: ${stats.length} dòng, không ghi` : 'không có gì để ghi'); process.exit(0); }

// ---- ghi Directus: upsert theo (product_id, date, platform) ----
const U = process.env.DIRECTUS_URL || 'https://as.on.tc';
const H = { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' };
const prods = (await (await fetch(`${U}/items/products?limit=-1&fields=id,sku&filter[platform][_eq]=app-store`, { headers: H })).json()).data;
const bySku = Object.fromEntries(prods.filter((p) => p.sku).map((p) => [String(p.sku), p.id]));
let moi = 0, sua = 0, bo = 0;
for (const r of stats) {
  const pid = bySku[r.sku]; if (!pid) { bo++; continue; }
  const cur = (await (await fetch(`${U}/items/product_stats?limit=1&fields=id&filter[product_id][_eq]=${pid}&filter[date][_eq]=${r.date}&filter[platform][_eq]=app-store`, { headers: H })).json()).data[0];
  const body = JSON.stringify({ product_id: pid, date: r.date, platform: 'app-store', views: r.views, downloads: r.downloads, raw_data: r.raw });
  const res = await fetch(cur ? `${U}/items/product_stats/${cur.id}` : `${U}/items/product_stats`, { method: cur ? 'PATCH' : 'POST', headers: H, body });
  if (!res.ok) { log('lỗi', r.sku, r.date, res.status, (await res.text()).slice(0, 200)); continue; }
  cur ? sua++ : moi++;
}
log(`Directus product_stats: mới ${moi} · cập nhật ${sua}${bo ? ` · bỏ ${bo} (không có dòng products sku khớp)` : ''}`);

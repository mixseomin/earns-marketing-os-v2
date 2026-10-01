#!/usr/bin/env node
// PHỦ adapter: GA4 theo NGÀY × nguồn × camp → phu_ga4_ngay (qua /api/phu/ingest {ga4:[…]}), cho /report2.
// Property nằm trong tài khoản GA "Adult" (71408749) — tách khỏi tài khoản AdFond.com (anh chốt 01/10/2026).
// Token readonly htuan82 (Data API runReport): /etc/adfond/ga4-oauth.json trên box3 (cùng tệp adfond đang đọc —
// chỉ là khoá OAuth đọc, số liệu không đi qua adfond). Kéo 3 ngày gần nhất mỗi giờ, ĐÈ theo khoá (GA4 còn sửa số 48h).
//   env: MOS2_EXT_KEY · GA4_OAUTH (mặc định /etc/adfond/ga4-oauth.json) · [--ngay=N]
import fs from 'node:fs';
const MOS2 = process.env.MOS2_URL || 'http://127.0.0.1:3821';
const KEY = process.env.MOS2_EXT_KEY;
const OAUTH = process.env.GA4_OAUTH || '/etc/adfond/ga4-oauth.json';
const NGAY = Number((process.argv.find((a) => a.startsWith('--ngay=')) || '--ngay=3').split('=')[1]);
// project MOS2 → property GA4 (thêm dự án = thêm một dòng)
const PROPERTY = { mellowstep: '556926376', chatwhenbored: '553902232' };
if (!KEY) { console.error('thiếu MOS2_EXT_KEY'); process.exit(1); }

const o = JSON.parse(fs.readFileSync(OAUTH, 'utf8'));
const tok = (await (await fetch(o.token_uri || 'https://oauth2.googleapis.com/token', { method: 'POST',
  body: new URLSearchParams({ client_id: o.client_id, client_secret: o.client_secret, refresh_token: o.refresh_token, grant_type: 'refresh_token' }) })).json()).access_token;

for (const [project, prop] of Object.entries(PROPERTY)) {
  let ok = true, note = '', ga4 = [];
  try {
    const r = await (await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${prop}:runReport`, {
      method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${NGAY - 1}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'date' }, { name: 'sessionSource' }, { name: 'sessionCampaignName' }],
        metrics: ['sessions', 'engagedSessions', 'addToCarts', 'checkouts', 'ecommercePurchases', 'purchaseRevenue'].map((name) => ({ name })),
        limit: 50000,
      }) })).json();
    if (r.error) throw new Error(r.error.message);
    const camp = (v) => (v === '(not set)' || v === '(direct)' || v === '(organic)' || v === '(referral)' ? '' : v);
    ga4 = (r.rows || []).map(({ dimensionValues: d, metricValues: m }) => ({
      ngay: `${d[0].value.slice(0, 4)}-${d[0].value.slice(4, 6)}-${d[0].value.slice(6)}`, nguon: d[1].value, camp: camp(d[2].value),
      phien: +m[0].value, phien_tt: +m[1].value, them_gio: +m[2].value, thanh_toan: +m[3].value, mua: +m[4].value, doanh_thu: +m[5].value,
    }));
    note = `${ga4.length} dòng · ${NGAY} ngày · ${ga4.reduce((a, x) => a + x.phien, 0)} phiên`;
  } catch (e) { ok = false; note = String(e.message || e).slice(0, 300); }
  const res = await fetch(`${MOS2}/api/phu/ingest`, { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ project, ga4, adapter: { key: 'ga4-ngay', name: `GA4 ${prop} theo ngày`, loai: 'cron', lich: '25 * * * *', ok, note } }) });
  console.log(new Date().toISOString(), 'ga4', project, res.status, note);
}

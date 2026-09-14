#!/usr/bin/env node
// PHỦ: chặn nguồn (srcid) Bidvertiser theo dữ liệu LANDER, không đợi Bid Automation của họ
// (họ chỉ chặn sau 300 click/nguồn — 372 nguồn/ngày thì gần như không nguồn nào tới ngưỡng).
// Luật: srcid có ≥ NGUONG_VIEW view mà 0 bấm phòng, tính từ TU (lúc bỏ cổng 18+) → vào TARGETING/BLACKLIST
// của camp tương ứng. POST BLACKLIST ĐÈ cả danh sách → GET rồi gộp. Trần targeting 1 call/giờ/camp → cron 1 lần/ngày.
// sid trong phu_su_kien: `<bv-tên | bidvertiser_tên>[_|]<srcid 32 hex>` (cookie cũ dùng `|`).
//   node scripts/phu/bv-chan-nguon.mjs [--kho]   (--kho: chỉ in, không POST)
//   env: DATABASE_URL · MOS2_EXT_KEY · PHU_PROJECT · creds /etc/mos2-phu/bidvertiser.env
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const MOS2 = process.env.MOS2_URL || 'http://127.0.0.1:3821';
const KEY = process.env.MOS2_EXT_KEY;
const PROJECT = process.env.PHU_PROJECT || 'adfond';
const API = 'https://my.bidvertiser.com/bdv/bidvertiser/api/adv/';
const TU = '2026-09-14 20:00+00';   // bỏ cổng 18+ — trước đó 96% không qua cổng nên 0 click không nói lên gì
const NGUONG_VIEW = 50;             // p(click)≈5% → 0/50 chỉ xảy ra ~8% do ngẫu nhiên
const kho = process.argv.includes('--kho');
if (!KEY || !process.env.DATABASE_URL) { console.error('thiếu MOS2_EXT_KEY/DATABASE_URL'); process.exit(1); }

const bao = async (ok, note) => {
  const res = await fetch(`${MOS2}/api/phu/ingest`, { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ project: PROJECT, adapter: { key: 'bidvertiser-chan-nguon', name: 'Bidvertiser chặn srcid theo lander (≥50 view, 0 click)', loai: 'cron', lich: '30 6 * * *', ok, note } }) });
  console.log(new Date().toISOString(), 'bv-chan-nguon:', res.status, note);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sql = postgres(process.env.DATABASE_URL);
try {
  const env = Object.fromEntries(readFileSync('/etc/mos2-phu/bidvertiser.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]));
  const H = { 'user-agent': 'mos2-phu/1.0', api_key: env.BV_API_KEY, 'content-type': 'application/json' };
  const t = await (await fetch(`${API}TOKEN/`, { method: 'POST', headers: { ...H, authorization: 'Basic ' + Buffer.from(`${env.BV_EMAIL}:${env.BV_PASS}`).toString('base64') } })).json();
  if (!t?.BDV_API?.AUTHORIZATION_TOKEN) throw new Error('TOKEN: ' + JSON.stringify(t).slice(0, 200));
  H.authorization = `Bearer ${t.BDV_API.AUTHORIZATION_TOKEN}`;
  const call = async (path, body) => { await sleep(1100); return (await fetch(API + path, { method: body ? 'POST' : 'GET', headers: H, body: body ? JSON.stringify(body) : undefined })).json(); };

  // nguồn xấu theo camp: tên camp lấy từ sid (bv-x hoặc bidvertiser_x → x)
  const rows = await sql`
    select m[1] as camp, m[2] as srcid, count(*) filter (where loai='view') as view, count(*) filter (where loai='click') as click
    from (select loai, regexp_match(sid, '^(?:bv-|bidvertiser_)([a-z0-9-]+)[_|]([0-9a-f]{32})$') m
          from phu_su_kien where project_id=${PROJECT} and ts >= ${TU}::timestamptz) s
    where m is not null group by 1,2
    having count(*) filter (where loai='view') >= ${NGUONG_VIEW} and count(*) filter (where loai='click') = 0`;
  const xau = {}; for (const r of rows) (xau[r.camp] ??= []).push(r.srcid);

  const camps = ((await call('CAMPAIGNS/'))?.BDV_API?.RESULTS?.CAMPAIGNS ?? []).filter((c) => /^bv-/.test(c.NAME || ''));
  const tt = [];
  for (const c of camps) {
    const moi = xau[c.NAME.slice(3)] || [];
    const cu = String((await call(`${c.ID}/TARGETING/BLACKLIST/`))?.BDV_API?.RESULTS?.SOURCES || '').split(',').map((s) => s.trim()).filter(Boolean);
    const them = moi.filter((s) => !cu.includes(s));
    if (!them.length) { tt.push(`${c.NAME}: +0 (đã chặn ${cu.length})`); continue; }
    if (!kho) {
      const r = await call(`${c.ID}/TARGETING/BLACKLIST/`, { SOURCES: [...cu, ...them].join(',') });
      if (r?.BDV_API?.ERROR) { tt.push(`${c.NAME}: LỖI ${r.BDV_API.ERROR.NOTE}`); continue; }
    }
    tt.push(`${c.NAME}: +${them.length}${kho ? ' (khô)' : ''} → ${cu.length + them.length}`);
    console.log(c.NAME, 'chặn', them.join(','));
  }
  await bao(true, tt.join(' · '));
} catch (e) {
  await bao(false, String(e.message).slice(0, 300));
  process.exitCode = 1;
} finally { await sql.end(); }

#!/usr/bin/env node
// PHỦ adapter: Bidvertiser Advertisers API → phu_chi (chi/ngày × camp) + trạng thái camp + balance.
//
// Quy ước sid: URL đích của camp Bidvertiser là `?s=bidvertiser_<tên-camp-bỏ-bv->_{BV_SRCID}`, nên
// sid_prefix = `bidvertiser_<tên>` và camp trên Bidvertiser PHẢI đặt tên `bv-<tên>` (vd `bv-pop-us-d`
// → prefix `bidvertiser_pop-us-d`). Không có bảng map: tên camp là khoá, đặt sai tên = không vào sổ.
//
// Creds: tệp /etc/mos2-phu/bidvertiser.env trên box3 (root 600): BV_EMAIL (username htuan82, tài khoản 297697 —
// KHÔNG phải soccerstreamstop/1706406 trong Directus earns, đó là tài khoản cũ cities) / BV_PASS / BV_API_KEY
// (trang API Access). Bản vault: MOS2 platform_accounts bidvertiser. Script không in creds. API: POST /TOKEN/ Basic email:pass → Bearer; mọi call kèm header `api_key`.
// Trần: 1 call/giây, REPORTS 1 loại/giờ/camp → cron mỗi 2 giờ cho HÔM NAY, riêng 01:10 chốt HÔM QUA (--hom-qua).
// Camp tự khai vào phu_camp từ /CAMPAIGNS/ (tên bv-* → prefix), nguồn cập nhật balance — không ai gõ tay.
//   env: MOS2_EXT_KEY · PHU_PROJECT (adfond)
import { readFileSync } from 'node:fs';

const MOS2 = process.env.MOS2_URL || 'http://127.0.0.1:3821';
const KEY = process.env.MOS2_EXT_KEY;
const PROJECT = process.env.PHU_PROJECT || 'adfond';
const CREDS = '/etc/mos2-phu/bidvertiser.env';
const API = 'https://my.bidvertiser.com/bdv/bidvertiser/api/adv/';
const UA = 'mos2-phu/1.0';
const homQua = process.argv.includes('--hom-qua');
if (!KEY) { console.error('thiếu MOS2_EXT_KEY'); process.exit(1); }

const bao = async (ok, note, chi = [], camp = [], nguon = undefined) => {
  const res = await fetch(`${MOS2}/api/phu/ingest`, { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ project: PROJECT, chi, camp, nguon, adapter: { key: 'bidvertiser-api', name: 'Bidvertiser API (chi/ngày × camp, balance)', loai: 'cron', lich: '10 1,3,5,7,9,11,13,15,17,19,21,23 * * *', ok, note } }) });
  console.log(new Date().toISOString(), 'bidvertiser:', res.status, note, await res.text().catch(() => ''));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mmdd = (d) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
const iso = (d) => d.toISOString().slice(0, 10);

try {
  let env = {};
  try { env = Object.fromEntries(readFileSync(CREDS, 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])); }
  catch { throw new Error(`thiếu ${CREDS} (BV_EMAIL/BV_PASS/BV_API_KEY, root 600)`); }
  const { BV_EMAIL: email, BV_PASS: pass, BV_API_KEY: apiKey } = env;
  if (!email || !apiKey || !pass) throw new Error(`${CREDS} thiếu BV_EMAIL/BV_PASS/BV_API_KEY`);
  const H = { 'user-agent': UA, api_key: apiKey, 'content-type': 'application/json' };
  const t = await (await fetch(`${API}TOKEN/`, { method: 'POST', headers: { ...H, authorization: 'Basic ' + Buffer.from(`${email}:${pass}`).toString('base64') } })).json();
  const tok = t?.BDV_API?.AUTHORIZATION_TOKEN;
  if (!tok) throw new Error('TOKEN: ' + JSON.stringify(t).slice(0, 200));
  H.authorization = `Bearer ${tok}`;
  const call = async (path, body) => { await sleep(1100); const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: H, body: body ? JSON.stringify(body) : undefined }); return r.json(); };

  const bal = await call('BALANCE/');
  const bb = bal?.BDV_API?.RESULTS?.BALANCE;
  const balance = bb && typeof bb === 'object' ? Number(bb.AMOUNT).toFixed(2) : String(bb ?? '?');
  const camps = (await call('CAMPAIGNS/'))?.BDV_API?.RESULTS?.CAMPAIGNS ?? [];
  const cua = camps.filter((c) => /^bv-/.test(c.NAME || ''));
  const ngay = new Date(); if (homQua) ngay.setUTCDate(ngay.getUTCDate() - 1);
  const chi = []; const tt = []; const camp = [];
  for (const c of cua) {
    const prefix = 'bidvertiser_' + c.NAME.slice(3);
    const st = (c.STATUS || []).find((s) => s.TYPE === 'NEW') || (c.STATUS || [])[0] || {};
    const ed = c.EDITORIAL_REVIEW?.RESULT || '';
    tt.push(`${c.NAME}#${c.ID}:${st.NOTE || '?'}${st.REASON ? '/' + st.REASON : ''}`);
    camp.push({ nguon_key: 'bidvertiser', ten: `${c.NAME} #${c.ID}`, sid_prefix: prefix, lander: 'https://live.chatwhenbored.com/',
      target: { bv_id: Number(c.ID), format: c.AD?.TYPE, device: c.AD?.MEDIA, source: c.AD?.SOURCE, geo: c.GEO, bid: c.BID?.AMOUNT ?? c.BID, editorial: ed },
      ngan_sach_ngay: Number(c['DAILY BUDGET']?.AMOUNT ?? c['DAILY BUDGET']) || undefined,
      trang_thai: st.NOTE === 'RUNNING' ? 'chay' : st.NOTE === 'PAUSED' ? 'tam_dung' : st.NOTE === 'DECLINED' ? 'ket_thuc' : 'nhap' });
    const rep = await call(`${c.ID}/REPORTS/`, { START_DATE: mmdd(ngay), END_DATE: mmdd(ngay) });
    const row = (rep?.BDV_API?.RESULTS?.CAMPAGINS || rep?.BDV_API?.RESULTS?.CAMPAIGNS || [])[0] || {};
    if (rep?.BDV_API?.ERROR) { tt.push(`REPORTS ${c.ID}: ${rep.BDV_API.ERROR.NOTE}`); continue; }   // trần 1 report/giờ/camp: bỏ lượt, KHÔNG ghi $0 đè số cũ
    console.log('row', c.ID, JSON.stringify(row).slice(0, 600));   // để soi tên cột (VISITS/CLICKS…) khi số lệch
    const num = (v) => (v && typeof v === 'object' ? Number(v.AMOUNT ?? v.VALUE ?? Object.values(v)[0]) : Number(v)) || 0;
    chi.push({ ngay: iso(ngay), sid_prefix: prefix, chi_usd: num(row.COST), clicks: num(row.VISITS ?? row.CLICKS ?? row.VISITORS) || null, impressions: num(row['BID REQUESTS'] ?? row.BID_REQUESTS ?? row.REQUESTS ?? row.IMPRESSIONS) || null, nguon_du_lieu: 'api:bidvertiser' });
  }
  await bao(true, `balance $${balance} · ${iso(ngay)} ${chi.map((c) => `${c.sid_prefix.slice(12)} $${c.chi_usd}/${c.clicks ?? 0}v`).join(' · ')} · ${tt.join(' · ')}`, chi, camp,
    { key: 'bidvertiser', trang_thai: 'hoat_dong', macro_click: '{BV_CLICKID}', ghi_chu: `Balance $${balance} (${new Date().toISOString().slice(0, 16)}Z). Tài khoản 297697 soccerstreamstop@gmail.com. sid = bidvertiser_<tên camp bỏ bv->_{BV_SRCID}; camp Bidvertiser đặt tên bv-<tên>. Không có postback theo click → blacklist srcid tay/API. Plan: adfond docs/plan-bidvertiser-live.md` });
} catch (e) {
  await bao(false, String(e.message).slice(0, 300));
  process.exit(1);
}

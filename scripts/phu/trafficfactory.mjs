#!/usr/bin/env node
// PHỦ adapter: TrafficFactory (panel EXADS, inventory XVideos/XNXX) API v2 → phu_chi (chi/ngày × camp) + camp + balance.
//
// Quy ước sid như Bidvertiser: camp trên TrafficFactory PHẢI đặt tên `tf-<nhãn>` (vd `tf-native-cam-t1`)
// → sid_prefix `trafficfactory_<nhãn>`; URL đích của camp mang
// `?s=trafficfactory_<nhãn>_{country_iso2}_{conversions_tracking}` (một zone native duy nhất nên srcid = nước;
// {conversions_tracking} là click id để bắn postback ngược cho TF). Không có bảng map: tên camp là khoá.
//
// API (docs.exads.com, đo 17/09/2026 trên api.trafficfactory.com):
//   POST /v2/login {api_token}                         → {type:"Bearer", token, expires_in:43200}
//   GET  /v2/user                                      → result.balance, result.status.advertiser.description
//   GET  /v2/campaigns                                 → result = {"<id>": {...}} (OBJECT theo id, không phải mảng — đo 18/09);
//        status số (1 = active), chữ nằm ở calculated_status.status ("Pending Approval" | "Rejected" | "Running"…);
//        price/max_daily_budget/total_budget_limit tính bằng CENT ($0,002 → 0.2; $20 → 2000).
//   GET  /v2/statistics/a/date?date_from&date_to&additional_group_by=campaign → result[] theo ngày × camp
// Tên cột của dòng stats chưa thấy (tài khoản chưa có camp) → map có dự phòng (cost|amount|spend…) và
// `--raw` in dòng đầu để chốt tên cột lần chạy thật đầu tiên. Token API: vault MOS2 platform_accounts #467
// (acct get 467 api), bản chạy ở /etc/mos2-phu/trafficfactory.env (TF_API_TOKEN, root 600). Script không in creds.
//   node scripts/phu/trafficfactory.mjs [--hom-qua] [--raw] [--kho]   (--kho = tự kiểm map, không chạm mạng)
//   env: MOS2_EXT_KEY · PHU_PROJECT (adfond)
import { readFileSync } from 'node:fs';

const MOS2 = process.env.MOS2_URL || 'http://127.0.0.1:3821';
const KEY = process.env.MOS2_EXT_KEY;
const PROJECT = process.env.PHU_PROJECT || 'adfond';
const CREDS = '/etc/mos2-phu/trafficfactory.env';
const API = 'https://api.trafficfactory.com/v2';
const UA = 'mos2-phu/1.0';
const homQua = process.argv.includes('--hom-qua');
const RAW = process.argv.includes('--raw');
const KHO = process.argv.includes('--kho');
const iso = (d) => d.toISOString().slice(0, 10);
const num = (v) => Number(String(v ?? '').replace(/,/g, '')) || 0;

/** Một dòng stats của EXADS → dòng phu_chi. Tên cột dự phòng vì chưa thấy dữ liệu thật. */
export const dongChi = (r, ngayMacDinh) => ({
  ngay: String(r.date ?? r.day ?? ngayMacDinh).slice(0, 10),
  campId: String(r.campaign_id ?? r.campaign?.id ?? r.id ?? ''),
  campName: String(r.campaign_name ?? r.campaign?.name ?? r.name ?? ''),
  chi_usd: Number((num(r.cost ?? r.amount ?? r.spend ?? r.total_cost)).toFixed(4)),
  clicks: num(r.clicks) || null,
  impressions: num(r.impressions ?? r.views) || null,
});
/** `tf-<nhãn>` → `trafficfactory_<nhãn>`; tên không theo khuôn → null (không vào sổ, đúng luật Bidvertiser). */
export const prefixCua = (ten) => (/^tf-/i.test(String(ten ?? '')) ? 'trafficfactory_' + String(ten).slice(3) : null);
export const trangThai = (s) => {
  const t = String(typeof s === 'object' && s ? s.status ?? s.description ?? s.name ?? '' : s ?? '').toLowerCase();
  return /active|running/.test(t) ? 'chay' : /pause/.test(t) ? 'tam_dung' : /reject|declin|delet|ended|finish|complet/.test(t) ? 'ket_thuc' : 'nhap';
};
/** result của /campaigns: object theo id (đo 18/09) hoặc mảng — nhận cả hai. */
export const danhSach = (r) => (Array.isArray(r) ? r : r && typeof r === 'object' ? Object.values(r) : []);

if (KHO) {
  // ponytail: tự kiểm map, chạy được không cần mạng
  const d = dongChi({ date: '2026-09-17', campaign_id: 7, campaign_name: 'tf-native-cam-t1', cost: '1.2345', clicks: '12', impressions: '3,400' }, '2026-01-01');
  console.assert(d.chi_usd === 1.2345 && d.clicks === 12 && d.impressions === 3400 && d.campName === 'tf-native-cam-t1', d);
  console.assert(prefixCua('tf-native-cam-t1') === 'trafficfactory_native-cam-t1' && prefixCua('test') === null);
  console.assert(trangThai({ description: 'Active' }) === 'chay' && trangThai('paused') === 'tam_dung' && trangThai({ status: 'Rejected' }) === 'ket_thuc' && trangThai({ status: 'Pending Approval' }) === 'nhap');
  console.assert(danhSach({ 1: { id: 1 }, 2: { id: 2 } }).length === 2 && danhSach([{ id: 3 }]).length === 1 && danhSach(null).length === 0);
  console.log('kho: map ok');
  process.exit(0);
}
if (!KEY) { console.error('thiếu MOS2_EXT_KEY'); process.exit(1); }

const bao = async (ok, note, chi = [], camp = [], nguon = undefined) => {
  const res = await fetch(`${MOS2}/api/phu/ingest`, { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ project: PROJECT, chi, camp, nguon, adapter: { key: 'trafficfactory-api', name: 'TrafficFactory API v2 (chi/ngày × camp, balance)', loai: 'cron', lich: '2h + chốt hôm qua 00:15', ok, note } }) });
  console.log(new Date().toISOString(), 'trafficfactory:', res.status, note, await res.text().catch(() => ''));
};

try {
  let token = '';
  try { token = (readFileSync(CREDS, 'utf8').match(/^TF_API_TOKEN=["']?([^"'\n]+)/m) || [])[1] || ''; }
  catch { throw new Error(`thiếu ${CREDS} (TF_API_TOKEN, root 600)`); }
  if (!token) throw new Error(`${CREDS} thiếu TF_API_TOKEN`);
  const H = { 'user-agent': UA, 'content-type': 'application/json' };
  const lg = await (await fetch(`${API}/login`, { method: 'POST', headers: H, body: JSON.stringify({ api_token: token }) })).json();
  if (!lg?.token) throw new Error('login: ' + JSON.stringify(lg).slice(0, 200));
  H.authorization = `${lg.type || 'Bearer'} ${lg.token}`;
  const get = async (p) => { const r = await fetch(API + p, { headers: H }); const t = await r.text(); if (!r.ok) throw new Error(`${p}: ${r.status} ${t.slice(0, 160)}`); return JSON.parse(t); };

  const u = (await get('/user')).result ?? {};
  const balance = Number(u.balance ?? 0).toFixed(2);
  const tt = [`tài khoản ${u.status?.advertiser?.description ?? '?'}`];
  const camps = danhSach((await get('/campaigns?limit=200')).result);
  const ngay = new Date(); if (homQua) ngay.setUTCDate(ngay.getUTCDate() - 1);
  const camp = []; const theoId = new Map();
  for (const c of camps) {
    const prefix = prefixCua(c.name);
    if (!prefix) { tt.push(`bỏ qua camp không theo khuôn tf-*: ${c.name}`); continue; }
    theoId.set(String(c.id), prefix);
    // cent → $; trạng thái chữ ở calculated_status (status số 1 chỉ là "bật", TF vẫn có thể đang giữ ở Pending/Rejected)
    camp.push({ nguon_key: 'trafficfactory', ten: `${c.name} #${c.id} · ${c.calculated_status?.status ?? ''}`.trim(), sid_prefix: prefix, lander: c.url ?? 'https://live.chatwhenbored.com/',
      target: { tf_id: c.id, format: c.advertiser_ad_type_label ?? c.format, pricing: c.pricing_model_name ?? c.pricing_model, price_usd: Number(c.price ?? 0) / 100, tf_status: c.calculated_status?.status, reject: c.rejecting_reason_details?.custom_rejecting_reason, variations: c.variations_counts?.number_of_variations, lang: c.variation_language },
      ngan_sach_ngay: Number(c.max_daily_budget ?? c.daily_budget ?? 0) / 100 || undefined, trang_thai: trangThai(c.calculated_status ?? c.status) });
  }
  const st = (await get(`/statistics/a/date?date_from=${iso(ngay)}&date_to=${iso(ngay)}&additional_group_by=campaign`)).result ?? [];
  if (RAW && st[0]) console.log('raw:', JSON.stringify(st[0]).slice(0, 600));
  const chi = [];
  for (const r of st) {
    const d = dongChi(r, iso(ngay));
    const prefix = theoId.get(d.campId) ?? prefixCua(d.campName);
    if (!prefix) continue;
    chi.push({ ngay: d.ngay, sid_prefix: prefix, chi_usd: d.chi_usd, clicks: d.clicks, impressions: d.impressions, nguon_du_lieu: 'trafficfactory-api' });
  }
  await bao(true, `balance $${balance} · ${iso(ngay)} ${chi.map((c) => `${c.sid_prefix.slice(15)} $${c.chi_usd}/${c.clicks ?? 0}c`).join(' · ') || 'chưa có chi'} · ${camp.length} camp · ${tt.join(' · ')}`, chi, camp,
    { key: 'trafficfactory', name: 'TrafficFactory (XVideos native)', loai: 'native', trang_thai: 'hoat_dong', macro_click: '{conversions_tracking}', so_du: Number(balance),
      ghi_chu: `Balance $${balance} (${new Date().toISOString().slice(0, 16)}Z). Tài khoản mikerey887 (vault #467). Camp đặt tên tf-<nhãn>; URL ?s=trafficfactory_<nhãn>_{country_iso2}_{conversions_tracking}.` });
} catch (e) {
  await bao(false, String(e.message).slice(0, 300));
  process.exit(1);
}

#!/usr/bin/env node
// PHỦ adapter: mạng lõi EXADS — TrafficFactory (XVideos/XNXX) VÀ ExoClick (RON) — API v2 → phu_chi (chi/ngày × camp) + camp + balance.
// Cùng một API, khác host + token + tiền tố tên camp: chọn bằng env EXADS_MANG=trafficfactory|exoclick (mặc định trafficfactory).
// ExoClick thêm 18/09/2026 khi TF khoá tài khoản; không chép tệp thứ hai — hai bản là hai cơ hội lệch nhau.
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
const PROJECT = process.env.PHU_PROJECT || 'chatwhenbored';
const MANG = {
  trafficfactory: { creds: '/etc/mos2-phu/trafficfactory.env', envKey: 'TF_API_TOKEN', api: 'https://api.trafficfactory.com/v2', tienTo: 'tf-', name: 'TrafficFactory (XVideos native)', loai: 'native', vault: '#467', adapter: 'trafficfactory-api' },
  exoclick:       { creds: '/etc/mos2-phu/exoclick.env',       envKey: 'EXO_API_TOKEN', api: 'https://api.exoclick.com/v2',       tienTo: 'exo-', name: 'ExoClick (RON pop/native)', loai: 'pop', vault: '#469', adapter: 'exoclick-api' },
};
const KEY_MANG = process.env.EXADS_MANG || 'trafficfactory';
const M = MANG[KEY_MANG]; if (!M) { console.error(`EXADS_MANG lạ: ${KEY_MANG}`); process.exit(1); }
const CREDS = M.creds;
const API = M.api;
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
/** Một dòng zone stats của EXADS → dòng phu_zone. Tên cột dự phòng (chốt bằng --raw lần chạy thật đầu). */
export const dongZone = (r, ngayMacDinh) => ({
  ngay: String(r.date ?? r.day ?? ngayMacDinh).slice(0, 10), zone_id: String(r.zone_id ?? r.idzone ?? r.zone?.id ?? r.id ?? ''), site: r.site_name ?? r.site?.name ?? r.site_hostname ?? r.hostname ?? undefined,
  impressions: num(r.impressions ?? r.views), clicks: num(r.clicks), chi_usd: Number(num(r.cost ?? r.amount ?? r.spend).toFixed(4)),
});
/** `tf-<nhãn>` → `trafficfactory_<nhãn>`; tên không theo khuôn → null (không vào sổ, đúng luật Bidvertiser). */
export const prefixCua = (ten, mang = KEY_MANG) => { const t = MANG[mang].tienTo; return String(ten ?? '').toLowerCase().startsWith(t) ? mang + '_' + String(ten).slice(t.length) : null; };
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
  console.assert(prefixCua('tf-native-cam-t1', 'trafficfactory') === 'trafficfactory_native-cam-t1' && prefixCua('test', 'trafficfactory') === null);
  console.assert(prefixCua('exo-pop-latam', 'exoclick') === 'exoclick_pop-latam' && prefixCua('tf-x', 'exoclick') === null);
  console.assert(trangThai({ description: 'Active' }) === 'chay' && trangThai('paused') === 'tam_dung' && trangThai({ status: 'Rejected' }) === 'ket_thuc' && trangThai({ status: 'Pending Approval' }) === 'nhap');
  console.assert(danhSach({ 1: { id: 1 }, 2: { id: 2 } }).length === 2 && danhSach([{ id: 3 }]).length === 1 && danhSach(null).length === 0);
  const z = dongZone({ zone_id: 4453, site_name: 'xvideos.com', impressions: '12,000', clicks: 31, cost: '0.41' }, '2026-09-19');
  console.assert(z.zone_id === '4453' && z.impressions === 12000 && z.clicks === 31 && z.chi_usd === 0.41 && z.site === 'xvideos.com', z);
  console.log('kho: map ok');
  process.exit(0);
}
if (!KEY) { console.error('thiếu MOS2_EXT_KEY'); process.exit(1); }

const bao = async (ok, note, chi = [], camp = [], nguon = undefined, zone = [], zone_chan_xong = [], camp_dung_xong = []) => {
  const res = await fetch(`${MOS2}/api/phu/ingest`, { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ project: PROJECT, chi, camp, nguon, zone, zone_chan_xong, camp_dung_xong, adapter: { key: M.adapter, name: `${M.name.split(' ')[0]} API v2 EXADS (chi/ngày × camp, balance, zone)`, loai: 'cron', lich: '2h + chốt hôm qua 00:15', ok, note } }) });
  const txt = await res.text().catch(() => '');
  console.log(new Date().toISOString(), KEY_MANG + ':', res.status, note, txt.slice(0, 300));
  try { return JSON.parse(txt); } catch { return null; }
};


try {
  let token = '';
  try { token = (readFileSync(CREDS, 'utf8').match(new RegExp(`^${M.envKey}=["']?([^"'\\n]+)`, 'm')) || [])[1] || ''; }
  catch { throw new Error(`thiếu ${CREDS} (${M.envKey}, root 600)`); }
  if (!token) throw new Error(`${CREDS} thiếu ${M.envKey}`);
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
    if (!prefix) { tt.push(`bỏ qua camp không theo khuôn ${M.tienTo}*: ${c.name}`); continue; }
    theoId.set(String(c.id), prefix);
    // cent → $; trạng thái chữ ở calculated_status (status số 1 chỉ là "bật", TF vẫn có thể đang giữ ở Pending/Rejected)
    camp.push({ nguon_key: KEY_MANG, ten: `${c.name} #${c.id} · ${c.calculated_status?.status ?? ''}`.trim(), sid_prefix: prefix, lander: c.url ?? 'https://live.chatwhenbored.com/',
      target: { tf_id: c.id, format: c.advertiser_ad_type_label ?? c.format, pricing: c.pricing_model_name ?? c.pricing_model, price_usd: Number(c.price ?? 0) / 100, tf_status: c.calculated_status?.status, reject: c.rejecting_reason_details?.custom_rejecting_reason, variations: c.variations_counts?.number_of_variations, lang: c.variation_language },
      // status 0 = mình bấm pause (API /campaigns/pause) — calculated_status vẫn nói "No Funds"/"Pending", chữ đó không phải trạng thái của mình
      ngan_sach_ngay: Number(c.max_daily_budget ?? c.daily_budget ?? 0) / 100 || undefined, trang_thai: Number(c.status) === 0 ? 'tam_dung' : trangThai(c.calculated_status ?? c.status) });
  }
  const st = (await get(`/statistics/a/date?date_from=${iso(ngay)}&date_to=${iso(ngay)}&additional_group_by=campaign`)).result ?? [];
  if (RAW && st[0]) console.log('raw:', JSON.stringify(st[0]).slice(0, 600));
  const chi = [];
  for (const r of st) {
    const d = dongChi(r, iso(ngay));
    const prefix = theoId.get(d.campId) ?? prefixCua(d.campName);
    if (!prefix) continue;
    chi.push({ ngay: d.ngay, sid_prefix: prefix, chi_usd: d.chi_usd, clicks: d.clicks, impressions: d.impressions, nguon_du_lieu: M.adapter });
  }
  // Zone: số mạng theo zone × camp (chỉ camp đang bật hoặc đã từng chi) → MOS2 chấm K1/P2/P3 với hit /x/ → trả zone cần chặn →
  // chặn ngay bằng API (PUT /campaigns/<id> zones:[{id,type:'blocked'}]) → báo lại. Bot chỉ có thể dò khi ba bộ đếm nằm cạnh nhau.
  const zone = [];
  for (const [id, prefix] of theoId) {
    const c = camps.find((x) => String(x.id) === id);
    if (!c || (Number(c.status) !== 1 && !chi.some((r) => r.sid_prefix === prefix))) continue;
    const zs = (await get(`/statistics/a/zone?date_from=${iso(ngay)}&date_to=${iso(ngay)}&campaign_id=${id}&limit=1000`)).result ?? [];
    if (RAW && zs[0]) console.log('raw zone:', JSON.stringify(zs[0]).slice(0, 600));
    for (const r of danhSach(zs)) { const z = dongZone(r, iso(ngay)); if (z.zone_id) zone.push({ sid_prefix: prefix, ...z }); }
  }
  const kq = await bao(true, `balance $${balance} · ${iso(ngay)} ${chi.map((c) => `${c.sid_prefix.slice(15)} $${c.chi_usd}/${c.clicks ?? 0}c`).join(' · ') || 'chưa có chi'} · ${camp.length} camp · ${zone.length} zone · ${tt.join(' · ')}`, chi, camp,
    { key: KEY_MANG, name: M.name, loai: M.loai, trang_thai: 'hoat_dong', macro_click: '{conversions_tracking}', so_du: Number(balance),
      ghi_chu: `Balance $${balance} (${new Date().toISOString().slice(0, 16)}Z). Tài khoản mikerey887 (vault ${M.vault}). Camp đặt tên ${M.tienTo}<nhãn>; URL ?s=${KEY_MANG}_<nhãn>_{country_iso2}_{conversions_tracking}.` });
  const chan = Array.isArray(kq?.zone_chan) ? kq.zone_chan : [];
  if (chan.length) {
    const theoPrefix = new Map([...theoId].map(([id, p]) => [p, id]));
    const xong = [];
    for (const z of chan) {
      const id = theoPrefix.get(z.sid_prefix);
      if (!id) continue;
      const r = await fetch(`${API}/campaigns/${id}`, { method: 'PUT', headers: H, body: JSON.stringify({ zones: [{ id: Number(z.zone_id), type: 'blocked' }] }) });
      const t = await r.text();
      xong.push({ sid_prefix: z.sid_prefix, zone_id: z.zone_id, ok: r.ok, ghi_chu: `${z.luat}: ${z.ly_do}${r.ok ? '' : ' · API ' + r.status + ' ' + t.slice(0, 120)}` });
    }
    await bao(true, `chặn zone: ${xong.filter((x) => x.ok).length}/${xong.length} (${xong.map((x) => x.zone_id + (x.ok ? '' : '✗')).join(',')})`, [], [], undefined, [], xong);
  }
  // Phán xét DỪNG cấp camp (P2 hit/click, trần $/click, hết tiền thử…) → pause ngay qua API, không đợi người đọc
  const dung = Array.isArray(kq?.camp_dung) ? kq.camp_dung : [];
  if (dung.length) {
    const theoPrefix = new Map([...theoId].map(([id, p]) => [p, id]));
    const ids = dung.map((d) => theoPrefix.get(d.sid_prefix)).filter(Boolean).map(Number);
    const r = ids.length ? await fetch(`${API}/campaigns/pause`, { method: 'POST', headers: H, body: JSON.stringify({ campaign_ids: ids }) }) : { ok: false, status: 0, text: async () => 'không map được id' };
    const t = await r.text();
    const xong = dung.map((d) => ({ sid_prefix: d.sid_prefix, ok: r.ok && theoPrefix.has(d.sid_prefix), ghi_chu: `máy pause: ${d.ly_do}${r.ok ? '' : ' · API ' + r.status + ' ' + t.slice(0, 120)}` }));
    await bao(true, `pause camp: ${xong.filter((x) => x.ok).length}/${xong.length} (${dung.map((d) => d.sid_prefix.slice(15)).join(',')})`, [], [], undefined, [], [], xong);
  }
} catch (e) {
  await bao(false, String(e.message).slice(0, 300));
  process.exit(1);
}

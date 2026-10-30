// PHÒNG TÀI NGUYÊN · SỐ DƯ CỔNG API (anh 20/10/2026: "có phòng quản lý các API này về hiện trạng như balance… và báo cáo hàng ngày qua telegram").
// Chạy TRONG nhịp kiem-tai-nguyen (tai-nguyen.mjs, mỗi 30 phút trên box3) — không có tiến trình riêng. $0: chỉ đọc số dư, không gọi mô hình.
//   Số dư đọc thẳng từ cổng: ShopAIKey (trần − đã dùng, credit $1 = 3.250₫) · Kie.ai (credit) · RunPod ($) · PlenX AI (credit, 100₫/credit — token studio) · fal.ai ($, khoá FAL_ADMIN_KEY).
//   ckey.vn KHÔNG đọc (anh 26/10/2026 "CKEY bỏ"): API số dư cần khoá tài khoản riêng, không có.
//   Tiền đã tiêu hôm qua theo cổng: sổ job studio (xv_job.chi_phi_cents, mos2_prod) — gồm cả cổng không có API số dư (Anthropic, Google, fal).
// Cảnh báo (cùng chủ đề 🧰 Tài nguyên, nhắc lại sau 6 giờ như cảnh báo khác): số dư dưới SAN, hoặc chỉ còn < NGAY_CON ngày theo mức tiêu 7 ngày.
// Báo cáo ngày: một tin mỗi ngày (giờ VN) ở nhịp đầu tiên sau GIO_BAO.
// KHO TỆP R2 (anh 31/10/2026: "bổ sung report về trạng thái R2 và chi phí phát sinh" + "cần 1 con dọn rác tự động"): dung lượng / số tệp / tăng mỗi
//   ngày / ước chi phí tháng đọc từ Cloudflare GraphQL (CF_EMAIL + CF_API_KEY, bucket R2_BUCKET); máy dọn rác studio (xuong-video/scripts/don-rac-r2.mts)
//   chạy một lần mỗi đêm sau GIO_DON — dời tệp không ai nhắc vào thùng rác 30 ngày, kết quả vào báo cáo sáng.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const ENV_STUDIO = '/opt/earns-marketing-os-v2/.env.production';
export const SAN = { shopaikey: 5, kie: 500, runpod: 2, plenxai: 100, vast: 2, elevenlabs: 1000, fal: 5 };   // $ / credit / $ / ₫ — dưới mức này là báo
export const NGAY_CON = 3; export const GIO_BAO = '08:00'; export const GIO_DON = '03:00';
/** Giá R2 (cloudflare.com/r2/pricing, gói Standard): lưu $0,015/GB-tháng sau 10 GB miễn phí · lớp A $4,50/triệu sau 1 triệu · lớp B $0,36/triệu sau 10 triệu · xoá + băng thông ra: 0. */
export const GIA_R2 = { gb: 0.015, gbFree: 10, a: 4.5, aFree: 1e6, b: 0.36, bFree: 10e6 };
/** Báo khi: ước chi phí R2 tháng vượt THANG_VND, hoặc tăng quá TANG_GB GB/ngày (trung bình 7 ngày). */
export const NGUONG_R2 = { thangVnd: 100000, tangGb: 10 };
const VND = 26000;   // $1 ≈ 26.000₫ (cùng tỷ giá báo cáo studio)
const LOP_B = new Set(['GetObject', 'HeadObject', 'HeadBucket', 'GetBucketLocation', 'GetBucketEncryption', 'GetBucketCors', 'GetBucketLifecycleConfiguration']);
const MIEN_PHI = new Set(['DeleteObject', 'DeleteObjects', 'DeleteBucket', 'AbortMultipartUpload']);
const DON = { shopaikey: '$', kie: 'credit', runpod: '$', ckey: '₫', plenxai: 'credit', vast: '$', elevenlabs: 'credit', fal: '$' };
const TEN = { plenxai: 'PlenX AI', shopaikey: 'ShopAIKey', kie: 'Kie.ai', runpod: 'RunPod', ckey: 'ckey.vn', vast: 'Vast.ai', elevenlabs: 'ElevenLabs', anthropic: 'Anthropic', google: 'Google', fal: 'fal.ai' };

const so = (x, d = 2) => Number(x).toLocaleString('vi-VN', { maximumFractionDigits: d });
const hien = (k, v) => (DON[k] === '$' ? `$${so(v)}` : DON[k] === '₫' ? `${so(v, 0)}₫` : `${so(v, 0)} ${DON[k]}`);
/** Ngày theo giờ VN (GMT+7), 'YYYY-MM-DD'. */
export const ngayVN = (t = Date.now()) => new Date(t + 7 * 36e5).toISOString().slice(0, 10);
export const gioVN = (t = Date.now()) => new Date(t + 7 * 36e5).toISOString().slice(11, 16);

/** Mức tiêu mỗi ngày của một cổng từ lịch sử số dư [{ngay, du:{k:v}}] (mới nhất cuối): số dư tụt bao nhiêu / ngày, chỉ tính quãng tụt (nạp tiền thì bỏ). */
export function tieuNgay(lichSu, k, soNgay = 7) {
  const ds = lichSu.filter((x) => x.du?.[k] != null).slice(-(soNgay + 1));
  let tut = 0, ngay = 0;
  for (let i = 1; i < ds.length; i++) { const d = ds[i - 1].du[k] - ds[i].du[k]; if (d >= 0) { tut += d; ngay += 1; } }
  return ngay ? tut / ngay : null;
}

/** Thuần: số dư hiện tại + lịch sử → cảnh báo [{khoa, chu}]. */
export function xetCanhBaoApi(du, lichSu) {
  const ra = [];
  for (const [k, v] of Object.entries(du)) {
    if (v == null) continue;
    const t = tieuNgay(lichSu, k); const con = t ? v / t : null;
    if (v < SAN[k]) ra.push({ khoa: `api:${k}:san`, chu: `${TEN[k]} sắp cạn: còn <b>${hien(k, v)}</b> — anh nạp thêm` });
    else if (con != null && con < NGAY_CON) ra.push({ khoa: `api:${k}:ngay`, chu: `${TEN[k]} còn <b>${hien(k, v)}</b>, theo mức tiêu ${hien(k, t)}/ngày chỉ đủ ~${so(con, 1)} ngày` });
  }
  return ra;
}

/** Thuần: dữ liệu GraphQL R2 → số cho báo cáo. luu: [{ngay, byte, tep}] (mới nhất đầu) · thao: [{loai, so}] từ đầu tháng tới hôm nay. */
export function tinhR2(luu, thao, bay = Date.now()) {
  if (!luu?.length) return null;
  const nay = luu[0], cu = luu.find((x) => Date.parse(x.ngay) <= Date.parse(nay.ngay) - 7 * 864e5) ?? luu.at(-1);
  const soNgay = Math.max(1, (Date.parse(nay.ngay) - Date.parse(cu.ngay)) / 864e5);
  const gb = nay.byte / 1e9, tang = luu.length > 1 ? (nay.byte - cu.byte) / 1e9 / soNgay : null;
  const d = new Date(bay + 7 * 36e5), ngayThang = d.getUTCDate(), dai = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(), heSo = dai / ngayThang;
  let a = 0, b = 0; for (const t of thao ?? []) { if (MIEN_PHI.has(t.loai)) continue; if (LOP_B.has(t.loai)) b += t.so; else a += t.so; }
  const usdLuu = (x) => Math.max(0, x - GIA_R2.gbFree) * GIA_R2.gb;
  const usdThao = Math.max(0, a * heSo - GIA_R2.aFree) / 1e6 * GIA_R2.a + Math.max(0, b * heSo - GIA_R2.bFree) / 1e6 * GIA_R2.b;
  const gb30 = tang != null ? gb + Math.max(0, tang) * 30 : gb;
  return { gb, tep: nay.tep, tang, a: Math.round(a * heSo), b: Math.round(b * heSo), thang: usdLuu(gb) + usdThao, gb30, thang30: usdLuu(gb30) + usdThao };
}
/** Thuần: cảnh báo R2. */
export function xetCanhBaoR2(r) {
  if (!r) return [];
  const ra = [];
  if (r.thang * VND > NGUONG_R2.thangVnd) ra.push({ khoa: 'api:r2:thang', chu: `Kho tệp R2 <b>${so(r.gb, 1)} GB</b>, ước chi phí tháng này <b>${so(r.thang * VND, 0)}₫</b> (trên ngưỡng ${so(NGUONG_R2.thangVnd, 0)}₫)` });
  if (r.tang != null && r.tang > NGUONG_R2.tangGb) ra.push({ khoa: 'api:r2:tang', chu: `Kho tệp R2 tăng <b>${so(r.tang, 1)} GB/ngày</b> (7 ngày) — đang ${so(r.gb, 1)} GB` });
  return ra;
}
/** Thuần: dòng R2 + dòng dọn rác của báo cáo sáng. don = kết quả don-rac-r2.mts đêm qua (hoặc { loi }). */
export function dongR2(r, don) {
  const d = [];
  if (!r) d.push('<b>Kho tệp R2</b>: chưa đọc được');
  else {
    const tien = (usd) => (usd < 0.005 ? '0₫ (trong hạn miễn phí)' : `~${so(usd * VND, 0)}₫ ($${so(usd)})`);
    d.push(`<b>Kho tệp R2</b>: ${so(r.gb, 1)} GB · ${so(r.tep, 0)} tệp${r.tang != null ? ` · tăng ~${so(r.tang, 1)} GB/ngày` : ''} · ước tháng này ${tien(r.thang)}${r.tang != null ? ` · 30 ngày nữa ~${so(r.gb30, 0)} GB → ${tien(r.thang30)}/tháng` : ''}`);
  }
  if (don?.loi) d.push(`<b>Dọn rác đêm qua</b>: hỏng — ${don.loi}`);
  else if (don?.dung) d.push(`<b>Dọn rác đêm qua</b>: phanh kéo, không dọn — ${don.dung}`);
  else if (don) d.push(`<b>Dọn rác đêm qua</b>: dời ${so(don.da_chuyen_rac, 0)} tệp (${so(don.rac_mb / 1e3, 2)} GB) vào thùng rác${don.con_lai ? ` · còn ${so(don.con_lai, 0)} tệp đêm sau` : ''} · xoá hẳn ${so(don.da_xoa_han, 0)} tệp quá 30 ngày (${so(don.xoa_han_mb / 1e3, 2)} GB) · thùng rác ${so(don.thung_rac_mb / 1e3, 2)} GB${don.loi_tep ? ` · ${don.loi_tep} tệp lỗi` : ''}`);
  return d.join('\n');
}

/** Thuần: tin báo cáo ngày (HTML Telegram). tieu = { provider: cents hôm qua } từ sổ job. */
export function baoCaoNgay({ ten, ngay, du, lichSu, tieu, loiDoc, spy = null, r2 = undefined, don = null }) {
  const dong = [];
  for (const k of Object.keys(SAN)) {
    const v = du[k]; const t = tieuNgay(lichSu, k);
    if (v == null) { dong.push(`• ${TEN[k]}: chưa đọc được số dư${loiDoc?.[k] ? ` (${loiDoc[k]})` : ''}`); continue; }
    dong.push(`• ${TEN[k]}: còn <b>${hien(k, v)}</b>${t ? ` · tiêu ~${hien(k, t)}/ngày · đủ ~${so(v / t, 1)} ngày` : ''}`);
  }
  const tong = Object.values(tieu).reduce((a, x) => a + x, 0);
  const tieuDong = Object.entries(tieu).sort((a, b) => b[1] - a[1]).map(([p, c]) => `${TEN[p] ?? p} ${so(c / 100 * 26000, 0)}₫`).join(' · ');
  return `<b>${ten} · Phòng Tài nguyên — báo cáo API ${ngay.split('-').reverse().slice(0, 2).join('/')}</b>\n<b>Số dư</b>\n${dong.join('\n')}\n<b>Studio tiêu hôm qua</b> (sổ job, 26.000₫ ≈ $1): ${tong ? `${so(tong / 100 * 26000, 0)}₫ — ${tieuDong}` : 'không có lượt tốn tiền'}${spy ? `\n${dongSpy(spy)}` : ''}${r2 !== undefined ? `\n${dongR2(r2, don)}` : ''}`;
}
/** Thuần: dòng "Spy AI hôm qua" theo tuyến — chính hãng phải gần 0 (anh 26/10/2026: ckey trước, chính hãng luôn cuối); chính hãng > 10% tổng = in đậm cảnh báo. */
export function dongSpy(spy) {
  const tong = (spy.ckey || 0) + (spy.fal || 0) + (spy.chinh_hang || 0); if (!tong) return '<b>Spy AI hôm qua</b>: không có lượt tốn tiền';
  const pt = Math.round((spy.chinh_hang || 0) / tong * 100);
  return `<b>Spy AI hôm qua</b>: ${so(tong, 0)}₫ — ckey ${so(spy.ckey || 0, 0)}₫ · fal ${so(spy.fal || 0, 0)}₫ · chính hãng ${so(spy.chinh_hang || 0, 0)}₫${pt > 10 ? ` · <b>⚠ chính hãng ${pt}% — người bán ckey đang hỏng?</b>` : ''}`;
}
/** Tiền spy AI theo tuyến trong MỘT ngày VN (sổ ai_luot của spy, chi_phi USD → ₫ theo 26.000). */
export function tieuSpy(ngay) {
  const url = docEnvTep('/root/.secrets/spy.env').DATABASE_URL; if (!url) return null;
  const out = execFileSync('psql', [url, '-tAF', '|', '-c', `SELECT CASE WHEN model LIKE 'ckey:%' THEN 'ckey' WHEN model LIKE 'fal:%' THEN 'fal' ELSE 'chinh_hang' END, round(sum(chi_phi) * 26000) FROM ai_luot WHERE (luc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = '${ngay}'::date GROUP BY 1`], { encoding: 'utf8', timeout: 20000 });
  return Object.fromEntries(out.trim().split('\n').filter(Boolean).map((r) => r.split('|')).map(([k, v]) => [k, Number(v) || 0]));
}

export const docEnvTep = (f) => { try { return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])); } catch { return {}; } };
const lay = async (url, o = {}) => { const r = await fetch(url, { ...o, signal: AbortSignal.timeout(20000) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`HTTP ${r.status}`); return j; };

/** Đọc số dư mọi cổng có API. Trả { du: {k: số | null}, loi: {k: lý do} } — lỗi một cổng không làm hỏng cổng khác. */
export async function docSoDu() {
  const e = { ...docEnvTep(ENV_STUDIO), ...process.env }; const du = {}, loi = {};
  const thu = async (k, f) => { try { du[k] = await f(); } catch (x) { du[k] = null; loi[k] = String(x.message ?? x).slice(0, 80); } };
  await Promise.all([
    thu('shopaikey', async () => { if (!e.SHOPAIKEY_API_KEY) throw new Error('thiếu khoá'); const h = { headers: { authorization: `Bearer ${e.SHOPAIKEY_API_KEY}` } };
      const [a, b] = await Promise.all([lay('https://api.shopaikey.com/v1/dashboard/billing/subscription', h), lay('https://api.shopaikey.com/v1/dashboard/billing/usage', h)]);
      return Math.round((a.hard_limit_usd - b.total_usage / 100) * 100) / 100; }),
    thu('kie', async () => { if (!e.KIE_API_KEY) throw new Error('thiếu khoá'); const j = await lay('https://api.kie.ai/api/v1/chat/credit', { headers: { authorization: `Bearer ${e.KIE_API_KEY}` } }); if (j.code !== 200) throw new Error(j.msg); return Number(j.data); }),
    thu('runpod', async () => { if (!e.RUNPOD_API_KEY) throw new Error('thiếu khoá'); const j = await lay('https://api.runpod.io/graphql', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${e.RUNPOD_API_KEY}` }, body: JSON.stringify({ query: 'query { myself { clientBalance } }' }) }); return Math.round(j.data.myself.clientBalance * 100) / 100; }),
    // PlenX: token đăng nhập ở tệp của studio (cong-plenxai.ts) — CHỈ đọc access_token còn hạn, không tự xoay (xoay ở đây sẽ giành refresh_token của studio)
    thu('plenxai', async () => { const t = JSON.parse(fs.readFileSync('/root/.secrets/plenxai.json', 'utf8')).access_token; if (!t) throw new Error('chưa có token');
      const j = await lay('https://plenxai.com/api/v1/users/me', { headers: { authorization: `Bearer ${t}` } }); return Number(j.credit_balance) + Number(j.free_credits ?? 0); }),
    // Vast.ai (máy GPU, góp ý city #1451) + ElevenLabs (credit còn trong kỳ = hạn mức − đã dùng): đọc khi env có khoá, chưa có thì city ghi "cần khoá …"
    thu('vast', async () => { if (!e.VAST_API_KEY) throw new Error('thiếu khoá VAST_API_KEY'); const j = await lay('https://console.vast.ai/api/v0/users/current/', { headers: { authorization: `Bearer ${e.VAST_API_KEY}` } }); return Math.round(Number(j.credit ?? j.balance) * 100) / 100; }),
    thu('elevenlabs', async () => { if (!e.ELEVENLABS_API_KEY) throw new Error('thiếu khoá ELEVENLABS_API_KEY'); const j = await lay('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': e.ELEVENLABS_API_KEY } }); return Number(j.character_limit) - Number(j.character_count); }),
    // fal.ai (anh 26/10/2026 "cần thêm ngân sách còn lại" ở bảng AI spy): khoá AI FAL_KEY không có quyền billing → cần khoá ADMIN riêng FAL_ADMIN_KEY (quyền billing:usage:read)
    thu('fal', async () => { if (!e.FAL_ADMIN_KEY) throw new Error('thiếu khoá FAL_ADMIN_KEY (quyền billing:usage:read)'); const j = await lay('https://rest.alpha.fal.ai/billing/user_balance', { headers: { authorization: `Key ${e.FAL_ADMIN_KEY}` } }); const v = Number(typeof j === 'object' ? j.balance ?? j.credits : j); if (!Number.isFinite(v)) throw new Error('trả lạ'); return Math.round(v * 100) / 100; }),
  ]);
  return { du, loi };
}

/** Đọc R2 qua Cloudflare GraphQL: dung lượng 10 ngày gần nhất + thao tác từ đầu tháng (giờ VN ≈ UTC, lệch vài giờ đầu tháng không đáng kể). */
export async function docR2(bay = Date.now()) {
  const e = { ...docEnvTep(ENV_STUDIO), ...process.env };
  if (!e.CF_EMAIL || !e.CF_API_KEY || !e.R2_ACCOUNT_ID || !e.R2_BUCKET) throw new Error('thiếu CF_EMAIL / CF_API_KEY / R2_ACCOUNT_ID / R2_BUCKET');
  const ngay = (t) => new Date(t).toISOString().slice(0, 10), homNay = ngay(bay), dauThang = `${homNay.slice(0, 8)}01`;
  const query = `query($a:String!,$b:String!,$s:Date!,$m:Date!,$e:Date!){viewer{accounts(filter:{accountTag:$a}){
    luu:r2StorageAdaptiveGroups(limit:10,filter:{bucketName:$b,date_geq:$s,date_leq:$e},orderBy:[date_DESC]){max{payloadSize objectCount} dimensions{date}}
    thao:r2OperationsAdaptiveGroups(limit:100,filter:{bucketName:$b,date_geq:$m,date_leq:$e}){sum{requests} dimensions{actionType}}}}}`;
  const j = await lay('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Auth-Email': e.CF_EMAIL, 'X-Auth-Key': e.CF_API_KEY },
    body: JSON.stringify({ query, variables: { a: e.R2_ACCOUNT_ID, b: e.R2_BUCKET, s: ngay(bay - 10 * 864e5), m: dauThang, e: homNay } }) });
  if (j.errors?.length) throw new Error(String(j.errors[0].message).slice(0, 80));
  const acc = j.data?.viewer?.accounts?.[0] ?? {};
  return tinhR2((acc.luu ?? []).map((x) => ({ ngay: x.dimensions.date, byte: Number(x.max.payloadSize), tep: Number(x.max.objectCount) })),
    (acc.thao ?? []).map((x) => ({ loai: x.dimensions.actionType, so: Number(x.sum.requests) })), bay);
}

/** Máy dọn rác R2 của studio (một lần / đêm): chạy don-rac-r2.mts --chay trên box3, trả JSON dòng cuối (hoặc { loi }). */
export function chayDonRac() {
  const thuMuc = '/opt/earns-marketing-os-v2/apps/xuong-video';
  try {
    const out = execFileSync('../../node_modules/.bin/tsx', ['scripts/don-rac-r2.mts', '--chay'], { cwd: thuMuc, encoding: 'utf8', timeout: 25 * 6e4, maxBuffer: 64e6,
      env: { ...docEnvTep(ENV_STUDIO), ...process.env, NODE_OPTIONS: '--conditions=react-server' } });
    const kq = JSON.parse(out.trim().split('\n').pop()); return { ...kq, loi_tep: kq.loi, loi: undefined };
  } catch (x) { return { loi: String(x.stderr || x.message || x).trim().split('\n').pop().slice(0, 160) }; }
}

/** Tiền studio đã tiêu theo cổng trong MỘT ngày VN (sổ job xv_job). */
export function tieuTheoCong(ngay) {
  const url = docEnvTep(ENV_STUDIO).DATABASE_URL; if (!url) return {};
  const out = execFileSync('psql', [url, '-tAF', '|', '-c', `SELECT provider, round(sum(chi_phi_cents)::numeric, 2) FROM xv_job WHERE chi_phi_cents > 0 AND (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = '${ngay}'::date GROUP BY 1`], { encoding: 'utf8', timeout: 20000 });
  return Object.fromEntries(out.trim().split('\n').filter(Boolean).map((r) => r.split('|')).map(([p, c]) => [p, Number(c)]));
}

/** Một nhịp: đọc số dư, cập nhật lịch sử (một mốc / ngày VN), trả cảnh báo + tin báo cáo ngày khi tới giờ (tối đa một lần / ngày). */
export async function nhipApi({ ten, tep, bay = Date.now() }) {
  let st = {}; try { st = JSON.parse(fs.readFileSync(tep, 'utf8')); } catch { /* lần đầu */ }
  const { du, loi } = await docSoDu(); const ngay = ngayVN(bay);
  const lich = (st.lich ?? []).filter((x) => x.ngay !== ngay); lich.push({ ngay, du }); st.lich = lich.slice(-15);
  // R2: đọc một lần / giờ (GraphQL Cloudflare cập nhật theo ngày, không cần đọc mỗi nhịp)
  if (!st.r2 || bay - (st.r2.luc ?? 0) > 36e5) { try { st.r2 = { luc: bay, ...(await docR2(bay)) }; } catch (x) { st.r2 = { luc: bay, loi: String(x.message ?? x).slice(0, 80) }; } }
  const r2 = st.r2?.loi ? null : st.r2;
  // máy dọn rác: một lần mỗi đêm sau GIO_DON (trước báo cáo sáng) — ~3 phút quét DB + tệp
  if (st.donNgay !== ngay && gioVN(bay) >= GIO_DON) { st.don = { ngay, ...chayDonRac() }; st.donNgay = ngay; }
  const canhBao = [...xetCanhBaoApi(du, st.lich), ...xetCanhBaoR2(r2),
    ...(st.don?.ngay === ngay && st.don.loi ? [{ khoa: 'box3:don-rac', chu: `Máy dọn rác R2 (xuong-video/scripts/don-rac-r2.mts) hỏng đêm nay: ${st.don.loi}` }] : []),
    ...(st.don?.ngay === ngay && st.don.dung ? [{ khoa: 'r2:don-phanh', chu: `Máy dọn rác R2 kéo phanh, không dọn: ${st.don.dung}` }] : [])];
  let bao = null;
  if (st.baoNgay !== ngay && gioVN(bay) >= GIO_BAO) {
    let tieu = {}; try { tieu = tieuTheoCong(ngayVN(bay - 864e5)); } catch { /* sổ job không đọc được: báo số dư vẫn gửi */ }
    let spy = null; try { spy = tieuSpy(ngayVN(bay - 864e5)); } catch { /* sổ spy không đọc được: phần còn lại vẫn gửi */ }
    bao = baoCaoNgay({ ten, ngay, du, lichSu: st.lich, tieu, loiDoc: loi, spy, r2, don: st.don?.ngay === ngay ? st.don : null });
  }
  return { st, du, loi, canhBao, bao, ghiBao: () => { st.baoNgay = ngay; } };
}

if (process.argv[1]?.endsWith('tai-nguyen-api.mjs')) {
  if (process.argv.includes('--tu-kiem')) {
    const assert = (await import('node:assert')).default;
    const l = [{ ngay: '2026-10-17', du: { shopaikey: 70 } }, { ngay: '2026-10-18', du: { shopaikey: 66 } }, { ngay: '2026-10-19', du: { shopaikey: 80 } }, { ngay: '2026-10-20', du: { shopaikey: 76 } }];
    assert.ok(!dongSpy({ ckey: 9000, fal: 500, chinh_hang: 300 }).includes('⚠'), 'chính hãng 3%: không cảnh báo');
    assert.ok(dongSpy({ ckey: 1000, chinh_hang: 60000 }).includes('chính hãng 98%'), 'chính hãng chiếm phần lớn: cảnh báo đậm');
    assert.ok(dongSpy({}).includes('không có lượt'), 'ngày không tiêu');
    assert.strictEqual(tieuNgay(l, 'shopaikey'), 4, 'mức tiêu chỉ tính quãng tụt — ngày nạp tiền (66 → 80) bỏ');
    assert.strictEqual(tieuNgay([{ ngay: 'a', du: { kie: 10 } }], 'kie'), null, 'một mốc chưa tính được');
    const k = (du, ls = []) => xetCanhBaoApi(du, ls).map((c) => c.khoa);
    assert.deepStrictEqual(k({ shopaikey: 61.38, kie: 7425, runpod: 8.6, ckey: null }), [], 'số dư 20/10/2026: im');
    assert.deepStrictEqual(k({ runpod: 1.2 }), ['api:runpod:san'], 'RunPod dưới $2');
    assert.deepStrictEqual(k({ shopaikey: 10 }, [{ ngay: 'a', du: { shopaikey: 20 } }, { ngay: 'b', du: { shopaikey: 10 } }]), ['api:shopaikey:ngay'], '$10 mà tiêu $10/ngày = 1 ngày');
    const t = baoCaoNgay({ ten: 'Nguyên', ngay: '2026-10-20', du: { shopaikey: 61.38, kie: 7425, runpod: 8.6, plenxai: null }, lichSu: [], tieu: { ckey: 1.2, anthropic: 30 }, loiDoc: { plenxai: 'HTTP 401' } });
    assert.ok(t.includes('20/10') && t.includes('$61,38') && t.includes('7.425 credit') && t.includes('PlenX AI: chưa đọc được số dư (HTTP 401)') && !t.includes('ckey.vn: chưa đọc') && t.includes('Anthropic 7.800₫'), t);
    assert.strictEqual(ngayVN(Date.parse('2026-10-19T18:30:00Z')), '2026-10-20', '01:30 sáng VN đã là ngày mới');
    // R2: số đo thật 30/10/2026 (61,4 GB, tăng ~2,9 GB/ngày 23→30/10, thao tác tháng 10 đến 30/10)
    const luu = [['2026-10-30', 61412338157, 61718], ['2026-10-29', 59148622199, 61103], ['2026-10-23', 33026456419, 51482]].map(([ngay, byte, tep]) => ({ ngay, byte, tep }));
    const thao = [['PutObject', 77911], ['DeleteObject', 58222], ['GetObject', 26923], ['HeadObject', 66993], ['ListObjects', 173], ['CopyObject', 116]].map(([loai, so]) => ({ loai, so }));
    const r = tinhR2(luu, thao, Date.parse('2026-10-30T05:00:00Z'));
    assert.ok(Math.abs(r.gb - 61.41) < 0.01 && Math.abs(r.tang - 4.05) < 0.01, JSON.stringify(r));
    assert.ok(Math.abs(r.thang - (61.412 - 10) * 0.015) < 0.001, `thao tác dưới hạn miễn phí → chỉ tiền lưu: ${r.thang}`);
    assert.deepStrictEqual(xetCanhBaoR2(r), [], '~20.000₫/tháng, tăng 4 GB/ngày: im');
    assert.deepStrictEqual(xetCanhBaoR2({ ...r, gb: 400, thang: 5.85, tang: 12 }).map((c) => c.khoa), ['api:r2:thang', 'api:r2:tang']);
    assert.strictEqual(tinhR2([], []), null, 'chưa có số đo');
    const dr = dongR2(r, { da_chuyen_rac: 1200, rac_mb: 3400, con_lai: 0, da_xoa_han: 0, xoa_han_mb: 0, thung_rac_mb: 3400 });
    assert.ok(dr.includes('61,4 GB') && dr.includes('61.718 tệp') && dr.includes('dời 1.200 tệp (3,4 GB)') && dr.includes('~20.051₫ ($0,77)'), dr);
    assert.ok(dongR2(null, { dung: 'nghi quét sót' }).includes('phanh kéo') && dongR2(r, { loi: 'tsx hỏng' }).includes('hỏng — tsx hỏng'));
    assert.ok(baoCaoNgay({ ten: 'Nguyên', ngay: '2026-10-31', du: {}, lichSu: [], tieu: {}, r2: r }).includes('Kho tệp R2'), 'báo cáo có dòng R2');
    assert.ok(!baoCaoNgay({ ten: 'Nguyên', ngay: '2026-10-31', du: {}, lichSu: [], tieu: {} }).includes('Kho tệp R2'), 'gọi cũ không truyền r2: không thêm dòng');
    console.log('tai-nguyen-api tu-kiem ok');
  } else if (process.argv.includes('--in')) {
    const { du, loi } = await docSoDu(); console.log(du, loi);
    let r2 = null; try { r2 = await docR2(); } catch (x) { console.error('✗ R2:', x.message); } console.log(r2, xetCanhBaoR2(r2));
    console.log(baoCaoNgay({ ten: 'Nguyên', ngay: ngayVN(), du, lichSu: [], tieu: (() => { try { return tieuTheoCong(ngayVN(Date.now() - 864e5)); } catch { return {}; } })(), loiDoc: loi, r2 }));
  }
}

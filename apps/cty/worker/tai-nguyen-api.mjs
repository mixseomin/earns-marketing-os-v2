// PHÒNG TÀI NGUYÊN · SỐ DƯ CỔNG API (anh 20/10/2026: "có phòng quản lý các API này về hiện trạng như balance… và báo cáo hàng ngày qua telegram").
// Chạy TRONG nhịp kiem-tai-nguyen (tai-nguyen.mjs, mỗi 30 phút trên box3) — không có tiến trình riêng. $0: chỉ đọc số dư, không gọi mô hình.
//   Số dư đọc thẳng từ cổng: ShopAIKey (trần − đã dùng, credit $1 = 3.250₫) · Kie.ai (credit) · RunPod ($) · PlenX AI (credit, 100₫/credit — token studio) · fal.ai ($, khoá FAL_ADMIN_KEY).
//   Keywords Everywhere (credit, khoá KE_API_KEY trong /root/.secrets/spy.env — anh 02/11/2026 "Phòng tài nguyên phải theo dõi hoạt động của api này"):
//   số dư + sổ lượt gọi ke_luot của spy (server/ke.mjs) → dòng báo cáo sáng + cảnh báo lỗi liên tiếp / tiêu sát trần ngày.
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
export const SAN = { tokenhot: 2, flatkey: 2, shopaikey: 5, kie: 500, runpod: 2, plenxai: 100, vast: 2, elevenlabs: 1000, fal: 5, ke: 5000, donk: 2000 };   // $ / credit / $ / ₫ — dưới mức này là báo
export const NGAY_CON = 3; export const GIO_BAO = '08:00'; export const GIO_DON = '03:00';
/** Giá R2 (cloudflare.com/r2/pricing, gói Standard): lưu $0,015/GB-tháng sau 10 GB miễn phí · lớp A $4,50/triệu sau 1 triệu · lớp B $0,36/triệu sau 10 triệu · xoá + băng thông ra: 0. */
export const GIA_R2 = { gb: 0.015, gbFree: 10, a: 4.5, aFree: 1e6, b: 0.36, bFree: 10e6 };
/** Báo khi: ước chi phí R2 tháng vượt THANG_VND, hoặc tăng quá TANG_GB GB/ngày (trung bình 7 ngày). */
export const NGUONG_R2 = { thangVnd: 100000, tangGb: 10 };
const VND = 26000;   // $1 ≈ 26.000₫ (cùng tỷ giá báo cáo studio)
const LOP_B = new Set(['GetObject', 'HeadObject', 'HeadBucket', 'GetBucketLocation', 'GetBucketEncryption', 'GetBucketCors', 'GetBucketLifecycleConfiguration']);
const MIEN_PHI = new Set(['DeleteObject', 'DeleteObjects', 'DeleteBucket', 'AbortMultipartUpload']);
const DON = { donk: '₫', tokenhot: '$', flatkey: '$', shopaikey: '$', kie: 'credit', runpod: '$', ckey: '₫', plenxai: 'credit', vast: '$', elevenlabs: 'credit', fal: '$', ke: 'credit' };
const TEN = { donk: 'Donk (Claude)', tokenhot: 'TokenHot', flatkey: 'FlatKey', plenxai: 'PlenX AI', shopaikey: 'ShopAIKey', kie: 'Kie.ai', runpod: 'RunPod', ckey: 'ckey.vn', vast: 'Vast.ai', elevenlabs: 'ElevenLabs', anthropic: 'Anthropic', google: 'Google', fal: 'fal.ai', ke: 'Keywords Everywhere' };

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
export function baoCaoNgay({ ten, ngay, du, lichSu, tieu, loiDoc, spy = null, r2 = undefined, don = null, ke = undefined, mayNha = undefined }) {
  const dong = [];
  for (const k of Object.keys(SAN)) {
    const v = du[k]; const t = tieuNgay(lichSu, k);
    if (v == null) { dong.push(`• ${TEN[k]}: chưa đọc được số dư${loiDoc?.[k] ? ` (${loiDoc[k]})` : ''}`); continue; }
    dong.push(`• ${TEN[k]}: còn <b>${hien(k, v)}</b>${t ? ` · tiêu ~${hien(k, t)}/ngày · đủ ~${so(v / t, 1)} ngày` : ''}`);
  }
  const tong = Object.values(tieu).reduce((a, x) => a + x, 0);
  const tieuDong = Object.entries(tieu).sort((a, b) => b[1] - a[1]).map(([p, c]) => `${TEN[p] ?? p} ${so(c / 100 * 26000, 0)}₫`).join(' · ');
  return `<b>${ten} · Phòng Tài nguyên — báo cáo API ${ngay.split('-').reverse().slice(0, 2).join('/')}</b>\n<b>Số dư</b>\n${dong.join('\n')}\n<b>Studio tiêu hôm qua</b> (sổ job, 26.000₫ ≈ $1): ${tong ? `${so(tong / 100 * 26000, 0)}₫ — ${tieuDong}` : 'không có lượt tốn tiền'}${spy ? `\n${dongSpy(spy)}` : ''}${ke !== undefined ? `\n${dongKe(ke)}` : ''}${r2 !== undefined ? `\n${dongR2(r2, don)}` : ''}${mayNha !== undefined ? `\n${dongMayNha(mayNha)}` : ''}`;
}
/** Thuần: dòng "Máy cào nhà (HP)" của báo cáo sáng (anh 06/11/2026) — ảnh chụp máy tự đẩy (spy-on-tc scripts/bao-may-nha.py → /var/lib/spy/may-nha.json).
 *  null = chưa từng gửi; cũ > 15 phút = mất liên lạc (in đậm); còn lại: RAM, ổ C:, CPU, giờ chạy liền, dịch vụ hỏng. */
export function dongMayNha(j, bay = Date.now()) {
  if (!j?.luc) return '<b>Máy cào nhà (HP)</b>: <b>⚠ chưa nhận được tình trạng nào</b>';
  const cu = Math.round((bay - Date.parse(j.luc)) / 6e4);
  if (cu > 15) return `<b>Máy cào nhà (HP)</b>: <b>⚠ mất liên lạc ${cu} phút</b> (ngủ / mất mạng / mất điện?)`;
  const chet = Object.entries(j.dv ?? {}).filter(([, t]) => t !== 'active').map(([u]) => u);
  return `<b>Máy cào nhà (HP)</b>: RAM trống ${so((j.ramMB ?? 0) / 1024, 1)}/${so((j.ramTongMB ?? 0) / 1024, 1)} GB · ổ C: ${j.diaC ?? '?'}% (còn ${j.diaCConGB ?? '?'} GB) · CPU ${j.ban ?? '?'}% · chạy liền ${so(j.chayGio ?? 0, 1)} giờ · `
    + (chet.length ? `<b>⚠ dịch vụ hỏng: ${chet.join(', ')}</b>` : `${Object.keys(j.dv ?? {}).length} dịch vụ chạy đủ`);
}
/** Thuần: dòng "Spy AI hôm qua" theo tuyến — chính hãng phải gần 0 (anh 26/10/2026: ckey trước, chính hãng luôn cuối); chính hãng > 10% tổng = in đậm cảnh báo. */
export function dongSpy(spy) {
  const tong = (spy.ckey || 0) + (spy.fal || 0) + (spy.chinh_hang || 0); if (!tong) return '<b>Spy AI hôm qua</b>: không có lượt tốn tiền';
  const pt = Math.round((spy.chinh_hang || 0) / tong * 100);
  return `<b>Spy AI hôm qua</b>: ${so(tong, 0)}₫ — ckey ${so(spy.ckey || 0, 0)}₫ · fal ${so(spy.fal || 0, 0)}₫ · chính hãng ${so(spy.chinh_hang || 0, 0)}₫${pt > 10 ? ` · <b>⚠ chính hãng ${pt}% — người bán ckey đang hỏng?</b>` : ''}`;
}
/** Thuần: hoạt động KE (hd = hoatDongKe) → cảnh báo. Lỗi: KE_LOI_LIEN lượt gần nhất đều lỗi (trong 24 giờ) — khoá hỏng / hết credit / KE sập;
 *  tiêu: hôm nay đã tới KE_SAT_TRAN trần ngày của spy (server/ke.mjs KE_TRAN_NGAY) — có thứ gọi lố. Không phải máy móc (khoá api:, không vào hàng thợ máy). */
export const KE_LOI_LIEN = 3, KE_SAT_TRAN = 0.8;
export function xetKe(hd) {
  if (!hd) return [];
  const ra = [], cuoi = hd.cuoi ?? [];
  if (cuoi.length >= KE_LOI_LIEN && cuoi.slice(0, KE_LOI_LIEN).every((l) => !l.ok)) ra.push({ khoa: 'api:ke:loi', chu: `Keywords Everywhere: ${KE_LOI_LIEN} lượt gọi gần nhất đều lỗi — lỗi cuối: ${String(cuoi[0].loi || '?').slice(0, 120)}` });
  if (hd.tran && hd.hom_nay >= hd.tran * KE_SAT_TRAN) ra.push({ khoa: 'api:ke:tieu', chu: `Keywords Everywhere: hôm nay đã tiêu <b>${so(hd.hom_nay, 0)} credit</b> / trần ${so(hd.tran, 0)} — xem ai đang gọi (spy.on.tc › Công cụ › Từ khoá Google)` });
  return ra;
}
/** Thuần: dòng "KE hôm qua" của báo cáo sáng. */
export const dongKe = (hd) => (!hd ? '<b>Keywords Everywhere hôm qua</b>: chưa đọc được sổ' : !hd.qua_luot ? '<b>Keywords Everywhere hôm qua</b>: không có lượt gọi'
  : `<b>Keywords Everywhere hôm qua</b>: ${so(hd.qua_luot, 0)} lượt · ${so(hd.qua_credit, 0)} credit${hd.qua_loi ? ` · <b>${so(hd.qua_loi, 0)} lỗi</b>` : ''}`);
/** Sổ ke_luot của spy: hôm qua (ngày VN) + hôm nay + 5 lượt cuối trong 24 giờ. Trần ngày đọc từ server/ke.mjs không được (khác repo) → KE_TRAN (cùng số 3.000). */
const KE_TRAN = 3000;
export function hoatDongKe(ngayQua) {
  const url = docEnvTep('/root/.secrets/spy.env').DATABASE_URL; if (!url) return null;
  const sql = `SELECT json_build_object(
    'qua_luot', count(*) FILTER (WHERE (luc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = '${ngayQua}'::date),
    'qua_credit', coalesce(sum(credit) FILTER (WHERE (luc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = '${ngayQua}'::date), 0),
    'qua_loi', count(*) FILTER (WHERE (luc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = '${ngayQua}'::date AND NOT ok),
    'hom_nay', coalesce(sum(credit) FILTER (WHERE (luc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date), 0),
    'cuoi', (SELECT coalesce(json_agg(x), '[]') FROM (SELECT ok, loi FROM ke_luot WHERE luc > now() - interval '24 hours' ORDER BY id DESC LIMIT 5) x)) FROM ke_luot`;
  const out = execFileSync('psql', [url, '-tA', '-c', sql], { encoding: 'utf8', timeout: 20000 });
  return { ...JSON.parse(out.trim()), tran: KE_TRAN };
}
/** Tiền spy AI theo tuyến trong MỘT ngày VN (sổ ai_luot của spy, chi_phi USD → ₫ theo 26.000). */
export function tieuSpy(ngay) {
  const url = docEnvTep('/root/.secrets/spy.env').DATABASE_URL; if (!url) return null;
  const out = execFileSync('psql', [url, '-tAF', '|', '-c', `SELECT CASE WHEN model LIKE 'ckey:%' THEN 'ckey' WHEN model LIKE 'fal:%' THEN 'fal' ELSE 'chinh_hang' END, round(sum(chi_phi) * 26000) FROM ai_luot WHERE (luc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = '${ngay}'::date GROUP BY 1`], { encoding: 'utf8', timeout: 20000 });
  return Object.fromEntries(out.trim().split('\n').filter(Boolean).map((r) => r.split('|')).map(([k, v]) => [k, Number(v) || 0]));
}

export const docEnvTep = (f) => { try { return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])); } catch { return {}; } };
const lay = async (url, o = {}) => { const r = await fetch(url, { ...o, signal: AbortSignal.timeout(20000) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`HTTP ${r.status}`); return j; };

/** KHOÁ CỔNG TỪ VAULT MOS2 (platform_accounts.api_token_enc, mã bằng MOS2_SECRET_KEY) — cổng anh đưa khoá ở chat (TokenHot #686, FlatKey #687, 04/11/2026)
 *  không cần ghi thêm biến vào .env; câu SQL đi qua stdin để khoá giải mã không nằm trên dòng lệnh. */
export function khoaVault(e, nen) {
  if (!e.DATABASE_URL || !e.MOS2_SECRET_KEY) throw new Error('thiếu DATABASE_URL / MOS2_SECRET_KEY');
  const out = execFileSync('psql', [e.DATABASE_URL, '-tA', '-v', `k=${e.MOS2_SECRET_KEY}`], { encoding: 'utf8', timeout: 20000,
    input: `select pgp_sym_decrypt(decode(api_token_enc, 'base64'), :'k') from platform_accounts where platform_key = '${nen.replace(/[^a-z0-9_-]/g, '')}' and api_token_enc is not null and status = 'active' order by id limit 1;` });
  const k = out.trim(); if (!k) throw new Error(`vault chưa có khoá ${nen}`); return k;
}
/** Cổng kiểu new-api (OpenAI-compatible): số dư = hạn mức khoá − đã dùng (total_usage tính bằng cent). Khoá đặt "không giới hạn" thì API không cho biết số dư tài khoản. */
const soDuNewApi = async (goc, k) => { const h = { headers: { authorization: `Bearer ${k}` } };
  const [a, b] = await Promise.all([lay(`${goc}/v1/dashboard/billing/subscription`, h), lay(`${goc}/v1/dashboard/billing/usage?start_date=2026-01-01&end_date=2099-01-01`, h)]);
  if (!(a.hard_limit_usd < 1e6)) throw new Error(`khoá không giới hạn — số dư chỉ xem ở console (đã dùng $${(b.total_usage / 100).toFixed(2)})`);
  return Math.round((a.hard_limit_usd - b.total_usage / 100) * 100) / 100; };

/** Đọc số dư mọi cổng có API. Trả { du: {k: số | null}, loi: {k: lý do} } — lỗi một cổng không làm hỏng cổng khác. */
export async function docSoDu() {
  const e = { ...docEnvTep(ENV_STUDIO), ...process.env }; const du = {}, loi = {};
  const thu = async (k, f) => { try { du[k] = await f(); } catch (x) { du[k] = null; loi[k] = String(x.message ?? x).slice(0, 80); } };
  await Promise.all([
    thu('tokenhot', async () => soDuNewApi('https://tokenhot.ai', khoaVault(e, 'tokenhot'))),
    thu('flatkey', async () => soDuNewApi('https://router.flatkey.ai', khoaVault(e, 'flatkey'))),
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
    // Keywords Everywhere (anh 02/11/2026): khoá nằm ở spy.env — spy là chỗ duy nhất gọi KE (server/ke.mjs); đọc số dư miễn phí
    thu('ke', async () => { const k = docEnvTep('/root/.secrets/spy.env').KE_API_KEY; if (!k) throw new Error('thiếu khoá KE_API_KEY (spy.env)'); const j = await lay('https://api.keywordseverywhere.com/v1/account/credits', { headers: { authorization: `Bearer ${k}` } }); const v = Number(Array.isArray(j) ? j[0] : j?.credits); if (!Number.isFinite(v)) throw new Error('trả lạ'); return v; }),
    // Donk (anh 12/11/2026 "trạng thái của token donk phải chuyển cho phòng tài nguyên"): gói Claude trả trước của shopdonk.com, khoá DONK_API_KEY
    // (.env.production, vault #693). /api/token/check trả quota đơn vị nhà cung cấp (limit/used/remaining) → số dư quy ra ₫ của gói
    // (DONK_GOI_VND, mặc định 20.000₫ = gói 50M) để tieuNgay / cảnh báo "còn N ngày" dùng chung với cổng khác. Khoá không ACTIVE = lỗi.
    // GỐI ĐẦU (12/11/2026): DONK_API_KEY = nhiều khoá cách bằng dấu phẩy (gói cũ trước) → số dư = CỘNG mọi khoá còn ACTIVE; ₫ quy theo đơn giá đơn vị đo được
    // (gói 20.000₫ = 7,5 triệu đơn vị, gói 197.000₫ = 75 triệu — cùng ~0,00266₫ / đơn vị). Khoá hết gói / khoá chết không làm cả dòng lỗi, chỉ khi KHÔNG khoá nào sống.
    thu('donk', async () => { const ks = String(e.DONK_API_KEY ?? '').split(',').map((k) => k.trim()).filter(Boolean); if (!ks.length) throw new Error('thiếu khoá DONK_API_KEY');
      let con = 0, song = 0; const loi = [];
      for (const k of ks) { try { const j = await lay('https://shopdonk.com/api/token/check', { headers: { authorization: `Bearer ${k}`, 'user-agent': 'Mozilla/5.0' } });
        const d = j?.data, qu = d?.quota; if (!d?.ok || d.status !== 'ACTIVE' || !(qu?.limit > 0)) { loi.push(`…${k.slice(-4)} ${d?.status ?? 'không đọc được'}`); continue; }
        song++; con += qu.remaining; } catch (x) { loi.push(`…${k.slice(-4)} ${x.message}`); } }
      if (!song) throw new Error(`không khoá donk nào sống: ${loi.join(' · ')}`);
      return Math.round(con * Number(e.DONK_VND_DV || 20000 / 7_500_000)); }),
    thu('fal', async () => { if (!e.FAL_ADMIN_KEY) throw new Error('thiếu khoá FAL_ADMIN_KEY (quyền billing:usage:read)'); const j = await lay('https://rest.alpha.fal.ai/billing/user_balance', { headers: { authorization: `Key ${e.FAL_ADMIN_KEY}` } }); const v = Number(typeof j === 'object' ? j.balance ?? j.credits : j); if (!Number.isFinite(v)) throw new Error('trả lạ'); return Math.round(v * 100) / 100; }),
  ]);
  return { du, loi };
}

/** Thuần: cửa sổ ngày của truy vấn R2 — CÙNG lịch giờ VN với hệ số tháng của tinhR2. 01/11/2026: cửa sổ theo UTC (còn 31/10) kéo thao tác
 *  cả tháng 10, tinhR2 theo giờ VN (ngày 1) nhân 30 → báo ~186.000₫ thay vì ~21.000₫. s = 10 ngày trước · m = đầu tháng · e = hôm nay. */
export function cuaSoR2(bay = Date.now()) {
  const e = ngayVN(bay);
  return { s: ngayVN(bay - 10 * 864e5), m: `${e.slice(0, 8)}01`, e };
}

/** Đọc R2 qua Cloudflare GraphQL: dung lượng 10 ngày gần nhất + thao tác từ đầu tháng (ngày theo giờ VN, xem cuaSoR2). */
export async function docR2(bay = Date.now()) {
  const e = { ...docEnvTep(ENV_STUDIO), ...process.env };
  if (!e.CF_EMAIL || !e.CF_API_KEY || !e.R2_ACCOUNT_ID || !e.R2_BUCKET) throw new Error('thiếu CF_EMAIL / CF_API_KEY / R2_ACCOUNT_ID / R2_BUCKET');
  const { s, m, e: homNay } = cuaSoR2(bay);
  const query = `query($a:String!,$b:String!,$s:Date!,$m:Date!,$e:Date!){viewer{accounts(filter:{accountTag:$a}){
    luu:r2StorageAdaptiveGroups(limit:10,filter:{bucketName:$b,date_geq:$s,date_leq:$e},orderBy:[date_DESC]){max{payloadSize objectCount} dimensions{date}}
    thao:r2OperationsAdaptiveGroups(limit:100,filter:{bucketName:$b,date_geq:$m,date_leq:$e}){sum{requests} dimensions{actionType}}}}}`;
  const j = await lay('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Auth-Email': e.CF_EMAIL, 'X-Auth-Key': e.CF_API_KEY },
    body: JSON.stringify({ query, variables: { a: e.R2_ACCOUNT_ID, b: e.R2_BUCKET, s, m, e: homNay } }) });
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
  let ke = null; try { ke = hoatDongKe(ngayVN(bay - 864e5)); } catch { /* sổ spy không đọc được: báo cáo ghi "chưa đọc được sổ" */ }
  const canhBao = [...xetCanhBaoApi(du, st.lich), ...xetCanhBaoR2(r2), ...xetKe(ke),
    ...(st.don?.ngay === ngay && st.don.loi ? [{ khoa: 'box3:don-rac', chu: `Máy dọn rác R2 (xuong-video/scripts/don-rac-r2.mts) hỏng đêm nay: ${st.don.loi}` }] : []),
    ...(st.don?.ngay === ngay && st.don.dung ? [{ khoa: 'r2:don-phanh', chu: `Máy dọn rác R2 kéo phanh, không dọn: ${st.don.dung}` }] : [])];
  let bao = null;
  if (st.baoNgay !== ngay && gioVN(bay) >= GIO_BAO) {
    let tieu = {}; try { tieu = tieuTheoCong(ngayVN(bay - 864e5)); } catch { /* sổ job không đọc được: báo số dư vẫn gửi */ }
    let spy = null; try { spy = tieuSpy(ngayVN(bay - 864e5)); } catch { /* sổ spy không đọc được: phần còn lại vẫn gửi */ }
    let mayNha = null; try { mayNha = JSON.parse(fs.readFileSync('/var/lib/spy/may-nha.json', 'utf8')); } catch { /* chưa gửi: dòng ghi "chưa nhận được" */ }
    bao = baoCaoNgay({ ten, ngay, du, lichSu: st.lich, tieu, loiDoc: loi, spy, r2, don: st.don?.ngay === ngay ? st.don : null, ke, mayNha });
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
    assert.deepStrictEqual(cuaSoR2(Date.parse('2026-10-31T19:00:00Z')), { s: '2026-10-22', m: '2026-11-01', e: '2026-11-01' }, '02:00 sáng 1/11 VN: cửa sổ thao tác bắt đầu 1/11, không kéo cả tháng 10');
    const dr = dongR2(r, { da_chuyen_rac: 1200, rac_mb: 3400, con_lai: 0, da_xoa_han: 0, xoa_han_mb: 0, thung_rac_mb: 3400 });
    assert.ok(dr.includes('61,4 GB') && dr.includes('61.718 tệp') && dr.includes('dời 1.200 tệp (3,4 GB)') && dr.includes('~20.051₫ ($0,77)'), dr);
    assert.ok(dongR2(null, { dung: 'nghi quét sót' }).includes('phanh kéo') && dongR2(r, { loi: 'tsx hỏng' }).includes('hỏng — tsx hỏng'));
    assert.ok(baoCaoNgay({ ten: 'Nguyên', ngay: '2026-10-31', du: {}, lichSu: [], tieu: {}, r2: r }).includes('Kho tệp R2'), 'báo cáo có dòng R2');
    const B6 = Date.parse('2026-11-06T01:00:00Z'), mn = (phut, x = {}) => ({ luc: new Date(B6 - phut * 6e4).toISOString(), ramMB: 8089, ramTongMB: 11963, diaC: 35, diaCConGB: 163, ban: 40, chayGio: 2.9, dv: { a: 'active', b: 'active' }, ...x });
    assert.ok(dongMayNha(mn(3), B6).includes('2 dịch vụ chạy đủ') && dongMayNha(mn(3), B6).includes('ổ C: 35%'), 'máy nhà bình thường: RAM / ổ / dịch vụ');
    assert.ok(dongMayNha(mn(40), B6).includes('mất liên lạc 40 phút'), 'máy nhà im 40 phút: in đậm mất liên lạc');
    assert.ok(dongMayNha(mn(3, { dv: { a: 'active', b: 'failed' } }), B6).includes('dịch vụ hỏng: b'), 'dịch vụ hỏng: nêu tên');
    assert.ok(dongMayNha(null).includes('chưa nhận được'), 'chưa từng gửi');
    assert.ok(baoCaoNgay({ ten: 'Nguyên', ngay: '2026-11-06', du: {}, lichSu: [], tieu: {}, mayNha: mn(3) }).includes('Máy cào nhà (HP)'), 'báo cáo sáng có dòng máy nhà');
    assert.ok(!baoCaoNgay({ ten: 'Nguyên', ngay: '2026-10-31', du: {}, lichSu: [], tieu: {} }).includes('Kho tệp R2'), 'gọi cũ không truyền r2: không thêm dòng');
    // Keywords Everywhere
    const kk = (hd) => xetKe(hd).map((c) => c.khoa);
    assert.deepStrictEqual(kk({ hom_nay: 10, tran: 3000, cuoi: [{ ok: true }, { ok: false }, { ok: false }] }), [], 'lượt cuối OK: im');
    assert.deepStrictEqual(kk({ hom_nay: 10, tran: 3000, cuoi: [{ ok: false, loi: 'HTTP 401' }, { ok: false }, { ok: false }] }), ['api:ke:loi'], '3 lượt cuối lỗi → báo');
    assert.deepStrictEqual(kk({ hom_nay: 10, tran: 3000, cuoi: [{ ok: false }, { ok: false }] }), [], 'mới 2 lượt lỗi: chưa báo');
    assert.deepStrictEqual(kk({ hom_nay: 2500, tran: 3000, cuoi: [] }), ['api:ke:tieu'], 'tiêu 83% trần ngày → báo');
    assert.deepStrictEqual(kk(null), [], 'sổ không đọc được: không báo bừa');
    assert.deepStrictEqual(k({ ke: 4000 }), ['api:ke:san'], 'KE dưới 5.000 credit → anh nạp');
    assert.ok(dongKe({ qua_luot: 4, qua_credit: 52, qua_loi: 1 }).includes('4 lượt · 52 credit · <b>1 lỗi</b>') && dongKe({ qua_luot: 0 }).includes('không có lượt') && dongKe(null).includes('chưa đọc'));
    const tk = baoCaoNgay({ ten: 'Nguyên', ngay: '2026-11-02', du: { ke: 94549 }, lichSu: [], tieu: {}, ke: { qua_luot: 2, qua_credit: 11, qua_loi: 0 } });
    assert.ok(tk.includes('Keywords Everywhere: còn <b>94.549 credit</b>') && tk.includes('Keywords Everywhere hôm qua</b>: 2 lượt · 11 credit'), tk);
    console.log('tai-nguyen-api tu-kiem ok');
  } else if (process.argv.includes('--in')) {
    const { du, loi } = await docSoDu(); console.log(du, loi);
    let r2 = null; try { r2 = await docR2(); } catch (x) { console.error('✗ R2:', x.message); } console.log(r2, xetCanhBaoR2(r2));
    console.log(baoCaoNgay({ ten: 'Nguyên', ngay: ngayVN(), du, lichSu: [], tieu: (() => { try { return tieuTheoCong(ngayVN(Date.now() - 864e5)); } catch { return {}; } })(), loiDoc: loi, r2 }));
  }
}

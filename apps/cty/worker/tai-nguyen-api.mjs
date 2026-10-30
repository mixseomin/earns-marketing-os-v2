// PHÒNG TÀI NGUYÊN · SỐ DƯ CỔNG API (anh 20/10/2026: "có phòng quản lý các API này về hiện trạng như balance… và báo cáo hàng ngày qua telegram").
// Chạy TRONG nhịp kiem-tai-nguyen (tai-nguyen.mjs, mỗi 30 phút trên box3) — không có tiến trình riêng. $0: chỉ đọc số dư, không gọi mô hình.
//   Số dư đọc thẳng từ cổng: ShopAIKey (trần − đã dùng, credit $1 = 3.250₫) · Kie.ai (credit) · RunPod ($) · PlenX AI (credit, 100₫/credit — token studio) · fal.ai ($, khoá FAL_ADMIN_KEY).
//   ckey.vn KHÔNG đọc (anh 26/10/2026 "CKEY bỏ"): API số dư cần khoá tài khoản riêng, không có.
//   Tiền đã tiêu hôm qua theo cổng: sổ job studio (xv_job.chi_phi_cents, mos2_prod) — gồm cả cổng không có API số dư (Anthropic, Google, fal).
// Cảnh báo (cùng chủ đề 🧰 Tài nguyên, nhắc lại sau 6 giờ như cảnh báo khác): số dư dưới SAN, hoặc chỉ còn < NGAY_CON ngày theo mức tiêu 7 ngày.
// Báo cáo ngày: một tin mỗi ngày (giờ VN) ở nhịp đầu tiên sau GIO_BAO.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const ENV_STUDIO = '/opt/earns-marketing-os-v2/.env.production';
export const SAN = { shopaikey: 5, kie: 500, runpod: 2, plenxai: 100, vast: 2, elevenlabs: 1000, fal: 5 };   // $ / credit / $ / ₫ — dưới mức này là báo
export const NGAY_CON = 3; export const GIO_BAO = '08:00';
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

/** Thuần: tin báo cáo ngày (HTML Telegram). tieu = { provider: cents hôm qua } từ sổ job. */
export function baoCaoNgay({ ten, ngay, du, lichSu, tieu, loiDoc, spy = null }) {
  const dong = [];
  for (const k of Object.keys(SAN)) {
    const v = du[k]; const t = tieuNgay(lichSu, k);
    if (v == null) { dong.push(`• ${TEN[k]}: chưa đọc được số dư${loiDoc?.[k] ? ` (${loiDoc[k]})` : ''}`); continue; }
    dong.push(`• ${TEN[k]}: còn <b>${hien(k, v)}</b>${t ? ` · tiêu ~${hien(k, t)}/ngày · đủ ~${so(v / t, 1)} ngày` : ''}`);
  }
  const tong = Object.values(tieu).reduce((a, x) => a + x, 0);
  const tieuDong = Object.entries(tieu).sort((a, b) => b[1] - a[1]).map(([p, c]) => `${TEN[p] ?? p} ${so(c / 100 * 26000, 0)}₫`).join(' · ');
  return `<b>${ten} · Phòng Tài nguyên — báo cáo API ${ngay.split('-').reverse().slice(0, 2).join('/')}</b>\n<b>Số dư</b>\n${dong.join('\n')}\n<b>Studio tiêu hôm qua</b> (sổ job, 26.000₫ ≈ $1): ${tong ? `${so(tong / 100 * 26000, 0)}₫ — ${tieuDong}` : 'không có lượt tốn tiền'}${spy ? `\n${dongSpy(spy)}` : ''}`;
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
  const canhBao = xetCanhBaoApi(du, st.lich);
  let bao = null;
  if (st.baoNgay !== ngay && gioVN(bay) >= GIO_BAO) {
    let tieu = {}; try { tieu = tieuTheoCong(ngayVN(bay - 864e5)); } catch { /* sổ job không đọc được: báo số dư vẫn gửi */ }
    let spy = null; try { spy = tieuSpy(ngayVN(bay - 864e5)); } catch { /* sổ spy không đọc được: phần còn lại vẫn gửi */ }
    bao = baoCaoNgay({ ten, ngay, du, lichSu: st.lich, tieu, loiDoc: loi, spy });
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
    console.log('tai-nguyen-api tu-kiem ok');
  } else if (process.argv.includes('--in')) {
    const { du, loi } = await docSoDu(); console.log(du, loi);
    console.log(baoCaoNgay({ ten: 'Nguyên', ngay: ngayVN(), du, lichSu: [], tieu: (() => { try { return tieuTheoCong(ngayVN(Date.now() - 864e5)); } catch { return {}; } })(), loiDoc: loi }));
  }
}

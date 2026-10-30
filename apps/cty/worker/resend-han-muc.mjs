// HẠN MỨC RESEND (anh 31/10/2026: "thông báo nếu resend vượt trần phải trả phí để không bị lỡ — tự động hoàn toàn").
// Astrolas gửi thư xác minh / chào mừng qua Resend gói miễn phí (100 thư/ngày, 3.000 thư/tháng, tính chung cả militarycalc.com cùng tài khoản).
// Vượt trần thì Resend trả 429 và thư xác minh lúc đăng ký không đi — khách không xác minh được. Hằng (Phòng Astrolas) đọc GET /usage mỗi 30 phút,
// chạm 70% / 90% / 100% của trần ngày hoặc trần tháng → một tin vào chủ đề Astrolas trên MINE, mỗi mức một lần mỗi kỳ. Máy chỉ nhắc, không tự nâng gói (khoản phí = mức 3).
// Khoá đọc hạn mức: /root/.secrets/resend.env (RESEND_KEY, khoá `cty-han-muc` của tài khoản Resend #475). 0đ, không gọi mô hình.
import fs from 'node:fs';
import path from 'node:path';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const tepSt = () => path.join(DATA(), 'resend-han-muc.json');
const MUC = [70, 90, 100], KIEM_MOI_PHUT = 30;
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const giuVn = (iso) => new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

/** Mức cần báo mới: [{ ky: 'daily'|'monthly', muc, used, limit, resets_at }] — mỗi (kỳ, mốc reset, mức) chỉ một lần; da = khoá đã báo. */
export function canBao(usage, da = []) {
  const ra = [];
  for (const ky of ['daily', 'monthly']) {
    const e = usage?.emails?.[ky]; if (!e || !e.limit) continue;   // limit null = gói trả phí không trần ngày
    const pt = (e.used / e.limit) * 100, muc = [...MUC].reverse().find((m) => pt >= m);
    if (muc && !da.includes(`${ky}|${e.resets_at}|${muc}`)) ra.push({ ky, muc, used: e.used, limit: e.limit, resets_at: e.resets_at });
  }
  return ra;
}
export const khoa = (x) => `${x.ky}|${x.resets_at}|${x.muc}`;

export function tinBao(x) {
  const ten = x.ky === 'daily' ? 'ngày' : 'tháng', het = x.muc >= 100;
  return [`${het ? '🔴' : x.muc >= 90 ? '🟠' : '🟡'} <b>Resend: đã dùng ${x.used}/${x.limit} thư trong ${ten} (${Math.floor((x.used / x.limit) * 100)}%)</b>`,
    het ? `Đã chạm trần ${ten}: thư xác minh lúc khách đăng ký Astrolas sẽ KHÔNG gửi được cho tới ${esc(giuVn(x.resets_at))} (giờ VN).`
      : `Chạm trần ${ten} thì thư xác minh lúc khách đăng ký Astrolas không gửi được. Trần làm mới lúc ${esc(giuVn(x.resets_at))} (giờ VN).`,
    `Cần anh: nâng gói Resend Pro ($20/tháng, 50.000 thư, bỏ trần ngày) ở <a href="https://resend.com/settings/billing">resend.com · Billing</a> (tài khoản htuan82). Hằng chỉ nhắc, không tự trả phí.`,
    '', '<a href="https://cty.on.tc/phong/astrolas">↗ cty · Phòng Astrolas</a>'].join('\n');
}

async function docUsage() {
  if (!process.env.RESEND_KEY) try { for (const l of fs.readFileSync('/root/.secrets/resend.env', 'utf8').split('\n')) { const m = l.match(/^RESEND_KEY=(\S+)/); if (m) process.env.RESEND_KEY = m[1]; } } catch { /* không phải box */ }
  if (!process.env.RESEND_KEY) throw new Error('thiếu RESEND_KEY (/root/.secrets/resend.env)');
  const r = await fetch('https://api.resend.com/usage', { headers: { Authorization: `Bearer ${process.env.RESEND_KEY}` }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`resend /usage ${r.status}`);
  return r.json();
}

/** Nhịp: gọi từ NHIP['kiem-resend'] (nhip.mjs) mỗi phút; đọc Resend mỗi 30 phút. */
export async function nhipResend() {
  let st = {}; try { st = JSON.parse(fs.readFileSync(tepSt(), 'utf8')); } catch { /* lần đầu */ }
  if (st.luc && Date.now() - Date.parse(st.luc) < KIEM_MOI_PHUT * 60e3) return `đã đọc lúc ${giuVn(st.luc)} · ngày ${st.ngay ?? '?'} · tháng ${st.thang ?? '?'}`;
  const u = await docUsage(), moi = canBao(u, st.da ?? []);
  st = { ...st, luc: new Date().toISOString(), ngay: `${u.emails.daily.used}/${u.emails.daily.limit}`, thang: `${u.emails.monthly.used}/${u.emails.monthly.limit}` };
  if (moi.length) {
    const { tgNoiDung } = await import('./kiem-bai.mjs'), { topicPhong } = await import('./tg-phong.mjs');
    const { tg } = await tgNoiDung(), topic = await topicPhong('astrolas', 'Astrolas', tg);
    if (!topic) throw new Error('phòng Astrolas chưa có chủ đề Telegram (tg-astrolas.json)');
    for (const x of moi) {
      const j = await tg('sendMessage', { message_thread_id: topic, text: tinBao(x), parse_mode: 'HTML' });
      if (!j.ok) throw new Error(`telegram: ${j.description}`);
      st.da = [...(st.da ?? []), khoa(x)].slice(-40);
    }
  }
  fs.mkdirSync(DATA(), { recursive: true }); fs.writeFileSync(tepSt(), JSON.stringify(st));
  return `ngày ${st.ngay} · tháng ${st.thang}${moi.length ? ` · báo ${moi.map((x) => `${x.ky === 'daily' ? 'ngày' : 'tháng'} ${x.muc}%`).join(', ')}` : ''}`;
}

if (process.argv[1]?.endsWith('resend-han-muc.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  const u = (dU, mU, dL = 100) => ({ emails: { daily: { used: dU, limit: dL, resets_at: '2026-10-31T23:59:59Z' }, monthly: { used: mU, limit: 3000, resets_at: '2026-11-24T03:38:40Z' } } });
  t.deepEqual(canBao(u(3, 3)), [], 'dưới 70% → không báo');
  t.deepEqual(canBao(u(70, 3)).map((x) => [x.ky, x.muc]), [['daily', 70]], 'chạm 70% ngày');
  t.deepEqual(canBao(u(95, 2800)).map((x) => [x.ky, x.muc]), [['daily', 90], ['monthly', 90]], 'ngày + tháng cùng lúc, lấy mức cao nhất');
  t.deepEqual(canBao(u(100, 3)).map((x) => x.muc), [100], 'chạm trần');
  t.deepEqual(canBao(u(95, 3), ['daily|2026-10-31T23:59:59Z|90']), [], 'đã báo mức này trong kỳ → không báo lại');
  t.deepEqual(canBao(u(100, 3), ['daily|2026-10-31T23:59:59Z|90']).map((x) => x.muc), [100], 'lên mức mới → báo tiếp');
  t.deepEqual(canBao(u(95, 3), ['daily|2026-10-30T23:59:59Z|90']).map((x) => x.muc), [90], 'kỳ mới (mốc reset khác) → báo lại');
  t.deepEqual(canBao({ emails: { daily: { used: 500, limit: null }, monthly: { used: 10, limit: 50000 } } }), [], 'gói trả phí: trần ngày null → bỏ qua');
  const m = tinBao(canBao(u(100, 3))[0]);
  t.ok(m.includes('100/100') && m.includes('KHÔNG gửi được') && m.includes('resend.com/settings/billing'), 'tin chạm trần có số + hậu quả + chỗ nâng gói');
  t.ok(m.trim().split('\n').at(-1).includes('https://cty.on.tc/phong/astrolas'), 'dòng cuối là link cty (luật tin Telegram cty)');
  const dir = fs.mkdtempSync('/tmp/resend-hm-'); process.env.CTY_DATA_DIR = dir;
  fs.writeFileSync(path.join(dir, 'resend-han-muc.json'), JSON.stringify({ luc: new Date().toISOString(), ngay: '3/100', thang: '3/3000' }));
  t.match(await nhipResend(), /^đã đọc lúc/, 'chưa đủ 30 phút → không gọi Resend');
  fs.rmSync(dir, { recursive: true });
  console.log('✓ resend-han-muc: 70/90/100% ngày + tháng · mỗi mức một lần mỗi kỳ · kỳ mới báo lại · gói trả phí bỏ trần ngày · tin có link cty · 30 phút một lần');
}

// CHI AI ASTROLAS + TUYẾN CKEY (anh 31/10/2026: "fallback từ ckey đến nguồn chính thức để tối ưu chi phí và ổn định").
// Mỗi 30 phút Hằng (Phòng Astrolas) làm hai việc trong MỘT lần gọi POST /api/ops/ai-sync (khoá X-Ops-Key):
//  1) đẩy bảng tuyến ckey sống (/var/lib/spy/ckey-tuyen.json → "dong", do /opt/spy/scripts/bao-tri-ckey.mjs cập nhật) sang
//     Astrolas — Astrolas thử các tuyến này TRƯỚC mọi lần gọi AI, hết tuyến mới về nguồn chính thức;
//  2) nhận số chi AI hôm nay. Phần MIỄN PHÍ (khách gọi AI nhỏ) chạm 70% / 90% / 100% trần ngày → một tin vào chủ đề
//     Astrolas trên MINE, mỗi mức một lần mỗi ngày. Chạm 100% thì Astrolas đã TỰ ngắt các lối đó tới hết ngày.
// Khoá: /root/.secrets/astrolas-ops.env (ASTROLAS_OPS_KEY). 0đ, không gọi mô hình.
import fs from 'node:fs';
import path from 'node:path';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const tepSt = () => path.join(DATA(), 'astrolas-ai.json');
const TUYEN = process.env.CKEY_TUYEN || '/var/lib/spy/ckey-tuyen.json';
const URL_SYNC = process.env.ASTROLAS_AI_SYNC || 'https://astrolas.com/api/ops/ai-sync';
const MUC = [70, 90, 100], KIEM_MOI_PHUT = 30;
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const usd = (n) => '$' + Number(n || 0).toFixed(2);
const LINK = '<a href="https://cty.on.tc/phong/astrolas">↗ cty · Phòng Astrolas</a>';

/** Mức cần báo mới cho số chi hôm nay; da = khoá đã báo ("ngày|mức"). */
export function canBao(s, da = []) {
  if (!s?.free_cap_usd) return [];
  const pt = (s.free_today_usd / s.free_cap_usd) * 100, muc = [...MUC].reverse().find((m) => pt >= m);
  return muc && !da.includes(`${s.date}|${muc}`) ? [{ muc, khoa: `${s.date}|${muc}` }] : [];
}

export function tinBao(s, muc) {
  const tong = Object.entries(s.by_provider || {}).map(([p, v]) => `${esc(p)} ${usd(v.usd)} (${v.calls} lượt)`).join(' · ') || 'chưa có';
  return [`${muc >= 100 ? '🔴' : muc >= 90 ? '🟠' : '🟡'} <b>Astrolas: chi AI miễn phí hôm nay ${usd(s.free_today_usd)} / trần ${usd(s.free_cap_usd)} (${Math.floor((s.free_today_usd / s.free_cap_usd) * 100)}%)</b>`,
    muc >= 100 ? 'Đã chạm trần: các lối AI miễn phí (điền nhanh, đọc ảnh lá số…) đã TỰ NGẮT tới hết ngày. Báo cáo trả phí + chat đã trừ credit vẫn chạy.'
      : 'Phần miễn phí = khách gọi AI nhỏ (điền nhanh, đọc ảnh lá số…). Chạm 100% thì các lối đó tự ngắt tới hết ngày.',
    `Tổng hôm nay (mọi nguồn): ${usd(s.total_today_usd)} — ${tong}.`,
    `Tăng trần: Setting ai_daily_free_cap_usd trên Astrolas (cần anh duyệt). Số tăng đột biến thường là bị dội — xem nhật ký ai-abuse.`,
    '', LINK].join('\n');
}

export const canBaoLoi = (st, now = Date.now()) => !st.loi_bao || now - Date.parse(st.loi_bao) >= 6 * 3600e3;

async function guiTopic(text) {
  const { tgNoiDung } = await import('./kiem-bai.mjs'), { topicPhong } = await import('./tg-phong.mjs');
  const { tg } = await tgNoiDung(), topic = await topicPhong('astrolas', 'Astrolas', tg);
  if (!topic) throw new Error('phòng Astrolas chưa có chủ đề Telegram (tg-astrolas.json)');
  const j = await tg('sendMessage', { message_thread_id: topic, text, parse_mode: 'HTML' });
  if (!j.ok) throw new Error(`telegram: ${j.description}`);
}

async function dongBo() {
  const key = process.env.ASTROLAS_OPS_KEY || (await import('./tai-nguyen-api.mjs')).docEnvTep('/root/.secrets/astrolas-ops.env').ASTROLAS_OPS_KEY;
  if (!key) throw new Error('thiếu ASTROLAS_OPS_KEY (/root/.secrets/astrolas-ops.env)');
  let routes = null;
  try { routes = JSON.parse(fs.readFileSync(TUYEN, 'utf8')).dong || null; } catch { /* bảng tuyến chưa có: chỉ đọc số */ }
  const r = await fetch(URL_SYNC, { method: 'POST', headers: { 'X-Ops-Key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(routes ? { routes } : {}), signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`astrolas ai-sync ${r.status}`);
  return { ...(await r.json()), so_tuyen: routes ? Object.values(routes).flat().length : 0 };
}

/** Nhịp: gọi từ NHIP['kiem-ai-astrolas'] (nhip.mjs) mỗi phút; làm thật mỗi 30 phút. */
export async function nhipAstrolasAi() {
  let st = {}; try { st = JSON.parse(fs.readFileSync(tepSt(), 'utf8')); } catch { /* lần đầu */ }
  if (st.luc && Date.now() - Date.parse(st.luc) < KIEM_MOI_PHUT * 60e3) return `đã đồng bộ lúc ${st.luc.slice(11, 16)} UTC · miễn phí ${st.mien_phi ?? '?'} · ${st.so_tuyen ?? 0} tuyến ckey`;
  let s;
  try { s = await dongBo(); } catch (e) {
    st.luc = new Date().toISOString();
    if (canBaoLoi(st)) { await guiTopic(`⚠️ <b>Hằng không đồng bộ được chi AI / tuyến ckey với Astrolas</b>: ${esc(e.message)}\nAstrolas vẫn chạy bằng bảng tuyến cũ và về nguồn chính thức khi tuyến chết; chỉ là chưa có cảnh báo trần chi tới khi đọc lại được.\n\n${LINK}`); st.loi_bao = st.luc; }
    fs.mkdirSync(DATA(), { recursive: true }); fs.writeFileSync(tepSt(), JSON.stringify(st));
    throw e;
  }
  const moi = canBao(s, st.da ?? []);
  st = { ...st, luc: new Date().toISOString(), loi_bao: undefined, mien_phi: `${usd(s.free_today_usd)}/${usd(s.free_cap_usd)}`, so_tuyen: s.so_tuyen };
  for (const x of moi) { await guiTopic(tinBao(s, x.muc)); st.da = [...(st.da ?? []), x.khoa].slice(-40); }
  fs.mkdirSync(DATA(), { recursive: true }); fs.writeFileSync(tepSt(), JSON.stringify(st));
  return `miễn phí ${st.mien_phi} · tổng ${usd(s.total_today_usd)} · ${s.so_tuyen} tuyến ckey${moi.length ? ` · báo ${moi.map((x) => x.muc + '%').join(', ')}` : ''}`;
}

if (process.argv[1]?.endsWith('astrolas-ai.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  const s = (f, cap = 10) => ({ date: '2026-10-31', free_today_usd: f, free_cap_usd: cap, total_today_usd: f + 1, by_provider: { ckey: { usd: f, calls: 3 } } });
  t.deepEqual(canBao(s(6)), [], 'dưới 70% → không báo');
  t.deepEqual(canBao(s(7)).map((x) => x.muc), [70], 'chạm 70%');
  t.deepEqual(canBao(s(9.5)).map((x) => x.muc), [90], 'lấy mức cao nhất');
  t.deepEqual(canBao(s(9.5), ['2026-10-31|90']), [], 'đã báo mức này hôm nay → im');
  t.deepEqual(canBao(s(10), ['2026-10-31|90']).map((x) => x.muc), [100], 'lên mức mới → báo tiếp');
  t.deepEqual(canBao({ ...s(9.5), date: '2026-11-01' }, ['2026-10-31|90']).map((x) => x.muc), [90], 'ngày mới → báo lại');
  t.deepEqual(canBao(s(5, 0)), [], 'trần 0/thiếu → không chia cho 0');
  const m = tinBao(s(10), 100);
  t.ok(m.includes('TỰ NGẮT') && m.includes('$10.00') && m.includes('ckey $10.00 (3 lượt)'), 'tin chạm trần có số + hậu quả + tổng theo nguồn');
  t.ok(m.trim().split('\n').at(-1).includes('https://cty.on.tc/phong/astrolas'), 'dòng cuối là link cty');
  const dir = fs.mkdtempSync('/tmp/astrolas-ai-'); process.env.CTY_DATA_DIR = dir;
  fs.writeFileSync(path.join(dir, 'astrolas-ai.json'), JSON.stringify({ luc: new Date().toISOString(), mien_phi: '$0.00/$10.00', so_tuyen: 3 }));
  t.match(await nhipAstrolasAi(), /^đã đồng bộ lúc/, 'chưa đủ 30 phút → không gọi Astrolas');
  fs.rmSync(dir, { recursive: true });
  console.log('✓ astrolas-ai: 70/90/100% trần miễn phí · mỗi mức một lần mỗi ngày · ngày mới báo lại · trần 0 an toàn · tin có link cty · 30 phút một lần');
}

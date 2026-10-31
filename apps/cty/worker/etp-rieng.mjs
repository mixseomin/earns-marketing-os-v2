// ETP NHẮN RIÊNG (anh 31/10/2026: chế độ "Chỉ báo Telegram" — "Chat riêng với bot", mỗi người chỉ thấy phần của mình).
// (1) xuTinRieng: tin chat riêng với bot (tg-phong.mjs gomTin xếp vào hộp 'rieng', không bao giờ vào phòng / thư ký) — "/start <mã>" = nối etp:
//     mã do etp.on.tc sinh (action taoMaTelegram → etp.che_do_luat.tg_ma), khớp thì ghi tg_chat + tg_luc rồi xoá mã. Tin khác → một câu trả lời cố định.
// (2) baoRieng: đề xuất bậc MỚI của máy (etp.de_xuat_bac, apps/etp/de-xuat-ngoai.py ghi mỗi giờ) cho người ở chế độ 'bao' đã nối bot → một tin / người;
//     chỉ đề xuất máy thấy lần đầu SAU lúc nối, còn hiện hành (lan_cuoi < 2 giờ), mỗi đề xuất báo một lần (bao_luc). Không nút, không đụng camp.
// Gọi từ dịch vụ nghe (tg-nghe.mjs) mỗi vòng; baoRieng tự giãn 10 phút. Chữ tin không có dấu "?" (ghiNut gắn nút Đồng ý / Không cho câu hỏi).
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const HOP = () => path.join(DATA(), 'tg-hop', 'rieng');
const MOC = () => path.join(DATA(), 'etp-rieng.moc');
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const psql = (cau) => new Promise((ok, hong) => { const p = execFile('psql', [process.env.DATABASE_URL, '-qtA', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { timeout: 60_000, maxBuffer: 16 << 20 }, (e, out, err) => (e ? hong(new Error((err || e.message).slice(-300))) : ok(String(out).trim()))); p.stdin.end(cau); });
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const LOAI = { tang: '↑ tăng bậc', dau_phien: '⇑ lãi đầu phiên', tang30: '⇈ lên $30', moc30: '★ đủ tiêu chí ROAS', nb: '🪜 nhân bản', ha: '↓ giảm bậc', giam: '↘ ROI tụt', tat: '⏸ tắt' };

/** nhận "/start <mã>" → { ma } · tin khác → null (thuần, tự kiểm) */
export const docStart = (text) => { const m = /^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{8,64})\s*$/.exec(String(text ?? '').trim()); return m ? { ma: m[1] } : null; };

/** tên bot (getMe) cất vào xv_khoa_ngoai['tg_bot'] để etp.on.tc dựng link t.me/<bot>?start=<mã> — web không giữ khoá bot */
async function ghiTenBot(tg) {
  const j = await tg('getMe', {}); const ten = j?.result?.username; if (!ten) return;
  await psql(`insert into xv_khoa_ngoai (ten, gia_tri) values ('tg_bot', jsonb_build_object('username', ${lit(ten)})) on conflict (ten) do update set gia_tri = excluded.gia_tri, cap_nhat = now()`);
}

export async function xuTinRieng(tg) {
  let ds = []; try { ds = fs.readdirSync(HOP()).filter((f) => f.endsWith('.json')).sort(); } catch { return 0; }
  for (const f of ds) {
    const tep = path.join(HOP(), f); let x; try { x = JSON.parse(fs.readFileSync(tep, 'utf8')); } catch { fs.rmSync(tep, { force: true }); continue; }
    fs.rmSync(tep, { force: true });
    const m = x.message; if (!m || m.chat?.type !== 'private' || m.from?.is_bot) continue;   // chỉ trả lời chat riêng (nhóm lạ có bot: im)
    const s = docStart(m.text);
    let tra = 'Bot này chỉ gửi đề xuất bậc của máy cho camp của bạn trên etp.on.tc. Tin nhắn ở đây không được xử lý.';
    if (s) {
      const ng = await psql(`update etp.che_do_luat set tg_chat = ${Number(m.chat.id)}, tg_ma = null, tg_luc = now() where tg_ma = ${lit(s.ma)} returning nguoi_id`);
      tra = ng ? '✅ Đã nối etp.on.tc. Từ giờ đề xuất bậc của máy cho camp của bạn sẽ nhắn ở đây (chế độ Chỉ báo).' : 'Mã nối không đúng hoặc đã dùng. Mở etp.on.tc, bấm "Nối Telegram" để lấy link mới.';
      if (ng) await ghiTenBot(tg).catch(() => {});
    }
    await tg('sendMessage', { chat_id: m.chat.id, text: tra });
  }
  return ds.length;
}

export async function baoRieng(tg, { giay = 600 } = {}) {
  try { if (Date.now() - fs.statSync(MOC()).mtimeMs < giay * 1000) return 0; } catch { /* lần đầu */ }
  fs.mkdirSync(DATA(), { recursive: true }); fs.writeFileSync(MOC(), new Date().toISOString());
  const rows = await psql(`select json_agg(r) from (
      select d.nguoi_id, c.tg_chat, d.camp_id, d.loai, d.ns, d.chu, k.ten
      from etp.de_xuat_bac d join etp.che_do_luat c on c.nguoi_id = d.nguoi_id and c.che_do = 'bao' and c.tg_chat is not null
      left join etp.camp_ngoai k on k.camp_id = d.camp_id
      where d.bao_luc is null and d.lan_dau > coalesce(c.tg_luc, now()) and d.lan_cuoi > now() - interval '2 hours'
      order by d.nguoi_id, d.loai, d.camp_id) r`);
  const ds = rows ? JSON.parse(rows) ?? [] : [];
  if (!ds.length) { if (!(await psql(`select 1 from xv_khoa_ngoai where ten = 'tg_bot'`))) await ghiTenBot(tg).catch(() => {}); return 0; }
  const theoNguoi = new Map(); for (const r of ds) { const a = theoNguoi.get(r.nguoi_id) ?? []; a.push(r); theoNguoi.set(r.nguoi_id, a); }
  let n = 0;
  for (const [ng, a] of theoNguoi) {
    const dong = a.slice(0, 30).map((r) => `${LOAI[r.loai] ?? r.loai} · <b>#${r.camp_id}</b> $${Number(r.ns)} — ${esc(String(r.ten ?? '').slice(0, 50))}\n   <i>${esc(String(r.chu ?? '').replace(/^#\S*\s*/, '').slice(0, 160))}</i>`);
    const j = await tg('sendMessage', { chat_id: a[0].tg_chat, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
      text: `🤖 <b>Máy đề xuất ${a.length} việc cho camp của bạn</b> (chỉ đề xuất, máy không đụng camp)\n\n${dong.join('\n')}${a.length > 30 ? `\n… và ${a.length - 30} đề xuất khác trên etp.on.tc` : ''}` });
    if (!j?.ok) { console.error(`✗ etp nhắn riêng người #${ng}: ${j?.description ?? '?'}`); continue; }
    await psql(`update etp.de_xuat_bac set bao_luc = now() where nguoi_id = ${Number(ng)} and bao_luc is null and (camp_id, loai, ns) in (${a.map((r) => `(${Number(r.camp_id)}, ${lit(r.loai)}, ${Number(r.ns)})`).join(', ')})`);
    n += a.length;
  }
  return n;
}

if (process.argv[1]?.endsWith('etp-rieng.mjs') && process.argv.includes('--tu-kiem')) {
  const a = (await import('node:assert')).default;
  a.deepEqual(docStart('/start abcDEF12_-'), { ma: 'abcDEF12_-' });
  a.deepEqual(docStart('/start@ai_bot abcdefgh12'), { ma: 'abcdefgh12' });
  a.equal(docStart('/start'), null); a.equal(docStart('xin chào'), null); a.equal(docStart("/start ab'; drop"), null); a.equal(docStart('/start short'), null);
  console.log('✓ etp-rieng tự kiểm');
}

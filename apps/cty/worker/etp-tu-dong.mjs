// LUẬT TỰ ĐỘNG CHO TÀI KHOẢN TEAM (anh 31/10/2026: "Giống hệt nhà nhưng chỉ áp dụng cho tk của Sơn" → đợt đầu "Ngân sách + tắt trước").
// Người ở chế độ 'tu_dong' (etp.che_do_luat, chỉ người có vai admin etp) + phiên Ethopex riêng còn hạn → mỗi nhịp:
//   (1) máy luật Nhà chấm camp của người đó (luat-ethopex.py --json, chế độ ETP_XEM_NGUOI — chỉ đọc, đúng bộ luật / ngưỡng của Nhà)
//   (2) keHoach(): đúng các việc ngân sách + tắt máy đang tự làm cho Nhà (ethopex.mjs nhipEthopex), cùng công tắc / trần của Nhà:
//       tắt theo T2 / D24 / L3 / L4 / OFF / RL (báo trước một nhịp, D24 tắt ngay) + dừng đêm · tự giảm GB (khi anh đã duyệt gb_tu_giam) + ROI tụt đang âm
//       (công tắc etp.cau_hinh.giam_tu_dong) · tự tăng đầu phiên / tăng bậc / T30 tới trần ethopex-tu-tang.json
//   (3) làm bằng PHIÊN CỦA NGƯỜI ĐÓ (apps/etp/sua-ngoai.py --may: gác mức thang ≤ $30, camp phải chạy, nhịp tăng / giảm nhip_tang.py) → nhắn riêng kết quả.
// CHƯA làm (đợt sau, cần sổ tài khoản / Page / pixel của người đó): nhân bản, thang bộ 2, lên ROAS, thay creative bị từ chối.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const REPO = process.env.MOS2_DIR || '/opt/earns-marketing-os-v2';
const LUAT = path.join(REPO, 'apps/xuong-video/scripts/ethopex/luat-ethopex.py');
const SUA = path.join(REPO, 'apps/etp/sua-ngoai.py');
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const docJ = (f, mac) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return mac; } };
const psql = (cau) => new Promise((ok, hong) => { const p = execFile('psql', [process.env.DATABASE_URL, '-qtA', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { timeout: 60_000, maxBuffer: 16 << 20 }, (e, out, err) => (e ? hong(new Error((err || e.message).slice(-300))) : ok(String(out).trim()))); p.stdin.end(cau); });
const py = (tep, args, env, giay) => new Promise((ok, hong) => execFile('python3', [tep, ...args], { timeout: giay * 1000, maxBuffer: 16 << 20, env: { ...process.env, ...env } }, (e, out, err) => (e && !String(out).trim() ? hong(new Error((err || e.message).slice(-300))) : ok(String(out)))));
const dongCuoi = (s) => JSON.parse(String(s).trim().split('\n').filter((l) => l.startsWith('{')).pop() || '{}');

// luật tắt — cùng khoá + cách tắt với LUAT_TAT của Nhà (ethopex.mjs); ngay = tắt luôn nhịp này, còn lại báo trước một nhịp (≥ 25 phút)
export const TAT = [
  { khoa: 'tat2', ten: 'T2' }, { khoa: 'tat_d24', ten: 'D24', ngay: true }, { khoa: 'tat_l3', ten: 'L3' }, { khoa: 'tat_l4', ten: 'L4' },
  { khoa: 'tat', ten: 'OFF' }, { khoa: 'tat_roas', ten: 'RL' }, { khoa: 'dung_dem', ten: 'dừng đêm', ngay: true },
];
const dich = (m) => Number((String(m.chu).match(/→ \$(\d+)/) || [])[1]) || 0;

/** KẾ HOẠCH một nhịp (thuần, tự kiểm): kq = JSON máy luật · cfg {giamTu, gbDuyet, tran} · cho = {camp: lúc thấy lần đầu} sổ chờ tắt · now
 *  → { viec: [{viec:'tat'|'ns', id, d?, luat}], baoTruoc: [{id, luat, chu}], cho } — một camp một việc, tắt đi trước (giống Nhà: camp sắp tắt không tăng / giảm) */
export function keHoach(kq, cfg, cho = {}, now = Date.now()) {
  const viec = [], baoTruoc = [], xong = new Set(), choMoi = {};
  for (const t of TAT) for (const m of kq[t.khoa] || []) {
    const id = Number(m.id); if (!(id > 0) || xong.has(id)) continue;
    if (t.ngay) { viec.push({ viec: 'tat', id, luat: t.ten }); xong.add(id); continue; }
    const dau = cho[id] ?? now; choMoi[id] = dau;
    if (now - dau >= 25 * 60_000) { viec.push({ viec: 'tat', id, luat: t.ten }); xong.add(id); delete choMoi[id]; }
    else if (dau === now) { baoTruoc.push({ id, luat: t.ten, chu: String(m.chu || '') }); xong.add(id); }
    else xong.add(id);
  }
  // xong = mọi camp trong danh sách tắt (đã tắt / đang chờ tắt) + camp đã có việc → một camp một việc
  const ns = (k, luat, dk = () => true) => { for (const m of kq[k] || []) { const id = Number(m.id), d = dich(m); if (!(id > 0) || !d || xong.has(id) || !dk(m, d)) continue; viec.push({ viec: 'ns', id, d, luat }); xong.add(id); } };
  if (cfg.giamTu && cfg.gbDuyet) ns('ha', 'giảm bậc GB');
  if (cfg.giamTu) ns('giam', 'ROI tụt đang âm', (m) => Number((String(m.chu).match(/3 ngày gần ([+-]?\d+)%/) || [])[1]) < 0);
  if (cfg.tran > 0) for (const [k, luat] of [['dau_phien', 'lãi đầu phiên'], ['tang', 'tăng bậc'], ['tang30', 'T30']]) ns(k, luat, (_m, d) => d <= Math.min(cfg.tran, 30));
  return { viec, baoTruoc, cho: choMoi };
}

const bang = (ds) => '<pre>' + [`${'Camp'.padEnd(8)}${'Việc'.padEnd(12)}Kết quả`, ...ds.map(({ v, r }) => `#${String(v.id).padEnd(7)}${(v.viec === 'tat' ? 'tắt' : `→ $${v.d}`).padEnd(12)}${r.ok ? '✓' : `✕ ${String(r.loi || '').slice(0, 40)}`}`)].map(esc).join('\n') + '</pre>';

export async function nhipTuDong(tg, { giay = 1500 } = {}) {
  const ds = JSON.parse(await psql(`select coalesce(json_agg(r), '[]') from (select c.nguoi_id, c.tg_chat from etp.che_do_luat c, xv_khoa_ngoai k
      where k.ten = 'ethopex_nguoi' and c.che_do = 'tu_dong' and (k.gia_tri->(c.nguoi_id::text)->>'het')::timestamptz > now() + interval '5 minutes'
        and exists (select 1 from etp.quyen q where q.vai = 'admin' and q.nguoi_id = c.nguoi_id)) r`) || '[]');
  if (!ds.length) return 0;
  const tt = docJ(path.join(DATA(), 'ethopex-tu-tang.json'), null);
  const cfg = { giamTu: String(await psql("select gia_tri::text from etp.cau_hinh where khoa = 'giam_tu_dong'").catch(() => '')).trim() !== 'false',
    gbDuyet: !!docJ(path.join(DATA(), 'ethopex-luat-duyet.json'), {}).gb_tu_giam, tran: tt && Date.now() < Date.parse(tt.den) ? Number(tt.tran) || 0 : 0 };
  let n = 0;
  for (const { nguoi_id: ng, tg_chat: chat } of ds) {
    const tepMoc = path.join(DATA(), `etp-tu-dong-${ng}.json`), st = docJ(tepMoc, {});
    if (st.luc && Date.now() - st.luc < giay * 1000) continue;   // cùng nhịp Nhà (~30 phút)
    const kq = dongCuoi(await py(LUAT, ['--json'], { ETP_XEM_NGUOI: String(ng) }, 900));
    const k = keHoach(kq, cfg, st.cho || {});
    const lam = [];
    for (const v of k.viec) {
      let r; try { r = dongCuoi(await py(SUA, [String(ng), v.viec === 'tat' ? 'tat' : 'ns', String(v.id), ...(v.viec === 'ns' ? [String(v.d)] : []), '--may'], {}, 120)); } catch (e) { r = { ok: false, loi: e.message }; }
      lam.push({ v, r });
    }
    fs.writeFileSync(tepMoc, JSON.stringify({ luc: Date.now(), cho: k.cho }));
    if (chat && (lam.length || k.baoTruoc.length)) {
      const phan = [];
      if (lam.length) phan.push(`🤖 <b>Máy tự làm ${lam.filter((x) => x.r.ok).length}/${lam.length} việc trên camp của bạn</b> (Luật tự động, đã đọc lại)\n${bang(lam)}`);
      if (k.baoTruoc.length) phan.push(`⏳ <b>Sắp tắt ${k.baoTruoc.length} camp</b> ở nhịp kế (~30 phút) nếu còn chạm luật:\n${k.baoTruoc.slice(0, 25).map((b) => `#${b.id} · ${esc(b.luat)} — <i>${esc(b.chu.replace(/^#\S*\s*/, '').slice(0, 120))}</i>`).join('\n')}`);
      await tg('sendMessage', { chat_id: chat, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, text: phan.join('\n\n').slice(0, 4000) });
    }
    n += lam.length;
  }
  return n;
}

if (process.argv[1]?.endsWith('etp-tu-dong.mjs') && process.argv.includes('--tu-kiem')) {
  const a = (await import('node:assert')).default;
  const kq = { tat_d24: [{ id: 1, chu: 'x' }], tat2: [{ id: 2, chu: 'lỗ' }], tang: [{ id: 2, chu: '→ $5' }, { id: 3, chu: '→ $5' }], tang30: [{ id: 4, chu: '→ $30' }],
    giam: [{ id: 5, chu: '3 ngày gần -12% → $10' }, { id: 6, chu: '3 ngày gần 8% → $10' }], ha: [{ id: 7, chu: '→ $15' }], dung_dem: [{ id: 3, chu: '' }] };
  const now = 1e12;
  let k = keHoach(kq, { giamTu: true, gbDuyet: false, tran: 30 }, {}, now);
  a.deepEqual(k.viec.filter((v) => v.viec === 'tat').map((v) => v.id).sort(), [1, 3], 'D24 + dừng đêm tắt ngay');
  a.deepEqual(k.baoTruoc.map((b) => b.id), [2], 'T2 báo trước, chưa tắt');
  a.ok(!k.viec.some((v) => v.id === 2 || (v.id === 3 && v.viec === 'ns')), 'camp sắp tắt / đã tắt không tăng');
  a.ok(k.viec.some((v) => v.id === 4 && v.d === 30) && k.viec.some((v) => v.id === 5) && !k.viec.some((v) => v.id === 6) && !k.viec.some((v) => v.id === 7), 'T30 · ROI tụt âm · không GB khi chưa duyệt');
  k = keHoach(kq, { giamTu: true, gbDuyet: false, tran: 30 }, k.cho, now + 26 * 60_000);
  a.ok(k.viec.some((v) => v.id === 2 && v.viec === 'tat'), 'nhịp sau ≥ 25 phút còn chạm → tắt');
  k = keHoach(kq, { giamTu: false, gbDuyet: true, tran: 20 }, {}, now);
  a.ok(!k.viec.some((v) => v.id === 5 || v.id === 7) && !k.viec.some((v) => v.id === 4), 'tắt công tắc giảm → không giảm; trần $20 → không T30');
  a.equal(keHoach(kq, { giamTu: true, gbDuyet: true, tran: 0 }, {}, now).viec.filter((v) => v.viec === 'ns' && v.d > 10).length, 1, 'không quyền tự tăng → chỉ giảm');
  console.log('✓ etp-tu-dong tự kiểm');
}

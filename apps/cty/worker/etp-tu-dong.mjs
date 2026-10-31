// LUẬT TỰ ĐỘNG CHO TÀI KHOẢN TEAM (anh 31/10/2026: "Giống hệt nhà nhưng chỉ áp dụng cho tk của Sơn" → đợt đầu "Ngân sách + tắt trước").
// Người ở chế độ 'tu_dong' (etp.che_do_luat, chỉ người có vai admin etp) + phiên Ethopex riêng còn hạn → mỗi nhịp:
//   (1) máy luật Nhà chấm camp của người đó (luat-ethopex.py --json, chế độ ETP_XEM_NGUOI — chỉ đọc, đúng bộ luật / ngưỡng của Nhà)
//   (2) keHoach(): đúng các việc ngân sách + tắt máy đang tự làm cho Nhà (ethopex.mjs nhipEthopex), cùng công tắc / trần của Nhà:
//       tắt theo T2 / D24 / L3 / L4 / OFF / RL (báo trước một nhịp, D24 tắt ngay) + dừng đêm · tự giảm GB (khi anh đã duyệt gb_tu_giam) + ROI tụt đang âm
//       (công tắc etp.cau_hinh.giam_tu_dong) · tự tăng đầu phiên / tăng bậc / T30 tới trần ethopex-tu-tang.json
//   (3) làm bằng PHIÊN CỦA NGƯỜI ĐÓ (apps/etp/sua-ngoai.py --may: gác mức thang ≤ $30, camp phải chạy, nhịp tăng / giảm nhip_tang.py) → nhắn riêng kết quả.
//   (4) nhân bản camp thắng (luật NB) + lên ROAS (moc30, ROAS_MUC · $20) qua nhan-ban.py chế độ ETP_SUA_NGUOI (Bước 4b, anh 31/10/2026: không cần sổ —
//       bản mới dựng trên đúng tài khoản / Page / pixel của camp gốc; creative nhà dùng được vì cùng co-founder). Mỗi nhịp tối đa ROAS_NHIP gốc lên ROAS
//       (mỗi camp ROAS chờ Ethopex đồng bộ tới 20 phút — nhịp worker không bị giữ quá lâu); gốc bị từ chối có lý do thì nghỉ tới hết ngày, nhân bản lỗi máy nghỉ 6 giờ.
// KHÔNG làm: thang bộ 2 (tài khoản team không phải bộ 2 của nhà → tăng bậc như bộ 1), thay creative bị từ chối.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { ROAS_MUC } from './ethopex.mjs';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const REPO = process.env.MOS2_DIR || '/opt/earns-marketing-os-v2';
const LUAT = path.join(REPO, 'apps/xuong-video/scripts/ethopex/luat-ethopex.py');
const SUA = path.join(REPO, 'apps/etp/sua-ngoai.py');
const NB = path.join(REPO, 'apps/xuong-video/scripts/ethopex/nhan-ban.py');
export const ROAS_NHIP = 1;
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

/** KẾ HOẠCH một nhịp (thuần, tự kiểm): kq = JSON máy luật · cfg {giamTu, gbDuyet, tran, giu?, nbLoi?} · cho = {camp: lúc thấy lần đầu} sổ chờ tắt · now
 *  → { viec: [{viec:'tat'|'ns', id, d?, luat}], baoTruoc: [{id, luat, chu}], cho, nb: [{id, chu}], roas: [{id, chu}] } — một camp một việc ngân sách, tắt đi trước
 *  (giống Nhà: camp sắp tắt không tăng / giảm / nhân bản / lên ROAS; camp vừa đổi ngân sách nhịp này không lên ROAS) */
export function keHoach(kq, cfg, cho = {}, now = Date.now()) {
  const viec = [], baoTruoc = [], xong = new Set(), choMoi = {}, seTat = new Set();
  for (const t of TAT) for (const m of kq[t.khoa] || []) {
    const id = Number(m.id); if (id > 0) seTat.add(id);
    if (!(id > 0) || xong.has(id)) continue;
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
  const giu = cfg.giu || {}, nbLoi = cfg.nbLoi || {};
  const nb = (kq.nb || []).map((m) => ({ id: Number(m.id), chu: String(m.chu || '') })).filter((m) => m.id > 0 && !seTat.has(m.id) && !giu[`nb:${m.id}`] && !(now - (nbLoi[m.id] || 0) < 6 * 3600_000));
  const roas = (kq.moc30 || []).map((m) => ({ id: Number(m.id), chu: String(m.chu || '') })).filter((m) => m.id > 0 && !seTat.has(m.id) && !xong.has(m.id) && !giu[`roas:${m.id}`]).slice(0, ROAS_NHIP);
  return { viec, baoTruoc, cho: choMoi, nb, roas };
}

const nhanViec = (v, r) => ({ tat: 'tắt', ns: `→ $${v.d}`, nb: `NB→#${r.moi ?? '?'}`, roas: `R${v.muc}→#${r.moi ?? '?'}` })[v.viec];
const bang = (ds) => '<pre>' + [`${'Camp'.padEnd(8)}${'Việc'.padEnd(14)}Kết quả`, ...ds.map(({ v, r }) => `#${String(v.id).padEnd(7)}${nhanViec(v, r).padEnd(14)}${r.ok ? '✓' : `${r.chan ? '·' : '✕'} ${String(r.loi || '').slice(0, 40)}`}`)].map(esc).join('\n') + '</pre>';

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
    const homNay = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10), giu = st.giu?.ngay === homNay ? st.giu.ds : {}, nbLoi = st.nbLoi || {};
    const kq = dongCuoi(await py(LUAT, ['--json'], { ETP_XEM_NGUOI: String(ng) }, 900));
    const k = keHoach(kq, { ...cfg, giu, nbLoi }, st.cho || {});
    const lam = [];
    for (const v of k.viec) {
      let r; try { r = dongCuoi(await py(SUA, [String(ng), v.viec === 'tat' ? 'tat' : 'ns', String(v.id), ...(v.viec === 'ns' ? [String(v.d)] : []), '--may'], {}, 120)); } catch (e) { r = { ok: false, loi: e.message }; }
      lam.push({ v, r });
    }
    // nhân bản + lên ROAS bằng phiên của người đó (nhan-ban.py chế độ ETP_SUA_NGUOI: cổng chung chỉ cho tạo vào tài khoản của họ, đủ luật nhà — xem docstring nhan-ban)
    const nbEnv = { ETP_SUA_NGUOI: String(ng) }, ai = 'Luật tự động tài khoản team (anh 31/10/2026)';
    for (const m of k.nb) {
      let r; try { r = dongCuoi(await py(NB, [String(m.id), '--that', '--lich', 'today', '--luat', `nhân bản camp thắng · ${m.chu}`.slice(0, 400), '--ai', ai], nbEnv, 300)); } catch (e) { r = { ok: false, loi: e.message }; }
      if (r.chan) giu[`nb:${m.id}`] = String(r.loi || '').slice(0, 120); else if (!r.ok) nbLoi[m.id] = Date.now();
      lam.push({ v: { viec: 'nb', id: m.id }, r });
    }
    for (const m of k.roas) {
      const ds = await Promise.all(ROAS_MUC.map(async (muc) => {
        let r; try { r = dongCuoi(await py(NB, [String(m.id), '--roas', String(muc), '--ns', '20', '--lich', 'today', '--that', '--luat', `lên ROAS · ${m.chu}`.slice(0, 400), '--ai', ai], nbEnv, 1500)); } catch (e) { r = { ok: false, loi: e.message, may: true }; }
        return { v: { viec: 'roas', id: m.id, muc }, r };
      }));
      // cùng cách Nhà: không mức nào lên được mà mọi mức đều bị từ chối có lý do (không phải hết giờ / mạng) → nghỉ gốc này tới hết ngày; mức đã lên thì nhan-ban chặn trùng tên
      if (!ds.some((x) => x.r.ok) && ds.every((x) => !x.r.may && x.r.loi)) giu[`roas:${m.id}`] = String(ds[0].r.loi).slice(0, 120);
      lam.push(...ds);
    }
    for (const [id, t] of Object.entries(nbLoi)) if (Date.now() - t > 6 * 3600_000) delete nbLoi[id];
    fs.writeFileSync(tepMoc, JSON.stringify({ luc: Date.now(), cho: k.cho, giu: { ngay: homNay, ds: giu }, nbLoi }));
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
  // Bước 4b: nhân bản / lên ROAS không đụng camp đang trong danh sách tắt; ROAS không lên camp vừa đổi ngân sách; tối đa ROAS_NHIP gốc / nhịp; sổ nghỉ
  const kq2 = { ...kq, nb: [{ id: 2, chu: '' }, { id: 8, chu: '' }, { id: 9, chu: '' }], moc30: [{ id: 1, chu: '' }, { id: 4, chu: '' }, { id: 10, chu: '' }, { id: 11, chu: '' }] };
  k = keHoach(kq2, { giamTu: true, gbDuyet: false, tran: 30, nbLoi: { 9: now - 3600_000 } }, {}, now);
  a.deepEqual(k.nb.map((m) => m.id), [8], 'NB: bỏ camp chờ tắt (#2) + camp nhân bản lỗi < 6 giờ (#9)');
  a.deepEqual(k.roas.map((m) => m.id), [10].slice(0, ROAS_NHIP), 'ROAS: bỏ camp tắt (#1) + camp vừa T30 (#4), tối đa ROAS_NHIP gốc');
  k = keHoach(kq2, { giamTu: true, gbDuyet: false, tran: 30, giu: { 'nb:8': 'x', 'roas:10': 'x' }, nbLoi: { 9: now - 7 * 3600_000 } }, {}, now);
  a.deepEqual([k.nb.map((m) => m.id), k.roas.map((m) => m.id)], [[9], [11].slice(0, ROAS_NHIP)], 'gốc bị từ chối hôm nay nghỉ; nhân bản lỗi quá 6 giờ thử lại');
  console.log('✓ etp-tu-dong tự kiểm');
}

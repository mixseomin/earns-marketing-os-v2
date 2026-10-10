#!/usr/bin/env node
// Một LƯỢT vận hành của Phòng thử (cong-ty/phong/thu-nghiem.md) chạy THEO QUY TRÌNH có phiên bản (worker/quy-trinh.mjs):
// v1 = việc → Tâm giao + tiêu chí → Lộc làm → Kỳ soát (trả về tối đa 1 lần) → Tâm viết báo cáo sáng theo AGENTS.md §7. Mọi lượt gọi đi qua proxy (x-cty-staff) nên trần chi + ai_usage áp tự động.
// Nhật ký ghi ${CTY_DATA_DIR:-/var/lib/cty}/nhat-ky/<ts>.json, trang /phong/thu-nghiem đọc lên. Không tự chạy: chỉ khi được gọi
// (nút "Chạy một lượt" hoặc `node worker/ca.mjs --viec "…"`). `--tu-kiem` = proxy giả, $0.
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';
import http from 'node:http';
import { parseFm } from '../scripts/fm.mjs';
import { ghiLog } from './log.mjs';
import { vpBao } from './vp.mjs';
import { hienHanh, dsBan, mayDo, dien, LOAI_DO, quyDinhCuaPhong, tenPhong } from './quy-trinh.mjs';

const DIR = path.join(GOC, 'worker');   // không dùng import.meta.url: xem worker/goc.mjs
const CONG_TY = path.join(DIR, '..', 'cong-ty');
const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const PROXY = () => process.env.CTY_PROXY_URL || 'http://127.0.0.1:3862';   // đọc lúc gọi: tự kiểm đổi env sau khi nạp module
const QT = 'thu-nghiem/lam-viec';   // quy trình mặc định của nút "Chạy một lượt"; lượt khác truyền o.khoa

const doc = (rel) => parseFm(fs.readFileSync(path.join(CONG_TY, rel), 'utf8'));
const luat = fs.readFileSync(path.join(CONG_TY, 'AGENTS.md'), 'utf8');
export const nhanSu = (id, luot) => { const rel = `nhan-su/${id}/SOUL.md`; const d = doc(rel); ghiLog({ luot, loai: 'doc', tu: id, chi_tiet: { tep: rel, ky_tu: d.body.length, ly_do: 'nạp hồ sơ trước ca' } }); return { id, ...d.fm, body: d.body }; };

export async function goi(ns, user, buoc, nk, toi) {
  ghiLog({ luot: nk.ts, loai: 'tin', tu: toi?.tu ?? 'giam-doc', toi: ns.id, chi_tiet: { buoc, noi_dung: user.slice(0, 240) } });
  const body = { model: ns.model, max_tokens: 500, temperature: 0.3,
    system: `Bạn là ${ns.ten}, ${ns.chuc_danh}, ${nk.ten_phong ?? 'công ty'}. LUẬT CHUNG (rút gọn): ba mức quyết định; việc nộp phải có bằng chứng; không khen mở đầu; trả lời đúng định dạng được yêu cầu, không thêm lời dẫn.\n\n${nk.quy_dinh ? `\n\nQUY ĐỊNH DỰ ÁN PHÒNG PHẢI TUÂN THEO (trên quy trình của phòng, không được làm trái):\n${nk.quy_dinh}` : ''}\n\nHỒ SƠ CỦA BẠN:\n${ns.body}`,
    messages: [{ role: 'user', content: user }] };
  await vpBao(ns.id, 'lam', buoc);
  const t0 = Date.now(); const bat_dau = new Date(t0).toISOString();
  const r = await fetch(`${PROXY()}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-cty-staff': ns.id, 'x-cty-luot': nk.ts }, body: JSON.stringify(body) });
  const d = await r.json();
  await vpBao(ns.id, 'xong', buoc);
  const text = r.ok ? (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('') : '';
  nk.buoc.push({ buoc, ai: ns.ten, id: ns.id, model: ns.model, bat_dau, ket_thuc: new Date().toISOString(), ms: Date.now() - t0, http: r.status, usage: d.usage || null, loi: r.ok ? null : d.error || JSON.stringify(d).slice(0, 200), hoi: user, dap: text });
  if (!r.ok) throw new Error(`${ns.ten}: ${r.status} ${d.error || ''}`);
  ghiLog({ luot: nk.ts, loai: 'tin', tu: ns.id, toi: toi?.tu ?? 'giam-doc', chi_tiet: { buoc, tra_loi: text.slice(0, 240) } });
  return text;
}
export const json = (t) => { const m = t.match(/\{[\s\S]*\}/); try { return JSON.parse(m ? m[0] : t); } catch { return null; } };

const MAU_DO = 'so_cau{bang|toi_da} · so_tu{toi_da} · so_ky_tu{toi_da} · so_dong{bang} · so_tu_moi_dong{toi_da} · khong_chua{chuoi:[…]} · ngon_ngu{la:"en"}';

/** Một lượt chạy THEO QUY TRÌNH của phòng (worker/quy-trinh.mjs: hiện hành, hoặc `o.quyTrinh` khi so phiên bản).
 *  Công tắc phòng được tự bật trong biên: so_vong_lam_lai · hoi_lai_khi_thieu_du_kien · may_do · khoa_tieu_chi · het_vong · bao_cao_do_may. */
export async function motLuot(viec, ghi = true, o = {}) {
  const khoa = o.khoa ?? QT; const qt = o.quyTrinh ?? hienHanh(khoa); const L = qt.loi_nhac;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  ghiLog({ luot: ts, loai: 'he-thong', tu: 'giam-doc', chi_tiet: { su_kien: 'bắt đầu lượt', viec, quy_trinh: qt.ban } });
  const nsCache = {}; const N = (id) => (nsCache[id] ??= nhanSu(id, ts));
  const giaoNs = N(qt.nguoi.giao), lamNs = N(qt.nguoi.lam), kiemNs = N(qt.nguoi.kiem), bcNs = N(qt.nguoi.bao_cao);
  // Quy định dự án mà phòng tham gia (cong-ty/quy-dinh/du-an) đi vào lời dặn của mọi người trong lượt; luật chung công ty đã ở system.
  const quyDinh = quyDinhCuaPhong(khoa.split('/')[0]).filter((x) => x.tang === 'du-an' && x.noi_dung).map((x) => `[${x.ten}]\n${x.noi_dung}`).join('\n\n').slice(0, 3000);
  const nk = { ts, bat_dau: new Date().toISOString(), viec, khoa, ten_phong: tenPhong(khoa), quy_trinh: qt.ban, quy_dinh: quyDinh, bo_viec: o.boViec ?? null, trang_thai: 'đang chạy', buoc: [], do_may: [], ket: null };
  const f = path.join(DATA(), 'nhat-ky', `${ts}.json`);
  const luu = () => { if (ghi) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(nk, null, 2)); } };
  const so = () => nk.buoc.length + 1;
  luu();
  try {
    // 1. Giao việc
    let loiGiao = dien(L.giao, { viec });
    if (qt.hoi_lai_khi_thieu_du_kien) loiGiao += '\nNếu việc THIẾU dữ kiện để làm đúng (không rõ đối tượng, ngôn ngữ, nơi đăng, giới hạn) hoặc các ràng buộc MÂU THUẪN nhau đến mức không thể làm đúng, thì KHÔNG giao: trả JSON {"thieu":"<một câu hỏi cụ thể gửi Giám đốc>"}.';
    if (qt.may_do) loiGiao += `\nTiêu chí nào đo được bằng máy thì thêm vào "do" (mỗi phép một trong: ${MAU_DO}), ví dụ {"giao_cho":"loc","viec":"…","tieu_chi":["…"],"do":[{"loai":"so_cau","bang":3}]}.`;
    const giao = json(await goi(giaoNs, loiGiao, `${so()} giao việc`, nk, { tu: 'giam-doc' }));
    let lam = null, soat = null, vong = 0, tt, cauHoi, ghiChu;
    if (giao?.thieu) { tt = 'ket'; cauHoi = String(giao.thieu); }
    else {
      if (!giao?.viec) throw new Error(`${giaoNs.ten} không trả JSON giao việc`);
      const tieuChi = (giao.tieu_chi || []).map((t, i) => `${i + 1}. ${t}`).join('\n');
      const doMay = qt.may_do && Array.isArray(giao.do) ? giao.do.filter((d) => LOAI_DO.includes(d?.loai)) : [];
      const v = () => ({ viec_giao: giao.viec, tieu_chi: tieuChi, ket_qua: lam.ket_qua, bang_chung: lam.bang_chung, ly_do: soat?.ly_do ?? '' });
      lam = json(await goi(lamNs, dien(L.lam, { viec_giao: giao.viec, tieu_chi: tieuChi }), `${so()} làm`, nk, { tu: giaoNs.id }));
      if (!lam?.ket_qua) throw new Error(`${lamNs.ten} không trả JSON kết quả`);
      const kiem = async (lai) => {
        if (doMay.length) {   // máy đếm trước: tất định, 0 đồng; trượt thì trả về luôn, không tốn lượt người kiểm
          const kq = doMay.map((d) => ({ ...d, ...mayDo(d, lam.ket_qua) }));
          const truot = kq.filter((x) => !x.dat);
          nk.do_may.push({ buoc: so(), kq });
          const ly = truot.map((x) => x.mo_ta).join('; ');
          nk.buoc.push({ buoc: `${so()} máy đo`, ai: 'Máy đo', id: 'may-do', model: 'máy', bat_dau: new Date().toISOString(), ket_thuc: new Date().toISOString(), ms: 0, http: 200, usage: null, loi: null, hoi: '', dap: JSON.stringify({ ok: !truot.length, ly_do: truot.length ? ly : kq.map((x) => x.mo_ta).join('; ') }) });
          ghiLog({ luot: ts, loai: 'quyet', tu: 'may-do', chi_tiet: { ok: !truot.length, ly_do: ly || 'đạt mọi phép đo', kq } });
          if (truot.length) return { ok: false, ly_do: `Máy đo: ${ly}`, may: true };
        }
        let loi = dien(lai ? L.soat_lai : L.soat, v());
        if (doMay.length) loi += '\nCác tiêu chí đo được đã được MÁY đếm và ĐẠT — không đếm lại, chỉ chấm phần còn lại.';
        if (qt.khoa_tieu_chi) loi += '\nChỉ được bác theo đúng các tiêu chí đã đánh số ở trên; ghi số tiêu chí trượt vào "truot" (vd [2]). Lý do ngoài danh sách không tính. JSON {"ok":true|false,"truot":[…],"ly_do":"…"}';
        let s = json(await goi(kiemNs, loi, `${so()} ${lai ? 'soát lại' : 'soát'}`, nk, { tu: lamNs.id }));
        if (qt.khoa_tieu_chi && s?.ok === false && !(Array.isArray(s.truot) && s.truot.length)) s = { ...s, ok: true, ly_do: `Bác mà không chỉ ra tiêu chí trượt → không tính (khoá tiêu chí). ${s.ly_do ?? ''}` };
        return s;
      };
      soat = await kiem(false);
      while (soat && soat.ok === false && vong < qt.so_vong_lam_lai) {
        vong++;
        lam = json(await goi(lamNs, dien(L.lam_lai, v()), `${so()} làm lại`, nk, { tu: kiemNs.id })) || lam;
        soat = await kiem(true);
      }
      if (soat?.ok) tt = 'submitted';
      else if (qt.het_vong === 'ket') { tt = 'ket'; cauHoi = `Sau ${vong} vòng làm lại vẫn chưa đạt (${soat?.ly_do ?? 'không có kết luận'}). Giám đốc quyết: chấp nhận, đổi tiêu chí, hay bỏ việc?`; }
      else if (qt.het_vong === 'nop_kem_ghi_chu') { tt = 'submitted'; ghiChu = `Chưa qua người kiểm: ${soat?.ly_do ?? ''}`; }
      else if (qt.het_vong === 'trong_tai' && qt.nguoi.trong_tai) {
        const tTai = N(qt.nguoi.trong_tai);
        const pq = json(await goi(tTai, `Phân xử giữa người làm và người kiểm.\nTiêu chí:\n${tieuChi}\nKết quả nộp:\n${lam.ket_qua}\nNgười làm khai: ${lam.bang_chung}\nNgười kiểm bác: ${soat?.ly_do}\nChấm theo đúng tiêu chí. JSON {"dat":true|false,"ly_do":"…"}`, `${so()} trọng tài`, nk, { tu: kiemNs.id }));
        if (pq?.dat) { tt = 'submitted'; ghiChu = `Trọng tài ${tTai.ten} xử đạt: ${pq.ly_do}`; } else { tt = 'ket'; cauHoi = `Trọng tài ${tTai.ten} xử chưa đạt (${pq?.ly_do ?? '—'}). Giám đốc quyết bước tiếp?`; }
      } else tt = 'revision';
    }
    // Báo cáo: máy dựng từ trạng thái thật (không để mô hình tự ghi "Xong"), hoặc mô hình viết theo lời nhắc.
    const NHAN_TT = { submitted: 'nộp, chờ Giám đốc ký', revision: 'phải làm lại', ket: 'kẹt, cần Giám đốc trả lời' };
    let baoCao;
    if (qt.bao_cao_do_may) {
      const ngay = new Date().toISOString().slice(0, 10);
      baoCao = [`${bcNs.ten} · ${nk.ten_phong} · ${ngay}`,
        tt === 'submitted' ? `Xong: ${giao?.viec ?? viec} — ${ghiChu ?? (nk.do_may.length ? 'máy đo đạt + người kiểm đạt' : 'người kiểm đạt')}` : `Xong: —`,
        tt === 'submitted' ? 'Đang: chờ Giám đốc ký' : `Đang: ${giao?.viec ?? viec} — ${NHAN_TT[tt]}`,
        tt === 'ket' ? `Cần: mức 3 — ${cauHoi}` : tt === 'revision' ? `Cần: mức 2 — ${soat?.ly_do ?? ''}` : 'Cần: mức 3 — ký nộp'].join('\n');
      nk.buoc.push({ buoc: `${so()} báo cáo (máy)`, ai: 'Máy', id: 'may-do', model: 'máy', bat_dau: new Date().toISOString(), ket_thuc: new Date().toISOString(), ms: 0, http: 200, usage: null, loi: null, hoi: '', dap: baoCao });
    } else {
      baoCao = await goi(bcNs, dien(L.bao_cao, { viec_giao: giao?.viec ?? viec, ket_qua_ngan: (lam?.ket_qua ?? '—').slice(0, 300), bang_chung: lam?.bang_chung ?? '—',
        ket_soat: cauHoi ? `kẹt — ${cauHoi}` : soat ? (soat.ok ? 'đạt' : 'chưa đạt — ' + soat.ly_do) : 'không có kết luận',
        trang_thai_viec: tt === 'submitted' ? 'submitted (chờ Giám đốc ký)' : tt, ngay: new Date().toISOString().slice(0, 10) }), `${so()} báo cáo`, nk, { tu: 'minh' });
    }
    nk.ket = { giao, lam, soat, vong, bao_cao: baoCao, trang_thai_viec: tt, cau_hoi: cauHoi ?? null, ghi_chu: ghiChu ?? null };
    nk.trang_thai = 'xong';
    ghiLog({ luot: ts, loai: 'quyet', tu: kiemNs.id, chi_tiet: { viec: giao?.viec ?? viec, ok: tt === 'submitted', ly_do: cauHoi ?? soat?.ly_do, trang_thai_viec: tt } });
  } catch (e) { nk.trang_thai = 'lỗi'; nk.loi = String(e.message || e); ghiLog({ luot: ts, loai: 'loi', tu: 'he-thong', chi_tiet: { loi: nk.loi } }); }
  const tok = nk.buoc.reduce((s, b) => s + (b.usage?.input_tokens || 0) + (b.usage?.output_tokens || 0), 0);
  nk.tong = { buoc: nk.buoc.length, token: tok, ms: nk.buoc.reduce((s, b) => s + b.ms, 0) };
  nk.ket_thuc = new Date().toISOString();
  luu();
  ghiLog({ luot: ts, loai: 'he-thong', tu: 'he-thong', chi_tiet: { su_kien: 'kết thúc lượt', trang_thai: nk.trang_thai, tong: nk.tong } });
  return nk;
}

if (process.argv.includes('--tu-kiem') && (process.argv[1] || '').endsWith('ca.mjs')) {
  // Proxy giả trả lời đúng vai theo x-cty-staff + nội dung câu hỏi; mỗi ca đặt `kich` để điều khiển. 0 đồng.
  let kich = {}; const dem = { loc: 0, ky: 0 };
  const fake = http.createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c; const staff = req.headers['x-cty-staff'];
    const hoi = String(JSON.parse(raw).messages?.[0]?.content || '');   // chỉ nhìn câu hỏi, không nhìn system
    let ans;
    if (staff === 'tam') ans = hoi.includes('báo cáo sáng') ? 'Tâm · Phòng thử · 2026-10-10\nXong: việc — bằng chứng\nĐang: —\nCần: mức 3 — ký'
      : kich.thieu && hoi.includes('"thieu"') ? '{"thieu":"Jett Jean là sản phẩm gì, viết bằng ngôn ngữ nào?"}'
      : `{"giao_cho":"loc","viec":"viết 3 câu","tieu_chi":["3 câu","English"]${kich.do ? ',"do":[{"loai":"so_cau","bang":3},{"loai":"bua"}]' : ''}}`;
    else if (staff === 'loc') ans = (++dem.loc === 1 && kich.locSaiLan1) ? '{"ket_qua":"One. Two.","bang_chung":"3 câu"}' : '{"ket_qua":"One. Two. Three.","bang_chung":"3 câu"}';
    else if (staff === 'ha') ans = '{"dat":true,"ly_do":"đủ 3 câu"}';
    else { ++dem.ky; ans = kich.kyDat ? '{"ok":true,"ly_do":"đủ"}' : kich.kyLuonBac ? '{"ok":false,"truot":[1],"ly_do":"chưa hay"}' : kich.kyBacKhongChiRa ? '{"ok":false,"ly_do":"không thu hút"}' : dem.ky === 1 ? '{"ok":false,"ly_do":"thiếu"}' : '{"ok":true,"ly_do":"đủ"}'; }
    res.end(JSON.stringify({ content: [{ type: 'text', text: ans }], usage: { input_tokens: 10, output_tokens: 5 } }));
  }).listen(0, '127.0.0.1');
  await new Promise((r) => fake.once('listening', r));
  process.env.CTY_PROXY_URL = `http://127.0.0.1:${fake.address().port}`;
  process.env.CTY_DATA_DIR = fs.mkdtempSync('/tmp/cty-ca-'); process.env.CTY_VP_HOMES = process.env.CTY_DATA_DIR;
  const { docLog } = await import('./log.mjs');
  const assert = (c, m, nk) => { if (!c) { console.error('✗ ca.mjs:', m, JSON.stringify(nk ?? {}).slice(0, 400)); process.exit(1); } };
  const chay = async (k, sua) => { kich = k; dem.loc = 0; dem.ky = 0; const v1 = hienHanh(QT); return motLuot('thử', false, sua ? { quyTrinh: { ...v1, ...sua, nguoi: { ...v1.nguoi, ...(sua.nguoi ?? {}) } } } : {}); };
  const ten = (nk) => nk.buoc.map((b) => b.buoc).join(' | ');

  // v1: y như trước khi tách quy trình
  let nk = await chay({});
  const lg = docLog({ luot: nk.ts, n: 999 });
  assert(nk.trang_thai === 'xong' && nk.quy_trinh === 1, 'v1: lượt xong, ghi phiên bản 1', nk);
  assert(ten(nk) === '1 giao việc | 2 làm | 3 soát | 4 làm lại | 5 soát lại | 6 báo cáo', `v1: đúng 6 bước cũ (${ten(nk)})`, nk);
  assert(nk.ket.trang_thai_viec === 'submitted' && nk.tong.token === 90, 'v1: submitted + cộng token', nk);
  assert(lg.filter((e) => e.loai === 'doc').length === 3 && lg.filter((e) => e.loai === 'tin').length === 12 && lg.some((e) => e.loai === 'quyet'), `v1 log: 3 doc + 12 tin + quyet (có ${lg.length})`);
  // hỏi lại khi thiếu dữ kiện → kẹt, không gọi Lộc, báo cáo máy
  nk = await chay({ thieu: true }, { hoi_lai_khi_thieu_du_kien: true, bao_cao_do_may: true });
  assert(nk.ket.trang_thai_viec === 'ket' && /Jett Jean/.test(nk.ket.cau_hoi) && dem.loc === 0 && nk.buoc.length === 2 && /Cần: mức 3/.test(nk.ket.bao_cao), `thiếu dữ kiện → kẹt + câu hỏi, không làm (${ten(nk)})`, nk);
  // máy đo: trượt lần 1 → trả về KHÔNG tốn lượt Kỳ; phép đo lạ bị bỏ; đạt → Kỳ chấm phần còn lại
  nk = await chay({ do: true, locSaiLan1: true, kyDat: true }, { may_do: true, bao_cao_do_may: true });
  assert(ten(nk) === '1 giao việc | 2 làm | 3 máy đo | 4 làm lại | 5 máy đo | 6 soát lại | 7 báo cáo (máy)', `máy đo bác trước người kiểm (${ten(nk)})`, nk);
  assert(dem.ky === 1 && nk.ket.trang_thai_viec === 'submitted' && nk.do_may[0].kq.length === 1 && !nk.do_may[0].kq[0].dat, 'máy đo: Kỳ chỉ gọi 1 lần, phép đo lạ bị bỏ', nk);
  assert(!/Xong: —/.test(nk.ket.bao_cao) && /Đang: chờ Giám đốc ký/.test(nk.ket.bao_cao), 'báo cáo máy theo trạng thái thật', nk);
  // khoá tiêu chí: bác không chỉ ra tiêu chí trượt → không tính
  nk = await chay({ kyBacKhongChiRa: true }, { khoa_tieu_chi: true });
  assert(nk.ket.trang_thai_viec === 'submitted' && nk.ket.vong === 0, 'khoá tiêu chí: lời bác chung chung không được tính', nk);
  // hết vòng → kẹt kèm câu hỏi (không trôi "revision")
  nk = await chay({ kyLuonBac: true }, { so_vong_lam_lai: 2, het_vong: 'ket', khoa_tieu_chi: true });
  assert(nk.ket.trang_thai_viec === 'ket' && nk.ket.vong === 2 && /Sau 2 vòng/.test(nk.ket.cau_hoi), 'hết 2 vòng → kẹt + câu hỏi', nk);
  // hết vòng → trọng tài (Hà) phân xử
  nk = await chay({ kyLuonBac: true }, { so_vong_lam_lai: 0, het_vong: 'trong_tai', nguoi: { trong_tai: 'ha' } });
  assert(nk.ket.trang_thai_viec === 'submitted' && /Trọng tài Hà/.test(nk.ket.ghi_chu) && /trọng tài/.test(ten(nk)), `trọng tài xử đạt (${ten(nk)})`, nk);
  fake.close(); console.log('✓ ca.mjs: v1 y cũ + 5 công tắc (hỏi lại, máy đo, khoá tiêu chí, hết vòng→kẹt, trọng tài)'); process.exit(0);
}

if (process.argv.includes('--viec') && (process.argv[1] || '').endsWith('ca.mjs')) {
  const viec = process.argv[process.argv.indexOf('--viec') + 1];
  const ban = process.argv.includes('--ban') ? Number(process.argv[process.argv.indexOf('--ban') + 1]) : null;
  const nk = await motLuot(viec, true, ban ? { quyTrinh: dsBan(QT).find((b) => b.ban === ban) } : {});
  console.log(JSON.stringify({ ts: nk.ts, trang_thai: nk.trang_thai, loi: nk.loi, tong: nk.tong, ket: nk.ket?.trang_thai_viec }, null, 1));
  process.exit(nk.trang_thai === 'xong' ? 0 : 1);
}

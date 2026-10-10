#!/usr/bin/env node
// PHÒNG TỰ CẢI TIẾN QUY TRÌNH trong biên (cong-ty/bien-quy-trinh.json) — làm theo cách các tổ chức vẫn làm:
//   1. HỌP rút kinh nghiệm: số liệu máy tính từ các lượt + lượt chưa đạt + điểm bộ việc chuẩn → Tâm (trưởng phòng) đề xuất thay đổi
//      NHỎ NHẤT kèm bằng chứng → Hà (Kiểm soát, ngoài phòng, mô hình khác) phản biện → máy tính MỨC theo biên.
//      Mức 1 → áp, thành bản "đang thử" · mức 2 → áp khi Hà đồng ý · mức 3 → chờ Giám đốc ký · vượt biên → loại.
//   2. SO PHIÊN BẢN trên BỘ VIỆC CHUẨN do Hà giữ (cong-ty/bo-viec-chuan/) — cùng bộ việc, mỗi việc vài lần, chấm theo kỳ vọng của Hà,
//      không theo người kiểm của phòng. Bản đang thử điểm ≥ bản gốc → GIỮ; thấp hơn → tự QUAY LẠI bản gốc.
// Họp và so phiên bản GỌI MÔ HÌNH (tốn tiền): chỉ chạy khi Giám đốc bấm/bảo. `--tu-kiem` = proxy giả, 0 đồng.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { goi, json, nhanSu, motLuot } from './ca.mjs';
import { hienHanh, dsBan, bien, boViecChuan, mucThayDoi, apBanMoi, veBan, dsDeXuat, ghiDeXuat, dsLuotTho, chiSo, chamViecChuan, usdLuot } from './quy-trinh.mjs';
import { ghiLog } from './log.mjs';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const ssDir = (phong) => path.join(DATA(), 'so-sanh', phong);
const CONG_TAC = `Công tắc trong cấu hình (đổi được theo biên):
- so_vong_lam_lai: số lần người làm được làm lại khi bị bác.
- hoi_lai_khi_thieu_du_kien: người giao được dừng việc thiếu dữ kiện / mâu thuẫn và hỏi lại Giám đốc (trạng thái "ket") thay vì đoán.
- may_do: tiêu chí đếm được (số câu, số từ, ký tự, dòng, chữ cấm, ngôn ngữ) do MÁY đếm, người kiểm chỉ chấm phần phán đoán.
- khoa_tieu_chi: người kiểm chỉ được bác theo đúng tiêu chí đã đánh số lúc giao, phải chỉ ra tiêu chí trượt.
- het_vong: hết vòng mà chưa đạt thì "revision" (dừng, không ai quyết) | "ket" (hỏi Giám đốc) | "trong_tai" (người thứ ba phân xử) | "nop_kem_ghi_chu".
- nguoi.trong_tai / nguoi.kiem: ai phân xử / ai kiểm.
- bao_cao_do_may: báo cáo do máy dựng từ trạng thái thật (không để mô hình tự ghi "Xong").
- loi_nhac.*: lời nhắc từng bước (đổi lời giao việc = đổi chuẩn chất lượng → mức 3).`;

const datKhoa = (o, k, v) => { const ps = k.split('.'); const c = structuredClone(o); let x = c; for (const p of ps.slice(0, -1)) x = x[p] ??= {}; x[ps.at(-1)] = v; return c; };
const apThayDoi = (qt, td) => Object.entries(td || {}).reduce((o, [k, v]) => datKhoa(o, k, v), qt);
const rutGon = (qt) => ({ ...qt, loi_nhac: Object.fromEntries(Object.entries(qt.loi_nhac).map(([k, v]) => [k, v.slice(0, 220)])) });

export function diemMoiNhat(phong, ban) {
  const d = ssDir(phong); if (!fs.existsSync(d)) return null;
  const f = fs.readdirSync(d).filter((x) => x.startsWith(`v${ban}-`)).sort().pop();
  return f ? JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')) : null;
}
export function dsSoSanh(phong) { const d = ssDir(phong); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort().reverse().map((f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))) : []; }

/** Chạy BỘ VIỆC CHUẨN với một phiên bản, `lan` lần mỗi việc; chấm theo kỳ vọng của Hà. Tốn ~ (số việc × lan) lượt. */
export async function soPhienBan(phong, ban, lan = 2) {
  const bo = boViecChuan(phong); const qt = dsBan(phong).find((b) => b.ban === ban);
  if (!bo) throw new Error(`phòng ${phong} chưa có bộ việc chuẩn`); if (!qt) throw new Error(`không có bản v${ban}`);
  const chiTiet = [];
  for (const v of bo.viec) for (let i = 0; i < lan; i++) {
    const l = await motLuot(v.viec, true, { quyTrinh: qt, boViec: v.id });
    chiTiet.push({ id: v.id, ky_vong: v.ky_vong, luot: l.ts, tt: l.ket?.trang_thai_viec ?? l.trang_thai, usd: usdLuot(l), ...chamViecChuan(l, v) });
  }
  const dung = chiTiet.filter((x) => x.dung).length;
  const kq = { phong, ban, lan, ts: new Date().toISOString(), diem: dung / (chiTiet.length || 1), so_dung: dung, tong: chiTiet.length, chi_phi: chiTiet.reduce((s, x) => s + x.usd, 0), chi_tiet: chiTiet };
  fs.mkdirSync(ssDir(phong), { recursive: true }); fs.writeFileSync(path.join(ssDir(phong), `v${ban}-${kq.ts.replace(/[:.]/g, '-')}.json`), JSON.stringify(kq, null, 1));
  ghiLog({ luot: `so-v${ban}`, loai: 'quyet', tu: 'ha', chi_tiet: { so_phien_ban: ban, diem: kq.diem, so_dung: dung, tong: kq.tong } });
  return kq;
}

/** So bản đang thử với bản gốc của nó trên cùng bộ việc → GIỮ hoặc tự QUAY LẠI. Bản gốc chưa có điểm thì chạy luôn. */
export async function soVaQuyet(phong, lan = 2) {
  const dx = dsDeXuat(phong).find((d) => d.trang_thai === 'dang_thu');
  if (!dx) { const kq = await soPhienBan(phong, hienHanh(phong).ban, lan); return { kq, quyet: null }; }
  const goc = diemMoiNhat(phong, dx.tu_ban) ?? await soPhienBan(phong, dx.tu_ban, lan);
  const moi = await soPhienBan(phong, dx.ban_moi, lan);
  const giu = moi.diem >= goc.diem;   // ponytail: bằng điểm vẫn giữ — bộ việc 7 × 2 lần còn thô; nâng lên "phải hơn + chi phí" khi bộ việc lớn hơn
  dx.trang_thai = giu ? 'giu' : 'quay_lai';
  dx.so_sanh = { cu: { ban: dx.tu_ban, diem: goc.diem, so_dung: goc.so_dung, tong: goc.tong, chi_phi: goc.chi_phi }, moi: { ban: dx.ban_moi, diem: moi.diem, so_dung: moi.so_dung, tong: moi.tong, chi_phi: moi.chi_phi } };
  ghiDeXuat(dx);
  if (!giu && hienHanh(phong).ban === dx.ban_moi) veBan(phong, dx.tu_ban, `thử thua trên bộ việc chuẩn: v${dx.ban_moi} ${moi.so_dung}/${moi.tong} < v${dx.tu_ban} ${goc.so_dung}/${goc.tong}`, 'may');
  return { kq: moi, goc, quyet: dx.trang_thai, dx };
}

/** Buổi họp rút kinh nghiệm → một đề xuất đã xếp mức và đã xử lý theo mức. */
export async function hop(phong) {
  const qt = hienHanh(phong); const b = bien();
  if (dsDeXuat(phong).some((d) => d.trang_thai === 'dang_thu')) throw new Error('đang có bản thử chưa so trên bộ việc chuẩn — so xong rồi mới họp tiếp (mỗi lần một thay đổi)');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const nk = { ts: `hop-${ts}`, buoc: [] };
  const luot = dsLuotTho().filter((l) => !l.bo_viec && (l.quy_trinh ?? 1) === qt.ban);
  const cs = chiSo(luot);
  const chuaDat = luot.filter((l) => l.trang_thai !== 'đang chạy' && l.ket?.trang_thai_viec !== 'submitted').slice(0, 3)
    .map((l) => ({ luot: l.ts, viec: l.viec, ket: l.ket?.trang_thai_viec ?? l.trang_thai, buoc: (l.buoc || []).map((x) => `${x.buoc} · ${x.ai}: ${String(x.dap || x.loi || '').slice(0, 350)}`) }));
  const diem = dsBan(phong).map((x) => ({ ban: x.ban, diem: diemMoiNhat(phong, x.ban) })).filter((x) => x.diem).map((x) => ({ ban: x.ban, dung: `${x.diem.so_dung}/${x.diem.tong}`, sai: x.diem.chi_tiet.filter((c) => !c.dung).map((c) => `${c.id}: ${c.ly_do}`).slice(0, 6) }));
  const cu = dsDeXuat(phong).slice(0, 5).map((d) => ({ id: d.id, trang_thai: d.trang_thai, thay: d.thay_doi.map((t) => `${t.khoa}=${JSON.stringify(t.moi)}`) }));
  const tam = nhanSu(qt.nguoi.giao, nk.ts), ha = nhanSu('ha', nk.ts);
  const deXuat = json(await goi(tam, `HỌP RÚT KINH NGHIỆM — Phòng thử, quy trình hiện hành v${qt.ban}.
Cấu hình hiện hành: ${JSON.stringify(rutGon(qt))}
Biên (mức 1 phòng tự áp · 2 cần Hà · 3 cần Giám đốc; khoá ngoài biên = mức 3): ${JSON.stringify(b)}
${CONG_TAC}
Số liệu máy tính trên ${cs.so_luot} lượt thật của v${qt.ban}: ${JSON.stringify(cs)}
Điểm trên bộ việc chuẩn (Hà chấm): ${JSON.stringify(diem)}
Lượt chưa đạt gần nhất: ${JSON.stringify(chuaDat)}
Đề xuất trước đây: ${JSON.stringify(cu)}
Nhiệm vụ: chỉ ra tối đa 3 vấn đề CÓ BẰNG CHỨNG (mã lượt + bước), rồi đề xuất thay đổi NHỎ NHẤT trên cấu hình để sửa gốc. TUYỆT ĐỐI không nới tiêu chí cho dễ đạt. Không có vấn đề thật thì để thay_doi rỗng.
Trả JSON: {"van_de":[{"mo_ta":"…","bang_chung":"…"}],"thay_doi":{"<khoá, vd so_vong_lam_lai hoặc nguoi.trong_tai>":<giá trị>},"ky_vong":"<chỉ số nào sẽ tốt lên, bao nhiêu>"}`, 'đề xuất', nk, { tu: 'giam-doc' }));
  if (!deXuat) throw new Error(`${tam.ten} không trả JSON đề xuất`);
  const pb = json(await goi(ha, `PHẢN BIỆN đề xuất đổi quy trình của Phòng thử (bạn là Kiểm soát, ngoài phòng).
Cấu hình hiện hành: ${JSON.stringify(rutGon(qt))}
Số liệu: ${JSON.stringify(cs)} · Điểm bộ việc chuẩn: ${JSON.stringify(diem)}
Đề xuất của ${tam.ten}: ${JSON.stringify(deXuat)}
Kiểm: (1) bằng chứng có thật trong số liệu/lượt không; (2) thay đổi có NỚI CHUẨN chất lượng không (có → bác); (3) có cách nhỏ hơn không.
Trả JSON: {"dong_y":true|false,"sua":{<thay_doi thay thế, hoặc null>},"ly_do":"…"}`, 'phản biện', nk, { tu: tam.id }));
  const td = pb?.dong_y && pb.sua && typeof pb.sua === 'object' ? pb.sua : deXuat.thay_doi;
  const moi = apThayDoi(qt, td); const m = mucThayDoi(qt, moi);
  const dx = { id: ts, ts: new Date().toISOString(), phong, tu_ban: qt.ban, van_de: deXuat.van_de || [], ky_vong: deXuat.ky_vong ?? '', thay_doi: m.thay, vuot: m.vuot, muc: m.muc,
    ha: { dong_y: !!pb?.dong_y, ly_do: pb?.ly_do ?? 'không trả lời', sua: pb?.sua ?? null }, moi, chi_phi: usdLuot(nk), buoc: nk.buoc.map((x) => ({ buoc: x.buoc, ai: x.ai, model: x.model, usage: x.usage, ms: x.ms })) };
  const ap = (ai) => { const v = apBanMoi(phong, moi, { ly_do: (dx.van_de[0]?.mo_ta ?? 'họp rút kinh nghiệm').slice(0, 200), de_xuat: dx.id, ai_duyet: ai }); dx.ban_moi = v.ban; dx.trang_thai = 'dang_thu'; };
  if (m.vuot.length) dx.trang_thai = 'vuot_bien';
  else if (!m.thay.length) dx.trang_thai = 'khong_doi';
  else if (m.muc === 1) ap(tam.id);
  else if (m.muc === 2) { if (dx.ha.dong_y) ap('ha'); else dx.trang_thai = 'bi_bac'; }
  else dx.trang_thai = 'cho_duyet';
  ghiDeXuat(dx);
  ghiLog({ luot: nk.ts, loai: 'quyet', tu: tam.id, chi_tiet: { hop: dx.id, muc: dx.muc, trang_thai: dx.trang_thai, thay: dx.thay_doi.map((t) => t.khoa) } });
  return dx;
}

/** Giám đốc ký / bác đề xuất mức 3. */
export function duyetDeXuat(phong, id, dongY, ai = 'giam-doc') {
  const dx = dsDeXuat(phong).find((d) => d.id === id);
  if (!dx) throw new Error(`không có đề xuất ${id}`);
  if (dx.trang_thai !== 'cho_duyet') throw new Error(`đề xuất ${id} đang ở "${dx.trang_thai}", không chờ duyệt`);
  if (dongY) {
    if (dsDeXuat(phong).some((d) => d.trang_thai === 'dang_thu')) throw new Error('đang có bản thử chưa so — so xong rồi mới áp thêm (mỗi lần một thay đổi)');
    if (hienHanh(phong).ban !== dx.tu_ban) throw new Error(`quy trình đã đổi từ v${dx.tu_ban} sang v${hienHanh(phong).ban} — đề xuất này lỗi thời, họp lại`);
    const v = apBanMoi(phong, dx.moi, { ly_do: (dx.van_de[0]?.mo_ta ?? 'Giám đốc ký').slice(0, 200), de_xuat: dx.id, ai_duyet: ai }); dx.ban_moi = v.ban; dx.trang_thai = 'dang_thu';
  } else dx.trang_thai = 'bi_bac';
  dx.giam_doc = { dong_y: dongY, luc: new Date().toISOString() };
  return ghiDeXuat(dx);
}

// Việc đang chạy (họp / so phiên bản) của một phòng — trang đọc để khoá nút + hiện "đang chạy", worker xoá khi xong (kể cả lỗi).
const khoaDir = () => path.join(DATA(), 'dang-chay');
export function dangChayCaiTien(phong) { const f = path.join(khoaDir(), `${phong}.json`); if (!fs.existsSync(f)) return null; const k = JSON.parse(fs.readFileSync(f, 'utf8')); return Date.now() - Date.parse(k.tu) > 30 * 60e3 ? null : k; }
export function ketQuaGanNhat(phong) { const f = path.join(khoaDir(), `${phong}-ket.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }
async function voiKhoa(phong, viec, fn) {
  fs.mkdirSync(khoaDir(), { recursive: true }); const f = path.join(khoaDir(), `${phong}.json`);
  fs.writeFileSync(f, JSON.stringify({ viec, tu: new Date().toISOString() }));
  try { const r = await fn(); fs.writeFileSync(path.join(khoaDir(), `${phong}-ket.json`), JSON.stringify({ viec, ok: true, luc: new Date().toISOString(), tom_tat: r })); return r; }
  catch (e) { fs.writeFileSync(path.join(khoaDir(), `${phong}-ket.json`), JSON.stringify({ viec, ok: false, luc: new Date().toISOString(), loi: String(e.message || e) })); throw e; }
  finally { fs.rmSync(f, { force: true }); }
}

const laCli = (process.argv[1] || '').endsWith('cai-tien.mjs');
const thamSo = (k, mac) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : mac);
if (laCli && process.argv.includes('--hop')) { const P = thamSo('--phong', 'thu-nghiem'); const dx = await voiKhoa(P, 'hop', async () => { const d = await hop(P); return `đề xuất ${d.id}: mức ${d.muc} → ${d.trang_thai}`; }); console.log(dx); process.exit(0); }
if (laCli && process.argv.includes('--so')) { const P = thamSo('--phong', 'thu-nghiem'); const r = await voiKhoa(P, 'so', async () => { const x = await soVaQuyet(P, Number(thamSo('--lan', 2))); return x.quyet ? `v${x.dx.ban_moi} ${x.kq.so_dung}/${x.kq.tong} so với v${x.dx.tu_ban} ${x.goc.so_dung}/${x.goc.tong} → ${x.quyet === 'giu' ? 'giữ' : 'quay lại'}` : `v${x.kq.ban}: ${x.kq.so_dung}/${x.kq.tong} việc chuẩn đúng`; }); console.log(r); process.exit(0); }

if (laCli && process.argv.includes('--tu-kiem')) {
  // Proxy giả: Tâm/Hà/Kỳ/Lộc trả lời theo kịch bản; v2 bật hỏi-lại → việc không thể sẽ kẹt đúng → điểm v2 > v1 → GIỮ.
  let kich = {};
  const fake = http.createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c; const staff = req.headers['x-cty-staff'];
    const hoi = String(JSON.parse(raw).messages?.[0]?.content || '');
    let ans;
    if (hoi.startsWith('HỌP')) ans = JSON.stringify({ van_de: [{ mo_ta: 'việc thiếu dữ kiện vẫn làm', bang_chung: 'lượt X bước 2' }], thay_doi: kich.thayDoi, ky_vong: 'việc không thể → kẹt' });
    else if (hoi.startsWith('PHẢN BIỆN')) ans = JSON.stringify({ dong_y: kich.haDongY !== false, sua: null, ly_do: 'có bằng chứng' });
    else if (staff === 'tam') ans = hoi.includes('báo cáo sáng') ? 'Tâm · Phòng thử\nXong: —\nĐang: —\nCần: —'
      : (hoi.includes('"thieu"') && /Jett Jean|Làm cho nó|7 features/.test(hoi)) ? '{"thieu":"thiếu dữ kiện"}'
      : '{"giao_cho":"loc","viec":"làm","tieu_chi":["đúng yêu cầu"]}';
    else if (staff === 'loc') ans = '{"ket_qua":"Killer Sudoku for Adults is fun. It has 100 puzzles. Great gift.","bang_chung":"ok"}';
    else ans = '{"ok":true,"ly_do":"đạt"}';
    res.end(JSON.stringify({ content: [{ type: 'text', text: ans }], usage: { input_tokens: 10, output_tokens: 5 } }));
  }).listen(0, '127.0.0.1');
  await new Promise((r) => fake.once('listening', r));
  process.env.CTY_PROXY_URL = `http://127.0.0.1:${fake.address().port}`;
  if (!process.env.CTY_GIU_DATA) process.env.CTY_DATA_DIR = fs.mkdtempSync('/tmp/cty-ct-'); process.env.CTY_VP_HOMES = '/nonexistent';   // CTY_GIU_DATA=1: ghi vào thư mục dữ liệu đang trỏ (dựng dữ liệu mẫu để xem giao diện)
  const a = (c, m, x) => { if (!c) { console.error('✗ cai-tien:', m, JSON.stringify(x ?? {}).slice(0, 400)); process.exit(1); } };
  const P = 'thu-nghiem';
  // mức 1 → áp thành v2 đang thử
  kich = { thayDoi: { hoi_lai_khi_thieu_du_kien: true } };
  let dx = await hop(P);
  a(dx.muc === 1 && dx.trang_thai === 'dang_thu' && dx.ban_moi === 2 && hienHanh(P).ban === 2, 'mức 1 → áp v2, đang thử', dx);
  let loiHop = ''; try { await hop(P); } catch (e) { loiHop = e.message; }
  a(/đang có bản thử/.test(loiHop), 'chưa so bản thử thì không họp tiếp');
  // so trên bộ việc chuẩn: v1 nộp bừa 3 việc không thể; v2 kẹt đúng → giữ v2
  const r = await soVaQuyet(P, 1);
  a(r.quyet === 'giu' && r.goc.so_dung < r.kq.so_dung && hienHanh(P).ban === 2, `v2 hơn v1 trên bộ việc chuẩn → giữ (v1 ${r.goc?.so_dung}/${r.goc?.tong}, v2 ${r.kq.so_dung}/${r.kq.tong})`, r.dx);
  // vượt biên → loại
  kich = { thayDoi: { so_vong_lam_lai: 9 } }; dx = await hop(P);
  a(dx.trang_thai === 'vuot_bien' && hienHanh(P).ban === 2, 'vượt biên → loại, không áp', dx);
  // mức 2 Hà bác → không áp
  kich = { thayDoi: { het_vong: 'ket' }, haDongY: false }; dx = await hop(P);
  a(dx.muc === 2 && dx.trang_thai === 'bi_bac' && hienHanh(P).ban === 2, 'mức 2, Hà bác → không áp', dx);
  // mức 3 → chờ Giám đốc; ký → áp v3 đang thử
  kich = { thayDoi: { 'loi_nhac.giao': 'Giao việc: {viec}. JSON {"giao_cho":"loc","viec":"…","tieu_chi":["…"]}' } }; dx = await hop(P);
  a(dx.muc === 3 && dx.trang_thai === 'cho_duyet' && hienHanh(P).ban === 2, 'mức 3 → chờ Giám đốc, chưa áp', dx);
  dx = duyetDeXuat(P, dx.id, true);
  a(dx.trang_thai === 'dang_thu' && hienHanh(P).ban === 3, 'Giám đốc ký → áp v3', dx);
  // v3 thua v2 → tự quay lại v2 (ép: v3 bỏ hỏi lại)
  const v3 = dsBan(P).find((x) => x.ban === 3); fs.writeFileSync(path.join(DATA(), 'quy-trinh', P, 'v3.json'), JSON.stringify({ ...v3, hoi_lai_khi_thieu_du_kien: false }));
  const r2 = await soVaQuyet(P, 1);
  a(r2.quyet === 'quay_lai' && hienHanh(P).ban === 2, `v3 thua v2 → tự quay lại v2 (v2 ${r2.goc?.so_dung}, v3 ${r2.kq.so_dung})`, r2.dx);
  // về bản đầu để thử
  veBan(P, 1, 'thử lại từ đầu', 'anh');
  a(hienHanh(P).ban === 1 && dsBan(P).length === 3, 'về v1: còn đủ v2, v3 để xem lại');
  fake.close(); console.log('✓ cai-tien: họp → mức 1/2/3/vượt biên, so bộ việc chuẩn → giữ / tự quay lại, ký mức 3, về v1'); process.exit(0);
}

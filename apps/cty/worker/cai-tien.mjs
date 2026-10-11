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
import { ghiApDung, ghiBaiHoc, dsBaiHoc, trangThai } from './kinh-nghiem.mjs';
import { mayDo } from './quy-trinh.mjs';
import { boNhiem, vaiCuaPhong, phongFm, giaiNguoi, theVai, tenPhong, hienHanh, dsBan, bien, boViecChuan, mucThayDoi, apBanMoi, veBan, dsDeXuat, ghiDeXuat, dsLuotTho, chiSo, chamViecChuan, usdLuot } from './quy-trinh.mjs';
import { ghiLog } from './log.mjs';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const ssDir = (k) => path.join(DATA(), 'so-sanh', k);
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
const apThayDoi = (cfg, td) => Object.entries(td || {}).reduce((o, [k, v]) => datKhoa(o, k, v), cfg);
const rutGon = (cfg) => ({ ...cfg, loi_nhac: Object.fromEntries(Object.entries(cfg.loi_nhac).map(([k, v]) => [k, v.slice(0, 220)])) });

export function diemMoiNhat(k, ban) {
  const d = ssDir(k); if (!fs.existsSync(d)) return null;
  const f = fs.readdirSync(d).filter((x) => x.startsWith(`v${ban}-`)).sort().pop();
  return f ? JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')) : null;
}
export function dsSoSanh(k) { const d = ssDir(k); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort().reverse().map((f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))) : []; }

/** Chạy BỘ VIỆC CHUẨN với MỘT cấu hình, `lan` lần mỗi việc; chấm theo kỳ vọng của Hà; lưu vào so-sanh/<khoá>/<tiền tố>-<giờ>.json.
 *  Một hàm cho cả so phiên bản (tiền tố v<bản>) lẫn thử cấu hình chưa áp (tiền tố thu-). Tốn ~ (số việc × lan) lượt. */
async function chayBoViec(k, cfg, lan, tienTo, them = {}, oLuot = {}) {
  const bo = boViecChuan(k); if (!bo) throw new Error(`phòng ${k} chưa có bộ việc chuẩn`);
  const chiTiet = [];
  for (const v of bo.viec) for (let i = 0; i < lan; i++) {
    const l = await motLuot(v.viec, true, { khoa: k, quyTrinh: cfg, boViec: v.id, ...oLuot });
    const soat = (l.buoc || []).filter((b) => /soát/.test(b.buoc));
    // thước đối chiếu người kiểm: bài làm VÒNG ĐẦU có qua mọi phép đo máy của Hà không (chỉ việc có phép đo). Qua mà vẫn bị bác = nhiều khả năng bác sai.
    const lam1 = json((l.buoc || []).find((b) => /\blàm\b/.test(b.buoc) && !/lại/.test(b.buoc))?.dap)?.ket_qua;
    const v1May = Array.isArray(v.do) && v.do.length && lam1 ? v.do.every((d) => mayDo(d, lam1).dat) : null;
    chiTiet.push({ id: v.id, ky_vong: v.ky_vong, luot: l.ts, tt: l.ket?.trang_thai_viec ?? l.trang_thai, usd: usdLuot(l), ...chamViecChuan(l, v),
      vong_dau: soat[0] ? json(soat[0].dap)?.ok === true || !!soat[0].bi_gat : null, kiem_bac_v1: soat[0] ? json(soat[0].dap)?.ok === false : null, v1_dat_may: v1May,
      phuc_khao: soat.map((b) => b.phuc_khao).filter(Boolean), pk_v1: soat[0]?.phuc_khao ?? null });
  }
  const dung = chiTiet.filter((x) => x.dung).length;
  const kq = { qt: k, lan, ts: new Date().toISOString(), diem: dung / (chiTiet.length || 1), so_dung: dung, tong: chiTiet.length, chi_phi: chiTiet.reduce((s, x) => s + x.usd, 0), chi_tiet: chiTiet, ...them };
  fs.mkdirSync(ssDir(k), { recursive: true }); fs.writeFileSync(path.join(ssDir(k), `${tienTo}-${kq.ts.replace(/[:.]/g, '-')}.json`), JSON.stringify(kq, null, 1));
  ghiLog({ luot: `so-${tienTo}`, loai: 'quyet', tu: 'ha', chi_tiet: { so: tienTo, diem: kq.diem, so_dung: dung, tong: kq.tong } });
  return kq;
}
export async function soPhienBan(k, ban, lan = 2) {
  const cfg = dsBan(k).find((b) => b.ban === ban); if (!cfg) throw new Error(`không có bản v${ban}`);
  return chayBoViec(k, cfg, lan, `v${ban}`, { ban });
}
/** Áp MỘT kết quả thử (tệp thu-*.json) thành bản mới — đường máy cho thay đổi đã có số đo, không phải chờ họp. Chỉ áp khi: thử trên đúng
 *  bản đang chạy · điểm bộ việc chuẩn HƠN bản đang chạy (thước của Hà — đó là chữ ký mức 2) · không khoá nào mức 3 / vượt biên · không có bản
 *  thử dở. Ghi thành đề xuất kèm bằng chứng (trạng thái "giữ" vì đã so), chép điểm sang bản mới để lần tự xét sau dùng đúng điểm. */
export function apKetQuaThu(k, tenTep) {
  const f = path.join(ssDir(k), path.basename(tenTep)); if (!fs.existsSync(f)) throw new Error(`không có tệp thử ${tenTep}`);
  const t = JSON.parse(fs.readFileSync(f, 'utf8')); if (!t.thu) throw new Error(`${tenTep} không phải kết quả thử cấu hình`);
  const cfg = hienHanh(k); if (t.ban !== cfg.ban) throw new Error(`thử trên v${t.ban} nhưng đang chạy v${cfg.ban} — thử lại trên bản đang chạy`);
  if (dsDeXuat(k).some((d) => d.trang_thai === 'dang_thu')) throw new Error('đang có bản thử chưa so — xong rồi mới áp thêm (mỗi lần một thay đổi)');
  const goc = diemMoiNhat(k, cfg.ban); if (!goc) throw new Error(`v${cfg.ban} chưa có điểm bộ việc chuẩn để so`);
  if (t.diem <= goc.diem) throw new Error(`thử ${t.so_dung}/${t.tong} không hơn v${cfg.ban} ${goc.so_dung}/${goc.tong} — không áp`);
  const moi = apThayDoi(cfg, t.thu); const m = mucThayDoi(cfg, moi);
  if (m.vuot.length) throw new Error(`vượt biên: ${m.vuot.map((x) => x.khoa).join(', ')}`);
  if (m.muc >= 3) throw new Error('có thay đổi mức 3 — cần Giám đốc ký, không áp bằng máy');
  const id = new Date().toISOString().replace(/[:.]/g, '-'); const lyDo = `bộ việc chuẩn: thử ${t.so_dung}/${t.tong} > v${cfg.ban} ${goc.so_dung}/${goc.tong}`;
  const v = apBanMoi(k, moi, { ly_do: lyDo, de_xuat: id, ai_duyet: 'ha' });
  const dx = { id, ts: new Date().toISOString(), qt: k, tu_ban: cfg.ban, ban_moi: v.ban, van_de: [{ mo_ta: 'áp kết quả thử cấu hình', bang_chung: path.basename(f) }], ky_vong: lyDo, thay_doi: m.thay, vuot: [], muc: m.muc,
    ha: { dong_y: true, ly_do: `Hà chấm trên bộ việc chuẩn: ${lyDo}`, sua: null }, moi, chi_phi: 0, trang_thai: 'giu',
    so_sanh: { cu: { ban: cfg.ban, diem: goc.diem, so_dung: goc.so_dung, tong: goc.tong, chi_phi: goc.chi_phi }, moi: { ban: v.ban, diem: t.diem, so_dung: t.so_dung, tong: t.tong, chi_phi: t.chi_phi } } };
  ghiDeXuat(dx);
  fs.writeFileSync(path.join(ssDir(k), `v${v.ban}-${t.ts.replace(/[:.]/g, '-')}.json`), JSON.stringify({ ...t, ban: v.ban, chi_phi: 0, tu_thu: path.basename(f) }, null, 1));   // chi_phi 0: đã tính ở tệp thử
  ghiLog({ luot: `ap-thu-${id}`, loai: 'quyet', tu: 'ha', chi_tiet: { ap_thu: path.basename(f), ban_moi: v.ban, muc: m.muc, thay: m.thay.map((x) => x.khoa) } });
  return dx;
}

// THỬ VIỆC + ĐỀ CỬ (decision 2026-10-11 nhân sự sống, bước 3): người đang giữ vai và từng ứng viên lần lượt giữ vai trên CÙNG bộ việc chuẩn,
// cùng cấu hình (mặc định tắt phúc khảo để đo đúng người kiểm). Ứng viên hơn người đang giữ → ĐỀ CỬ chờ Giám đốc ký (đổi người = mức 3).
// Với vai Người kiểm còn đo: bác sai = bác bài vòng đầu đã qua mọi phép đo máy; duyệt sai = duyệt bài vòng đầu trượt phép đo.
const tvDir = (k) => path.join(DATA(), 'thu-viec', k);
export function dsThuViec(k) { const d = tvDir(k); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort().reverse().map((f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))) : []; }
const hon = (a, b) => a.diem > b.diem || (a.diem === b.diem && a.loi_kiem < b.loi_kiem);   // điểm trước, rồi ít lỗi kiểm hơn
export async function thuViec(k, vai, ungVien, lan = 2, thayDoi = { 'phuc_khao.ti_le': 0 }) {
  const cu = vaiCuaPhong(k)[vai]; if (!cu) throw new Error(`${tenPhong(k)} chưa có ai giữ vai ${vai}`);
  const cfg = apThayDoi(hienHanh(k), thayDoi); const ket = [];
  for (const nguoi of [cu, ...ungVien.filter((x) => x !== cu)]) {
    const r = await chayBoViec(k, cfg, lan, `tv-${nguoi}`, { thu_viec: { vai, nguoi } }, { giuVai: { [vai]: nguoi } });
    const c = r.chi_tiet; const bacSai = c.filter((x) => x.kiem_bac_v1 && x.v1_dat_may === true).length; const duyetSai = c.filter((x) => x.kiem_bac_v1 === false && x.v1_dat_may === false).length;
    ket.push({ nguoi, diem: r.diem, so_dung: r.so_dung, tong: r.tong, so_bac_v1: c.filter((x) => x.kiem_bac_v1).length, bac_sai: bacSai, duyet_sai: duyetSai, loi_kiem: bacSai + duyetSai, chi_phi: r.chi_phi });
  }
  const goc = ket[0]; const tot = ket.slice(1).filter((x) => hon(x, goc)).sort((a, b) => (hon(a, b) ? -1 : 1))[0] ?? null;
  const id = new Date().toISOString().replace(/[:.]/g, '-');
  const kq = { id, ts: new Date().toISOString(), qt: k, phong: k.split('/')[0], vai, nguoi_cu: cu, lan, thu: thayDoi, ket, chi_phi: ket.reduce((s, x) => s + x.chi_phi, 0),
    de_cu: tot ? { nguoi: tot.nguoi, trang_thai: 'cho_ky', ly_do: `${tot.nguoi} ${tot.so_dung}/${tot.tong} (lỗi kiểm ${tot.loi_kiem}) > ${cu} ${goc.so_dung}/${goc.tong} (lỗi kiểm ${goc.loi_kiem})` } : null };
  fs.mkdirSync(tvDir(k), { recursive: true }); fs.writeFileSync(path.join(tvDir(k), `${id}.json`), JSON.stringify(kq, null, 1));
  ghiLog({ luot: `thu-viec-${id}`, loai: 'quyet', tu: 'ha', chi_tiet: { thu_viec: vai, ket: ket.map((x) => `${x.nguoi} ${x.so_dung}/${x.tong} lỗi ${x.loi_kiem}`).join(' · '), de_cu: kq.de_cu?.nguoi ?? 'không' } });
  return kq;
}
/** Giám đốc ký / bác một đề cử (đổi người giữ vai = mức 3). Ký → sổ bổ nhiệm, lượt sau dùng người mới. */
export function kyDeCu(k, id, dongY) {
  const f = path.join(tvDir(k), `${id}.json`); if (!fs.existsSync(f)) throw new Error(`không có thử việc ${id}`);
  const kq = JSON.parse(fs.readFileSync(f, 'utf8')); if (kq.de_cu?.trang_thai !== 'cho_ky') throw new Error('đề cử này không chờ ký');
  if (vaiCuaPhong(k)[kq.vai] !== kq.nguoi_cu) throw new Error(`người giữ vai đã đổi từ lúc thử việc — thử lại`);
  if (dongY) boNhiem(kq.phong, kq.vai, kq.de_cu.nguoi, `thử việc ${id}: ${kq.de_cu.ly_do}`);
  kq.de_cu = { ...kq.de_cu, trang_thai: dongY ? 'da_ky' : 'bi_bac', luc: new Date().toISOString() };
  fs.writeFileSync(f, JSON.stringify(kq, null, 1));
  ghiLog({ luot: `de-cu-${id}`, loai: 'quyet', tu: 'giam-doc', chi_tiet: { de_cu: kq.de_cu.nguoi, vai: kq.vai, ky: dongY } });
  return kq;
}

/** Thử một THAY ĐỔI cấu hình trên bộ việc chuẩn mà KHÔNG áp vào quy trình đang chạy (để đánh giá trước khi đề xuất). */
export async function thuCauHinh(k, thayDoi, lan = 2) {
  const goc = hienHanh(k); return chayBoViec(k, apThayDoi(goc, thayDoi), lan, 'thu', { ban: goc.ban, thu: thayDoi });
}

/** So bản đang thử với bản gốc của nó trên cùng bộ việc → GIỮ hoặc tự QUAY LẠI. Bản gốc chưa có điểm thì chạy luôn. */
export async function soVaQuyet(k, lan = 2) {
  const dx = dsDeXuat(k).find((d) => d.trang_thai === 'dang_thu');
  if (!dx) { const kq = await soPhienBan(k, hienHanh(k).ban, lan); return { kq, quyet: null }; }
  const goc = diemMoiNhat(k, dx.tu_ban) ?? await soPhienBan(k, dx.tu_ban, lan);
  const moi = await soPhienBan(k, dx.ban_moi, lan);
  const giu = moi.diem >= goc.diem;   // ponytail: bằng điểm vẫn giữ — bộ việc 7 × 2 lần còn thô; nâng lên "phải hơn + chi phí" khi bộ việc lớn hơn
  dx.trang_thai = giu ? 'giu' : 'quay_lai';
  dx.so_sanh = { cu: { ban: dx.tu_ban, diem: goc.diem, so_dung: goc.so_dung, tong: goc.tong, chi_phi: goc.chi_phi }, moi: { ban: dx.ban_moi, diem: moi.diem, so_dung: moi.so_dung, tong: moi.tong, chi_phi: moi.chi_phi } };
  ghiDeXuat(dx);
  if (!giu && hienHanh(k).ban === dx.ban_moi) veBan(k, dx.tu_ban, `thử thua trên bộ việc chuẩn: v${dx.ban_moi} ${moi.so_dung}/${moi.tong} < v${dx.tu_ban} ${goc.so_dung}/${goc.tong}`, 'may');
  return { kq: moi, goc, quyet: dx.trang_thai, dx };
}

/** Buổi họp rút kinh nghiệm → một đề xuất đã xếp mức và đã xử lý theo mức. */
export async function hop(k) {
  const cfg = hienHanh(k); const b = bien();
  if (dsDeXuat(k).some((d) => d.trang_thai === 'dang_thu')) throw new Error('đang có bản thử chưa so trên bộ việc chuẩn — so xong rồi mới họp tiếp (mỗi lần một thay đổi)');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const nk = { ts: `hop-${ts}`, buoc: [] };
  const luot = dsLuotTho().filter((l) => !l.bo_viec && (l.khoa ?? 'thu-nghiem/lam-viec') === k && (l.quy_trinh ?? 1) === cfg.ban);   // lượt cũ chưa ghi khoá = quy trình duy nhất lúc đó
  const cs = chiSo(luot);
  const chuaDat = luot.filter((l) => l.trang_thai !== 'đang chạy' && l.ket?.trang_thai_viec !== 'submitted').slice(0, 3)
    .map((l) => ({ luot: l.ts, viec: l.viec, ket: l.ket?.trang_thai_viec ?? l.trang_thai, buoc: (l.buoc || []).map((x) => `${x.buoc} · ${x.ai}: ${String(x.dap || x.loi || '').slice(0, 350)}`) }));
  const diem = dsBan(k).map((x) => ({ ban: x.ban, diem: diemMoiNhat(k, x.ban) })).filter((x) => x.diem).map((x) => ({ ban: x.ban, dung: `${x.diem.so_dung}/${x.diem.tong}`, sai: x.diem.chi_tiet.filter((c) => !c.dung).map((c) => `${c.id}: ${c.ly_do}`).slice(0, 6) }));
  const cu = dsDeXuat(k).slice(0, 5).map((d) => ({ id: d.id, trang_thai: d.trang_thai, thay: d.thay_doi.map((t) => `${t.khoa}=${JSON.stringify(t.moi)}`) }));
  const tam = nhanSu(giaiNguoi(k, cfg.nguoi.giao).nguoi, nk.ts), ha = nhanSu('ha', nk.ts);   // người đang giữ vai giao việc (trưởng phòng)
  const deXuat = json(await goi(tam, `HỌP RÚT KINH NGHIỆM — ${tenPhong(k)}, quy trình "${k}" đang chạy v${cfg.ban}.
Cấu hình hiện hành: ${JSON.stringify(rutGon(cfg))}
Biên (mức 1 phòng tự áp · 2 cần Hà · 3 cần Giám đốc; khoá ngoài biên = mức 3): ${JSON.stringify(b)}
${CONG_TAC}
Số liệu máy tính trên ${cs.so_luot} lượt thật của v${cfg.ban}: ${JSON.stringify(cs)}
Điểm trên bộ việc chuẩn (Hà chấm): ${JSON.stringify(diem)}
Lượt chưa đạt gần nhất: ${JSON.stringify(chuaDat)}
Đề xuất trước đây: ${JSON.stringify(cu)}
Quy định của công ty và của dự án phòng tham gia đứng TRÊN quy trình của phòng: không đề xuất gì làm trái hay nới các quy định đó.
Nhiệm vụ: chỉ ra tối đa 3 vấn đề CÓ BẰNG CHỨNG (mã lượt + bước), rồi đề xuất thay đổi NHỎ NHẤT trên cấu hình để sửa gốc. TUYỆT ĐỐI không nới tiêu chí cho dễ đạt. Không có vấn đề thật thì để thay_doi rỗng.
Trả JSON: {"van_de":[{"mo_ta":"…","bang_chung":"…"}],"thay_doi":{"<khoá, vd so_vong_lam_lai hoặc nguoi.trong_tai>":<giá trị>},"ky_vong":"<chỉ số nào sẽ tốt lên, bao nhiêu>"}`, 'đề xuất', nk, { tu: 'giam-doc' }));
  if (!deXuat) throw new Error(`${tam.ten} không trả JSON đề xuất`);
  const pb = json(await goi(ha, `PHẢN BIỆN đề xuất đổi quy trình "${k}" của ${tenPhong(k)} (bạn là Kiểm soát, ngoài phòng).
Cấu hình hiện hành: ${JSON.stringify(rutGon(cfg))}
Số liệu: ${JSON.stringify(cs)} · Điểm bộ việc chuẩn: ${JSON.stringify(diem)}
Đề xuất của ${tam.ten}: ${JSON.stringify(deXuat)}
Kiểm: (1) bằng chứng có thật trong số liệu/lượt không; (2) thay đổi có NỚI CHUẨN chất lượng không (có → bác); (3) có cách nhỏ hơn không.
Trả JSON: {"dong_y":true|false,"sua":{<thay_doi thay thế, hoặc null>},"ly_do":"…"}`, 'phản biện', nk, { tu: tam.id }));
  const td = pb?.dong_y && pb.sua && typeof pb.sua === 'object' ? pb.sua : deXuat.thay_doi;
  const moi = apThayDoi(cfg, td); const m = mucThayDoi(cfg, moi);
  const dx = { id: ts, ts: new Date().toISOString(), qt: k, tu_ban: cfg.ban, van_de: deXuat.van_de || [], ky_vong: deXuat.ky_vong ?? '', thay_doi: m.thay, vuot: m.vuot, muc: m.muc,
    ha: { dong_y: !!pb?.dong_y, ly_do: pb?.ly_do ?? 'không trả lời', sua: pb?.sua ?? null }, moi, chi_phi: usdLuot(nk), buoc: nk.buoc.map((x) => ({ buoc: x.buoc, ai: x.ai, model: x.model, usage: x.usage, ms: x.ms })) };
  const ap = (ai) => { const v = apBanMoi(k, moi, { ly_do: (dx.van_de[0]?.mo_ta ?? 'họp rút kinh nghiệm').slice(0, 200), de_xuat: dx.id, ai_duyet: ai }); dx.ban_moi = v.ban; dx.trang_thai = 'dang_thu'; };
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
export function duyetDeXuat(k, id, dongY, ai = 'giam-doc') {
  const dx = dsDeXuat(k).find((d) => d.id === id);
  if (!dx) throw new Error(`không có đề xuất ${id}`);
  if (dx.trang_thai !== 'cho_duyet') throw new Error(`đề xuất ${id} đang ở "${dx.trang_thai}", không chờ duyệt`);
  if (dongY) {
    if (dsDeXuat(k).some((d) => d.trang_thai === 'dang_thu')) throw new Error('đang có bản thử chưa so — so xong rồi mới áp thêm (mỗi lần một thay đổi)');
    if (hienHanh(k).ban !== dx.tu_ban) throw new Error(`quy trình đã đổi từ v${dx.tu_ban} sang v${hienHanh(k).ban} — đề xuất này lỗi thời, họp lại`);
    const v = apBanMoi(k, dx.moi, { ly_do: (dx.van_de[0]?.mo_ta ?? 'Giám đốc ký').slice(0, 200), de_xuat: dx.id, ai_duyet: ai }); dx.ban_moi = v.ban; dx.trang_thai = 'dang_thu';
  } else dx.trang_thai = 'bi_bac';
  dx.giam_doc = { dong_y: dongY, luc: new Date().toISOString() };
  return ghiDeXuat(dx);
}

// Việc đang chạy (họp / so phiên bản) của một phòng — trang đọc để khoá nút + hiện "đang chạy", worker xoá khi xong (kể cả lỗi).
const khoaDir = () => path.join(DATA(), 'dang-chay');
export function dangChayCaiTien(k) { const f = path.join(khoaDir(), `${k}.json`); if (!fs.existsSync(f)) return null; const x = JSON.parse(fs.readFileSync(f, 'utf8')); return Date.now() - Date.parse(x.tu) > 30 * 60e3 ? null : x; }
// tom_tat luôn là CHỮ (trang in thẳng ra) — một việc từng trả object vào đây làm trang quy trình 500 (11/10/2026). Ghi là chặn, đọc không vá.
const tomTat = (r) => (typeof r === 'string' ? r : r?.ben ? r.ben.map((b) => `${r.nguoi}.${r.chi_so}=${b.gia_tri}: ${b.so_dung}/${b.tong}`).join(' vs ') : JSON.stringify(r ?? '').slice(0, 200));
export function ketQuaGanNhat(k) { const f = path.join(khoaDir(), `${k}-ket.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }
async function voiKhoa(k, viec, fn) {
  const f = path.join(khoaDir(), `${k}.json`); fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ viec, tu: new Date().toISOString() }));
  try { const r = await fn(); fs.writeFileSync(path.join(khoaDir(), `${k}-ket.json`), JSON.stringify({ viec, ok: true, luc: new Date().toISOString(), tom_tat: tomTat(r) })); return r; }
  catch (e) { fs.writeFileSync(path.join(khoaDir(), `${k}-ket.json`), JSON.stringify({ viec, ok: false, luc: new Date().toISOString(), loi: String(e.message || e) })); throw e; }
  finally { fs.rmSync(f, { force: true }); }
}

// TRƯỞNG PHÒNG TỰ TRIỆU TẬP (anh chốt 11/10/2026). Sau mỗi lượt thật, máy xét chỉ số (0 đồng) theo ngưỡng `tu_hop` của quy trình;
// chạm ngưỡng thì trưởng phòng tự họp, ra bản thử thì tự so trên bộ việc chuẩn. Chỉ chi trong ngân sách tháng của phòng
// (`ngan_sach_cai_tien_usd_thang` trong hồ sơ phòng — Giám đốc cấp; 0/không khai = không tự họp). Hết ngân sách: ghi sổ, không chi.
const UOC = { hop: 0.01, so: 0.02, luot: 0.0006, rut: 0.0004 };   // ponytail: ước trước khi chi; số thật cộng từ chi_phi đã ghi của đề xuất + lần so
export function chiThang(k, luc = new Date()) {
  const thang = luc.toISOString().slice(0, 7);
  const cong = (ds) => ds.filter((x) => String(x.ts).slice(0, 7) === thang).reduce((s, x) => s + (Number(x.chi_phi) || 0), 0);
  return cong(dsDeXuat(k)) + cong(dsSoSanh(k)) + cong(dsSoTinhCach(k)) + cong(dsLanRut(k));   // thử việc lưu từng lần chạy vào so-sanh (tiền tố tv-) nên đã nằm trong dsSoSanh
}

// RÚT KINH NGHIỆM (decision 2026-10-11 nhân sự sống, bước 2): sau một lượt CÓ VẤP (không nộp được, hoặc bị bác rồi làm lại), mỗi người
// tham gia tự rút MỘT bài học kèm bằng chứng trỏ lượt vừa làm; trùng ý bài đang có thì cộng vào bài đó. Chi trong ngân sách phòng; lượt
// suôn sẻ thì không rút (đỡ tiền). Lưu, chọn, đếm, lên kỹ năng/phai ở kinh-nghiem.mjs.
const rutDir = (k) => path.join(DATA(), 'kinh-nghiem', 'lan', k);
export function dsLanRut(k) { const d = rutDir(k); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))) : []; }
export const coVap = (nk) => nk.ket?.trang_thai_viec !== 'submitted' || (nk.buoc || []).some((b) => /làm lại/.test(b.buoc) || b.bi_gat);
// Ai rút bài học: có lời bác bị GẠT (bác sai) thì người BÁC rút, người bị bác thì không (không học theo lời bác sai);
// còn vấp thật (làm lại sau lời bác đúng, không nộp được) thì mọi người tham gia rút.
export const nguoiRut = (nk) => { const gat = [...new Set((nk.buoc || []).filter((b) => b.bi_gat).map((b) => b.id))]; const that = nk.ket?.trang_thai_viec !== 'submitted' || (nk.buoc || []).some((b) => /làm lại/.test(b.buoc));
  return that ? [...new Set((nk.buoc || []).map((b) => b.id).filter((id) => id !== 'may-do'))] : gat; };
export async function rutBaiHoc(nk, k = nk.khoa ?? 'thu-nghiem/lam-viec') {
  if (nk.bo_viec || !coVap(nk)) return [];
  const ra = [];
  for (const id of nguoiRut(nk)) {
    if (chiThang(k) + UOC.rut > nganSach(k)) { ra.push({ id, ghi: null, ly_do: `hết ngân sách cải tiến tháng ($${chiThang(k).toFixed(3)} / $${nganSach(k)})` }); continue; }
    const cua = (nk.buoc || []).filter((b) => b.id === id); const ns = { ...nhanSu(id, nk.ts), vai: null };
    const phanHoi = (nk.buoc || []).filter((b) => b.id !== id && /soát|trọng tài/.test(b.buoc)).map((b) => `${b.buoc} · ${b.ai}: ${String(b.dap || '').slice(0, 240)}`);
    const dang = dsBaiHoc(id).filter((b) => b.khoa === k && trangThai(b) !== 'phai').map((b) => ({ ma: b.ma, noi_dung: b.noi_dung }));
    const tam = { ts: `kn-${nk.ts}-${id}`, buoc: [], ten_phong: tenPhong(k) };
    let kq = null; let loi = null;
    try {
      kq = json(await goi(ns, `RÚT KINH NGHIỆM sau lượt ${nk.ts} (${tenPhong(k)}).
Việc: ${nk.viec}
Kết quả lượt: ${nk.ket?.trang_thai_viec ?? nk.trang_thai}${nk.ket?.ghi_chu ? ` — ${nk.ket.ghi_chu}` : ''}
Các bước BẠN làm: ${JSON.stringify(cua.map((b) => ({ buoc: b.buoc, tra_loi: String(b.dap || b.loi || '').slice(0, 300) })))}
Phản hồi người khác về việc trong lượt: ${JSON.stringify(phanHoi)}
Bài học bạn đang có: ${JSON.stringify(dang)}
Nếu có MỘT điều lần sau BẠN nên làm khác để tránh vấp này, viết thành một câu hành động cụ thể (tối đa 25 từ), kèm bằng chứng = mã lượt + tên bước. Trùng ý một bài đang có thì trả trung_voi = mã bài đó. Không có gì đáng rút thì bai_hoc = null. Cấm rút bài học kiểu nới chuẩn, bỏ qua tiêu chí hay đổ lỗi cho người khác.
Trả JSON: {"bai_hoc":"…"|null,"bang_chung":"<mã lượt> <tên bước>","trung_voi":null|"<mã bài>"}`, 'rút kinh nghiệm', tam, { tu: 'giam-doc' }));
    } catch (e) { loi = `lỗi gọi mô hình: ${e.message}`; }
    const g = kq ? ghiBaiHoc(id, k, nk, kq) : { ghi: null, ly_do: loi ?? 'không trả JSON' };
    const lan = { qt: k, luot: nk.ts, nguoi: id, ts: new Date().toISOString(), chi_phi: usdLuot(tam), ...g, bai_hoc: kq?.bai_hoc ?? null };
    fs.mkdirSync(rutDir(k), { recursive: true }); fs.writeFileSync(path.join(rutDir(k), `${nk.ts}-${id}.json`), JSON.stringify(lan));
    ghiLog({ luot: nk.ts, loai: 'quyet', tu: id, chi_tiet: { rut_kinh_nghiem: g.ghi ?? 'không', bai_hoc: kq?.bai_hoc ?? null, ly_do: g.ly_do } });
    ra.push({ id, ...g });
  }
  return ra;
}

// SO CHỈ SỐ GỐC (decision 2026-10-11): chỉ số tính cách phải CHỨNG MINH tác dụng. Chạy bộ việc chuẩn hai lần cho cùng quy trình, chỉ đổi
// một chỉ số của một người (ghi đè riêng lượt, không đụng SOUL) → so tỉ lệ đúng + năng lực của người đó. Không khác = chỉ số trang trí.
const tcDir = (k) => path.join(DATA(), 'tinh-cach', k);
export function dsSoTinhCach(k) { const d = tcDir(k); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort().reverse().map((f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))) : []; }
/** Mọi lần so chỉ số gốc của một người, ở mọi quy trình. */
export function soTinhCachCua(nguoi) {
  const goc = path.join(DATA(), 'tinh-cach'); if (!fs.existsSync(goc)) return [];
  const ds = []; const di = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) di(p); else if (f.name.startsWith(`${nguoi}-`) && f.name.endsWith('.json')) ds.push(JSON.parse(fs.readFileSync(p, 'utf8'))); } };
  di(goc); return ds.sort((a, b) => b.ts.localeCompare(a.ts));
}
export async function soTinhCach(k, nguoi, ma, giaTri, lan = 1) {
  const bo = boViecChuan(k); if (!bo) throw new Error(`${k} chưa có bộ việc chuẩn`);
  const { hoSoNangLuc } = await import('./nang-luc.mjs');
  const ben = [];
  for (const v of giaTri) {
    const ct = []; const luot = [];
    for (const x of bo.viec) for (let i = 0; i < lan; i++) {
      const l = await motLuot(x.viec, true, { khoa: k, boViec: x.id, tinhCach: { [nguoi]: { [ma]: v } } }); luot.push(l);
      ct.push({ id: x.id, luot: l.ts, usd: usdLuot(l), ...chamViecChuan(l, x) });
    }
    const nl = hoSoNangLuc(luot)[nguoi]?.nang_luc ?? {};
    ben.push({ gia_tri: v, so_dung: ct.filter((c) => c.dung).length, tong: ct.length, chi_phi: ct.reduce((s, c) => s + c.usd, 0), nang_luc: Object.fromEntries(Object.entries(nl).map(([kk, x]) => [kk, { dat: x.dat, so_mau: x.so_mau }])), chi_tiet: ct });
  }
  const kq = { qt: k, nguoi, chi_so: ma, lan, ts: new Date().toISOString(), ben, chi_phi: ben.reduce((s, b) => s + b.chi_phi, 0) };
  fs.mkdirSync(tcDir(k), { recursive: true }); fs.writeFileSync(path.join(tcDir(k), `${nguoi}-${ma}-${kq.ts.replace(/[:.]/g, '-')}.json`), JSON.stringify(kq, null, 1));
  ghiLog({ luot: `tc-${kq.ts}`, loai: 'quyet', tu: 'ha', chi_tiet: { so_tinh_cach: `${nguoi}.${ma}`, ket: ben.map((b) => `${b.gia_tri}: ${b.so_dung}/${b.tong}`).join(' vs ') } });
  return kq;
}
export const nganSach = (k) => Number(phongFm(k).ngan_sach_cai_tien_usd_thang) || 0;
export function xetTuHop(k, { boQuaKhoa = false } = {}) {
  const cfg = hienHanh(k); const t = cfg.tu_hop; const ns = nganSach(k); const chi = chiThang(k);
  const tien = { chi, ngan_sach: ns };
  if (!t?.bat) return { lam: null, ly_do: 'quy trình chưa bật tự họp', ...tien };
  const vaiGiao = theVai(cfg.nguoi?.giao);   // quyền tự triệu tập thuộc VAI, không thuộc người
  if (vaiGiao && !(vaiGiao.quyen ?? []).includes('tu_trieu_tap_hop')) return { lam: null, ly_do: `vai "${vaiGiao.ten}" không có quyền tự triệu tập họp`, ...tien };
  if (!ns) return { lam: null, ly_do: 'phòng chưa được cấp ngân sách cải tiến', ...tien };
  if (!boQuaKhoa && dangChayCaiTien(k)) return { lam: null, ly_do: 'đang họp / đang so', ...tien };
  const dx = dsDeXuat(k);
  const can = (lam, lyDo) => (chi + UOC[lam] <= ns ? { lam, ly_do: lyDo, ...tien } : { lam: null, het_tien: true, ly_do: `${lyDo} — nhưng hết ngân sách tháng ($${chi.toFixed(3)} / $${ns})`, ...tien });
  if (dx.some((d) => d.trang_thai === 'dang_thu')) return can('so', 'có bản thử chưa so trên bộ việc chuẩn');
  const luot = dsLuotTho().filter((l) => !l.bo_viec && l.trang_thai !== 'đang chạy' && (l.khoa ?? 'thu-nghiem/lam-viec') === k);
  const sau = dx[0] ? luot.filter((l) => String(l.bat_dau ?? '') > dx[0].ts).length : luot.length;
  if (dx[0] && sau < (t.cach_toi_thieu_luot ?? 5)) return { lam: null, ly_do: `mới ${sau} lượt từ buổi họp trước (cần ${t.cach_toi_thieu_luot ?? 5})`, ...tien };
  let lien = 0; for (const l of luot) { if (l.ket?.trang_thai_viec === 'submitted') break; lien++; }
  const d = diemMoiNhat(k, cfg.ban);
  const lyDo = d && d.diem < t.ty_le_dat_duoi ? `v${cfg.ban} chỉ đạt ${d.so_dung}/${d.tong} việc chuẩn (dưới ${Math.round(t.ty_le_dat_duoi * 100)}%)`
    : lien >= t.lam_lai_lien_tiep ? `${lien} lượt liên tiếp chưa đạt (ngưỡng ${t.lam_lai_lien_tiep})` : null;
  return lyDo ? can('hop', lyDo) : { lam: null, ly_do: 'chỉ số trong ngưỡng', ...tien };
}
export async function tuXet(k) {
  const x = xetTuHop(k, { boQuaKhoa: true }); const truong = giaiNguoi(k, hienHanh(k).nguoi?.giao)?.nguoi ?? 'tam';
  if (x.lam || x.het_tien) ghiLog({ luot: `tu-xet-${Date.now()}`, loai: 'quyet', tu: truong, chi_tiet: { tu_trieu_tap: k, lam: x.lam ?? 'không (hết ngân sách)', ly_do: x.ly_do, chi_thang: x.chi, ngan_sach: x.ngan_sach } });
  if (!x.lam) return x.ly_do;
  let kq = '';
  if (x.lam === 'hop') {
    const dx = await hop(k); kq = `họp vì ${x.ly_do} → mức ${dx.muc}, ${dx.trang_thai}`;
    if (dx.trang_thai !== 'dang_thu') return kq;
    const y = xetTuHop(k, { boQuaKhoa: true }); if (y.lam !== 'so') return `${kq}; chưa so: ${y.ly_do}`;
  }
  const r = await soVaQuyet(k);
  return `${kq ? `${kq}; ` : ''}so: ${r.quyet ? `v${r.dx.ban_moi} ${r.kq.so_dung}/${r.kq.tong} vs v${r.dx.tu_ban} ${r.goc.so_dung}/${r.goc.tong} → ${r.quyet === 'giu' ? 'giữ' : 'quay lại'}` : `v${r.kq.ban} ${r.kq.so_dung}/${r.kq.tong}`}`;
}

const laCli = (process.argv[1] || '').endsWith('cai-tien.mjs');
const thamSo = (k, mac) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : mac);
if (laCli && process.argv.includes('--hop')) { const P = thamSo('--qt', 'thu-nghiem/lam-viec'); const dx = await voiKhoa(P, 'hop', async () => { const d = await hop(P); return `đề xuất ${d.id}: mức ${d.muc} → ${d.trang_thai}`; }); console.log(dx); process.exit(0); }
if (laCli && process.argv.includes('--so')) { const P = thamSo('--qt', 'thu-nghiem/lam-viec'); const r = await voiKhoa(P, 'so', async () => { const x = await soVaQuyet(P, Number(thamSo('--lan', 2))); return x.quyet ? `v${x.dx.ban_moi} ${x.kq.so_dung}/${x.kq.tong} so với v${x.dx.tu_ban} ${x.goc.so_dung}/${x.goc.tong} → ${x.quyet === 'giu' ? 'giữ' : 'quay lại'}` : `v${x.kq.ban}: ${x.kq.so_dung}/${x.kq.tong} việc chuẩn đúng`; }); console.log(r); process.exit(0); }

if (laCli && process.argv.includes('--so-tinh-cach')) {   // node worker/cai-tien.mjs --so-tinh-cach --qt thu-nghiem/lam-viec --nguoi loc --chi-so can_than --gia-tri 2,9 [--lan 1]
  const P = thamSo('--qt', 'thu-nghiem/lam-viec'); const ns = nganSach(P), chi = chiThang(P);
  const gt = String(thamSo('--gia-tri', '2,9')).split(',').map(Number); const lan = Number(thamSo('--lan', 1));
  const uoc = gt.length * (boViecChuan(P)?.viec.length ?? 0) * lan * UOC.luot;
  if (chi + uoc > ns) { console.log(`✗ vượt ngân sách cải tiến tháng: đã chi $${chi.toFixed(3)}, ước thêm $${uoc.toFixed(3)}, trần $${ns}`); process.exit(1); }
  const kq = await voiKhoa(P, 'so', () => soTinhCach(P, thamSo('--nguoi', 'loc'), thamSo('--chi-so', 'can_than'), gt, lan));
  console.log(kq.ben.map((b) => `${kq.nguoi}.${kq.chi_so}=${b.gia_tri}: ${b.so_dung}/${b.tong} đúng · thực hiện vòng đầu ${b.nang_luc.thuc_hien?.dat ?? '-'}/${b.nang_luc.thuc_hien?.so_mau ?? '-'} · $${b.chi_phi.toFixed(4)}`).join('\n')); process.exit(0);
}

if (laCli && process.argv.includes('--thu-cau-hinh')) {   // node worker/cai-tien.mjs --thu-cau-hinh '{"phuc_khao.ti_le":1}' --qt thu-nghiem/lam-viec --lan 2
  const P = thamSo('--qt', 'thu-nghiem/lam-viec'); const lan = Number(thamSo('--lan', 2)); const td = JSON.parse(thamSo('--thu-cau-hinh', '{}'));
  const uoc = (boViecChuan(P)?.viec.length ?? 0) * lan * UOC.luot * 1.5;
  if (chiThang(P) + uoc > nganSach(P)) { console.log(`✗ vượt ngân sách cải tiến tháng: đã chi $${chiThang(P).toFixed(3)}, ước thêm $${uoc.toFixed(3)}, trần $${nganSach(P)}`); process.exit(1); }
  const kq = await voiKhoa(P, 'so', () => thuCauHinh(P, td, lan));
  const ct = kq.chi_tiet; const bacV1 = ct.filter((c) => c.kiem_bac_v1 && c.v1_dat_may != null);
  console.log(JSON.stringify({ thu: td, ban_goc: kq.ban, dung_ky_vong: `${kq.so_dung}/${kq.tong}`, duyet_vong_dau: `${ct.filter((c) => c.vong_dau).length}/${ct.filter((c) => c.vong_dau != null).length}`,
    kiem_bac_v1_o_viec_co_do: bacV1.length, trong_do_bai_dat_moi_phep_do: bacV1.filter((c) => c.v1_dat_may).length,
    phuc_khao_v1: { gat_khi_bai_dat_do: bacV1.filter((c) => c.v1_dat_may && c.pk_v1 === 'gat').length, giu_khi_bai_dat_do: bacV1.filter((c) => c.v1_dat_may && c.pk_v1 === 'giu').length, gat_khi_bai_truot_do: bacV1.filter((c) => !c.v1_dat_may && c.pk_v1 === 'gat').length, giu_khi_bai_truot_do: bacV1.filter((c) => !c.v1_dat_may && c.pk_v1 === 'giu').length },
    phuc_khao_tong: ct.flatMap((c) => c.phuc_khao).length, chi_phi: kq.chi_phi.toFixed(4) }, null, 1)); process.exit(0);
}

if (laCli && process.argv.includes('--thu-viec')) {   // node worker/cai-tien.mjs --thu-viec nguoi-kiem --ung-vien ngoc,nhi --qt thu-nghiem/lam-viec --lan 2
  const P = thamSo('--qt', 'thu-nghiem/lam-viec'); const vai = thamSo('--thu-viec', 'nguoi-kiem'); const uv = String(thamSo('--ung-vien', '')).split(',').filter(Boolean); const lan = Number(thamSo('--lan', 2));
  const uoc = (uv.length + 1) * (boViecChuan(P)?.viec.length ?? 0) * lan * UOC.luot * 3;
  if (chiThang(P) + uoc > nganSach(P)) { console.log(`✗ vượt ngân sách cải tiến tháng: đã chi $${chiThang(P).toFixed(3)}, ước thêm $${uoc.toFixed(3)}, trần $${nganSach(P)}`); process.exit(1); }
  const kq = await voiKhoa(P, 'so', () => thuViec(P, vai, uv, lan));
  for (const x of kq.ket) console.log(`${x.nguoi.padEnd(5)} ${x.so_dung}/${x.tong} đúng · bác v1 ${x.so_bac_v1} · bác sai ${x.bac_sai} · duyệt sai ${x.duyet_sai} · $${x.chi_phi.toFixed(4)}`);
  console.log(kq.de_cu ? `→ đề cử ${kq.de_cu.nguoi} (chờ Giám đốc ký): ${kq.de_cu.ly_do}` : '→ không ai hơn người đang giữ vai — không đề cử'); process.exit(0);
}

if (laCli && process.argv.includes('--ap-thu')) {   // node worker/cai-tien.mjs --ap-thu thu-<giờ>.json --qt thu-nghiem/lam-viec
  const P = thamSo('--qt', 'thu-nghiem/lam-viec');
  try { const dx = apKetQuaThu(P, thamSo('--ap-thu', '')); console.log(`✓ áp v${dx.ban_moi} (mức ${dx.muc}): ${dx.ky_vong} · đổi ${dx.thay_doi.map((x) => x.khoa).join(', ')}`); process.exit(0); }
  catch (e) { console.log(`✗ không áp: ${e.message}`); process.exit(1); }
}

if (laCli && process.argv.includes('--sau-luot')) {   // ca.mjs gọi sau mỗi lượt thật: đếm áp dụng (0 đồng) → rút kinh nghiệm nếu có vấp → tự xét họp
  const P = thamSo('--qt', 'thu-nghiem/lam-viec'); const ts = thamSo('--sau-luot', '');
  const nk = JSON.parse(fs.readFileSync(path.join(DATA(), 'nhat-ky', `${ts}.json`), 'utf8'));
  console.log(`sau lượt ${ts}: áp dụng bài học của ${ghiApDung(nk)} người`);
  for (const r of await rutBaiHoc(nk, P)) console.log(`  rút kinh nghiệm ${r.id}: ${r.ghi ?? 'không'}${r.ly_do ? ` (${r.ly_do})` : ''}`);
  const x = xetTuHop(P);
  if (!x.lam) { if (x.het_tien) await tuXet(P); console.log(`tự xét ${P}: ${x.ly_do}`); process.exit(0); }
  console.log(`tự xét ${P}: ` + await voiKhoa(P, x.lam, () => tuXet(P))); process.exit(0);
}

if (laCli && process.argv.includes('--tu-xet')) {   // gọi sau mỗi lượt thật (ca.mjs): xét 0 đồng, chạm ngưỡng mới chi
  const P = thamSo('--qt', 'thu-nghiem/lam-viec'); const x = xetTuHop(P);
  if (!x.lam) { if (x.het_tien) await tuXet(P); console.log(`tự xét ${P}: ${x.ly_do}`); process.exit(0); }
  console.log(`tự xét ${P}: ` + await voiKhoa(P, x.lam, () => tuXet(P))); process.exit(0);
}

if (laCli && process.argv.includes('--tu-kiem')) {
  // Proxy giả: Tâm/Hà/Kỳ/Lộc trả lời theo kịch bản; v2 bật hỏi-lại → việc không thể sẽ kẹt đúng → điểm v2 > v1 → GIỮ.
  let kich = {}; const danCua = {};
  const fake = http.createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c; const staff = req.headers['x-cty-staff']; danCua[staff] = String(JSON.parse(raw).system || '');
    const hoi = String(JSON.parse(raw).messages?.[0]?.content || '');
    let ans;
    if (hoi.startsWith('RÚT KINH NGHIỆM')) { const ts = (hoi.match(/sau lượt (\S+)/) || [])[1]; ans = JSON.stringify({ bai_hoc: `${staff} lần sau đếm lại từng tiêu chí trước khi nộp`, bang_chung: `${ts} bước làm`, trung_voi: null }); }
    else if (hoi.startsWith('HỌP')) ans = JSON.stringify({ van_de: [{ mo_ta: 'việc thiếu dữ kiện vẫn làm', bang_chung: 'lượt X bước 2' }], thay_doi: kich.thayDoi, ky_vong: 'việc không thể → kẹt' });
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
  const P = 'thu-nghiem/lam-viec';
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
  // tự triệu tập: v1 điểm thấp → họp; hết ngân sách → không chi; chưa đủ lượt từ buổi trước → chờ
  veBan(P, 1, 'thử tự họp', 'anh');
  fs.writeFileSync(path.join(ssDir(P), 'v1-zz.json'), JSON.stringify({ qt: P, ban: 1, ts: new Date().toISOString(), diem: 0.2, so_dung: 3, tong: 14, chi_phi: 0, chi_tiet: [] }));
  const tKhong = xetTuHop(P);
  a(tKhong.lam === null && /lượt từ buổi họp trước/.test(tKhong.ly_do), 'vừa họp xong → chờ đủ lượt', tKhong);
  for (let i = 0; i < 5; i++) await motLuot('Viết 1 câu chào', true, { khoa: P });
  const tCo = xetTuHop(P);
  a(tCo.lam === 'hop' && /3\/14/.test(tCo.ly_do), 'v1 3/14 + đủ 5 lượt → Tâm tự họp', tCo);
  kich = { thayDoi: { so_vong_lam_lai: 2 } };
  const kqTu = await tuXet(P);
  a(/họp vì .*3\/14/.test(kqTu) && /so:/.test(kqTu), `tự họp → bản thử → tự so (${kqTu})`);
  // rút kinh nghiệm: lượt có vấp → mỗi người rút 1 bài (bằng chứng trỏ lượt), tính vào chi tháng; lượt suôn sẻ → không rút; lượt sau → bài vào lời dặn
  const vap = { ts: '2026-10-11T07-00-00-000Z', khoa: P, viec: 'thử', trang_thai: 'xong', ket: { trang_thai_viec: 'revision' }, buoc: [{ buoc: '1 giao việc', id: 'tam', ai: 'Tâm', dap: '{}' }, { buoc: '2 làm', id: 'loc', ai: 'Lộc', dap: '{}' }, { buoc: '3 soát', id: 'ky', ai: 'Kỳ', dap: '{"ok":false,"ly_do":"thiếu câu"}' }] };
  const gatMa = { ...vap, ts: '2026-10-11T06-59-00-000Z', ket: { trang_thai_viec: 'submitted' }, buoc: [vap.buoc[0], vap.buoc[1], { ...vap.buoc[2], bi_gat: 'phuc_khao' }, { buoc: '4 phúc khảo', id: 'ha', ai: 'Hà', dap: '{"bac_dung":false}' }] };
  a(coVap(gatMa) && JSON.stringify(nguoiRut(gatMa)) === '["ky"]' && JSON.stringify(nguoiRut(vap)) === '["tam","loc","ky"]', 'bác sai bị gạt → chỉ người bác rút bài học; vấp thật → mọi người', { gat: nguoiRut(gatMa), vap: nguoiRut(vap) });
  const chiTruocRut = chiThang(P); const rut = await rutBaiHoc(vap, P);
  a(rut.length === 3 && rut.every((r) => r.ghi === 'moi') && dsLanRut(P).length === 3 && chiThang(P) > chiTruocRut, 'lượt có vấp: 3 người rút bài, có lưu, cộng chi tháng', rut);
  a((await rutBaiHoc({ ...vap, ts: '2026-10-11T07-01-00-000Z', ket: { trang_thai_viec: 'submitted' } }, P)).length === 0, 'lượt suôn sẻ: không rút, không tốn');
  const sau = await motLuot('Viết 1 câu chào', true, { khoa: P });
  a(/KINH NGHIỆM CỦA BẠN[\s\S]*loc lần sau đếm lại/.test(danCua.loc ?? '') && sau.buoc.some((b) => b.id === 'loc' && b.bai_hoc?.length === 1), 'lượt sau: bài học vào lời dặn + ghi bước đã dùng bài nào', { dan: (danCua.loc ?? '').slice(-200) });
  a(ghiApDung(sau) >= 1 && dsBaiHoc('loc').some((b) => b.lan_ap_dung === 1), 'đếm áp dụng sau lượt', dsBaiHoc('loc'));
  // hết ngân sách tháng → không chi, chỉ ghi lý do (khoản chi giả $0,60 trong tháng, ngân sách phòng $0,50)
  ghiDeXuat({ id: '0000-chi-gia', ts: new Date().toISOString(), qt: P, tu_ban: 1, trang_thai: 'khong_doi', muc: 1, thay_doi: [], vuot: [], van_de: [], chi_phi: 0.6 });
  for (let i = 0; i < 5; i++) await motLuot('Viết 1 câu chào', true, { khoa: P });
  const tHet = xetTuHop(P);
  a(tHet.lam === null && tHet.het_tien && /hết ngân sách/.test(tHet.ly_do) && tHet.chi > 0.5, 'hết ngân sách tháng → không họp', tHet);
  const rutHet = await rutBaiHoc({ ...vap, ts: '2026-10-11T07-02-00-000Z' }, P);
  a(rutHet.length === 3 && rutHet.every((r) => r.ghi === null && /hết ngân sách/.test(r.ly_do)), 'hết ngân sách → không rút kinh nghiệm', rutHet);
  // kết quả gần nhất luôn là CHỮ (trang in thẳng) — kể cả tệp cũ ghi object
  await voiKhoa(P, 'so', async () => ({ nguoi: 'loc', chi_so: 'can_than', ben: [{ gia_tri: 2, so_dung: 1, tong: 7 }] }));
  a(typeof ketQuaGanNhat(P).tom_tat === 'string' && /loc.can_than=2: 1\/7/.test(ketQuaGanNhat(P).tom_tat), 'voiKhoa ghi chữ', ketQuaGanNhat(P));
  // thử cấu hình: chạy đủ bộ việc với thay đổi, lưu tiền tố thu-, KHÔNG đổi quy trình đang chạy
  const banTruoc = hienHanh(P).ban; const thu = await thuCauHinh(P, { 'phuc_khao.ti_le': 1 }, 1);
  a(thu.tong === boViecChuan(P).viec.length && thu.thu['phuc_khao.ti_le'] === 1 && hienHanh(P).ban === banTruoc && fs.readdirSync(ssDir(P)).some((f) => f.startsWith('thu-')), 'thử cấu hình: đủ bộ việc, có lưu, không áp', { tong: thu.tong });
  // thử việc + đề cử + ký → sổ bổ nhiệm (ứng viên 'nhi' trả lời như người kiểm giả: luôn duyệt)
  const tv = await thuViec(P, 'nguoi-kiem', ['nhi'], 1);
  a(tv.ket.length === 2 && tv.ket[0].nguoi === 'ky' && tv.ket[1].nguoi === 'nhi' && dsThuViec(P).length === 1, 'thử việc: người đang giữ + ứng viên, cùng bộ việc', tv.ket);
  const tvGia = { ...tv, id: 'zz-gia', de_cu: { nguoi: 'nhi', trang_thai: 'cho_ky', ly_do: 'thử' } }; fs.writeFileSync(path.join(tvDir(P), 'zz-gia.json'), JSON.stringify(tvGia));
  kyDeCu(P, 'zz-gia', true);
  a(vaiCuaPhong(P)['nguoi-kiem'] === 'nhi' && giaiNguoi(P, 'nguoi-kiem').nguoi === 'nhi', 'ký đề cử → sổ bổ nhiệm, lượt sau người mới giữ vai', vaiCuaPhong(P));
  let loiKy = ''; try { kyDeCu(P, 'zz-gia', true); } catch (e) { loiKy = e.message; } a(/không chờ ký/.test(loiKy), 'ký lại đề cử đã ký → từ chối');
  boNhiem('thu-nghiem', 'nguoi-kiem', 'ky', 'trả lại cho các ca sau');
  // áp kết quả thử: chỉ khi hơn bản đang chạy, không mức 3; áp xong thành bản mới "giữ" và có điểm
  const tepThu = fs.readdirSync(ssDir(P)).find((x) => x.startsWith('thu-')); const tThu = JSON.parse(fs.readFileSync(path.join(ssDir(P), tepThu), 'utf8'));
  const banNay = hienHanh(P).ban; const diemNay = diemMoiNhat(P, banNay);
  let loiAp = ''; try { apKetQuaThu(P, tepThu); } catch (e) { loiAp = e.message; }
  a(diemNay && tThu.diem <= diemNay.diem ? /không hơn/.test(loiAp) && hienHanh(P).ban === banNay : true, 'thử không hơn → không áp', { loiAp });
  fs.writeFileSync(path.join(ssDir(P), 'thu-zz-hon.json'), JSON.stringify({ ...tThu, ban: banNay, diem: 1, so_dung: tThu.tong, thu: { so_vong_lam_lai: 1 } }));
  const dxAp = apKetQuaThu(P, 'thu-zz-hon.json');
  a(dxAp.trang_thai === 'giu' && hienHanh(P).ban === dxAp.ban_moi && diemMoiNhat(P, dxAp.ban_moi)?.diem === 1, 'thử hơn → áp thành bản mới, có điểm', dxAp);
  fs.writeFileSync(path.join(ssDir(P), 'thu-zz-m3.json'), JSON.stringify({ ...tThu, ban: hienHanh(P).ban, diem: 1.1, thu: { 'loi_nhac.giao': 'x {viec}' } }));
  loiAp = ''; try { apKetQuaThu(P, 'thu-zz-m3.json'); } catch (e) { loiAp = e.message; }
  a(/mức 3/.test(loiAp), 'thay đổi mức 3 → không áp bằng máy', { loiAp });
  // so chỉ số gốc: chạy được, ghi kết quả, cộng vào chi tháng
  const chiTruoc = chiThang(P); const tc = await soTinhCach(P, 'loc', 'can_than', [2, 9], 1);
  a(tc.ben.length === 2 && tc.ben[0].tong === boViecChuan(P).viec.length && dsSoTinhCach(P).length === 1 && chiThang(P) > chiTruoc, 'so chỉ số gốc: 2 bên × bộ việc, có lưu, cộng chi tháng', tc.ben.map((b) => b.tong));
  // về bản đầu để thử
  veBan(P, 1, 'thử lại từ đầu', 'anh');
  a(hienHanh(P).ban === 1 && dsBan(P).length >= 3, 'về v1: còn đủ các bản để xem lại');
  fake.close(); console.log('✓ cai-tien: họp → mức 1/2/3/vượt biên, so bộ việc chuẩn → giữ / tự quay lại, ký mức 3, tự triệu tập theo ngưỡng + ngân sách, rút kinh nghiệm khi có vấp (trong ngân sách), về v1'); process.exit(0);
}

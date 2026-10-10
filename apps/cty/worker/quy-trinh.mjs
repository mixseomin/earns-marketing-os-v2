// QUY TRÌNH CỦA PHÒNG LÀ DỮ LIỆU CÓ PHIÊN BẢN — để phòng tự cải tiến trong biên (cong-ty/bien-quy-trinh.json).
// Bản gốc v1 nằm trong repo (cong-ty/quy-trinh/<phòng>/v1.json); bản phòng tự sinh (v2, v3…) + con trỏ "hiện hành" + nhật ký
// thay đổi nằm ở thư mục dữ liệu (${CTY_DATA_DIR}/quy-trinh/<phòng>/) — deploy không xoá, repo không bị phòng ghi.
// Bộ việc chuẩn (cong-ty/bo-viec-chuan/) do Hà giữ: module này KHÔNG có hàm nào ghi vào đó.
// `node worker/quy-trinh.mjs --tu-kiem` = kiểm mức thay đổi, biên, phép đo máy, phiên bản, quay về v1.
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';
import { parseFm } from '../scripts/fm.mjs';

const DIR = path.join(GOC, 'worker');   // không dùng import.meta.url: xem worker/goc.mjs
const CONG_TY = path.join(DIR, '..', 'cong-ty');
const data = () => path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'quy-trinh');
const docJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

/** Mọi quy trình nghiệp vụ: của riêng từng phòng (cong-ty/quy-trinh/<phòng>/danh-sach.json) + quy trình CHUNG mọi phòng đều có
 *  (cong-ty/quy-trinh/_chung/danh-sach.json) → [{ phong, id, khoa: 'phòng/id', nguon: 'phong'|'chung', ten, so_hoa, … }]. */
export function dsQuyTrinh() {
  const goc = path.join(CONG_TY, 'quy-trinh'); if (!fs.existsSync(goc)) return [];
  const doc = (p) => { const f = path.join(goc, p, 'danh-sach.json'); return fs.existsSync(f) ? docJson(f).quy_trinh : []; };
  const chung = doc('_chung');
  const phongs = fs.readdirSync(path.join(CONG_TY, 'phong')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  return phongs.flatMap((p) => [...doc(p).map((q) => ({ ...q, phong: p, khoa: `${p}/${q.id}`, nguon: 'phong' })), ...chung.map((q) => ({ ...q, phong: p, khoa: `${p}/${q.id}`, nguon: 'chung' }))]);
}
/** Quy định phòng phải tuân theo, theo tầng: luật chung công ty → quy định từng dự án phòng tham gia (du_an trong cong-ty/phong/<id>.md)
 *  → quy định riêng của phòng (thân tệp phòng). Phòng KHÔNG sửa được tầng công ty / dự án (không nằm trong biên). */
export function quyDinhCuaPhong(phong) {
  const f = path.join(CONG_TY, 'phong', `${phong}.md`); if (!fs.existsSync(f)) return [];
  const p = parseFm(fs.readFileSync(f, 'utf8'));
  const duAn = Array.isArray(p.fm.du_an) ? p.fm.du_an : [];
  return [
    { tang: 'cong-ty', id: 'cong-ty', ten: 'Luật chung công ty', tep: 'AGENTS.md', noi_dung: fs.readFileSync(path.join(CONG_TY, 'AGENTS.md'), 'utf8') },
    ...duAn.map((d) => { const g = path.join(CONG_TY, 'quy-dinh', 'du-an', `${d}.md`); if (!fs.existsSync(g)) return { tang: 'du-an', id: d, ten: `Dự án ${d}`, tep: null, noi_dung: '' }; const x = parseFm(fs.readFileSync(g, 'utf8')); return { tang: 'du-an', id: d, ten: String(x.fm.ten ?? d), nguon: String(x.fm.nguon ?? ''), tep: `quy-dinh/du-an/${d}.md`, noi_dung: x.body.trim() }; }),
    { tang: 'phong', id: phong, ten: `Riêng ${String(p.fm.ten ?? phong)}`, tep: `phong/${phong}.md`, noi_dung: p.body.trim() },
  ];
}

export const coPhienBan = (k) => fs.existsSync(path.join(CONG_TY, 'quy-trinh', k, 'v1.json'));
export const bien = () => docJson(path.join(CONG_TY, 'bien-quy-trinh.json'));
export const boViecChuan = (qt) => { const f = path.join(CONG_TY, 'bo-viec-chuan', `${qt}.json`); return fs.existsSync(f) ? docJson(f) : null; };

const thuMuc = (qt) => path.join(data(), qt);
/** Mọi phiên bản của phòng, cũ → mới: v1 từ repo + vN từ thư mục dữ liệu. */
export function dsBan(qt) {
  const goc = docJson(path.join(CONG_TY, 'quy-trinh', qt, 'v1.json'));
  const them = fs.existsSync(thuMuc(qt)) ? fs.readdirSync(thuMuc(qt)).filter((f) => /^v\d+\.json$/.test(f) && f !== 'v1.json').map((f) => docJson(path.join(thuMuc(qt), f))) : [];
  return [goc, ...them].sort((a, b) => a.ban - b.ban);
}
const conTro = (qt) => { const f = path.join(thuMuc(qt), 'hien-hanh.json'); return fs.existsSync(f) ? docJson(f) : { ban: 1 }; };
export function hienHanh(qt) { const ds = dsBan(qt); const c = conTro(qt); return ds.find((b) => b.ban === c.ban) ?? ds[0]; }
export function nhatKyQuyTrinh(qt) { const f = path.join(thuMuc(qt), 'nhat-ky.jsonl'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []; }
function ghiNhatKy(qt, e) { fs.mkdirSync(thuMuc(qt), { recursive: true }); fs.appendFileSync(path.join(thuMuc(qt), 'nhat-ky.jsonl'), JSON.stringify({ ts: new Date().toISOString(), ...e }) + '\n'); }
function datConTro(qt, ban, ly_do) { fs.mkdirSync(thuMuc(qt), { recursive: true }); fs.writeFileSync(path.join(thuMuc(qt), 'hien-hanh.json'), JSON.stringify({ ban, tu: new Date().toISOString(), ly_do })); }

// ---- mức thay đổi theo biên ----
const lay = (o, k) => k.split('.').reduce((x, p) => (x == null ? undefined : x[p]), o);
const phang = (o, tien = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? phang(v, `${tien}${k}.`) : [[`${tien}${k}`, v]]));
const META = new Set(['phong', 'quy_trinh', 'qt', 'ban', 'tu', 'ngay', 'ly_do', 'de_xuat']);
/** So hai bản → { muc: 0..3, thay: [{khoa, cu, moi, muc}], vuot: [lý do vượt biên] }. Khoá không có trong biên = mức 3. */
export function mucThayDoi(cu, moi, b = bien()) {
  const khoa = new Set([...phang(cu), ...phang(moi)].map(([k]) => k).filter((k) => !META.has(k.split('.')[0])));
  const thay = []; const vuot = [];
  for (const k of khoa) {
    const a = lay(cu, k), z = lay(moi, k);
    if (JSON.stringify(a) === JSON.stringify(z)) continue;
    const luat = b[k]; const muc = luat?.muc ?? 3;
    if (luat) {
      if (luat.min != null && (typeof z !== 'number' || z < luat.min || z > luat.max)) vuot.push(`${k}=${JSON.stringify(z)} ngoài [${luat.min}, ${luat.max}]`);
      if (luat.cho_phep && !luat.cho_phep.includes(z)) vuot.push(`${k}=${JSON.stringify(z)} không nằm trong ${JSON.stringify(luat.cho_phep)}`);
      if (luat.kieu === 'bool' && typeof z !== 'boolean') vuot.push(`${k} phải là true/false`);
      if (luat.kieu === 'chu' && (typeof z !== 'string' || !z.trim())) vuot.push(`${k} phải là chữ, không rỗng`);
    }
    thay.push({ khoa: k, cu: a, moi: z, muc });
  }
  return { muc: thay.reduce((m, t) => Math.max(m, t.muc), 0), thay, vuot };
}

/** Áp một bản mới (đã duyệt đúng mức) → ghi vN+1, trỏ hiện hành vào nó. Trả bản mới. */
export function apBanMoi(qt, moi, { ly_do, de_xuat, ai_duyet }) {
  const ds = dsBan(qt); const ban = ds.at(-1).ban + 1;
  const ghi = { ...moi, qt, ban, tu: hienHanh(qt).ban, ngay: new Date().toISOString().slice(0, 10), ly_do, de_xuat: de_xuat ?? null };
  fs.mkdirSync(thuMuc(qt), { recursive: true });
  fs.writeFileSync(path.join(thuMuc(qt), `v${ban}.json`), JSON.stringify(ghi, null, 1));
  datConTro(qt, ban, ly_do);
  ghiNhatKy(qt, { loai: 'ap', ban, tu_ban: ghi.tu, ly_do, de_xuat: de_xuat ?? null, ai_duyet });
  return ghi;
}
/** Trỏ hiện hành về một bản đã có (quay lại sau thử thua, hoặc nút "Về bản đầu"). Không xoá bản nào. */
export function veBan(qt, ban, ly_do, ai) {
  if (!dsBan(qt).some((b) => b.ban === ban)) throw new Error(`không có bản v${ban}`);
  const tu = hienHanh(qt).ban; datConTro(qt, ban, ly_do);
  ghiNhatKy(qt, { loai: ban === 1 ? 've-dau' : 'quay-lai', ban, tu_ban: tu, ly_do, ai });
}

// ---- đề xuất cải tiến (do buổi họp sinh ra) — ${DATA}/de-xuat/<phòng>/<id>.json ----
const dxDir = (qt) => path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'de-xuat', qt);
export function dsDeXuat(qt) { const d = dxDir(qt); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort().reverse().map((f) => docJson(path.join(d, f))) : []; }
export function ghiDeXuat(dx) { fs.mkdirSync(dxDir(dx.qt), { recursive: true }); fs.writeFileSync(path.join(dxDir(dx.qt), `${dx.id}.json`), JSON.stringify(dx, null, 1)); return dx; }

// ---- số liệu: máy tự tính từ các lượt (không AI) ----
const GIA = docJson(path.join(DIR, 'gia-model.json'));
const usdBuoc = (b) => { if (!b.usage) return 0; const t = String(b.model).split(':').pop(); const k = Object.keys(GIA).filter((x) => x !== '_' && t.startsWith(x)).sort((x, y) => y.length - x.length)[0]; return k ? ((b.usage.input_tokens || 0) * GIA[k][0] + (b.usage.output_tokens || 0) * GIA[k][1]) / 1e6 : 0; };
export const usdLuot = (l) => (l.buoc || []).reduce((s, b) => s + usdBuoc(b), 0);
export function dsLuotTho() {
  const d = path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'nhat-ky');
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort().reverse().flatMap((f) => { try { return [docJson(path.join(d, f))]; } catch { return []; } }) : [];
}
/** Chỉ số của một tập lượt (đã xong hoặc lỗi). */
export function chiSo(ds) {
  const xong = ds.filter((l) => l.trang_thai !== 'đang chạy');
  const n = xong.length || 1; const tt = (k) => xong.filter((l) => l.ket?.trang_thai_viec === k).length;
  const bac = xong.flatMap((l) => (l.ket?.soat && l.ket.soat.ok === false ? [String(l.ket.soat.ly_do ?? '').slice(0, 90)] : []));
  return {
    so_luot: xong.length,
    ti_le_nop: tt('submitted') / n, ti_le_lam_lai: tt('revision') / n, ti_le_ket: tt('ket') / n, ti_le_loi: xong.filter((l) => l.trang_thai === 'lỗi').length / n,
    ti_le_dat_vong_1: xong.filter((l) => l.ket?.trang_thai_viec === 'submitted' && !l.ket.vong && !(l.buoc || []).some((b) => /làm lại/.test(b.buoc))).length / n,
    so_vong_tb: xong.reduce((s, l) => s + (l.ket?.vong ?? (l.buoc || []).filter((b) => /làm lại/.test(b.buoc)).length), 0) / n,
    chi_phi_tb: xong.reduce((s, l) => s + usdLuot(l), 0) / n,
    ly_do_bac: bac.slice(0, 5),
  };
}
/** Chấm một lượt chạy bộ việc chuẩn theo kỳ vọng CỦA HÀ (không theo người kiểm của phòng). */
export function chamViecChuan(l, viec) {
  const tt = l.ket?.trang_thai_viec;
  if (viec.ky_vong === 'ket') return { dung: tt === 'ket', ly_do: tt === 'ket' ? 'dừng đúng ở kẹt' : `lẽ ra phải kẹt, lại ra "${tt ?? l.trang_thai}"` };
  if (tt !== 'submitted') return { dung: false, ly_do: `lẽ ra nộp được, lại ra "${tt ?? l.trang_thai}"` };
  const kq = (viec.do || []).map((d) => ({ ...d, ...mayDo(d, l.ket?.lam?.ket_qua ?? '') }));
  const truot = kq.filter((x) => !x.dat);
  return { dung: !truot.length, ly_do: truot.length ? `nộp nhưng trượt phép đo của Hà: ${truot.map((x) => x.mo_ta).join('; ')}` : 'nộp + qua phép đo của Hà', kq };
}

// ---- phép đo bằng máy (tất định, không gọi mô hình) ----
const cau = (t) => String(t).trim().split(/(?<=[.!?])\s+(?=\S)/).filter((s) => s.trim());
const tu = (t) => String(t).trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const dong = (t) => String(t).trim().split('\n').map((s) => s.trim()).filter(Boolean);
/** Một phép đo → { dat, so, mo_ta }. Loại lạ = không đạt (đóng mặc định). */
export function mayDo(d, text) {
  const t = String(text ?? '');
  switch (d.loai) {
    case 'so_cau': { const n = cau(t).length; return { dat: d.bang != null ? n === d.bang : n <= d.toi_da, so: n, mo_ta: `${n} câu (cần ${d.bang != null ? `đúng ${d.bang}` : `≤ ${d.toi_da}`})` }; }
    case 'so_tu': { const n = tu(t).length; return { dat: n <= d.toi_da, so: n, mo_ta: `${n} từ (cần ≤ ${d.toi_da})` }; }
    case 'so_ky_tu': { const n = [...t.trim()].length; return { dat: n <= d.toi_da, so: n, mo_ta: `${n} ký tự (cần ≤ ${d.toi_da})` }; }
    case 'so_dong': { const n = dong(t).length; return { dat: n === d.bang, so: n, mo_ta: `${n} dòng (cần đúng ${d.bang})` }; }
    case 'so_tu_moi_dong': { const n = Math.max(0, ...dong(t).map((l) => tu(l).length)); return { dat: n <= d.toi_da, so: n, mo_ta: `dòng dài nhất ${n} từ (cần ≤ ${d.toi_da})` }; }
    case 'khong_chua': { const co = (d.chuoi || []).filter((c) => t.toLowerCase().includes(String(c).toLowerCase())); return { dat: !co.length, so: co.length, mo_ta: co.length ? `có ${co.map((c) => `"${c}"`).join(', ')}` : 'không có chữ cấm' }; }
    case 'ngon_ngu': { const chu = [...t].filter((c) => /\p{L}/u.test(c)); const lat = chu.filter((c) => /[a-zA-Z]/.test(c)).length; const ti = chu.length ? lat / chu.length : 0; return { dat: d.la === 'en' ? ti > 0.97 : ti <= 0.97, so: Math.round(ti * 100), mo_ta: `${Math.round(ti * 100)}% chữ Latin không dấu (${d.la === 'en' ? 'cần > 97%' : 'cần có dấu'})` }; }
    default: return { dat: false, so: 0, mo_ta: `phép đo lạ "${d.loai}"` };
  }
}
export const LOAI_DO = ['so_cau', 'so_tu', 'so_ky_tu', 'so_dong', 'so_tu_moi_dong', 'khong_chua', 'ngon_ngu'];

/** Điền {chỗ_giữ} trong lời nhắc; chỉ thay khoá có trong `v` (ngoặc của JSON mẫu giữ nguyên). */
export const dien = (mau, v) => mau.replace(/\{([a-z_]+)\}/g, (m, k) => (k in v ? String(v[k]) : m));

if (process.argv.includes('--tu-kiem') && (process.argv[1] || '').endsWith('quy-trinh.mjs')) {
  process.env.CTY_DATA_DIR = fs.mkdtempSync('/tmp/cty-qt-');
  const a = (c, m) => { if (!c) { console.error('✗ quy-trinh:', m); process.exit(1); } };
  const v1 = hienHanh('thu-nghiem/lam-viec');
  a(v1.ban === 1 && v1.so_vong_lam_lai === 1, 'hiện hành mặc định = v1 từ repo');
  a(mucThayDoi(v1, { ...v1, so_vong_lam_lai: 2 }).muc === 1, 'đổi số vòng trong biên = mức 1');
  a(mucThayDoi(v1, { ...v1, so_vong_lam_lai: 9 }).vuot.length === 1, 'số vòng ngoài biên = vượt');
  a(mucThayDoi(v1, { ...v1, het_vong: 'ket' }).muc === 2, 'đổi lối thoát = mức 2');
  a(mucThayDoi(v1, { ...v1, het_vong: 'bo_qua' }).vuot.length === 1, 'lối thoát lạ = vượt');
  a(mucThayDoi(v1, { ...v1, loi_nhac: { ...v1.loi_nhac, giao: 'dễ thôi' } }).muc === 3, 'đổi lời giao (chuẩn chất lượng) = mức 3');
  a(mucThayDoi(v1, { ...v1, tran_chi: 99 }).muc === 3, 'khoá không có trong biên = mức 3');
  a(mucThayDoi(v1, { ...v1, ban: 7, ly_do: 'x' }).thay.length === 0, 'trường mô tả không tính là thay đổi');
  const v2 = apBanMoi('thu-nghiem/lam-viec', { ...v1, so_vong_lam_lai: 2 }, { ly_do: 'thử', ai_duyet: 'tam' });
  a(v2.ban === 2 && hienHanh('thu-nghiem/lam-viec').ban === 2 && dsBan('thu-nghiem/lam-viec').length === 2, 'áp → v2 hiện hành');
  veBan('thu-nghiem/lam-viec', 1, 'về bản đầu để thử', 'anh');
  a(hienHanh('thu-nghiem/lam-viec').ban === 1 && dsBan('thu-nghiem/lam-viec').length === 2, 'về v1: con trỏ đổi, v2 vẫn còn');
  a(nhatKyQuyTrinh('thu-nghiem/lam-viec').map((e) => e.loai).join() === 'ap,ve-dau', 'nhật ký ghi áp + về đầu');
  a(mayDo({ loai: 'so_cau', bang: 3 }, 'One. Two! Three?').dat && !mayDo({ loai: 'so_cau', bang: 3 }, 'One. Two.').dat, 'đếm câu');
  a(mayDo({ loai: 'so_tu', toi_da: 6 }, 'Jett Jean Bangladesh: Stylish & Durable Denim').so === 6, 'đếm từ (& không phải từ) — ca Kỳ đếm sai thành 8');
  a(!mayDo({ loai: 'khong_chua', chuoi: ['—'] }, 'a — b').dat, 'bắt gạch dài');
  a(mayDo({ loai: 'ngon_ngu', la: 'en' }, 'Hello world.').dat && !mayDo({ loai: 'ngon_ngu', la: 'en' }, 'Xin chào thế giới').dat, 'ngôn ngữ');
  a(!mayDo({ loai: 'bua' }, 'x').dat, 'phép đo lạ = không đạt');
  a(dien('{"a":"{viec}"} {x}', { viec: 'V' }) === '{"a":"V"} {x}', 'điền chỗ giữ, giữ ngoặc lạ');
  const lKet = { trang_thai: 'xong', ket: { trang_thai_viec: 'ket' } }, lNop = (kq) => ({ trang_thai: 'xong', ket: { trang_thai_viec: 'submitted', lam: { ket_qua: kq } } });
  a(chamViecChuan(lKet, { ky_vong: 'ket' }).dung && !chamViecChuan(lNop('x'), { ky_vong: 'ket' }).dung, 'chấm: việc không thể → phải kẹt, nộp bừa là sai');
  a(chamViecChuan(lNop('A. B. C.'), { ky_vong: 'nop', do: [{ loai: 'so_cau', bang: 3 }] }).dung && !chamViecChuan(lNop('A. B.'), { ky_vong: 'nop', do: [{ loai: 'so_cau', bang: 3 }] }).dung, 'chấm: nộp phải qua phép đo của Hà');
  const cs = chiSo([{ trang_thai: 'xong', ket: { trang_thai_viec: 'submitted', vong: 0 }, buoc: [] }, { trang_thai: 'xong', ket: { trang_thai_viec: 'revision', vong: 1, soat: { ok: false, ly_do: 'không thu hút' } }, buoc: [{ buoc: '4 làm lại', model: 'openai:gpt-4o-mini', usage: { input_tokens: 1e6, output_tokens: 0 } }] }]);
  a(cs.so_luot === 2 && cs.ti_le_nop === 0.5 && cs.ti_le_dat_vong_1 === 0.5 && cs.so_vong_tb === 0.5 && Math.abs(cs.chi_phi_tb - 0.075) < 1e-9 && cs.ly_do_bac[0] === 'không thu hút', 'chỉ số từ lượt');
  const ds = dsQuyTrinh();
  a(ds.some((q) => q.khoa === 'thu-nghiem/lam-viec' && q.nguon === 'phong') && ds.filter((q) => q.id === 'xu-ly-ton').length === fs.readdirSync(path.join(CONG_TY, 'phong')).filter((f) => f.endsWith('.md')).length, 'quy trình riêng + quy trình chung có ở mọi phòng');
  const qd = quyDinhCuaPhong('sach');
  a(qd[0].tang === 'cong-ty' && qd.some((x) => x.tang === 'du-an' && x.id === 'puzzle-books' && /thương hiệu/.test(x.noi_dung)) && qd.at(-1).tang === 'phong', 'quy định theo tầng: công ty → dự án → phòng');
  console.log('✓ quy-trinh: mức/biên/áp/về v1/phép đo máy/chấm việc chuẩn/chỉ số/danh sách/quy định — 23 ca'); process.exit(0);
}

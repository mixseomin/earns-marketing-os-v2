// KINH NGHIỆM — lớp "tự lớn" của nhân sự (decision 2026-10-11 nhân sự sống, bước 2). Tệp này chỉ LƯU · CHỌN · ĐẾM (0 đồng, không gọi
// mô hình) để ca.mjs dùng được mà không vòng import; việc RÚT bài học (gọi mô hình, tính ngân sách phòng) nằm ở cai-tien.mjs.
//   - Bài học gắn với quy trình nơi nó sinh ra (khoá `phong/quy-trinh`) — chỉ nạp lại trong đúng quy trình đó.
//   - Mỗi lần bài học có trong lời dặn = một lần áp dụng; bước của người đó đạt = một lần đạt (máy đếm từ kết quả, không ai khai).
//   - ≥ 3 lần áp dụng và tỉ lệ đạt ≥ 60% → KỸ NĂNG (cấp = số lần đạt). ≥ 4 lần mà tỉ lệ < 25% → PHAI (không nạp nữa, vẫn giữ để xem lại).
//   - Nạp tối đa 5: kỹ năng trước (cấp cao trước), rồi bài học mới (mới trước). Lưu ở <CTY_DATA_DIR>/kinh-nghiem/<người>.json.
import fs from 'node:fs';
import path from 'node:path';
import { json } from './quy-trinh.mjs';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const tep = (id) => path.join(DATA(), 'kinh-nghiem', `${id}.json`);
export const NGUONG = { ky_nang: { ap_dung: 3, ti_le: 0.6 }, phai: { ap_dung: 4, ti_le: 0.25 }, nap_toi_da: 5 };

export function dsBaiHoc(id) { try { return JSON.parse(fs.readFileSync(tep(id), 'utf8')).bai_hoc ?? []; } catch { return []; } }   // chưa có tệp = chưa có kinh nghiệm
function luu(id, ds) { fs.mkdirSync(path.dirname(tep(id)), { recursive: true }); fs.writeFileSync(tep(id), JSON.stringify({ bai_hoc: ds }, null, 1)); }
export const trangThai = (b) => (b.lan_ap_dung >= NGUONG.phai.ap_dung && b.lan_dat / b.lan_ap_dung < NGUONG.phai.ti_le ? 'phai'
  : b.lan_ap_dung >= NGUONG.ky_nang.ap_dung && b.lan_dat / b.lan_ap_dung >= NGUONG.ky_nang.ti_le ? 'ky_nang' : 'moi');

/** Bài học nạp vào lời dặn của một người trong một quy trình. */
export function chonBaiHoc(id, khoa) {
  const ds = dsBaiHoc(id).filter((b) => b.khoa === khoa && trangThai(b) !== 'phai');
  const kn = ds.filter((b) => trangThai(b) === 'ky_nang').sort((a, b) => b.lan_dat - a.lan_dat);
  const moi = ds.filter((b) => trangThai(b) === 'moi').sort((a, b) => b.ts.localeCompare(a.ts));
  return [...kn, ...moi].slice(0, NGUONG.nap_toi_da);
}
export const loiDanKinhNghiem = (ds) => (ds.length ? `\n\nKINH NGHIỆM CỦA BẠN (rút từ việc đã làm — áp dụng khi hợp):\n${ds.map((b) => `- ${trangThai(b) === 'ky_nang' ? '[kỹ năng] ' : ''}${b.noi_dung}`).join('\n')}` : '');

/** Sau một lượt: mỗi bước có nạp bài học → +1 áp dụng; bước đó ĐẠT → +1 đạt. Đạt = làm: người kiểm duyệt ngay vòng đầu; còn lại: lượt nộp được. */
export function ghiApDung(nk) {
  const dung = nk.ket?.trang_thai_viec === 'submitted';
  const soat1 = (nk.buoc || []).find((b) => /soát/.test(b.buoc));
  const theoNguoi = {};
  for (const b of nk.buoc || []) {
    if (!b.bai_hoc?.length || b.loi) continue;
    const dat = /\blàm\b/.test(b.buoc) && !/làm lại/.test(b.buoc) ? json(soat1?.dap)?.ok === true || !!soat1?.bi_gat : dung;
    for (const ma of b.bai_hoc) { const x = (theoNguoi[b.id] ??= {})[ma] ??= { ap: 0, dat: 0 }; x.ap++; if (dat) x.dat++; }
  }
  for (const [id, m] of Object.entries(theoNguoi)) {
    const ds = dsBaiHoc(id);
    for (const b of ds) if (m[b.ma]) { b.lan_ap_dung += m[b.ma].ap; b.lan_dat += m[b.ma].dat; b.luot_cuoi = nk.ts; }
    luu(id, ds);
  }
  return Object.keys(theoNguoi).length;
}

/** Ghi kết quả một lần rút: bài mới thì thêm, trùng ý bài cũ thì cộng nguồn vào bài cũ. Bằng chứng phải là lượt vừa làm (chặn bài học bịa). */
export function ghiBaiHoc(id, khoa, nk, kq) {
  if (!kq || !kq.bai_hoc) return { ghi: null, ly_do: 'không có bài học' };
  const ds = dsBaiHoc(id);
  if (kq.trung_voi) { const b = ds.find((x) => x.ma === kq.trung_voi && x.khoa === khoa); if (b) { (b.nguon ??= []).push(nk.ts); luu(id, ds); return { ghi: 'trung', ma: b.ma }; } }
  const buocCua = (nk.buoc || []).filter((b) => b.id === id).map((b) => b.buoc);
  if (!String(kq.bang_chung ?? '').includes(nk.ts.slice(0, 16)) && !buocCua.some((t) => String(kq.bang_chung ?? '').includes(t))) return { ghi: null, ly_do: 'bằng chứng không trỏ tới lượt/bước vừa làm' };
  const ma = `bh-${id}-${nk.ts}-${ds.length}`;   // một lượt có thể sinh nhiều bài (nhiều người, nhiều lần) — mã phải khác nhau
  ds.push({ ma, ts: new Date().toISOString(), khoa, noi_dung: String(kq.bai_hoc).slice(0, 220), bang_chung: String(kq.bang_chung).slice(0, 160), nguon: [nk.ts], lan_ap_dung: 0, lan_dat: 0 });
  luu(id, ds); return { ghi: 'moi', ma };
}

/** ĐƯỢC DẠY (anh 14/10/2026 "lấy chủ thể là nhân viên đó, họ học được gì mới quan trọng"): điều Giám đốc dạy trực tiếp thành bài học của
 *  CHÍNH người đó (vd Diệp: "examweight.com = site nhà"). Một chủ đề một bài (khoaBai) — dạy lại thì sửa bài cũ, không đẻ bài mới.
 *  Bằng chứng = ai dạy, lúc nào (không phải một lượt chạy). */
export function ghiDuocDay(id, khoa, khoaBai, noi_dung, ai) {
  const ds = dsBaiHoc(id), ma = `day-${id}-${String(khoaBai).replace(/[^\w.-]/g, '-')}`, luc = new Date().toISOString();
  const cu = ds.find((b) => b.ma === ma), bai = { ma, ts: luc, khoa, noi_dung: String(noi_dung).slice(0, 220), bang_chung: `${ai || 'Giám đốc'} dạy`, nguon: [], lan_ap_dung: cu?.lan_ap_dung ?? 0, lan_dat: cu?.lan_dat ?? 0, day: { ai, luc } };
  luu(id, cu ? ds.map((b) => (b.ma === ma ? bai : b)) : [...ds, bai]); return ma;
}

/** Bỏ một bài học (Giám đốc / Hà thấy bịa hoặc lệch chuẩn). */
export function boBaiHoc(id, ma) { const ds = dsBaiHoc(id); const con = ds.filter((b) => b.ma !== ma); if (con.length === ds.length) return false; luu(id, con); return true; }

/** Lớp tự học của CLI (may/tu-hoc.mjs, anh 16/11/2026): CLI chạy trên iMac, sổ ở box3 → hai lệnh qua ssh.
 *  --nap <id> <khoá>  → JSON { chu: lời dặn kinh nghiệm, ma: [mã bài đã nạp] }
 *  --hoc <id> <khoá>  ← stdin { bai: [câu], ma: [mã đã nạp], dat, may } → đếm áp dụng / đạt cho bài đã nạp + ghi bài mới (trùng ý bài cũ = cộng nguồn). */
const chuanY = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export function hocCli(id, khoa, { bai = [], ma = [], dat = false, may = 'cli' } = {}) {
  const ds = dsBaiHoc(id), luc = new Date().toISOString(), ket = { ap_dung: 0, moi: 0, trung: 0 };
  for (const b of ds) if (ma.includes(b.ma)) { b.lan_ap_dung++; if (dat) b.lan_dat++; b.luot_cuoi = luc; ket.ap_dung++; }
  for (const noi of bai) {
    const cu = ds.find((b) => b.khoa === khoa && chuanY(b.noi_dung) === chuanY(noi));
    if (cu) { (cu.nguon ??= []).push(luc); ket.trung++; continue; }
    ds.push({ ma: `bh-${id}-${luc}-${ds.length}`, ts: luc, khoa, noi_dung: String(noi).slice(0, 220), bang_chung: `${may} · lượt ${luc.slice(0, 16)}`, nguon: [luc], lan_ap_dung: 0, lan_dat: 0 }); ket.moi++;
  }
  luu(id, ds); return ket;
}
if ((process.argv[1] || '').endsWith('kinh-nghiem.mjs') && (process.argv[2] === '--nap' || process.argv[2] === '--hoc')) {
  const [, , lenh, id, khoa] = process.argv;
  if (!/^[a-z0-9-]+$/.test(id ?? '') || !khoa) { console.error('dùng: --nap|--hoc <id> <khoá>'); process.exit(2); }
  if (lenh === '--nap') { const ds = chonBaiHoc(id, khoa); console.log(JSON.stringify({ chu: loiDanKinhNghiem(ds), ma: ds.map((b) => b.ma) })); }
  else { const v = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); console.log(JSON.stringify(hocCli(id, khoa, v))); }
}

if (process.argv.includes('--tu-kiem') && (process.argv[1] || '').endsWith('kinh-nghiem.mjs')) {
  process.env.CTY_DATA_DIR = fs.mkdtempSync('/tmp/cty-kn-');
  const a = (c, m, x) => { if (!c) { console.error('✗ kinh-nghiem:', m, JSON.stringify(x ?? {}).slice(0, 300)); process.exit(1); } };
  const K = 'thu-nghiem/lam-viec';
  const nk = (o) => ({ ts: '2026-10-11T05-00-00-000Z', buoc: [{ buoc: '2 làm', id: 'loc', bai_hoc: o.bh ?? [] }, { buoc: '3 soát', id: 'ky', dap: `{"ok":${o.ok}}`, bai_hoc: [] }], ket: { trang_thai_viec: o.ok ? 'submitted' : 'revision' }, ...o.them });
  a(ghiBaiHoc('loc', K, nk({}), { bai_hoc: 'Đếm câu', bang_chung: 'lượt X' }).ghi === null, 'bằng chứng không trỏ lượt vừa làm → không ghi');
  const r = ghiBaiHoc('loc', K, nk({}), { bai_hoc: 'Đếm lại số câu trước khi nộp', bang_chung: 'lượt 2026-10-11T05-00 bước 2 làm' });
  a(r.ghi === 'moi' && chonBaiHoc('loc', K).length === 1 && chonBaiHoc('loc', 'khac/qt').length === 0, 'ghi bài mới; chỉ nạp trong đúng quy trình', r);
  a(ghiBaiHoc('loc', K, nk({}), { bai_hoc: 'đếm câu', trung_voi: r.ma }).ghi === 'trung' && dsBaiHoc('loc').length === 1, 'trùng ý → cộng vào bài cũ');
  for (let i = 0; i < 3; i++) ghiApDung(nk({ ok: true, bh: [r.ma] }));
  a(trangThai(dsBaiHoc('loc')[0]) === 'ky_nang' && dsBaiHoc('loc')[0].lan_dat === 3, '3 lần áp dụng, đạt cả 3 → kỹ năng', dsBaiHoc('loc')[0]);
  const r2 = ghiBaiHoc('loc', K, nk({}), { bai_hoc: 'Viết dài hơn cho chắc', bang_chung: '2 làm' });
  for (let i = 0; i < 4; i++) ghiApDung(nk({ ok: false, bh: [r2.ma] }));
  a(trangThai(dsBaiHoc('loc').find((b) => b.ma === r2.ma)) === 'phai' && !chonBaiHoc('loc', K).some((b) => b.ma === r2.ma), '4 lần áp dụng, không đạt lần nào → phai, không nạp nữa');
  a(/\[kỹ năng\] Đếm lại số câu/.test(loiDanKinhNghiem(chonBaiHoc('loc', K))) && loiDanKinhNghiem([]) === '', 'lời dặn: kỹ năng có nhãn, rỗng thì không thêm gì');
  a(boBaiHoc('loc', r2.ma) && dsBaiHoc('loc').length === 1, 'bỏ bài học');
  const truoc = dsBaiHoc('loc')[0].lan_dat; const gat = nk({ ok: false, bh: [r.ma] }); gat.buoc[1].bi_gat = 'phuc_khao';
  ghiApDung(gat); a(dsBaiHoc('loc')[0].lan_dat === truoc + 1, 'lời bác bị gạt → bài học của người làm vẫn tính đạt');
  { const C = 'cli/lam-viec', k1 = hocCli('huy', C, { bai: ['Card etp phải submit với GOPY_PROJECT=mos2, không phải etp2'], ma: [] });
    a(k1.moi === 1 && chonBaiHoc('huy', C).length === 1, 'CLI ghi bài mới', k1);
    a(hocCli('huy', C, { bai: ['card ETP phải submit với GOPY_PROJECT=mos2 — không phải etp2'] }).trung === 1 && dsBaiHoc('huy').length === 1, 'trùng ý (khác hoa thường, dấu câu) → cộng nguồn');
    const m = chonBaiHoc('huy', C).map((b) => b.ma); for (let i = 0; i < 3; i++) hocCli('huy', C, { ma: m, dat: true });
    a(trangThai(dsBaiHoc('huy')[0]) === 'ky_nang', 'CLI nạp bài 3 lượt đạt → kỹ năng', dsBaiHoc('huy')[0]); }
  console.log('✓ kinh-nghiem: bằng chứng phải trỏ lượt vừa làm, gộp trùng, nạp đúng quy trình, lên kỹ năng / phai theo kết quả, bỏ bài');
}

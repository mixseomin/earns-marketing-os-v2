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
    const dat = /\blàm\b/.test(b.buoc) && !/làm lại/.test(b.buoc) ? json(soat1?.dap)?.ok === true : dung;
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

/** Bỏ một bài học (Giám đốc / Hà thấy bịa hoặc lệch chuẩn). */
export function boBaiHoc(id, ma) { const ds = dsBaiHoc(id); const con = ds.filter((b) => b.ma !== ma); if (con.length === ds.length) return false; luu(id, con); return true; }

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
  console.log('✓ kinh-nghiem: bằng chứng phải trỏ lượt vừa làm, gộp trùng, nạp đúng quy trình, lên kỹ năng / phai theo kết quả, bỏ bài');
}

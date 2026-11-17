// TRẠNG THÁI THẬT của từng nhân sự (anh 17/11/2026: "tao cần xem realtime trạng thái của từng thằng. nó vừa làm gì, đã qua bao lâu... bắt đầu
// việc gì... có thể đang kẹt ko ???"). Đọc nhật ký nhịp <DATA>/nhip/<người>.jsonl (bộ điều phối Mac đẩy "▶ bắt đầu" / "■ xong sau X" /
// "✗ lỗi mã N sau X"; nhịp box3 ghi một dòng mỗi lần chạy xong) → đang làm gì từ lúc nào · rảnh từ lúc nào · có kẹt không · từng lần chạy.
// Phần thuần (trangThai, cacLan) không đọc tệp — tự kiểm: node worker/trang-thai.mjs --tu-kiem
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';
import { NHIP_MAY } from './nhip-may.mjs';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
/** N dòng nhật ký nhịp MỚI NHẤT của một người (mới trước) — đọc đuôi tệp, không nạp cả tệp (kien / ngoc ~4 MB, bảng đọc ~40 người mỗi lần làm mới). */
export function nhatKyCuoi(id, byte = 64 * 1024) {
  const f = path.join(DATA(), 'nhip', `${id}.jsonl`);
  let chu = '';
  try { const fd = fs.openSync(f, 'r'); const n = fs.fstatSync(fd).size, b = Buffer.alloc(Math.min(byte, n)); fs.readSync(fd, b, 0, b.length, n - b.length); fs.closeSync(fd); chu = b.toString('utf8'); } catch { return []; }
  const ds = chu.split('\n'); if (chu.length >= byte) ds.shift();   // dòng đầu có thể bị cắt giữa chừng
  return ds.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((e) => e && e.luc).reverse();
}

// TRẦN PHÚT mỗi việc Mac: đọc `tranPhut: N` ngay trong script của việc (may/*-gop-y.mjs: kỹ sư hòm 40, Thắng 120) — không chép số sang đây
// cho khỏi lệch. Script không nằm trong repo (Thành ~/bin/thanh) hoặc không khai → mặc định 60 phút.
export const TRAN_MAC_DINH = 60;
const tranCache = {};
export function tranPhut(viec) {
  if (viec in tranCache) return tranCache[viec];
  const s = NHIP_MAY[viec]?.script ?? ''; let n = TRAN_MAC_DINH;
  if (s.startsWith('apps/cty/')) try { const m = fs.readFileSync(path.join(GOC, s.slice('apps/cty/'.length)), 'utf8').match(/tranPhut:\s*(\d+)/); if (m) n = Number(m[1]); } catch { /* script mất → mặc định */ }
  return (tranCache[viec] = n);
}
/** Việc lịch dày (bộ điều phối gọi mỗi ≤ 5 phút): chữ lịch "mỗi N phút" → N; không phải lịch phút → null. */
export const phutLich = (lich) => { const m = String(lich ?? '').match(/mỗi (\d+) phút/); return m ? Number(m[1]) : null; };
export const IM_QUA_PHUT = 30, LOI_LIEN_TIEP = 3, LICH_DAY_PHUT = 5;

const loaiDong = (ket) => (/^▶/.test(ket) ? 'mo' : /^■/.test(ket) ? 'xong' : /^✗/.test(ket) ? 'loi' : 'lan');   // 'lan' = nhịp box: một dòng = một lần chạy xong
const sau = (ket) => ket.match(/sau (\d+ (?:giây|phút))/)?.[1] ?? '';
const tomTat = (ket) => ket.replace(/^(▶ bắt đầu: |■ xong sau \d+ (?:giây|phút)( · )?|✗ lỗi mã \d+ sau \d+ (?:giây|phút)( · )?)/, '');
const phut = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));

/** TỪNG LẦN CHẠY (mới trước) từ nhật ký (mới trước): ▶ ghép với ■ / ✗ kế tiếp của cùng việc thành một lần; ▶ chưa có kết = đang chạy.
 *  → [{ viec, tu?, xong?, ma: 0 | N | null, dai, tom, dang }] */
export function cacLan(nk, bay = Date.now()) {
  const mo = {}, ra = [];
  for (const e of [...nk].reverse()) {
    const ket = String(e.ket ?? ''), l = loaiDong(ket), v = String(e.viec ?? '');
    if (l === 'mo') { if (mo[v]) ra.push({ viec: v, tu: mo[v].luc, ma: null, dai: '', tom: 'không thấy dòng xong (bộ điều phối khởi động lại?)', dang: false, mat: true }); mo[v] = e; continue; }
    if (l === 'lan') { ra.push({ viec: v, xong: e.luc, ma: 0, dai: '', tom: ket, dang: false }); continue; }
    const m = mo[v]; delete mo[v];
    ra.push({ viec: v, tu: m?.luc, xong: e.luc, ma: l === 'xong' ? 0 : Number(ket.match(/mã (\d+)/)?.[1] ?? 1), dai: sau(ket), tom: tomTat(ket), dang: false, tenViec: m ? tomTat(String(m.ket)) : undefined });
  }
  for (const [v, e] of Object.entries(mo)) ra.push({ viec: v, tu: e.luc, ma: null, dai: `${phut(e.luc, new Date(bay).toISOString())} phút`, tom: tomTat(String(e.ket)), dang: true, tenViec: tomTat(String(e.ket)) });
  return ra.sort((a, b) => (b.xong ?? b.tu ?? '').localeCompare(a.xong ?? a.tu ?? ''));
}

/** Trạng thái một người từ nhật ký nhịp (mới trước).
 *  op: { bat (nhịp đang bật), tran(viec) → phút, lichDay: { viec: phút lịch } (chỉ việc Mac lịch ≤ 5 phút), cuoiKhac?: { luc, ket } (nhật ký sự kiện / việc máy) }
 *  → { kieu: 'lam' | 'ranh' | 'tat' | 'chua', viec?, tu?, phut?, xong?, vua?, ket: [lý do kẹt] } */
export function trangThai(nk, op = {}, bay = Date.now()) {
  const now = new Date(bay).toISOString(); const lan = cacLan(nk, bay); const ket = [];
  const dang = lan.filter((x) => x.dang);
  for (const x of dang) { const p = phut(x.tu, now), t = (op.tran ?? (() => TRAN_MAC_DINH))(x.viec); if (p > t) ket.push(`chạy ${p} phút, quá trần ${t} phút`); }
  const daXong = lan.filter((x) => !x.dang && !x.mat);
  let loi = 0; for (const x of daXong) { if (x.ma) loi++; else break; }
  if (loi >= LOI_LIEN_TIEP) ket.push(`${loi} lần lỗi liên tiếp`);
  if (op.bat !== false) for (const [v, p] of Object.entries(op.lichDay ?? {})) {
    if (p > LICH_DAY_PHUT || dang.some((x) => x.viec === v)) continue;
    // chưa có dòng nào của việc này = chưa biết (vd lượt mở TRƯỚC khi bộ điều phối biết đẩy sự kiện, 17/11 Thắng 14:26 chạy dài) — không gán kẹt
    const cuoi = nk.find((e) => e.viec === v); const im = cuoi ? phut(cuoi.luc, now) : null;
    if (im !== null && im > IM_QUA_PHUT) ket.push(`lịch mỗi ${p} phút mà im ${im} phút`);
  }
  const moi = nk[0]; const vua = moi ? { luc: moi.luc, ket: String(moi.ket ?? '') } : op.cuoiKhac ?? null;
  if (dang.length) { const x = dang.sort((a, b) => a.tu.localeCompare(b.tu))[0]; return { kieu: 'lam', viec: x.tenViec || x.viec, tu: x.tu, phut: phut(x.tu, now), them: dang.length - 1, vua, ket }; }
  const xongCuoi = daXong[0]?.xong; const khac = op.cuoiKhac?.luc;
  const xong = xongCuoi && (!khac || xongCuoi >= khac) ? xongCuoi : khac;
  if (op.bat === false) return { kieu: 'tat', xong, vua, ket: [] };
  return { kieu: xong ? 'ranh' : 'chua', xong, vua, ket };
}

if (process.argv[1]?.endsWith('trang-thai.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: a } = await import('node:assert');
  const t = (p) => new Date(Date.UTC(2026, 10, 17, 7, 0) + p * 60000).toISOString(), bay = Date.parse(t(0));
  const nk = (ds) => ds.map(([p, viec, ket]) => ({ luc: t(p), viec, ket })).reverse();   // nhập cũ trước → nhật ký mới trước
  const dangLam = trangThai(nk([[-12, 'xu-gop-y-cty', '▶ bắt đầu: cty - Khôi xử hòm góp ý (Claude)']]), { tran: () => 40 }, bay);
  a.ok(dangLam.kieu === 'lam' && dangLam.phut === 12 && dangLam.viec === 'cty - Khôi xử hòm góp ý (Claude)' && !dangLam.ket.length, 'đang chạy 12 phút, chưa quá trần');
  a.deepEqual(trangThai(nk([[-45, 'x', '▶ bắt đầu: X']]), { tran: () => 40 }, bay).ket, ['chạy 45 phút, quá trần 40 phút'], 'quá trần → kẹt');
  const r = trangThai(nk([[-10, 'x', '▶ bắt đầu: X'], [-8, 'x', '■ xong sau 2 phút · 0 task']]), {}, bay);
  a.ok(r.kieu === 'ranh' && r.xong === t(-8) && r.vua.ket.startsWith('■'), 'có dòng xong → rảnh, xong lúc đó');
  const l3 = nk([[-9, 'x', '✗ lỗi mã 1 sau 3 giây'], [-6, 'x', '✗ lỗi mã 1 sau 3 giây'], [-3, 'x', '✗ lỗi mã 2 sau 3 giây']]);
  a.deepEqual(trangThai(l3, {}, bay).ket, ['3 lần lỗi liên tiếp']);
  a.deepEqual(trangThai(nk([[-9, 'x', '✗ lỗi mã 1 sau 3 giây'], [-6, 'x', '✗ lỗi mã 1 sau 3 giây'], [-3, 'x', '■ xong sau 3 giây']]), {}, bay).ket, [], 'lần cuối xong → hết kẹt');
  a.deepEqual(trangThai(nk([[-40, 'x', '■ xong sau 3 giây']]), { lichDay: { x: 5 } }, bay).ket, ['lịch mỗi 5 phút mà im 40 phút'], 'lịch dày mà im');
  a.deepEqual(trangThai(nk([[-40, 'x', '■ xong sau 3 giây']]), { lichDay: { x: 30 } }, bay).ket, [], 'lịch 30 phút không xét im');
  a.deepEqual(trangThai([], { lichDay: { x: 5 } }, bay).ket, [], 'chưa có dòng nào → chưa biết, không kẹt');
  a.equal(trangThai(nk([[-3, 'kiem-thu', '43 thư đã đọc']]), {}, bay).kieu, 'ranh', 'nhịp box: một dòng = một lần xong');
  a.equal(trangThai([], { cuoiKhac: { luc: t(-60), ket: 'việc máy chạy' } }, bay).kieu, 'ranh', 'không có nhịp mà có việc máy → không "chưa làm"');
  a.equal(trangThai([], { bat: false }, bay).kieu, 'tat');
  const lan = cacLan(nk([[-20, 'x', '▶ bắt đầu: X'], [-15, 'x', '✗ lỗi mã 3 sau 5 phút · hỏng'], [-2, 'x', '▶ bắt đầu: X']]), bay);
  a.ok(lan.length === 2 && lan[0].dang && lan[1].ma === 3 && lan[1].tu === t(-20) && lan[1].tom === 'hỏng' && lan[1].dai === '5 phút', 'ghép ▶ với kết của nó');
  a.equal(phutLich('mỗi 5 phút · iMac'), 5); a.equal(phutLich('03:30 hằng ngày'), null);
  console.log('✓ trang-thai: đang làm / rảnh / tắt / kẹt (quá trần · 3 lỗi liên tiếp · lịch dày im > 30 phút) + ghép từng lần chạy'); process.exit(0);
}

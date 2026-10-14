// NHỊP — nhân sự đã bật tự làm việc, không đợi ai nhắc (anh 13/10/2026: "bản chất hệ thống là phải tự làm việc chứ không phải nhắc mới làm").
// Hồ sơ nhân sự khai `heartbeat: <việc>[, <việc>…]` — mỗi việc là một nhịp MÁY trong NHIP dưới đây (máy làm; mô hình chỉ gọi khi có việc thật, vd viết lời báo). systemd cty-nhip.timer chạy
// tệp này mỗi phút trên box3; mỗi người một lượt, lỗi của người này không chặn người kia. tu-kiem chỉ cho bật heartbeat là việc có trong NHIP
// (nhịp gọi mô hình vẫn khoá tới khi anh bật riêng).
//   node worker/nhip.mjs            chạy một nhịp cho mọi người đã bật
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';
import { parseFm } from '../scripts/fm.mjs';

/** Timer chạy mỗi phút (apps/cty/deploy/cty-nhip.timer); mỗi người kiểm `kiem_moi` phút một lần (mặc định 1) — admin chỉnh trên bảng nhân sự. */
export const KIEM_MOI = [1, 5, 15, 30, 60];
export const tanSuat = (phut) => (Number(phut) > 1 ? `${phut} phút/lần` : '1 lần/phút');
export const TAN_SUAT = tanSuat(1);
// CHỈNH CỦA ADMIN (anh 14/10/2026 "cho phép điều chỉnh bởi admin"): ca · điểm danh · kiểm mấy phút một lần, lưu ở <DATA>/nhip-chinh.json, ĐÈ lên
// hồ sơ trong git (như sổ bổ nhiệm) — chỉnh trên bảng nhân sự có hiệu lực ở nhịp kế tiếp, không cần deploy.
const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const tepChinh = () => path.join(DATA(), 'nhip-chinh.json');
export const docChinh = () => { try { return JSON.parse(fs.readFileSync(tepChinh(), 'utf8')); } catch { return {}; } };
const GIO = /^([01]\d|2[0-4]):[0-5]\d$/;
/** Lưu chỉnh của một người: { ca: 'HH:MM-HH:MM', diem_danh: 'HH:MM' | '', kiem_moi: số trong KIEM_MOI }. Sai định dạng → ném lỗi (không lưu bừa). */
export function luuChinh(id, x, ai = '') {
  const ca = String(x.ca ?? ''), [tu, den] = ca.split('-');
  if (!GIO.test(tu ?? '') || !GIO.test(den ?? '') || tu === den) throw new Error(`Ca "${ca}" sai — dạng 06:00-02:00`);
  if (x.diem_danh && !GIO.test(String(x.diem_danh))) throw new Error(`Giờ điểm danh "${x.diem_danh}" sai — dạng 08:00`);
  if (!KIEM_MOI.includes(Number(x.kiem_moi))) throw new Error(`Kiểm mỗi ${x.kiem_moi} phút — chỉ ${KIEM_MOI.join(' / ')}`);
  const s = docChinh(); s[id] = { ca, diem_danh: String(x.diem_danh ?? ''), kiem_moi: Number(x.kiem_moi), ai, luc: new Date().toISOString() };
  fs.mkdirSync(DATA(), { recursive: true }); const tam = `${tepChinh()}.tam`; fs.writeFileSync(tam, JSON.stringify(s, null, 1)); fs.renameSync(tam, tepChinh()); return s[id];
}
// LẦN LÀM GẦN NHẤT của mỗi người (mỗi nhịp chạy = một lần làm: kiểm hòm, gửi tin…) — "Làm lần cuối" trên bảng đọc đây (anh 14/10/2026: Kiên làm
// từ 6h mà bảng ghi 9 giờ trước vì chỉ đếm lần gọi mô hình).
const tepLam = (id) => path.join(DATA(), 'nhip', `${id}.json`);
export const lanLam = (id) => { try { return JSON.parse(fs.readFileSync(tepLam(id), 'utf8')); } catch { return null; } };
const ghiLam = (id, ket) => { fs.mkdirSync(path.dirname(tepLam(id)), { recursive: true }); fs.writeFileSync(tepLam(id), JSON.stringify({ luc: new Date().toISOString(), ket })); };
/** Tên việc nhịp bằng chữ người đọc (bảng nhân sự hiện cái này, không hiện mã). */
export const TEN_NHIP = { 'mail-bao-mat': 'Báo khi có thư bảo mật mới (gọi mô hình chỉ lúc có thư)' };
export const NHIP = {
  'mail-bao-mat': async (n) => (await import('./mail-bao-mat.mjs')).nhipBaoMat(n.id, { ten: n.ten, model: n.model, phong: n.phong, ca: n.ca, diemDanh: n.diemDanh }),   // Phòng Bảo mật: thư bảo mật → Telegram + pixel
};
export { trongCa } from './gio-lam.mjs';
import { trongCa } from './gio-lam.mjs';
/** Ai đang bật nhịp: [{ id, ten, viec[] }] — heartbeat khác 'off', tách dấu phẩy. */
export function dangBat() {
  const dir = path.join(GOC, 'cong-ty', 'nhan-su');
  return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'SOUL.md'))).map((d) => ({ id: d, fm: parseFm(fs.readFileSync(path.join(dir, d, 'SOUL.md'), 'utf8')).fm }))
    .filter((x) => x.fm.heartbeat && x.fm.heartbeat !== 'off').map((x) => { const c = docChinh()[x.id] ?? {}; return { id: x.id, ten: String(x.fm.ten ?? x.id), model: String(x.fm.model ?? ''), phong: String(x.fm.phong ?? ''),
      ca: c.ca || x.fm.ca, diemDanh: c.diem_danh !== undefined ? c.diem_danh : x.fm.diem_danh, kiemMoi: Number(c.kiem_moi || x.fm.kiem_moi || 1), viec: String(x.fm.heartbeat).split(',').map((v) => v.trim()).filter(Boolean) }; });
}

if (process.argv[1]?.endsWith('nhip.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: a } = await import('node:assert'); const g = (h, p = 0) => new Date(Date.UTC(2026, 9, 13, (h + 17) % 24, p));   // giờ VN h:p
  a.ok(trongCa('08:00-24:00', g(8)) && trongCa('08:00-24:00', g(23, 59)) && !trongCa('08:00-24:00', g(0)) && !trongCa('08:00-24:00', g(7, 59)));
  a.ok(trongCa('22:00-06:00', g(23)) && trongCa('22:00-06:00', g(5)) && !trongCa('22:00-06:00', g(12)) && trongCa(undefined, g(3)));
  const dir = fs.mkdtempSync('/tmp/nhip-'); process.env.CTY_DATA_DIR = dir;
  a.throws(() => luuChinh('x', { ca: '25:00-02:00', kiem_moi: 1 })); a.throws(() => luuChinh('x', { ca: '06:00-02:00', kiem_moi: 7 })); a.throws(() => luuChinh('x', { ca: '06:00-02:00', diem_danh: '8h', kiem_moi: 1 }));
  a.equal(luuChinh('kien', { ca: '07:00-01:00', diem_danh: '08:30', kiem_moi: 5 }, 't').kiem_moi, 5);
  const k = dangBat().find((n) => n.id === 'kien'); a.ok(k.ca === '07:00-01:00' && k.diemDanh === '08:30' && k.kiemMoi === 5, 'chỉnh của admin đè hồ sơ');
  fs.rmSync(dir, { recursive: true });
  console.log('✓ nhip: ca làm theo giờ VN + chỉnh của admin (ca · điểm danh · kiểm mấy phút) đè hồ sơ, sai định dạng bị chặn'); process.exit(0);
}
if (process.argv[1]?.endsWith('nhip.mjs')) {
  for (const n of dangBat()) for (const v of n.viec) {
    if (NHIP[v] && !trongCa(n.ca)) { console.log(`${n.id} · ${v}: ngoài ca ${n.ca} — để tới đầu ca`); continue; }
    if (!NHIP[v]) continue;   // heartbeat không phải nhịp máy (vd Phòng thử "khi bấm nút") → không thuộc bộ chạy này
    const truoc = lanLam(n.id); if (truoc && Date.now() - Date.parse(truoc.luc) < n.kiemMoi * 60_000 - 15_000) continue;   // chưa tới lượt kiểm của người này
    try { const ket = await NHIP[v](n); ghiLam(n.id, ket); console.log(`${n.id} · ${v}: ${ket}`); } catch (e) { console.error(`✗ ${n.id} · ${v}: ${e.message}`); process.exitCode = 1; }
  }
}

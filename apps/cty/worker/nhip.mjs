// NHỊP — nhân sự đã bật tự làm việc, không đợi ai nhắc (anh 13/10/2026: "bản chất hệ thống là phải tự làm việc chứ không phải nhắc mới làm").
// Hồ sơ nhân sự khai `heartbeat: <việc>[, <việc>…]` — mỗi việc là một nhịp MÁY trong NHIP dưới đây (máy làm; mô hình chỉ gọi khi có việc thật, vd viết lời báo). systemd cty-nhip.timer chạy
// tệp này mỗi phút trên box3; mỗi người một lượt, lỗi của người này không chặn người kia. tu-kiem chỉ cho bật heartbeat là việc có trong NHIP
// (nhịp gọi mô hình vẫn khoá tới khi anh bật riêng).
//   node worker/nhip.mjs            chạy một nhịp cho mọi người đã bật
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';
import { parseFm } from '../scripts/fm.mjs';
import { chuLich } from './lich-chu.mjs';

/** Timer chạy mỗi phút (apps/cty/deploy/cty-nhip.timer); mỗi người kiểm `kiem_moi` phút một lần (mặc định 1) — admin chỉnh trên bảng nhân sự. */
export const KIEM_MOI = [1, 5, 15, 30, 60];   // gợi ý nhanh trên ô chỉnh; nhập số khác cũng được (1 phút – 24 giờ)
const hopLeMoi = (p) => Number.isInteger(Number(p)) && Number(p) >= 1 && Number(p) <= 1440;
export const tanSuat = (phut) => chuLich({ kieu: 'moi', phut: Number(phut) || 1 });   // chữ lịch chỉ một luật: lich-chu.mjs
export const TAN_SUAT = tanSuat(1);
// CHỈNH CỦA ADMIN (anh 14/10/2026 "cho phép điều chỉnh bởi admin"): ca · điểm danh · kiểm mấy phút một lần, lưu ở <DATA>/nhip-chinh.json, ĐÈ lên
// hồ sơ trong git (như sổ bổ nhiệm) — chỉnh trên bảng nhân sự có hiệu lực ở nhịp kế tiếp, không cần deploy.
const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const tepChinh = () => path.join(DATA(), 'nhip-chinh.json');
export const docChinh = () => { try { return JSON.parse(fs.readFileSync(tepChinh(), 'utf8')); } catch { return {}; } };
const GIO = /^([01]\d|2[0-4]):[0-5]\d$/;
/** Lưu chỉnh của một người: { ca: 'HH:MM-HH:MM', diem_danh: 'HH:MM' | '', kiem_moi?: phút (bỏ trống = giữ nguyên) }. Sai định dạng → ném lỗi (không lưu bừa). */
export function luuChinh(id, x, ai = '') {
  const ca = String(x.ca ?? ''), [tu, den] = ca.split('-');
  if (!GIO.test(tu ?? '') || !GIO.test(den ?? '') || tu === den) throw new Error(`Ca "${ca}" sai — dạng 06:00-02:00`);
  if (x.diem_danh && !GIO.test(String(x.diem_danh))) throw new Error(`Giờ điểm danh "${x.diem_danh}" sai — dạng 08:00`);
  if (x.kiem_moi !== undefined && !hopLeMoi(x.kiem_moi)) throw new Error(`Kiểm mỗi ${x.kiem_moi} phút — từ 1 phút tới 24 giờ`);
  const s = docChinh(); s[id] = { ...(s[id] ?? {}), ca, diem_danh: String(x.diem_danh ?? ''), ...(x.kiem_moi !== undefined ? { kiem_moi: Number(x.kiem_moi) } : {}), ai, luc: new Date().toISOString() };
  return ghiChinh(s, id);
}
function ghiChinh(s, id) { fs.mkdirSync(DATA(), { recursive: true }); const tam = `${tepChinh()}.tam`; fs.writeFileSync(tam, JSON.stringify(s, null, 1)); fs.renameSync(tam, tepChinh()); return s[id]; }
/** BẬT/TẮT "Tự làm" của một người (anh 14/10/2026 "tao cần bật tắt cái này"): cờ `bat` trong <DATA>/nhip-chinh.json, đè hồ sơ git. Tắt = nhịp
 *  box bỏ qua người đó, và việc chạy trên máy Mac (NHIP_MAY) tự hỏi cờ này trước mỗi lượt — tắt là không chạy. Có hiệu lực ngay, không deploy. */
export function datBat(id, bat, ai = '') { const s = docChinh(); s[id] = { ...(s[id] ?? {}), bat: !!bat, ai, luc: new Date().toISOString() }; return ghiChinh(s, id); }
export const dangTat = (id) => docChinh()[id]?.bat === false;
/** GIỜ CHẠY của việc chạy một lần mỗi ngày trên máy Mac (anh 14/10/2026 "cần cho điều chỉnh" — Bảo 03:30): cờ `gio` trong nhip-chinh.json. Script
 *  trên Mac (LaunchAgent mỗi 10 phút) hỏi giờ này, quá giờ mà hôm nay chưa chạy thì chạy. */
export const GIO_MAC_DINH = '03:30';
/** Đổi riêng "kiểm mấy phút một lần" (ô chỉnh lịch dùng chung — components/chinh-lich.tsx), giữ nguyên ca / điểm danh. */
export function datKiemMoi(id, phut, ai = '') {
  if (!hopLeMoi(phut)) throw new Error(`Kiểm mỗi ${phut} phút — từ 1 phút tới 24 giờ`);
  const s = docChinh(); s[id] = { ...(s[id] ?? {}), kiem_moi: Number(phut), ai, luc: new Date().toISOString() }; return ghiChinh(s, id);
}
export function datGio(id, gio, ai = '') {
  if (!GIO.test(String(gio)) || gio === '24:00') throw new Error(`Giờ "${gio}" sai — dạng 03:30`);
  const s = docChinh(); s[id] = { ...(s[id] ?? {}), gio: String(gio), ai, luc: new Date().toISOString() }; return ghiChinh(s, id);
}
// LẦN LÀM GẦN NHẤT của mỗi người (mỗi nhịp chạy = một lần làm: kiểm hòm, gửi tin…) — "Làm lần cuối" trên bảng đọc đây (anh 14/10/2026: Kiên làm
// từ 6h mà bảng ghi 9 giờ trước vì chỉ đếm lần gọi mô hình).
const tepLam = (id) => path.join(DATA(), 'nhip', `${id}.json`);
export const lanLam = (id) => { try { return JSON.parse(fs.readFileSync(tepLam(id), 'utf8')); } catch { return null; } };
// NHẬT KÝ từng lần chạy (anh 14/10/2026: "chia thành các đầu việc, bấm vào từng việc xem log thực hiện") — một dòng JSON mỗi nhịp ở nhip/<id>.jsonl.
const tepNk = (id) => path.join(DATA(), 'nhip', `${id}.jsonl`);
const GIU_DONG = 20_000;   // ponytail: ~2 tuần nhịp mỗi phút; quá 1,5 lần thì cắt còn GIU_DONG dòng mới nhất
const ghiLam = (id, ket, viec) => {
  const dong = { luc: new Date().toISOString(), viec, ket }; fs.mkdirSync(path.dirname(tepLam(id)), { recursive: true });
  fs.writeFileSync(tepLam(id), JSON.stringify(dong)); fs.appendFileSync(tepNk(id), `${JSON.stringify(dong)}\n`);
  const ds = fs.readFileSync(tepNk(id), 'utf8').split('\n').filter(Boolean); if (ds.length > GIU_DONG * 1.5) fs.writeFileSync(tepNk(id), `${ds.slice(-GIU_DONG).join('\n')}\n`);
};
/** Các lần chạy của một người, mới trước: [{ luc, viec, ket }]. Dòng hỏng bỏ qua. */
export function nhatKyNhip(id) {
  let ds = []; try { ds = fs.readFileSync(tepNk(id), 'utf8').split('\n'); } catch { return []; }
  return ds.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();
}
/** ĐẦU VIỆC của mỗi nhịp — bảng nhân sự hiện thành danh sách, bấm một việc mở ngăn `nhip:<người>/<mã>` (mô tả + nhật ký).
 *  khop: dòng nhật ký nào thuộc việc này (null = mọi lần chạy); can_diem_danh: chỉ có khi người đó khai giờ điểm danh. */
export const VIEC_NHIP = {
  'don-nhat-ky': [
    { ma: 'don', ten: 'Dọn nhật ký chat cũ', lich: (n) => `${n.gio || GIO_MAC_DINH} hằng ngày · MacBook`, gio: (n) => n.gio || GIO_MAC_DINH, khop: null,
      mo_ta: 'Mỗi ngày một lần, đúng giờ admin đặt ở cột Tự làm (mặc định 03:30), trên MacBook (LaunchAgent com.htuan.don-nhat-ky hỏi mỗi 10 phút → ~/bin/don-nhat-ky; Mac ngủ thì chạy lúc thức): xoá nhật ký chat Claude cũ hơn 14 ngày, cũ nhất trước; tổng còn quá 8 GB thì xoá tiếp từ cũ đến mới nhưng không đụng tệp có ghi trong 48 giờ (phiên đang chạy). Mỗi lượt ghi một dòng sổ sự kiện. Tắt ở cột Tự làm thì lượt kế không chạy.' },
  ],
  'kiem-bai': [
    { ma: 'kiem-bai', ten: 'Kiểm bài mới', lich: (n) => tanSuat(n.kiemMoi), khop: null,
      mo_ta: 'Mọi bài / trang nội dung mới nộp vào hàng chờ (node worker/kiem-bai.mjs --nop <url> --tu <người>, hoặc --html <bản nháp>) trước khi lên trang. Máy đo không AI (gạch ngang dài, từ máy, số chữ, ví dụ trích, FAQ, phần "nếu đã lỡ", nút) rồi Ngọc chấm theo cong-ty/quy-dinh/noi-dung/chuan-duyet-bai.md → tin vào chủ đề 📝 Nội dung trên Telegram: ai gửi, thiếu gì, thừa gì, giọng văn, kết luận DUYỆT / SỬA LẠI / KHÔNG DUYỆT. Chặn cứng (gạch dài, từ máy, thiếu ảnh / video / FAQ) không bao giờ DUYỆT. Bài chưa DUYỆT trả về người phụ trách site (--tra-ve) sửa rồi nộp lại, tối đa 3 lượt; hết lượt thì dừng chờ anh (--mo-khoa). Mô hình chỉ được gọi khi có bài.' },
  ],
  'mail-bao-mat': [
    { ma: 'kiem-thu', ten: 'Kiểm thư bảo mật', lich: (n) => tanSuat(n.kiemMoi), khop: null,
      mo_ta: 'Đọc hòm claude@ (thư 30 ngày), thẩm định từng thư: tên miền người gửi so với link thật trong thư, gỡ link chuyển tiếp, đối chiếu sổ "đã dạy". Thư giả / chưa rõ → báo vào chủ đề 🔐 Bảo mật trên Telegram kèm nút dạy; thư đã xử thì ❤ rồi gỡ tin sau 1 phút; thư gọi tên Kiên thì trả lời. Mô hình chỉ được gọi khi có thư cần viết lời báo.' },
    { ma: 'diem-danh', ten: 'Điểm danh đầu ngày', lich: (n) => n.diemDanh, khop: /điểm danh/, can_diem_danh: true,
      mo_ta: 'Một lần mỗi ngày làm việc, đúng giờ điểm danh: báo lên Telegram "đã vào ca" kèm số thư đang chờ, rồi thả các thư bảo mật đến ngoài giờ đã giữ lại từ tối hôm trước.' },
    { ma: 'bao-cao', ten: 'Báo cáo cuối ngày', lich: (n) => mocCuoiCa(n.ca), khop: /báo cáo cuối ngày/, can_diem_danh: true,
      mo_ta: '5 phút trước khi hết ca: tổng kết trong ngày lên Telegram — đã đọc bao nhiêu thư, báo mấy thư, anh dạy gì, còn thư nào chờ.' },
  ],
};
/** Đầu việc của một người đang bật: [{ ma, ten, lich, mo_ta, viec, khop }]. n = { viec[], ca, diemDanh, kiemMoi } (như dangBat). */
export const dauViec = (n) => n.viec.flatMap((v) => (VIEC_NHIP[v] ?? []).filter((x) => !x.can_diem_danh || n.diemDanh).map((x) => ({ ...x, viec: v, lich: x.lich(n), gio: x.gio?.(n) })));
/** Tên việc nhịp bằng chữ người đọc (bảng nhân sự hiện cái này, không hiện mã). */
export const TEN_NHIP = { 'kiem-bai': 'Kiểm bài mới trước khi lên trang (gọi mô hình chỉ khi có bài nộp)', 'mail-bao-mat': 'Báo khi có thư bảo mật mới (gọi mô hình chỉ lúc có thư)', 'don-nhat-ky': 'Dọn nhật ký chat Claude cũ (MacBook)' };
/** Việc NHỊP chạy trên MÁY MAC (LaunchAgent), không phải bộ chạy box này: box không gọi, chỉ hiện + giữ cờ bật/tắt; script trên Mac hỏi `dangTat`
 *  qua ssh trước mỗi lượt và tự ghi nhật ký nhịp (<DATA>/nhip/<người>.json[l]) như ghiLam. */
export { NHIP_MAY } from './nhip-may.mjs';   // khai ở nhip-may.mjs — viec-may.mjs nạp từ đó, không vòng về tệp này
export const NHIP = {
  'mail-bao-mat': async (n) => (await import('./mail-bao-mat.mjs')).nhipBaoMat(n.id, { ten: n.ten, model: n.model, phong: n.phong, ca: n.ca, diemDanh: n.diemDanh }),   // Phòng Bảo mật: thư bảo mật → Telegram + pixel
  'kiem-bai': async (n) => (await import('./kiem-bai.mjs')).nhipKiemBai(n.id, { ten: n.ten, model: n.model, phong: n.phong }),   // Phòng Nội dung: bài nộp → chấm → Telegram
};
export { trongCa } from './gio-lam.mjs';
import { trongCa, mocCuoiCa } from './gio-lam.mjs';
/** Ai đang bật nhịp: [{ id, ten, viec[] }] — heartbeat khác 'off', tách dấu phẩy. */
export function dangBat() {
  const dir = path.join(GOC, 'cong-ty', 'nhan-su');
  return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'SOUL.md'))).map((d) => ({ id: d, fm: parseFm(fs.readFileSync(path.join(dir, d, 'SOUL.md'), 'utf8')).fm }))
    .filter((x) => x.fm.heartbeat && x.fm.heartbeat !== 'off' && !dangTat(x.id)).map((x) => { const c = docChinh()[x.id] ?? {}; return { id: x.id, ten: String(x.fm.ten ?? x.id), model: String(x.fm.model ?? ''), phong: String(x.fm.phong ?? ''),
      ca: c.ca || x.fm.ca, diemDanh: c.diem_danh !== undefined ? c.diem_danh : x.fm.diem_danh, kiemMoi: Number(c.kiem_moi || x.fm.kiem_moi || 1), viec: String(x.fm.heartbeat).split(',').map((v) => v.trim()).filter(Boolean) }; });
}

if (process.argv[1]?.endsWith('nhip.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: a } = await import('node:assert'); const g = (h, p = 0) => new Date(Date.UTC(2026, 9, 13, (h + 17) % 24, p));   // giờ VN h:p
  a.ok(trongCa('08:00-24:00', g(8)) && trongCa('08:00-24:00', g(23, 59)) && !trongCa('08:00-24:00', g(0)) && !trongCa('08:00-24:00', g(7, 59)));
  a.ok(trongCa('22:00-06:00', g(23)) && trongCa('22:00-06:00', g(5)) && !trongCa('22:00-06:00', g(12)) && trongCa(undefined, g(3)));
  const dir = fs.mkdtempSync('/tmp/nhip-'); process.env.CTY_DATA_DIR = dir;
  a.throws(() => luuChinh('x', { ca: '25:00-02:00', kiem_moi: 1 })); a.throws(() => luuChinh('x', { ca: '06:00-02:00', kiem_moi: 0 })); a.throws(() => luuChinh('x', { ca: '06:00-02:00', diem_danh: '8h', kiem_moi: 1 }));
  a.equal(luuChinh('kien', { ca: '07:00-01:00', diem_danh: '08:30', kiem_moi: 5 }, 't').kiem_moi, 5);
  a.equal(datBat('kien', false, 't').bat, false); a.ok(!dangBat().some((n) => n.id === 'kien') && dangTat('kien'), 'admin tắt → bộ chạy bỏ qua');
  a.equal(luuChinh('kien', { ca: '07:00-01:00', diem_danh: '08:30', kiem_moi: 5 }, 't').bat, false, 'chỉnh ca không được xoá cờ tắt');
  datBat('kien', true, 't'); a.throws(() => datKiemMoi('kien', 2000)); a.equal(datKiemMoi('kien', 15, 't').ca, '07:00-01:00', 'đổi tần suất giữ ca'); datKiemMoi('kien', 5, 't');
  a.throws(() => datGio('bao', '3h')); a.equal(datGio('bao', '04:15', 't').gio, '04:15'); a.equal(luuChinh('bao', { ca: '00:00-24:00', kiem_moi: 1 }).gio, '04:15', 'chỉnh ca không xoá giờ chạy');
  const k = dangBat().find((n) => n.id === 'kien'); a.ok(k.ca === '07:00-01:00' && k.diemDanh === '08:30' && k.kiemMoi === 5, 'chỉnh của admin đè hồ sơ');
  ghiLam('kien', 'điểm danh · 3 thư đã đọc', 'mail-bao-mat'); ghiLam('kien', '4 thư đã đọc', 'mail-bao-mat'); fs.appendFileSync(tepNk('kien'), '{hỏng\n');
  const nk = nhatKyNhip('kien'); a.ok(nk.length === 2 && nk[0].ket === '4 thư đã đọc' && nhatKyNhip('khong-ai').length === 0, 'nhật ký mới trước, dòng hỏng bỏ qua');
  const dv = dauViec(k); a.deepEqual(dv.map((x) => x.ma), ['kiem-thu', 'diem-danh', 'bao-cao']); a.ok(dv[0].lich === 'mỗi 5 phút' && dv[1].lich === '08:30' && dv[2].lich === '00:55');
  a.ok(nk.filter((e) => dv[1].khop.test(e.ket)).length === 1, 'việc điểm danh chỉ lấy dòng có điểm danh');
  a.deepEqual(dauViec({ ...k, diemDanh: '' }).map((x) => x.ma), ['kiem-thu'], 'không khai điểm danh → không có điểm danh / báo cáo');
  fs.rmSync(dir, { recursive: true });
  console.log('✓ nhip: đầu việc + nhật ký từng lần chạy · ca làm theo giờ VN + chỉnh của admin (ca · điểm danh · kiểm mấy phút) đè hồ sơ, sai định dạng bị chặn'); process.exit(0);
}
if (process.argv[1]?.endsWith('nhip.mjs')) {
  for (const n of dangBat()) for (const v of n.viec) {
    if (NHIP[v] && !trongCa(n.ca)) { console.log(`${n.id} · ${v}: ngoài ca ${n.ca} — để tới đầu ca`); continue; }
    if (!NHIP[v]) continue;   // heartbeat không phải nhịp máy (vd Phòng thử "khi bấm nút") → không thuộc bộ chạy này
    const truoc = lanLam(n.id); if (truoc && Date.now() - Date.parse(truoc.luc) < n.kiemMoi * 60_000 - 15_000) continue;   // chưa tới lượt kiểm của người này
    try { const ket = await NHIP[v](n); ghiLam(n.id, ket, v); console.log(`${n.id} · ${v}: ${ket}`); } catch (e) { console.error(`✗ ${n.id} · ${v}: ${e.message}`); process.exitCode = 1; }
  }
  // VIỆC MÁY (worker/viec-may.mjs): dò lại timer / cron / LaunchAgent mọi máy mỗi 10 phút để bảng nhân sự thấy việc mới + lần chạy cuối
  const vm = await import('./viec-may.mjs'); let tuoi = Infinity; try { tuoi = Date.now() - fs.statSync(vm.TEP()).mtimeMs; } catch { /* chưa có ảnh */ }
  // admin vừa đổi lịch một việc trên box → áp + dò lại ngay, không đợi lượt 10 phút
  if (tuoi > 9.5 * 60_000 || vm.choApBox() || vm.choGomMac()) try { console.log(`việc máy: ${vm.gom()}`); } catch (e) { console.error(`✗ việc máy: ${e.message}`); }
}

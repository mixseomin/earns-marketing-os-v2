// GIAO BAN SÁNG (anh 21/10/2026: "đầu ngày làm sao các trưởng phòng báo cáo công việc trong ngày" → chọn một tin tổng ở topic Quản lý).
// 08:00 VN mỗi ngày, một lần: mỗi phòng một khối — trưởng phòng · hôm nay máy chạy gì (việc nền + nhịp của người trong phòng) · 24 giờ qua (lượt nhịp,
// việc nền đang hỏng) · hàng chờ của phòng · kẹt (nhịp đứng trong ca). Phòng không có gì để báo gom một dòng. 0đ: chỉ đọc sổ có sẵn, không gọi mô hình.
// Gọi từ nhip.mjs (mỗi phút; tự bỏ qua khi chưa tới giờ / đã báo hôm nay). KHÔNG import nhip.mjs (nhip đang top-level await → vòng chờ): bên gọi truyền vào.
//   node worker/giao-ban.mjs --in      xem tin tại chỗ, không gửi        node worker/giao-ban.mjs --tu-kiem
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';
import { parseFm } from '../scripts/fm.mjs';
import { docViecMay, tenViec, dangChay, hong, tenPhong } from './viec-may.mjs';
import { choXu } from './phong-thu.mjs';
import { trongCa, phutVN } from './gio-lam.mjs';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const TEP = () => path.join(DATA(), 'giao-ban.json');
export const GIO_GIAO_BAN = 8 * 60;   // 08:00 VN
const TOPIC_QUAN_LY = 2285;           // MINE › Quản lý (vault acct #476 property mine.topics)
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const gio = (ms) => new Date(ms + 7 * 3600_000).toISOString().slice(11, 16);
const ngayVN = (ms) => new Date(ms + 7 * 3600_000).toISOString().slice(0, 10);

/** Các phòng theo thứ tự cty: [{ id, ten, truong }]. */
export function cacPhong() {
  const dir = path.join(GOC, 'cong-ty', 'phong');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => ({ id: f.slice(0, -3), fm: parseFm(fs.readFileSync(path.join(dir, f), 'utf8')).fm }))
    .sort((a, b) => (Number(a.fm.thu_tu) || 99) - (Number(b.fm.thu_tu) || 99)).map((p) => ({ id: p.id, ten: tenPhong(p.id), truong: String(p.fm.truong ?? '') }));
}

/** Dựng tin. nguoi = [{ id, ten, phong, ca, kiemMoi, viecNhip: [{ ten, lich }], mac }] (nhịp đang bật), nhatKy(id) = lượt chạy mới trước, viec = ảnh việc máy. */
export function tinGiaoBan({ phongs, nguoi, viec, nhatKy, cho, now = Date.now() }) {
  const khoi = [], im = [];
  for (const p of phongs) {
    const vm = viec.filter((v) => v.phong === p.id), nv = nguoi.filter((n) => n.phong === p.id), ch = cho(p.id);
    const dong = [];
    if (vm.length || nv.length) dong.push(`• Hôm nay: ${[vm.length ? `${vm.length} việc nền (${vm.filter(dangChay).length} đang chạy)` : '', ...nv.map((n) => `${esc(n.ten)}: ${n.viecNhip.map((x) => `${esc(x.ten.toLowerCase())} (${esc(x.lich)})`).join(', ')}`)].filter(Boolean).join(' · ')}`);
    const luot = nv.map((n) => [n, nhatKy(n.id).filter((e) => now - Date.parse(e.luc) < 864e5)]);
    if (luot.some(([, l]) => l.length)) dong.push(`• 24 giờ qua: ${luot.filter(([, l]) => l.length).map(([n, l]) => `${esc(n.ten)} chạy ${l.length.toLocaleString('vi-VN')} lượt, cuối ${gio(Date.parse(l[0].luc))} — ${esc(String(l[0].ket).slice(0, 80))}`).join(' · ')}`);
    const h = vm.filter(hong); if (h.length) dong.push(`• ⚠️ Việc nền hỏng (${h.length}): ${h.slice(0, 4).map((v) => esc(tenViec(v).slice(0, 50))).join(', ')}${h.length > 4 ? ` … +${h.length - 4}` : ''}`);
    if (ch.length) dong.push(`• Hàng chờ phòng: ${ch.length} việc — ${ch.slice(0, 2).map((x) => esc(String(x.tieuDe ?? x.id).slice(0, 60))).join('; ')}`);
    // nhịp chạy trên box mà đứng quá 3 lần kiểm (tối thiểu 30 phút) trong ca = kẹt; nhịp trên Mac tự báo riêng, không xét
    const ket = luot.filter(([n, l]) => !n.mac && trongCa(n.ca, new Date(now)) && (!l.length || now - Date.parse(l[0].luc) > Math.max(30, 3 * n.kiemMoi) * 60_000));
    if (ket.length) dong.push(`• 🛑 Kẹt: ${ket.map(([n, l]) => `${esc(n.ten)} không chạy nhịp từ ${l.length ? gio(Date.parse(l[0].luc)) : 'hơn 24 giờ'}`).join(' · ')}`);
    if (dong.length) khoi.push(`<b>📂 ${esc(p.ten)}</b>${p.truong ? ` — ${esc(p.truong)}` : ''}\n${dong.join('\n')}`); else im.push(p.ten);
  }
  const dau = `☀️ <b>Giao ban sáng ${ngayVN(now).split('-').reverse().join('/')}</b> — ${khoi.length} phòng có việc`;
  return [dau, ...khoi, im.length ? `<i>Chưa có việc máy: ${im.map(esc).join(', ')}</i>` : ''].filter(Boolean).join('\n\n');
}

/** Cắt tin theo khối (Telegram tối đa 4096 ký tự). */
export const chiaTin = (t, toiDa = 3900) => t.split('\n\n').reduce((ds, k) => { if (ds.length && ds.at(-1).length + k.length + 2 <= toiDa) ds[ds.length - 1] += `\n\n${k}`; else ds.push(k.slice(0, toiDa)); return ds; }, []);

/** Nhịp: tới 08:00 VN và hôm nay chưa báo → gửi. Trả chữ cho log, null khi chưa tới lượt. */
export async function nhipGiaoBan({ nguoi, nhatKy, now = Date.now(), tg }) {
  const hom = ngayVN(now); let st = {}; try { st = JSON.parse(fs.readFileSync(TEP(), 'utf8')); } catch { /* lần đầu */ }
  if (st.ngay === hom || phutVN(now) < GIO_GIAO_BAN) return null;
  fs.writeFileSync(TEP(), JSON.stringify({ ngay: hom, luc: new Date(now).toISOString() }));   // ghi trước khi gửi: lỗi mạng thì mất một tin, không gửi lặp mỗi phút
  const tin = tinGiaoBan({ phongs: cacPhong(), nguoi, viec: docViecMay()?.ds ?? [], nhatKy, cho: choXu, now });
  const phan = chiaTin(tin); for (const t of phan) await tg('sendMessage', { message_thread_id: TOPIC_QUAN_LY, text: t, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  return `giao ban sáng: ${phan.length} tin`;
}

if (process.argv[1]?.endsWith('giao-ban.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert'); const now = Date.parse('2026-10-22T01:05:00Z');   // 08:05 VN
  const phongs = [{ id: 'sach', ten: 'Sách', truong: 'Thảo' }, { id: 'an-toan-tk', ten: 'Bảo mật', truong: 'Kiên' }, { id: 'phap-che', ten: 'Pháp chế', truong: 'Trang' }];
  const viec = [{ phong: 'sach', loai: 'timer', ma: 'puzzle-a', tiep: 'x', ket: 'success' }, { phong: 'sach', loai: 'timer', ma: 'puzzle-b', ten: 'Dang Etsy', tiep: 'x', ket: 'failed' }];
  const nguoi = [{ id: 'kien', ten: 'Kiên', phong: 'an-toan-tk', ca: '07:00-01:00', kiemMoi: 1, viecNhip: [{ ten: 'Kiểm thư bảo mật', lich: 'mỗi 1 phút' }] }];
  const nk = { kien: [{ luc: '2026-10-22T00:00:00Z', ket: '50 thư đã đọc' }, { luc: '2026-10-21T23:00:00Z', ket: 'x' }] };
  const tin = tinGiaoBan({ phongs, nguoi, viec, nhatKy: (id) => nk[id] ?? [], cho: (p) => (p === 'sach' ? [{ tieuDe: 'Etsy policy' }] : []), now });
  t.match(tin, /Giao ban sáng 22\/10\/2026<\/b> — 2 phòng có việc/); t.match(tin, /📂 Sách<\/b> — Thảo\n• Hôm nay: 2 việc nền \(2 đang chạy\)/);
  t.match(tin, /Việc nền hỏng \(1\): Dang Etsy/); t.match(tin, /Hàng chờ phòng: 1 việc — Etsy policy/);
  t.match(tin, /Kiên chạy 2 lượt, cuối 07:00/); t.match(tin, /🛑 Kẹt: Kiên không chạy nhịp từ 07:00/, 'đứng 65 phút trong ca = kẹt'); t.match(tin, /Chưa có việc máy: Pháp chế/);
  t.doesNotMatch(tinGiaoBan({ phongs, nguoi, viec, nhatKy: () => [{ luc: '2026-10-22T01:04:00Z', ket: 'ok' }], cho: () => [], now }), /Kẹt/, 'vừa chạy thì không kẹt');
  t.deepEqual(chiaTin('a'.repeat(3000) + '\n\n' + 'b'.repeat(2000)).map((x) => x.length), [3000, 2000], 'quá dài thì chia theo khối');
  process.env.CTY_DATA_DIR = fs.mkdtempSync(path.join((await import('node:os')).tmpdir(), 'giao-ban-')); const gui = []; const tg = async (_m, b) => gui.push(b);
  t.equal(await nhipGiaoBan({ nguoi: [], nhatKy: () => [], now: Date.parse('2026-10-22T00:30:00Z'), tg }), null, '07:30 chưa báo');
  t.match(await nhipGiaoBan({ nguoi: [], nhatKy: () => [], now, tg }), /1 tin/); t.equal(gui[0].message_thread_id, TOPIC_QUAN_LY);
  t.equal(await nhipGiaoBan({ nguoi: [], nhatKy: () => [], now: now + 60_000, tg }), null, 'một ngày một lần');
  console.log('giao-ban: tự kiểm đạt');
}

if (process.argv[1]?.endsWith('giao-ban.mjs') && process.argv.includes('--in')) {   // xem tin tại chỗ (box3), không gửi
  const { dangBat, dauViec, nhatKyNhip, NHIP } = await import('./nhip.mjs');
  const nguoi = dangBat().map((n) => ({ ...n, mac: !n.viec.some((v) => NHIP[v]), viecNhip: dauViec(n).map((x) => ({ ten: x.ten, lich: x.lich })) }));
  console.log(chiaTin(tinGiaoBan({ phongs: cacPhong(), nguoi, viec: docViecMay()?.ds ?? [], nhatKy: nhatKyNhip, cho: choXu })).join('\n\n──── (tin kế) ────\n\n'));
}

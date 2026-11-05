#!/usr/bin/env node
// MÁY GÁC SỔ KÊNH (anh 04/11/2026: "cần có nơi tổ chức để sau này lên video mới ko bị chệch hướng"). Nguồn luật: lich-su/so-kenh.json.
//   node kiem-so-kenh.mjs                       → tự kiểm sổ mọi kênh (mẫu trỏ playlist có thật, ý tưởng thuộc mẫu có thật, mã không trùng, demo có link)
//   node kiem-so-kenh.mjs --tap <tập.json> [--kenh astrolas]  → gác một tập: khai mau + playlist + y_tuong có trong sổ, playlist đúng của mẫu,
//                                                  câu kết trỏ đích của sổ (dinh_vi.cau_ket), ý tưởng chưa đăng. Sai → mã 1, in từng lỗi.
// Máy sinh tập (lich-su/dai/sinh-*.mjs) gọi kiemTap() ngay sau khi ghi tập; máy làm tập theo lịch (G8) gọi trước khi dựng; deploy.sh chạy tự kiểm sổ trước build.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kiemNguon, linkCongCu } from './nguon-site.mjs';
import { kiemChuMan } from './chu-man.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
export const docSo = () => JSON.parse(readFileSync(join(DIR, 'so-kenh.json'), 'utf8'));
const TT_Y = new Set(['chua', 'san_sang', 'demo', 'da_lam', 'da_dang']);

/** Tự kiểm một kênh trong sổ → danh sách lỗi (rỗng = đạt). Kênh chưa khai mẫu thì chỉ kiểm phần đã có. Thuần. */
export function kiemSo(k, ma) {
  const loi = [], pl = new Set((k.playlist ?? []).map((p) => p.ma)), mau = new Map();
  for (const m of k.mau ?? []) {
    if (!m.ma || !m.ten) loi.push(`${ma}: mẫu thiếu ma / ten`);
    if (mau.has(m.ma)) loi.push(`${ma}: mẫu trùng mã ${m.ma}`); mau.set(m.ma, m);
    if (!['short', 'dai'].includes(m.loai)) loi.push(`${ma}: mẫu ${m.ma} loai phải short | dai`);
    if (m.playlist && !pl.has(m.playlist)) loi.push(`${ma}: mẫu ${m.ma} trỏ playlist ${m.playlist} không có trong sổ`);
    if (m.demo && !/^https:\/\//.test(m.demo)) loi.push(`${ma}: mẫu ${m.ma} demo không phải link https`);
    if (m.tu_sinh) { try { new RegExp(m.tu_sinh); } catch { loi.push(`${ma}: mẫu ${m.ma} tu_sinh không phải regex`); } }
  }
  // PLAYLIST = SERIES dùng nhiều mẫu: playlist.mau[] phải là mẫu có trong sổ
  for (const p of k.playlist ?? []) for (const x of p.mau ?? []) if (!mau.has(x)) loi.push(`${ma}: playlist ${p.ma} dùng mẫu ${x} không có trong sổ`);
  // kênh đã chia series (playlist khai mau[]): mẫu nào cũng phải phục vụ ít nhất một series, không thì máy không biết tập của mẫu đó lên playlist nào
  if ((k.playlist ?? []).some((p) => p.mau?.length)) for (const m of k.mau ?? []) if (!m.playlist && !(k.playlist ?? []).some((p) => p.mau?.includes(m.ma))) loi.push(`${ma}: mẫu ${m.ma} chưa thuộc playlist nào`);
  const y = new Set();
  for (const h of k.hang_cho ?? []) {
    if (y.has(h.ma)) loi.push(`${ma}: ý tưởng trùng mã ${h.ma}`); y.add(h.ma);
    // ý tưởng thuộc MẪU (khuôn video) và / hoặc PLAYLIST (series — kênh tách mẫu ≠ playlist, 05/11/2026): cái nào khai phải có thật
    if (!h.mau && !h.playlist) loi.push(`${ma}: ý tưởng ${h.ma} không khai mẫu hay playlist`);
    if (h.mau && !mau.has(h.mau)) loi.push(`${ma}: ý tưởng ${h.ma} thuộc mẫu ${h.mau} không có trong sổ`);
    if (h.playlist && !pl.has(h.playlist)) loi.push(`${ma}: ý tưởng ${h.ma} thuộc playlist ${h.playlist} không có trong sổ`);
    if (!TT_Y.has(h.trang_thai)) loi.push(`${ma}: ý tưởng ${h.ma} trạng thái lạ ${h.trang_thai}`);
  }
  if ((k.mau ?? []).length && !k.dinh_vi?.cau_ket) loi.push(`${ma}: có mẫu nhưng thiếu dinh_vi.cau_ket`);
  for (const n of k.nguon_y_tuong ?? []) {   // nguồn ý tưởng tự sinh: mẫu có thật, tệp có thật, mã mỗi sự kiện đúng khuôn tu_sinh của mẫu
    const m = mau.get(n.mau); if (!m) { loi.push(`${ma}: nguồn ý tưởng trỏ mẫu ${n.mau} không có`); continue; }
    if (!existsSync(join(DIR, n.tep))) { loi.push(`${ma}: nguồn ý tưởng ${n.tep} không có (chạy máy sinh của nó)`); continue; }
    const ds = JSON.parse(readFileSync(join(DIR, n.tep), 'utf8')).su_kien ?? [], sai = m.tu_sinh ? ds.filter((x) => !new RegExp(m.tu_sinh).test(x.ma)) : ds;
    if (sai.length) loi.push(`${ma}: ${sai.length} ý tưởng trong ${n.tep} không đúng khuôn tu_sinh của mẫu ${n.mau} (vd ${sai[0].ma})`); }
  return loi;
}

/** Gác một tập (CAU / tệp tập) theo sổ của kênh → danh sách lỗi. Thuần. */
export function kiemTap(tap, k, ma) {
  const loi = [], m = (k.mau ?? []).find((x) => x.ma === tap.mau);
  if (!tap.mau) loi.push('tập không khai mau (mẫu đã duyệt nào?)'); else if (!m) loi.push(`mẫu ${tap.mau} không có trong sổ ${ma}`);
  // mẫu mới (cho_duyet) chỉ làm DEMO cho anh duyệt; tập thật theo mẫu đó chưa được lên kênh (demo khai demo: true)
  else if (m.cho_duyet && !tap.demo) loi.push(`mẫu ${m.ma} đang chờ anh duyệt demo — chưa làm tập thật`);
  if (!tap.playlist?.ma && !tap.playlist_ma) loi.push('tập không khai playlist');
  const plMa = tap.playlist_ma ?? tap.playlist?.ma;
  if (m && plMa && m.playlist && m.playlist !== plMa) loi.push(`mẫu ${m.ma} thuộc playlist ${m.playlist}, tập lại khai ${plMa}`);
  const plSo = (k.playlist ?? []).find((p) => p.ma === plMa); if (plMa && !plSo) loi.push(`playlist ${plMa} không có trong sổ ${ma}`); if (m && plSo?.mau?.length && !plSo.mau.includes(m.ma)) loi.push(`playlist ${plMa} không dùng mẫu ${m.ma} (dùng: ${plSo.mau.join(', ')})`);
  // ý tưởng: có trong hàng chờ, HOẶC đúng khuôn mã tự sinh của mẫu (mẫu vô hạn: Tonight's Sky ts-<thành phố>-<ngày>, Chart Chapters dài ccd-<người>)
  const h = (k.hang_cho ?? []).find((x) => x.ma === tap.y_tuong), tuSinh = m?.tu_sinh && tap.y_tuong && new RegExp(m.tu_sinh).test(tap.y_tuong);
  if (!tap.y_tuong) { if (!tap.demo) loi.push('tập không khai y_tuong (ý tưởng nào trong hàng chờ?)'); }   // demo: đề theo mô tả series, không từ hàng chờ
  else if (!h && !tuSinh) loi.push(`ý tưởng ${tap.y_tuong} không có trong hàng chờ, cũng không đúng khuôn tự sinh của mẫu`);
  else if (h?.trang_thai === 'da_dang') loi.push(`ý tưởng ${tap.y_tuong} đã đăng — không làm lại`);
  else if (h && m && h.mau && h.mau !== m.ma) loi.push(`ý tưởng ${tap.y_tuong} thuộc mẫu ${h.mau}, không phải ${m.ma}`);
  else if (h && plMa && h.playlist && h.playlist !== plMa) loi.push(`ý tưởng ${tap.y_tuong} thuộc playlist ${h.playlist}, không phải ${plMa}`);
  // lá số trong tập: phải lấy theo sổ người (la-so/lay.mjs --nguoi) với hạng Rodden được dùng nhà / cung Mọc — giờ sinh DD / B (vd /c/taylor-swift) không lên video
  // SYNASTRY (bánh xe đôi la-so/hop/<a>--<b>.svg): tệp hop.mjs phải có; mỗi cảnh cheo phải là góc chiếu được dùng theo hạng Rodden (cờ dung) và không phải góc thế hệ
  if (tap.la_so && /\/hop\//.test(tap.la_so)) { const ten = tap.la_so.split('/').pop().replace(/\.svg$/, ''), tep = join(DIR, 'la-so/hop', `${ten}.json`);
    if (!existsSync(tep)) loi.push(`synastry ${ten} chưa lấy (la-so/hop.mjs ${ten.replace('--', ' ')})`);
    else { const h = JSON.parse(readFileSync(tep, 'utf8'));
      for (const c of tap.cau ?? []) { const ch = c.nhin?.cheo; if (!ch) continue; const [a, b] = ch.map((x) => x.split(':')[1]);
        const g = [...(h.giai ?? []), ...(h.luoi ?? [])].find((x) => x.a === a && x.b === b);
        if (!g) loi.push(`cảnh cheo ${a}–${b}: site không có góc chiếu này giữa ${h.a.ten} và ${h.b.ten}`);
        else if (!g.dung) loi.push(`cảnh cheo ${a}–${b}: ${g.vi}`); else if (g.the_he) loi.push(`cảnh cheo ${a}–${b}: góc chiếu thế hệ, không làm điểm chính`); } } }
  else if (tap.la_so) { const ten = tap.la_so.split('/').pop().replace(/\.svg$/, ''), tep = join(DIR, 'la-so', `${ten}.json`), so = JSON.parse(readFileSync(join(DIR, 'la-so/nguoi.json'), 'utf8'));
    const ls = existsSync(tep) ? JSON.parse(readFileSync(tep, 'utf8')) : null, ng = so.nguoi.find((x) => x.slug === ten);
    if (!ls) loi.push(`lá số ${ten} chưa lấy (la-so/lay.mjs --nguoi ${ten})`);
    else if (!ng || !so.rodden_dung_nha.includes(ls.rodden) || ng.khong_dung) loi.push(`lá số ${ten}: giờ sinh ${ls.rodden ?? 'không rõ hạng'}${ng?.khong_dung ? ' · bị đánh dấu không dùng' : ''} — chỉ dùng hạng ${so.rodden_dung_nha.join('/')} lấy theo la-so/nguoi.json`); }
  // câu kết: câu cuối của tập phải nhắc tên miền trong dinh_vi.cau_ket (vd "…free at astrolas.com" → astrolas.com)
  const mien = (k.dinh_vi?.cau_ket ?? '').match(/[\w-]+(\.[\w-]+)+/)?.[0], cuoi = (tap.cau ?? []).at(-1)?.chu ?? '';
  if (mien && !cuoi.includes(mien)) loi.push(`câu cuối phải trỏ về ${mien} (dinh_vi.cau_ket "${k.dinh_vi.cau_ket}")`);
  // LUẬT NGUỒN (anh 05/11/2026): diễn giải = chữ nguyên văn site; bài đăng kèm mô tả công cụ của site + link mở đúng trang / đúng người (lich-su/nguon-site.mjs)
  if (k.luat_nguon) loi.push(...kiemNguon(tap));
  // MỖI KHUNG MỘT Ý NGẮN (anh 05/11/2026): chữ trên một khung không quá trần — tách cảnh bằng chu-man.mjs › tachCanh
  if (k.luat_nguon) loi.push(...kiemChuMan(tap));
  return loi;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const so = docSo(), arg = (x) => { const i = process.argv.indexOf(`--${x}`); return i > 0 ? process.argv[i + 1] : null; };
  if (arg('tap')) {
    const tap = JSON.parse(readFileSync(arg('tap'), 'utf8')), ma = arg('kenh') ?? tap.kenh ?? 'astrolas', loi = kiemTap(tap, so[ma] ?? {}, ma);
    console.log(loi.length ? `✗ ${arg('tap')}\n${loi.map((l) => `   · ${l}`).join('\n')}` : `✓ ${arg('tap')} đúng sổ ${ma}`); process.exit(loi.length ? 1 : 0);
  }
  let tong = 0;
  // MỘT NGUỒN: sổ kênh chỉ ở so-kenh.json. lo-trinh.json (tên cũ, đổi 04/11/2026) quay lại = hai bản song song, người sửa nhầm bản không ai đọc
  // (04/11/2026 một phiên khôi phục nó từ git sau khi commit khác gom nhầm phần đổi tên) → chặn, deploy.sh chạy máy gác này trước khi build
  for (const cu of ['lo-trinh.json']) if (existsSync(join(DIR, cu))) { console.log(`✗ ${cu} xuất hiện lại cạnh so-kenh.json — sổ kênh chỉ có MỘT tệp: so-kenh.json (xoá ${cu}, gộp nội dung vào so-kenh.json nếu có gì mới)`); tong++; }
  for (const [ma, k] of Object.entries(so)) { if (ma.startsWith('_') || typeof k !== 'object') continue; const loi = kiemSo(k, ma); tong += loi.length;
    console.log(loi.length ? `✗ ${ma}\n${loi.map((l) => `   · ${l}`).join('\n')}` : `✓ ${ma}: ${(k.mau ?? []).length} mẫu · ${(k.hang_cho ?? []).length} ý tưởng · ${(k.playlist ?? []).length} playlist`); }
  // phá thử: tập sai phải bị chặn (máy gác không được im)
  const k = so.astrolas, cc = (await import('./nguon-site.mjs')).SO_CONG_CU().find((x) => x.ma === 'today'), DANG_THU = { cong_cu: 'today', link: cc.url, mo_ta: `${cc.mo_ta}: ${cc.url}` };
  // luật nguồn phải chặn: câu tự đặt nghĩa nhà + bài đăng thiếu link
  if (k?.luat_nguon) { const bia = kiemTap({ mau: 'this-week', playlist_ma: 'timing', y_tuong: 'tw-di-thuan-mercury-scorpio-2026-11-13', cau: [{ chu: 'Your 4th house: money and fame.' }, { chu: 'See it free at astrolas.com' }] }, k, 'astrolas');
    if (!bia.some((l) => l.includes('không phải chữ của site')) || !bia.some((l) => l.includes('dang.link'))) { console.log(`✗ luật nguồn không chặn câu bịa / bài thiếu link: ${bia.join('; ')}`); tong++; } else console.log('✓ phá thử luật nguồn: câu tự đặt nghĩa nhà + bài thiếu link bị chặn'); }
  if (k?.mau?.length) { const sai = kiemTap({ mau: 'khong-co', cau: [{ chu: 'bye' }] }, k, 'astrolas'), dung = kiemTap({ mau: 'this-week', playlist_ma: 'timing', y_tuong: 'tw-di-thuan-mercury-scorpio-2026-11-13', cau: [{ chu: 'See it free at astrolas.com' }], dang: DANG_THU }, k, 'astrolas');
    const tuSinh = kiemTap({ mau: 'tonights-sky', playlist_ma: 'timing', y_tuong: 'ts-paris-2027-01-05', cau: [{ chu: 'See your own sky free at astrolas.com' }], dang: DANG_THU }, k, 'astrolas');
    const choDuyet = (k.mau.find((x) => x.cho_duyet) && kiemTap({ mau: k.mau.find((x) => x.cho_duyet).ma, playlist_ma: k.mau.find((x) => x.cho_duyet).playlist, y_tuong: 'x', cau: [{ chu: 'astrolas.com' }] }, k, 'astrolas').some((l) => l.includes('chờ anh duyệt'))) ?? true;
    const saiKhuon = kiemTap({ mau: 'tonights-sky', playlist_ma: 'timing', y_tuong: 'paris', cau: [{ chu: 'astrolas.com' }] }, k, 'astrolas');
    if (sai.length < 3 || dung.length || tuSinh.length || !saiKhuon.length || !choDuyet) { console.log(`✗ tự kiểm máy gác hỏng: sai→${sai.length} · đúng→${dung.join('; ')} · tự sinh→${tuSinh.join('; ')} · sai khuôn→${saiKhuon.length} · mẫu chờ duyệt→${choDuyet ? 'chặn' : 'LỌT'}`); tong++; }
    else console.log('✓ phá thử: tập sai bị chặn · tập đúng qua · mã tự sinh đúng khuôn qua · sai khuôn bị chặn · mẫu chờ duyệt bị chặn'); }
  process.exit(tong ? 1 : 0);
}

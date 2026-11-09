#!/usr/bin/env node
// LƯỢT TỰ CHẠY KÊNH CÓ SỔ MÁY VIẾT (G8 kênh Astrolas, anh 07/11/2026: "Làm G8 luôn"). chay-kenh.mjs gọi ở cuối lượt mỗi giờ (việc nền iMac:com.earns.lich-su-lam-tap) — không có tiến trình nền riêng.
// Một lượt, tối đa MỘT tập: tập bị Phòng Nội dung trả về vì hook → đổi hook, dựng lại · còn dưới trần làm trước (so-kenh › tu_chay.truoc_ke_hoach, anh 05/11/2026 "chỉ sx trước kế hoạch 3 bài")
// → chọn tập kế theo lịch playlist (playlist.lich_tap: 1 = Thứ Hai … 7 = Chủ nhật), mẫu ít tập nhất trong playlist, chưa từng nạp → máy viết → long-tieng.mjs → nap-tap.mjs.
// Sau đó Phòng Nội dung chấm, máy đăng tự đăng theo nhịp an toàn. Báo Telegram tập mới + tiền thật; hỏng 3 lần thì bỏ tập đó, lượt kế làm tập khác. Video dài 16:9: tuần một tập (tu_chay.dai), đi trước trần làm trước, lỡ ngày hẹn thì làm bù tới ngày hẹn kế.
//   node chay-so-kenh.mjs [--xem] [--tu-kiem] [--tap <mã tập>] [--bo-tran: bỏ trần làm trước, chạy thử trọn chuỗi một tập]   · --y-tuong: ghi kho ý tưởng lich-su/y-tuong/<kênh>-<mẫu>.json cho mos2 › Hàng chờ
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../shot-code'), KENH = 'astrolas', CUNG = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const MAU_TU_CHAY = ['ask-the-chart', 'chart-chapters', 'chart-reading-cat', 'chart-tools', 'chart-vs-chart', 'free-60s', 'myth-behind', 'read-your-chart', 'sign-x-sign', 'sky-calendar', 'this-week', 'zodiac-myths'];
const bam = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7), iso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** lệnh máy viết của một mã tập. Thuần. */
export function lenhViet(y, o = {}) {
  let m;
  if ((m = /^ask-(.+)-(\d{4})$/.exec(y))) return ['viet-ask.mjs', '--ai', m[1], '--nam', m[2]];
  if ((m = /^cc-(.+)$/.exec(y))) return ['viet-chuong.mjs', '--ai', m[1]];
  if (/^ct-/.test(y)) return ['viet-chart-tools.mjs', '--y', y];
  if ((m = /^f60-(.+)$/.exec(y))) return ['viet-free60.mjs', '--cong-cu', m[1]];
  if ((m = /^ccd-(.+)$/.exec(y))) return ['dai/sinh-chuong.mjs', '--slug', m[1], '--moc', `dai/moc-${m[1]}.json`];
  if ((m = /^crd-(.+)$/.exec(y))) return ['dai/doc-bai.mjs', '--slug', m[1]];   // Full Chart Reading 8–10 phút (09/11/2026)
  if ((m = /^crc-(.+)-(\d+)$/.exec(y))) return ['dai/cat-short.mjs', '--tu', m[1], '--chuong', m[2]];   // Short cắt từ một chương của tập dài
  if ((m = /^ls-(.+)$/.exec(y))) return ['viet-love-story.mjs', '--cap', m[1]];
  if ((m = /^cvc-(.+)$/.exec(y))) return ['viet-cap.mjs', '--cap', m[1]];
  if ((m = /^my-(.+)$/.exec(y))) return ['viet-myth-behind.mjs', '--sao', m[1]];
  if ((m = /^ryc-([a-z]+)-(.+)$/.exec(y))) return ['viet-ryc.mjs', '--muc', m[1], '--ai', m[2]];
  if (/^sc-/.test(y)) return ['viet-sky.mjs', '--chuyen', y, ...(o.tuan ? ['--tuan', o.tuan] : [])];
  if (/^sx-/.test(y)) return ['viet-sign.mjs', '--cap', y];
  if ((m = /^tt-(.+)$/.exec(y))) return ['viet-than-thoai.mjs', '--cung', m[1]];
  if ((m = /^(tw-.+)-([a-z]+)$/.exec(y))) return ['viet-this-week.mjs', '--su', m[1], '--moc', m[2][0].toUpperCase() + m[2].slice(1)];
  throw new Error(`mã tập lạ: ${y}`);
}
/** tập video dài 16:9 (mẫu loai 'dai' tự chạy) → dựng 1920×1080, bìa 1280×720. Thuần. */
export const laDai = (y) => /^(ccd|crd|ls)-/.test(y);
/** câu lỗi của nhật ký: dòng ✗ / ⚠ máy viết ra, không lấy ngăn xếp Node (09/11/2026: Telegram chỉ nhận "at file:///…nap-tap.mjs:54"). Thuần. */
export const caiLoi = (log) => { const d = log.trim().split('\n').map((l) => l.trim()).filter(Boolean), x = d.filter((l) => /^[✗⚠]/.test(l)); return (x.length ? x.slice(-2) : d.filter((l) => !/^at |^Node\.js v/.test(l)).slice(-3)).join(' · '); };
/** ngày hẹn video dài gần nhất ≤ hôm nay (thu: 1 = Thứ Hai … 7 = Chủ nhật) — lỡ ngày hẹn (trần, ngoài giờ, máy bận) thì các ngày sau vẫn làm bù tới ngày hẹn kế. Thuần. */
export function ngayDai(hom, thuDs = []) {
  for (let i = 0; i < 7; i++) { const ms = Date.parse(`${hom}T12:00:00Z`) - i * 864e5, d = new Date(ms).getUTCDay() || 7; if (thuDs.includes(d)) return iso(ms); }
  return null;
}
/** playlist của hôm nay rồi các playlist khác theo thứ tự lịch (hôm đó hết tập thì sang playlist kế). Thuần. */
export function thuTuPlaylist(ds, thu) {
  const coLich = ds.filter((p) => p.lich_tap?.length), hom = coLich.filter((p) => p.lich_tap.includes(thu));
  return [...hom, ...coLich.filter((p) => !hom.includes(p))];
}
/** chọn một tập trong playlist: mẫu ít tập đã làm nhất trong playlist (thứ tự trong sổ khi hoà), trong mẫu xáo theo ngày để không dồn một người. Thuần. */
export function chonTap(pl, ungVien, daLam, bo, hom) {
  const con = ungVien.filter((u) => u.playlist === pl.ma && !daLam.has(u.y) && !bo.has(u.y)); if (!con.length) return null;
  const dem = (m) => ungVien.filter((u) => u.playlist === pl.ma && u.mau === m && daLam.has(u.y)).length;
  const mau = pl.mau.filter((m) => con.some((u) => u.mau === m)).sort((a, b) => dem(a) - dem(b) || pl.mau.indexOf(a) - pl.mau.indexOf(b))[0];
  return con.filter((u) => u.mau === mau).sort((a, b) => bam(a.y + hom) - bam(b.y + hom))[0];
}
if (process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  t.deepEqual(lenhViet('ct-transit--tom-hanks'), ['viet-chart-tools.mjs', '--y', 'ct-transit--tom-hanks']); t.deepEqual(lenhViet('f60-birth'), ['viet-free60.mjs', '--cong-cu', 'birth']); t.deepEqual(lenhViet('ccd-steve-jobs'), ['dai/sinh-chuong.mjs', '--slug', 'steve-jobs', '--moc', 'dai/moc-steve-jobs.json']); t.ok(laDai('ls-a--b') && laDai('ccd-x') && laDai('crd-x') && !laDai('cc-x') && !laDai('crc-x-1'));
  t.deepEqual(lenhViet('crd-tom-hanks'), ['dai/doc-bai.mjs', '--slug', 'tom-hanks']); t.deepEqual(lenhViet('crc-tom-hanks-3'), ['dai/cat-short.mjs', '--tu', 'tom-hanks', '--chuong', '3']);
  t.equal(caiLoi('✓ dựng\n✗ x: Ngọc chặn bìa: mờ\nfile:///a.mjs:54\n  at f (a.mjs:1)\nError: bìa bị chặn\n\nNode.js v25'), '✗ x: Ngọc chặn bìa: mờ'); t.equal(caiLoi('a\nb\n    at x\nNode.js v25'), 'a · b');
  t.equal(ngayDai('2026-11-08', [7]), '2026-11-08', 'đúng Chủ nhật'); t.equal(ngayDai('2026-11-09', [7]), '2026-11-08', 'Thứ Hai làm bù Chủ nhật lỡ'); t.equal(ngayDai('2026-11-14', [7]), '2026-11-08'); t.equal(ngayDai('2026-11-15', [7]), '2026-11-15'); t.equal(ngayDai('2026-11-09', []), null);
  t.deepEqual(lenhViet('ask-steve-jobs-1985'), ['viet-ask.mjs', '--ai', 'steve-jobs', '--nam', '1985']); t.deepEqual(lenhViet('ryc-mc-angelina-jolie'), ['viet-ryc.mjs', '--muc', 'mc', '--ai', 'angelina-jolie']);
  t.deepEqual(lenhViet('tw-trang-moi-scorpio-2026-11-09-leo'), ['viet-this-week.mjs', '--su', 'tw-trang-moi-scorpio-2026-11-09', '--moc', 'Leo']); t.deepEqual(lenhViet('sc-a-1', { tuan: '2026-11-16' }), ['viet-sky.mjs', '--chuyen', 'sc-a-1', '--tuan', '2026-11-16']); t.throws(() => lenhViet('zz'));
  const P = [{ ma: 'a', lich_tap: [1] }, { ma: 'b', lich_tap: [2] }, { ma: 'c' }]; t.deepEqual(thuTuPlaylist(P, 2).map((p) => p.ma), ['b', 'a']);
  const U = [{ y: 'x1', mau: 'x', playlist: 'a' }, { y: 'x2', mau: 'x', playlist: 'a' }, { y: 'z1', mau: 'z', playlist: 'a' }], pl = { ma: 'a', mau: ['x', 'z'] };
  t.equal(chonTap(pl, U, new Set(['x1']), new Set(), '2026-11-07').y, 'z1', 'mẫu ít tập trước'); t.equal(chonTap(pl, U, new Set(['x1', 'x2', 'z1']), new Set(), 'h'), null); t.equal(chonTap(pl, U, new Set(['x1']), new Set(['z1']), 'h').y, 'x2', 'bỏ tập đã bỏ');
  console.log('chay-so-kenh: tự kiểm đạt'); process.exit(0);
}
const { BOX, box, sqlBox, dauDangLam } = await import('./box3.mjs'), { docSo } = await import('./kiem-so-kenh.mjs'), { camHook, boHookVideo } = await import('./hook-kenh.mjs');
const { xepLich, soChuyen } = await import('./viet-sky.mjs');
const so = docSo()[KENH], TC = so.tu_chay ?? {}, TAP = join(SHOT, `tap-${KENH}`), RA = join(DIR, `brand/${KENH}/ra`), NOW = Date.now(), hom = iso(NOW + 7 * 36e5), thu = ((d) => (d === 0 ? 7 : d))(new Date(`${hom}T12:00:00Z`).getUTCDay());
const dsTap = () => readdirSync(TAP).filter((f) => f.endsWith('.json') && !f.startsWith('.')).map((f) => { try { return JSON.parse(readFileSync(join(TAP, f), 'utf8')); } catch (e) { console.error(`⚠ tập ${f} hỏng: ${e.message}`); return null; } }).filter((t) => t?.y_tuong);
if (process.argv.includes('--y-tuong')) {   // kho ý tưởng cho mos2 › Hàng chờ: mỗi mẫu một tệp { su_kien: [{ ma, chu }] }
  mkdirSync(join(DIR, 'y-tuong'), { recursive: true }); const nhom = Map.groupBy(dsTap().filter((t) => MAU_TU_CHAY.includes(t.mau) && t.mau !== 'this-week'), (t) => t.mau);
  for (const [m, ds] of nhom) writeFileSync(join(DIR, `y-tuong/${KENH}-${m}.json`), JSON.stringify({ _ghi: `Kho ý tưởng mẫu ${m}: sinh bởi lich-su/chay-so-kenh.mjs --y-tuong từ các máy viết`, su_kien: ds.map((t) => ({ ma: t.y_tuong, chu: t.tieu_de.replace(t.cau[0].chu, '').trim() || t.tieu_de })).sort((a, b) => a.ma.localeCompare(b.ma)) }, null, 0) + '\n');
  console.log([...nhom].map(([m, d]) => `${m} ${d.length}`).join(' · ')); process.exit(0);
}
const tele = (chu) => { try { execFileSync('ssh', [BOX, 'set -a; . /root/.secrets/mine-tg.env; set +a; curl -s -o /dev/null https://api.telegram.org/bot$TG_BOT_TOKEN/sendMessage --data-urlencode chat_id=$TG_CHAT --data-urlencode text@-'], { input: chu }); } catch (e) { console.log(`⚠ Telegram: ${e.message}`); } };
const gio = new Date(NOW + 7 * 36e5).toISOString().slice(11, 16), xem = process.argv.includes('--xem'), TEP_SO = join(DIR, `hook-kho/${KENH}-tu-dong.json`), khoa = join(homedir(), '.cache', `lich-su-${KENH}.khoa`);
const soTd = () => (existsSync(TEP_SO) ? JSON.parse(readFileSync(TEP_SO, 'utf8')) : {}), ghiTd = (s) => { mkdirSync(dirname(TEP_SO), { recursive: true }); writeFileSync(TEP_SO, JSON.stringify(s, null, 1) + '\n'); };
const song = (f) => { try { process.kill(Number(readFileSync(f, 'utf8')), 0); return true; } catch { return false; } };
// render một lúc một (luật anh 22/10/2026): lượt làm tập của kênh khác đang chạy thì chờ
const CACHE = join(homedir(), '.cache'), banKhac = readdirSync(CACHE).some((f) => /^lich-su-.+\.khoa$/.test(f) && song(join(CACHE, f)));
if (!xem && (banKhac || gio < (TC.gio_tu ?? '07:00') || gio >= (TC.gio_den ?? '22:00'))) { console.log(`· ${KENH}: ${banKhac ? 'đang có lượt làm tập khác' : `ngoài giờ làm (${gio})`} — bỏ lượt`); process.exit(0); }
// THÊM NGƯỜI TỰ ĐỘNG (08/11/2026 — Chart Chapters / Ask the Chart / Read Your Chart cạn đề khi sổ chỉ có người viết tay): ngày một lần, bài lá số người mới trên
// astrolas.com → la-so/them-nguoi.mjs (Astrotheme + kiểm cung Mọc + Swiss Ephemeris + mốc Wikidata → tệp tập). Không có bài mới thì chỉ tốn một lượt đọc sitemap.
{ const dau = join(homedir(), '.cache', `them-nguoi-${hom}.xong`);
  if (!xem && !existsSync(dau)) { writeFileSync(dau, new Date().toISOString());
    const r = spawnSync(process.execPath, [join(DIR, 'la-so/them-nguoi.mjs'), '--toi-da', '3'], { encoding: 'utf8', timeout: 60 * 60_000, killSignal: 'SIGKILL' }), ra = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
    console.log(ra); const loi = ra.split('\n').filter((l) => /^[✗⚠]/.test(l));
    if (r.status || loi.length) tele(`⚠ Astrolas thêm người ${hom}${r.status ? ` (mã ${r.status ?? r.signal})` : ''}:\n${(loi.length ? loi : ra.split('\n').slice(-3)).slice(0, 10).join('\n')}`); } }
// ĐO PLAYLIST (G9, 08/11/2026): mỗi giờ đọc câu anh trả lời đề xuất đổi suất; Thứ Hai gửi bảng tuần (lich-su/do-playlist.mjs). Dấu tuần chỉ ghi khi gửi được.
if (!xem && KENH === 'astrolas') {
  const doP = (...a) => spawnSync(process.execPath, [join(DIR, 'do-playlist.mjs'), ...a], { encoding: 'utf8', timeout: 10 * 60_000, killSignal: 'SIGKILL' });
  const ap = doP('--ap'); if (ap.stdout?.trim()) console.log(ap.stdout.trim());
  const dau = join(homedir(), '.cache', `${KENH}-do-playlist-${hom}.xong`);
  if (thu === 1 && !existsSync(dau)) { const r = doP(), ra = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim(); console.log(ra);
    if (r.status === 0) writeFileSync(dau, new Date().toISOString()); else tele(`⚠ Astrolas bảng playlist tuần hỏng (mã ${r.status ?? r.signal}):\n${ra.split('\n').slice(-3).join('\n')}`); }
}
const q = (c) => sqlBox(c).trim(), M = `(SELECT id FROM xv_may WHERE ma = '${KENH}')`;
const daLam = new Set(q(`SELECT coalesce(string_agg(slug, ','), '') FROM xv_may_video WHERE may_id = ${M};`).split(',').filter(Boolean)), td = soTd(), bo = new Set(Object.entries(td).filter(([, v]) => v.bo).map(([k]) => k));

/** viết → lồng tiếng + dựng → nạp, nhật ký ~/.cache/lich-su/<kênh>-<tập>.log. Trả { ok, tien, loi }. */
function lam(y, han = {}) {
  mkdirSync(join(CACHE, 'lich-su'), { recursive: true }); const f = join(CACHE, 'lich-su', `${KENH}-${y}.log`), fd = openSync(f, 'w');
  // trần mỗi bước: tập ngắn 45 phút; tập dài 8–10 phút ~17.000 khung × ~5 khung/giây ≈ 1 giờ dựng → 3 giờ (09/11/2026: tập dài đầu bị giết ở phút 45)
  // nhóm tiến trình riêng (detached): hết giờ thì giết CẢ NHÓM — giết mỗi node cha thì trình dựng / ffmpeg con mồ côi chạy tiếp, chồng lên lượt sau và ghi vào cùng nhật ký
  // (09/11/2026: lượt dài đầu bị giết ở phút 45, bộ dựng con vẫn chạy song song lượt làm lại → 80 phút + "ghép đoạn hỏng" lẫn vào nhật ký)
  const chay = (args, cwd) => { const r = spawnSync(process.execPath, args, { cwd, stdio: ['ignore', fd, fd], timeout: (laDai(y) ? 180 : 45) * 60_000, killSignal: 'SIGKILL', detached: true });
    if (r.signal && r.pid) try { process.kill(-r.pid, 'SIGKILL'); } catch { /* nhóm đã hết */ } return r; };
  try {
    const ra = join(RA, `${y}.mp4`), tep = join(TAP, `${y}.json`), buoc = [[lenhViet(y, han), DIR], [[join(SHOT, 'long-tieng.mjs'), '--cau', relative(SHOT, tep), '--ra', relative(SHOT, ra), ...(laDai(y) ? ['--rong', '1920', '--cao', '1080'] : [])], SHOT],
      [[join(DIR, 'nap-tap.mjs'), '--tap', tep, '--video', ra, ...(han.tu ? ['--dang-tu', han.tu] : []), ...(han.den ? ['--dang-den', han.den] : [])], DIR]];
    for (const [a, cwd] of buoc) { const r = chay(a, cwd); if (r.status !== 0) return { ok: false, loi: `${relative(DIR, a[0]) || a[0]} mã ${r.status ?? r.signal}: ${caiLoi(readFileSync(f, 'utf8')).slice(0, 400)}` }; }
    return { ok: true, tien: Number(/tiền giọng lượt này (\d+)₫/.exec(readFileSync(f, 'utf8'))?.[1] ?? 0), tieu_de: JSON.parse(readFileSync(tep, 'utf8')).tieu_de };
  } finally { closeSync(fd); }
}
function ketThuc(y, kq, nhan) {
  const s = soTd(); if (kq.ok) { delete s[y]; tele(`📺 Astrolas · ${nhan} ${y}\n${kq.tieu_de}\nTiền giọng ${kq.tien.toLocaleString('vi-VN')}₫ · đã nạp máy đăng, Phòng Nội dung chấm ở lượt kế`); }
  else { const n = (s[y]?.lan ?? 0) + 1; s[y] = { lan: n, loi: kq.loi, luc: new Date().toISOString(), ...(n >= 3 ? { bo: true } : {}) }; tele(`⚠ Astrolas · ${y} hỏng lần ${n}/3${n >= 3 ? ' → BỎ, lượt kế làm tập khác' : ''}\n${kq.loi}`); }
  ghiTd(s); try { dauDangLam(KENH, y, null); } catch { /* phụ */ }
}
const giu = (fn) => { writeFileSync(khoa, String(process.pid)); try { fn(); } finally { try { unlinkSync(khoa); } catch { /* đã gỡ */ } } };
// --tap <mã>: làm đúng một tập chỉ định qua cùng đường (viết → giọng → dựng → nạp, báo Telegram) — tập đầu của mẫu mới / làm bù, không đợi lịch
{ const i = process.argv.indexOf('--tap'), y = i > 0 ? process.argv[i + 1] : null;
  if (y) { lenhViet(y); if (xem) { console.log(`→ --tap ${y}: ${lenhViet(y).join(' ')}`); process.exit(0); } giu(() => { dauDangLam(KENH, y, { id: y, luc: new Date().toISOString() }); ketThuc(y, lam(y), laDai(y) ? 'video dài' : 'tập'); }); process.exit(0); } }

// 1 · tập bị trả về: vì hook → cấm câu đó, gỡ khỏi sổ video, dựng lại với hook mới (tối đa 5 lần) · lý do khác: báo một lần rồi bỏ
const traVe = JSON.parse(q(`SELECT coalesce(json_agg(json_build_object('y', slug, 'chan', cham->'chan_cung', 'hook', dang->'hook'->>'goc')), '[]') FROM xv_may_video WHERE may_id = ${M} AND NOT coalesce(luu_tru, false) AND mau = 'video-ngoai' AND cham->>'ket' = 'SUA_LAI' AND cham->>'xuat' = xuat_luc::text AND NOT (coalesce(da_dang, '{}'::jsonb) ? 'youtube');`) || '[]').filter((x) => !bo.has(x.y));
for (const x of traVe) {
  const s = soTd(), chiHook = (x.chan ?? []).length && x.chan.every((c) => /hook/i.test(String(c)));
  if (xem) { console.log(`→ trả về: ${x.y} (${chiHook ? 'hook' : 'khác'})`); continue; }
  if (!chiHook || (s[x.y]?.doi_hook ?? 0) >= 5) { s[x.y] = { ...s[x.y], bo: true, loi: (x.chan ?? []).join(' · ').slice(0, 300) }; ghiTd(s); tele(`⚠ Astrolas · ${x.y}: Phòng Nội dung trả về, máy không tự sửa được → BỎ\n${s[x.y].loi}`); continue; }
  camHook(KENH, x.hook); boHookVideo(KENH, x.y); s[x.y] = { ...s[x.y], doi_hook: (s[x.y]?.doi_hook ?? 0) + 1 }; ghiTd(s);
  giu(() => { dauDangLam(KENH, x.y, { id: x.y, luc: new Date().toISOString() }); ketThuc(x.y, lam(x.y), 'đổi hook'); });
  process.exit(0);   // một tập mỗi lượt
}
// 2 · trần làm trước
const conCho = Number(q(`SELECT count(*) FROM xv_may_video WHERE may_id = ${M} AND NOT coalesce(luu_tru, false) AND NOT (coalesce(da_dang, '{}'::jsonb) ? 'youtube') AND coalesce(cham->>'ket', '') <> 'SUA_LAI';`)), tran = TC.truoc_ke_hoach ?? 3;
if (!xem) try { box(`scripts/may-dung.mts --may ${KENH} --so-kenh`); } catch (e) { console.log(`⚠ đo số kênh: ${String(e.message).split('\n')[0]}`); }
// VIDEO DÀI 16:9 (G8, 08/11/2026 — "video dài chưa tự làm"): tuần một tập vào ngày tu_chay.dai.thu, mẫu khai ở tu_chay.dai.mau (Love Story có sẵn tập ls-*,
// Chart Chapters dài cho mọi người AA có tệp mốc dai/moc-<người>.json — la-so/them-nguoi.mjs tự dựng từ Wikidata). Dấu theo ngày hẹn chỉ ghi khi làm xong; hỏng thì ketThuc đếm lần như tập ngắn.
// ĐI TRƯỚC trần làm trước (09/11/2026: Chủ nhật 08/11 hàng 3 tập ngắn đầy → lượt thoát ở trần, tập dài không bao giờ tới lượt). Một tuần một tập nên không cần trần riêng.
{ const DAI = TC.dai, tuan = ngayDai(hom, DAI?.thu), dauDai = join(CACHE, `${KENH}-dai-${tuan}.xong`);
  if (tuan && !existsSync(dauDai)) {
    const NG = JSON.parse(readFileSync(join(DIR, 'la-so/nguoi.json'), 'utf8')).nguoi, uv = new Map();
    for (const t of dsTap().filter((t) => DAI.mau.includes(t.mau))) uv.set(t.y_tuong, { y: t.y_tuong, mau: t.mau, playlist: 'dai' });
    if (DAI.mau.includes('chart-reading-dai')) for (const n of (await import('./dai/doc-bai.mjs')).dsNguoi()) uv.set(`crd-${n.slug}`, { y: `crd-${n.slug}`, mau: 'chart-reading-dai', playlist: 'dai' });
    if (DAI.mau.includes('chart-chapters-dai')) for (const n of NG.filter((n) => n.rodden === 'AA' && !n.khong_dung && existsSync(join(DIR, `dai/moc-${n.slug}.json`)) && existsSync(join(DIR, `la-so/${n.slug}.json`)))) uv.set(`ccd-${n.slug}`, { y: `ccd-${n.slug}`, mau: 'chart-chapters-dai', playlist: 'dai' });
    const cd = chonTap({ ma: 'dai', mau: DAI.mau }, [...uv.values()], daLam, bo, hom);
    if (xem) console.log(`→ video dài tuần ${tuan}: ${cd?.y ?? '(hết ứng viên)'} · ${uv.size} ứng viên`);
    else if (!cd) { writeFileSync(dauDai, '(hết)'); tele(`⚠ Astrolas: hết ứng viên video dài (${DAI.mau.join(', ')}) — tuần ${tuan} không có tập dài`); }
    else { giu(() => { dauDangLam(KENH, cd.y, { id: cd.y, luc: new Date().toISOString() }); const kq = lam(cd.y); if (kq.ok) writeFileSync(dauDai, cd.y); ketThuc(cd.y, kq, 'video dài'); }); process.exit(0); } } }
// trần làm trước — chỉ chặn tập ngắn
if (conCho >= tran && !process.argv.includes('--bo-tran')) { console.log(`⏸ ${KENH}: đã có ${conCho} tập chưa đăng YouTube (trần ${tran}) — không làm tập mới`); if (!xem) process.exit(0); }
// 3 · chọn tập theo lịch: Sky Calendar / This Week có hạn đăng theo tuần / sự kiện, mẫu khác lấy trong kho tập đã viết
const thu2Toi = iso(Date.parse(`${hom}T00:00Z`) + ((8 - new Date(`${hom}T00:00Z`).getUTCDay()) % 7 || 7) * 864e5), LT = JSON.parse(readFileSync(join(DIR, 'lich-troi.json'), 'utf8'));
const sky = xepLich(soChuyen().filter((c) => !daLam.has(c.ma) && !bo.has(c.ma)), thu2Toi, 1)[0];
const su = LT.su_kien.filter((e) => e.utc.slice(0, 10) > hom && e.utc.slice(0, 10) <= iso(Date.parse(`${hom}T00:00Z`) + 6 * 864e5)).map((e) => ({ y: `${e.ma}-${CUNG[bam(e.ma) % 12].toLowerCase()}`, mau: 'this-week', playlist: 'timing', han: { tu: hom, den: e.utc.slice(0, 10) } }));
const ungVien = [...dsTap().filter((t) => MAU_TU_CHAY.includes(t.mau) && !['sky-calendar', 'this-week'].includes(t.mau)).map((t) => ({ y: t.y_tuong, mau: t.mau, playlist: t.playlist_ma })),
  ...(await import('./viet-chart-tools.mjs')).dsMa().map((y) => ({ y, mau: 'chart-tools', playlist: 'career' })),
  // REMIX (09/11/2026): mỗi chương của tập dài ĐÃ nạp → một Short Know Yourself (giọng dùng lại)
  ...await (async () => { const { maCat } = await import('./dai/cat-short.mjs'); return dsTap().filter((t) => t.mau === 'chart-reading-dai' && daLam.has(t.y_tuong)).flatMap((t) => maCat(t).map((y) => ({ y, mau: 'chart-reading-cat', playlist: 'know-yourself' }))); })(),   // Chart Tools: công cụ × người AA, tệp tập viết lúc làm (chụp trang)
  ...(sky ? [{ y: sky.ma, mau: 'sky-calendar', playlist: 'timing', han: { tu: thu2Toi, den: iso(Date.parse(`${thu2Toi}T00:00Z`) + 6 * 864e5), tuan: thu2Toi } }] : []), ...su];
let chon = null; for (const pl of thuTuPlaylist(so.playlist, thu)) { chon = chonTap(pl, ungVien, daLam, bo, hom); if (chon) break; }
if (xem) { console.log(`hôm nay ${hom} (lịch ${thu}: 1 = Thứ Hai … 7 = Chủ nhật) · chưa đăng ${conCho}/${tran} · ${ungVien.length} ứng viên · tập kế: ${chon?.y ?? '(hết)'} [${chon?.playlist ?? ''}] ${chon?.han ? JSON.stringify(chon.han) : ''}`); process.exit(0); }
if (!chon) { tele('⚠ Astrolas: hết tập trong kho máy viết — cần thêm người / mốc / chuyện'); process.exit(0); }
giu(() => { dauDangLam(KENH, chon.y, { id: chon.y, luc: new Date().toISOString() }); ketThuc(chon.y, lam(chon.y, chon.han), `tập mới [${chon.playlist}]`); });

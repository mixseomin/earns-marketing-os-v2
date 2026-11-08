#!/usr/bin/env node
// LƯU KHO CHUNG MỌI MÁY VIDEO (08/11/2026, anh: "phim gốc đăng rồi thì đẩy lên Drive cho giảm chi phí R2… iMac không thiếu ổ triệt để" → "việc lưu trữ cho
// dự án video phải chuẩn hoá toàn bộ theo cách YNT mới làm, không chắp vá hỏi đến đâu vá đến đó"). Chạy trên iMac. Cấu hình: luu-kho.json (máy không khai = mac_dinh).
//   node scripts/luu-kho.mjs --het [--xem]                 mọi máy studio có video (chay-kenh.mjs gọi mỗi ngày một lần)
//   node scripts/luu-kho.mjs --may <mã> [--chi <slug>] [--ngay N] [--xem]
//   node scripts/luu-kho.mjs --may <mã> --lay-lai <slug>    kéo bản đã chuyển kho từ Drive về đúng khoá R2 cũ (máy đăng tự gọi khi chọn trúng video đã chuyển kho)
//   node scripts/luu-kho.mjs --tu-kiem
// LUẬT "ĐÃ DÙNG XONG" (một chỗ, thuần — xongDung): video đã lên MỌI nền VIDEO còn sống của máy (nền có bài trong nen_song_ngay ngày; nền chết như TikTok hỏng /
// Page nghỉ không giữ video lại mãi), trừ nền cùng họ khác tài khoản đã có video này (máy đăng không bao giờ đăng lại — một video nhiều Page = bài lặp); bài hẹn
// giờ chưa tới giờ chưa tính là đã lên. Video lưu trữ (luu_tru) không đăng nữa → xong luôn. Nền ảnh / link / poll / bài không giữ video (ảnh nằm nguyên trên R2).
//   Nhịp 1 · xong: xoá video trên iMac (luu-kho.json › tep) — thư mục giữ tài sản.
//   Nhịp 2 · xong + đủ sau_ngay ngày (tính từ lần lên cuối, video lưu trữ tính từ lúc xuất): chép video + bìa từ R2 + tài sản lên Drive, so kích thước từng tệp,
//            khớp hết mới xoá bản R2 (box3 luu-kho.mts, ghi de.kho_drive vào sổ Studio), rồi xoá thư mục trên iMac. Lệch một tệp = dừng video đó, không xoá gì.
// LƯỚI ĐỠ: chuyển kho sớm không mất gì — máy đăng (puzzle-books dang-may.mjs) chọn trúng video có kho_drive thì gọi --lay-lai trước khi đăng.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const DIR = dirname(fileURLToPath(import.meta.url)), XV = join(DIR, '..');
const CAU = JSON.parse(readFileSync(join(DIR, 'luu-kho.json'), 'utf8'));
/** cấu hình của một máy = mac_dinh + mục riêng; {may} trong drive thay bằng mã máy */
export const cauHinh = (ma, cau = CAU) => { const r = cau.may?.[ma] ?? {}, c = { ...cau.mac_dinh, ...r }; return { ...c, tep: [...(cau.mac_dinh.tep ?? []), ...(r.tep ?? [])], drive: String(c.drive).replace('{may}', ma) }; };
/** tệp / thư mục iMac của một video theo khuôn tep */
export const tepCua = (c, slug, home = process.env.HOME) => (c.tep ?? []).map((t) => t.replace('{slug}', slug).replace(/^~(?=\/)/, home).replace('{xv}', XV));

/** Nền đã lên thật của một video: có url và giờ lên ≤ bây giờ (bài hẹn giờ chưa tới chưa tính). Trả { nen: ms }. */
export const daLen = (v, bay) => Object.fromEntries(Object.entries(v.da_dang ?? {}).map(([n, d]) => [n, d?.url && d?.luc ? Date.parse(d.luc) : NaN]).filter(([, t]) => t <= bay));
/** Nền còn sống của máy: có bài (kể cả hẹn) trong `ngay` ngày gần nhất trên bất kỳ video nào. */
export const nenSong = (ds, bay, ngay) => new Set(Object.values(ds).flatMap((v) => Object.entries(v.da_dang ?? {}).filter(([, d]) => d?.luc && Date.parse(d.luc) >= bay - ngay * 864e5).map(([n]) => n)));
/** LUẬT ĐÃ DÙNG XONG. h = { loaiNen(nen) → 'video'|…, hoNen(nen), acct(nen) }. Trả { xong, cho: [nền còn chờ], tu: ms mốc tính tuổi | null }. */
export function xongDung(v, dang, song, bay, h) {
  if (v.luu_tru) return { xong: true, cho: [], tu: v.xuat_luc ? Date.parse(v.xuat_luc) : null };
  const len = daLen(v, bay), lenNen = Object.keys(len);
  if (!lenNen.length) return { xong: false, cho: ['(chưa lên nền nào)'], tu: null };
  const cho = dang.map((d) => d.nen).filter((n) => h.loaiNen(n) === 'video' && song.has(n) && !(n in len)
    && !lenNen.some((p) => h.hoNen(p) === h.hoNen(n) && h.acct(p) !== h.acct(n)));
  return { xong: !cho.length, cho, tu: Math.max(...Object.values(len)) };
}

if (process.argv.includes('--tu-kiem')) {
  const bay = Date.parse('2026-11-08T00:00:00Z'), ng = (d) => new Date(bay - d * 864e5).toISOString();
  const H = { loaiNen: (n) => (/^(youtube|facebook|instagram|tiktok)/.test(n) ? 'video' : 'anh'), hoNen: (n) => (n.startsWith('facebook') || n.startsWith('fb_') ? 'fb' : n.split(':')[0]), acct: (n) => ({ facebook: '507', 'facebook:580': '580' })[n] ?? n };
  const dang = ['youtube', 'facebook', 'facebook:580', 'tiktok', 'fb_anh'].map((nen) => ({ nen })), song = new Set(['youtube', 'facebook', 'facebook:580', 'fb_anh']);
  const v = (da, x = {}) => ({ da_dang: Object.fromEntries(Object.entries(da).map(([n, d]) => [n, { url: 'u', luc: ng(d) }])), ...x });
  assert.deepEqual(xongDung(v({ youtube: 9 }), dang, song, bay, H).cho, ['facebook', 'facebook:580']);
  assert.equal(xongDung(v({ youtube: 9, facebook: 8 }), dang, song, bay, H).xong, true, 'đã lên Page FB khác tài khoản → facebook:580 không chờ; tiktok chết không chờ; fb_anh là nền ảnh');
  assert.equal(xongDung(v({ youtube: 9, facebook: -2 }), dang, song, bay, H).xong, false, 'bài hẹn giờ chưa tới giờ chưa tính');
  assert.equal(xongDung(v({}), dang, song, bay, H).xong, false, 'chưa lên đâu = chưa xong');
  assert.equal(xongDung(v({}, { luu_tru: true, xuat_luc: ng(30) }), dang, song, bay, H).xong, true, 'lưu trữ = xong');
  assert.equal(Math.round((bay - xongDung(v({ youtube: 9, facebook: 3 }), dang, song, bay, H).tu) / 864e5), 3, 'tuổi tính từ lần lên cuối');
  assert.deepEqual([...nenSong({ a: v({ youtube: 2, tiktok: 40 }) }, bay, 14)], ['youtube']);
  assert.equal(cauHinh('x', { mac_dinh: { drive: 'Studio/{may}', sau_ngay: 7 }, may: {} }).drive, 'Studio/x');
  assert.deepEqual(cauHinh('y', { mac_dinh: { drive: 'D', tep: ['a'] }, may: { y: { tep: ['b'] } } }).tep, ['a', 'b'], 'tep máy cộng vào tep mặc định');
  assert.deepEqual(tepCua({ tep: ['~/.cache/a/{slug}'] }, 's', '/H'), ['/H/.cache/a/s']);
  console.log('luu-kho: tự kiểm đạt'); process.exit(0);
}

const { boxA } = await import('./lich-su/box3.mjs');
const { gocNen, hoNen, NEN_DANG } = await import(`${process.env.HOME}/puzzle-books/scripts/nhip-an-toan.mjs`);
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; }, xem = process.argv.includes('--xem');
const rc = (...a) => execFileSync('rclone', a, { encoding: 'utf8', maxBuffer: 64 << 20 });
const coDrive = (dich) => { try { return JSON.parse(rc('lsjson', dich))[0]?.Size ?? -1; } catch { return -1; } };
const coUrl = (u) => Number(/content-length:\s*(\d+)/gi.exec(execFileSync('curl', ['-sIL', u], { encoding: 'utf8' }))?.[1] ?? -1);
// bản không chặn cho nhịp 2 (6 video song song — mỗi video vài lần gọi rclone / curl ~2–3 s, đợt tồn 736 video chạy lẻ mất ~4 giờ)
const { promisify } = await import('node:util'), chayA = promisify((await import('node:child_process')).execFile);
const rcA = async (...a) => (await chayA('rclone', a, { encoding: 'utf8', maxBuffer: 64 << 20 })).stdout;
const coDriveA = async (dich) => { try { return JSON.parse(await rcA('lsjson', dich))[0]?.Size ?? -1; } catch { return -1; } };
const coUrlA = async (u) => Number(/content-length:\s*(\d+)/gi.exec((await chayA('curl', ['-sIL', u], { encoding: 'utf8' })).stdout)?.[1] ?? -1);
const SONG = 6;
const tenTep = (u) => u.split('?')[0].split('/').pop();
const boxJson = async (lenh) => JSON.parse((await boxA(lenh)).split('\n').pop());

async function layLai(ma, slug) {
  const ds = await boxJson(`scripts/may-dung.mts --may ${ma} --ds --ca-luu-tru`), v = ds[slug];
  if (!v?.kho_drive) throw new Error(`${slug} chưa chuyển kho`);
  const tam = join(process.env.HOME, '.cache/luu-kho-lay-lai', slug), bt = `/var/tmp/lay-lai-${slug}`, cap = [v.file_url, v.thumb].filter(Boolean).map((u) => ({ u, ten: tenTep(u) }));
  for (const c of cap) rc('copyto', `${v.kho_drive}/${c.ten}`, join(tam, c.ten));
  execFileSync('ssh', ['root@167.233.241.16', `rm -rf ${bt} && mkdir -p ${bt}`]); execFileSync('scp', ['-q', ...cap.map((c) => join(tam, c.ten)), `root@167.233.241.16:${bt}/`]);
  const kq = (await boxA(`scripts/luu-kho.mts --may ${ma} --slug ${slug} --tra ${cap.map((c) => `'${bt}/${c.ten}=${c.u}'`).join(' ')}`)).split('\n').pop();
  rmSync(tam, { recursive: true, force: true }); return kq;
}

async function luuMay(ma) {
  const C = cauHinh(ma), NGAY = arg('ngay') != null ? Number(arg('ngay')) : C.sau_ngay;
  const ds = await boxJson(`scripts/may-dung.mts --may ${ma} --ds --ca-luu-tru`), dang = (await boxJson(`scripts/may-dung.mts --may ${ma} --may-info`)).dang ?? [];
  const acct = (n) => String(dang.find((d) => d.nen === n)?.br?.acct ?? n), H = { loaiNen: (n) => NEN_DANG[gocNen(n)]?.loai, hoNen, acct };
  const bay = Date.now(), song = nenSong(ds, bay, C.nen_song_ngay ?? 14);
  let mb1 = 0, chuyen = 0, mb2 = 0; const viec = [];
  // LÔ BOX3: đã chép + so khớp Drive xong thì gom 25 video một lần gọi luu-kho.mts (xoá R2 + ghi sổ) — box3 trả từng video, video lỗi không xoá thư mục iMac
  const lo = [], xaLo = async () => { if (!lo.length) return; const phan = lo.splice(0), coR2 = phan.filter((x) => x.urls.length);
    const kq = coR2.length ? await boxJson(`scripts/luu-kho.mts --may ${ma} --lo ${Buffer.from(JSON.stringify(coR2.map(({ slug, drive, urls }) => ({ slug, drive, urls })))).toString('base64')}`) : [];
    for (const x of phan) { const k = kq.find((y) => y.slug === x.slug);
      if (x.urls.length && (!k || k.loi)) { console.log(`⚠ ${ma} ${x.slug}: Drive đã có bản, box3 chưa xoá R2 — ${k?.loi ?? 'không có kết quả'} (giữ nguyên)`); continue; }
      if (k?.khong_xoa_duoc) console.log(`⚠ ${ma} ${x.slug}: không xoá được trên R2 ${k.khong_xoa_duoc.join(' ')} (sổ đã ghi Drive)`);
      for (const p of x.thu) rmSync(p, { recursive: true });
      chuyen++; mb2 += x.mb; } };
  for (const [slug, v] of Object.entries(ds)) {
    if (arg('chi') && slug !== arg('chi')) continue;
    if (v.kho_drive) continue;
    const x = xongDung(v, dang, song, bay, H); if (!x.xong) continue;
    const tep = tepCua(C, slug).filter((p) => existsSync(p));
    // nhịp 1: video trên iMac (R2 còn bản phát hành)
    for (const p of tep) { const ds1 = statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.endsWith('.mp4')).map((f) => join(p, f)) : [p];
      for (const f of ds1) { mb1 += statSync(f).size / 2 ** 20; if (!xem) rmSync(f, { force: true }); } }
    // nhịp 2: đủ ngày → Drive
    if (x.tu == null || (bay - x.tu) / 864e5 < NGAY) continue;
    const dich = `${C.remote}:${C.drive}/${slug}`, r2 = [v.file_url, v.thumb].filter(Boolean), thu = tep.filter((p) => existsSync(p) && statSync(p).isDirectory());
    if (xem) { console.log(`→ ${ma} ${slug}: ${v.luu_tru ? 'lưu trữ' : `lên lần cuối ${((bay - x.tu) / 864e5).toFixed(1)} ngày`} — sẽ chép ${r2.length} tệp R2${thu.length ? ` + ${thu.length} thư mục tài sản` : ''} lên ${dich}`); chuyen++; continue; }
    viec.push(async () => { try {
      let mb = 0;
      for (const u of r2) { const ten = tenTep(u), can = await coUrlA(u); await rcA('copyurl', u, `${dich}/${ten}`); const co = await coDriveA(`${dich}/${ten}`); if (can < 0 || co !== can) throw new Error(`${ten}: Drive ${co} / R2 ${can} byte`); mb += can / 2 ** 20; }
      for (const p of thu) { const d = `${dich}/tai/${basename(p)}`; await rcA('copy', p, d, '--exclude', '*.mp4'); await rcA('check', p, d, '--exclude', '*.mp4', '--size-only', '--one-way'); }
      lo.push({ slug, drive: dich, urls: r2, thu, mb }); if (lo.length >= 25) await xaLo();
    } catch (e) { console.log(`⚠ ${ma} ${slug}: chưa chuyển kho — ${String(e.message).split('\n')[0]} (không xoá gì)`); } });
  }
  await Promise.all(Array.from({ length: SONG }, async () => { while (viec.length) await viec.shift()(); }));
  await xaLo();
  console.log(`lưu kho ${ma}: ${xem ? 'sẽ ' : ''}bỏ ${Math.round(mb1)} MB video trên iMac · ${chuyen} video ${xem ? 'đủ điều kiện ' : ''}sang Drive${xem ? '' : ` (${Math.round(mb2)} MB khỏi R2)`}`);
}

if (arg('lay-lai')) { console.log(await layLai(arg('may'), arg('lay-lai'))); process.exit(0); }
const dsMay = process.argv.includes('--het') ? await boxJson('scripts/luu-kho.mts --ds-may') : [arg('may')].filter(Boolean);
if (!dsMay.length) { console.error('node scripts/luu-kho.mjs --het | --may <mã> [--chi slug] [--xem] | --may <mã> --lay-lai <slug> | --tu-kiem'); process.exit(2); }
for (const ma of dsMay) { try { await luuMay(ma); } catch (e) { console.log(`⚠ lưu kho ${ma}: ${String(e.message).split('\n')[0]}`); } }
process.exit(0);

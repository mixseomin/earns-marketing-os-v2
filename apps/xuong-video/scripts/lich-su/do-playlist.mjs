#!/usr/bin/env node
// ĐO PLAYLIST + TỰ CHỈNH SUẤT (G9 kênh Astrolas, 08/11/2026). Mỗi tuần (Thứ Hai, chay-so-kenh.mjs gọi): từng playlist có bao nhiêu tập đã lên YouTube,
// tổng lượt xem (xv_may_video.luot_xem), phiên vào astrolas.com từ link trong bài (GA4 property 533487094, utm_campaign = mã tập do máy đăng gắn) và lượt đăng ký
// Member (sự kiện GA4 sign_up, astrolas.com bắn từ 08/11/2026) → bảng Telegram. Điểm một playlist = phiên vào site / tập. Playlist đủ tập mà điểm dưới `kem` × trung vị
// mất một ngày đăng, playlist trên `tot` × trung vị nhận ngày đó (tổng nhịp tuần giữ nguyên — nhịp an toàn máy đăng không đổi). Ngưỡng: so-kenh.json › astrolas.tu_chay.do.
// Đổi lịch chỉ khi anh trả lời "Duyệt" ngay dưới tin đề xuất (tg-duyet.mjs); "Không" thì bỏ.
//   node do-playlist.mjs [--xem]     bảng tuần (--xem: in ra, không gửi Telegram)      · node do-playlist.mjs --ap   đọc câu trả lời đề xuất, duyệt thì đổi lich_tap
//   node do-playlist.mjs --ga4 <ngày> (box3: đọc GA4, in JSON — iMac gọi qua box3.mjs)  · node do-playlist.mjs --tu-kiem
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)), KENH = 'astrolas', GA4_PROP = '533487094', TEP_SO = join(DIR, 'so-kenh.json');
const TEP_DX = join(homedir(), '.cache', `${KENH}-suat-de-xuat.json`), THU = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const MAC_DINH = { ngay: 90, min_tap: 5, kem: 0.5, tot: 1.5 };

/** video đã đăng → playlist (mã): mã playlist trong tệp tập, rồi tên playlist máy đăng ghi. Thuần. */
export function playlistCua(v, pls, tap) {
  if (tap?.playlist_ma && pls.some((p) => p.ma === tap.playlist_ma)) return tap.playlist_ma;
  return pls.find((p) => p.ten === v.playlist_ten)?.ma ?? null;
}
/** gộp theo playlist: { ma, ten, lich, tap, xem, phien, dang_ky, diem }. ga = { <mã tập>: { phien, dang_ky } }. Thuần. */
export function gopPlaylist(videos, ga, pls, tapCua) {
  const bang = pls.map((p) => ({ ma: p.ma, ten: p.ten, lich: p.lich_tap ?? [], tap: 0, xem: 0, phien: 0, dang_ky: 0 })), theo = new Map(bang.map((b) => [b.ma, b]));
  for (const v of videos) { const b = theo.get(playlistCua(v, pls, tapCua(v.slug))); if (!b) continue;
    b.tap++; b.xem += v.xem ?? 0; b.phien += ga[v.slug]?.phien ?? 0; b.dang_ky += ga[v.slug]?.dang_ky ?? 0; }
  for (const b of bang) b.diem = b.tap ? b.phien / b.tap : 0;
  return bang;
}
/** đề xuất chuyển MỘT ngày đăng từ playlist kém nhất sang playlist tốt nhất. null = giữ nguyên. Thuần. */
export function deXuatSuat(bang, c = MAC_DINH) {
  const du = bang.filter((b) => b.tap >= c.min_tap); if (du.length < 2) return null;
  const d = du.map((b) => b.diem).sort((a, b) => a - b), tv = d[Math.floor(d.length / 2)]; if (!tv) return null;
  const kem = du.filter((b) => b.diem < c.kem * tv && b.lich.length > 1).sort((a, b) => a.diem - b.diem)[0];
  const tot = du.filter((b) => b.diem > c.tot * tv).sort((a, b) => b.diem - a.diem)[0];
  if (!kem || !tot || kem.ma === tot.ma) return null;
  return { tu: kem.ma, den: tot.ma, ngay: kem.lich[kem.lich.length - 1], tv };
}
/** áp đề xuất lên sổ (đối tượng so-kenh.json): bớt ngày ở playlist `tu`, thêm vào `den`. Trả lỗi (chuỗi) hoặc null. Thuần. */
export function apSuat(so, dx) {
  const pls = so[KENH].playlist, a = pls.find((p) => p.ma === dx.tu), b = pls.find((p) => p.ma === dx.den);
  if (!a || !b) return 'playlist không còn trong sổ';
  if (!(a.lich_tap ?? []).includes(dx.ngay) || a.lich_tap.length < 2) return `lịch ${a.ma} đã đổi từ lúc đề xuất`;
  a.lich_tap = a.lich_tap.filter((t) => t !== dx.ngay); b.lich_tap = [...new Set([...(b.lich_tap ?? []), dx.ngay])].sort((x, y) => x - y);
  return null;
}

if (process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  const pls = [{ ma: 'a', ten: 'A', lich_tap: [1, 7] }, { ma: 'b', ten: 'B', lich_tap: [2] }, { ma: 'c', ten: 'C', lich_tap: [3] }];
  t.equal(playlistCua({ playlist_ten: 'B' }, pls, null), 'b'); t.equal(playlistCua({ playlist_ten: 'B' }, pls, { playlist_ma: 'c' }), 'c', 'tệp tập thắng tên');
  const vs = (ma, n, phien) => Array.from({ length: n }, (_, i) => ({ slug: `${ma}${i}`, xem: 10, pl: ma, phien }));
  const V = [...vs('a', 5, 0), ...vs('b', 5, 4), ...vs('c', 5, 2)], ga = Object.fromEntries(V.map((v) => [v.slug, { phien: v.phien, dang_ky: 0 }]));
  const bang = gopPlaylist(V, ga, pls, (s) => ({ playlist_ma: s[0] }));
  t.deepEqual(bang.map((b) => [b.ma, b.tap, b.diem]), [['a', 5, 0], ['b', 5, 4], ['c', 5, 2]]);
  t.deepEqual(deXuatSuat(bang), { tu: 'a', den: 'b', ngay: 7, tv: 2 }, 'kém nhất mất ngày cuối, tốt nhất nhận');
  t.equal(deXuatSuat(bang.map((b) => ({ ...b, tap: 3 }))), null, 'chưa đủ tập thì không đề xuất');
  t.equal(deXuatSuat(bang.map((b) => (b.ma === 'a' ? { ...b, lich: [1] } : b))), null, 'playlist chỉ còn một ngày thì không bớt');
  const so = { [KENH]: { playlist: structuredClone(pls) } };
  t.equal(apSuat(so, { tu: 'a', den: 'b', ngay: 7 }), null); t.deepEqual(so[KENH].playlist.map((p) => p.lich_tap), [[1], [2, 7], [3]]);
  t.ok(apSuat(so, { tu: 'a', den: 'b', ngay: 7 }), 'áp lần hai bị chặn (lịch đã đổi)');
  console.log('do-playlist: tự kiểm đạt'); process.exit(0);
}

// box3: GA4 astrolas.com — phiên theo utm_campaign (utm_medium=short do máy đăng gắn) + sự kiện sign_up theo campaign của phiên. Token chỉ đọc /etc/adfond/ga4-oauth.json
// (cùng tệp scripts/phu/ga4-ngay.mjs và puzzle-books so-short.mjs đọc).
if (process.argv.includes('--ga4')) {
  const ngay = Number(process.argv[process.argv.indexOf('--ga4') + 1]) || MAC_DINH.ngay, o = JSON.parse(readFileSync('/etc/adfond/ga4-oauth.json', 'utf8'));
  const tok = (await (await fetch(o.token_uri || 'https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: o.client_id, client_secret: o.client_secret, refresh_token: o.refresh_token, grant_type: 'refresh_token' }) })).json()).access_token;
  const hoi = async (b) => { const r = await (await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROP}:runReport`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ dateRanges: [{ startDate: `${ngay}daysAgo`, endDate: 'today' }], dimensions: [{ name: 'sessionCampaignName' }], limit: 10000, ...b }) })).json(); if (r.error) throw new Error(r.error.message); return r.rows ?? []; };
  const loc = (ten, gt) => ({ filter: { fieldName: ten, stringFilter: { matchType: 'EXACT', value: gt } } });
  const [phien, dk] = await Promise.all([hoi({ metrics: [{ name: 'sessions' }], dimensionFilter: loc('sessionMedium', 'short') }),
    hoi({ metrics: [{ name: 'eventCount' }], dimensionFilter: { andGroup: { expressions: [loc('sessionMedium', 'short'), loc('eventName', 'sign_up')] } } })]);
  const ra = {}; for (const [ds, k] of [[phien, 'phien'], [dk, 'dang_ky']]) for (const r of ds) (ra[r.dimensionValues[0].value] ??= { phien: 0, dang_ky: 0 })[k] += Number(r.metricValues[0].value);
  console.log(JSON.stringify(ra)); process.exit(0);
}

const { box, sqlBox } = await import('./box3.mjs'), { guiTin, traLoi, laDuyet, laBo } = await import('./tg-duyet.mjs');
const docSoKenh = () => JSON.parse(readFileSync(TEP_SO, 'utf8'));

if (process.argv.includes('--ap')) {   // mỗi giờ: anh đã trả lời tin đề xuất chưa
  if (!existsSync(TEP_DX)) process.exit(0);
  const dx = JSON.parse(readFileSync(TEP_DX, 'utf8')), tra = traLoi(dx.msg); if (!tra) process.exit(0);
  if (laBo(tra)) { unlinkSync(TEP_DX); console.log(`· ${KENH}: anh bỏ đề xuất đổi suất`); process.exit(0); }
  if (!laDuyet(tra)) process.exit(0);
  const so = docSoKenh(), loi = apSuat(so, dx); unlinkSync(TEP_DX);
  if (loi) { guiTin(`⚠ Astrolas: không đổi suất playlist — ${loi}`); process.exit(0); }
  writeFileSync(TEP_SO, JSON.stringify(so, null, 2) + '\n');
  try { execFileSync('git', ['-C', DIR, 'commit', '-q', '-m', `so-kenh: ${KENH} chuyển ${THU[dx.ngay]} từ playlist ${dx.tu} sang ${dx.den} (do-playlist.mjs, anh duyệt trên Telegram: "${tra}")`, '--', TEP_SO]);
    execFileSync('git', ['-C', DIR, 'push', '-q', 'origin', 'HEAD:main'], { timeout: 120_000 }); } catch (e) { console.log(`⚠ commit so-kenh hỏng: ${e.message.split('\n')[0]}`); }
  const ten = (m) => so[KENH].playlist.find((p) => p.ma === m)?.ten ?? m;
  guiTin(`✅ Astrolas: đã chuyển ${THU[dx.ngay]} từ ${ten(dx.tu)} sang ${ten(dx.den)} theo câu duyệt của anh`); console.log(`✓ ${KENH}: ${THU[dx.ngay]} ${dx.tu} → ${dx.den}`); process.exit(0);
}

// bảng tuần (iMac)
const so = docSoKenh()[KENH], c = { ...MAC_DINH, ...(so.tu_chay?.do ?? {}) }, xem = process.argv.includes('--xem');
const videos = JSON.parse(sqlBox(`SELECT coalesce(json_agg(json_build_object('slug', v.slug, 'xem', v.luot_xem, 'playlist_ten', v.dang->>'playlist_ten')), '[]') FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = '${KENH}' AND v.da_dang ? 'youtube';`) || '[]');
const ga = JSON.parse(box(`scripts/lich-su/do-playlist.mjs --ga4 ${c.ngay}`).split('\n').pop());
const tapCua = (slug) => { const f = join(DIR, '../shot-code/tap-astrolas', `${slug}.json`); try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; } catch { return null; } };
const bang = gopPlaylist(videos, ga, so.playlist, tapCua), dx = deXuatSuat(bang, c);
const lech = videos.filter((v) => !playlistCua(v, so.playlist, tapCua(v.slug))).map((v) => v.slug);
const tong = bang.reduce((a, b) => ({ tap: a.tap + b.tap, xem: a.xem + b.xem, phien: a.phien + b.phien, dang_ky: a.dang_ky + b.dang_ky }), { tap: 0, xem: 0, phien: 0, dang_ky: 0 });
const dong = (ten, b) => `${ten.slice(0, 13).padEnd(13)} ${String(b.tap).padStart(4)}${String(b.xem).padStart(6)}${String(b.phien).padStart(5)}${String(b.dang_ky).padStart(4)}`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ten = (m) => so.playlist.find((p) => p.ma === m)?.ten ?? m;
const chu = `📊 Astrolas · playlist tuần ${new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10)} (GA4 ${c.ngay} ngày)\n<pre>${esc(`${'Playlist'.padEnd(13)} tập  xem vào  ĐK\n${bang.map((b) => dong(b.ten, b)).join('\n')}\n${dong('Tổng', tong)}`)}</pre>`
  + `\nvào = phiên vào astrolas.com từ link bài · ĐK = đăng ký Member${lech.length ? `\n⚠ ${lech.length} video chưa gắn playlist: ${lech.slice(0, 5).join(', ')}` : ''}`
  + (dx ? `\n\nĐề xuất: chuyển ${THU[dx.ngay]} từ ${esc(ten(dx.tu))} (${bang.find((b) => b.ma === dx.tu).diem.toFixed(1)} vào/tập) sang ${esc(ten(dx.den))} (${bang.find((b) => b.ma === dx.den).diem.toFixed(1)} vào/tập, trung vị ${dx.tv.toFixed(1)}). Trả lời "Duyệt" ngay dưới tin này là máy tự đổi lịch, "Không" để giữ — không cần ai làm tay.`
    : `\n\nGiữ nguyên lịch (cần ≥ 2 playlist có ≥ ${c.min_tap} tập và chênh nhau rõ mới đề xuất đổi).`);
if (xem) { console.log(chu.replace(/<\/?pre>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')); process.exit(0); }
const msg = guiTin(chu, true); if (!msg) { console.log('✗ gửi Telegram hỏng'); process.exit(1); }
if (dx) writeFileSync(TEP_DX, JSON.stringify({ msg, ...dx, luc: new Date().toISOString() })); else if (existsSync(TEP_DX)) unlinkSync(TEP_DX);
console.log(`✓ bảng tuần đã gửi (${tong.tap} tập, ${tong.phien} phiên, ${tong.dang_ky} đăng ký)${dx ? ` · đề xuất ${dx.tu} → ${dx.den}` : ''}`);

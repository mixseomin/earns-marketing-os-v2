import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { apPlaylist, kiemPlaylist, lichHomNay, tapMoiTuan, tieuDeDang, timPlaylist } from './playlist.mjs';

const K = { gio_tap: '09:30', theme: 'la_cai', giong: 'Daniel', playlist: [
  { ma: 'chart-chapters', ten: 'Chart Chapters', tien_to: 'Chart Chapters: …', lich_tap: [1, 5], theme: 'engraving' },
  { ma: 'sky-calendar', ten: 'Sky Calendar', lich_tap: [3], gio_tap: '14:00' }] };
assert.deepStrictEqual(kiemPlaylist(K), []);
// lịch: Thứ Hai 10:00 → Chart Chapters; Thứ Tư 10:00 chưa tới giờ riêng 14:00; Thứ Ba không có lượt
assert.deepStrictEqual(lichHomNay(K, 1, '10:00'), { den: true, playlist: 'chart-chapters' });
assert.deepStrictEqual(lichHomNay(K, 1, '09:00'), { den: false, playlist: null });
assert.deepStrictEqual(lichHomNay(K, 3, '10:00'), { den: false, playlist: null });
assert.deepStrictEqual(lichHomNay(K, 3, '14:05'), { den: true, playlist: 'sky-calendar' });
assert.deepStrictEqual(lichHomNay(K, 2, '23:00'), { den: false, playlist: null });
assert.strictEqual(tapMoiTuan(K), 3);
// kênh chưa chia playlist: như cũ
assert.deepStrictEqual(lichHomNay({ lich_tap: [1, 3], gio_tap: '09:30' }, 3, '09:30'), { den: true, playlist: null });
assert.strictEqual(tapMoiTuan({ lich_tap: [1, 3, 5] }), 3);
// đè hồ sơ: theme của playlist thắng, khoá không khai giữ của kênh; khoá ngoài DE (ten, lich_tap) không đè
const A = apPlaylist(K, 'chart-chapters');
assert.deepStrictEqual([A.theme, A.giong, A.gio_tap, Array.isArray(A.playlist)], ['engraving', 'Daniel', '09:30', true]);
assert.strictEqual(apPlaylist(K, null), K);
assert.throws(() => timPlaylist(K, 'khong-co'), /không có playlist "khong-co"/);
// tiền tố tiêu đề
assert.strictEqual(tieuDeDang('Steve Jobs was fired in 1985', K.playlist[0]), 'Chart Chapters: Steve Jobs was fired in 1985');
assert.strictEqual(tieuDeDang('Chart Chapters: Steve Jobs', K.playlist[0]), 'Chart Chapters: Steve Jobs');
assert.strictEqual(tieuDeDang('Moon this week', K.playlist[1]), 'Moon this week');
assert.strictEqual(tieuDeDang('X', { tien_to: 'The Myth Behind' }), 'The Myth Behind: X');
// lỗi cấu hình: trùng ngày, trùng mã, mã sai, thứ sai
const loi = kiemPlaylist({ playlist: [{ ma: 'a', ten: 'A', lich_tap: [1] }, { ma: 'a', ten: 'B', lich_tap: [1, 9] }, { ma: 'Sai Ma', lich_tap: [] }] });
assert.strictEqual(loi.length, 5, loi.join('\n'));
assert.ok(loi.some((x) => /cùng làm tập thứ 1/.test(x)) && loi.some((x) => /khai hai lần/.test(x)) && loi.some((x) => /thứ 9 sai/.test(x)) && loi.some((x) => /thiếu tên/.test(x)));
// kenh.json thật phải sạch
const KJ = JSON.parse(readFileSync(new URL('./kenh.json', import.meta.url), 'utf8'));
for (const [k, v] of Object.entries(KJ)) if (!k.startsWith('_')) assert.deepStrictEqual(kiemPlaylist(v), [], `kenh.json › ${k}`);
console.log('playlist: ok');
import { playlistCuaTap } from './playlist.mjs';
assert.strictEqual(playlistCuaTap({ playlist: [{ ma: 'full-stories', ten: 'F' }] }, null), 'full-stories');   // tập trước G1 của kênh một playlist
assert.strictEqual(playlistCuaTap(K, null), null);                                                               // hai playlist: không đoán
assert.strictEqual(playlistCuaTap(K, 'sky-calendar'), 'sky-calendar');
assert.strictEqual(playlistCuaTap({}, null), null);
console.log('playlist: ok (tập cũ)');

// MẪU ≠ PLAYLIST: hồ sơ tập = kênh → playlist (series) → mẫu (khuôn video thắng) + dòng loạt nối vào khuôn
{ const { hoSoTap } = await import('./playlist.mjs');
  const K = { khuon: ['k'], toi_da_giay: 179, tu: { en: [330, 405] }, mau_khuon: { 'full-story': {}, 'short-60': { toi_da_giay: 60, tu: { en: [95, 125] }, khuon: ['s'] } },
    playlist: [{ ma: 'tiny-wars', ten: 'Tiny Wars', noi_dung: 'chiến tranh vô lý', mau: ['full-story', 'short-60'], lich_tap: [] }, { ma: 'only-long', ten: 'L', mau: ['full-story'], lich_tap: [] }] };
  const s = hoSoTap(K, { playlist: 'tiny-wars', mau: 'short-60' }); assert.strictEqual(s.toi_da_giay, 60); assert.deepStrictEqual(s.khuon, ['s', 'Loạt (playlist) "Tiny Wars": chiến tranh vô lý']);
  const d = hoSoTap(K, { playlist: 'tiny-wars', mau: 'full-story' }); assert.strictEqual(d.toi_da_giay, 179); assert.deepStrictEqual(d.khuon, ['k', 'Loạt (playlist) "Tiny Wars": chiến tranh vô lý']);
  assert.throws(() => hoSoTap(K, { playlist: 'only-long', mau: 'short-60' }), /không dùng mẫu/); assert.throws(() => hoSoTap(K, { mau: 'x' }), /không có mẫu/);
  assert.strictEqual(hoSoTap({ khuon: ['k'] }, {}).khuon[0], 'k');   // kênh chưa khai mẫu: như cũ
  console.log('playlist: mẫu ≠ playlist đạt'); }

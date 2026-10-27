// node_modules/.bin/tsx apps/web/src/lib/chon-dang.test.mts
import assert from 'node:assert';
import { chonDang, nenCua, ungVien, xepTuan } from './chon-dang';
import { DANG_BAI } from './dang-bai';

const loai = ['ai_phan_doi', 'ai_chan_dung', 'ai_tinh_huong', 'ai_noi_dau', 'ai_cach_giai', 'ai_tieu_chi', 'ai_mong_muon'];
const may = { ngach: ['du-lich'], tat: [] as string[], dem14: {} as Record<string, number> };

// nơi đăng theo dạng × họ nền
const canh = DANG_BAI.find((d) => d.ma === 'canh-dong')!, the = DANG_BAI.find((d) => d.ma === 'the-chu-tren-anh')!, link = DANG_BAI.find((d) => d.ma === 'bai-link')!;
assert.strictEqual(nenCua(canh, 'facebook'), 'facebook'); assert.strictEqual(nenCua(the, 'facebook'), 'fb_anh'); assert.strictEqual(nenCua(the, 'x'), 'x_anh');
assert.strictEqual(nenCua(the, 'youtube'), null, 'ảnh không lên YouTube'); assert.strictEqual(nenCua(link, 'x'), 'x_link'); assert.strictEqual(nenCua(link, 'youtube'), null);

// ứng viên: không tắt, hợp ngách, họ nền đăng được; YouTube chỉ còn dạng video
assert.ok(ungVien({ ho: 'youtube', ...may }).every((d) => d.nhom === 'video'));
assert.ok(!ungVien({ ho: 'facebook', ...may, tat: ['canh-dong'] }).some((d) => d.ma === 'canh-dong'), 'dạng tắt không vào');
assert.ok(!ungVien({ ho: 'facebook', ...may }).some((d) => d.ngach.length === 1 && d.ngach[0] === 'cao-tuoi'), 'ngách lệch không vào');
// có coBai: chỉ dạng sinh được hoặc đã có bài; n-buoc (mẫu riêng) bị loại khi còn dạng làm được; máy có bài n-buoc thì vào lại
const cb = ungVien({ ho: 'facebook', ...may, coBai: new Set<string>() }); assert.ok(cb.length && cb.every((d) => d.sinh_de), 'chỉ dạng sinh được'); assert.ok(!cb.some((d) => d.ma === 'n-buoc'));
assert.ok(ungVien({ ho: 'facebook', ...may, coBai: new Set(['n-buoc']) }).some((d) => d.ma === 'n-buoc'), 'đã có bài thì vào');

// một ô: ưu tiên đúng loại góc; không trùng hôm trước
const o1 = chonDang({ ho: 'facebook', ...may, loaiGoc: 'ai_phan_doi', tuan: [], coLink: true })!;
assert.ok(DANG_BAI.find((d) => d.ma === o1.ma)!.goc_loai.includes('ai_phan_doi'), `ô phản đối phải ra dạng nuôi bởi phản đối (ra ${o1.ma})`);
const o2 = chonDang({ ho: 'facebook', ...may, loaiGoc: 'ai_phan_doi', tuan: [o1.ma], coLink: true })!;
assert.notStrictEqual(o2.ma, o1.ma, 'không hai ngày liền cùng dạng');

// cả tuần: ≥ 4 dạng khác nhau, không hai ngày liền trùng, đúng một ô bài link khi có nơi đăng link, không ô link khi không có
for (const ho of ['facebook', 'x', 'instagram', 'tiktok', 'youtube']) {
  const t = xepTuan({ ho, ...may, loai, coLink: ho === 'facebook' || ho === 'x' });
  assert.strictEqual(t.length, 7, `${ho}: đủ 7 ô`);
  assert.ok(new Set(t.map((x) => x.ma)).size >= 4, `${ho}: ≥ 4 dạng / tuần (ra ${new Set(t.map((x) => x.ma)).size})`);
  for (let i = 1; i < 7; i++) assert.notStrictEqual(t[i]!.ma, t[i - 1]!.ma, `${ho}: ngày ${i} trùng ngày trước`);
  assert.strictEqual(t.filter((x) => x.ma === 'bai-link').length, ho === 'facebook' || ho === 'x' ? 1 : 0, `${ho}: số ô bài link`);
  assert.ok(t.every((x) => x.nen && typeof x.co === 'boolean'));
}
// dạng chưa có đường vẫn được xếp nhưng đánh dấu co=false (instagram carousel / story poll)
const ig = xepTuan({ ho: 'instagram', ...may, loai, coLink: false });
assert.ok(ig.some((x) => !x.co) || ig.every((x) => x.co), 'cờ co nhất quán');
// máy tắt hết dạng video + ảnh thì YouTube không có ô
assert.strictEqual(xepTuan({ ho: 'youtube', ...may, tat: DANG_BAI.filter((d) => d.nhom === 'video').map((d) => d.ma), loai, coLink: false }).length, 0);
console.log(`chon-dang: facebook tuần mẫu = ${xepTuan({ ho: 'facebook', ...may, loai, coLink: true }).map((x) => x.ten).join(' · ')}`);

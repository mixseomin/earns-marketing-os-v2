import assert from 'node:assert';
import { nguyenNhan, tinhSucKhoe, type VaoSuc } from './social-suc-khoe';

const bay = Date.parse('2026-10-20T11:00:00Z');   // 18:00 VN 20/10
const noi = (may: string, nen: string, acct: string | null = null) => ({ may, mayTen: `${may.toUpperCase()} · máy`, nen, nenTen: nen.toUpperCase(), tk: `@${may}`, gio: '20:00', mayMac: 'iMac', acct });
const v: VaoSuc = {
  bay,
  noi: [noi('h', 'youtube'), noi('h', 'x'), noi('b', 'x'), noi('h', 'facebook', '544'), noi('f', 'tiktok'), noi('b', 'facebook')],
  da: [
    { may: 'h', nen: 'youtube', ngay: '2026-10-17', luc: '2026-10-17T13:00:00Z', url: 'https://yt/1' },
    { may: 'b', nen: 'facebook', ngay: '2026-10-20', luc: '2026-10-20T01:00:00Z', url: 'https://fb/1' },
    { may: 'b', nen: 'x', ngay: '2026-10-19', luc: '2026-10-19T01:00:00Z', url: null },
  ],
  hong: [
    { may: 'h', nen: 'youtube', luc: '2026-10-20T01:01:00Z', chu: 'Đăng hỏng: br click Publish: {"ok":false,"chan":"nut-nhay-cam","chu":"Publish"}' },
    { may: 'h', nen: 'x', luc: '2026-10-20T01:02:00Z', chu: 'Đăng hỏng: br goto https://x.com/home: br: TỪ CHỐI mở — URL không có nguồn' },
    { may: 'b', nen: 'x', luc: '2026-10-20T01:03:00Z', chu: 'Đăng hỏng: br goto https://x.com/home: br: TỪ CHỐI mở — URL không có nguồn' },
    { may: 'b', nen: 'x', luc: '2026-10-18T19:00:00Z', chu: 'lỗi cũ trước lần đăng thành công' },
  ],
  canhBao: [{ acct: '544', loai: 'xac_minh', luc: '2026-10-19T01:03:00Z', chu: 'Graph 400: Confirm your identity before you can publish as this Page.' }],
  lich: [{ may: 'b', nen: 'facebook', ngay: '2026-11-08', gio: '20:00' }, { may: 'f', nen: 'tiktok', ngay: '2026-10-20', gio: '20:00' }, { may: 'f', nen: 'tiktok', ngay: '2026-10-23', gio: '20:00' }],
};
const s = tinhSucKhoe(v);
assert.deepEqual(s.ngay, ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']);
const hy = s.dong.find((d) => d.may === 'h' && d.nen === 'youtube')!;
assert.deepEqual(hy.o.map((o) => o.tt), ['da', 'khong', 'khong', 'hong'], 'ô theo ngày: đã đăng / không / hỏng');
assert.equal(hy.o[3]!.loi, 'br chặn bấm nút Publish');
assert.equal(s.dong.find((d) => d.may === 'f')!.o[3]!.tt, 'cho', 'lượt 20:00 hôm nay chưa tới = chờ');
const goto = s.suCo.find((x) => x.tieuDe.includes('URL không có nguồn'))!;
assert.deepEqual(goto.kenh.sort(), ['B · X', 'H · X'], 'cùng nguyên nhân gom một dòng, đủ kênh dính');
assert.ok(s.suCo.some((x) => x.tieuDe.includes('@h') && x.tieuDe.includes('đòi xác minh') && x.tieuDe.includes('26/10')), 'cảnh báo rủi ro → dừng tới +7 ngày');
assert.ok(!s.suCo.some((x) => x.tieuDe.includes('lỗi cũ')), 'lỗi đã có lần đăng thành công sau nó thì không còn là sự cố');
assert.ok(s.suCo.some((x) => x.tieuDe.startsWith('Kho F') && x.tieuDe.includes('23/10')), 'kho ≤ 7 ngày');
assert.ok(!s.suCo.some((x) => x.tieuDe.startsWith('Kho B')), 'kho xa không báo');
assert.equal(s.suCo[0]!.muc, 'bad', 'lỗi đỏ đứng trước cảnh báo vàng');
// fb Hotel: không bài, không lỗi đăng nhưng có cảnh báo tài khoản → không báo thêm "im lặng"
assert.ok(!s.suCo.find((x) => x.tieuDe.startsWith('Không đăng'))?.kenh.includes('H · FACEBOOK'), 'đã có lý do thì không báo im lặng');
assert.equal(nguyenNhan('Đăng hỏng: thứ gì đó lạ | dòng 2').ten, 'thứ gì đó lạ', 'lỗi lạ giữ câu đầu');
assert.equal(nguyenNhan('Đăng hỏng: Command failed: /x/adb -s emulator-5554 shell uiautomator dump').ten, 'Máy ảo không lên / không phản hồi');
assert.equal(nguyenNhan('Đăng hỏng: Command failed: ssh root@h cd /opt && tsx scripts/dang-fb-reel.mts').ten, 'Đăng qua API trên box3 hỏng');
assert.equal(nguyenNhan('Đăng hỏng: Command failed: /Users/htuan/bin/br use 508').ten, 'br không mở được tài khoản');
assert.equal(nguyenNhan('Đăng hỏng: Command failed: /Users/htuan/bin/br eval location.href').ten, 'Trình duyệt (br) lỗi giữa chừng');
assert.equal(nguyenNhan('br click Publish: {"chan":"nut-nhay-cam"}').ten, 'br chặn bấm nút Publish', 'Publish vẫn xếp đúng, không rơi vào nhóm br chung');
const s2 = tinhSucKhoe({ ...v, hong: [...v.hong, { may: 'h', nen: 'facebook', luc: '2026-10-19T01:03:30Z', chu: 'Command failed: ssh x scripts/dang-fb-reel.mts' }] });
assert.ok(!s2.suCo.some((x) => x.tieuDe.startsWith('Đăng qua API')), 'tài khoản đang bị dừng vì cảnh báo: không đẻ thêm dòng lỗi đăng');
console.log('✓ social-suc-khoe: ô 4 ngày · gom sự cố theo nguyên nhân · cảnh báo dừng 7 ngày · lỗi đã khỏi không báo · kho cạn · im lặng');

// node_modules/.bin/tsx apps/web/src/lib/tai-san/video-tinh.test.mts
import assert from 'node:assert';
import { doi, tinhVideo, type DongSo, type VideoSo } from './video-tinh';

  const a = assert;
  const yt = (x: ReturnType<typeof tinhVideo>) => x.nen[0]!;
  const D = (ngay: string, vs: VideoSo[]): DongSo => ({ kenh: 'youtube', sanPham: 'p:x', ngay, videos: vs });
  // video đăng 09/10, đo lần đầu 11/10 = 141 → hôm nay 11/10: cả 141 nằm trong 7 ngày (đăng sau mốc 04/10)
  let r = tinhVideo([D('2026-10-11', [{ slug: 'a', xem: 141, ngayDang: '2026-10-09' }])], '2026-10-11');
  a.equal(yt(r).xem7, 141); a.equal(r.video[0]!.nen.youtube!.xem7, 141); a.equal(r.nen[1]!.xem7, null);   // TikTok chưa đo = null, không 0
  // video cũ (đăng 01/10) mới đo lần đầu → chưa có mốc → null, không ghi bừa
  r = tinhVideo([D('2026-10-11', [{ slug: 'b', xem: 500, ngayDang: '2026-10-01' }])], '2026-10-11');
  a.equal(yt(r).xem7, null); a.equal(yt(r).chuaDo, 1);
  // đủ 14 ngày: 7n = 300−200, trước đó = 200−50 → giảm 33%
  r = tinhVideo([D('2026-09-27', [{ slug: 'c', xem: 50, ngayDang: '2026-09-01' }]), D('2026-10-04', [{ slug: 'c', xem: 200, ngayDang: '2026-09-01' }]), D('2026-10-11', [{ slug: 'c', xem: 300, ngayDang: '2026-09-01' }])], '2026-10-11');
  a.equal(yt(r).xem7, 100); a.equal(yt(r).truoc7, 150); a.equal(doi(yt(r)), -33);
  // vào shop: lấy ở bản ghi MỚI NHẤT (đã là số 7 ngày), cộng các sách; không có = null
  r = tinhVideo([{ ...D('2026-10-10', [{ slug: 'a', xem: 1 }]), vaoShop: 9 }, { ...D('2026-10-11', [{ slug: 'a', xem: 2 }]), vaoShop: 3 }, { ...D('2026-10-11', [{ slug: 'b', xem: 2 }]), sanPham: 'p:y', vaoShop: 1 }], '2026-10-11');
  a.equal(yt(r).vaoShop7, 4); a.equal(r.nen[1]!.vaoShop7, null);
  console.log('video-tinh: 10/10 ok');

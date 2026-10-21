// Tự kiểm luật DC (đề xuất dạng creative theo phim) + GB (giảm bậc) — node_modules/.bin/tsx apps/web/src/lib/ethopex-luat.test.mts
import assert from 'node:assert';
import { chamLuat, deXuatPhim, type CampEtp } from './ethopex-luat';
const z = { chi: 0, thu: 0 };
const camp = (id: number, content_id: number, ten: string, chi: number, thu: number, x: Partial<CampEtp> = {}): CampEtp => ({ id, ten, trang_thai: 'ACTIVE', giao: '', ngan_sach: 1, dong_bo: null, tao: '',
  content_id, creative_id: null, phim: null, ngon_ngu: 'en', studio_phim_id: null, link_phim: null, video: null, anh: null, dang_creative: null, trang_dich: null, fb_ad: null, fb_video: null, loi: null,
  thang: { chi, thu }, hom_nay: z, hom_qua: z, gan: z, truoc: z, ...x });
const ds = deXuatPhim([
  camp(1, 94344, '1910 Number One Nobody EN - canh that', 51, 77), camp(2, 94344, '1910 Number One Nobody EN - ke chuyen', 22, 66),
  camp(3, 9, '1910 Athena EN - canh that', 11.5, 12.1), camp(4, 9, '1910 Athena EN - ke chuyen', 3, 0.6),
  camp(5, 7, '2110ns Mage EN - phim dai 0-100s', 6, 3), camp(6, 8, '2210 New EN - canh cuoi 1-80s', 1, 0),
], []);
const p = (id: number) => ds.find((x) => x.content_id === id)!;
assert.ok(p(94344).thang && /kể chuyện/.test(p(94344).de_xuat[0]!.cau), 'Number One thắng → nhân thêm kể chuyện');
assert.ok(!p(9).thang && p(9).de_xuat.some((x) => /không làm thêm kể chuyện/.test(x.cau)), 'phim test có kể chuyện lỗ → không làm thêm');
assert.ok(p(7).de_xuat.some((x) => /bỏ dạng phim dài/.test(x.cau)), 'phim dài lỗ → bỏ');
assert.ok(/Chưa đủ số/.test(p(8).de_xuat[0]!.cau), 'chi < $5 → chưa đủ số');
const gb = chamLuat(camp(9, 1, 'x EN - canh that', 10, 12, { ngan_sach: 5, hom_qua: { chi: 5, thu: 2 }, gan: { chi: 8, thu: 6 } }), { soCampPhim: 1, phimThang: false }).find((x) => x.ma === 'GB')!;
assert.ok(gb.trang_thai === 'cham' && /\$5 → \$2/.test(gb.cau), 'lỗ nặng −60%, tiêu đủ ngân sách → xuống 2 bậc ($5 → $3 → $2)');
console.log('ethopex-luat: tự kiểm đạt');

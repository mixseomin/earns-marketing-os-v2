// Tự kiểm src/lib/ngan.ts (Node ≥ 22.6 tự bỏ kiểu TS). Exit 1 khi lệch.
import { khoaTuHref, docChong, moKhoa, urlVoiChong } from '../src/lib/ngan.ts';
const a = (c, m) => { if (!c) { console.error('✗ ngan:', m); process.exit(1); } };
a(khoaTuHref('/nhan-su/tam') === 'nhan-su:tam', 'link nhân sự');
a(khoaTuHref('/phong/thu-nghiem') === 'phong:thu-nghiem', 'link phòng');
a(khoaTuHref('/nhat-ky?luot=2026-10-10T15-23-33-941Z') === 'nhat-ky:luot=2026-10-10T15-23-33-941Z', 'nhật ký giữ bộ lọc');
a(khoaTuHref('/luat') === 'luat:' && khoaTuHref('/muc-tieu') === 'muc-tieu:' && khoaTuHref('/quy-trinh') === 'quy-trinh:', 'luật/mục tiêu/quy trình');
a(khoaTuHref('/') === null && khoaTuHref('https://vp.on.tc') === null && khoaTuHref('//x.com/nhan-su/a') === null && khoaTuHref('/api/phien') === null, 'không phải thực thể');
a(JSON.stringify(docChong(['phong:sach', 'xxx:1', 'nhan-su:tam', 'phong:sach'])) === '["phong:sach","nhan-su:tam"]', 'đọc chồng: bỏ khoá lạ + trùng');
a(JSON.stringify(moKhoa(['a:1', 'nhan-su:tam', 'phong:x'].slice(1), 'nhan-su:tam')) === '["phong:x","nhan-su:tam"]', 'mở lại khoá đã có → lên trên cùng');
a(JSON.stringify(moKhoa(['phong:x'], 'nhan-su:loc')) === '["phong:x","nhan-su:loc"]', 'mở mới → chồng thêm');
a(JSON.stringify(moKhoa(['phong:x', 'nhat-ky:'], 'nhat-ky:loai=goi', 1)) === '["phong:x","nhat-ky:loai=goi"]', 'lọc trong ngăn → thay đúng tầng');
a(urlVoiChong('/phong/thu-nghiem', '?ngan=old&x=1', ['nhan-su:tam', 'nhat-ky:luot=A']) === '/phong/thu-nghiem?x=1&ngan=nhan-su%3Atam&ngan=nhat-ky%3Aluot%3DA', 'ghi URL');
a(JSON.stringify(docChong(new URLSearchParams(urlVoiChong('/', '', ['nhan-su:tam', 'nhat-ky:luot=A']).split('?')[1]).getAll('ngan'))) === '["nhan-su:tam","nhat-ky:luot=A"]', 'ghi rồi đọc lại đúng thứ tự');
a(khoaTuHref('/quy-trinh/thu-nghiem/lam-viec') === 'quy-trinh:thu-nghiem/lam-viec' && khoaTuHref('/quy-trinh/a') === null, 'quy trình theo khoá phòng/quy-trình');
console.log('✓ ngan: 12 ca đạt');

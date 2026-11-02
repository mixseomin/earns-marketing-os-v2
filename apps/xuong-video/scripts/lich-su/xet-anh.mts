// NGỌC XÉT ẢNH THẬT CHO CẢNH (02/11/2026, kênh tự động bước 2): lam-tap gọi cho từng ảnh Commons ứng viên trước khi dùng. Chạy trên box3:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/xet-anh.mts <url ảnh> "<tên tệp>" "<mô tả cảnh>" <năm|->
// In JSON { dung, ly_do } — Ngọc không trả lời thì dung = null (lam-tap coi như chưa xét, không dùng ảnh).
import { xetAnhCanh } from '../../../cty/worker/cham-dang.mjs';

const [url, ten, moTa, nam] = process.argv.slice(2);
if (!url || !moTa) { console.error('xet-anh.mts <url> "<tên tệp>" "<mô tả cảnh>" <năm|->'); process.exit(2); }
const [kq] = await xetAnhCanh([{ url, ten, mo_ta: moTa, nam: nam && nam !== '-' ? Number(nam) : null }]);
console.log(JSON.stringify(kq ?? { dung: null, ly_do: 'Ngọc không trả lời' }));
process.exit(0);

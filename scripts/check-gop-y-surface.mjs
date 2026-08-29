#!/usr/bin/env node
/* LUẬT: mọi trường của một tin góp ý phải CÓ CHỖ HIỆN trên drawer.
 *
 * Vì sao có tệp này. 26/08/2026 lời góp ý được dời vào luồng trao đổi, và bản dựng cũ (`draft`,
 * chứa link TRANG BỊ LỖI) tụt xuống một nhánh dự phòng chỉ chạy khi luồng RỖNG. Luồng không bao
 * giờ rỗng — tin gốc luôn là phần tử đầu — nên nhánh ấy chết, và link trang biến mất khỏi mọi
 * card trong ba ngày. Không có gì báo: drawer vẫn đủ chữ, đủ ảnh, chỉ thiếu đúng câu trả lời cho
 * "sửa ở đâu". Người mở card phải tự đoán.
 *
 * Hình dạng lỗi, chứ không phải một dòng code sai: DỮ LIỆU CÓ MÀ KHÔNG CÓ ĐƯỜNG RA MÀN HÌNH.
 * Kiểu không bắt được (thêm trường vào payload vẫn hợp lệ khi không ai render), tsc không bắt,
 * mắt cũng không — vì thiếu một trường thì màn hình vẫn "trông ổn".
 *
 * Nên máy canh: mỗi khoá của `TinTraoDoi` phải xuất hiện dưới dạng `t.<khoá>` trong phần render
 * luồng ở backlinks-page.tsx. Thêm trường mới mà quên hiện → đỏ ngay ở CI, không đợi ba ngày.
 *
 * TẦM VỚI CỦA PHÉP KIỂM NÀY — nói trước để đừng tin quá tay. Nó đọc CHUỖI trong mã nguồn, tức
 * một BẢN ĐẠI DIỆN của "có hiện hay không", không phải chính màn hình. Nó bắt được ca đã xảy ra
 * (xoá chỗ render, hoặc thêm trường mà không render — đã thử ngược, đỏ đúng). Nó KHÔNG bắt được
 * chỗ render còn nguyên nhưng bị vô hiệu hoá bằng một điều kiện luôn sai. Muốn chắc tới mức đó
 * thì phải dựng thật rồi soi màn — đắt hơn nhiều lần thứ nó canh, nên chưa làm.
 */
import { readFileSync } from 'node:fs';

const NGUON = 'apps/web/src/lib/actions/gop-y-mos2.ts';
const MAN = 'apps/web/src/components/backlinks-page.tsx';

const nguon = readFileSync(NGUON, 'utf8');
const man = readFileSync(MAN, 'utf8');

// Khai báo kiểu trải dài nhiều dòng (có chú thích xen giữa) → cắt từ 'TinTraoDoi = {' tới '};'
const khoi = nguon.match(/export type TinTraoDoi = \{([\s\S]*?)\n?\s*\};/);
if (!khoi) {
  console.error(`check-gop-y-surface: không tìm thấy khai báo TinTraoDoi trong ${NGUON}`);
  process.exit(1);
}
// `ten: kieu` — bỏ chú thích /** … */ trước khi bóc khoá, không thì chữ trong chú thích lọt vào.
const khoa = [...khoi[1].replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(\w+)\??\s*:/g)].map((m) => m[1]);
if (khoa.length < 4) {
  console.error(`check-gop-y-surface: bóc được ${khoa.length} khoá — nghi đọc sai khai báo, dừng.`);
  process.exit(1);
}

/* Soi ĐÚNG khối render một tin, không soi cả tệp 3000 dòng: `t.trang` nằm lạc ở chỗ khác vẫn
 * làm phép kiểm xanh trong khi màn hình chẳng hiện gì. Khối = từ `tin.map((t) =>` tới ô soạn
 * reply ngay sau nó. */
const dau = man.indexOf('tin.map((t) =>');
const cuoi = man.indexOf('placeholder="Reply', dau);
if (dau < 0 || cuoi < 0) {
  console.error(`check-gop-y-surface: không khoanh được khối render tin trong ${MAN} (đổi cấu trúc? sửa mốc trong tệp này).`);
  process.exit(1);
}
const khoiRender = man.slice(dau, cuoi);

const thieu = khoa.filter((k) => !khoiRender.includes(`t.${k}`));
if (thieu.length) {
  console.error(`check-gop-y-surface: ${thieu.length} trường của tin góp ý KHÔNG có chỗ hiện trên drawer:`);
  for (const k of thieu) console.error(`  · ${k} — thêm chỗ render trong ${MAN} (khối 💬 Trao đổi)`);
  console.error('  Dữ liệu có mà không có đường ra màn hình = mất im lặng, đúng ca link trang bị lỗi 26–29/08/2026.');
  process.exit(1);
}

/* Đường hiện THỨ HAI cho cùng nội dung là cái bẫy gốc: nó gần như không chạy nên ruỗng dần mà
 * không ai thấy. Bỏ rồi thì canh để đừng mọc lại. */
// Bỏ chú thích trước khi soi: phần kể lại vụ 26–29/08 có nhắc tên `phao`, và đó là tài liệu
// chứ không phải đường hiện thứ hai sống lại.
const manCode = man.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
if (/\bphao\b/.test(manCode)) {
  console.error('check-gop-y-surface: `phao` (bản dựng dự phòng chỉ hiện khi luồng rỗng) đã quay lại.');
  console.error('  Một nội dung một đường hiện. Thiếu dữ liệu thì phải thiếu ở chỗ nhìn thấy.');
  process.exit(1);
}

console.log(`check-gop-y-surface: ${khoa.length} trường tin góp ý đều có chỗ hiện ✓`);

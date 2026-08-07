// Kiểm hàm cắt văn xuôi của Steps (backlinks-page.tsx). Chạy: node prose-segment.check.mjs
// Repo chưa có test runner nên để dạng script chạy thẳng — chỉ cần một thứ gãy khi regex sai.
// Giữ regex ĐỒNG BỘ với segmentProse trong backlinks-page.tsx.
const segmentProse = (s) => s
  .split(/(?<=[^\d\s][.;!?])\s+(?=[\p{Lu}\p{Extended_Pictographic}0-9])|\s+·\s+/su)
  .map((x) => x.trim()).filter(Boolean);

const eq = (got, want, msg) => {
  if (got !== want) { console.error(`FAIL ${msg}: được ${got}, cần ${want}`); process.exitCode = 1; }
  else console.log(`OK   ${msg}`);
};

// Chuỗi thật đã đổ ra thành một tảng chữ trong drawer (task #397, 2026-08-08).
const real = 'Tên sản phẩm đã in sẵn cạnh ảnh ở cỡ đầy đủ — lặp lại trong thumbnail là phí mặt tiền duy nhất có. '
  + 'Copy mới: Playbook KEEP/YOUR PAY · Cheatsheets STOP/GOOGLING · AI Toolkit FIRST-TRY/PROMPTS · ImageCrate IMAGES/THAT RANK. '
  + 'Bậc free xám trung tính, bậc trả phí màu đậm. Đẩy đủ 10 sản phẩm, duyệt ở cỡ 48px thật.';
eq(segmentProse(real).length, 7, 'khối văn xuôi thật cắt ra nhiều ý');
eq(segmentProse('một câu duy nhất không có gì').length, 1, 'câu đơn giữ nguyên');
eq(segmentProse('Bước 1. Vào trang. Bước 2. Bấm nút.').length, 2, 'số thứ tự dính với nội dung bước');
eq(segmentProse('Giá 3.5 triệu, giảm còn 2.9 triệu').length, 1, 'không cắt giữa số thập phân');
eq(segmentProse('A · B · C').length, 3, 'cắt theo dấu ·');
eq(segmentProse('Xong. 🔗 Dán link vào ô Live URL.').length, 2, 'cắt trước dòng meta emoji');
if (!process.exitCode) console.log('ALL PASS');

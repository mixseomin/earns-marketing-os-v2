// Chuẩn hoá CÁCH VIẾT của commission_rate — không đổi giá trị, chỉ đổi chính tả.
//
// Mỗi network viết cùng một con số một kiểu vì dấu thập phân theo locale của họ:
//   "4,9%" (adpia) · "4.9 %" (vcommission) · "4.9%" (2.773 dòng — đa số áp đảo, nên đây là chuẩn)
// Ba cách viết một con số thì cột % không quét bằng mắt được.
//
// Phẩy KHÔNG phải lúc nào cũng là dấu thập phân. Dữ liệu thật có cả "105,000" và "10,500 VND" —
// đó là dấu HÀNG NGHÌN. Đổi bừa `,`→`.` là nhân sai 1000 lần, đúng lớp lỗi "CZK 100 = $100" đã
// dính một lần ở cột AOV. Phân biệt bằng số chữ số theo sau: 1-2 chữ số rồi hết = thập phân,
// đúng 3 chữ số = hàng nghìn (giữ nguyên).
//
// Nằm riêng khỏi actions/offers.ts vì file đó là 'use server' (chỉ export được hàm async).

export function normRate(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw
    .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2')   // phẩy thập phân → chấm
    .replace(/\s+%/g, '%')                        // "70 %" → "70%"
    .trim();
  return s || null;
}

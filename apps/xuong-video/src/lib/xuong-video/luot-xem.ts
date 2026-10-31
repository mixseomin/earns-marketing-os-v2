// LƯỢT XEM THẬT của video đã đăng (anh 31/10/2026: "các video dạng game mini như front porch cũng khá hiệu quả" — duyệt dùng video THẮNG của chính kênh
// làm hook đã chứng minh, cạnh QC spy). Đọc số công khai trên trang YouTube Shorts (box3 đọc được, không cần khoá API). Không đọc được → null, không đoán.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/** Số trong `"viewCount":"1234"` đầu tiên của trang (lượt xem của chính video đó). Thuần. */
export const docLuotXem = (html: string): number | null => { const m = html.match(/"viewCount":"(\d+)"/); return m ? Number(m[1]) : null; };

export async function luotXemYoutube(url: string): Promise<number | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(20_000) });
    return r.ok ? docLuotXem(await r.text()) : null;
  } catch { return null; }
}

/** Ngưỡng "video thắng": ≥ 500 lượt xem sau ≥ 7 ngày (kênh mới — Front Porch trung bình ~650, cao nhất 1.209, đo 31/10/2026). */
export const THANG_LUOT_XEM = 500, THANG_SAU_NGAY = 7;

if (process.argv[1]?.endsWith('luot-xem.ts') && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  t.equal(docLuotXem('x "viewCount":"1209" y "viewCount":"5"'), 1209, 'lấy số đầu tiên');
  t.equal(docLuotXem('không có số'), null, 'không có thì null, không đoán 0');
  console.log('luot-xem: 2 ca đạt');
}

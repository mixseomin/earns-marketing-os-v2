// DANH SÁCH NGƯỜI BÁN CKEY SỐNG — của Phòng Tài nguyên, không phải của studio (anh 31/10/2026: "chuỗi fallback này có 1 thằng bên phòng Tài nguyên lo").
// spy-on-tc/scripts/bao-tri-ckey.mjs (spy-bao-tri-ckey.timer trên box3, 6 giờ: đọc danh mục + gọi thử + tỉ lệ đạt) ghi /var/lib/spy/ckey-tuyen.json,
// Nguyên canh trong nhịp kiem-tai-nguyen. Studio CHỈ ĐỌC: thêm model mới vào chuỗi = thêm một dòng DONG trong bao-tri-ckey.mjs, không viết bảng tay ở đây.
import 'server-only';
import { readFileSync } from 'node:fs';

const TEP = '/var/lib/spy/ckey-tuyen.json';
/** model studio gọi ↔ khoá dòng trong tệp (trùng DONG của bao-tri-ckey.mjs). */
const DONG: [RegExp, string][] = [[/^claude-haiku-5[-.]5$/i, 'haiku'], [/^claude-sonnet-5[-.]5$/i, 'sonnet'], [/^claude-opus-5[-.]5$/i, 'opus'], [/^gemini-3[-.]8-flash$/i, 'gemini-3.8-flash']];
let kho: { luc: number; dong: Record<string, string[]> } | null = null;

/** Người bán ckey đã xếp (sống, đạt cao, rẻ trước) cho một model — tên trần không tiền tố 'ckey:'. Tệp thiếu / hỏng / model không có dòng → []. */
export function nguoiBanTuyen(model: string): string[] {
  if (!kho || Date.now() - kho.luc > 600_000) {
    try { kho = { luc: Date.now(), dong: (JSON.parse(readFileSync(TEP, 'utf8')) as { dong?: Record<string, string[]> }).dong ?? {} }; }
    catch { kho = { luc: Date.now(), dong: {} }; }
  }
  const k = DONG.find(([rx]) => rx.test(model))?.[1];
  return k ? (kho.dong[k] ?? []).map((x) => x.replace(/^ckey:/, '')) : [];
}

// CHẠY CLAUDE KHÔNG GIAO DIỆN + BÁO LỖI API (anh 13/11/2026: "nếu lỗi API thì phải báo trên Tele ở 1 topic riêng — kiểu lỗi cần tao phải đăng nhập lại").
// Mọi kỹ sư iMac gọi chayClaude(CLAUDE, args, opts) thay spawnSync: chạy y như cũ, rồi đọc kết quả — lỗi API / đăng nhập / hạn mức → chủ đề 🚨 Lỗi API
// (box3 tho-may-viec.mjs --loi-api, mỗi khoá ≤ 1 tin / giờ). Thành (~/bin/thanh/chay.mjs, phiên tmux) dùng cùng phanLoai qua bản chép của anh ở ~/bin.
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';

const BOX = 'root@167.233.241.16', APP = '/opt/earns-marketing-os-v2/apps/cty';
const DANG_NHAP = /Please run \/login|Invalid API key|OAuth token (has )?expired|authentication_error|Invalid bearer token|not logged in|\b401\b/i;
const HAN_MUC = /usage limit|limit reached|credit balance|rate.?limit|\b429\b|quota/i;
const MAY_CHU = /API Error|overloaded|\b5\d\d\b.*error|Server error|ECONNRESET|ETIMEDOUT|socket hang up/i;

/** Thuần: chữ lỗi → { loai, can } hoặc null. loai: dang-nhap | han-muc | may-chu. can = việc anh phải làm (null = máy tự thử lại được). */
export function phanLoai(chu) {
  const s = String(chu ?? '');
  if (DANG_NHAP.test(s)) return { loai: 'dang-nhap', can: 'Claude trên iMac mất đăng nhập. Cách duy nhất: anh mở Terminal trên iMac, chạy claude rồi /login (đăng nhập qua trình duyệt, máy không tự làm được).' };
  if (HAN_MUC.test(s)) return { loai: 'han-muc', can: 'Gói Claude chạm hạn mức: các kỹ sư đứng tới khi hạn mức mở lại.' };
  if (MAY_CHU.test(s)) return { loai: 'may-chu', can: null };
  return null;
}
/** Kết quả spawnSync của claude -p --output-format json → chữ lỗi (rỗng khi chạy được). */
export function chuLoi(r) {
  let j = null; try { j = JSON.parse(String(r.stdout ?? '').trim()); } catch { /* không phải JSON */ }
  if (j && !j.is_error) return '';
  if (j?.is_error) return String(j.result ?? j.subtype ?? 'is_error');
  if (r.error) return r.error.message;
  return r.status ? `${String(r.stderr ?? '').trim()} ${String(r.stdout ?? '').trim()}`.trim().slice(0, 800) || `thoát mã ${r.status}` : '';
}
export function baoLoiApi(khoa, than) {
  try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', BOX, `cd ${APP} && CTY_DATA_DIR=/var/lib/cty node worker/tho-may-viec.mjs --loi-api ${khoa}`], { input: than, encoding: 'utf8', timeout: 60000 }).trim(); } catch (e) { console.error(`báo lỗi API hỏng: ${e.message.split('\n')[0]}`); return 'loi'; }
}
/** spawnSync(claude, …) + báo lỗi API. Lỗi máy chủ thoáng qua chỉ báo khi lượt hỏng hẳn (không có kết quả); đăng nhập / hạn mức báo luôn. */
export function chayClaude(cmd, args, opts) {
  const r = spawnSync(cmd, args, opts), chu = chuLoi(r), pl = chu && phanLoai(chu);
  if (pl) {
    const nguoi = path.basename(process.argv[1] ?? 'may', '.mjs');
    console.error(`lỗi API (${pl.loai}): ${chu.slice(0, 300)}`);
    baoLoiApi(`${nguoi}:${pl.loai}`, `${nguoi} (iMac) chạy Claude lỗi ${pl.loai}: ${chu.slice(0, 600)}${pl.can ? `\n${pl.can}` : '\nLượt này hỏng, lượt kế máy tự chạy lại.'}`);
  }
  return r;
}

if (process.argv[1] === new URL(import.meta.url).pathname && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  t.equal(phanLoai('Invalid API key · Please run /login').loai, 'dang-nhap'); t.equal(phanLoai('OAuth token has expired').loai, 'dang-nhap');
  t.equal(phanLoai('Claude AI usage limit reached|1731500000').loai, 'han-muc'); t.equal(phanLoai('API Error: Server error mid-response').loai, 'may-chu');
  t.equal(phanLoai('đã sửa xong, KET: DA_SUA'), null, 'chữ thường không phải lỗi');
  t.equal(chuLoi({ status: 0, stdout: '{"type":"result","is_error":false,"result":"ok"}' }), '');
  t.equal(chuLoi({ status: 1, stdout: '{"type":"result","is_error":true,"result":"Invalid API key · Please run /login"}' }), 'Invalid API key · Please run /login');
  t.equal(chuLoi({ status: 1, stdout: '', stderr: 'Error: socket hang up' }), 'Error: socket hang up'); t.equal(chuLoi({ status: 0, stdout: 'không json' }), '');
  console.log('claude-chay: tự kiểm đạt');
}

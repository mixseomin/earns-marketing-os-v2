// TỰ HỌC CHUẨN CHO MỌI CLI CỦA CTY (anh 16/11/2026: "cơ chế tự học, tự nâng cấp này phải làm chuẩn hoá cho các model CLI của cty").
// Gắn ở HAI CỬA chạy Claude của kỹ sư iMac — may/claude-chay.mjs (chayClaude) và may/claude-tmux.mjs (chayTmux) — nên mọi kỹ sư có ngay, không ai
// tự nối. Sổ là lớp kinh nghiệm sẵn có (worker/kinh-nghiem.mjs, <DATA>/kinh-nghiem/<người>.json trên box3) — cùng sổ nhân sự gọi API đang dùng:
//   1. TRƯỚC lượt: nạp ≤ 5 bài học của chính người đó (kỹ năng trước, bài mới sau) vào cuối lời giao + dặn cách ghi bài học mới.
//   2. SAU lượt: dòng `BÀI HỌC: …` trong câu trả lời cuối → bài mới của người đó (trùng ý bài cũ thì cộng nguồn); bài đã nạp được tính một lần
//      áp dụng, lượt chạy được (không lỗi) tính đạt → lên kỹ năng / phai theo ngưỡng chung (NGUONG trong kinh-nghiem.mjs).
// Hỏng (box3 không với tới, sổ lỗi) thì lượt vẫn chạy y như cũ — học là phần thêm, không được chặn việc chính.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const BOX = 'root@167.233.241.16', APP = '/opt/earns-marketing-os-v2/apps/cty';
/** Tệp máy → nhân sự (id thư mục cong-ty/nhan-su). Kỹ sư mới: thêm một dòng ở đây (tu-kiem cty soát mọi tệp gọi chayClaude đều có tên). */
export const NGUOI_CUA = { 'etp-sua': 'huy', 'social-sua': 'khang', 'tho-may': 'manh', 'tai-nguyen-sua': 'tai', 'van-thu': 'van', 'long-sua-bai': 'long',
  'sach-sua': 'thao', 'mos2-gop-y': 'dat', 'spy-gop-y': 'hieu', 'studio-gop-y': 'vinh' };
export const KHOA = 'cli/lam-viec';
const may = () => path.basename(process.argv[1] ?? '', '.mjs');
export const nguoiLuot = (opts = {}) => opts.nguoi ?? NGUOI_CUA[opts.ten] ?? (Object.values(NGUOI_CUA).includes(opts.ten) ? opts.ten : null) ?? NGUOI_CUA[may()] ?? null;
const box = (lenh, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', BOX, `cd ${APP} && CTY_DATA_DIR=/var/lib/cty node worker/kinh-nghiem.mjs ${lenh}`], { input, encoding: 'utf8', timeout: 30000 }).trim();

export const DAN = '\n\nTỰ HỌC: nếu lượt này có điều đáng nhớ cho lần sau — anh sửa / trả lại việc, con đoán sai, gặp bẫy của máy hay của repo — thì ở CUỐI câu trả lời '
  + 'thêm tối đa 2 dòng dạng `BÀI HỌC: <một câu cụ thể: tình huống → làm gì, có tên tệp / lệnh>`. Không có gì mới thì không ghi. Không ghi điều chung chung.';
/** Thuần: chữ trả lời → các bài học (≤ 2, mỗi bài ≤ 220 ký tự, bỏ dòng rỗng / chung chung quá ngắn). */
export const tachBaiHoc = (chu) => [...String(chu ?? '').matchAll(/^[\s>*`-]*BÀI HỌC\s*:\s*(.+)$/gim)].map((m) => m[1].replace(/[`*]+$/g, '').trim()).filter((s) => s.length >= 25).slice(0, 2).map((s) => s.slice(0, 220));
/** Thuần: chèn khối kinh nghiệm + lời dặn vào lời giao (đối số sau '-p'). Trả bản sao args. */
export function chenLoiGiao(args, khoi) {
  const a = [...args], i = a.indexOf('-p'); if (i < 0 || typeof a[i + 1] !== 'string') return a;
  a[i + 1] = `${a[i + 1]}${khoi}${DAN}`; return a;
}

/** Trước lượt: → { args, nguoi, ma[] }. */
export function truocLuot(args, opts = {}) {
  const nguoi = nguoiLuot(opts); if (!nguoi) return { args, nguoi: null, ma: [] };
  let n = { chu: '', ma: [] }; try { n = JSON.parse(box(`--nap ${nguoi} ${KHOA}`)); } catch (e) { console.error(`tự học: chưa nạp được kinh nghiệm của ${nguoi}: ${String(e.message).split('\n')[0]}`); }
  return { args: chenLoiGiao(args, n.chu), nguoi, ma: n.ma ?? [] };
}
/** Sau lượt: ghi bài học mới + đếm áp dụng. chu = câu trả lời cuối, dat = lượt chạy được. */
export function sauLuot(h, chu, dat) {
  if (!h?.nguoi) return null;
  const bai = tachBaiHoc(chu); if (!bai.length && !h.ma.length) return null;
  try { const r = box(`--hoc ${h.nguoi} ${KHOA}`, JSON.stringify({ bai, ma: h.ma, dat: !!dat, may: may() })); if (bai.length) console.log(`tự học ${h.nguoi}: ${r}`); return r; }
  catch (e) { console.error(`tự học: chưa ghi được bài học của ${h.nguoi}: ${String(e.message).split('\n')[0]}`); return null; }
}
/** Câu trả lời cuối trong stdout JSON của claude -p / chayTmux. */
export const chuTraLoi = (r) => { try { return String(JSON.parse(String(r?.stdout ?? '').trim()).result ?? ''); } catch { return String(r?.stdout ?? ''); } };

if (process.argv[1] === new URL(import.meta.url).pathname && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  t.deepEqual(tachBaiHoc('xong.\nBÀI HỌC: cây chính iMac lệch main — chạy từ ~/may-ky-su/<người> chứ không từ ~/Me/GitHub\n**BÀI HỌC:** ngắn\n- BÀI HỌC: gop-y.sh submit phải kèm GOPY_PROJECT=etp nếu card etp'),
    ['cây chính iMac lệch main — chạy từ ~/may-ky-su/<người> chứ không từ ~/Me/GitHub', 'gop-y.sh submit phải kèm GOPY_PROJECT=etp nếu card etp'], 'tách bài học, bỏ dòng quá ngắn');
  t.deepEqual(tachBaiHoc('không có gì'), []);
  const a = chenLoiGiao(['-p', 'LÀM X', '--model', 'opus'], '\n\nKINH NGHIỆM: - a');
  t.ok(a[1].startsWith('LÀM X\n\nKINH NGHIỆM: - a') && a[1].includes('BÀI HỌC:') && a[2] === '--model', 'chèn vào đúng lời giao, không đụng đối số khác');
  t.deepEqual(chenLoiGiao(['--x'], 'k'), ['--x'], 'không có -p thì để nguyên');
  t.equal(nguoiLuot({ ten: 'hieu' }), 'hieu'); t.equal(nguoiLuot({ nguoi: 'dat' }), 'dat'); t.equal(nguoiLuot({ ten: 'spy-gop-y' }), 'hieu');
  t.equal(chuTraLoi({ stdout: '{"result":"BÀI HỌC: x"}' }), 'BÀI HỌC: x');
  t.equal(sauLuot({ nguoi: null }, 'BÀI HỌC: …', true), null, 'không rõ người thì không ghi');
  console.log('✓ tu-hoc: tách bài học, chèn lời giao, ánh xạ người');
}

// CHẤM LẠI TOÀN STUDIO KHI LUẬT ĐỔI (anh 16/11/2026: "mỗi lần luật thay đổi mày phải tự chấm lại toàn các shot xem luật mới thay đổi thế nào với các shot đó — không vá
// đầu hở đuôi"). Chạy MỌI shot của MỌI tập qua bộ cổng máy quay (cỡ / máy một nguồn, động cơ máy + nhịp hình, ngữ pháp máy theo nhịp kịch) bằng HAI bản luật — bản cũ
// (một commit / thư mục lib khác) và bản đang có — rồi in shot nào ĐỔI kết quả: mới đỏ (luật mới bắt thêm — đúng hay bắt oan?) và hết đỏ (luật mới bỏ — đúng hay lọt?).
// Mỗi lần sửa luật: chạy lệnh này, đọc từng dòng đổi, ca bắt oan / lọt → sửa luật + thêm bài kiểm, chạy lại tới khi mọi dòng đổi đều đúng ý.
//   1) dữ liệu (box3, chỉ đọc):  apps/xuong-video/scripts/cham-lai-luat.mts --dump=<tệp.json>   (chạy trên box3, có DATABASE_URL)
//   2) so (iMac):  node_modules/.bin/tsx apps/xuong-video/scripts/cham-lai-luat.mts --du-lieu=<tệp.json> --cu=<commit> [--chi=phim|qc] [--het]
//      --cu=<commit>: dựng bản lib của commit đó vào thư mục tạm (git worktree, tự gỡ) rồi chấm bằng nó; --lib-cu=<thư mục lib> nếu đã có sẵn.
//      --het: in mọi dòng (mặc định 40 dòng / nhóm); --chi=phim: bỏ quảng cáo / video máy dựng; --sua-thu: thử bộ sửa 0đ của nút 🎥 trên bản sao, in lỗi nút không gỡ được.
// Máy quay MỌI luật trong ba nhóm là hàm THUẦN — bản cũ thiếu hàm nào thì coi như luật đó chưa có (không lỗi).
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const co = (k: string) => process.argv.includes(`--${k}`);
const REPO = resolve(new URL('.', import.meta.url).pathname, '../../..');
const LIB = join(REPO, 'apps/xuong-video/src/lib/xuong-video');

if (arg('dump')) {
  const { sql } = await import('drizzle-orm'); const { getDb } = await import('@mos2/db');
  const r = await getDb()!.execute(sql`SELECT c.id, c.tap_id, c.thu_tu::float AS thu_tu, p.id AS phim, p.loai, coalesce(p.kinh_thanh->>'the_loai', '') AS the_loai, c.ky_thuat, c.dan_dung,
    c.bieu_cam, c.may_3d, c.phan_doan, c.phat_s, c.thoi_luong_s, c.hanh_dong FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id JOIN xv_phim p ON p.id = t.phim_id
    WHERE coalesce(c.nhanh, '') IN ('', 'A') ORDER BY c.tap_id, c.thu_tu, c.id`);
  writeFileSync(arg('dump')!, JSON.stringify(r)); console.log(`ghi ${(r as unknown[]).length} shot → ${arg('dump')}`); process.exit(0);
}

type Shot = Record<string, any>;
/** Lỗi máy quay của mọi tập theo MỘT bản luật (thư mục lib). Khoá = "tập|shot|nội dung đã bỏ số đo" để luật đổi câu chữ / số cm không thành "đổi kết quả". */
async function cham(lib: string, ds: Shot[]): Promise<Map<string, string>> {
  const m = async (f: string) => { try { return await import(join(lib, f)); } catch { return {}; } };
  const cg = await m('chan-gui-video.ts'), nh = await m('nhip-hinh.ts'), np = await m('ngu-phap-may.ts'), bs = await m('bo-set-3d.ts');
  const out = new Map<string, string>(); const tap = new Map<number, Shot[]>();
  for (const c of ds) (tap.get(c.tap_id) ?? tap.set(c.tap_id, []).get(c.tap_id)!).push(c);
  for (const [id, cs] of tap) {
    const p = cs[0]!; const ghi = (so: string, l: string) => out.set(`${id}|${so}|${l.replace(/\d+(?:[.,]\d+)?\s*(?:cm|s|%)/g, 'N').replace(/\s+/g, ' ').slice(0, 90)}`, `phim ${p.phim} (${p.loai}/${p.the_loai || '-'}) tập ${id} ${l}`);
    const so = (l: string) => l.match(/#(\d+)/)?.[1] ?? '?';
    // phạm vi THẬT của cổng cỡ / máy: phim truyện ở cổng tiền kỳ (quy-trinh.ts) + mọi lượt gửi Seedance (thu-seedance-*.mts); đường sinh QC chính (sinh-video.ts) không gọi
    const qc = p.loai === 'quang_cao' || p.loai === 'may_dung';
    if (cg.loiCoMay && cg.shotCoMay) for (const l of cg.loiCoMay(cs.map((c) => cg.shotCoMay(c)))) ghi(so(l), `[cỡ/máy${qc ? ' — QC: chỉ chặn lượt gửi Seedance, đường QC chính không chặn' : ''}] ${l}`);
    if (cg.loiLapHanhDong && cg.shotHanhDong && !qc) for (const l of cg.loiLapHanhDong(cs.map((c) => cg.shotHanhDong(c)))) ghi(so(l), `[lặp hành động] ${l}`);
    const chu = (c: Shot) => (c.may_3d && bs.chuThe ? bs.chuThe(c.may_3d) : null);
    const base = cs.map((c, i) => ({ ...c, giay: c.phat_s > 0 ? c.phat_s : c.thoi_luong_s, chu: chu(c), di_cm: c.may_3d && np.diCm ? np.diCm(c.may_3d.vi_tri) : 0, cuoi: false, thu_tu: c.thu_tu ?? i + 1 }));
    const dc = np.dongCoMay ? np.dongCoMay(base) : base;
    if (nh.kiemNhipHinh) for (const l of nh.kiemNhipHinh(dc)) ghi(so(l), `[nhịp hình] ${l}`);
    if (np.kiemNguPhapMay) for (const l of np.kiemNguPhapMay(dc, p.the_loai)) ghi(so(l), `[ngữ pháp] ${l}`);
  }
  return out;
}

const ds: Shot[] = JSON.parse(readFileSync(arg('du-lieu') ?? (() => { throw new Error('cần --du-lieu=<tệp.json> (tạo bằng --dump trên box3)'); })(), 'utf8'))
  .filter((c: Shot) => !(arg('chi') === 'phim' && (c.loai === 'quang_cao' || c.loai === 'may_dung')) && !(arg('chi') === 'qc' && c.loai !== 'quang_cao'));
let libCu = arg('lib-cu'); let go: (() => void) | null = null;
if (!libCu && arg('cu')) {
  const wt = mkdtempSync(join(tmpdir(), 'luat-cu-')); execSync(`git -C ${REPO} worktree add --detach ${wt} ${arg('cu')} -q`, { stdio: 'ignore' });
  libCu = join(wt, 'apps/xuong-video/src/lib/xuong-video'); go = () => execSync(`git -C ${REPO} worktree remove --force ${wt}`, { stdio: 'ignore' });
}
try {
  const moi = await cham(LIB, ds); const cu = libCu ? await cham(libCu, ds) : new Map<string, string>();
  const them = [...moi].filter(([k]) => !cu.has(k)), bo = [...cu].filter(([k]) => !moi.has(k));
  const nhom = (xs: [string, string][]) => { const g = new Map<string, string[]>(); for (const [, v] of xs) { const k = v.match(/^phim \d+ \(([^)]+)\)/)![1]!; (g.get(k) ?? g.set(k, []).get(k)!).push(v); } return g; };
  console.log(`${ds.length} shot · luật mới ${moi.size} lỗi · luật cũ${libCu ? '' : ' (không có — chỉ in hiện trạng)'} ${cu.size} lỗi · MỚI ĐỎ ${them.length} · HẾT ĐỎ ${bo.length}`);
  for (const [ten, xs] of [['MỚI ĐỎ (luật mới bắt thêm — soát: đúng hay bắt oan?)', them], ['HẾT ĐỎ (luật mới bỏ — soát: đúng hay để lọt?)', bo]] as const) {
    if (!xs.length) continue; console.log(`\n== ${ten}`);
    for (const [k, v] of nhom(xs as [string, string][])) { console.log(`  -- ${k}: ${v.length}`); for (const l of co('het') ? v : v.slice(0, 40)) console.log(`     ${l.slice(0, 260)}`); if (!co('het') && v.length > 40) console.log(`     … còn ${v.length - 40} (--het)`); }
  }
  // CỔNG CÓ CÁCH GỠ KHÔNG (--sua-thu): chạy bộ sửa 0đ của nút 🎥 (ngữ pháp máy rồi nhịp hình — hau-ky.ts › daDangMayTapDb) trên bản sao dữ liệu, chấm lại: lỗi máy quay
  // còn đỏ sau khi sửa = cổng chặn mà nút không gỡ được (phải sửa tay / sửa luật). Không ghi gì vào DB.
  if (co('sua-thu')) {
    const nh = await import(join(LIB, 'nhip-hinh.ts')), np = await import(join(LIB, 'ngu-phap-may.ts')), bs = await import(join(LIB, 'bo-set-3d.ts'));
    const tap = new Map<number, Shot[]>(); for (const c of ds) (tap.get(c.tap_id) ?? tap.set(c.tap_id, []).get(c.tap_id)!).push(c);
    const sau: Shot[] = [];
    for (const cs of tap.values()) { const tl = cs[0]!.the_loai;
      const mk = (xs: Shot[]) => np.dongCoMay(xs.map((c, i) => ({ ...c, giay: c.phat_s > 0 ? c.phat_s : c.thoi_luong_s, chu: c.may_3d ? bs.chuThe(c.may_3d) : null, di_cm: c.may_3d ? np.diCm(c.may_3d.vi_tri) : 0, cuoi: false, thu_tu: c.thu_tu ?? i + 1 })));
      let xs = cs.map((c) => ({ ...c, ky_thuat: { ...(c.ky_thuat ?? {}) } }));
      for (const x of np.apNguPhapMay(mk(xs), tl)) xs.find((c) => c.id === x.id)!.ky_thuat = x.ky_thuat;
      for (const x of nh.daDangMay(mk(xs))) xs.find((c) => c.id === x.id)!.ky_thuat = x.ky_thuat;
      sau.push(...xs); }
    const con = [...(await cham(LIB, sau)).values()].filter((l) => !/\[cỡ\/máy\]/.test(l));
    console.log(`\n== SAU KHI BẤM 🎥 (thử, không ghi): còn ${con.length} lỗi máy quay nút không gỡ được (lỗi cỡ/máy là chữ thẻ shot — sửa thẻ, không qua nút)`);
    for (const l of con.slice(0, co('het') ? 9999 : 40)) console.log(`     ${l.slice(0, 240)}`);
  }
} finally { go?.(); }
process.exit(0);

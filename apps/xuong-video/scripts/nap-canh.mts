// Nạp bảng shot viết sẵn (JSON, cùng dạng kết quả "tách cảnh" của Claude) vào một tập — 0đ, không gọi model nào.
// Dùng khi kịch bản đã viết tay / viết ngoài studio: đi CÙNG đường lưu với nút ✂ Tách cảnh (luuCanhTach), nên shot nháp cũ vào thùng rác như thường.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/nap-canh.mts --tap=<id> --tep=mau/<ten>-canh.json
// Tệp: { "tomTat": "", "beats": [{ ten, mo_ta, cam_xuc }], "phanCanh": [{ ten, beat, muc_tieu, xung_dot, an_y, nhip, cam_xuc_dau, cam_xuc_cuoi }] (BẮT BUỘC), "canh": [ { canh, goc_may, hanh_dong, loi_thoai, am_thanh, thoi_luong_s, phat_s, nhan_vat: [tên anchor],
//         bien_the: [], prompt_anh, prompt_video, phan_doan, cam_xuc, ky_thuat: {}, trang_phuc, chu_man, thoai: [{ nhan_vat, dien_xuat, loi }] } ] }
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { luuCanhTach } from '../src/lib/xuong-video/luu-canh';
import { kemBienThe, mapNhanVat, type Row } from '../src/lib/xuong-video/doc-db';
import { thieuPhanCanh } from '../src/lib/xuong-video/phu-thuoc';

const gia = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? '';
const tapId = Number(gia('tap')); const tep = gia('tep');
/** --thay: thay TOÀN BỘ shot của tập (kể cả shot đã có keyframe/clip) — shot cũ vào thùng rác, khôi phục được. Không có cờ: như ✂ Tách cảnh (chỉ thay shot nháp). */
const thay = process.argv.includes('--thay');
/** --chen=<tên phân cảnh>[,<tên>…] --truoc=<thứ tự>: CHỈ chèn shot của các phân cảnh đó vào trước shot thứ tự <truoc>, giữ nguyên mọi shot đã có
 *  (keyframe, clip); phân cảnh / beats / hồ sơ của tập vẫn lấy bản đầy đủ trong tệp. Dùng khi thêm cảnh vào tập đã sinh hình. */
const chen = gia('chen') ? gia('chen').split(',').map((x) => x.trim()) : null; const truoc = Number(gia('truoc') || 0);
if (!tapId || !tep) { console.error('thiếu --tap=<id> --tep=<json>'); process.exit(1); }
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const tho = JSON.parse(readFileSync(tep, 'utf8'));
const kq = { ok: true as const, tomTat: '', beats: [], phanCanh: [], ...tho, hoSo: tho.ho_so };
/** --kb=<md>: thay luôn chữ KỊCH BẢN của tập (hồ sơ viết tay: scripts/kich-ban-the.mts ra kèm .md). */
const kbMd = gia('kb');
// Luật 12/10/2026: phải có phân cảnh cụ thể trước khi sinh keyframe — tệp thiếu phanCanh / shot lạc phân cảnh thì không nạp.
const lacPc = kq.canh.map((c: { phan_doan: string; canh: string }, i: number) => { const l = thieuPhanCanh(kq.phanCanh, c); return l ? `#${i + 1} ${c.canh}: ${l}` : ''; }).filter(Boolean);
if (lacPc.length) { console.error(`thiếu phân cảnh:\n  ${lacPc.slice(0, 8).join('\n  ')}`); process.exit(1); }
const t = (await db.execute(sql`SELECT phim_id, ten FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[];
if (!t[0]) { console.error('không thấy tập'); process.exit(1); }
const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${Number(t[0].phim_id)} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
const canhDu = kq.canh;   // thời lượng tập tính trên ĐỦ shot của tệp, kể cả khi chỉ chèn / cập nhật một phần
if (chen) kq.canh = kq.canh.filter((c: { phan_doan: string }) => chen.includes(c.phan_doan));
if (process.argv.includes('--cap-nhat')) { const co = new Set(((await db.execute(sql`SELECT DISTINCT phan_doan FROM xv_canh WHERE tap_id = ${tapId}`)) as unknown as Row[]).map((r) => String(r.phan_doan))); kq.canh = kq.canh.filter((c: { phan_doan: string }) => co.has(c.phan_doan)); }
const lech = kq.canh.flatMap((c: { nhan_vat: string[] }) => c.nhan_vat.filter((x) => !nv.some((v) => v.ten.trim().toLowerCase() === x.trim().toLowerCase())));
if (lech.length) { console.error(`tên anchor không có trong phim: ${[...new Set(lech)].join(', ')}`); process.exit(1); }
if (thay) { const cu = ((await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId}`)) as unknown as Row[]).map((r) => Number(r.id)); const { boVaoThungRac } = await import('../src/lib/xuong-video/thung-rac'); console.log('thùng rác:', await boVaoThungRac(db, 'canh', cu, 'nap-canh', `${cu.length} shot cũ (nạp hồ sơ thay toàn bộ)`)); }
if (chen && !truoc) { console.error('--chen cần --truoc=<thứ tự>'); process.exit(1); }
/** --cap-nhat: ĐỒNG BỘ nội dung shot đã có (khớp theo phân cảnh + thứ tự trong phân cảnh) từ tệp — thẻ shot, kỹ thuật, hành động, prompt, âm,
 *  giây — GIỮ keyframe/clip; phân cảnh/beats/hồ sơ của tập thay bản đầy đủ. Shot có trong tệp mà chưa có trong tập thì chỉ báo (thêm bằng --chen).
 *  Mỗi shot đổi đều chụp trước (↶ hoàn tác được). Shot đổi ẢNH ĐẦU (prompt ảnh / bố cục / trạng thái mở / anchor) được liệt kê: keyframe cũ lệch. */
if (process.argv.includes('--cap-nhat')) {
  const { chupTruoc } = await import('../src/lib/xuong-video/hoan-tac');
  const { lamSachKyThuat } = await import('../src/lib/xuong-video/dien-anh');
  const { ghepThoai } = await import('../src/lib/xuong-video/kieu');
  const cu = ((await db.execute(sql`SELECT id, phan_doan, thu_tu, prompt_anh, nhan_vat, dan_dung FROM xv_canh WHERE tap_id = ${tapId} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu`)) as unknown as Row[]);
  const theoPc = new Map<string, Row[]>(); for (const r of cu) theoPc.set(String(r.phan_doan), [...(theoPc.get(String(r.phan_doan)) ?? []), r]);
  const demPc = new Map<string, number>(); let doi = 0; const chuaCo: string[] = []; const lechAnh: number[] = [];
  const tenId = new Map(nv.map((v) => [v.ten.trim().toLowerCase(), v.id]));
  for (const c of kq.canh as { phan_doan: string; [k: string]: unknown }[]) {
    const i = demPc.get(c.phan_doan) ?? 0; demPc.set(c.phan_doan, i + 1);
    const r = theoPc.get(c.phan_doan)?.[i];
    if (!r) { chuaCo.push(`${c.phan_doan} #${i + 1}`); continue; }
    const ids = (c.nhan_vat as string[]).map((t) => tenId.get(t.trim().toLowerCase())).filter((x): x is number => typeof x === 'number');
    const dd = (c.dan_dung ?? {}) as Record<string, string>; const ddCu = (r.dan_dung ?? {}) as Record<string, string>;
    if (c.prompt_anh !== r.prompt_anh || dd.bo_cuc !== ddCu.bo_cuc || dd.mo !== ddCu.mo || JSON.stringify([...ids].sort()) !== JSON.stringify([...((r.nhan_vat as number[]) ?? [])].sort())) lechAnh.push(Number(r.thu_tu));
    await chupTruoc(db, { bang: 'xv_canh', id: Number(r.id), cot: ['canh', 'goc_may', 'hanh_dong', 'prompt_anh', 'prompt_video', 'am_thanh', 'thoai', 'loi_thoai', 'phat_s', 'ky_thuat', 'dan_dung', 'cam_xuc', 'nhan_vat', 'chu_man'], moTa: 'đồng bộ hồ sơ tiền kỳ', nguoi: 'nap-canh' });
    const thoai = ((c.thoai ?? []) as { loi: string }[]).filter((d) => d.loi.trim());
    await db.execute(sql`UPDATE xv_canh SET canh = ${c.canh as string}, goc_may = ${c.goc_may as string}, hanh_dong = ${c.hanh_dong as string}, prompt_anh = ${c.prompt_anh as string}, prompt_video = ${c.prompt_video as string},
      am_thanh = ${c.am_thanh as string}, thoai = ${JSON.stringify(thoai)}::jsonb, loi_thoai = ${thoai.length ? ghepThoai(thoai as never) : ''}, phat_s = ${c.phat_s as number},
      ky_thuat = ${JSON.stringify(lamSachKyThuat(c.ky_thuat as Record<string, unknown>))}::jsonb, dan_dung = ${JSON.stringify(dd)}::jsonb, cam_xuc = ${c.cam_xuc as number},
      nhan_vat = ${JSON.stringify(ids)}::jsonb, chu_man = ${(c.chu_man as string) ?? ''}, updated_at = now() WHERE id = ${Number(r.id)}`);
    doi++;
  }
  await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['phan_canh', 'beats', 'ho_so', 'kich_ban'], moTa: 'đồng bộ hồ sơ tiền kỳ', nguoi: 'nap-canh' });
  await db.execute(sql`UPDATE xv_tap SET phan_canh = ${JSON.stringify(kq.phanCanh)}::jsonb, beats = ${JSON.stringify(kq.beats)}::jsonb, ho_so = coalesce(ho_so, '{}'::jsonb) || ${JSON.stringify(kq.hoSo ?? {})}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  if (kbMd) await db.execute(sql`UPDATE xv_tap SET kich_ban = ${readFileSync(kbMd, 'utf8')} WHERE id = ${tapId}`);
  console.log(JSON.stringify({ dong_bo: doi, chua_co_trong_tap: chuaCo, keyframe_lech_anh_dau: lechAnh }));
  process.exit(0);
}
const so = await luuCanhTach(db, { chenTruoc: chen ? truoc : undefined, tapId, tenTap: String(t[0].ten), kq: kq as never, nhanVat: nv, nguoi: 'script nap-canh', thoiLuongS: Math.round(canhDu.reduce((a: number, c: { phat_s: number }) => a + c.phat_s, 0)) });   // cột thoi_luong_s là số nguyên
if (kbMd) { const { chupTruoc } = await import('../src/lib/xuong-video/hoan-tac'); await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['kich_ban', 'ho_so'], moTa: 'nạp hồ sơ tiền kỳ', nguoi: 'nap-canh' }); await db.execute(sql`UPDATE xv_tap SET kich_ban = ${readFileSync(kbMd, 'utf8')} WHERE id = ${tapId}`); }
console.log(`đã nạp ${so} shot vào tập #${tapId}`);
process.exit(0);

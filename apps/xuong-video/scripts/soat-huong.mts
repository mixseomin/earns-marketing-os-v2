// CỔNG HƯỚNG + NỐI CẮT trên HÌNH THẬT (0đ — soi mặt YuNet + SFace + hướng nhìn, soi-mat.ts) so với KỲ VỌNG từ sơ đồ cảnh (so-do-canh.ts › kyVong):
//   khung đầu  (keyframe_url)  ↔ ky_thuat.huong_so        · khung cuối (keyframe_ket) ↔ huong_so_ket
//   clip ĐÃ DÙNG: khung mở đoạn (vao_s) ↔ huong_so · khung đóng đoạn (vao_s + phat_s) ↔ huong_so_ket — đúng hai đầu mỗi ĐƯỜNG CẮT trong phim dựng
// (anh 24/10/2026: "ngay 2 shot đầu hướng nhìn đã lệch hẳn nhau" — cổng cũ chỉ soi khung đầu, còn soát nối cắt là con tự cắt khung xem bằng mắt).
// Đo cả DÁNG so sổ dáng (khong-gian.ts › kyVongDang): đầu cúi / ngẩng (MediaPipe mặt) + tay giơ / buông (MediaPipe tư thế). Chỉ tin mặt giống ảnh mẫu
// đạt ngưỡng VÀ hơn hẳn tên kế (tin — hai nữ chính AI vẽ na ná nhau); người quay lưng không đưa cho bộ so mặt; số MẶT nhiều hơn số người sơ đồ
// cho thấy mặt → có người chen vào khung (#16 cũ: Hạ đứng cạnh Vivian dù đã quay đi) — đếm mặt, không đoán danh tính người thừa.
// In từng shot + từng đường cắt ✓ / ✗, ghi ky_thuat.soat_noi (timeline › nhánh kiểm).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/soat-huong.mts <tap_id> [--khong-clip]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { soiAnh } from '../src/lib/xuong-video/soi-mat';
import { loiDoHuong, type KyVong } from '../src/lib/xuong-video/so-do-canh';
import { dang, kgCua, kyVongDang, loiDoDang, type KhongGianTap } from '../src/lib/xuong-video/khong-gian';
import { mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import type { SoiMat } from '../src/lib/xuong-video/kieu';
import { hoiKhung } from '../src/lib/xuong-video/soi-cau-hoi';
import { cauHoiKhung, loiTuDapAn } from '../src/lib/xuong-video/cau-hoi-khung';
import { mapNhanVat } from '../src/lib/xuong-video/doc-db';

const tap = Number(process.argv[2]); if (!tap) { console.error('cần <tap_id>'); process.exit(1); }
const coClip = !process.argv.includes('--khong-clip');
const db = getDb()!;
const kgt = (((await db.execute(sql`SELECT khong_gian FROM xv_tap WHERE id = ${tap}`)) as unknown as Row[])[0]?.khong_gian ?? null) as KhongGianTap | null;
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh);
type Luc = 'dau' | 'ket' | 'clip_dau' | 'clip_ket'; const LUC: Luc[] = ['dau', 'ket', 'clip_dau', 'clip_ket'];
const laDau = (l: Luc) => l === 'dau' || l === 'clip_dau';
const kyVong = (c: (typeof ds)[number], l: Luc) => ((laDau(l) ? c.ky_thuat?.huong_so : c.ky_thuat?.huong_so_ket ?? c.ky_thuat?.huong_so) ?? {}) as Record<string, KyVong>;
/** số mặt sơ đồ cho thấy ở lúc đó (người trong khung, không quay lưng; cận chèn = 0) */
const soMat = (c: (typeof ds)[number], l: Luc) => (c.ky_thuat?.co_canh === 'insert' ? 0 : Object.values(kyVong(c, l)).filter((v) => !v.lung).length);
const thuMuc = `/tmp/soat-noi-${tap}`; mkdirSync(thuMuc, { recursive: true });
const anh: { id: number; url: string; ten: string[]; tu_the: boolean }[] = []; const ma = (c: number, l: Luc) => c * 10 + LUC.indexOf(l);
const cat = (url: string, giay: number, ra: string) => { try { execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(Math.max(0, giay)), '-i', url, '-frames:v', '1', '-q:v', '3', ra], { timeout: 60_000 }); return true; } catch { return false; } };
for (const c of ds) {
  const vao = Number(c.ky_thuat?.vao_s ?? 0), phat = Number(c.phat_s ?? 0) || 2;
  const nguon: Record<Luc, () => string | null> = { dau: () => c.keyframe_url ?? null, ket: () => c.keyframe_ket ?? null,
    clip_dau: () => (coClip && c.video_url && cat(c.video_url, vao + 0.04, `${thuMuc}/${c.id}-clip_dau.jpg`) ? `${thuMuc}/${c.id}-clip_dau.jpg` : null),
    clip_ket: () => (coClip && c.video_url && cat(c.video_url, vao + phat - 0.08, `${thuMuc}/${c.id}-clip_ket.jpg`) ? `${thuMuc}/${c.id}-clip_ket.jpg` : null) };
  // khung clip luôn cắt (tờ ghép cần đủ mọi đường cắt, kể cả cận chèn không có người để đo); chỉ ảnh có người kỳ vọng mới đưa đi soi
  for (const l of LUC) { const kv = kyVong(c, l); const url = l.startsWith('clip') || Object.keys(kv).length ? nguon[l]() : null; if (!url || !Object.keys(kv).length) continue;
    anh.push({ id: ma(c.id, l), url, ten: Object.keys(kv).filter((n) => !kv[n]!.lung), tu_the: true }); }
}
const do_ = await soiAnh(db, tap, anh);
// --hoi: HỎI trạng thái dáng / đồ / ai có mặt trên khung mở + đóng của đoạn clip đã dùng (soi-cau-hoi.ts, Gemini ~0,3¢ / khung — chỉ khi được duyệt tiền)
const hoiLoi = new Map<number, string[]>();
if (process.argv.includes('--hoi')) {
  const phimId = Number((((await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id = ${tap}`)) as unknown as Row[])[0]?.phim_id) ?? 0) || null;
  const nvs = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId}`)) as unknown as Row[]).map(mapNhanVat);
  const viec = ds.flatMap((c) => (['clip_dau', 'clip_ket'] as Luc[]).map((l) => ({ c, l, f: `${thuMuc}/${c.id}-${l}.jpg` }))).filter((x) => kgCua(kgt, x.c) && existsSync(x.f));
  let i = 0; const chay = async () => { while (i < viec.length) { const { c, l, f } = viec[i++]!;
    const hoi = cauHoiKhung({ canh: { ...c, khung_xam: null, may_3d: null } as never, nhanVat: nvs, kg: kgCua(kgt, c), luc: laDau(l) ? 'dau' : 'ket' }).filter((x) => /^(co|dang|vat|vang|ngoai|chen|lung|mat):|^(mo|ket)$/.test(x.ma));
    const dap = await hoiKhung(db, phimId, f, hoi).catch(() => null); if (dap) hoiLoi.set(ma(c.id, l), loiTuDapAn(hoi, dap).map((x) => `hỏi: ${x.mo_ta}`)); } };
  await Promise.all(Array.from({ length: 6 }, chay));
}
const NHAY_CUI = 15; const NGUONG_LA = 0.2;   // dưới mức này mặt không phải nhân vật đó (cùng người ~0,4–0,7)
const NHAN: Record<Luc, string> = { dau: 'khung đầu', ket: 'khung cuối', clip_dau: 'clip mở', clip_ket: 'clip đóng' };
const ketQua = (c: (typeof ds)[number], l: Luc) => {
  const kv = kyVong(c, l); const r0 = do_.get(ma(c.id, l)); if (!Object.keys(kv).length || !r0) return null; const k0 = r0.ket;
  const k: SoiMat['ket'] = k0.filter((x) => x.tin);   // chỉ mặt giống ảnh mẫu đạt ngưỡng
  const loi = loiDoHuong(Object.fromEntries(Object.entries(kv).filter(([, v]) => !v.lung)), k);
  const kg = kgCua(kgt, c);
  // số mặt: hơn số người TRONG KHUNG (kể người quay lưng) = có người chen vào; hơn số người thấy mặt = người lẽ ra quay lưng / nửa lưng lại lộ mặt
  const tong = c.ky_thuat?.co_canh === 'insert' ? 0 : Object.keys(kv).length;
  if (r0.mat > tong) loi.push(`thấy ${r0.mat} mặt mà sơ đồ chỉ có ${tong} người trong khung — có người chen vào (người ngoài khung / người lạ)`);
  // nửa lưng có thể lộ má / nghiêng (YuNet vẫn bắt) — chỉ người quay lưng HẲN mà lộ mặt mới là lỗi
  else if (r0.mat > tong - Object.values(kv).filter((v) => v.han).length) loi.push(`${Object.entries(kv).filter(([, v]) => v.han).map(([n]) => n).join(' / ')} lẽ ra quay lưng hẳn mà lộ mặt (thấy ${r0.mat} mặt)`);
  // NGƯỜI LẠ chiếm chỗ: mặt duy nhất được gán cho người sơ đồ cần thấy mà giống quá thấp (#2 bản mới: người đàn ông từ thang bước ra, mặt Hạ quay đi —
  // số mặt vẫn bằng 1 nên đếm mặt không bắt được)
  for (const x of k0) if (kv[x.ten] && !kv[x.ten]!.lung && x.giong != null && x.giong < NGUONG_LA && !x.nho) loi.push(`mặt ở chỗ ${x.ten} không phải ${x.ten} (giống ${x.giong}) — người lạ / sai người trong khung`);
  loi.push(...(hoiLoi.get(ma(c.id, l)) ?? []));
  for (const x of k) {
    const d = kg ? dang(kg, c.thu_tu, x.ten, laDau(l) ? 'dau' : 'ket') : null; if (d) loi.push(...loiDoDang(x.ten, kyVongDang(d.en), x)); }
  return { loi, so: k0.map((x) => `${x.ten}${x.tin ? '' : '(?)'} x=${x.o?.x?.toFixed(2) ?? '?'} nhìn=${x.nhin?.g ?? '?'}° ngẩng=${x.nhin?.doc ?? '?'}°${x.tay ? ` tay P/T=${x.tay.phai ?? '?'}/${x.tay.trai ?? '?'}` : ''}`).join(' · ') };
};
let truot = 0;
for (const c of ds) {
  const loi: string[] = []; const dong: string[] = [];
  for (const l of LUC) { const k = ketQua(c, l); if (!k) continue; dong.push(`${NHAN[l]} ${k.loi.length ? '✗' : '✓'} ${k.so || '(không đo được mặt)'}`); loi.push(...k.loi.map((x) => `${NHAN[l]}: ${x}`)); }
  if (!dong.length) continue; if (loi.length) truot++;
  console.log(`#${c.thu_tu} ${loi.length ? '✗' : '✓'}\n    ${dong.join('\n    ')}${loi.length ? `\n    → ${loi.join('; ')}` : ''}`);
  await db.execute(sql`UPDATE xv_canh SET ky_thuat = coalesce(ky_thuat, '{}'::jsonb) || jsonb_build_object('soat_noi', ${JSON.stringify({ luc: new Date().toISOString(), video_url: c.video_url ?? null, keyframe_ket: c.keyframe_ket ?? null, loi })}::jsonb) WHERE id = ${c.id}`);
}
// ĐƯỜNG CẮT: clip đóng của shot trước ↔ clip mở của shot sau (cùng cảnh) — chỗ khán giả thật sự thấy
console.log('\nĐƯỜNG CẮT (clip đã dùng):');
for (let i = 1; i < ds.length; i++) { const a = ds[i - 1]!, b = ds[i]!; if (a.phan_doan !== b.phan_doan) continue; const ka = ketQua(a, 'clip_ket'), kb = ketQua(b, 'clip_dau'); if (!ka && !kb) continue;
  const l = [...(ka?.loi ?? []).map((x) => `cuối #${a.thu_tu}: ${x}`), ...(kb?.loi ?? []).map((x) => `đầu #${b.thu_tu}: ${x}`)];
  // ĐẦU NHẢY qua cú cắt: cùng người, độ cúi cuối shot trước ↔ đầu shot sau lệch > NHAY_CUI° (cúi rồi ngẩng — anh 24/10/2026)
  const da = do_.get(ma(a.id, 'clip_ket'))?.ket ?? [], db_ = do_.get(ma(b.id, 'clip_dau'))?.ket ?? [];
  for (const x of da.filter((q) => q.tin && q.nhin)) { const y = db_.find((q) => q.ten === x.ten && q.tin && q.nhin); if (y && Math.abs(x.nhin!.doc - y.nhin!.doc) > NHAY_CUI) l.push(`${x.ten} đầu nhảy qua cú cắt: cuối #${a.thu_tu} ${x.nhin!.doc}° → đầu #${b.thu_tu} ${y.nhin!.doc}° (+ = cúi)`); } console.log(`  #${a.thu_tu}→#${b.thu_tu} ${l.length ? `✗ ${l.join('; ')}` : '✓'}`); }
// TỜ GHÉP ĐƯỜNG CẮT (cuối shot trước | đầu shot sau, theo thứ tự) — chỗ máy không phán được (tay người quay lưng, khung toàn mặt nhỏ, hai người na ná) soát bằng mắt
{ const cap: string[] = []; let k = 0;
  for (let i = 1; i < ds.length; i++) { const a = ds[i - 1]!, b = ds[i]!; const fa = `${thuMuc}/${a.id}-clip_ket.jpg`, fb = `${thuMuc}/${b.id}-clip_dau.jpg`; if (a.phan_doan !== b.phan_doan) continue;
    const ra = `${thuMuc}/cap_${String(++k).padStart(2, '0')}.jpg`;
    try { execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', fa, '-i', fb, '-filter_complex', '[0]scale=270:480,pad=280:480:0:0:red[a];[1]scale=270:480[b];[a][b]hstack,pad=560:500:0:0:black', ra]); cap.push(`${k}: #${a.thu_tu}→#${b.thu_tu}`); } catch { k--; } }
  if (k) { try { execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '1', '-i', `${thuMuc}/cap_%02d.jpg`, '-vf', `tile=4x${Math.ceil(k / 4)}`, '-frames:v', '1', `${thuMuc}/to-ghep.jpg`]);
    console.log(`\nTờ ghép đường cắt: ${thuMuc}/to-ghep.jpg (box3) — ô theo thứ tự trái → phải, trên → dưới: ${cap.join(' · ')}`); } catch (e) { console.error('không ghép được tờ đường cắt', e); } } }
console.log(`\n${truot} shot trượt cổng hướng / dáng`);
process.exit(0);

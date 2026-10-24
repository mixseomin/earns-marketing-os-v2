// CỔNG NỐI CẮT — VÒNG KHÉP KÍN trên HÌNH THẬT (luat-dung.ts › do_tren_hinh_that; anh 25/10/2026: "giải pháp kỹ thuật, không chỉ update prompt").
// Mỗi shot: đo khung đầu / cuối (keyframe) + khung MỞ · GIỮA · ĐÓNG của ĐOẠN CLIP ĐÃ DÙNG bằng máy (0đ, soi-mat.py: mặt, hướng nhìn, độ cúi, tay, nét mặt,
// phía sáng) so với sơ đồ cảnh + sổ dáng + sổ đồ vật (khong-gian.ts); --hoi thêm câu hỏi Gemini trên khung (soi-cau-hoi.ts, ~0,3¢/khung); nối máy đo cảm xúc
// (cham-may.ts) với kế hoạch diễn. TRƯỢT ở khung clip → --chon: quét điểm vào trong vùng dùng được, lấy đoạn qua được mọi cổng chặn (ưu tiên cắt giữa động
// tác) → ĐỀ XUẤT kèm tờ ứng viên, --ghi-vao mới ghi ky_thuat.vao_s (điểm vào mới phải qua mắt người); không đoạn nào đạt → in danh sách SHOT CẦN SINH LẠI kèm giá (--sinh-lai [--tran=<cents>] tự sinh lại rồi đo lại, cần DUYET_SINH_1_LAN).
// Lỗi 'chan' = đã đo độ đúng trên ca thật; 'canh' = luật mới đo, chờ hiệu chỉnh (scripts/hieu-chinh-do.mts) — in ⚠ để soát tờ ghép, không chặn.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/soat-huong.mts <tap_id> [--khong-clip] [--hoi] [--chon [--ghi-vao]] [--sinh-lai --tran=200]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { soiAnh } from '../src/lib/xuong-video/soi-mat';
import { loiDoHuong, type KyVong } from '../src/lib/xuong-video/so-do-canh';
import { dang, kgCua, kyVongDang, loiDoDang, loiDoThem, type KhongGianTap, type MucDo } from '../src/lib/xuong-video/khong-gian';
import { mapCanh, mapNhanVat, type Row } from '../src/lib/xuong-video/doc-db';
import type { SoiMat } from '../src/lib/xuong-video/kieu';
import { DUOI_CLIP_BO } from '../src/lib/xuong-video/xuat';
import { hoiKhung2, laChan } from '../src/lib/xuong-video/soi-cau-hoi';
import { cauHoiKhung, loiTuDapAn } from '../src/lib/xuong-video/cau-hoi-khung';
import { chamMayShots } from '../src/lib/xuong-video/cham-may';
import { giaVideoSv } from '../src/lib/xuong-video/doc-db';

const tap = Number(process.argv[2]); if (!tap) { console.error('cần <tap_id>'); process.exit(1); }
const co = (k: string) => process.argv.includes(`--${k}`); const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const coClip = !co('khong-clip'); const db = getDb()!;
const kgt = (((await db.execute(sql`SELECT khong_gian FROM xv_tap WHERE id = ${tap}`)) as unknown as Row[])[0]?.khong_gian ?? null) as KhongGianTap | null;
const phimId = Number((((await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id = ${tap}`)) as unknown as Row[])[0]?.phim_id) ?? 0) || null;
const nvs = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId}`)) as unknown as Row[]).map(mapNhanVat);
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh);
type Shot = (typeof ds)[number];
type Luc = 'dau' | 'ket' | 'clip_dau' | 'clip_giua' | 'clip_ket'; const LUC: Luc[] = ['dau', 'ket', 'clip_dau', 'clip_giua', 'clip_ket'];
const NHAN: Record<Luc, string> = { dau: 'khung đầu', ket: 'khung cuối', clip_dau: 'clip mở', clip_giua: 'clip giữa', clip_ket: 'clip đóng' };
const laDau = (l: Luc) => l === 'dau' || l === 'clip_dau'; const lucSo = (l: Luc): 'dau' | 'ket' => (laDau(l) ? 'dau' : 'ket');
const kyVong = (c: Shot, l: Luc) => ((laDau(l) ? c.ky_thuat?.huong_so : c.ky_thuat?.huong_so_ket ?? c.ky_thuat?.huong_so) ?? {}) as Record<string, KyVong>;
const soMat = (c: Shot, l: Luc) => (c.ky_thuat?.co_canh === 'insert' ? 0 : Object.values(kyVong(c, l)).filter((v) => !v.lung).length);
const coThoai = (c: Shot) => (c.thoai ?? []).some((t) => t.loi?.trim() && t.nhan_vat?.trim());
const thuMuc = `/tmp/soat-noi-${tap}`; mkdirSync(thuMuc, { recursive: true });
const cat = (url: string, giay: number, ra: string) => { try { execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(Math.max(0, giay)), '-i', url, '-frames:v', '1', '-q:v', '3', ra], { timeout: 60_000 }); return true; } catch { return false; } };
const daiClip = new Map<number, number>(); const dai = (c: Shot) => { if (!c.video_url) return 0; if (!daiClip.has(c.id)) { try { daiClip.set(c.id, Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', c.video_url], { encoding: 'utf8', timeout: 30_000 })) || 8); } catch { daiClip.set(c.id, 8); } } return daiClip.get(c.id)!; };
const phatCua = (c: Shot) => Number(c.phat_s ?? 0) || 2;
/** ba khung của đoạn clip dùng từ điểm vào `vao` */
const giayKhung = (c: Shot, vao: number): Record<'clip_dau' | 'clip_giua' | 'clip_ket', number> => ({ clip_dau: vao + 0.04, clip_giua: vao + phatCua(c) / 2, clip_ket: vao + phatCua(c) - 0.08 });

// ── ĐO một bộ khung (keyframe + 3 khung clip tại điểm vào cho trước) ──────────────────────────────────────────────────────────────────────────────────────
type Do = Awaited<ReturnType<typeof soiAnh>> extends Map<number, infer V> ? V : never;
type BoDo = Map<Luc, Do>;
async function doBo(cs: { c: Shot; vao: number; nhan: string }[]): Promise<Map<string, BoDo>> {
  const anh: { id: number; url: string; ten: string[]; tu_the: boolean }[] = []; const khoa = new Map<number, [string, Luc]>(); let id = 1;
  for (const { c, vao, nhan } of cs) {
    const g = giayKhung(c, vao);
    const nguon: Record<Luc, () => string | null> = { dau: () => c.keyframe_url ?? null, ket: () => c.keyframe_ket ?? null,
      clip_dau: () => (coClip && c.video_url && cat(c.video_url, g.clip_dau, `${thuMuc}/${nhan}-clip_dau.jpg`) ? `${thuMuc}/${nhan}-clip_dau.jpg` : null),
      clip_giua: () => (coClip && c.video_url && cat(c.video_url, g.clip_giua, `${thuMuc}/${nhan}-clip_giua.jpg`) ? `${thuMuc}/${nhan}-clip_giua.jpg` : null),
      clip_ket: () => (coClip && c.video_url && cat(c.video_url, g.clip_ket, `${thuMuc}/${nhan}-clip_ket.jpg`) ? `${thuMuc}/${nhan}-clip_ket.jpg` : null) };
    for (const l of LUC) { const kv = kyVong(c, l); const url = l.startsWith('clip') || Object.keys(kv).length ? nguon[l]() : null; if (!url || !Object.keys(kv).length) continue;
      khoa.set(id, [nhan, l]); anh.push({ id: id++, url, ten: Object.keys(kv).filter((n) => !kv[n]!.lung), tu_the: true }); }
  }
  const ra = await soiAnh(db, tap, anh); const out = new Map<string, BoDo>();
  for (const [i, v] of ra) { const [nhan, l] = khoa.get(i)!; (out.get(nhan) ?? out.set(nhan, new Map()).get(nhan)!).set(l, v); }
  return out;
}
const NHAY_CUI = 15; const NGUONG_LA = 0.2;
type Loi = { chu: string; muc: MucDo };
/** ĐÁNH GIÁ một khung: lỗi chặn (đã hiệu chỉnh) + cảnh báo (luật mới đo) */
function danhGia(c: Shot, l: Luc, r0: Do | undefined, hoi?: { chan: string[]; canh: string[] }): { loi: Loi[]; so: string } | null {
  const kv = kyVong(c, l); if (!Object.keys(kv).length || !r0) return null; const k0 = r0.ket; const k: SoiMat['ket'] = k0.filter((x) => x.tin);
  const loi: Loi[] = loiDoHuong(Object.fromEntries(Object.entries(kv).filter(([, v]) => !v.lung)), k).map((chu) => ({ chu, muc: 'chan' as const }));
  const kg = kgCua(kgt, c); const tong = c.ky_thuat?.co_canh === 'insert' ? 0 : Object.keys(kv).length;
  if (r0.mat > tong) loi.push({ chu: `thấy ${r0.mat} mặt mà sơ đồ chỉ có ${tong} người trong khung — có người chen vào`, muc: 'chan' });
  else if (r0.mat > tong - Object.values(kv).filter((v) => v.han).length) loi.push({ chu: `${Object.entries(kv).filter(([, v]) => v.han).map(([n]) => n).join(' / ')} lẽ ra quay lưng hẳn mà lộ mặt (thấy ${r0.mat} mặt)`, muc: 'chan' });
  for (const x of k0) if (kv[x.ten] && !kv[x.ten]!.lung && x.giong != null && x.giong < NGUONG_LA && !x.nho) loi.push({ chu: `mặt ở chỗ ${x.ten} không phải ${x.ten} (giống ${x.giong}) — người lạ / sai người`, muc: 'chan' });
  for (const x of k) { const d = kg ? dang(kg, c.thu_tu, x.ten, lucSo(l)) : null; if (d) loi.push(...loiDoDang(x.ten, kyVongDang(d.en), x).map((chu) => ({ chu, muc: 'chan' as const }))); }
  if (kg) loi.push(...loiDoThem(kg, c, lucSo(l), k, coThoai(c)));   // miệng · ánh nhìn dọc · phía sáng · khoảng cách (mức canh tới khi hiệu chỉnh)
  if (hoi) loi.push(...hoi.chan.map((chu) => ({ chu: `hỏi: ${chu}`, muc: 'chan' as const })), ...hoi.canh.map((chu) => ({ chu: `hỏi: ${chu}`, muc: 'canh' as const })));
  const so = k0.map((x) => `${x.ten}${x.tin ? '' : '(?)'} x=${x.o?.x?.toFixed(2) ?? '?'} nhìn=${x.nhin?.g ?? '?'}° cúi=${x.nhin?.doc ?? '?'}°${x.nhin?.net ? ` há=${x.nhin.net.ha}` : ''}${x.tay ? ` tay P/T=${x.tay.phai ?? '?'}/${x.tay.trai ?? '?'}` : ''}${x.sang != null ? ` sáng=${x.sang}` : ''}`).join(' · ');
  return { loi, so };
}
const chan = (ls: Loi[]) => ls.filter((x) => x.muc === 'chan'); const canh = (ls: Loi[]) => ls.filter((x) => x.muc === 'canh');

// ── 1. ĐO điểm vào hiện tại ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const vaoCua = (c: Shot) => Number(c.ky_thuat?.vao_s ?? 0.5);
const bo = await doBo(ds.map((c) => ({ c, vao: vaoCua(c), nhan: String(c.id) })));
// ── 2. HỎI Gemini (--hoi) trên 3 khung clip ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const hoiKq = new Map<string, { chan: string[]; canh: string[] }>();
if (co('hoi')) {
  const viec = ds.flatMap((c) => (['clip_dau', 'clip_giua', 'clip_ket'] as Luc[]).map((l) => ({ c, l, f: `${thuMuc}/${c.id}-${l}.jpg` }))).filter((x) => kgCua(kgt, x.c) && existsSync(x.f));
  let i = 0; const chay = async () => { while (i < viec.length) { const { c, l, f } = viec[i++]!; const toan = ['ws', 'ews'].includes(c.ky_thuat?.co_canh ?? '');
    const hoi = cauHoiKhung({ canh: { ...c, khung_xam: null, may_3d: null } as never, nhanVat: nvs, kg: kgCua(kgt, c), luc: lucSo(l) }).filter((x) => (toan ? /^(co|vang|ngoai):|^(mo|ket)$/ : /^(co|dang|vat|mac|vang|ngoai|chen|lung|mat):|^(mo|ket)$/).test(x.ma)).filter((x) => l !== 'clip_giua' || !/^(mo|ket)$/.test(x.ma));
    const r = await hoiKhung2(db, phimId, f, hoi).catch(() => null); if (!r) continue;
    // CHẶN: mã câu đã hiệu chỉnh (soi-cau-hoi › MA_CHAN) và cả hai lượt hỏi đều "không"; CẢNH BÁO: mã khác, hoặc chỉ một lượt "không"
    const chanKq = loiTuDapAn(hoi.filter((x) => laChan(x.ma)), r.dap).map((x) => x.mo_ta);
    const canhKq = [...loiTuDapAn(hoi.filter((x) => !laChan(x.ma)), r.dap).map((x) => x.mo_ta), ...hoi.filter((x) => r.motLan.has(x.ma)).map((x) => `(1/2 lượt) [${x.ma}] ${x.hoi}`)];
    hoiKq.set(`${c.id}:${l}`, { chan: chanKq, canh: canhKq }); } };
  await Promise.all(Array.from({ length: 6 }, chay));
}
// ── 3. CẢM XÚC đo bằng máy (cham-may.ts, HSEmotion) so KẾ HOẠCH DIỄN — mức canh (hiệu chỉnh trên phim QC, chưa trên phim truyện) ─────────────────────
const camXuc = new Map<number, string[]>();
if (coClip) { try { for (const r of await chamMayShots(db, tap, ds.filter((c) => c.video_url && c.bieu_cam?.length).map((c) => c.id))) if (r.ket !== 'dat') camXuc.set(r.id, r.loi); }
  catch (e) { console.log(`  ! máy đo cảm xúc: ${e instanceof Error ? e.message : e}`); } }

// ── 4. KẾT LUẬN từng shot + --chon quét điểm vào khi khung clip trượt ──────────────────────────────────────────────────────────────────────────────────
const tongHop = (c: Shot, b: BoDo | undefined, hoi: (l: Luc) => { chan: string[]; canh: string[] } | undefined) => {
  const dong: string[] = []; const loi: Loi[] = [];
  for (const l of LUC) { const k = danhGia(c, l, b?.get(l), hoi(l)); if (!k) continue; const ch = chan(k.loi); dong.push(`${NHAN[l]} ${ch.length ? '✗' : '✓'} ${k.so || '(không đo được mặt)'}`); loi.push(...k.loi.map((x) => ({ ...x, chu: `${NHAN[l]}: ${x.chu}` }))); }
  return { dong, loi };
};
const clipTruot = (c: Shot, b: BoDo | undefined, hoi: (l: Luc) => { chan: string[]; canh: string[] } | undefined) => (['clip_dau', 'clip_giua', 'clip_ket'] as Luc[]).some((l) => chan(danhGia(c, l, b?.get(l), hoi(l))?.loi ?? []).length > 0);
let truot = 0; const canSinhLai: { c: Shot; ly: string }[] = []; const doiVao = new Map<number, number>(); const deXuat = new Map<number, number>();
for (const c of ds) {
  const hoi = (l: Luc) => hoiKq.get(`${c.id}:${l}`);
  let b = bo.get(String(c.id)); let { dong, loi } = tongHop(c, b, hoi);
  // --chon: khung clip trượt cổng chặn → quét điểm vào trong vùng dùng được (bỏ 0,2 s đầu + đuôi clip AI), đo lại từng ứng viên (0đ), chọn ứng viên
  // qua mọi cổng chặn, ít cảnh báo nhất, gần điểm vào cũ nhất; không ứng viên nào đạt → shot cần sinh lại
  if (co('chon') && c.video_url && clipTruot(c, b, hoi)) {
    const hi = dai(c) - DUOI_CLIP_BO - phatCua(c); const uv: number[] = []; for (let v = 0.2; v <= hi + 1e-9; v += Math.max(0.1, (hi - 0.2) / 14)) uv.push(Math.round(v * 10) / 10);
    const doUv = await doBo(uv.map((v) => ({ c, vao: v, nhan: `${c.id}-uv${v}` })));
    const diem = (v: number) => { const bv = doUv.get(`${c.id}-uv${v}`); const ls = (['clip_dau', 'clip_giua', 'clip_ket'] as Luc[]).flatMap((l) => danhGia(c, l, bv?.get(l))?.loi ?? []); return { v, bv, ch: chan(ls).length, ca: canh(ls).length }; };
    const xep = uv.map(diem).sort((p, q) => p.ch - q.ch || p.ca - q.ca || Math.abs(p.v - vaoCua(c)) - Math.abs(q.v - vaoCua(c)));
    const tot = xep[0];
    // CHỈ ĐỀ XUẤT (25/10/2026: lần đầu tự ghi đè điểm vào của bản anh đã duyệt — #2 về đúng đoạn có người lạ máy không nhận ra). Máy đo không thấy hết
    // (người lạ quay mặt, đồ sai…) nên điểm vào MỚI phải qua mắt người: in đề xuất + tờ ghép ứng viên; --ghi-vao mới ghi, và ghi xong đoạn đó phải soát lại
    if (tot && tot.ch === 0 && tot.v !== vaoCua(c)) { deXuat.set(c.id, tot.v);
      const f = `${thuMuc}/${c.id}-uv${tot.v}-clip_dau.jpg`, g = `${thuMuc}/${c.id}-uv${tot.v}-clip_ket.jpg`; if (existsSync(f) && existsSync(g)) { try { execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', f, '-i', g, '-filter_complex', '[0]scale=270:480[a];[1]scale=270:480[b];[a][b]hstack', `${thuMuc}/de-xuat-${c.thu_tu}.jpg`]); } catch { /* không có tờ thì thôi */ } }
      dong.push(`→ ĐỀ XUẤT điểm vào ${vaoCua(c)}s → ${tot.v}s (đoạn qua mọi cổng chặn, ${tot.ca} cảnh báo) — xem ${thuMuc}/de-xuat-${c.thu_tu}.jpg (mở | đóng) rồi chạy --ghi-vao`);
      if (co('ghi-vao')) { doiVao.set(c.id, tot.v); b = new Map([...(b ?? new Map()), ...(tot.bv ?? new Map())]) as BoDo; ({ dong, loi } = tongHop(c, b, () => undefined)); dong.push(`→ đã ghi điểm vào ${tot.v}s (--ghi-vao)`);
        await db.execute(sql`UPDATE xv_canh SET ky_thuat = coalesce(ky_thuat, '{}'::jsonb) || jsonb_build_object('vao_s', ${tot.v}::numeric), updated_at = now() WHERE id = ${c.id}`);
        for (const l of ['clip_dau', 'clip_giua', 'clip_ket'] as const) { const f2 = `${thuMuc}/${c.id}-uv${tot.v}-${l}.jpg`; if (existsSync(f2)) execFileSync('cp', [f2, `${thuMuc}/${c.id}-${l}.jpg`]); } } }
    else if (tot && tot.ch === 0) { /* điểm vào hiện tại đã là tốt nhất */ }
    else canSinhLai.push({ c, ly: `không đoạn nào trong clip qua cổng (tốt nhất ${tot?.v}s còn ${tot?.ch} lỗi chặn)` });
  }
  if (!dong.length) continue;
  const ch = chan(loi), ca = [...canh(loi), ...(camXuc.get(c.id) ?? []).map((x) => ({ chu: `cảm xúc đo: ${x}`, muc: 'canh' as const }))];
  if (ch.length) truot++;
  console.log(`#${c.thu_tu} ${ch.length ? '✗' : '✓'}\n    ${dong.join('\n    ')}${ch.length ? `\n    → ${ch.map((x) => x.chu).join('; ')}` : ''}${ca.length ? `\n    ⚠ ${ca.map((x) => x.chu).join('; ')}` : ''}`);
  await db.execute(sql`UPDATE xv_canh SET ky_thuat = coalesce(ky_thuat, '{}'::jsonb) || jsonb_build_object('soat_noi', ${JSON.stringify({ luc: new Date().toISOString(), video_url: c.video_url ?? null, keyframe_ket: c.keyframe_ket ?? null, loi: ch.map((x) => x.chu), canh: ca.map((x) => x.chu) })}::jsonb) WHERE id = ${c.id}`);
}
// ── 5. ĐƯỜNG CẮT: clip đóng shot trước ↔ clip mở shot sau ──────────────────────────────────────────────────────────────────────────────────────────────
console.log('\nĐƯỜNG CẮT (clip đã dùng):');
for (let i = 1; i < ds.length; i++) { const a = ds[i - 1]!, b = ds[i]!; if (a.phan_doan !== b.phan_doan) continue;
  const ka = danhGia(a, 'clip_ket', bo.get(String(a.id))?.get('clip_ket'), hoiKq.get(`${a.id}:clip_ket`)), kb = danhGia(b, 'clip_dau', bo.get(String(b.id))?.get('clip_dau'), hoiKq.get(`${b.id}:clip_dau`)); if (!ka && !kb) continue;
  const l = [...chan(ka?.loi ?? []).map((x) => `cuối #${a.thu_tu}: ${x.chu}`), ...chan(kb?.loi ?? []).map((x) => `đầu #${b.thu_tu}: ${x.chu}`)];
  const da = bo.get(String(a.id))?.get('clip_ket')?.ket ?? [], db_ = bo.get(String(b.id))?.get('clip_dau')?.ket ?? [];
  for (const x of da.filter((q) => q.tin && q.nhin)) { const y = db_.find((q) => q.ten === x.ten && q.tin && q.nhin); if (y && Math.abs(x.nhin!.doc - y.nhin!.doc) > NHAY_CUI) l.push(`${x.ten} đầu nhảy qua cú cắt: cuối #${a.thu_tu} ${x.nhin!.doc}° → đầu #${b.thu_tu} ${y.nhin!.doc}° (+ = cúi)`); }
  console.log(`  #${a.thu_tu}→#${b.thu_tu} ${l.length ? `✗ ${l.join('; ')}` : '✓'}${doiVao.has(a.id) || doiVao.has(b.id) ? ' (điểm vào vừa chọn lại)' : ''}`); }
// ── 6. TỜ GHÉP đường cắt ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
{ const cap: string[] = []; let k = 0;
  for (let i = 1; i < ds.length; i++) { const a = ds[i - 1]!, b = ds[i]!; const fa = `${thuMuc}/${a.id}-clip_ket.jpg`, fb = `${thuMuc}/${b.id}-clip_dau.jpg`; if (a.phan_doan !== b.phan_doan) continue;
    const ra = `${thuMuc}/cap_${String(++k).padStart(2, '0')}.jpg`;
    try { execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', fa, '-i', fb, '-filter_complex', '[0]scale=270:480,pad=280:480:0:0:red[a];[1]scale=270:480[b];[a][b]hstack,pad=560:500:0:0:black', ra]); cap.push(`${k}: #${a.thu_tu}→#${b.thu_tu}`); } catch { k--; } }
  if (k) { try { execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '1', '-i', `${thuMuc}/cap_%02d.jpg`, '-vf', `tile=4x${Math.ceil(k / 4)}`, '-frames:v', '1', `${thuMuc}/to-ghep.jpg`]);
    console.log(`\nTờ ghép đường cắt: ${thuMuc}/to-ghep.jpg (box3): ${cap.join(' · ')}`); } catch (e) { console.error('không ghép được tờ đường cắt', e); } } }
// ── 7. SHOT CẦN SINH LẠI (+ --sinh-lai trong trần tiền) ───────────────────────────────────────────────────────────────────────────────────────────────
if (canSinhLai.length) {
  const mv = String((((await db.execute(sql`SELECT p.kinh_thanh->>'mo_hinh_video' AS m FROM xv_phim p JOIN xv_tap t ON t.phim_id = p.id WHERE t.id = ${tap}`)) as unknown as Row[])[0]?.m) || 'kie:veo3_lite');
  const giaMot = await giaVideoSv(mv, '720p', 8).catch(() => 17.5);
  console.log(`\nSHOT CẦN SINH LẠI (${canSinhLai.length}, ≈ ${Math.round(giaMot * canSinhLai.length)}¢):\n${canSinhLai.map(({ c, ly }) => `  #${c.thu_tu} (id ${c.id}): ${ly}`).join('\n')}`);
  if (co('sinh-lai')) {
    const tran = Number(gia('tran') ?? 0); if (!process.env.DUYET_SINH_1_LAN) { console.error('  --sinh-lai cần DUYET_SINH_1_LAN=1 (anh duyệt lượt này)'); process.exit(2); }
    if (tran && giaMot * canSinhLai.length > tran) { console.error(`  vượt trần ${tran}¢ — dừng, chờ anh`); process.exit(2); }
    console.log(execFileSync(process.execPath, [...process.execArgv, 'scripts/sinh-shot.mts', `--canh=${canSinhLai.map((x) => x.c.id).join(',')}`, '--video', '--thu'], { encoding: 'utf8', maxBuffer: 32 << 20, timeout: 1_200_000, env: process.env }).split('\n').filter((x) => /clip:|video:/.test(x)).join('\n'));
    console.log('  → chạy lại soat-huong.mts --chon để đo clip mới');
  }
}
console.log(`\n${truot} shot trượt cổng chặn${deXuat.size ? ` · ${deXuat.size} shot có đề xuất điểm vào mới (${[...deXuat].map(([id, v]) => `#${ds.find((c) => c.id === id)?.thu_tu}→${v}s`).join(', ')}; xem tờ de-xuat-*.jpg rồi --ghi-vao)` : ''}${doiVao.size ? ` · ${doiVao.size} shot đã ghi điểm vào` : ''}${canSinhLai.length ? ` · ${canSinhLai.length} shot cần sinh lại` : ''}`);
process.exit(0);

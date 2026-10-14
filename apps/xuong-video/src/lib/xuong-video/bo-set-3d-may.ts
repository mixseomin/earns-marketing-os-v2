// 🧊 Dựng khung xám trên máy chủ (bo-set-3d.ts là phần thuần). Mỗi shot thuộc một bộ set 3D + có may_3d → Blender (không giao diện, trên box)
// dựng set từ dữ liệu, đặt máy ảo, render khung xám + bản đồ độ sâu + kiểm hình học → R2 → xv_canh.khung_xam (gắn mã đầu vào).
// 0đ (CPU của box), ~15–20 giây / shot. MỘT chỗ cho script (scripts/bo-set.mts) và nút studio.
import 'server-only';
import { sql } from 'drizzle-orm';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { uploadToR2, deleteFromR2, r2KeyFromUrl } from '../r2';
import { khoaNho } from './anh-nho-may';
import { CO_NHO } from './anh-nho';
import { bangDung, boSetCuaShot, maKhungXam, maPhan, mayDayDu, rangBuocTruc, shotSoTruc } from './bo-set-3d';
import { locNhanh, type BoSet, type Canh, type KhungXam, type May3d } from './kieu';
import { kemBienThe, mapCanh, mapNhanVat, type Db, type Row } from './doc-db';

/** Chạy fn cho từng phần tử, tối đa n việc cùng lúc. */
async function theoLo<T>(ds: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0; await Promise.all(Array.from({ length: Math.min(n, ds.length) }, async () => { while (i < ds.length) await fn(ds[i++]!); }));
}

export const mapBoSet = (r: Row): BoSet => ({ id: Number(r.id), project: String(r.project), phim_id: r.phim_id == null ? null : Number(r.phim_id), ten: String(r.ten), mo_ta: String(r.mo_ta ?? ''),
  du_lieu: (r.du_lieu ?? { vat: [] }) as BoSet['du_lieu'], mat_bang_url: r.mat_bang_url == null ? null : String(r.mat_bang_url), trang_thai: String(r.trang_thai) });

const KICH_BAN = () => [path.join(process.cwd(), 'scripts/bo-set/dung-set.py'), '/opt/earns-marketing-os-v2/apps/xuong-video/scripts/bo-set/dung-set.py'].find((p) => existsSync(p));

function chayBlender(vao: string, ra: string, them: Record<string, string> = {}): Promise<{ ok: boolean; log: string }> {
  // Box KHÔNG render (anh 15/10/2026: "tắt Blender trên box3, chuyển hết về iMac" — box chỉ có đồ hoạ phần mềm, EEVEE rất chậm). Máy Linux
  // không bật cờ XV_BLENDER_TAI_CHO=1 thì từ chối, chỉ đường dùng iMac.
  if (process.platform === 'linux' && process.env.XV_BLENDER_TAI_CHO !== '1') return Promise.resolve({ ok: false, log: 'box không render 3D — chạy trên iMac: apps/xuong-video/scripts/bo-set/chay-imac.sh <tap_id> [--chi=…]' });
  return new Promise((res) => {
    const kb = KICH_BAN();
    if (!kb) return res({ ok: false, log: 'không thấy scripts/bo-set/dung-set.py' });
    // Có màn hình ảo Xvfb (box3) → Blender có OpenGL phần mềm → khung xám render bằng Workbench (~1–2 giây) thay Cycles CPU (~25 giây).
    const xvfb = existsSync('/usr/bin/xvfb-run');
    const lenh = ['blender', '-b', '--factory-startup', '-P', kb, '--', vao, ra];
    const p = xvfb ? spawn('xvfb-run', ['-a', '-s', '-screen 0 1280x1024x24', ...lenh], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...them, XV_NHANH: '1' } })
      : spawn(lenh[0]!, lenh.slice(1), { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...them } });
    let log = '';
    p.stdout.on('data', (d) => { log += d; }); p.stderr.on('data', (d) => { log += d; });
    p.on('error', (e) => res({ ok: false, log: `không chạy được blender: ${e.message}` }));
    p.on('close', (code) => res({ ok: code === 0 && log.includes('XONG'), log: log.slice(-2000) }));
  });
}

/** DỌN ẢNH RENDER CŨ (anh 14/10/2026: "khi chụp thì các ảnh cũ có tự dọn không?"). Ảnh khung xám / độ sâu / mặt bằng là bản DỰNG LẠI ĐƯỢC
 *  từ dữ liệu (cùng mã → cùng ảnh), nên bản bị thay thì xoá khỏi R2 cùng các ảnh nhỏ của nó — TRỪ khi còn được nhắc ở đâu đó: lệnh sinh
 *  keyframe đã gửi nó đi (xv_job.request — bằng chứng "đã gửi gì"), một bản chụp hoàn tác (xv_hoan_tac), hoặc vẫn đang dùng. */
export async function donRenderCu(db: Db, urls: string[], thu = false): Promise<{ xoa: number; giu: number }> {
  // Đọc MỘT lần mọi chỗ có thể nhắc tới ảnh (trước đây mỗi ảnh một truy vấn quét cả bảng job → 369 ảnh chạy hàng chục phút).
  const ref = ((await db.execute(sql`SELECT request::text AS t FROM xv_job WHERE request IS NOT NULL
      UNION ALL SELECT truoc::text FROM xv_hoan_tac
      UNION ALL SELECT khung_xam::text FROM xv_canh WHERE khung_xam IS NOT NULL
      UNION ALL SELECT coalesce(mat_bang_url, '') FROM xv_bo_set`)) as unknown as Row[]).map((r) => String(r.t)).join('\n');
  const goc = (process.env.R2_PUBLIC_BASE || 'https://img.on.tc').replace(/\/+$/, '');
  let xoa = 0, giu = 0;
  await theoLo([...new Set(urls.filter(Boolean))], 8, async (u) => {   // 8 ảnh một lúc
    const nho = CO_NHO.map((w) => khoaNho(u, w));
    if ([u, ...nho.map((k) => `${goc}/${k}`)].some((d) => ref.includes(d))) { giu++; return; }
    const k = r2KeyFromUrl(u); if (!k) { giu++; return; }
    if (thu) { xoa++; return; }   // chạy thử: chỉ đếm
    if (await deleteFromR2(k)) { xoa++; await Promise.all(nho.map((kn) => deleteFromR2(kn))); }
  });
  return { xoa, giu };
}

/** Dựng khung xám cho các shot của tập (mặc định: shot có may_3d mà khung xám thiếu / cũ). tatCa = dựng lại hết. */
/** che = 'xuat': chỉ chuẩn bị đầu vào Blender vào thuMuc rồi dừng (máy ngoài — iMac — render); 'nhap': không render, đọc kết quả máy ngoài đã đặt
 *  vào thuMuc rồi đẩy kho + ghi DB như thường. Khoá / DB không rời box: iMac chỉ làm thợ render (scripts/bo-set/chay-imac.sh). */
export async function dungKhungXamTap(db: Db, tapId: number, o: { tatCa?: boolean; ids?: number[]; che?: 'xuat' | 'nhap'; thuMuc?: string } = {}): Promise<{ ok: true; data: { dung: number; loi: string[]; don: { xoa: number; giu: number }; ly_do: string[]; ids: number[] } } | { ok: false; loi: string }> {
  const t = (await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[];
  if (!t[0]) return { ok: false, loi: 'không thấy tập' };
  const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${Number(t[0].phim_id)} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
  const ds = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A');
  const sets = new Map<number, BoSet>();
  for (const id of new Set(ds.map((c) => boSetCuaShot(c, nv)).filter((x): x is number => !!x))) {
    const r = (await db.execute(sql`SELECT * FROM xv_bo_set WHERE id = ${id}`)) as unknown as Row[];
    if (r[0]) sets.set(id, mapBoSet(r[0]));
  }
  // Đồ để lại (mayDayDu): máy + chỗ đứng ĐẦY ĐỦ của từng shot = khai của shot + đạo cụ còn nằm lại từ các shot trước cùng set.
  const laDoVat = (t: string) => nv.some((x) => (x.loai === 'dao_cu' || x.loai === 'san_pham') && x.ten.trim().toLowerCase() === t.trim().toLowerCase());
  const day = new Map<number, May3d>();
  for (const sid of new Set(ds.map((c) => boSetCuaShot(c, nv)).filter((x): x is number => !!x))) for (const [k, m] of mayDayDu(ds.filter((c) => boSetCuaShot(c, nv) === sid), laDoVat)) day.set(k, m);
  // Gom theo set: một lượt Blender / set (dựng set một lần, render mọi máy).
  const lyDo: string[] = [];
  const theoSet = new Map<number, (Canh & { may_3d: May3d; goc: May3d; truc: ReturnType<typeof rangBuocTruc> })[]>();
  for (const c of ds) {
    const sid = boSetCuaShot(c, nv); const set = sid ? sets.get(sid) : undefined;
    if (!set || !c.may_3d || (o.ids && !o.ids.includes(c.id))) continue;
    const mDu = day.get(c.id) ?? c.may_3d;
    if (!o.tatCa && c.khung_xam?.ma === maKhungXam(set, mDu, nv)) continue;
    // Vì sao dựng lại: phần đầu vào nào đổi so với lần dựng trước (lần dựng toàn tập không lý do = dấu hiệu dữ liệu bị ghi lại vô cớ).
    const cu0 = c.khung_xam?.ma_phan; const moi = maPhan(set, mDu, nv);
    lyDo.push(`#${c.thu_tu}:${!c.khung_xam ? 'mới' : !cu0 ? 'chưa có mã phần' : Object.keys(moi).filter((k) => cu0[k] !== moi[k as keyof typeof moi]).join('+') || 'tất cả'}`);
    // Máy tự động: bộ giải phải giữ đúng phía trục của shot so trục liền trước (cùng set, không cố ý vượt trục).
    const tr = c.may_3d.qua_truc ? null : shotSoTruc(ds, ds.indexOf(c));
    const truc = tr?.may_3d && boSetCuaShot(tr, nv) === set.id ? rangBuocTruc(tr as { id: number; may_3d: May3d }, c.may_3d, (t) => nv.some((x) => x.loai === 'nhan_vat' && x.ten.trim().toLowerCase() === t.trim().toLowerCase())) : null;
    theoSet.set(set.id, [...(theoSet.get(set.id) ?? []), { ...(c as Canh & { may_3d: May3d }), may_3d: mDu, goc: c.may_3d, truc }]);
  }
  let dung = 0; const loi: string[] = []; const cu: string[] = [];
  for (const [sid, shots] of theoSet) {
    const set = sets.get(sid)!;
    const b = bangDung(set, shots, nv);
    if (!b.ok) { loi.push(`${set.ten}: ${b.loi}`); continue; }
    // SONG SONG (anh 15/10/2026: "tối ưu rồi mà vẫn lâu"): chia shot cho tối đa 3 Blender chạy cùng lúc (box 4 nhân), thêm 1 Blender nhẹ chỉ vẽ
    // mặt bằng đủ đường đi cả tập. Mỗi phần một thư mục ra; gộp kết quả. Ràng buộc trục giữa hai phần dùng máy cũ của shot trước (dat_truoc).
    const thu = o.thuMuc ? path.join(o.thuMuc, String(sid)) : await mkdtemp(path.join(tmpdir(), 'bo-set-'));
    if (o.thuMuc) await mkdir(thu, { recursive: true });
    const soPhan = Math.max(1, Math.min(3, Math.ceil(shots.length / 3)));
    const phan = Array.from({ length: soPhan }, (_, k) => shots.filter((_s, i) => i % soPhan === k));
    const chay = async (ds0: typeof shots, ten: string, env: Record<string, string>) => {
      const bb = bangDung(set, ds0, nv); if (!bb.ok) return { ok: false, log: bb.loi, ra: '' };
      if (o.che !== 'nhap') await writeFile(path.join(thu, `${ten}.json`), JSON.stringify(bb.bang));
      if (o.che === 'xuat') return { ok: true, log: '', ra: path.join(thu, ten) };
      if (o.che === 'nhap') return { ok: existsSync(path.join(thu, ten, ten === 'mb' ? 'mat-bang.png' : 'kiem.json')), log: `máy ngoài chưa trả kết quả ${ten}`, ra: path.join(thu, ten) };
      const r = await chayBlender(path.join(thu, `${ten}.json`), path.join(thu, ten), env); return { ...r, ra: path.join(thu, ten) };
    };
    const ketQua = await Promise.all([...phan.map((p, k) => chay(p, `p${k}`, { XV_BO_MAT_BANG: '1' })), chay(shots, 'mb', { XV_CHI_MAT_BANG: '1' })]);
    if (o.che === 'xuat') { dung += shots.length; continue; }   // máy ngoài render, lượt 'nhap' ghi kết quả
    const hong = ketQua.find((r) => !r.ok);
    if (hong) { loi.push(`${set.ten}: blender lỗi — ${hong.log}`); continue; }
    const gop = async <T,>(tep: string) => Object.assign({}, ...(await Promise.all(ketQua.slice(0, -1).map(async (r) => JSON.parse(await readFile(path.join(r.ra, tep), 'utf8').catch(() => '{}'))))) ) as Record<string, T>;
    const raCua = new Map<string, string>(); ketQua.slice(0, -1).forEach((r, k) => phan[k]!.forEach((c) => raCua.set(String(c.id), r.ra)));
    const kiem = await gop<KhungXam['kiem']>('kiem.json');
    // Bộ giải máy đã dời máy tự động cho chủ thể thấy rõ → ghi máy mới vào shot (mã khung xám tính trên máy đã giải).
    const thay = await gop<NonNullable<KhungXam['thay']>>('thay.json');
    const di = await gop<NonNullable<KhungXam['di']>>('di.json');
    const giai = await gop<{ dat: number[] }>('giai.json');
    // Ghi máy đã giải vào máy KHAI của shot (không ghi đồ để lại — chúng là trạng thái tính ra, không phải khai).
    for (const c of shots) { const g = giai[String(c.id)]; if (g) { c.may_3d = { ...c.may_3d, dat: g.dat }; c.goc = { ...c.goc, dat: g.dat }; await db.execute(sql`UPDATE xv_canh SET may_3d = ${JSON.stringify(c.goc)}::jsonb WHERE id = ${c.id}`); } }
    const luc = new Date().toISOString();
    // Đẩy kho SONG SONG 8 shot một lúc, 4 ảnh mỗi shot cùng lúc (trước đây lần lượt ~140 ảnh → nhiều phút chỉ vì độ trễ mạng mỗi lần gọi).
    await theoLo(shots, 8, async (c) => {
      const ma = maKhungXam(set, c.may_3d, nv);
      const ra = raCua.get(String(c.id))!;
      const len = async (duoi: string) => uploadToR2(`xuong-video/khung-xam/${c.id}-${ma}-${duoi}.png`, await readFile(path.join(ra, `${c.id}-${duoi}.png`)), 'image/png');
      const [xam, sau, mau, mauKet] = await Promise.all([len('xam'), len('sau'), existsSync(path.join(ra, `${c.id}-mau.png`)) ? len('mau') : null, existsSync(path.join(ra, `${c.id}-mau-ket.png`)) ? len('mau-ket') : null]);
      if (!xam || !sau) { loi.push(`#${c.thu_tu}: không đẩy được ảnh lên kho`); return; }
      const kx: KhungXam = { ma, ma_phan: maPhan(set, c.may_3d, nv), xam, sau, ...(mau ? { mau } : {}), ...(mauKet ? { mau_ket: mauKet } : {}), ...(di[String(c.id)] ? { di: di[String(c.id)] } : {}), luc, kiem: kiem[String(c.id)] ?? [], thay: thay[String(c.id)] ?? [] };
      await db.execute(sql`UPDATE xv_canh SET khung_xam = ${JSON.stringify(kx)}::jsonb WHERE id = ${c.id}`);
      if (c.khung_xam) cu.push(c.khung_xam.xam, c.khung_xam.sau, c.khung_xam.mau ?? '', c.khung_xam.mau_ket ?? '');
      dung++;
    });
    const mbCu = set.mat_bang_url;
    const mb = await uploadToR2(`xuong-video/bo-set/${sid}-mat-bang-${Date.now()}.png`, await readFile(path.join(ketQua[ketQua.length - 1]!.ra, 'mat-bang.png')), 'image/png');
    if (mb) { await db.execute(sql`UPDATE xv_bo_set SET mat_bang_url = ${mb}, updated_at = now() WHERE id = ${sid}`); if (mbCu) cu.push(mbCu); }
  }
  const don = o.che === 'xuat' ? { xoa: 0, giu: 0 } : await donRenderCu(db, cu);
  return { ok: true, data: { dung, loi, don, ly_do: lyDo, ids: [...theoSet.values()].flat().map((c) => c.id) } };
}

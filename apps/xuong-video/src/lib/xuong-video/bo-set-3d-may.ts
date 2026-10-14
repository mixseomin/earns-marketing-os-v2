// 🧊 Dựng khung xám trên máy chủ (bo-set-3d.ts là phần thuần). Mỗi shot thuộc một bộ set 3D + có may_3d → Blender (không giao diện, trên box)
// dựng set từ dữ liệu, đặt máy ảo, render khung xám + bản đồ độ sâu + kiểm hình học → R2 → xv_canh.khung_xam (gắn mã đầu vào).
// 0đ (CPU của box), ~15–20 giây / shot. MỘT chỗ cho script (scripts/bo-set.mts) và nút studio.
import 'server-only';
import { sql } from 'drizzle-orm';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { uploadToR2 } from '../r2';
import { bangDung, boSetCuaShot, maKhungXam, rangBuocTruc, shotSoTruc } from './bo-set-3d';
import { locNhanh, type BoSet, type Canh, type KhungXam, type May3d } from './kieu';
import { kemBienThe, mapCanh, mapNhanVat, type Db, type Row } from './doc-db';

export const mapBoSet = (r: Row): BoSet => ({ id: Number(r.id), project: String(r.project), phim_id: r.phim_id == null ? null : Number(r.phim_id), ten: String(r.ten), mo_ta: String(r.mo_ta ?? ''),
  du_lieu: (r.du_lieu ?? { vat: [] }) as BoSet['du_lieu'], mat_bang_url: r.mat_bang_url == null ? null : String(r.mat_bang_url), trang_thai: String(r.trang_thai) });

const KICH_BAN = () => [path.join(process.cwd(), 'scripts/bo-set/dung-set.py'), '/opt/earns-marketing-os-v2/apps/xuong-video/scripts/bo-set/dung-set.py'].find((p) => existsSync(p));

function chayBlender(vao: string, ra: string): Promise<{ ok: boolean; log: string }> {
  return new Promise((res) => {
    const kb = KICH_BAN();
    if (!kb) return res({ ok: false, log: 'không thấy scripts/bo-set/dung-set.py' });
    const p = spawn('blender', ['-b', '--factory-startup', '-P', kb, '--', vao, ra], { stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    p.stdout.on('data', (d) => { log += d; }); p.stderr.on('data', (d) => { log += d; });
    p.on('error', (e) => res({ ok: false, log: `không chạy được blender: ${e.message}` }));
    p.on('close', (code) => res({ ok: code === 0 && log.includes('XONG'), log: log.slice(-2000) }));
  });
}

/** Dựng khung xám cho các shot của tập (mặc định: shot có may_3d mà khung xám thiếu / cũ). tatCa = dựng lại hết. */
export async function dungKhungXamTap(db: Db, tapId: number, o: { tatCa?: boolean; ids?: number[] } = {}): Promise<{ ok: true; data: { dung: number; loi: string[] } } | { ok: false; loi: string }> {
  const t = (await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[];
  if (!t[0]) return { ok: false, loi: 'không thấy tập' };
  const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${Number(t[0].phim_id)} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
  const ds = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A');
  const sets = new Map<number, BoSet>();
  for (const id of new Set(ds.map((c) => boSetCuaShot(c, nv)).filter((x): x is number => !!x))) {
    const r = (await db.execute(sql`SELECT * FROM xv_bo_set WHERE id = ${id}`)) as unknown as Row[];
    if (r[0]) sets.set(id, mapBoSet(r[0]));
  }
  // Gom theo set: một lượt Blender / set (dựng set một lần, render mọi máy).
  const theoSet = new Map<number, (Canh & { may_3d: May3d; truc: ReturnType<typeof rangBuocTruc> })[]>();
  for (const c of ds) {
    const sid = boSetCuaShot(c, nv); const set = sid ? sets.get(sid) : undefined;
    if (!set || !c.may_3d || (o.ids && !o.ids.includes(c.id))) continue;
    if (!o.tatCa && c.khung_xam?.ma === maKhungXam(set, c.may_3d, nv)) continue;
    // Máy tự động: bộ giải phải giữ đúng phía trục của shot so trục liền trước (cùng set, không cố ý vượt trục).
    const tr = c.may_3d.qua_truc ? null : shotSoTruc(ds, ds.indexOf(c));
    const truc = tr?.may_3d && boSetCuaShot(tr, nv) === set.id ? rangBuocTruc(tr.may_3d, c.may_3d, (t) => nv.some((x) => x.loai === 'nhan_vat' && x.ten.trim().toLowerCase() === t.trim().toLowerCase())) : null;
    theoSet.set(set.id, [...(theoSet.get(set.id) ?? []), { ...(c as Canh & { may_3d: May3d }), truc }]);
  }
  let dung = 0; const loi: string[] = [];
  for (const [sid, shots] of theoSet) {
    const set = sets.get(sid)!;
    const b = bangDung(set, shots, nv);
    if (!b.ok) { loi.push(`${set.ten}: ${b.loi}`); continue; }
    const thu = await mkdtemp(path.join(tmpdir(), 'bo-set-'));
    await writeFile(path.join(thu, 'vao.json'), JSON.stringify(b.bang));
    const r = await chayBlender(path.join(thu, 'vao.json'), path.join(thu, 'ra'));
    if (!r.ok) { loi.push(`${set.ten}: blender lỗi — ${r.log}`); continue; }
    const kiem = JSON.parse(await readFile(path.join(thu, 'ra', 'kiem.json'), 'utf8')) as Record<string, KhungXam['kiem']>;
    // Bộ giải máy đã dời máy tự động cho chủ thể thấy rõ → ghi máy mới vào shot (mã khung xám tính trên máy đã giải).
    const thay = JSON.parse(await readFile(path.join(thu, 'ra', 'thay.json'), 'utf8').catch(() => '{}')) as Record<string, NonNullable<KhungXam['thay']>>;
    const giai = JSON.parse(await readFile(path.join(thu, 'ra', 'giai.json'), 'utf8').catch(() => '{}')) as Record<string, { dat: number[] }>;
    for (const c of shots) { const g = giai[String(c.id)]; if (g) { c.may_3d = { ...c.may_3d, dat: g.dat }; await db.execute(sql`UPDATE xv_canh SET may_3d = ${JSON.stringify(c.may_3d)}::jsonb WHERE id = ${c.id}`); } }
    const luc = new Date().toISOString();
    for (const c of shots) {
      const ma = maKhungXam(set, c.may_3d, nv);
      const len = async (duoi: string) => uploadToR2(`xuong-video/khung-xam/${c.id}-${ma}-${duoi}.png`, await readFile(path.join(thu, 'ra', `${c.id}-${duoi}.png`)), 'image/png');
      const [xam, sau] = [await len('xam'), await len('sau')];
      if (!xam || !sau) { loi.push(`#${c.thu_tu}: không đẩy được ảnh lên kho`); continue; }
      const kx: KhungXam = { ma, xam, sau, luc, kiem: kiem[String(c.id)] ?? [], thay: thay[String(c.id)] ?? [] };
      await db.execute(sql`UPDATE xv_canh SET khung_xam = ${JSON.stringify(kx)}::jsonb WHERE id = ${c.id}`);
      dung++;
    }
    const mb = await uploadToR2(`xuong-video/bo-set/${sid}-mat-bang-${Date.now()}.png`, await readFile(path.join(thu, 'ra', 'mat-bang.png')), 'image/png');
    if (mb) await db.execute(sql`UPDATE xv_bo_set SET mat_bang_url = ${mb}, updated_at = now() WHERE id = ${sid}`);
  }
  return { ok: true, data: { dung, loi } };
}

// So ô 3D sống (three.js, bo-set-three.ts) với khung Blender: chiếu hộp từng vật trong may_3d.vi_tri qua máy shot → tâm khung (0–1),
// đối chiếu khung_xam.thay (lưới tia Blender). Lệch lớn = ô lưới vẽ khác ảnh Blender. Chạy: tsx scripts/kiem-3d-song.mts <tap_id>
import * as THREE from 'three';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, mapNhanVat } from '../src/lib/xuong-video/doc-db';
import { mapBoSet } from '../src/lib/xuong-video/bo-set-3d-may';
import { boSetCuaShot } from '../src/lib/xuong-video/bo-set-3d';
import { V, nhanVat, fovMay, type KhoiNv } from '../src/lib/xuong-video/bo-set-three';

const tapId = Number(process.argv[2]); const db = getDb()!;
type R = Record<string, unknown>;
const t = ((await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id=${tapId}`)) as unknown as R[])[0]!;
const nv = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id=${Number(t.phim_id)}`)) as unknown as R[]).map(mapNhanVat);
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id=${tapId} ORDER BY thu_tu`)) as unknown as R[]).map(mapCanh);
const sets = ((await db.execute(sql`SELECT * FROM xv_bo_set`)) as unknown as R[]).map(mapBoSet);
let tong = 0, lon = 0;
for (const c of ds) {
  const m = c.may_3d; const kx = c.khung_xam; if (!m || !kx?.thay?.length || !boSetCuaShot(c, nv) || !sets.length) continue;
  const cam = new THREE.PerspectiveCamera(fovMay(m.ong_kinh, true), 9 / 16, 0.1, 3000);
  cam.position.copy(V(m.dat)); cam.lookAt(V(m.nhin)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const ra: string[] = [];
  for (const v of m.vi_tri) {
    const k = nv.find((x) => x.ten === v.ten)?.khoi_3d as KhoiNv | undefined; const th = kx.thay.find((x) => x.ten === v.ten);
    if (!k || !th || th.pt < 2) continue;
    // Hộp chiếu 8 góc, kẹp vào khung (Blender đo phần THẤY được) → tâm phần thấy.
    const b = new THREE.Box3().setFromObject(nhanVat(k, v)); const xs: number[] = [], ys: number[] = [];
    for (const gx of [b.min.x, b.max.x]) for (const gy of [b.min.y, b.max.y]) for (const gz of [b.min.z, b.max.z]) { const q = new THREE.Vector3(gx, gy, gz).project(cam); xs.push(Math.min(1, Math.max(0, (q.x + 1) / 2))); ys.push(Math.min(1, Math.max(0, (1 - q.y) / 2))); }
    const [x, y] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; const [bx, by] = [(th.hop[0] + th.hop[2]) / 2, (th.hop[1] + th.hop[3]) / 2];
    const d = Math.hypot(x - bx, y - by); tong++; if (d > 0.12) lon++;
    ra.push(`${v.ten} ${Math.round(d * 100)}%`);
  }
  if (ra.length) console.log(`#${c.thu_tu}`, ra.join(' · '));
}
console.log(`so ${tong} vật · lệch >12% khung: ${lon}`);
process.exit(0);

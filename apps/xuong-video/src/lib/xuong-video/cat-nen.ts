// TÁCH NỀN NHÂN VẬT cho khuôn "Một dáng, mọi nơi" (dòng Thương hiệu, anh 15/10/2026: "một người đứng cố định còn cảnh đổi"):
// sinh MỘT ảnh người (đúng dáng, cầm sản phẩm) trên nền xanh phẳng → ffmpeg chromakey + despill → PNG trong suốt → R2 → điền vào lớp phủ ảnh
// của tập (kieu.ts › Lop, id ID_LOP_CAT_NEN, mang_sp) kéo suốt chuỗi shot đổi nền. Bản xuất ghép bằng overlay sẵn có (lop.ts › lopAnhLoc),
// timeline xem trước cũng thấy. Chỉ bước sinh ảnh tốn tiền (sinh-anh.ts › sinhAnhCatNen); tách nền 0đ.
import 'server-only';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { uploadToR2 } from '../r2';
import type { Lop, NhanVat } from './kieu';
import type { Db, Row } from './doc-db';

const run = promisify(execFile);
/** Màu nền yêu cầu model vẽ — xanh lục thuần, không có trong da / tóc / quần áo thường ngày. */
export const MAU_XANH_NEN = '#00FF00';
/** id lớp phủ ảnh trong tap.lop mà template "đổi nền" mang sẵn (url trống) — tách nền xong điền url vào đây. */
export const ID_LOP_CAT_NEN = 'cat-nen';

/** Prompt ảnh người nền xanh: một dáng cố định, cầm sản phẩm, nền xanh phẳng không bóng. Thuần. */
export function promptCatNen(nv: Pick<NhanVat, 'ten' | 'mo_ta'>, dang: string, sp: Pick<NhanVat, 'ten' | 'mo_ta'>[], soRefNguoi: number, soRefSp: number): string {
  const refNguoi = soRefNguoi ? `Reference image${soRefNguoi > 1 ? `s 1–${soRefNguoi} show` : ' 1 shows'} the person — keep the SAME face, hair, age, skin and body type. ` : '';
  const refSp = soRefSp ? `Reference image${soRefSp > 1 ? `s ${soRefNguoi + 1}–${soRefNguoi + soRefSp} show` : ` ${soRefNguoi + 1} shows`} the product — copy it EXACTLY, never a generic version. ` : '';
  // Dáng quyết định cầm gì (ô "dang"); danh sách sản phẩm chỉ để nhận diện — kẻo model nhét cả túi mở lẫn hộp gấp vào tay (15/10/2026).
  return [
    `Full-body studio photo for green-screen compositing, vertical 9:16. ${nv.ten}: ${nv.mo_ta}. Pose: ${dang}. She holds exactly what the pose describes and nothing else.`,
    sp.length ? `Product identity for reference (only the item named in the pose appears): ${sp.map((s) => `${s.ten} — ${s.mo_ta}`).join(' | ')}.` : '',
    refNguoi + refSp,
    `Background: completely flat, uniform pure chroma green ${MAU_XANH_NEN} filling the entire frame edge to edge; no floor line, no horizon, no shadow cast on the background, no green light spill on the person.`,
    'Even soft frontal studio lighting, sharp focus, feet fully visible with a small margin below, person centered and about 85% of frame height, facing the camera, natural relaxed expression.',
    'Absolutely NO text, letters, logos or watermarks.',
  ].filter(Boolean).join(' ');
}

/** Ảnh nền xanh (url) → PNG trong suốt trên R2 (xuong-video/<khoa>-<uuid>.png). null = tải / ffmpeg hỏng. */
export async function catNen(urlAnh: string, khoa: string): Promise<string | null> {
  const thu = await mkdtemp(join(tmpdir(), 'cat-nen-'));
  try {
    const r = await fetch(urlAnh, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) return null;
    const vao = join(thu, 'vao.png'); const ra = join(thu, 'ra.png');
    await writeFile(vao, Buffer.from(await r.arrayBuffer()));
    // chromakey (YUV, mép mềm) rồi despill gỡ viền xanh bám tóc / vai; giữ RGBA. expand=0: expand 0,3 trừ xanh cả trên màu trung tính → áo trắng
    // hoá hồng (18/10/2026 tổng tài #12/#14: (228,230,225) → (228,199,224)); mix 0,5 + expand 0 giữ trắng (228,226,224).
    await run('ffmpeg', ['-hide_banner', '-nostats', '-y', '-i', vao, '-vf', `format=rgba,chromakey=0x00FF00:0.22:0.10,despill=type=green:mix=0.5:expand=0,format=rgba`, ra], { timeout: 60_000 });
    return await uploadToR2(`xuong-video/${khoa}-${randomUUID()}.png`, await readFile(ra), 'image/png');
  } catch (e) { console.error('[cat-nen] hỏng', urlAnh, e); return null; }
  finally { await rm(thu, { recursive: true, force: true }).catch(() => {}); }
}

/** Điền url PNG vào lớp phủ ID_LOP_CAT_NEN của mọi tập trong phim (lớp do template mang sẵn). Trả số tập đã điền. */
export async function ganCatNenVaoLop(db: Db, phimId: number, pngUrl: string): Promise<number> {
  const ds = (await db.execute(sql`SELECT id, lop FROM xv_tap WHERE phim_id = ${phimId}`)) as unknown as Row[];
  let n = 0;
  for (const t of ds) {
    const lop = ((t.lop ?? []) as Lop[]);
    if (!lop.some((l) => l.id === ID_LOP_CAT_NEN)) continue;
    const moi = lop.map((l) => (l.id === ID_LOP_CAT_NEN ? { ...l, url: pngUrl, an: false } : l));
    await db.execute(sql`UPDATE xv_tap SET lop = ${JSON.stringify(moi)}::jsonb, updated_at = now() WHERE id = ${Number(t.id)}`);
    n++;
  }
  return n;
}

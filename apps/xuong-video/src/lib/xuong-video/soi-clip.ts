// MÁY SOI CLIP (16/10/2026 — anh: "giải pháp kỹ thuật để không phải nhắc sửa từng tí"). Clip về là soi ngay, 0đ, chạy trên máy chủ:
//   - chữ lạ: tesseract đọc 6 khung — model tự in phụ đề / chữ (Grok "Look at that fit!" #54 shot 6, 9) dù prompt cấm;
//   - sản phẩm còn trong khung: màu chủ đạo của ảnh gốc sản phẩm, đo qua từng khung — máy đẩy vào ngực làm quần ra khỏi khung (#54 shot 9).
// Kết quả ghi xv_canh.soi_clip (gắn url clip). Bản xuất không nhận clip còn lỗi soi (xuat-tap.ts); người duyệt bấm bỏ qua nếu máy báo nhầm.
// MỘT đường cho lúc nhận clip (sinh-video.ts › kiemVideoTap) và script soi lại (scripts/soi-clip.mts). Phép đo thuần: soi-clip-do.ts.
import 'server-only';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { mauSanPham, tiLeMau, giayMatSanPham, chuTrongKhung, VANG_SP, type MauSp } from './soi-clip-do';
import { mapCanh, mapNhanVat, type Db, type Row } from './doc-db';
import type { Canh, SoiClip } from './kieu';

const chay = (cmd: string, args: string[]) => new Promise<Buffer | null>((ok) => execFile(cmd, args, { encoding: 'buffer', maxBuffer: 1 << 26, timeout: 60_000 }, (e, b) => ok(e ? null : (b as Buffer))));
const doDai = async (url: string) => { const b = await chay('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', url]); const g = Number(String(b ?? '').trim()); return Number.isFinite(g) && g > 0 ? g : null; };
/** Một khung rgb24 rộng 96 điểm (đủ để đo màu, nhanh). */
const khungNho = async (url: string, t: number) => { const b = await chay('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', url, '-frames:v', '1', '-vf', 'scale=96:-2', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']); return b?.length ? new Uint8Array(b) : null; };

/** Sản phẩm gắn vào shot + màu đo được từ ảnh gốc (null = không có sản phẩm / sản phẩm không màu nổi). */
async function mauSpShot(db: Db, nhanVat: number[]): Promise<{ ten: string; mau: MauSp } | null> {
  if (!nhanVat.length) return null;
  const sp = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE loai = 'san_pham' AND id = ANY(${`{${nhanVat.join(',')}}`}::int[])`)) as unknown as Row[]).map(mapNhanVat);
  const anh = (await Promise.all(sp.flatMap((v) => v.anh_ref.slice(0, 3)).map((u) => khungNho(u, 0)))).filter((x) => x != null) as Uint8Array[];
  const mau = anh.length ? mauSanPham(anh) : null;
  return mau ? { ten: sp.map((v) => v.ten).join(', '), mau } : null;
}
const loiVang = (ten: string, tl: number) => `khung không thấy sản phẩm (${ten}) — màu sản phẩm chỉ ${(tl * 100).toFixed(1)}% khung: sản phẩm vắng hoặc sai màu (vd mặc quần khác)`;
/** Cổng sinh clip (sinh-video.ts, phim QC): keyframe gắn sản phẩm mà không thấy màu sản phẩm → không tiêu tiền clip lên khung sai. null = đạt. */
export async function khungDauThieuSp(db: Db, c: Pick<Canh, 'keyframe_url' | 'nhan_vat'>): Promise<string | null> {
  if (!c.keyframe_url) return null;
  const m = await mauSpShot(db, c.nhan_vat);
  const k = m ? await khungNho(c.keyframe_url, 0) : null;
  if (!m || !k) return null;
  const tl = tiLeMau(k, m.mau);
  return tl < VANG_SP ? `keyframe ${loiVang(m.ten, tl)} — sinh lại keyframe` : null;
}
/** Soi clip đang dùng của một shot, ghi kết quả. Trả lỗi tìm được (rỗng = đạt) hoặc null khi shot chưa có clip / không đọc được clip. */
export async function soiClipCanh(db: Db, canhId: number): Promise<SoiClip | null> {
  const r = ((await db.execute(sql`SELECT * FROM xv_canh WHERE id = ${canhId}`)) as unknown as Row[])[0];
  if (!r) return null;
  const c = mapCanh(r);
  const url = c.video_cuoi_url || c.video_url;
  if (!url) return null;
  const dai = await doDai(url);
  if (!dai) return null;
  const giay = [0.1, dai * 0.2, dai * 0.4, dai * 0.6, dai * 0.8, Math.max(0.1, dai - 0.3)].map((x) => Math.round(x * 10) / 10);
  const loi: string[] = [];
  // Chữ lạ: chữ màn studio chồng lúc XUẤT, không nằm trong clip → mọi chữ đọc được trong clip là model tự in.
  const thu = await mkdtemp(join(tmpdir(), 'soi-clip-'));
  const chu: string[] = [];
  try {
    for (const [i, t] of giay.entries()) {
      const png = join(thu, `${i}.png`);
      if (!(await chay('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', url, '-frames:v', '1', '-vf', 'scale=720:-2', png]))) continue;
      const tsv = await chay('tesseract', [png, 'stdout', '--psm', '11', '-l', 'eng', 'tsv']);
      const tu = tsv ? chuTrongKhung(String(tsv)) : [];
      if (tu.length >= 2) chu.push(`${t}s: ${tu.join(' ')}`);
    }
  } finally { await rm(thu, { recursive: true, force: true }); }
  if (chu.length) loi.push(`chữ lạ model tự in trong clip (${chu[0]}${chu.length > 1 ? ` · +${chu.length - 1} khung` : ''})`);
  // Sản phẩm còn trong khung: chỉ shot gắn sản phẩm có ảnh gốc màu nổi. Đo theo LƯỢNG màu — sản phẩm bị cắt còn một dải ở mép (máy đẩy
  // vào) mà lượng màu không giảm thì không bắt được; lỗi đó chặn từ kịch bản (san-pham-shot.ts › loiSanPhamShot).
  const sp = await mauSpShot(db, c.nhan_vat);
  const mau: number[] = [];
  if (sp) {
    for (const t of giay) { const k = await khungNho(url, t); mau.push(k ? Math.round(tiLeMau(k, sp.mau) * 1000) / 1000 : 0); }
    const mat = giayMatSanPham(mau, giay);
    if (mat === 'vang') loi.push(loiVang(sp.ten, mau[0]!));
    else if (typeof mat === 'number') loi.push(`sản phẩm (${sp.ten}) ra khỏi khung hoặc đổi màu từ giây ${mat} — màu sản phẩm còn ${Math.round((Math.min(...mau.slice(1)) / mau[0]!) * 100)}% so với khung đầu`);
  }
  const kq: SoiClip = { url, luc: new Date().toISOString(), loi, do: { mau, chu } };
  await db.execute(sql`UPDATE xv_canh SET soi_clip = ${JSON.stringify(kq)}::jsonb WHERE id = ${canhId}`);
  return kq;
}

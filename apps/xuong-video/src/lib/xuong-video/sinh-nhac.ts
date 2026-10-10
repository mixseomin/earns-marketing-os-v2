// Lõi sinh nhạc nền của một tập — tách khỏi actions.ts để script trên box (scripts/sinh-shot.mts --nhac) và nút trên studio dùng CÙNG
// một đường; actions chỉ kiểm quyền rồi gọi vào đây. TỐN TIỀN — chỉ chạy khi anh duyệt con số.
import 'server-only';
import { sql } from 'drizzle-orm';
import { dayViecAm } from './hoan-tat';
import { giaAm, moHinhAm, giayNhac } from './am-thanh';
import { promptKyThuatVideo } from './dien-anh';
import { boiCanhTap, mapCanh, taoJob, type Db, type Row } from './doc-db';

type Kq<T = undefined> = { ok: true; data: T } | { ok: false; loi: string };
const loi = (m: string): { ok: false; loi: string } => ({ ok: false, loi: m });

/** Sinh nhạc nền: theo TỪNG PHÂN CẢNH (mặc định — mỗi đoạn đúng không khí + cảm xúc của phân cảnh, dài bằng phân cảnh) hoặc một bài cả tập.
 *  phanDoan: tên một phân cảnh · '*' = mọi phân cảnh · undefined = một bài cả tập. */
export async function sinhNhacTap(db: Db, tapId: number, model = 'cassetteai/music-generator', phanDoan?: string, moTaThem = ''): Promise<Kq<number>> {
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  if (!moHinhAm(model) || moHinhAm(model)!.loai !== 'nhac') return loi('model nhạc không hợp lệ');
  const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
  const tl = bc.kt.the_loai ? `Genre: ${bc.kt.the_loai.replace('_', ' ')}` : '';
  const dauVao = (prompt: string, giay: number) => (model.includes('elevenlabs') ? { prompt, music_length_ms: giay * 1000, force_instrumental: true } : { prompt, duration: giay });
  const nhacCua = (shots: typeof ds) => [...new Set(shots.map((c) => promptKyThuatVideo({ nhac: c.ky_thuat.nhac }).replace(/^Music:\s*/, '').replace(/\.$/, '')).filter(Boolean))];
  if (phanDoan === undefined) {
    const giay = giayNhac(ds);
    const cx = ds.map((c) => c.cam_xuc);
    const prompt = [moTaThem || bc.tap.nhac_mo_ta, tl, nhacCua(ds).length ? `Style: ${nhacCua(ds).join('; ')}` : '', cx.length ? `emotional arc from ${cx[0]} to ${cx[cx.length - 1]} (scale -5..5)` : '', 'instrumental background score, no vocals'].filter(Boolean).join('. ');
    const gia = giaAm(model, giay);
    const job = await taoJob(db, { phim_id: bc.tap.phim_id, nhan: `Nhạc nền cả tập ${bc.tap.so} (${giay}s)`, loai: 'am', provider: 'fal', model: `fal:${model}`, request: { dich: 'nhac', gia, tap_id: tapId, prompt } });
    if (moTaThem) await db.execute(sql`UPDATE xv_tap SET nhac_mo_ta = ${moTaThem}, updated_at = now() WHERE id = ${tapId}`);
    await dayViecAm({ kieu: 'am', job, model, input: dauVao(prompt, giay), thuMuc: `nhac/${tapId}` });
    return { ok: true, data: 1 };
  }
  const tenPc = phanDoan === '*' ? [...new Set(ds.map((c) => c.phan_doan).filter(Boolean))] : [phanDoan];
  if (!tenPc.length) return loi('tập chưa có phân cảnh — tách lại cảnh để có phân cảnh, hoặc sinh một bài cả tập');
  for (const ten of tenPc) {
    const shots = ds.filter((c) => c.phan_doan === ten);
    if (!shots.length) continue;
    const pc = bc.tap.phan_canh.find((x) => x.ten === ten);
    const giay = giayNhac(shots);
    const nhip = pc?.nhip === 'nhanh' ? 'fast tempo' : pc?.nhip === 'cham' ? 'slow tempo' : 'medium tempo';
    const prompt = [moTaThem, tl, nhacCua(shots).length ? `Style: ${nhacCua(shots).join('; ')}` : '', pc ? `Scene mood moves from ${pc.cam_xuc_dau} to ${pc.cam_xuc_cuoi} on a -5..5 scale (${pc.cam_xuc_cuoi > pc.cam_xuc_dau ? 'building hope/energy' : pc.cam_xuc_cuoi < pc.cam_xuc_dau ? 'darkening, tension or sadness' : 'steady'})` : '', nhip, 'instrumental cue, no vocals, clean start and ending'].filter(Boolean).join('. ');
    const gia = giaAm(model, giay);
    const job = await taoJob(db, { phim_id: bc.tap.phim_id, nhan: `Nhạc phân cảnh · ${ten} (${giay}s)`, loai: 'am', provider: 'fal', model: `fal:${model}`, request: { dich: 'nhac', gia, tap_id: tapId, phan_doan: ten, prompt } });
    await dayViecAm({ kieu: 'am', job, model, input: dauVao(prompt, giay), thuMuc: `nhac/${tapId}` });
  }
  return { ok: true, data: tenPc.length };
}


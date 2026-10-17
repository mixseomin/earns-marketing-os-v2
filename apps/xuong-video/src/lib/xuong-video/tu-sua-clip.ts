// VÒNG TỰ SỬA CLIP (anh 17/10/2026: "tự động hoàn thành, fix làm sao ra được video không bị lỗi … đéo phải cứ hỏi xin suốt ngày"). Shot nào
// clip còn lỗi soi (soi-clip.ts: chữ lạ, sản phẩm vắng, mặt trôi, biến dạng) hoặc lượt sinh bị từ chối → Gemini viết lại prompt video theo lỗi
// vừa gặp + luật đã học (tu-sua-clip-do.ts) → lint → sinh lại QUA ĐÚNG CỔNG STUDIO (batDauVideoCanh) → máy soi tự chạy lúc nhận clip.
// Tối đa `toiDa` lần mỗi shot; vẫn hỏng thì dừng, để lại lỗi trên shot (bản xuất không nhận). Mọi lượt tốn tiền ghi xv_job như thường.
import 'server-only';
import { sql } from 'drizzle-orm';
import { batDauVideoCanh, kiemVideoTap } from './sinh-video';
import { goiGeminiJson, MO_HINH_BD } from './soi-bien-dang';
import { lintPrompt, loiDanSuaPrompt } from './tu-sua-clip-do';
import { ghiTienChu, mapCanh, type Db, type Row } from './doc-db';
import { loiSoiClip, locNhanh, type Canh } from './kieu';

const ngu = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const docCanh = async (db: Db, id: number): Promise<Canh> => mapCanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE id = ${id}`)) as unknown as Row[])[0]!);

/** Viết lại prompt video của một shot theo lỗi vừa gặp (Gemini, ~0.1¢). Prompt mới vẫn vi phạm luật → thử lại một lần; vẫn vi phạm → null. */
async function vietLaiPrompt(db: Db, c: Canh, phimId: number, loi: string[], daThu: string[]): Promise<string | null> {
  for (let i = 0; i < 2; i++) {
    const r = await goiGeminiJson<{ prompt?: string }>([{ text: loiDanSuaPrompt({ prompt: c.prompt_video, chu: c.chu_man, loi, daThu }) }],
      { type: 'OBJECT', properties: { prompt: { type: 'STRING' } }, required: ['prompt'] });
    if (!r) return null;
    await ghiTienChu(db, phimId, `viết lại prompt video #${c.thu_tu}`, MO_HINH_BD, r.tk, 'google');
    const p = (r.data.prompt ?? '').trim();
    if (p && !lintPrompt(p).length) return p;
    daThu = [...daThu, p];
  }
  return null;
}

export type KetTuSua = { thu_tu: number; ket: 'sach' | 'het_luot' | 'loi'; lan: number; loi: string[] };
/** Chạy vòng tự sửa cho mọi shot nhánh A của tập có clip lỗi (hoặc chỉ `chi`). log: in tiến độ. */
export async function tuSuaClipTap(db: Db, tapId: number, o: { toiDa?: number; chi?: number[]; log?: (s: string) => void } = {}): Promise<KetTuSua[]> {
  const log = o.log ?? (() => {}); const toiDa = o.toiDa ?? 3;
  const phimId = Number(((await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[])[0]?.phim_id);
  const tatCa = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A');
  const ra: KetTuSua[] = [];
  for (const c0 of tatCa.filter((c) => (!o.chi || o.chi.includes(c.id)))) {
    let c = c0; let loi = loiSoiClip(c); const daThu: string[] = [];
    if (!loi.length && (c.video_cuoi_url || c.video_url) && !lintPrompt(c.prompt_video).length) continue;
    if (!loi.length && lintPrompt(c.prompt_video).length) loi = lintPrompt(c.prompt_video).map((l) => `prompt vi phạm luật: ${l.vi}`);
    let lan = 0, ket: KetTuSua['ket'] = 'het_luot';
    while (lan < toiDa) {
      lan++;
      const moi = await vietLaiPrompt(db, c, phimId, loi, daThu);
      if (!moi) { ket = 'loi'; loi = [...loi, 'không viết lại được prompt sạch']; break; }
      daThu.push(c.prompt_video);
      await db.execute(sql`UPDATE xv_canh SET prompt_video = ${moi}, trang_thai = 'duyet', loi = '', updated_at = now() WHERE id = ${c.id}`);
      log(`  #${c.thu_tu} lần ${lan}: ${moi}`);
      const r = await batDauVideoCanh(db, c.id, undefined, 'nhap');
      if (!r.ok) { loi = [`không gửi được: ${r.loi}`]; log(`  #${c.thu_tu} ✗ ${r.loi}`); if (/THEO NGÀY|hạn mức/i.test(r.loi)) { ket = 'loi'; break; } continue; }
      // đợi job (soi clip tự chạy lúc nhận — sinh-video.ts › kiemVideoTap)
      const t0 = Date.now();
      while (Date.now() - t0 < 15 * 60_000) {
        await ngu(10_000); await kiemVideoTap(db, tapId).catch(() => null);
        const j = ((await db.execute(sql`SELECT trang_thai, loi FROM xv_job WHERE id = ${r.data}`)) as unknown as Row[])[0];
        if (j && j.trang_thai !== 'chay') { if (j.trang_thai !== 'xong') loi = [`lượt sinh bị từ chối: ${String(j.loi).slice(0, 200)}`]; break; }
      }
      c = await docCanh(db, c.id);
      const j = ((await db.execute(sql`SELECT trang_thai FROM xv_job WHERE id = ${r.data}`)) as unknown as Row[])[0];
      if (j?.trang_thai === 'xong') loi = loiSoiClip(c);
      log(`  #${c.thu_tu} lần ${lan}: ${j?.trang_thai === 'xong' ? (loi.length ? `clip còn lỗi — ${loi.join(' | ')}` : 'SẠCH') : loi.join(' | ')}`);
      if (j?.trang_thai === 'xong' && !loi.length) { ket = 'sach'; break; }
    }
    ra.push({ thu_tu: c.thu_tu, ket, lan, loi: ket === 'sach' ? [] : loi });
  }
  return ra;
}

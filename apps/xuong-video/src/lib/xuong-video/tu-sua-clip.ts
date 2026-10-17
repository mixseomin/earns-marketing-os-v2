// VÒNG TỰ SỬA CLIP (anh 17/10/2026: "tự động hoàn thành, fix làm sao ra được video không bị lỗi … đéo phải cứ hỏi xin suốt ngày"). Shot nào
// clip còn lỗi soi (soi-clip.ts: chữ lạ, sản phẩm vắng, mặt trôi, biến dạng) hoặc lượt sinh bị từ chối → Gemini viết lại prompt video theo lỗi
// vừa gặp + luật đã học (tu-sua-clip-do.ts) → lint → sinh lại QUA ĐÚNG CỔNG STUDIO (batDauVideoCanh) → máy soi tự chạy lúc nhận clip.
// Tối đa `toiDa` lần mỗi shot; vẫn hỏng thì dừng, để lại lỗi trên shot (bản xuất không nhận). Mọi lượt tốn tiền ghi xv_job như thường.
import 'server-only';
import { sql } from 'drizzle-orm';
import { batDauVideoCanh, kiemVideoTap } from './sinh-video';
import { sinhKeyframeCanh } from './sinh-anh';
import { chupTruoc } from './hoan-tac';
import { taiAnhBase64 } from './google';
import { goiGeminiJson, MO_HINH_BD } from './soi-bien-dang';
import { lintPrompt, loiDanSuaPrompt, laLoiTam, laTuChoiModel, laMatNoiTieng, VIDEO_DU_PHONG } from './tu-sua-clip-do';
import { coNguoi } from './quy-trinh';
import { ghiTienChu, mapCanh, type Db, type Row } from './doc-db';
import { loiSoiClip, locNhanh, type Canh } from './kieu';

const ngu = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const docCanh = async (db: Db, id: number): Promise<Canh> => mapCanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE id = ${id}`)) as unknown as Row[])[0]!);

/** Chọn một ảnh làm keyframe đang dùng (chụp trước để ↶ Hoàn tác được) — một chỗ cho script sinh-shot (--chon / --keyframe) và vòng tự sửa. */
export async function chonKeyframe(db: Db, id: number, url: string, nguoi: string): Promise<void> {
  await chupTruoc(db, { bang: 'xv_canh', id, cot: ['keyframe_url', 'keyframe_uv', 'trang_thai'], moTa: 'chọn keyframe', nguoi });
  await db.execute(sql`UPDATE xv_canh SET keyframe_url = ${url}, keyframe_uv = CASE WHEN keyframe_uv @> ${JSON.stringify([url])}::jsonb THEN keyframe_uv ELSE keyframe_uv || ${JSON.stringify([url])}::jsonb END,
    trang_thai = CASE WHEN trang_thai IN ('nhap', 'loi', 'duyet', 'xong') THEN 'co_keyframe' ELSE trang_thai END, updated_at = now() WHERE id = ${id}`);
}
/** Mô tả sản phẩm gắn vào shot (anchor san_pham đầu tiên) — '' khi shot không có sản phẩm. */
const moTaSp = async (db: Db, c: Canh): Promise<string> => String(((await db.execute(sql`SELECT mo_ta FROM xv_nhan_vat WHERE loai = 'san_pham'
  AND id = ANY(${`{${(c.nhan_vat.length ? c.nhan_vat : [0]).join(',')}}`}::int[]) ORDER BY id LIMIT 1`)) as unknown as Row[])[0]?.mo_ta ?? '');
/** SOI KEYFRAME trước khi tiêu tiền video (17/10/2026: keyframe vẽ túi cong kiểu jeans 5 túi → 3 lượt video #120 shot 3 hỏng từ khung đầu, $0.54 mất):
 *  sản phẩm trong khung có đúng kiểu mô tả không + tay/người méo. Hai lượt, chỉ tin "sai" khi cả hai cùng nói. null = không soi được. */
async function soiKeyframe(db: Db, c: Canh, phimId: number): Promise<string[] | null> {
  const sp = await moTaSp(db, c); if (!c.keyframe_url) return null;
  const anh = await taiAnhBase64(c.keyframe_url); if (!anh) return null;
  const parts = [{ text: `This is the FIRST FRAME of a video shot for a product ad. Shot intent: ${c.prompt_anh.split(sp).join('').slice(0, 600)}
${sp ? `The product must match this description exactly: ${sp}\n` : ''}List only clear problems an ordinary viewer would notice at a glance: the product is a different kind of garment or clearly the wrong color, visible text or logos on the product, distorted hands/body, or the MAIN subject / main action of the intent is missing. Do NOT report gaze direction, expressions, background details, props, framing or camera angle, or small construction details (pocket shape, rivets, stitching) unless the shot is a close-up of the product itself. Empty list if fine. Short plain English.` },
    { inlineData: anh }];
  const schema = { type: 'OBJECT', properties: { loi: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['loi'] };
  const [x, y] = await Promise.all([goiGeminiJson<{ loi?: string[] }>(parts, schema), goiGeminiJson<{ loi?: string[] }>(parts, schema)]);
  if (!x || !y) return null;
  await ghiTienChu(db, phimId, `soi keyframe #${c.thu_tu}`, MO_HINH_BD, { in: x.tk.in + y.tk.in, out: x.tk.out + y.tk.out }, 'google');
  return (x.data.loi ?? []).length && (y.data.loi ?? []).length ? (x.data.loi ?? []) : [];
}
/** Viết lại prompt khung (prompt_anh) theo lỗi soi keyframe: giữ NGUYÊN đoạn mô tả sản phẩm (thay bằng ‹sản phẩm› khi gửi, ghép lại sau),
 *  đổi khung hình / bố cục / tư thế để model ảnh vẽ đúng — vd cận cảnh sản phẩm sai kiểu → khung trung cả người. null = không viết được. */
async function vietLaiPromptAnh(db: Db, c: Canh, phimId: number, loi: string[]): Promise<string | null> {
  const sp = await moTaSp(db, c); const goc = sp ? c.prompt_anh.split(sp).join('‹PRODUCT›') : c.prompt_anh;
  const r = await goiGeminiJson<{ prompt?: string }>([{ text: `Rewrite this text-to-image prompt for the FIRST FRAME of an ad shot. The image model keeps drawing it wrong: ${loi.join(' | ')}
Current prompt (‹PRODUCT› is a fixed product description that must stay EXACTLY as the token ‹PRODUCT›, once): ${goc}
On-screen text the frame must support: ${c.chu_man || '(none)'}
Change framing / composition / pose so the model renders the product correctly (e.g. a medium or full-body shot instead of a tight close-up when the close-up gets the product details wrong), keep the same person, setting and meaning. Hands out of frame or relaxed at the sides. Plain English, under 90 words plus the ‹PRODUCT› token.` }],
    { type: 'OBJECT', properties: { prompt: { type: 'STRING' } }, required: ['prompt'] });
  if (!r) return null;
  await ghiTienChu(db, phimId, `viết lại prompt khung #${c.thu_tu}`, MO_HINH_BD, r.tk, 'google');
  const p = (r.data.prompt ?? '').trim();
  if (!p || (sp && !p.includes('‹PRODUCT›'))) return null;
  return sp ? p.split('‹PRODUCT›').join(sp) : p;
}
/** Model ảnh DỰ PHÒNG khi chuỗi mặc định từ chối (17/10/2026 #127: Google chặn ảnh có trẻ em — IMAGE_SAFETY; cổng ckey chỉ nhận 3 ảnh tham chiếu,
 *  shot có 6–8). OpenAI gpt-image-1.5 nhận nhiều tham chiếu, cho cảnh gia đình có trẻ em. */
export const ANH_DU_PHONG = 'gpt-image-1.5';
/** Sinh MỘT keyframe cho shot, đợi xong; chuỗi mặc định hỏng thì thử model dự phòng. Trả url ảnh mới (đã thành keyframe đang dùng nhờ sinhKeyframeCanh
 *  khi shot chưa có ảnh; shot đã có ảnh thì người gọi chonKeyframe) hoặc null + lý do. */
export async function sinhKeyframeCoDuPhong(db: Db, id: number): Promise<{ url: string | null; loi: string }> {
  let loiCuoi = '';
  for (const moHinh of [undefined, ANH_DU_PHONG]) {
    const r = await sinhKeyframeCanh(db, id, 1, moHinh);
    if (!r.ok) { loiCuoi = r.loi; continue; }
    const t0 = Date.now();
    while (Date.now() - t0 < 6 * 60_000) {
      await ngu(5000);
      const j = ((await db.execute(sql`SELECT trang_thai, output_url, loi FROM xv_job WHERE id = ${r.data[0]!}`)) as unknown as Row[])[0];
      if (j && j.trang_thai !== 'cho' && j.trang_thai !== 'chay') { if (j.trang_thai === 'xong') return { url: String(j.output_url), loi: '' }; loiCuoi = String(j.loi ?? ''); break; }
    }
  }
  return { url: null, loi: loiCuoi };
}
/** Sinh lại keyframe tới khi soi sạch (tối đa `toiDa` ảnh, ~3¢/ảnh), chọn + duyệt ảnh sạch. Trả lỗi còn lại (rỗng = sạch). */
async function keyframeSach(db: Db, id: number, phimId: number, toiDa: number, log: (s: string) => void): Promise<string[]> {
  let c = await docCanh(db, id);
  let loi = await soiKeyframe(db, c, phimId) ?? [];
  for (let i = 0; loi.length && i < toiDa; i++) {
    c = await docCanh(db, id);
    log(`  #${c.thu_tu} keyframe sai (${loi.join(' | ')}) — sinh lại keyframe lần ${i + 1}`);
    // từ lần 2: viết lại prompt KHUNG theo lỗi (giữ nguyên mô tả sản phẩm) — 17/10/2026 #120 shot 3: cận cảnh quần cứ ra jeans 5 túi, khung trung thì đúng
    if (i > 0) { const pa = await vietLaiPromptAnh(db, c, phimId, loi); if (pa) { await db.execute(sql`UPDATE xv_canh SET prompt_anh = ${pa}, updated_at = now() WHERE id = ${id}`); { const sp0 = await moTaSp(db, c); log(`  #${c.thu_tu} prompt khung mới: ${(sp0 ? pa.split(sp0).join('‹sản phẩm›') : pa).slice(0, 300)}`); } } }
    const kf = await sinhKeyframeCoDuPhong(db, id);
    if (!kf.url) return [`không sinh được keyframe: ${kf.loi.slice(0, 200)}`];
    const url = kf.url;
    await chonKeyframe(db, id, url, 'vòng tự sửa clip');
    c = await docCanh(db, id);
    loi = await soiKeyframe(db, c, phimId) ?? [];
  }
  if (!loi.length) await db.execute(sql`UPDATE xv_canh SET trang_thai = 'duyet', loi = '', updated_at = now() WHERE id = ${id}`);
  return loi;
}
/** Gửi sinh video một shot qua cổng studio rồi đợi xong (soi clip tự chạy lúc nhận). Lỗi TẠM (laLoiTam) — lúc gửi hay job hỏng — đợi 90s gửi lại
 *  đúng prompt đó, tối đa 6 lần, không tính là một lần thử. ok = có clip mới. */
// các shot song song cùng hỏi kiemVideoTap của MỘT tập → dùng chung một lượt đang chạy (hai lượt cùng lúc nhận trùng một clip = soi + tính tiền hai lần)
const kiemDang = new Map<number, Promise<unknown>>();
const kiemChung = (db: Db, tapId: number) => { let p = kiemDang.get(tapId);
  if (!p) { p = kiemVideoTap(db, tapId).catch(() => null).finally(() => kiemDang.delete(tapId)); kiemDang.set(tapId, p); } return p; };
async function guiVaDoi(db: Db, tapId: number, id: number, log: (s: string) => void, nhan: string, moHinh?: string): Promise<{ ok: true } | { ok: false; loi: string }> {
  let loiCuoi = ''; let m = moHinh;
  for (let tam = 0; tam <= 4; tam++) {
    // lỗi tạm lần đầu: gửi lại đúng model sau 30s; từ lần hai chuyển hẳn sang dự phòng (#127: Kie "Internal Error" 11/45 lượt, mỗi lượt đợi 90s)
    if (tam) { if (tam >= 2) m = m === VIDEO_DU_PHONG ? undefined : VIDEO_DU_PHONG; log(`  ${nhan}: lỗi tạm (${loiCuoi.slice(0, 80)}) — gửi lại lần ${tam}${tam >= 2 ? ` qua ${m ?? 'model của phim'}` : ''}`); await ngu(30_000); }
    await db.execute(sql`UPDATE xv_canh SET trang_thai = 'duyet', loi = '', updated_at = now() WHERE id = ${id}`);
    const r = await batDauVideoCanh(db, id, m, 'nhap');
    if (!r.ok) { loiCuoi = `không gửi được: ${r.loi}`; if (laLoiTam(r.loi)) continue; return { ok: false, loi: loiCuoi }; }
    const t0 = Date.now(); let j: Row | undefined;
    while (Date.now() - t0 < 15 * 60_000) {
      await ngu(10_000); await kiemChung(db, tapId);
      j = ((await db.execute(sql`SELECT trang_thai, loi FROM xv_job WHERE id = ${r.data}`)) as unknown as Row[])[0];
      if (j && j.trang_thai !== 'chay') break;
    }
    if (j?.trang_thai === 'xong') return { ok: true };
    loiCuoi = `lượt sinh bị từ chối: ${String(j?.loi ?? 'quá 15 phút chưa xong').slice(0, 200)}`;
    if (!laLoiTam(loiCuoi)) return { ok: false, loi: loiCuoi };
  }
  return { ok: false, loi: loiCuoi };
}
/** Viết lại prompt video của một shot theo lỗi vừa gặp (Gemini, ~0.1¢). Prompt mới vẫn vi phạm luật → thử lại một lần; vẫn vi phạm → null. */
async function vietLaiPrompt(db: Db, c: Canh, phimId: number, loi: string[], daThu: string[], log: (s: string) => void = () => {}): Promise<string | null> {
  // tên sản phẩm / thương hiệu trong prompt → model video tự in chữ lên đồ (#127 shot 13: 'JETT' trên cạp) — cấm, gọi là "the trousers"
  const ten = String((((await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[])[0]?.kinh_thanh as { tu_template?: { gia_tri?: Record<string, string> } } | undefined)?.tu_template?.gia_tri?.san_pham ?? '').trim();
  for (let i = 0; i < 2; i++) {
    const r = await goiGeminiJson<{ prompt?: string }>([{ text: loiDanSuaPrompt({ prompt: c.prompt_video, chu: c.chu_man, loi, daThu }) + (ten ? `\n- Never write the brand or product name ("${ten}") — call it "the trousers"; any name in the prompt gets printed onto the clothing.` : '') }],
      { type: 'OBJECT', properties: { prompt: { type: 'STRING' } }, required: ['prompt'] });
    if (!r) { log(`  #${c.thu_tu} viết lại prompt: Gemini không trả lời`); return null; }
    await ghiTienChu(db, phimId, `viết lại prompt video #${c.thu_tu}`, MO_HINH_BD, r.tk, 'google');
    const p = (r.data.prompt ?? '').trim();
    // không thêm người vào shot không có người (#120 shot 3: shot sản phẩm bị viết thành 'the person stands…')
    const vi = [...(!p ? ['rỗng'] : []), ...lintPrompt(p).map((l) => l.vi), ...(coNguoi(p) && !coNguoi(c.prompt_video) ? ['thêm người vào shot không người'] : []), ...(ten && p.toLowerCase().includes(ten.toLowerCase()) ? [`có tên "${ten}"`] : [])];
    if (!vi.length) return p;
    log(`  #${c.thu_tu} viết lại prompt lần ${i + 1} bị loại: ${vi.join(' · ')}`);
    daThu = [...daThu, p];
  }
  return null;
}

const SONG_SONG = 4;
export type KetTuSua = { thu_tu: number; ket: 'sach' | 'het_luot' | 'loi'; lan: number; loi: string[] };
/** Chạy vòng tự sửa cho mọi shot nhánh A của tập có clip lỗi (hoặc chỉ `chi`). log: in tiến độ. */
/** `dung`: hỏi trước MỖI lần tiêu tiền (keyframe / video) — trả lý do thì dừng hẳn cả tập (vd vượt ngân sách lượt chạy, tu-lam-phim.ts). */
export async function tuSuaClipTap(db: Db, tapId: number, o: { toiDa?: number; chi?: number[]; log?: (s: string) => void; dung?: () => Promise<string | null>; moHinhVideo?: string } = {}): Promise<KetTuSua[]> {
  const log = o.log ?? (() => {}); const toiDa = o.toiDa ?? 3;
  const phimId = Number(((await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[])[0]?.phim_id);
  const tatCa = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A');
  // các shot sửa SONG SONG (tối đa SONG_SONG cùng lúc) — mỗi lần sinh video ~2 phút + soi ~1 phút; chạy lần lượt thì 8 shot × 3 lần = cả buổi (#127, 17/10/2026)
  const ra: KetTuSua[] = []; let dungHet = false;
  const hang = tatCa.filter((c) => (!o.chi || o.chi.includes(c.id)));
  const xuLy = async (c0: Canh): Promise<void> => {
    if (dungHet) return;
    let c = c0; let loi = loiSoiClip(c); const daThu: string[] = [];
    if (!loi.length && (c.video_cuoi_url || c.video_url) && !lintPrompt(c.prompt_video).length) return;
    if (!loi.length && lintPrompt(c.prompt_video).length) loi = lintPrompt(c.prompt_video).map((l) => `prompt vi phạm luật: ${l.vi}`);
    let lan = 0, ket: KetTuSua['ket'] = 'het_luot'; let moHinhVideo: string | undefined = o.moHinhVideo;
    let ly: string | null = null;
    while (lan < toiDa) {
      if ((ly = (await o.dung?.()) ?? null)) { ket = 'loi'; loi = [...loi, ly]; break; }
      lan++;
      // khung đầu sai (soi keyframe) hoặc clip sai sản phẩm ngay từ đầu → lỗi ở KEYFRAME, sinh lại keyframe chứ không đốt tiền video
      if (lan === 1 || loi.some((x) => /sản phẩm đổi kiểu từ giây 0\.|khung không thấy sản phẩm/.test(x))) {
        const kf = await keyframeSach(db, c.id, phimId, 3, log);
        if (kf.length) { ket = 'loi'; loi = [`keyframe vẫn sai sau 3 lần sinh lại: ${kf.join(' | ')}`]; break; }
        c = await docCanh(db, c.id);
      }
      // cổng "một cảnh một model" / mặt giống người nổi tiếng → lỗi ở KEYFRAME: sinh lại keyframe (không viết lại prompt video)
      const kfLai = loi.some((x) => /một cảnh một model/.test(x) || laMatNoiTieng(x));
      if (kfLai) {
        const kf = await sinhKeyframeCoDuPhong(db, c.id);
        if (kf.url) { await chonKeyframe(db, c.id, kf.url, 'vòng tự sửa clip'); await db.execute(sql`UPDATE xv_canh SET trang_thai = 'duyet' WHERE id = ${c.id}`); log(`  #${c.thu_tu} lần ${lan}: sinh lại keyframe (${loi[0]!.slice(0, 60)})`); }
        c = await docCanh(db, c.id);
      }
      // model video từ chối theo nội dung → đổi model dự phòng cho các lần sau của shot này
      if (loi.some(laTuChoiModel)) { moHinhVideo = VIDEO_DU_PHONG; log(`  #${c.thu_tu} lần ${lan}: model video từ chối — chuyển ${VIDEO_DU_PHONG}`); }
      // lỗi do PROMPT → viết lại; lỗi TẠM / từ chối của model / lỗi keyframe → giữ prompt
      if (!kfLai && !loi.every((x) => laLoiTam(x) || laTuChoiModel(x))) {
        const moi = await vietLaiPrompt(db, c, phimId, loi, daThu, log);
        if (!moi) { ket = 'loi'; loi = [...loi, 'không viết lại được prompt sạch']; break; }
        daThu.push(c.prompt_video);
        await db.execute(sql`UPDATE xv_canh SET prompt_video = ${moi}, updated_at = now() WHERE id = ${c.id}`);
        log(`  #${c.thu_tu} lần ${lan}: ${moi}`);
      }
      const kq = await guiVaDoi(db, tapId, c.id, log, `#${c.thu_tu} lần ${lan}`, moHinhVideo);
      c = await docCanh(db, c.id);
      loi = kq.ok ? loiSoiClip(c) : [kq.loi];
      log(`  #${c.thu_tu} lần ${lan}: ${kq.ok ? (loi.length ? `clip còn lỗi — ${loi.join(' | ')}` : 'SẠCH') : loi.join(' | ')}`);
      if (!kq.ok && /THEO NGÀY/.test(kq.loi)) { ket = 'loi'; break; }
      const j = kq.ok ? { trang_thai: 'xong' } : null;
      if (j?.trang_thai === 'xong' && !loi.length) { ket = 'sach'; break; }
    }
    ra.push({ thu_tu: c.thu_tu, ket, lan, loi: ket === 'sach' ? [] : loi });
    if (ly) dungHet = true;
  };
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(SONG_SONG, hang.length) }, async () => { while (i < hang.length) await xuLy(hang[i++]!); }));
  return ra.sort((a, b) => a.thu_tu - b.thu_tu);
}

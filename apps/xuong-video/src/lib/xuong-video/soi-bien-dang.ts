// MÁY SOI BIẾN DẠNG CLIP (anh 17/10/2026, #120 shot 4: quần phồng / đũng tụt khi đứng dậy — "rất hay bị lỗi này"). Ghép N_KHUNG_BD khung của clip
// thành MỘT ảnh → Gemini 3.8 Flash (nhìn ảnh, đo thật ở script hiệu chỉnh, dưới ngưỡng tự chạy $0.01) chấm theo danh mục lỗi cố định (soi-clip-do.ts › loiDanBienDang),
// trả câu lỗi kèm giây cho soi_clip.loi. Thiếu khoá / lỗi mạng → null (không chặn, không báo đạt giả). Ghi tiền vào xv_job như mọi lượt chữ.
import 'server-only';
import { execFile } from 'node:child_process';
import { khoaGoogle } from './google';
import { loiDanBienDang, loiTuBienDang, giaoBienDang, LOAI_BD, N_KHUNG_BD, type LoiBienDang } from './soi-clip-do';
import { ghiTienChu, type Db } from './doc-db';
import { giaChuCents } from './kieu';

/** 2.5 Flash đã đóng với khoá mới (404 17/10/2026, Google chỉ sang 3.8 Flash). Suy nghĩ 'low' để mỗi clip dưới ngưỡng tự chạy $0.01. */
export const MO_HINH_BD = 'gemini-3.8-flash';
const anhGhep = (url: string, dai: number) => new Promise<Buffer | null>((ok) => execFile('ffmpeg', ['-v', 'error', '-i', url,
  '-vf', `fps=${N_KHUNG_BD / dai},scale=270:-2,tile=6x2`, '-frames:v', '1', '-q:v', '4', '-f', 'mjpeg', 'pipe:1'],
  { encoding: 'buffer', maxBuffer: 1 << 25, timeout: 90_000 }, (e, b) => ok(e || !(b as Buffer).length ? null : (b as Buffer))));

export async function soiBienDang(db: Db | null, o: { url: string; dai: number; sp: string; yDo?: string; phimId?: number | null }): Promise<{ loi: string[]; tho: LoiBienDang[]; cents: number } | null> {
  const key = khoaGoogle(); if (!key) return null;
  const anh = await anhGhep(o.url, o.dai); if (!anh) return null;
  const body = { contents: [{ role: 'user', parts: [{ text: loiDanBienDang(o.sp, o.yDo) }, { inlineData: { mimeType: 'image/jpeg', data: anh.toString('base64') } }] }],
    generationConfig: { thinkingConfig: { thinkingLevel: 'low' }, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { loi: { type: 'ARRAY', items: { type: 'OBJECT',
      properties: { khung: { type: 'INTEGER' }, loai: { type: 'STRING', enum: [...LOAI_BD] }, mo_ta: { type: 'STRING' } }, required: ['khung', 'loai', 'mo_ta'] } } }, required: ['loi'] } } };
  // hai lượt song song, giữ lỗi cả hai cùng thấy (giaoBienDang) — một lượt lẻ báo nhầm quá nhiều để làm cổng chặn
  const [x, y] = await Promise.all([motLuot(key, body), motLuot(key, body)]);
  if (!x || !y) return null;
  const tk = { in: x.tk.in + y.tk.in, out: x.tk.out + y.tk.out };
  const cents = db ? await ghiTienChu(db, o.phimId ?? null, 'soi biến dạng clip', MO_HINH_BD, tk, 'google') : giaChuCents(MO_HINH_BD, tk.in, tk.out);
  const tho = giaoBienDang(x.tho, y.tho);
  return { loi: loiTuBienDang(tho, o.dai), tho, cents };
}
async function motLuot(key: string, body: unknown): Promise<{ tho: LoiBienDang[]; tk: { in: number; out: number } } | null> {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MO_HINH_BD}:generateContent?key=${key}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000) });
    if (!r.ok) { console.error('[soi biến dạng]', r.status, (await r.text()).slice(0, 200)); return null; }
    const j = await r.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } };
    const tho = (JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}') as { loi?: LoiBienDang[] }).loi ?? [];
    const u = j.usageMetadata ?? {};
    return { tho, tk: { in: u.promptTokenCount ?? 0, out: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) } };
  } catch (e) { console.error('[soi biến dạng]', e); return null; }
}
/** Ý đồ của shot cho máy soi: hành động video + khung hình (bỏ đoạn tả sản phẩm dài — đã có riêng) — để quần cũ / rách / chia đôi khung cố ý không bị báo. */
export const yDoShot = (promptVideo: string, promptAnh: string, spMoTa = ''): string =>
  [promptVideo, spMoTa ? promptAnh.split(spMoTa).join('') : promptAnh].map((x) => x.trim()).filter(Boolean).join(' | ').slice(0, 900);

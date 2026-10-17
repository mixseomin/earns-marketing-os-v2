// MÁY SOI BIẾN DẠNG CLIP (anh 17/10/2026, #120 shot 4: quần phồng / đũng tụt khi đứng dậy — "rất hay bị lỗi này"). Ghép N_KHUNG_BD khung của clip
// thành MỘT ảnh → Gemini 3.8 Flash (nhìn ảnh, đo thật ở script hiệu chỉnh, dưới ngưỡng tự chạy $0.01) chấm theo danh mục lỗi cố định (soi-clip-do.ts › loiDanBienDang),
// trả câu lỗi kèm giây cho soi_clip.loi. Thiếu khoá / lỗi mạng → null (không chặn, không báo đạt giả). Ghi tiền vào xv_job như mọi lượt chữ.
import 'server-only';
import { execFile } from 'node:child_process';
import { khoaGoogle } from './google';
import { loiDanBienDang, LOAI_BD, N_KHUNG_BD, TEN_BD, type LoiBienDang } from './soi-clip-do';
import { ghiTienChu, type Db } from './doc-db';
import { giaChuCents } from './kieu';
import { xacNhanLoiClaude, MO_HINH_XAC_NHAN_CLAUDE } from './claude';

/** 2.5 Flash đã đóng với khoá mới (404 17/10/2026, Google chỉ sang 3.8 Flash). Suy nghĩ 'low' để mỗi clip dưới ngưỡng tự chạy $0.01. */
export const MO_HINH_BD = 'gemini-3.8-flash';
/** Lấy khung tại các giây `ts` (rộng `w`px) — ảnh RỜI (ghép ảnh bị Gemini nén mất chi tiết chân tay). */
const khungTai = async (url: string, ts: number[], w: number): Promise<string[] | null> => {
  const ra: string[] = [];
  for (const t of ts) {
    const b = await new Promise<Buffer | null>((ok) => execFile('ffmpeg', ['-v', 'error', '-ss', String(Math.max(0, Math.round(t * 100) / 100)), '-i', url, '-frames:v', '1',
      '-vf', `scale=${w}:-2`, '-q:v', '3', '-f', 'mjpeg', 'pipe:1'], { encoding: 'buffer', maxBuffer: 1 << 24, timeout: 60_000 }, (e, x) => ok(e || !(x as Buffer).length ? null : (x as Buffer))));
    if (b) ra.push(b.toString('base64'));
  }
  return ra.length >= ts.length - 1 ? ra : null;
};
const LOAI_EN: Record<string, string> = { trang_phuc_bien_dang: 'clothing deforming unnaturally', co_the_meo: 'distorted anatomy (limbs merging, missing, duplicated, bending impossibly)',
  chu_tren_vat: 'text or a logo appearing on the clothing or objects', san_pham_doi_kieu: 'the product changing design or color', vat_the_la: 'an object appearing, vanishing, floating or morphing' };

/** MÁY SOI BẢN 3 (anh 17/10/2026: "KO đc bỏ sót — chạy QC tốn tiền nên creative phải đúng"): ưu tiên KHÔNG SÓT.
 *  Quét rộng: 2 lượt × N_KHUNG_BD khung rời LỆCH GIỜ nhau (phủ 2N thời điểm trong đoạn được dùng), GỘP mọi lỗi (hợp, không phải giao — giao bỏ sót
 *  tất lơ lửng / tay méo trên bộ mẫu). Xác nhận: mỗi loại lỗi bị báo soi lại 4 khung nét cao quanh đúng giây đó, hỏi có / không — chỉ lọc báo nhầm.
 *  Đo trên bộ mẫu chuẩn: scripts/kiem-may-soi.mts (phải bắt 100% clip lỗi). */
export async function soiBienDang(db: Db | null, o: { url: string; dai: number; sp: string; yDo?: string; phimId?: number | null }): Promise<{ loi: string[]; tho: LoiBienDang[]; cents: number; canhBao: string[] } | null> {
  if (!khoaGoogle()) return null;
  const N = N_KHUNG_BD, buoc = o.dai / N;
  const tA = Array.from({ length: N }, (_, i) => (i + 0.25) * buoc), tB = Array.from({ length: N }, (_, i) => (i + 0.75) * buoc);
  const [a, b] = await Promise.all([khungTai(o.url, tA, 448), khungTai(o.url, tB, 448)]);
  if (!a || !b) return null;
  const schema = { type: 'OBJECT', properties: { loi: { type: 'ARRAY', items: { type: 'OBJECT',
    properties: { khung: { type: 'INTEGER' }, loai: { type: 'STRING', enum: [...LOAI_BD] }, mo_ta: { type: 'STRING' } }, required: ['khung', 'loai', 'mo_ta'] } } }, required: ['loi'] };
  const goi = (anh: string[]) => goiGeminiJson<{ loi?: LoiBienDang[] }>([{ text: loiDanBienDang(o.sp, o.yDo) }, ...anh.map((d) => ({ inlineData: { mimeType: 'image/jpeg', data: d } }))], schema, 'MEDIA_RESOLUTION_MEDIUM');
  const [x, y] = await Promise.all([goi(a), goi(b)]);
  if (!x || !y) return null;
  const tk = { in: x.tk.in + y.tk.in, out: x.tk.out + y.tk.out };
  // gộp: mỗi loại lấy thời điểm sớm nhất mà một trong hai lượt thấy
  const gop = new Map<string, { giay: number; mo_ta: string; khung: number }>();
  for (const [ds, ts] of [[x.data.loi ?? [], tA], [y.data.loi ?? [], tB]] as const) for (const l of ds) {
    if (!LOAI_BD.includes(l.loai) || l.khung < 1 || l.khung > N) continue;
    const g = ts[l.khung - 1]!; const cu = gop.get(l.loai);
    if (!cu || g < cu.giay) gop.set(l.loai, { giay: g, mo_ta: l.mo_ta, khung: l.khung });
  }
  // xác nhận từng loại bằng khung nét cao quanh đúng giây
  const giu: LoiBienDang[] = []; const loi: string[] = []; const canhBao: string[] = []; let tkXn = { in: 0, out: 0 }; let modelXn = MO_HINH_XAC_NHAN_CLAUDE;
  for (const [loai, v] of gop) {
    const ts = [-0.5, -0.25, 0, 0.25, 0.5, 0.75].map((d) => Math.min(o.dai, Math.max(0, v.giay + d)));
    const anh = await khungTai(o.url, ts, 768);
    // xác nhận bằng CLAUDE nhìn ảnh (claude.ts › xacNhanLoiClaude) — Gemini (cả Pro) gật cả ngón tay bình thường; đúng giá Claude ~1,5¢ vẫn rẻ hơn một lượt sinh lại oan
    const cauHoi = `These 6 images are consecutive frames (0.25 s apart) of ONE AI-generated ad clip.${o.yDo ? ` Shot intent (intentional, not a defect): ${o.yDo}` : ''}
A first automatic check reported: ${LOAI_EN[loai] ?? loai} — "${v.mo_ta}". Look very closely at the exact body part / object in EVERY frame. co=true if that defect is really there; co=false if it looks normal, is only motion blur, or is part of the shot intent. muc: "nang" ONLY if an ordinary viewer watching ONCE at normal speed on a phone would clearly notice it (legs or arms merging, missing or duplicated, a body bending impossibly, clothing ballooning or fusing between the legs, readable text or a logo on clothing, an object floating or popping in / out, the product turning into a different garment or color); otherwise "nhe" (slightly soft fingers, small wrinkle / rip / texture changes, small edge objects, slight color shift, anything smaller than ~5% of the frame).`;
    const c = anh ? await xacNhanLoiClaude({ anh, cauHoi }) : null;
    if (c?.ok) { tkXn = { in: tkXn.in + c.tokens.in, out: tkXn.out + c.tokens.out }; modelXn = c.model; }
    const cd = c?.ok ? c.data : null;
    // lỗi NHẸ (chỉ thấy khi dừng hình) không chặn — ghi cảnh báo; không xác nhận được (lỗi mạng) → GIỮ lỗi: thà sinh lại oan còn hơn lọt
    if (cd?.co && cd.muc === 'nhe') { canhBao.push(`${TEN_BD[loai as keyof typeof TEN_BD] ?? loai} (nhẹ) giây ${Math.round(v.giay * 10) / 10}: ${cd.ly_do.slice(0, 140)}`); continue; }
    if (!cd || cd.co) { giu.push({ khung: v.khung, loai: loai as LoiBienDang['loai'], mo_ta: v.mo_ta }); loi.push(`${TEN_BD[loai as keyof typeof TEN_BD] ?? loai} từ giây ${Math.round(v.giay * 10) / 10}: ${v.mo_ta.trim().slice(0, 160)}`); }
  }
  let cents = db ? await ghiTienChu(db, o.phimId ?? null, 'soi biến dạng clip', MO_HINH_BD, tk, 'google') : giaChuCents(MO_HINH_BD, tk.in, tk.out);
  if (tkXn.in) cents += db ? await ghiTienChu(db, o.phimId ?? null, 'xác nhận lỗi clip', modelXn, tkXn, modelXn.startsWith('shopaikey:') ? 'shopaikey' : 'anthropic') : giaChuCents(modelXn, tkXn.in, tkXn.out);
  return { loi, tho: giu, cents, canhBao };
}
/** MỘT lượt Gemini trả JSON theo schema (MO_HINH_BD, suy nghĩ low) — dùng chung cho soi biến dạng và viết lại prompt (tu-sua-clip.ts). null = lỗi / thiếu khoá. */
export async function goiGeminiJson<T>(parts: unknown[], schema: unknown, mediaResolution?: string, model: string = MO_HINH_BD): Promise<{ data: T; tk: { in: number; out: number } } | null> {
  const key = khoaGoogle(); if (!key) return null;
  const body = { contents: [{ role: 'user', parts }], generationConfig: { ...(mediaResolution ? { mediaResolution } : {}), thinkingConfig: { thinkingLevel: 'low' }, maxOutputTokens: 16384, responseMimeType: 'application/json', responseSchema: schema } };
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
    if (!r.ok) { console.error('[gemini json]', r.status, (await r.text()).slice(0, 200)); return null; }
    const j = await r.json() as { candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[]; promptFeedback?: { blockReason?: string }; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } };
    const u = j.usageMetadata ?? {};
    // không có chữ (hết token / bị chặn) → null có lý do, KHÔNG trả {} (17/10/2026: {} thành điểm NaN, vòng tự làm phim đổ lỗi)
    const txt = (j.candidates?.[0]?.content?.parts ?? []).map((x) => x.text ?? '').join('').trim();
    if (!txt) { console.error('[gemini json] không có chữ —', j.candidates?.[0]?.finishReason ?? j.promptFeedback?.blockReason ?? 'không rõ'); return null; }
    return { data: JSON.parse(txt) as T, tk: { in: u.promptTokenCount ?? 0, out: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) } };
  } catch (e) { console.error('[gemini json]', e); return null; }
}
/** Ý đồ của shot cho máy soi: hành động video + khung hình (bỏ đoạn tả sản phẩm dài — đã có riêng) — để quần cũ / rách / chia đôi khung cố ý không bị báo. */
export const yDoShot = (promptVideo: string, promptAnh: string, spMoTa = ''): string =>
  [promptVideo, spMoTa ? promptAnh.split(spMoTa).join('') : promptAnh].map((x) => x.trim()).filter(Boolean).join(' | ').slice(0, 900);

/** Khuôn zod (v3) → responseSchema của Gemini, GIỮ mô tả từng trường — để bộ chấm Gemini đọc đúng nghĩa trường như bản Claude
 *  (17/10/2026: thiếu mô tả, Gemini hiểu trường `ai` của QC là "ai trong phim" thay vì "sản phẩm là gì" → đối chiếu báo lệch oan). */
export function zodSangGemini(z: unknown): Record<string, unknown> {
  // đọc được cả zod v3 (_def.typeName, shape là hàm, mảng ở _def.type) lẫn v4 (_def.type, shape là đối tượng, mảng ở _def.element, mô tả ở .description)
  // — studio dùng 'zod/v4' (claude.ts); bản đầu chỉ đọc v3 nên cả khuôn thành STRING, Gemini trả một câu văn.
  const zz = z as { description?: string; _def: Record<string, unknown> & { typeName?: string; type?: unknown; description?: string; shape?: unknown; element?: unknown; innerType?: unknown } };
  const d = zz._def; const loai = String(d.typeName ?? d.type ?? '').replace(/^Zod/, '').toLowerCase();
  const moTa = zz.description ?? d.description; const mo = moTa ? { description: moTa } : {};
  switch (loai) {
    case 'object': { const sh = (typeof d.shape === 'function' ? (d.shape as () => Record<string, unknown>)() : d.shape) as Record<string, unknown>;
      return { type: 'OBJECT', ...mo, properties: Object.fromEntries(Object.entries(sh).map(([k, v]) => [k, zodSangGemini(v)])), required: Object.keys(sh) }; }
    case 'array': return { type: 'ARRAY', ...mo, items: zodSangGemini(d.element ?? d.type) };
    case 'string': return { type: 'STRING', ...mo };
    case 'number': return { type: 'NUMBER', ...mo };
    case 'boolean': return { type: 'BOOLEAN', ...mo };
    case 'optional': case 'nullable': case 'default': return zodSangGemini(d.innerType);
    default: return { type: 'STRING', ...mo };
  }
}

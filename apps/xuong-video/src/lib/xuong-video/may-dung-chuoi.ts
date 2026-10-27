// CHUỖI ẢNH THẬT → một dải video: mỗi đoạn một ảnh lia chậm (zoompan) đúng thời lượng, chồng mờ XF giữa các đoạn. DÙNG CHUNG cho mọi mẫu nhiều cảnh
// (Top 3/5 đếm ngược, Lầm tưởng / Đúng-Sai…) — tách ra 27/10/2026 khi mẫu thứ hai cần đúng cùng dải (luật gom ≥ 2 vùng). THUẦN: đoạn → mảng -i + bộ lọc.
export interface DoanAnh { anh: string; tu: number; den: number }
export const FPS = 30, XF = 0.5;

/** `vao` = tham số -loop/-i cho từng ảnh (theo thứ tự đoạn), `loc` = chuỗi bộ lọc kết ở nhãn [vx] (đã trim về `dai`), `soVao` = số luồng ảnh (luồng tiếng là chỉ số kế). */
export function chuoiAnh(doan: DoanAnh[], o: { W: number; H: number; dai: number; fps?: number; xf?: number }): { vao: string[]; loc: string[]; soVao: number } {
  const fps = o.fps ?? FPS, xf = o.xf ?? XF, vao: string[] = [], f: string[] = [];
  if (!doan.length) throw new Error('chuỗi ảnh rỗng');
  doan.forEach((x, i) => {
    const d = Number((x.den - x.tu + xf).toFixed(2)); vao.push('-loop', '1', '-framerate', String(fps), '-t', String(d), '-i', x.anh);
    f.push(`[${i}:v]scale=${Math.round(o.W * 1.12)}:${Math.round(o.H * 1.12)}:force_original_aspect_ratio=increase,crop=${Math.round(o.W * 1.12)}:${Math.round(o.H * 1.12)},zoompan=z='1+0.08*on/${Math.round(d * fps)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${o.W}x${o.H}:fps=${fps},eq=brightness=-0.03,setsar=1[v${i}]`);
  });
  let prev = '[v0]';
  for (let i = 1; i < doan.length; i++) { const out = i === doan.length - 1 ? '[vx0]' : `[x${i}]`; f.push(`${prev}[v${i}]xfade=transition=fade:duration=${xf}:offset=${doan[i]!.tu.toFixed(2)}${out}`); prev = out; }
  if (doan.length === 1) f.push('[v0]null[vx0]');
  f.push(`[vx0]trim=0:${o.dai.toFixed(2)},setpts=PTS-STARTPTS[vx]`);
  return { vao, loc: f, soVao: doan.length };
}
/** Dải tiếng thu thật: cắt về `dai`, cùng mức (-18 LUFS), vào/ra êm. `[A]` thay bằng nhãn luồng tiếng. */
export const locAmChuoi = (dai: number) => `[A]atrim=0:${dai.toFixed(2)},asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:d=1,afade=t=out:st=${Math.max(0, dai - 1.5).toFixed(2)}:d=1.5[a]`;
/** Ảnh cho từng mục theo thứ tự: mục đầu = nen, mục i = nenThem[i-1]; thiếu thì dùng lại ảnh gần nhất đã có (không bao giờ trống). */
export function anhTheoMuc(n: number, nen: string, nenThem: string[] = []): string[] {
  const ra: string[] = []; for (let i = 0; i < n; i++) ra.push(i === 0 ? nen : nenThem[i - 1] ?? ra[i - 1]!); return ra;
}

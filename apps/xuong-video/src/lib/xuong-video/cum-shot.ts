// CỤM SHOT — nhiều góc trong MỘT lần sinh (luat-dung.ts › cum_mot_lan_sinh). Bài thử phim #353 tập Thang máy #5–#8 (25/10/2026, A | B | C cạnh nhau):
// mỗi shot một clip (A) đổi mặt / sảnh / vết áo ở MỌI đường cắt; quay rộng một lần + cận chèn (B) hỏng đúng chỗ cận sinh riêng; một clip có danh sách
// góc + "hard cut" (C) giữ cùng người, cùng sảnh, cùng đồ qua 4 góc và tốn 1 clip thay 4. Ngành gọi là coverage trong một take / multi-cam:
// liên tục do cùng một lần diễn, không do khớp từng shot rời. Module thuần: chia cụm, lịch giây trong clip, prompt, đổi điểm cắt đo được → vao_s.
import { giayPhat, type Canh, type NhanVat } from './kieu';
import { dongThoai, laLoiDan } from './am-thanh';

/** Clip model sinh (giây) · bỏ đầu (model khởi động chậm) · bỏ đuôi (xuat.ts › DUOI_CLIP_BO: Kie / PlenX chèn ô ảnh nhỏ ~7,6 s). */
export const GIAY_CLIP = 8, VAO_DAU = 0.2, BO_DUOI = 0.45;
/** Giây dùng được trong một clip cụm — tổng giây phát của cụm không vượt mức này. */
export const DUNG_DUOC = GIAY_CLIP - VAO_DAU - BO_DUOI;

type ShotCum = Pick<Canh, 'id' | 'thu_tu' | 'phan_doan' | 'phat_s' | 'thoi_luong_s'> & { cat_cuoi_s?: number | null };

/** Chia shot liền nhau thành cụm: cùng phân cảnh (đổi nơi / thời điểm = cụm mới), tổng giây phát ≤ tran. Shot dài hơn tran đứng riêng.
 *  NEO NGƯỜI (phim #353 25/10/2026: cụm #1–#4, #13–#16 khung mở chỉ có Hạ → model BỊA Vivian vest đen, đổi mặt Hạ; cụm #5–#9 khung mở có đủ hai người
 *  → giữ đúng): mọi nhân vật của cụm phải có trong shot ĐẦU (ảnh mở) hoặc shot CUỐI khi shot đó có khung kết (gửi làm ảnh neo cuối) — thiếu thì tách. */
export function chiaCum<T extends ShotCum>(ds: readonly T[], tran = DUNG_DUOC, neo?: { nguoi: (c: T) => readonly (string | number)[]; coKet: (c: T) => boolean }): T[][] {
  const du = (cum: readonly T[]) => {
    if (!neo) return true;
    const co = new Set([...neo.nguoi(cum[0]!), ...(cum.length > 1 && neo.coKet(cum.at(-1)!) ? neo.nguoi(cum.at(-1)!) : [])]);
    return cum.every((c) => neo.nguoi(c).every((x) => co.has(x)));
  };
  const kq: T[][] = []; let cur: T[] = []; let tong = 0;
  for (const c of ds) {
    const g = giayPhat(c);
    if (cur.length && (c.phan_doan !== cur[0]!.phan_doan || tong + g > tran + 1e-6 || !du([...cur, c]))) { kq.push(cur); cur = []; tong = 0; }
    cur.push(c); tong += g;
  }
  if (cur.length) kq.push(cur);
  return kq;
}
/** Ảnh neo cuối của cụm: khung kết của shot cuối (đã duyệt) — chỉ khi cụm > 1 shot và shot cuối có khung kết. */
export const anhNeoCuoi = (cum: readonly Pick<Canh, 'keyframe_ket'>[]): string | null => (cum.length > 1 ? cum.at(-1)!.keyframe_ket ?? null : null);

/** Lịch giây của từng shot TRONG clip cụm (theo prompt): giãn tỉ lệ cho đầy phần dùng được — mỗi đoạn ≥ giây phát của shot. */
export function lichCum(cum: readonly ShotCum[]): { thu_tu: number; tu: number; den: number }[] {
  const tong = cum.reduce((s, c) => s + giayPhat(c), 0) || 1; const k = Math.max(1, DUNG_DUOC / tong);
  let t = VAO_DAU;
  return cum.map((c) => { const d = giayPhat(c) * k; const r = { thu_tu: c.thu_tu, tu: +t.toFixed(2), den: +(t + d).toFixed(2) }; t += d; return r; });
}

/** Câu miệng của một shot trong cụm: người nói trong khung cử miệng (giọng ghép sau ở bản dựng), không thoại thì khép miệng (im_lang_khep_mieng). */
export function cauMiengShot(c: Canh, nv: NhanVat[]): string {
  const dong = dongThoai(c, nv).filter((d) => d.loi.trim());
  const noi = [...new Set(dong.filter((d) => d.nhan_vat.trim() && !laLoiDan(d.dien_xuat)).map((d) => d.nhan_vat))];
  if (noi.length) return `${noi.join(' and ')} ${noi.length > 1 ? 'speak' : 'speaks'} with natural lip movement, others keep mouths closed`;
  if (c.ky_thuat?.co_canh === 'insert' || !nv.some((v) => v.loai === 'nhan_vat')) return '';
  return 'nobody speaks, mouths closed';
}

const CO_CANH: Record<string, string> = { ews: 'extreme wide shot', ws: 'wide shot', ms: 'medium shot', mcu: 'medium close-up', cu: 'close-up', ecu: 'extreme close-up', insert: 'insert close-up', ots: 'over-the-shoulder shot', pov: 'point-of-view shot' };

/** Prompt MỘT lần sinh cho cả cụm: danh sách góc có mốc giây + "hard cut" + câu giữ người / đồ / bối cảnh qua mọi cú cắt. */
export function promptCum(cum: readonly { canh: Canh; nhanVat: NhanVat[] }[], them = ''): string {
  const lich = lichCum(cum.map((x) => x.canh));
  const shot = cum.map(({ canh: c, nhanVat }, i) => {
    const l = lich[i]!; const co = CO_CANH[c.ky_thuat?.co_canh ?? ''] ?? c.ky_thuat?.co_canh ?? 'medium shot';
    const mieng = cauMiengShot(c, nhanVat);
    return `Shot ${i + 1} (${(l.tu - VAO_DAU).toFixed(1)}–${(l.den - VAO_DAU).toFixed(1)} s, ${co}${i ? ', hard cut' : ''}): ${c.dan_dung?.mo ?? c.canh} → ${c.dan_dung?.ket ?? ''}${mieng ? `; ${mieng}` : ''}`;
  });
  return [`A short edited film sequence of ${cum.length} shots with hard cuts between them. The same people with the same faces, hair and outfits, the same props in the same state and the same location and lighting in every shot — it is one continuous moment filmed from several angles.`,
    `${shot.join('. ')}.`, 'Keep every object state continuous across the cuts (what was taken stays taken, stains stay, nothing reappears). Only the people of this scene appear. No on-screen text, no subtitles.', them].filter(Boolean).join(' ');
}

/** Điểm vào (vao_s) từng shot từ điểm cắt ĐO trên clip (ffmpeg scene). Đủ n−1 cú cắt thì dùng điểm đo (+0,05 s qua cú cắt); thiếu / thừa thì theo
 *  lịch prompt và báo. ngan = shot có đoạn đo được ngắn hơn giây phát (dựng sẽ lấn sang góc kế) — phải soát. */
export function vaoTuCatThat(cum: readonly ShotCum[], cat: readonly number[], daiClip = GIAY_CLIP): { vao: number[]; theoDo: boolean; ngan: number[] } {
  const lich = lichCum(cum); const theoDo = cat.length === cum.length - 1;
  const moc = theoDo ? [VAO_DAU, ...cat.map((x) => x + 0.05), daiClip - BO_DUOI] : [...lich.map((l) => l.tu), daiClip - BO_DUOI];
  const vao = cum.map((_, i) => +moc[i]!.toFixed(2));
  const ngan = cum.filter((c, i) => moc[i + 1]! - moc[i]! < giayPhat(c) - 0.15).map((c) => c.thu_tu);
  return { vao, theoDo, ngan };
}

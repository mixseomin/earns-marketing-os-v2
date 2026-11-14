// CỤM SHOT — nhiều góc trong MỘT lần sinh (luat-dung.ts › cum_mot_lan_sinh). Bài thử phim #353 tập Thang máy #5–#8 (25/10/2026, A | B | C cạnh nhau):
// mỗi shot một clip (A) đổi mặt / sảnh / vết áo ở MỌI đường cắt; quay rộng một lần + cận chèn (B) hỏng đúng chỗ cận sinh riêng; một clip có danh sách
// góc + "hard cut" (C) giữ cùng người, cùng sảnh, cùng đồ qua 4 góc và tốn 1 clip thay 4. Ngành gọi là coverage trong một take / multi-cam:
// liên tục do cùng một lần diễn, không do khớp từng shot rời. Module thuần: chia cụm, lịch giây trong clip, prompt, đổi điểm cắt đo được → vao_s.
import { giayPhat, lienCon, phat, coTiengViet, type Canh, type NhanVat } from './kieu';
import type { LookMang } from './bo-set-3d';
import { nhanNhin, thayTenNhan } from './prompt-khoi';
import { kyThuat } from './dien-anh';
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
/** NGƯỜI SAU Ô CỬA, MÁY Ở NGOÀI (15/11/2026, phim #3071 shot #4: 3D chỉ đẩy máy nhẹ, khung cửa luôn trong hình — Seedance đẩy máy xuyên ô cửa vào trong toa, nền
 *  thành ghế toa): người có chỗ đứng (vi_tri.o_dau) "behind … window" → câu giữ máy ở ngoài + khung cửa bao quanh người suốt shot. so = số shot trong cụm. Thuần. */
export function cauNgoaiCua(cum: readonly Pick<Canh, 'may_3d'>[]): string {
  const so = cum.map((c, i) => ((c.may_3d?.vi_tri ?? []).some((v) => /behind[^.]*window/i.test((v as { o_dau?: string }).o_dau ?? '')) ? i + 1 : 0)).filter(Boolean);
  if (!so.length) return '';
  return `${cum.length > 1 ? `In shot${so.length > 1 ? 's' : ''} ${so.join(', ')}` : 'In this shot'}, the camera stays OUTSIDE the train the whole time: the window frame stays in view around the person at the window, and the camera never moves through the window into the carriage.`;
}
/** CHIA CỤM CÂN cho model sinh dài (Seedance 2.0 ≤ 15 s, anh 14/11/2026 "tổ chức lại cụm video để sinh"): trong mỗi phân cảnh lấy SỐ CỤM ÍT NHẤT
 *  (⌈tổng / trần⌉, tăng dần nếu shot dài không xếp vừa) rồi chia liền nhau sao cho CỤM DÀI NHẤT ngắn nhất — tránh lối tham (chiaCum) để lại cụm đuôi 1 shot
 *  (#3071 cảnh 1: tham ra 14,7 + 4,2 s; cân ra 9,8 + 9,1 s). Shot dài hơn trần đứng riêng. Thuần. */
export function chiaCumCan<T extends ShotCum>(ds: readonly T[], tran = 15): T[][] {
  const kq: T[][] = [];
  for (let i = 0; i < ds.length;) {
    let j = i; while (j < ds.length && ds[j]!.phan_doan === ds[i]!.phan_doan) j++;
    const canh = ds.slice(i, j); const g = canh.map((c) => giayPhat(c)); i = j;
    const n = canh.length; const pre = [0]; for (const x of g) pre.push(pre.at(-1)! + x);
    const dai = (a: number, b: number) => pre[b]! - pre[a]!;   // tổng [a, b)
    for (let k = Math.min(n, Math.max(1, Math.ceil(pre[n]! / tran - 1e-9))); k <= n; k++) {
      // dp[m][b]: chia b shot đầu thành m cụm, cụm dài nhất nhỏ nhất (chỉ cụm ≤ trần, hoặc một shot đơn dài hơn trần)
      const dp = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(Infinity)); const tr = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(-1)); dp[0]![0] = 0;
      for (let m = 1; m <= k; m++) for (let b = 1; b <= n; b++) for (let a = m - 1; a < b; a++) {
        const d = dai(a, b); if (d > tran + 1e-6 && b - a > 1) continue;
        const v = Math.max(dp[m - 1]![a]!, d); if (v < dp[m]![b]!) { dp[m]![b] = v; tr[m]![b] = a; }
      }
      if (dp[k]![n]! < Infinity) { const cat: T[][] = []; for (let m = k, b = n; m > 0; m--) { const a = tr[m]![b]!; cat.unshift(canh.slice(a, b)); b = a; } kq.push(...cat); break; }
    }
  }
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

/** PROMPT CỤM KIỂU MỚI — luật học từ prompt mẫu anh gửi 01/11/2026 ("Shot 1: Extreme close-up on Youri's @image1 … Shot 2: Wide shot from behind as he pushes
 *  off…") + hướng dẫn chính hãng (OpenAI Sora 2 cookbook, Runway Seedance 2.0, Google Veo): xem luat-dung.ts › prompt_cum_nganh. Tóm tắt:
 *  1. Định nghĩa người MỘT lần ở đầu bằng dáng nhìn thấy (giới + bộ đồ) + nhãn ảnh nếu có, rồi gọi đúng nhãn đó mọi shot — KHÔNG gọi tên (model không biết tên).
 *  2. Mỗi shot: máy trước (cỡ cảnh + MỘT chuyển động / máy đứng) → MỘT chuỗi hành động nhìn thấy được → tiếng / thoại cùng câu.
 *  3. Shot sau mở bằng hệ quả động tác cuối shot trước (cắt theo động tác nằm trong động từ). Không mốc giây "0:00–0:02" (Seedance / Runway: ép mốc làm loạn),
 *     nhưng GHI THỜI LƯỢNG mỗi shot "(about 2 s)" + tổng clip ở câu mở — thiếu thì model chia đều, bản dựng (lichCum / vaoTuCatThat) cắt lệch góc.
 *  4. Ít góc mỗi clip: shot con (#2.9 / #3.1) MẶC ĐỊNH gộp vào câu shot cha — bài thử A/B #2→#3 01/11 (VideoExpress): 4 góc trong clip 5 s đổi mặt Hạ,
 *     sảnh trống rồi nhảy; 2 góc giữ mặt, liền mạch. Prompt cũ 5.052 ký tự còn bị in phụ đề chữ Hán.
 *  5. Thoại: "<người> says: <câu>" không ngoặc kép (Google: ngoặc kép làm model in chữ lên hình). Kết bằng ràng buộc: không phụ đề, chữ, logo, watermark. */
export function promptCumMoi(cum: readonly { canh: Canh; nhanVat: NhanVat[]; look?: Map<string, LookMang> | null }[], o: { tag?: Record<string, string>; gopCon?: boolean; them?: string; giay?: number; /** tỉ lệ khung phim — trước 14/11/2026 ghi cứng 'vertical', phim 16:9 (#3071) bị bảo là phim dọc */ tiLe?: string | null } = {}): string {
  const gopCon = o.gopCon ?? true;
  // o.giay = độ dài clip model sinh (giây): giãn thời lượng shot cho đầy clip như lichCum; không truyền thì giữ giây phát thật
  const gon = (t?: string) => (t ?? '').replace(/\s*(OBJECT STATE|BODY POSE|POSE)\b[\s\S]*$/, '').trim().replace(/[.\s]+$/, '');
  // câu máy ("Static camera.") tách khỏi hành động — mỗi shot nói máy MỘT lần, nhịp gộp không lặp
  const MAY = /\s*\b(?:static|locked[- ]off|handheld|slow push[- ]in|slow dolly[^.]*?)\s+camera\b[^.]*\.?/i;
  // câu diễn tiếng Việt (dan_dung.dien) KHÔNG vào prompt khi có mở / kết tiếng Anh — cùng luật prompt video một shot (sinh-video.ts › theVideo), 14/11/2026 #3071
  const moKet = (c: Canh) => [gon(c.dan_dung?.mo), gon(c.dan_dung?.ket)].filter(Boolean).join(', then ');
  const hanh = (c: Canh) => { const dien = gon(c.dan_dung?.dien); const t = (dien && !(coTiengViet(dien) && moKet(c)) ? dien : '') || moKet(c) || gon(c.canh);
    return { cau: gon(t.replace(MAY, ' ')).replace(/\s{2,}/g, ' '), may: (t.match(MAY)?.[0] ?? '').trim().replace(/\.$/, '') }; };
  // NHÃN người (prompt-khoi.ts › nhanNhin): bộ đồ từ sổ trang phục carry của shot đầu người đó xuất hiện
  const nguoi: { ten: string; moTaNv: string; ao?: string }[] = [];
  for (const x of cum) for (const v of x.nhanVat.filter((n) => n.loai === 'nhan_vat' && x.canh.nhan_vat.includes(n.id)))
    if (!nguoi.some((n) => n.ten === v.ten)) nguoi.push({ ten: v.ten, moTaNv: v.mo_ta, ao: x.look?.get(v.ten)?.trang_phuc?.[0]?.mo_ta });
  const nhan = nhanNhin(nguoi);
  const thay = (t: string) => thayTenNhan(t, nhan.map((n) => ({ ten: n.ten, nhan: n.gon })));
  // nhóm: shot cha + các shot con của nó có trong cụm (theo thứ tự phát); shot con không có cha trong cụm thì đứng riêng
  const nhom: { canh: Canh; nhanVat: NhanVat[]; cau: string[]; mayCau: string; giay: number }[] = [];
  for (const x of cum) {
    if (gopCon && x.canh.con_cua != null && cum.some((y) => y.canh.id === x.canh.con_cua)) continue;
    const con = gopCon ? cum.filter((y) => y.canh.con_cua === x.canh.id) : [];
    const truoc = con.filter((y) => phat(y.canh) < phat(x.canh)), sau = con.filter((y) => phat(y.canh) > phat(x.canh));
    const h = [...truoc, x, ...sau].map((y) => hanh(y.canh)).filter((y) => y.cau);
    nhom.push({ canh: x.canh, nhanVat: x.nhanVat, cau: h.map((y, j) => (j ? y.cau.replace(/^continuing[^,]*,\s*/i, '') : y.cau)), mayCau: h.find((y) => y.may)?.may ?? '',
      giay: [x, ...con].reduce((a, y) => a + giayPhat(y.canh), 0) });
  }
  const tongGiay = nhom.reduce((a, n) => a + n.giay, 0);
  const k = o.giay && tongGiay ? o.giay / tongGiay : 1;
  const nua = (g: number) => Math.max(0.5, Math.round(g * 2) / 2);   // làm tròn 0,5 s — model không chia nhỏ hơn
  const shot = nhom.map(({ canh: c, nhanVat, cau, mayCau, giay }, i) => {
    const co = CO_CANH[c.ky_thuat?.co_canh ?? ''] ?? c.ky_thuat?.co_canh ?? 'medium shot';
    const may = kyThuat(c.ky_thuat?.chuyen_dong, 'chuyen_dong')?.prompt || mayCau.toLowerCase();
    const t = nhom[i - 1]?.canh;   // shot con liền shot cha (#2 → #2.9, #3.1 → #3) = khung cuối trước LÀ khung đầu sau (kieu.ts › lienCon), không cắt
    const lien = !!t && lienCon(t.thu_tu, c.thu_tu);
    const dong = dongThoai(c, nhanVat).filter((d) => d.loi.trim() && d.nhan_vat.trim() && !laLoiDan(d.dien_xuat));
    const loi = dong.length ? dong.map((d) => `${d.nhan_vat} says: ${d.loi.trim().replace(/["“”]/g, '')}`).join('; ') : cauMiengShot(c, nhanVat);
    return thay(`Shot ${i + 1} (about ${nua(giay * k)} s): ${co[0]!.toUpperCase()}${co.slice(1)}${lien ? ', continuous from the last frame of the previous shot, no cut' : ''}${may ? `, ${may}` : ''} — ${cau.join('; then ')}${loi ? `; ${loi}` : ''}.`);
  });
  const dinh = nhan.length ? `Throughout: ${nhan.map((n) => `${n.day}${o.tag?.[n.ten] ? ` (${o.tag[n.ten]})` : ''}`).join(' and ')} keep the same face, hair, wardrobe and props in every shot; same location and light.` : 'Same location and light in every shot.';
  return [`A ${nua(tongGiay * k)}-second, ${nhom.length}-shot ${o.tiLe === '16:9' ? 'widescreen' : 'vertical'} film sequence${nhom.length > 1 ? ' cutting between angles' : ''}, one continuous moment.`, dinh, ...shot,
    'Keep it subtitle-free: no on-screen text, captions, logo or watermark.', o.them ?? ''].filter(Boolean).join(' ');
}

/** CÚ MÁY LIỀN (Vidu Q2 tham chiếu, phim #353 25/10/2026: cả 6 cụm ra MỘT cú máy đẩy / lia, không cắt cứng dù prompt ghi "hard cut"): các shot phát NỐI
 *  TIẾP trong clip — điểm vào shot i = VAO_DAU + tổng giây phát các shot trước → bản dựng ghép lại đúng thành đoạn quay liền, không nhảy hình giữa shot. */
export const vaoLienMach = (cum: readonly ShotCum[]): number[] => { let t = VAO_DAU; return cum.map((c) => { const v = +t.toFixed(2); t += giayPhat(c); return v; }); };

/** Điểm vào (vao_s) từng shot từ điểm cắt ĐO trên clip (ffmpeg scene). Đủ n−1 cú cắt thì dùng điểm đo (+0,05 s qua cú cắt); thiếu / thừa thì theo
 *  lịch prompt và báo. ngan = shot có đoạn đo được ngắn hơn giây phát (dựng sẽ lấn sang góc kế) — phải soát. */
export function vaoTuCatThat(cum: readonly ShotCum[], cat: readonly number[], daiClip = GIAY_CLIP): { vao: number[]; theoDo: boolean; ngan: number[] } {
  const lich = lichCum(cum); const theoDo = cat.length === cum.length - 1;
  const moc = theoDo ? [VAO_DAU, ...cat.map((x) => x + 0.05), daiClip - BO_DUOI] : [...lich.map((l) => l.tu), daiClip - BO_DUOI];
  const vao = cum.map((_, i) => +moc[i]!.toFixed(2));
  const ngan = cum.filter((c, i) => moc[i + 1]! - moc[i]! < giayPhat(c) - 0.15).map((c) => c.thu_tu);
  return { vao, theoDo, ngan };
}

/** CHẾ ĐỘ THAM CHIẾU (model nhận ảnh nhân vật — Vidu Q2 / Veo REFERENCE_2_VIDEO; bài thử phim #353 #13–#14 25/10/2026: khung mở thiếu Vivian thì Veo Lite
 *  bịa người, có ảnh tham chiếu thì đúng). Mỗi người của cụm một–hai ảnh theo TRANG PHỤC ở shot đầu tiên người đó có mặt (biến thể canh.bien_the → ảnh
 *  sát mặt → ảnh mẫu), cộng ảnh bối cảnh (khung đã duyệt của shot rộng nhất cụm). Thuần — không gọi mạng. */
const DO_RONG: Record<string, number> = { ews: 0, ws: 1, ots: 2, ms: 3, mcu: 4, cu: 5, ecu: 6, insert: 7 };
/** Ảnh bối cảnh của một phân cảnh = keyframe shot RỘNG NHẤT trong CẢ phân cảnh (không chỉ trong cụm): cụm toàn cận (#5–#9 giật thẻ) mà lấy khung của chính nó
 *  thì ảnh "bối cảnh" chỉ là ngực áo trên nền xám → Vidu dựng cả cụm trên phông xám, sảnh biến mất giữa cảnh (phim #353, 25/10/2026). */
export function anhBoiCanh(ds: readonly Pick<Canh, 'keyframe_url' | 'ky_thuat'>[]): string | null {
  return [...ds].filter((c) => c.keyframe_url).sort((a, b) => (DO_RONG[a.ky_thuat?.co_canh ?? ''] ?? 3) - (DO_RONG[b.ky_thuat?.co_canh ?? ''] ?? 3))[0]?.keyframe_url ?? null;
}
export function thamChieuCum(cum: readonly { canh: Canh; nhanVat: NhanVat[] }[], toiDa = 7, boiCanh?: string | null): { anh: string[]; goi: string; tag: Record<string, string>; them: string } {
  const nguoi: { ten: string; anh: string[] }[] = [];
  for (const { canh: c, nhanVat } of cum) for (const v of nhanVat.filter((x) => x.loai === 'nhan_vat' && c.nhan_vat.includes(x.id))) {   // chỉ người CÓ MẶT trong shot — ảnh theo đúng đồ lúc đó
    if (nguoi.some((n) => n.ten === v.ten)) continue;
    const bt = (v.bien_the ?? []).find((b) => c.bien_the.includes(b.id) && b.anh_url)?.anh_url;
    nguoi.push({ ten: v.ten, anh: [...new Set([bt, ...(v.anh_mat?.url ?? []).slice(0, 1), ...v.anh_ref].filter((x): x is string => !!x))].slice(0, 2) });
  }
  const rong = boiCanh ?? anhBoiCanh(cum.map((x) => x.canh));
  // ảnh đầu của mỗi người trước (danh tính), ảnh phụ khi còn chỗ, bối cảnh luôn giữ một ô
  const cho = toiDa - (rong ? 1 : 0); const anh: string[] = []; const nhan: string[] = [];
  for (const n of nguoi) if (n.anh[0] && anh.length < cho) { anh.push(n.anh[0]); nhan.push(n.ten); }
  for (const n of nguoi) if (n.anh[1] && anh.length < cho) { anh.push(n.anh[1]); nhan.push(n.ten); }
  if (rong) { anh.push(rong); nhan.push('the location (lighting, set, colours)'); }
  // tag: tên → "reference image N" (ảnh danh tính đầu của người đó) — promptCumMoi gắn vào câu định nghĩa bằng dáng nhìn thấy, không gọi tên
  const tag: Record<string, string> = {}; nhan.forEach((t, i) => { if (i < anh.length - (rong ? 1 : 0)) tag[t] ??= `reference image ${i + 1}`; });
  // câu tả ảnh KHÔNG gọi tên (model video không biết tên, tên bị in lên hình — #353 19/10/2026): người → nhãn nhìn thấy (giới), 14/11/2026 #3071 lộ "is Chú"
  const nhanNguoi = new Map(nhanNhin(nguoi.map((n) => ({ ten: n.ten, moTaNv: cum.flatMap((x) => x.nhanVat).find((v) => v.ten === n.ten)?.mo_ta }))).map((x) => [x.ten, x.gon]));
  // nhãn trùng nhau (hai người cùng giới, không có đồ) thì không phân biệt được → chỉ nói "a character sheet"; câu định nghĩa người (promptCumMoi, theo tag) nối ảnh với người
  const nhanTrung = (t: string) => [...nhanNguoi.values()].filter((x) => x === nhanNguoi.get(t)).length > 1;
  return { anh, goi: nhan.map((t, i) => `Reference image ${i + 1} is ${nhanNguoi.has(t) ? (nhanTrung(t) ? 'a character sheet' : nhanNguoi.get(t)) : t}`).join('; '), tag, them: rong ? `Reference image ${anh.length} is the location (lighting, set, colours).` : '' };
}

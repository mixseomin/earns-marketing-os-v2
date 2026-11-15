// KHỚP THOẠI THEO TIẾNG CLIP — MỘT luật cho mọi clip sinh kèm giọng (Seedance @Audio1), anh 15/11/2026 "rút kinh nghiệm triệt để, rule chuẩn, không chắp vá".
//
// Điều đã đo (phim #3071, soát bằng mắt từng khung 8 / giây):
//   - Model TỰ chọn lúc nói, KHÔNG nói đúng giây ta đặt câu trong file giọng (#6 lần 4: đặt 0,2 s → nói 0,6 s; #4 lần 2: đặt 0,1 s → nói 0,8 s).
//   - Miệng model vẽ KHỚP với TIẾNG CHÍNH NÓ sinh trong clip (#4, #6 lần 4: miệng mở đúng bin tiếng đầu tiên, ngậm khi hết tiếng).
//   => Điểm vào shot = lúc clip BẮT ĐẦU NÓI − lúc câu bắt đầu nghe thấy trong shot (trễ câu + khoảng lặng đầu file giọng). Bản dựng phát giọng gốc đúng giây đó.
//   - Hai cách cũ đã bỏ: tương quan đường âm lượng (giọng model đọc lại khác nhịp giọng gốc, độ khớp chỉ 0,4–0,66, bắt nhầm đỉnh) và đo độ mở miệng
//     bằng hình (scripts/cham-do/do_mieng.py, ngưỡng 0,27 hiệu chỉnh trên 4 shot) — cả hai sai 0,2–0,55 s trên chính các clip đã soát.
//
// Kiểm KÈM (clip hỏng thì không gắn, vào lượt sinh lại):
//   - đoạn của shot không có tiếng nói → model không nói;
//   - tiếng nói trong đoạn dài hơn / ngắn hơn câu quá xa (ngoài 0,75–1,4 lần) → model nói lặp (#6 lần 3: hai lần, 2,5 s cho câu 1,2 s) hoặc nói câu khác;
//
// TỐC KHỚP (anh 15/11/2026 "shot 6 tự nhiên nói chậm quá"): model đọc chậm hơn giọng gốc (#6: miệng 1,4 s cho câu 1,19 s; #4: 1,0 s cho 0,8 s) → miệng còn
//   mấp máy sau khi giọng đã hết. toc = độ dài tiếng clip ÷ độ dài câu, ghi ky_thuat.toc_khop; bản xuất + timeline chạy clip shot đó nhanh đúng toc (toc-do.ts ›
//   kieuTocShot) để miệng nói xong cùng lúc với giọng. Điểm vào tính theo tốc: giây clip = vao + giây shot × toc.
//   - điểm vào mới làm shot phát lố khỏi đoạn của nó (doanShot) → không bù được.
// Thuần (nhận mảng âm lượng), tự kiểm: can-giong.test.mts (số đo thật #4, #6). Script: thu-seedance-cum.mts (sau khi sinh, và --chinh-giong cho clip đang gắn).
export const DIEM_GIAY = 100;   // điểm âm lượng / giây

/** Đường âm lượng: trung bình |mẫu| mỗi 10 ms từ PCM 16-bit mono (tần số mẫu sr). */
export function duongAmLuong(pcm: Int16Array, sr: number): Float32Array {
  const buoc = Math.max(1, Math.round(sr / DIEM_GIAY)); const n = Math.floor(pcm.length / buoc); const o = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = i * buoc; k < (i + 1) * buoc; k++) s += Math.abs(pcm[k]!); o[i] = s / buoc; }
  return o;
}

/** ĐOẠN của từng shot trong clip cụm, MỘT nguồn cho khớp thoại và nguon_video.doan: từ điểm vào đo theo cú cắt (TRƯỚC khi khớp thoại)
 *  — shot đầu từ 0 (cho phép dời lùi về đầu clip), shot kế tới cú cắt sau − 0,05 s, shot cuối tới hết clip − đuôi. */
export function doanShot(vaoCat: number[], daiClip: number, duoi = 0.45): [number, number][] {
  return vaoCat.map((v, i) => [i === 0 ? 0 : v, i + 1 < vaoCat.length ? +(vaoCat[i + 1]! - 0.05).toFixed(2) : +(daiClip - duoi).toFixed(2)]);
}

const LIEN = 5;   // ≥ 5 điểm liền (50 ms) trên ngưỡng mới tính là tiếng nói — bỏ tiếng tách / tiếng động lẻ
/** Khoảng có tiếng nói trong [tu, den) (giây): ngưỡng = nền (phân vị 5 % — file giọng cắt gọn có ~86 % là tiếng nói, phân vị 20 % rơi vào tiếng) + 30 % (đỉnh − nền). Không có tiếng nói (đỉnh < 3 × nền + 1) → null. */
export function khoangNoi(a: Float32Array, tu = 0, den = a.length / DIEM_GIAY): { bd: number; kt: number } | null {
  const i0 = Math.max(0, Math.round(tu * DIEM_GIAY)), i1 = Math.min(a.length, Math.round(den * DIEM_GIAY)); if (i1 - i0 < LIEN) return null;
  const w = Array.from(a.subarray(i0, i1)); const xep = [...w].sort((p, q) => p - q);
  const nen = xep[Math.floor(xep.length * 0.05)]!, dinh = xep[xep.length - 1]!; if (dinh < 3 * nen + 1) return null;
  const nguong = nen + 0.3 * (dinh - nen); let bd = -1, kt = -1, chay = 0;
  for (let i = 0; i < w.length; i++) { if (w[i]! > nguong) { chay++; if (chay === LIEN && bd < 0) bd = i - LIEN + 1; if (chay >= LIEN) kt = i + 1; } else chay = 0; }
  return bd < 0 ? null : { bd: +((i0 + bd) / DIEM_GIAY).toFixed(2), kt: +((i0 + kt) / DIEM_GIAY).toFixed(2) };
}

/** Điểm vào của MỘT shot theo tiếng clip. clip = âm lượng cả clip; doan = đoạn của shot (doanShot); cau = các câu của shot theo thứ tự (âm lượng file giọng + trễ câu). */
export function khopTheoTiengClip(o: { clip: Float32Array; doan: [number, number]; phat: number; cau: { giong: Float32Array; tre: number }[] }): { vao: number; toc: number; noi: { bd: number; kt: number } | null; loi: string | null } {
  const dau = o.cau[0], cuoi = o.cau[o.cau.length - 1];
  const kDau = dau ? khoangNoi(dau.giong) : null, kCuoi = cuoi ? khoangNoi(cuoi.giong) : null;
  if (!dau || !cuoi || !kDau || !kCuoi) return { vao: o.doan[0], toc: 1, noi: null, loi: 'file giọng không có tiếng nói' };
  const bdCau = dau.tre + kDau.bd, ktCau = cuoi.tre + kCuoi.kt;   // giây câu bắt đầu / hết nghe thấy, tính từ đầu shot
  const noi = khoangNoi(o.clip, o.doan[0], o.doan[1]);
  if (!noi) return { vao: o.doan[0], toc: 1, noi, loi: `đoạn của shot (${o.doan[0]}–${o.doan[1]} s) không có tiếng nói — model không nói câu thoại` };
  const tiLe = (noi.kt - noi.bd) / Math.max(0.2, ktCau - bdCau);
  if (tiLe < 0.75 || tiLe > 1.4) return { vao: o.doan[0], toc: 1, noi, loi: `tiếng nói trong clip ${noi.bd}–${noi.kt} s (${(noi.kt - noi.bd).toFixed(2)} s) lệch xa câu (${(ktCau - bdCau).toFixed(2)} s) — model nói lặp / nói câu khác` };
  const toc = Math.abs(tiLe - 1) < 0.05 ? 1 : +tiLe.toFixed(2);   // lệch < 5 % thì giữ tốc thường
  const vao = +(noi.bd - bdCau * toc).toFixed(2); const can = o.phat * toc;   // giây clip shot dùng
  if (vao < o.doan[0] - 0.05 || vao + can > o.doan[1] + 0.05) return { vao, toc, noi, loi: `clip nói ở ${noi.bd} s → điểm vào ${vao} s, shot dùng ${can.toFixed(2)} s clip lố khỏi đoạn ${o.doan[0]}–${o.doan[1]} s — không bù được` };
  return { vao: +Math.max(o.doan[0], Math.min(vao, o.doan[1] - can)).toFixed(2), toc, noi, loi: null };
}

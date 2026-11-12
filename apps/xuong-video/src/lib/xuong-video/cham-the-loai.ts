// BỘ CHẤM THỂ LOẠI (anh 13/11/2026: "thể loại phim khác nhau như hài, kinh dị, hành động… có tiêu chí khác nhau nào ngành đã có kinh nghiệm… tạo thành bộ chấm
// riêng; hài thì có nhiều kiểu hài… tổ chức xử lý thế nào"). Ba tầng: (1) chung mọi phim = ngữ pháp shot + Murch (diem-murch.ts, cong-video-tho.ts);
// (2) THỂ LOẠI = tiêu chí chung của thể loại; (3) TIỂU LOẠI theo TỪNG GAG (phan_canh[].gag[].kieu) — một phim hài trộn gag vật lý ở cảnh này, gag lời ở cảnh kia.
// Mọi tiêu chí đọc từ dữ liệu đo được (cỡ cảnh, giây phát, vai, lịch thoại, tốc độ nói, máy 3D) — câu "có buồn cười không" để người xem ảo (kiem-nguoi-xem).
// Thuần — chạy cả lưới (trình duyệt) lẫn máy chủ. Tự kiểm: cham-the-loai.test.mts
import type { Canh, KieuHai, PhanCanh } from './kieu';
import { giayPhat } from './kieu';
import { tiengGiay } from './toc-noi';
import { nguoiNoiKhongThayMat, matQuayDi } from './bo-set-3d';

export type TieuChiTl = { ma: string; ten: string; dat: boolean | null; ly: string; nguon: string; gag?: string };
export type KqTheLoai = { the_loai: string; diem: number; tieu_chi: TieuChiTl[] };
export const KIEU_HAI: Record<KieuHai, { ten: string; mo_ta: string }> = {
  vat_ly: { ten: 'Hài vật lý (slapstick)', mo_ta: 'Gag bằng cơ thể / đồ vật: diễn trọn trong cỡ rộng thấy toàn thân, không cắt giữa gag' },
  loi: { ten: 'Hài lời (verbal)', mo_ta: 'Câu chốt: ngắt một nhịp trước, cận người nói' },
  tinh_huong: { ten: 'Hài tình huống / trớ trêu', mo_ta: 'Khán giả biết trước nhân vật (chênh thông tin), gài → trả' },
  mat_lanh: { ten: 'Hài mặt lạnh / slow burn', mo_ta: 'Cận phản ứng giữ lâu, im tiếng, chốt cảnh (button)' },
  nhai: { ten: 'Hài nhại (parody)', mo_ta: 'Khán giả nhận ra gốc đang nhại' },
};
const CO_CAN = new Set(['cu', 'mcu', 'ecu', 'ots']), CO_TOAN_THAN = new Set(['ws', 'ms', 'two', 'ls', 'mls', 'ews']);
const tu = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((x) => x.length > 1);
const chuShot = (c: Canh) => [c.hanh_dong, c.loi_thoai, ...(c.thoai ?? []).map((d) => d.loi)].filter(Boolean).join(' ');

/** Chấm phim HÀI: tiêu chí chung + tiêu chí theo kiểu từng gag. ds = shot nhánh chính đã xếp theo thứ tự phát. */
export function chamHai(ds: Canh[], phanCanh: PhanCanh[], laNv: (ten: string) => boolean): TieuChiTl[] {
  const out: TieuChiTl[] = []; const chiSo = (c: Canh) => ds.findIndex((x) => x.id === c.id);
  const gags = phanCanh.flatMap((pc) => (pc.gag ?? []).map((g) => ({ pc, g, shot: ds.filter((c) => c.phan_doan === pc.ten)[g.o_shot - 1] })));
  if (!gags.length) return [{ ma: 'co_gag', ten: 'Có gag khai báo', dat: false, ly: 'phim hài mà chưa cảnh nào khai gag (gài → bùng, shot bùng, kiểu hài) — máy không biết chấm cú bùng nào', nguon: 'McKee — setup / payoff' }];
  // ── nhịp chung của phim hài ──
  const asl = ds.reduce((s, c) => s + giayPhat(c), 0) / Math.max(1, ds.length);
  out.push({ ma: 'asl', ten: 'Nhịp cắt (ASL)', dat: asl <= 3.5, ly: `độ dài shot trung bình ${asl.toFixed(1)} s (hài ngắn ≤ 3,5 s)`, nguon: 'Bordwell — intensified continuity; lệ phim hài ngắn' });
  const toc = ds.flatMap((c) => (c.thoai ?? []).map((d) => tiengGiay(d)).filter((x): x is number => x != null));
  const tb = toc.length ? toc.reduce((a, b) => a + b, 0) / toc.length : null;
  out.push({ ma: 'toc_noi', ten: 'Nhịp nói', dat: tb == null ? null : tb >= 4, ly: tb == null ? 'chưa có giọng đo độ dài' : `trung bình ${tb.toFixed(1)} tiếng/giây (≥ 4)`, nguon: 'timing hài: lời gọn, nhanh tới câu chốt' });
  for (const { pc, g, shot } of gags) {
    const nhan = `gag "${g.ten}"`;
    if (!shot) { out.push({ ma: 'o_shot', ten: 'Shot bùng', dat: false, ly: `${nhan}: cảnh "${pc.ten}" không có shot thứ ${g.o_shot}`, nguon: '', gag: g.ten }); continue; }
    const i = chiSo(shot); const truoc = ds.slice(0, i);
    // GÀI → TRẢ: chữ của phần gài phải xuất hiện trên màn TRƯỚC cú bùng (≥ một nửa từ khoá)
    const kg = tu(g.gai); const thay = kg.filter((w) => truoc.some((c) => tu(chuShot(c)).includes(w))).length;
    out.push({ ma: 'gai_tra', ten: 'Gài trước, trả sau', dat: kg.length ? thay / kg.length >= 0.5 : false, ly: `${nhan}: ${thay}/${kg.length} từ của phần gài "${g.gai}" đã lên màn trước shot bùng #${shot.thu_tu}`, nguon: 'McKee — setup / payoff; Chekhov', gag: g.ten });
    // PHẢN ỨNG SAU BÙNG: trong ≤ 4 shot có cận phản ứng thấy mặt, giữ ≥ 1,5 s
    const sau = ds.slice(i + 1, i + 5).filter((c) => c.ky_thuat?.vai === 'phan_ung' && CO_CAN.has(c.ky_thuat?.co_canh ?? '') && giayPhat(c) >= 1.5 && !matQuayDi(c, laNv).length);
    out.push({ ma: 'phan_ung', ten: 'Cận phản ứng sau cú bùng', dat: sau.length > 0, ly: sau.length ? `${nhan}: #${sau[0]!.thu_tu} cận phản ứng ${giayPhat(sau[0]!)} s` : `${nhan}: 4 shot sau bùng #${shot.thu_tu} không có cận phản ứng thấy mặt ≥ 1,5 s`, nguon: 'double take / slow burn (Oliver Hardy, Jack Benny); Murch — cảm xúc', gag: g.ten });
    const kieu = g.kieu;
    if (!kieu) { out.push({ ma: 'kieu', ten: 'Kiểu hài', dat: false, ly: `${nhan}: chưa khai kiểu hài — máy không biết áp bộ tiêu chí nào`, nguon: '', gag: g.ten }); continue; }
    if (kieu === 'vat_ly') {
      out.push({ ma: 'vat_ly_toan', ten: 'Gag vật lý ở cỡ thấy toàn thân', dat: CO_TOAN_THAN.has(shot.ky_thuat?.co_canh ?? ''), ly: `${nhan}: shot bùng cỡ ${shot.ky_thuat?.co_canh ?? '—'}`, nguon: 'Chaplin — "comedy in long shot"; Keaton', gag: g.ten });
      out.push({ ma: 'vat_ly_tron', ten: 'Gag diễn trọn không cắt', dat: giayPhat(shot) >= 2, ly: `${nhan}: shot bùng ${giayPhat(shot)} s`, nguon: 'Keaton — không cắt giữa gag', gag: g.ten });
    }
    if (kieu === 'loi') {
      const t = shot.thoai ?? []; const cuoi = t[t.length - 1]; let ngat: number | null = null;
      if (cuoi) { const k = t.length - 1; let ket = 0; for (let j = 0; j < k; j++) ket = Math.max(ket, (t[j]!.tre ?? 0) + (t[j]!.dai ?? 0)); ngat = (cuoi.tre ?? 0) - (k ? ket : 0); }
      out.push({ ma: 'loi_ngat', ten: 'Ngắt một nhịp trước câu chốt', dat: ngat == null ? false : ngat >= 0.3, ly: ngat == null ? `${nhan}: shot bùng không có câu chốt` : `${nhan}: ngắt ${ngat.toFixed(2)} s trước câu chốt (≥ 0,3)`, nguon: 'comic timing — the pause before the punchline', gag: g.ten });
      out.push({ ma: 'loi_can', ten: 'Câu chốt trong cận người nói', dat: CO_CAN.has(shot.ky_thuat?.co_canh ?? '') && !nguoiNoiKhongThayMat(shot).length, ly: `${nhan}: shot bùng cỡ ${shot.ky_thuat?.co_canh ?? '—'}`, nguon: 'Arijon — singles', gag: g.ten });
    }
    if (kieu === 'tinh_huong') {
      const lo = truoc.filter((c) => ['he_lo', 'chu_quan', 'nguoi_thu_ba'].includes(c.ky_thuat?.vai ?? ''));
      out.push({ ma: 'chenh_tt', ten: 'Khán giả biết trước (chênh thông tin)', dat: lo.length > 0, ly: lo.length ? `${nhan}: #${lo.map((c) => c.thu_tu).join(', #')} cho khán giả thấy trước cú bùng` : `${nhan}: không có shot hé lộ (he_lo / POV / người thứ ba) trước bùng #${shot.thu_tu}`, nguon: 'Hitchcock — suspense vs surprise; dramatic irony', gag: g.ten });
    }
    if (kieu === 'mat_lanh') {
      const ok = shot.ky_thuat?.vai === 'phan_ung' && CO_CAN.has(shot.ky_thuat?.co_canh ?? '') && giayPhat(shot) >= 2 && !(shot.thoai ?? []).some((d) => d.loi?.trim()) && !matQuayDi(shot, laNv).length;
      out.push({ ma: 'mat_lanh', ten: 'Cận mặt lạnh giữ lâu, im lời', dat: ok, ly: `${nhan}: shot #${shot.thu_tu} ${shot.ky_thuat?.vai ?? '—'} · ${shot.ky_thuat?.co_canh ?? '—'} · ${giayPhat(shot)} s · ${(shot.thoai ?? []).length ? 'có lời' : 'im lời'} (cần cận phản ứng ≥ 2 s, không lời, thấy mặt)`, nguon: 'slow burn (Edgar Kennedy), deadpan (Keaton); button', gag: g.ten });
      out.push({ ma: 'mat_lanh_nhac', ten: 'Không nhạc đè cú chốt', dat: pc.nhac === 'khong', ly: `${nhan}: nhạc cảnh "${pc.ten}" = ${pc.nhac || '—'}`, nguon: 'deadpan: im lặng làm cú chốt', gag: g.ten });
    }
    if (kieu === 'nhai') out.push({ ma: 'nhai', ten: 'Khai gốc đang nhại', dat: !!g.tham_chieu?.trim(), ly: `${nhan}: ${g.tham_chieu?.trim() || 'chưa khai tác phẩm / quy ước đang nhại'}`, nguon: 'parody: khán giả phải nhận ra gốc', gag: g.ten });
  }
  return out;
}

/** Bảng thể loại → bộ chấm. Chưa có bộ chấm = null (lưới ghi 'chưa có bộ chấm cho thể loại này'). Kinh dị / hành động / tình cảm: thêm hàm cùng khuôn. */
export const BO_CHAM: Partial<Record<string, (ds: Canh[], pc: PhanCanh[], laNv: (t: string) => boolean) => TieuChiTl[]>> = { hai: chamHai };
export function chamTheLoai(theLoai: string | undefined, ds: Canh[], pc: PhanCanh[], laNv: (t: string) => boolean): KqTheLoai | null {
  const f = theLoai ? BO_CHAM[theLoai] : undefined; if (!f) return null;
  const tc = f(ds, pc, laNv); const co = tc.filter((x) => x.dat !== null);
  return { the_loai: theLoai!, diem: co.length ? Math.round((100 * co.filter((x) => x.dat).length) / co.length) : 0, tieu_chi: tc };
}

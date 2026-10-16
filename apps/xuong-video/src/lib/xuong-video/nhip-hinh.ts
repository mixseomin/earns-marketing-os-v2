// NHỊP HÌNH (13/10/2026 — "làm sao để chuyển động đa dạng hơn"): Fox tập 2 có 7/14 shot máy đứng yên, ba cặp shot liền nhau trùng hệt
// cỡ cảnh + chuyển động máy → xem như một ảnh tĩnh kéo dài. Máy đo trên kỹ thuật đã chọn của từng shot (ky_thuat), chặn keyframe như
// các cổng tiền kỳ khác (quy-trinh.ts › chanTienKy), và có cách sửa 0đ: đaDangMay đổi chuyển động máy đúng các shot phạm luật.
// Hành động TRONG khung (nhân vật làm gì) thì luật kể chuyện của Claude lo (claude.ts › LUAT_KE_CHUYEN số 9) + câu "khung hình sống"
// trong prompt video (sinh-video.ts). Thuần — tự kiểm: nhip-hinh.test.mts
import { MAY_DAY_VAO } from './san-pham-shot';
import type { KyThuatShot } from './dien-anh';
import { O_DAN_DUNG_BAT_BUOC, type DanDung, type PhanCanh } from './kieu';

export const TIEN_TO_NHIP_HINH = 'nhịp hình: ';
/** Tối đa bao nhiêu phần shot được để máy đứng yên (hài cần vài shot đứng yên để đúng nhịp, nhưng không quá nửa phim). */
export const TI_LE_TINH_TOI_DA = 0.4;
const TINH = (k?: KyThuatShot) => !k?.chuyen_dong || k.chuyen_dong === 'tinh';

/** tranh_day = không chọn chuyển động đẩy vào (san-pham-shot.ts › tranhDayVao: sản phẩm mặc trên người ở cỡ có người). */
type ShotNhip = { id?: number; thu_tu: number; ky_thuat?: KyThuatShot | null; tranh_day?: boolean };

/** Lỗi nhịp hình của một chuỗi shot (đã xếp theo thứ tự phát). */
export function kiemNhipHinh(ds: ShotNhip[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < ds.length; i++) {
    const a = ds[i - 1]!.ky_thuat ?? {}; const b = ds[i]!.ky_thuat ?? {};
    if (a.co_canh && a.co_canh === b.co_canh && (a.chuyen_dong ?? 'tinh') === (b.chuyen_dong ?? 'tinh'))
      out.push(`${TIEN_TO_NHIP_HINH}#${ds[i - 1]!.thu_tu}–#${ds[i]!.thu_tu} cùng cỡ cảnh + cùng chuyển động máy (nhìn như một shot kéo dài)`);
  }
  const tinh = ds.filter((c) => TINH(c.ky_thuat ?? undefined)).length;
  if (ds.length >= 5 && tinh > Math.floor(ds.length * TI_LE_TINH_TOI_DA))
    out.push(`${TIEN_TO_NHIP_HINH}${tinh}/${ds.length} shot máy đứng yên (tối đa ${Math.floor(ds.length * TI_LE_TINH_TOI_DA)})`);
  return out;
}

/** Chuyển động máy hợp từng cỡ cảnh, theo thứ tự ưu tiên (đều là key của thư viện điện ảnh dien-anh.ts). */
const HOP_CO_CANH: Record<string, string[]> = {
  ecu: ['day_vao', 'lia', 'cam_tay'], cu: ['day_vao', 'lia', 'nghieng_len'], mcu: ['day_vao', 'truot_ngang', 'lia'],
  ms: ['truot_ngang', 'day_vao', 'lia'], two: ['vong', 'truot_ngang', 'lia'], ws: ['lui_ra', 'truot_ngang', 'cau'], ews: ['cau', 'lui_ra', 'lia'],
};
const HOP_MAC_DINH = ['day_vao', 'truot_ngang', 'lia', 'lui_ra'];

/** Sửa 0đ: đổi chuyển động máy của các shot phạm luật, ít đổi nhất có thể — trả danh sách { id, ky_thuat mới } cần ghi.
 *  Đổi: shot trùng y hệt shot trước; rồi tới khi số shot đứng yên ≤ trần (đổi các shot đứng yên nằm cạnh shot đứng yên khác trước). */
export function daDangMay<T extends ShotNhip & { id: number }>(ds: T[]): { id: number; ky_thuat: KyThuatShot }[] {
  const kt = ds.map((c) => ({ ...(c.ky_thuat ?? {}) }));
  const doi = new Set<number>();
  const chon = (i: number) => {
    const truoc = kt[i - 1]?.chuyen_dong; const sau = kt[i + 1]?.chuyen_dong;
    const ds2 = (HOP_CO_CANH[kt[i]!.co_canh ?? ''] ?? HOP_MAC_DINH).filter((x) => !(ds[i]!.tranh_day && MAY_DAY_VAO.includes(x)));
    const m = ds2.find((x) => x !== truoc && x !== sau && x !== kt[i]!.chuyen_dong) ?? ds2[0]!;
    kt[i]!.chuyen_dong = m; doi.add(i);
  };
  for (let i = 1; i < kt.length; i++) {
    const a = kt[i - 1]!, b = kt[i]!;
    if (a.co_canh && a.co_canh === b.co_canh && (a.chuyen_dong ?? 'tinh') === (b.chuyen_dong ?? 'tinh')) chon(i);
  }
  const tran = Math.floor(kt.length * TI_LE_TINH_TOI_DA);
  const tinh = () => kt.map((k, i) => (TINH(k) ? i : -1)).filter((i) => i >= 0);
  while (kt.length >= 5 && tinh().length > tran) {
    const t = tinh();
    // đứng yên cạnh đứng yên trước (phá chuỗi tĩnh), không có thì shot đứng yên đầu tiên
    const i = t.find((x) => TINH(kt[x - 1]) || TINH(kt[x + 1])) ?? t[0]!;
    chon(i);
  }
  return [...doi].map((i) => ({ id: ds[i]!.id, ky_thuat: kt[i]! }));
}

/** NHỊP ĐỌC (14/10/2026 — Tango & Lint tập 1: "chuyển cảnh nhanh chưa kịp hiểu gì"): 20 shot trong 48s, mỗi clip 4s bị cắt còn 2–2,5s
 *  đúng lúc hành động chưa xong. Số giây tối thiểu một shot phải PHÁT để người xem đọc xong hành động: quảng cáo cắt nhanh được (có chữ
 *  + lời dẫn đỡ), phim truyện cần trọn đầu–giữa–cuối của hành động, phim không lời còn lâu hơn vì không có lời giải thích.
 *  MỘT luật cho: tách cảnh (claude.ts kẹp phat_s + giới hạn số shot), khớp giây theo giọng (hau-ky.ts không co dưới mức này),
 *  cổng tiền kỳ (chanTienKy). */
export const giayDoc = (p: { laQc?: boolean; khong_loi?: boolean }): number => (p.laQc ? 1.5 : p.khong_loi ? 3.5 : 3);
/** Số shot tối đa cho một thời lượng mà mỗi shot vẫn đủ giây đọc (chừa ~0,5s/shot cho phản ứng). */
export const soShotToiDa = (giay: number, p: { laQc?: boolean; khong_loi?: boolean }): number => Math.max(1, Math.floor(giay / (giayDoc(p) + (p.laQc ? 0 : 0.5))));
export const TIEN_TO_NHIP_DOC = 'nhịp đọc: ';
export const TIEN_TO_DAN_KHONG_GIAN = 'dẫn không gian: ';
export const TIEN_TO_VAI_KE = 'vai kể: ';
export const TIEN_TO_THE_SHOT = 'thẻ shot: ';
/** THẺ SHOT (kieu.ts › DanDung): phim truyện, mỗi shot phải có đủ bố cục 3 lớp, trạng thái mở/kết, hướng, mục đích cảm xúc trước khi sinh
 *  keyframe (motif không bắt buộc). Quảng cáo không xét. */
export function kiemTheShot(ds: { thu_tu: number; dan_dung?: DanDung }[], p: { laQc?: boolean }): string[] {
  if (p.laQc) return [];
  const can = O_DAN_DUNG_BAT_BUOC;
  const thieu = ds.map((c) => ({ c, t: can.filter((o) => !(c.dan_dung?.[o.key] ?? '').trim()) })).filter((x) => x.t.length);
  if (!thieu.length) return [];
  return [`${TIEN_TO_THE_SHOT}${thieu.length} shot thiếu ô thẻ (${thieu.slice(0, 5).map((x) => `#${x.c.thu_tu}: ${x.t.map((o) => o.ten.toLowerCase()).join(', ')}`).join(' · ')}${thieu.length > 5 ? '…' : ''})`];
}
/** VAI KỂ (14/10/2026 — "thiếu dẫn thời gian, góc người thứ 3, góc tổng thể, góc tâm trạng…"): một tập phim truyện phải kể bằng nhiều
 *  điểm nhìn, không chỉ chuỗi shot hành động. Đo trên ky_thuat.vai (dien-anh.ts › nhóm 'vai'). Quảng cáo và tập < 6 shot không xét. */
export function kiemVaiKe(ds: { thu_tu: number; phan_doan?: string; ky_thuat?: KyThuatShot | null }[], p: { laQc?: boolean }): string[] {
  if (p.laQc || ds.length < 6) return [];
  const out: string[] = []; const v = (i: number) => ds[i]?.ky_thuat?.vai ?? '';
  const chua = ds.filter((_, i) => !v(i));
  if (chua.length) out.push(`${TIEN_TO_VAI_KE}${chua.length} shot chưa chọn vai kể (${chua.slice(0, 6).map((c) => `#${c.thu_tu}`).join(', ')}${chua.length > 6 ? '…' : ''})`);
  if (![0, 1, 2].some((i) => ['thiet_lap', 'thoi_gian'].includes(v(i)))) out.push(`${TIEN_TO_VAI_KE}mở tập chưa đặt NƠI + THỜI ĐIỂM — 3 shot đầu cần một shot thiết lập hoặc dấu thời gian`);
  const pc = new Map<string, number[]>(); ds.forEach((c, i) => { const k = c.phan_doan ?? ''; if (k) pc.set(k, [...(pc.get(k) ?? []), i]); });
  const thieuTt = [...pc].filter(([, is]) => is.length >= 3 && !is.some((i) => ['tong_the', 'thiet_lap'].includes(v(i)))).map(([k]) => `"${k}"`);
  if (thieuTt.length) out.push(`${TIEN_TO_VAI_KE}phân cảnh chưa có shot tổng thể (ai ở đâu): ${thieuTt.join(', ')}`);
  const co = new Set(ds.map((_, i) => v(i)));
  const thieu = [!co.has('phan_ung') && 'phản ứng', !co.has('tam_trang') && 'tâm trạng', !co.has('nguoi_thu_ba') && !co.has('chu_quan') && 'góc người thứ ba / chủ quan'].filter(Boolean);
  if (thieu.length) out.push(`${TIEN_TO_VAI_KE}cả tập thiếu shot ${thieu.join(', ')}`);
  for (let i = 0; i + 3 < ds.length; i++) if ([0, 1, 2, 3].every((j) => v(i + j) === 'hanh_dong')) { out.push(`${TIEN_TO_VAI_KE}#${ds[i]!.thu_tu}–#${ds[i + 3]!.thu_tu} bốn shot hành động liền — chen phản ứng / chi tiết / người thứ ba để người xem kịp cảm`); break; }
  return out;
}
const RONG = new Set(['ews', 'ws']);
/** DẪN KHÔNG GIAN (14/10/2026 — kiểu Larva): người xem phải biết MÌNH ĐANG Ở ĐÂU trong thế giới trước khi chuyện xảy ra.
 *  1. Mở tập: một trong 2 shot đầu là toàn cảnh (ews/ws) — dẫn từ cả thế giới vào.
 *  2. Lần ĐẦU tới một nơi mới (anchor Bối cảnh khác hẳn shot trước, chưa từng xuất hiện trong tập): shot đó hoặc shot liền trước (hành
 *     trình) phải là toàn cảnh. Quay lại nơi đã thấy thì không cần. Quảng cáo không xét. boiCanh = id các anchor loại Bối cảnh của phim. */
export function kiemDanKhongGian(ds: { thu_tu: number; nhan_vat?: number[]; ky_thuat?: KyThuatShot | null }[], boiCanh: Iterable<number>, p: { laQc?: boolean }): string[] {
  if (p.laQc || ds.length < 3) return [];
  const bc = new Set(boiCanh); const out: string[] = [];
  const rong = (i: number) => RONG.has(ds[i]?.ky_thuat?.co_canh ?? '');
  if (!rong(0) && !rong(1)) out.push(`${TIEN_TO_DAN_KHONG_GIAN}mở tập chưa có shot toàn cảnh (2 shot đầu đều gần) — người xem không biết đang ở đâu trong thế giới`);
  const noi = (i: number) => (ds[i]?.nhan_vat ?? []).filter((x) => bc.has(x)).sort((a, b) => a - b).join(',');
  const daThay = new Set<string>(); let truoc = '';
  const lo: number[] = [];
  ds.forEach((_, i) => {
    const k = noi(i); if (!k) return;
    if (truoc && k !== truoc && !daThay.has(k) && !rong(i) && !rong(i - 1)) lo.push(ds[i]!.thu_tu);
    daThay.add(k); truoc = k;
  });
  if (lo.length) out.push(`${TIEN_TO_DAN_KHONG_GIAN}tới nơi mới mà không có shot toàn cảnh / hành trình dẫn vào: ${lo.map((x) => `#${x}`).join(', ')}`);
  return out;
}
/** Shot phát ngắn hơn giây đọc tối thiểu — chặn keyframe (quy-trinh.ts › chanTienKy). Quảng cáo không xét (luật QC riêng ở kiem-qc.ts). */
export function kiemGiayDoc(ds: { thu_tu: number; phat_s: number | null; thoi_luong_s: number }[], p: { laQc?: boolean; khong_loi?: boolean }): string[] {
  if (p.laQc) return [];
  const toi = giayDoc(p);
  const ngan = ds.filter((c) => (c.phat_s && c.phat_s > 0 ? c.phat_s : c.thoi_luong_s || 4) < toi - 0.05);
  return ngan.length ? [`${TIEN_TO_NHIP_DOC}${ngan.length} shot phát dưới ${toi}s (${ngan.slice(0, 8).map((c) => `#${c.thu_tu} ${c.phat_s ?? c.thoi_luong_s}s`).join(', ')}${ngan.length > 8 ? '…' : ''}) — người xem chưa kịp hiểu đã cắt; gộp/bớt shot hoặc kéo dài`] : [];
}

// ── DỰNG TRUYỆN (anh 15/10/2026 xem nối cảnh 7: "như có 2 câu chuyện nhỏ bên trong mà thiếu đoạn chia chuyện; đoạn kết chưa nổi rõ") ─────────
// Hai luật ngành đo được trên thẻ shot (vai kể · luật · giây) + gag của phân cảnh — không dò chữ:
//   NÚT ĐÓNG (button): một cảnh chứa ≥2 mạch truyện nhỏ thì mạch trước khép bằng một shot phản ứng / khoảng lặng đủ dài NGAY sau cú bùng cuối của nó,
//     rồi mạch sau mở lại bằng một shot nhắc mục tiêu / mối đe doạ (motif hoặc chênh lệch thông tin) trước cú bùng của mạch sau.
//   KẾT BA NHỊP (payoff → hold → button/hook): cảnh cuối tập có cú bùng cuối → shot GIỮ phản ứng ≥ 3s → (tập chưa phải tập cuối của series) shot
//     cuối là MÓC (chênh lệch thông tin: khán giả thấy điều nhân vật chưa biết) — mỗi nhịp một shot riêng, đúng thứ tự.
export const TIEN_TO_DUNG_TRUYEN = 'dựng truyện: ';
export const GIAY_NUT_DONG = 2.5;
export const GIAY_GIU_KET = 3;
type ShotTruyen = { thu_tu: number; phan_doan?: string; phat_s: number | null; thoi_luong_s: number; ky_thuat?: Pick<KyThuatShot, 'vai' | 'luat'> | null };
const giayCua = (c: ShotTruyen) => (c.phat_s && c.phat_s > 0 ? c.phat_s : c.thoi_luong_s || 4);
const laGiu = (c: ShotTruyen | undefined, giay: number) => !!c && ['phan_ung', 'tam_trang'].includes(c.ky_thuat?.vai ?? '') && giayCua(c) >= giay - 0.05 && (c.ky_thuat?.luat ?? []).some((l) => l === 'giu_phan_ung' || l === 'khoang_lang');
const laNhac = (c: ShotTruyen | undefined) => !!c && (c.ky_thuat?.luat ?? []).some((l) => l === 'motif' || l === 'chenh_thong_tin');
type PcTruyen = Pick<PhanCanh, 'ten' | 'intro' | 'gag'>;
export function kiemNutDong(pcs: PcTruyen[], ds: ShotTruyen[], p: { laQc?: boolean }): string[] {
  if (p.laQc) return [];
  const out: string[] = [];
  for (const pc of pcs) {
    const gag = [...(pc.gag ?? [])].sort((a, b) => a.o_shot - b.o_shot); if (pc.intro || gag.length < 2) continue;
    const ss = ds.filter((c) => c.phan_doan === pc.ten);
    if (gag.some((g) => !(g.mach ?? '').trim())) { out.push(`${TIEN_TO_DUNG_TRUYEN}cảnh "${pc.ten}" có ${gag.length} gag mà chưa khai mạch (gag.mach: A, B…) — máy không biết đâu là chỗ chia chuyện`); continue; }
    for (let i = 1; i < gag.length; i++) {
      const a = gag[i - 1]!, b = gag[i]!; if (a.mach === b.mach) continue;
      const nut = ss[a.o_shot];   // shot NGAY sau cú bùng cuối của mạch trước (o_shot 1-based)
      if (!laGiu(nut, GIAY_NUT_DONG) || a.o_shot >= b.o_shot - 1) { out.push(`${TIEN_TO_DUNG_TRUYEN}cảnh "${pc.ten}": mạch ${a.mach} ("${a.ten}") khép mà không có NÚT ĐÓNG — ngay sau shot bùng #${ss[a.o_shot - 1]?.thu_tu ?? '?'} cần một shot phản ứng / tâm trạng ≥ ${GIAY_NUT_DONG}s (luật giữ phản ứng / khoảng lặng) trước khi mạch ${b.mach} bắt đầu`); continue; }
      if (!ss.slice(a.o_shot + 1, b.o_shot - 1).some(laNhac)) out.push(`${TIEN_TO_DUNG_TRUYEN}cảnh "${pc.ten}": mạch ${b.mach} ("${b.ten}") không được MỞ LẠI — sau nút đóng #${nut!.thu_tu}, trước cú bùng #${ss[b.o_shot - 1]?.thu_tu ?? '?'} cần một shot nhắc mục tiêu / mối đe doạ (luật motif hoặc chênh lệch thông tin)`);
    }
  }
  return out;
}
/** coMoc = tập chưa phải tập cuối của series (phải móc sang tập sau). */
export function kiemKetTap(pcs: PcTruyen[], ds: ShotTruyen[], p: { laQc?: boolean; coMoc?: boolean }): string[] {
  if (p.laQc || ds.length < 6) return [];
  const pc = [...pcs].reverse().find((x) => !x.intro && ds.some((c) => c.phan_doan === x.ten)); if (!pc) return [];
  const ss = ds.filter((c) => c.phan_doan === pc.ten); const cuoi = ss.length - 1;
  const bung = Math.max(-1, ...(pc.gag ?? []).map((g) => g.o_shot - 1));
  const giu = ss.findIndex((c, i) => i > bung && laGiu(c, GIAY_GIU_KET) && (!p.coMoc || i < cuoi));
  const out: string[] = []; const o = `${TIEN_TO_DUNG_TRUYEN}kết tập (cảnh "${pc.ten}")`;
  if (giu < 0) out.push(`${o}: sau cú bùng cuối${bung >= 0 ? ` #${ss[bung]!.thu_tu}` : ''} chưa có shot GIỮ phản ứng ≥ ${GIAY_GIU_KET}s (vai phản ứng / tâm trạng, luật giữ phản ứng / khoảng lặng)${p.coMoc ? ' đứng trước shot móc' : ''} — khán giả chưa kịp cảm cái kết`);
  if (p.coMoc) {
    const s = ss[cuoi]!;
    if (!(s.ky_thuat?.luat ?? []).includes('chenh_thong_tin') || ['phan_ung', 'hanh_dong'].includes(s.ky_thuat?.vai ?? '')) out.push(`${o}: shot cuối #${s.thu_tu} chưa phải MÓC — tập còn tập sau thì shot cuối là một nhịp riêng cho khán giả thấy điều nhân vật chưa biết (luật chênh lệch thông tin; vai thiết lập / người thứ ba / chi tiết / tâm trạng)`);
    else if (cuoi === bung) out.push(`${o}: cú bùng cuối và cú móc dồn vào cùng shot #${s.thu_tu} — tách: bùng → giữ → móc`);
  }
  return out;
}

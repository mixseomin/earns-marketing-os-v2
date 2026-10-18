// CHẤM DẪN DẮT (anh 18/10/2026: "bộ khuôn này phải chấm được sự dẫn dắt các cảnh, các shot — cách trình bày trong film HBO rất rõ ràng, logic").
// Khuôn (khuon-chuoi.ts) nói một ĐOẠN làm nhiệm vụ kể gì; dẫn dắt chấm từng ĐIỂM CẮT: cắt có lý do không, vào cảnh mới khán giả có biết đang ở
// đâu / lúc nào không, cảnh có khép dứt không, nhìn mà có cho thấy thứ được nhìn không, có cắt nhảy hình không — và shot nào không phục vụ
// nhiệm vụ kể nào. Mỗi điểm cắt 100 trừ dần, mỗi khoản có mã + câu giải thích (hover timeline). Thuần, có test (dan-dat.test.mts).
import type { KyThuatShot } from './dien-anh';
import { kiemKhuon, type ApKhuon, type KetAp } from './khuon-chuoi';
import type { TheLoai } from './dien-anh';

export type ShotDanDat = { id: number; thu_tu: number; phan_doan: string; hanh_dong?: string; canh?: string; nhan_vat?: number[]; ky_thuat?: KyThuatShot | null };
export type CanhDanDat = { ten: string; noi?: string; luc?: string; ngay?: string };
/** luat = luật dựng cảnh (luat-dung.ts) mà khoản trừ này vi phạm — timeline bấm mở đúng luật trong thư viện. */
export type KhoanTru = { ma: string; tru: number; chu: string; luat?: string };
const LUAT_CUA: Record<string, string> = { nhay_hinh: 'luat_30', nhin_khong_dap: 'nhan_qua_huong_nhin', vao_khong_dinh_vi: 'dan_khong_gian', ra_giua_chung: 'khoang_lang', nhay_thoi_gian: 'dan_thoi_gian', don_nhip: 'nhip_doc', khong_phan_ung: 'giu_phan_ung' };
export const luatCuaTru = (ma: string) => LUAT_CUA[ma];
/** Một điểm cắt giữa shot `truoc` và `sau`. sangCanh = điểm nối hai phân cảnh. */
export type DiemCat = { truoc: number; sau: number; sangCanh: boolean; diem: number; tru: KhoanTru[] };
export type KetDanDat = { diem: number; diemCat: number; diemKhuon: number | null; cat: DiemCat[]; canh: { ten: string; diem: number; tru: KhoanTru[] }[]; ngoaiKhuon: number[]; khuon: KetAp[] };

const DINH_VI = ['thiet_lap', 'thoi_gian', 'tong_the', 'hanh_trinh'];
const CO_RONG = ['ews', 'ws'];
const CAU_NOI = ['hoa_tan', 'toi_den', 'cat_khop', 'j_cut', 'l_cut', 'quat_chuyen', 'mo_cheo', 'lien_may'];   // chuyển cảnh tự nối hai cảnh
const CHAM_CAU = ['phan_ung', 'tam_trang', 'chi_tiet', 'tong_the', 'thoi_gian'];
const NHIN = /nhìn|dõi|ngước|liếc|ngó|trừng|nhìn theo|\blook|\bstar(e|ing)|\bgaz(e|ing)|\bwatch/i;
const LIEN_SAU = /liền sau|ngay sau|cùng lúc|tiếp theo/i;

const cungNguoi = (a: ShotDanDat, b: ShotDanDat) => { const x = [...(a.nhan_vat ?? [])].sort().join(','); return x !== '' && x === [...(b.nhan_vat ?? [])].sort().join(','); };
const chu = (s: ShotDanDat) => `${s.hanh_dong ?? ''} ${s.canh ?? ''}`;
/** Các nhịp hành động một shot gánh (mô tả ngăn bằng ';'), bỏ ghi chú dựng (cắt đen, mờ, chuyển…). ≥ 3 nhịp mới là dồn: 2 nhịp liền một
 *  khoảnh khắc ('cửa mở, Hạ bước vào; luật sư theo sau') vẫn là một khung đúng — mỗi nhịp thừa ra nên có khung riêng (tach-shot.ts). */
const GHI_DUNG = /^(cắt|tắt|mờ|hoà tan|chuyển|fade|cut)\b/i;
export const nhipCua = (s: Pick<ShotDanDat, 'hanh_dong'>) => (s.hanh_dong ?? '').split(/;\s*/).map((x) => x.trim()).filter((x) => x && !GHI_DUNG.test(x));

/** Chấm MỘT điểm cắt. */
export function chamCat(a: ShotDanDat, b: ShotDanDat, pc: Map<string, CanhDanDat>): DiemCat {
  const tru: KhoanTru[] = [];
  const ka = a.ky_thuat ?? {}, kb = b.ky_thuat ?? {};
  const sangCanh = a.phan_doan !== b.phan_doan;
  if (!sangCanh) {
    // Trừ khung QUA VAI: qua vai A ↔ qua vai B (shot / ngược shot) cùng cỡ, cùng người trong khung nhưng đảo chủ thể — đúng chuẩn, không phải nhảy hình.
    if (ka.co_canh && ka.co_canh === kb.co_canh && ka.co_canh !== 'ots' && (ka.goc ?? '') === (kb.goc ?? '') && cungNguoi(a, b) && !['nhay', 'lien_may', 'cat_khop'].includes(ka.chuyen_canh ?? ''))
      tru.push({ ma: 'nhay_hinh', tru: 25, chu: 'hai shot cùng cỡ, cùng góc, cùng người — cắt thành nhảy hình (luật 30°: đổi cỡ ≥ 2 bậc hoặc góc ≥ 30°)' });
    if (NHIN.test(chu(a)) && ['phan_ung', 'chu_quan'].includes(ka.vai ?? '') && cungNguoi(a, b) && kb.vai === 'phan_ung')
      tru.push({ ma: 'nhin_khong_dap', tru: 10, chu: 'shot trước có người NHÌN, shot sau vẫn ở trên mặt họ — chưa cho khán giả thấy thứ được nhìn (khớp hướng nhìn)' });
  } else {
    const p1 = pc.get(a.phan_doan), p2 = pc.get(b.phan_doan);
    const cau = CAU_NOI.includes(ka.chuyen_canh ?? '');
    const cungNoi = !!p1?.noi && p1.noi === p2?.noi;
    if (!cungNoi && !cau && !DINH_VI.includes(kb.vai ?? '') && !CO_RONG.includes(kb.co_canh ?? ''))
      tru.push({ ma: 'vao_khong_dinh_vi', tru: 20, chu: `vào cảnh mới${p2?.noi ? ` (${p2.noi})` : ''} bằng ${kb.co_canh ?? 'shot'} không định vị, cũng không có chuyển cảnh nối — khán giả không biết đang ở đâu` });
    if (!CHAM_CAU.includes(ka.vai ?? '') && !cau)
      tru.push({ ma: 'ra_giua_chung', tru: 8, chu: 'cảnh khép giữa hành động — thiếu một nhịp chấm câu (phản ứng / chi tiết / khung lặng) trước khi sang cảnh' });
    const doiLuc = p2?.luc && !LIEN_SAU.test(p2.luc) && (p1?.luc !== p2.luc || p1?.ngay !== p2.ngay);
    if (doiLuc && !cau && kb.vai !== 'thoi_gian' && !(kb.luat ?? []).includes('dan_thoi_gian'))
      tru.push({ ma: 'nhay_thoi_gian', tru: 10, chu: `thời gian nhảy (${p1?.luc ?? '?'} → ${p2!.luc}) mà không có dấu hiệu thời gian hay chuyển cảnh thời gian (hoà tan / tắt đen)` });
  }
  const nhip = nhipCua(b);
  if (nhip.length >= 3) tru.push({ ma: 'don_nhip', tru: Math.min(20, 8 * (nhip.length - 2)), chu: `shot sau dồn ${nhip.length} nhịp hành động trong một khung (${nhip.join(' / ')}) — nên tách để mỗi nhịp có khung riêng` });
  return { truoc: a.id, sau: b.id, sangCanh, diem: Math.max(0, 100 - tru.reduce((s, x) => s + x.tru, 0)), tru };
}

const DIEM_MUC = { tot: 100, vang: 80, do: 50 } as const;

/** Chấm cả tập: điểm cắt (dẫn dắt) + khuôn (nhiệm vụ kể) + shot ngoài khuôn. diem = 60% điểm cắt + 40% điểm khuôn (khi tập đã áp khuôn). */
export function chamDanDat(canh: ShotDanDat[], phanCanh: CanhDanDat[], khuon: ApKhuon[] = [], theLoai?: TheLoai | ''): KetDanDat {
  const ds = [...canh].sort((a, b) => a.thu_tu - b.thu_tu);
  const pc = new Map(phanCanh.map((p) => [p.ten, p] as const));
  const cat = ds.slice(1).map((b, i) => chamCat(ds[i]!, b, pc));
  const kq = khuon.map((a) => kiemKhuon(a, ds, theLoai)).filter((k): k is KetAp => !!k);
  const trong = new Set(kq.flatMap((k) => k.shots.map((s) => s.id)));
  const ngoaiKhuon = kq.length ? ds.filter((s) => !trong.has(s.id)).map((s) => s.id) : [];
  const diemKhuon = kq.length ? Math.round((kq.reduce((s, k) => s + DIEM_MUC[k.muc], 0) / kq.length) * (trong.size / Math.max(1, ds.length))) : null;
  const tenCanh = [...new Set(ds.map((s) => s.phan_doan))];
  // Cấp CẢNH: cảnh ≥ 3 shot mà không có shot phản ứng nào → cảm xúc không có chỗ ngấm (luat-dung › giu_phan_ung).
  const canhDiem = tenCanh.map((ten) => {
    const cs = cat.filter((c) => ds.find((s) => s.id === c.sau)?.phan_doan === ten);
    const shots = ds.filter((s) => s.phan_doan === ten);
    const tru: KhoanTru[] = [];
    if (shots.length >= 3 && !shots.some((s) => s.ky_thuat?.vai === 'phan_ung')) tru.push({ ma: 'khong_phan_ung', tru: 10, chu: 'cảnh không có shot phản ứng nào — cảm xúc không có chỗ ngấm vào khán giả' });
    const tb = cs.length ? cs.reduce((s, c) => s + c.diem, 0) / cs.length : 100;
    return { ten, diem: Math.max(0, Math.round(tb - tru.reduce((s, x) => s + x.tru, 0))), tru };
  });
  const truCanh = canhDiem.reduce((s, c) => s + c.tru.reduce((a, x) => a + x.tru, 0), 0) / Math.max(1, canhDiem.length);
  const diemCat = Math.max(0, Math.round((cat.length ? cat.reduce((s, c) => s + c.diem, 0) / cat.length : 100) - truCanh));
  const diem = diemKhuon == null ? diemCat : Math.round(diemCat * 0.6 + diemKhuon * 0.4);
  return { diem, diemCat, diemKhuon, cat, canh: canhDiem, ngoaiKhuon, khuon: kq };
}

/** CỔNG (anh 18/10/2026 "cho vào cổng"): shot không được sinh keyframe / clip khi đoạn chứa nó dẫn dắt sai — điểm cắt VÀO shot dưới ngưỡng,
 *  hoặc khuôn chứa shot có lỗi đỏ (shot sai vai / lùi bước, hay khuôn thiếu bước bắt buộc). Vàng (thiếu bước "nên có", gợi ý luật) không chặn.
 *  Gọi từ quy-trinh.ts › chanShot (keyframe) và sinh-video / phu-thuoc (clip) — một luật cho nút trên màn lẫn máy chủ. */
export const NGUONG_CAT = 70;
export function chanDanDat(id: number, ds: ShotDanDat[], tap: { phan_canh?: CanhDanDat[]; khuon_chuoi?: ApKhuon[] }, theLoai?: TheLoai | ''): string[] {
  if (!ds.some((s) => s.id === id)) return [];
  const k = chamDanDat(ds, tap.phan_canh ?? [], tap.khuon_chuoi ?? [], theLoai);
  const so = new Map(ds.map((s) => [s.id, s.thu_tu] as const));
  const out: string[] = [];
  const cat = k.cat.find((c) => c.sau === id);
  if (cat && cat.diem < NGUONG_CAT) out.push(`dẫn dắt: cắt #${so.get(cat.truoc)} → #${so.get(id)} chỉ ${cat.diem}/100 (dưới ${NGUONG_CAT}) — ${cat.tru.map((t) => t.chu).join('; ')}`);
  for (const ap of k.khuon) {
    const sh = ap.shots.find((s) => s.id === id); if (!sh) continue;
    if (sh.muc === 'do') out.push(`khuôn "${ap.kh.ten}": ${sh.loi.join('; ')}`);
    const thieu = ap.thieu.filter((t) => t.muc === 'do');
    if (thieu.length) out.push(`khuôn "${ap.kh.ten}" thiếu bước bắt buộc ${thieu.map((t) => `"${t.ten}"`).join(', ')} — chèn shot ở ✎ làn 🧭 Khuôn`);
  }
  return out;
}

// THỬ NGƯỜI XEM LẦN ĐẦU (13/10/2026 — anh: "đây là chuẩn bị quan trọng cho mọi video, cần chuẩn hoá"). Fox Tales tập 2 chấm kịch bản 100/100
// (đủ 5 nhịp, hook, lật ngược đúng chỗ) mà xem xong vẫn khó hiểu: cú lật dựa vào truyện Aesop phim không kể, mục tiêu Felix không ai nói,
// đoạn quạ hát thì câm. Máy chấm cấu trúc không thấy được — phải có một người xem CHỈ biết thứ trên màn kể lại câu chuyện.
//   banNguoiXem(canh) = bảng shot chỉ gồm thứ người xem thấy (hành động) / đọc (chữ màn) / nghe (lời, ai nói) — không brief, không ghi chú.
//   maBan(ban)        = mã phiên bản: kịch bản đổi chữ/lời/hành động → kết quả thử cũ hết hiệu lực.
//   chanNguoiXem(...) = cổng trước sinh keyframe + xuất (quy-trinh.ts › chanTienKy, actions.ts › xuatTap).
// Lượt Claude ở claude.ts › thuNguoiXem. Thuần — tự kiểm: nguoi-xem.test.mts
import { boChamCuoi } from './ngat-dong';
import { doanChuMan, ghepThoai, giayPhat, type Canh, type DongThoai, type NhanVat, type ThuNguoiXem } from './kieu';

export type ShotXem = Pick<Canh, 'thu_tu' | 'phat_s' | 'thoi_luong_s' | 'hanh_dong' | 'chu_man' | 'thoai' | 'loi_thoai'> & Partial<Pick<Canh, 'phan_doan'>>;
/** Điểm hiểu tối thiểu (0–10) để qua cổng — cùng với "khớp ý tác giả". */
export const DIEM_HIEU_DAT = 7;

/** coGiay = ghi mốc giây từng shot (Claude cần để biết chữ có kịp đọc không). Mã phiên bản (maKichBan) tính KHÔNG có giây: giọng về thì máy tự
 *  khớp giây shot — tính giây vào mã thì mỗi lượt giọng lại làm hỏng kết quả kiểm dù nội dung không đổi. */
export function banNguoiXem(canh: ShotXem[], coGiay = true, coSo = true): string {
  let t = 0;
  return canh.map((c) => {
    const g = giayPhat(c); const tu = t; t += g;
    const chu = doanChuMan(c.chu_man ?? '', g).map((d) => d.dong.join(' ')).join(' / ').trim();
    const nghe = (c.thoai?.length ? c.thoai.filter((d) => d.loi.trim()).map((d) => `${d.nhan_vat.trim() || 'Người dẫn (giọng ngoài khung)'}: "${d.loi.trim()}"`) : c.loi_thoai.trim() ? [c.loi_thoai.trim()] : []).join(' · ');
    return `${coSo ? `#${c.thu_tu}` : '•'}${coGiay ? ` [${tu.toFixed(1)}–${t.toFixed(1)}s]` : ''} THẤY: ${c.hanh_dong.trim() || '(không tả)'} | CHỮ TRÊN MÀN: ${chu || '—'} | NGHE: ${nghe || '(không lời)'}`;
  }).join('\n');
}

/** Mã phiên bản NỘI DUNG kịch bản (chữ / lời / hành động, không giây) — cổng so mã này. */
export const maKichBan = (canh: ShotXem[]): string => maBan(banNguoiXem(canh, false));

/** Mã ngắn ổn định của bản người xem (djb2) — đủ để biết kịch bản đã đổi sau lần thử. */
export function maBan(ban: string): string {
  let h = 5381; for (let i = 0; i < ban.length; i++) h = ((h << 5) + h + ban.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Tiền tố mọi câu chặn của bước này — quy-trinh.ts lọc theo nó. */
export const TIEN_TO_NGUOI_XEM = 'người xem: ';
export const TEN_NUT_NGUOI_XEM = '🧑 Kiểm người xem có hiểu không';

/** Mã nội dung TỪNG CẢNH (phan_doan → mã) — không số shot, không giây: chèn shot ở cảnh 7 làm đánh số lại cảnh 8 cũng không làm cảnh 8 mất hiệu lực. */
export function maTheoCanh(canh: ShotXem[]): Record<string, string> {
  const nhom = new Map<string, ShotXem[]>();
  for (const c of canh) { const k = c.phan_doan ?? ''; nhom.set(k, [...(nhom.get(k) ?? []), c]); }
  return Object.fromEntries([...nhom].map(([k, ds]) => [k, maBan(banNguoiXem(ds, false, false))]));
}
export const TEN_NUT_NGUOI_XEM_CANH = '🧑 Kiểm riêng cảnh';

/** Cảnh nào đang ĐƯỢC PHỦ (qua cổng): lần kiểm cả tập đã đạt và cảnh đó chưa đổi, hoặc lần kiểm riêng cảnh đó đạt với đúng nội dung hiện tại. */
export function phuTheoCanh(t: ThuNguoiXem | null | undefined, canh: ShotXem[]): { ten: string; phu: boolean; ly_do: string }[] {
  const ma = maTheoCanh(canh);
  return Object.keys(ma).map((ten) => {
    const rieng = t?.canh?.[ten];
    if (rieng && rieng.ma === ma[ten]) return { ten, phu: rieng.dat, ly_do: rieng.dat ? 'kiểm riêng cảnh: đạt' : `kiểm riêng cảnh: chưa hiểu (${rieng.diem}/10) ${[rieng.lech, ...rieng.cho_kho.slice(0, 2).map((x) => `#${x.shot} ${x.van_de}`)].filter(Boolean).join('; ')}` };
    if (t?.dat && t.ma_canh?.[ten] === ma[ten]) return { ten, phu: true, ly_do: 'kiểm cả tập: đạt, cảnh chưa đổi' };
    return { ten, phu: false, ly_do: !t ? 'chưa kiểm' : t.ma_canh ? 'cảnh đã sửa sau lần kiểm' : 'bản kiểm cũ chưa có mã từng cảnh' };
  });
}

/** Kết luận MỘT chỗ cho nhãn (bảng người xem, thanh 🎬): đạt hay chưa, đạt theo cả tập hay nhờ kiểm riêng từng cảnh, khoảng điểm.
 *  Trước đây UI tự suy từ t.dat (vỏ bản cả tập) → phim #51 đạt nhờ 5 cảnh kiểm riêng mà nhãn ghi "✗ Hiểu 0/10 · lệch ý tác giả" (15/10/2026). */
export function tomTatNguoiXem(t: ThuNguoiXem | null | undefined, canh: ShotXem[]): { dat: boolean; theoCanh: boolean; soCanh: number; diem: [number, number] | null; cu: boolean } {
  if (!t) return { dat: false, theoCanh: false, soCanh: 0, diem: null, cu: false };
  const chan = chanNguoiXem(t, canh);
  const cu = chan.some((x) => x.includes('đã sửa sau lần kiểm'));
  if (t.ma === maKichBan(canh) && !(!t.dat && canhVuotCaTap(t, canh))) return { dat: t.dat, theoCanh: false, soCanh: 0, diem: [t.diem, t.diem], cu };
  const phu = phuTheoCanh(t, canh);
  const theoCanh = !chan.length && phu.length > 0 && phu.every((x) => x.phu);
  const ds = phu.map((x) => t.canh?.[x.ten]?.diem).filter((d): d is number => typeof d === 'number');
  return { dat: theoCanh, theoCanh, soCanh: phu.length, diem: theoCanh && ds.length ? [Math.min(...ds), Math.max(...ds)] : null, cu };
}

/** Bản cả tập KHỚP mã nhưng chưa đạt, rồi SAU ĐÓ mọi cảnh được kiểm riêng và đạt trên đúng nội dung hiện tại → các lần kiểm cảnh mới hơn thay
 *  kết luận cả tập. Trước đây nhánh khớp mã chỉ nhìn t.dat nên một lượt cả tập hỏng (cổng rẻ trả chữ rác "0/10", phim #306 25/10/2026) chặn mãi dù
 *  6/6 cảnh đã kiểm riêng đạt sau đó. Lần kiểm cả tập MỚI HƠN mọi cảnh vẫn là bằng chứng mới nhất → vẫn chặn. */
function canhVuotCaTap(t: ThuNguoiXem, canh: ShotXem[]): boolean {
  if (!canh.some((c) => c.phan_doan != null)) return false;
  const ma = maTheoCanh(canh);
  const luc = Date.parse(t.luc) || 0;
  return Object.keys(ma).every((ten) => { const r = t.canh?.[ten]; return !!r && r.ma === ma[ten] && r.dat && (Date.parse(r.luc) || 0) >= luc; });
}

export function chanNguoiXem(t: ThuNguoiXem | null | undefined, canh: ShotXem[]): string[] {
  if (!canh.length) return [];
  const tien = TIEN_TO_NGUOI_XEM;
  if (!t) return [`${tien}chưa kiểm — bấm ${TEN_NUT_NGUOI_XEM}`];
  if (t.ma !== maKichBan(canh)) {
    // Cả tập đã đổi từ lần kiểm: vẫn qua nếu MỌI cảnh đều được phủ (cảnh không đổi theo lần kiểm cả tập, cảnh đã sửa thì kiểm riêng cảnh đó).
    const ds = phuTheoCanh(t, canh);
    if (canh.some((c) => c.phan_doan != null) && ds.every((x) => x.phu)) return [];
    const thieu = ds.filter((x) => !x.phu);
    if (canh.some((c) => c.phan_doan != null) && t.ma_canh) return thieu.map((x) => `${tien}cảnh “${x.ten}”: ${x.ly_do} — bấm ${TEN_NUT_NGUOI_XEM_CANH}`);
    return [`${tien}kịch bản đã sửa sau lần kiểm — bấm ${TEN_NUT_NGUOI_XEM} lần nữa`];
  }
  if (t.dat) return [];
  if (canhVuotCaTap(t, canh)) return [];
  return [`${tien}chưa hiểu (${t.diem}/10${t.khop ? '' : ', lệch ý tác giả'}): ${[t.lech, ...t.cho_kho.slice(0, 3).map((x) => `#${x.shot} ${x.van_de}`)].filter(Boolean).join('; ')}`];
}

// ── Áp bản sửa của Claude (claude.ts › suaKichBanTheoNguoiXem) vào các shot — thuần, máy chủ chỉ việc ghi (kiem-nguoi-xem.ts) ──
type DongVao = { nhan_vat: string; dien_xuat: string; loi: string };
export type SuaShot = { shot: number; hanh_dong: string; hanh_dong_vi?: string; chu_man: string; thoai: DongVao[]; prompt_anh: string; doi_hinh: boolean; phat_s: number; nhan_vat?: string[] };
export type ShotMoi = { sau_shot: number; canh: string; hanh_dong: string; hanh_dong_vi?: string; chu_man: string; thoai: DongVao[]; prompt_anh: string; nhan_vat: string[]; phat_s: number };
export const LOI_CAN_KEYFRAME = 'Sửa theo người xem: hình đổi — sinh lại keyframe';
/** Dòng thoại mới: câu nào giữ nguyên chữ + người nói thì giữ file giọng đã có (url, độ dài, giọng) — chỉ câu đổi mới phải đọc lại. */
export function giuGiong(cu: DongThoai[], moi: DongVao[]): DongThoai[] {
  return moi.filter((d) => d.loi.trim()).map((d) => {
    const c = cu.find((x) => x.loi.trim() === d.loi.trim() && x.nhan_vat.trim() === d.nhan_vat.trim());
    return c ? { ...c, dien_xuat: d.dien_xuat || c.dien_xuat } : { nhan_vat: d.nhan_vat.trim(), dien_xuat: d.dien_xuat, loi: d.loi.trim(), url: null };
  });
}
export type KeHoachSua = {
  capNhat: { id: number; thu_tu: number; nhan_vat: number[]; hanh_dong: string; hanh_dong_vi: string; chu_man: string; thoai: DongThoai[]; loi_thoai: string; thoai_url: string | null; prompt_anh: string; phat_s: number; loi: string }[];
  chen: { sau_id: number; canh: string; hanh_dong: string; hanh_dong_vi: string; chu_man: string; thoai: DongThoai[]; loi_thoai: string; prompt_anh: string; nhan_vat: number[]; phat_s: number }[];
  /** thứ tự cuối: id shot cũ hoặc 'm<i>' (shot chèn thứ i) */
  thuTu: (number | string)[];
};
export function keHoachSua(canh: Pick<Canh, 'id' | 'thu_tu' | 'thoai' | 'nhan_vat'>[], nv: Pick<NhanVat, 'id' | 'ten'>[], sua: SuaShot[], them: ShotMoi[]): KeHoachSua {
  const ds = [...canh].sort((a, b) => a.thu_tu - b.thu_tu);
  const capNhat: KeHoachSua['capNhat'] = [];
  for (const x of sua) {
    const c = ds.find((y) => y.thu_tu === x.shot); if (!c) continue;
    const thoai = giuGiong(c.thoai ?? [], x.thoai);
    // Đối tượng có trong shot = cũ ∪ tên Claude ghi (bản sửa thêm Pip vào prompt mà không gắn mẫu → cổng chặn keyframe, 13/10/2026).
    const nvMoi = [...new Set([...(c.nhan_vat ?? []), ...(x.nhan_vat ?? []).map((t) => nv.find((v) => v.ten.trim().toLowerCase() === t.trim().toLowerCase())?.id).filter((y): y is number => y != null)])];
    capNhat.push({ id: c.id, thu_tu: c.thu_tu, nhan_vat: nvMoi, hanh_dong: x.hanh_dong.trim(), hanh_dong_vi: (x.hanh_dong_vi ?? '').trim(), chu_man: boChamCuoi(x.chu_man.trim()), thoai, loi_thoai: ghepThoai(thoai), thoai_url: thoai[0]?.url ?? null, prompt_anh: x.prompt_anh.trim(), phat_s: Math.max(2, Math.round(x.phat_s * 10) / 10), loi: x.doi_hinh ? LOI_CAN_KEYFRAME : '' });
  }
  const chen: KeHoachSua['chen'] = [];
  const thuTu: KeHoachSua['thuTu'] = [];
  const idTen = (t: string) => nv.find((v) => v.ten.trim().toLowerCase() === t.trim().toLowerCase())?.id;
  for (const c of ds) {
    thuTu.push(c.id);
    for (const m of them.filter((y) => y.sau_shot === c.thu_tu)) {
      const thoai = giuGiong([], m.thoai);
      thuTu.push(`m${chen.length}`);
      chen.push({ sau_id: c.id, canh: m.canh.trim() || 'Shot thêm', hanh_dong: m.hanh_dong.trim(), hanh_dong_vi: (m.hanh_dong_vi ?? '').trim(), chu_man: boChamCuoi(m.chu_man.trim()), thoai, loi_thoai: ghepThoai(thoai), prompt_anh: m.prompt_anh.trim(), nhan_vat: m.nhan_vat.map(idTen).filter((x): x is number => x != null), phat_s: Math.max(2, Math.round(m.phat_s * 10) / 10) });
    }
  }
  return { capNhat, chen, thuTu };
}

// THỬ NGƯỜI XEM LẦN ĐẦU (13/10/2026 — anh: "đây là chuẩn bị quan trọng cho mọi video, cần chuẩn hoá"). Fox Tales tập 2 chấm kịch bản 100/100
// (đủ 5 nhịp, hook, lật ngược đúng chỗ) mà xem xong vẫn khó hiểu: cú lật dựa vào truyện Aesop phim không kể, mục tiêu Felix không ai nói,
// đoạn quạ hát thì câm. Máy chấm cấu trúc không thấy được — phải có một người xem CHỈ biết thứ trên màn kể lại câu chuyện.
//   banNguoiXem(canh) = bảng shot chỉ gồm thứ người xem thấy (hành động) / đọc (chữ màn) / nghe (lời, ai nói) — không brief, không ghi chú.
//   maBan(ban)        = mã phiên bản: kịch bản đổi chữ/lời/hành động → kết quả thử cũ hết hiệu lực.
//   chanNguoiXem(...) = cổng trước sinh keyframe + xuất (quy-trinh.ts › chanTienKy, actions.ts › xuatTap).
// Lượt Claude ở claude.ts › thuNguoiXem. Thuần — tự kiểm: nguoi-xem.test.mts
import { boChamCuoi } from './ngat-dong';
import { doanChuMan, ghepThoai, giayPhat, type Canh, type DongThoai, type NhanVat, type ThuNguoiXem } from './kieu';

export type ShotXem = Pick<Canh, 'thu_tu' | 'phat_s' | 'thoi_luong_s' | 'hanh_dong' | 'chu_man' | 'thoai' | 'loi_thoai'>;
/** Điểm hiểu tối thiểu (0–10) để qua cổng — cùng với "khớp ý tác giả". */
export const DIEM_HIEU_DAT = 7;

export function banNguoiXem(canh: ShotXem[]): string {
  let t = 0;
  return canh.map((c) => {
    const g = giayPhat(c); const tu = t; t += g;
    const chu = doanChuMan(c.chu_man ?? '', g).map((d) => d.dong.join(' ')).join(' / ').trim();
    const nghe = (c.thoai?.length ? c.thoai.filter((d) => d.loi.trim()).map((d) => `${d.nhan_vat.trim() || 'Người dẫn (giọng ngoài khung)'}: "${d.loi.trim()}"`) : c.loi_thoai.trim() ? [c.loi_thoai.trim()] : []).join(' · ');
    return `#${c.thu_tu} [${tu.toFixed(1)}–${t.toFixed(1)}s] THẤY: ${c.hanh_dong.trim() || '(không tả)'} | CHỮ TRÊN MÀN: ${chu || '—'} | NGHE: ${nghe || '(không lời)'}`;
  }).join('\n');
}

/** Mã ngắn ổn định của bản người xem (djb2) — đủ để biết kịch bản đã đổi sau lần thử. */
export function maBan(ban: string): string {
  let h = 5381; for (let i = 0; i < ban.length; i++) h = ((h << 5) + h + ban.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Tiền tố mọi câu chặn của bước này — quy-trinh.ts lọc theo nó. */
export const TIEN_TO_NGUOI_XEM = 'người xem: ';
export const TEN_NUT_NGUOI_XEM = '🧑 Kiểm người xem có hiểu không';

export function chanNguoiXem(t: ThuNguoiXem | null | undefined, canh: ShotXem[]): string[] {
  if (!canh.length) return [];
  const tien = TIEN_TO_NGUOI_XEM;
  if (!t) return [`${tien}chưa kiểm — bấm ${TEN_NUT_NGUOI_XEM}`];
  if (t.ma !== maBan(banNguoiXem(canh))) return [`${tien}kịch bản đã sửa sau lần kiểm — bấm ${TEN_NUT_NGUOI_XEM} lần nữa`];
  if (t.dat) return [];
  return [`${tien}chưa hiểu (${t.diem}/10${t.khop ? '' : ', lệch ý tác giả'}): ${[t.lech, ...t.cho_kho.slice(0, 3).map((x) => `#${x.shot} ${x.van_de}`)].filter(Boolean).join('; ')}`];
}

// ── Áp bản sửa của Claude (claude.ts › suaKichBanTheoNguoiXem) vào các shot — thuần, máy chủ chỉ việc ghi (kiem-nguoi-xem.ts) ──
type DongVao = { nhan_vat: string; dien_xuat: string; loi: string };
export type SuaShot = { shot: number; hanh_dong: string; chu_man: string; thoai: DongVao[]; prompt_anh: string; doi_hinh: boolean; phat_s: number };
export type ShotMoi = { sau_shot: number; canh: string; hanh_dong: string; chu_man: string; thoai: DongVao[]; prompt_anh: string; nhan_vat: string[]; phat_s: number };
export const LOI_CAN_KEYFRAME = 'Sửa theo người xem: hình đổi — sinh lại keyframe';
/** Dòng thoại mới: câu nào giữ nguyên chữ + người nói thì giữ file giọng đã có (url, độ dài, giọng) — chỉ câu đổi mới phải đọc lại. */
export function giuGiong(cu: DongThoai[], moi: DongVao[]): DongThoai[] {
  return moi.filter((d) => d.loi.trim()).map((d) => {
    const c = cu.find((x) => x.loi.trim() === d.loi.trim() && x.nhan_vat.trim() === d.nhan_vat.trim());
    return c ? { ...c, dien_xuat: d.dien_xuat || c.dien_xuat } : { nhan_vat: d.nhan_vat.trim(), dien_xuat: d.dien_xuat, loi: d.loi.trim(), url: null };
  });
}
export type KeHoachSua = {
  capNhat: { id: number; thu_tu: number; hanh_dong: string; chu_man: string; thoai: DongThoai[]; loi_thoai: string; thoai_url: string | null; prompt_anh: string; phat_s: number; loi: string }[];
  chen: { sau_id: number; canh: string; hanh_dong: string; chu_man: string; thoai: DongThoai[]; loi_thoai: string; prompt_anh: string; nhan_vat: number[]; phat_s: number }[];
  /** thứ tự cuối: id shot cũ hoặc 'm<i>' (shot chèn thứ i) */
  thuTu: (number | string)[];
};
export function keHoachSua(canh: Pick<Canh, 'id' | 'thu_tu' | 'thoai'>[], nv: Pick<NhanVat, 'id' | 'ten'>[], sua: SuaShot[], them: ShotMoi[]): KeHoachSua {
  const ds = [...canh].sort((a, b) => a.thu_tu - b.thu_tu);
  const capNhat: KeHoachSua['capNhat'] = [];
  for (const x of sua) {
    const c = ds.find((y) => y.thu_tu === x.shot); if (!c) continue;
    const thoai = giuGiong(c.thoai ?? [], x.thoai);
    capNhat.push({ id: c.id, thu_tu: c.thu_tu, hanh_dong: x.hanh_dong.trim(), chu_man: boChamCuoi(x.chu_man.trim()), thoai, loi_thoai: ghepThoai(thoai), thoai_url: thoai[0]?.url ?? null, prompt_anh: x.prompt_anh.trim(), phat_s: Math.max(2, Math.round(x.phat_s * 10) / 10), loi: x.doi_hinh ? LOI_CAN_KEYFRAME : '' });
  }
  const chen: KeHoachSua['chen'] = [];
  const thuTu: KeHoachSua['thuTu'] = [];
  const idTen = (t: string) => nv.find((v) => v.ten.trim().toLowerCase() === t.trim().toLowerCase())?.id;
  for (const c of ds) {
    thuTu.push(c.id);
    for (const m of them.filter((y) => y.sau_shot === c.thu_tu)) {
      const thoai = giuGiong([], m.thoai);
      thuTu.push(`m${chen.length}`);
      chen.push({ sau_id: c.id, canh: m.canh.trim() || 'Shot thêm', hanh_dong: m.hanh_dong.trim(), chu_man: boChamCuoi(m.chu_man.trim()), thoai, loi_thoai: ghepThoai(thoai), prompt_anh: m.prompt_anh.trim(), nhan_vat: m.nhan_vat.map(idTen).filter((x): x is number => x != null), phat_s: Math.max(2, Math.round(m.phat_s * 10) / 10) });
    }
  }
  return { capNhat, chen, thuTu };
}

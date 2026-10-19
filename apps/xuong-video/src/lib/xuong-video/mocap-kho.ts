// SỔ MÃ MOCAP (anh 19/10/2026 "làm cả đi", nhịp 4 — kho mocap): MỘT chỗ khai chữ đọc (vi), chữ prompt (en) và dáng đầu → cuối của mọi mã
// 'mc_<ten>'. Thông số kỹ thuật (đoạn CMU, giây bắt đầu / dừng, vùng thân) nằm ở scripts/bo-set/mesh/mocap.py › MOCAP — mocap-kho.test.mts
// đối chiếu hai bên (cùng bộ mã, cùng dáng đầu / cuối, đủ tệp .bvh). Trước đây cùng một danh sách chép tay ở 5 nơi (dung-set.py › DONG_TAC,
// prompt-khoi.ts › DANG_EN, trang-thai-doi-tuong.ts › TEN_MC, bo-set-3d.ts › DANG_DIEN, dung-set.py › DI_MC): thêm mã bên này thì bên kia
// bỏ qua im lặng ('dong tac la').
import type { Dang } from './bo-set-3d';

export type MaMocap = { vi: string; en: string; /** dáng đầu → cuối khi KHÁC đứng → đứng (cổng liền mạch dáng đọc) */ dang?: [Dang, Dang] };
export const MOCAP_KHO: Record<string, MaMocap> = {
  mc_cai_nhau: { vi: 'cãi nhau, vung tay', en: 'arguing with angry hand gestures' },
  mc_giai_thich: { vi: 'nói, giải thích bằng tay', en: 'talking, explaining with hand gestures' },
  mc_chong_ghe: { vi: 'chống tay lên ghế', en: 'leaning with both hands on a high stool, staring down' },
  mc_quy_xuong: { vi: 'quỳ xuống', en: 'kneeling down', dang: ['dung', 'quy'] },
  mc_dang_quy: { vi: 'đang quỳ một gối', en: 'kneeling on one knee', dang: ['quy', 'quy'] },
  mc_dung_len_quy: { vi: 'đứng lên từ tư thế quỳ', en: 'rising from kneeling to standing', dang: ['quy', 'dung'] },
  mc_uong: { vi: 'uống', en: 'drinking' },
  mc_chi_tay: { vi: 'chỉ tay', en: 'pointing' },
  mc_dung_day: { vi: 'đứng dậy khỏi ghế cao', en: 'rising from a chair', dang: ['ngoi', 'dung'] },
  mc_di_bo: { vi: 'đi bộ', en: 'walking' },
  mc_sai_buoc: { vi: 'sải bước', en: 'striding forward' },
  // kho mở rộng 19/10/2026 (CMU 79 / 80 / 141 / 142 / 143 / 17 / 18 / 19 / 23 — giây đo bằng scripts/bo-set/do-mocap.py)
  mc_khoc: { vi: 'khóc, tay co lên ngực', en: 'crying, hands drawn up to the chest' },
  mc_buon: { vi: 'buồn, tay đưa lên mặt', en: 'sad, a hand raised to the face' },
  mc_so_hai: { vi: 'sợ hãi, co người', en: 'scared, shrinking back, hands pulled to the chest' },
  mc_buc_doi: { vi: 'bực tức, vung hai tay', en: 'upset, throwing both hands up in frustration' },
  mc_bam_dien_thoai: { vi: 'bấm điện thoại', en: 'holding a phone in front of the chest, dialing' },
  mc_go_phim: { vi: 'gõ máy tính', en: 'typing on a laptop' },
  mc_nhap_ca_phe: { vi: 'nhấp cà phê', en: 'sipping coffee from a cup' },
  mc_bat_tay: { vi: 'bắt tay', en: 'reaching out to shake hands' },
  mc_nhun_vai: { vi: 'nhún vai', en: 'shrugging' },
  mc_cho_doi: { vi: 'đứng chờ, đổi chân', en: 'waiting, shifting weight' },
  mc_vay_chao: { vi: 'vẫy chào', en: 'waving hello' },
  mc_u_ru: { vi: 'ủ rũ, vai sụp', en: 'moping, head down, shoulders slumped' },
  mc_dat_tay_vai: { vi: 'đặt tay lên vai người kia', en: 'resting one hand on the other person\'s shoulder' },
  mc_keo_tay: { vi: 'kéo tay người kia đi (quay lưng về người bị kéo, chồm theo hướng đi)', en: 'pulling the other person along by the elbow, leaning away' },
  mc_bi_keo: { vi: 'bị kéo tay, ghì lại', en: 'being pulled by the elbow, resisting' },
  mc_dap_ban_chi: { vi: 'đập bàn, chỉ mặt', en: 'pounding the table, then pointing at the other person' },
  mc_ngoi_xuong: { vi: 'ngồi xuống ghế', en: 'sitting down on a chair', dang: ['dung', 'ngoi'] },
  mc_dung_day_ghe: { vi: 'đứng dậy khỏi ghế', en: 'getting up from a chair', dang: ['ngoi', 'dung'] },
  mc_nhat_do: { vi: 'cúi nhặt đồ', en: 'bending down to pick something up' },
  mc_di_buon: { vi: 'đi buồn bã', en: 'walking sadly' },
  mc_di_rau_ru: { vi: 'đi rầu rĩ', en: 'walking, dejected and slow' },
  mc_di_voi: { vi: 'đi vội', en: 'hurrying' },
  mc_di_tu_tin: { vi: 'đi tự tin', en: 'walking with confident swagger' },
  mc_di_di_lai: { vi: 'đi đi lại lại', en: 'pacing back and forth' },
  mc_di_gian: { vi: 'đi giận dữ', en: 'storming along angrily' },
  mc_om_dau_buc: { vi: 'ôm đầu bực bội', en: 'both hands on the head in frustration' },
};
const map = <T,>(f: (v: MaMocap) => T | undefined) => Object.fromEntries(Object.entries(MOCAP_KHO).flatMap(([k, v]) => { const x = f(v); return x === undefined ? [] : [[k, x]]; })) as Record<string, T>;
export const MOCAP_VI = map((v) => v.vi);
export const MOCAP_EN = map((v) => v.en);
export const MOCAP_DANG = map((v) => v.dang);

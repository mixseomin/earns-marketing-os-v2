// BỘ SỔ của khung trang widget — khung (components/home/trang.tsx + bang.tsx) và phần lưu bố cục (lib/home/bo-cuc.ts, actions/home-bo-cuc.ts)
// đọc sổ qua đây nên MỘT khung chạy được nhiều trang: /home (sổ lib/home/so.ts). Outreach (outreach.on.tc) đã tách repo riêng 20/11/2026 và ghim khung này
// (repo outreach scripts/keo-goi.mjs) kèm bộ sổ của chính nó.
// File THƯỜNG (không 'use client'): máy chủ và trình duyệt cùng import. Thêm một trang widget mới = một mục BO_SO + sổ riêng của trang đó.
// Bố cục của mọi bộ lưu chung bảng home_bo_cuc (khoá user_id + mã màn) → mã màn phải KHÁC nhau giữa các bộ (app outreach dùng tiền tố ob-, bài kiểm ở repo đó).
import type { O } from '../home/luoi';
import { MAN, MAN_MAC_DINH, NHOM, WIDGET } from '../home/so';

/** ngu: tham số ngữ cảnh widget đọc — p / days / ky của /home, tuDe, ghi, rong: như sổ /home */
export type BoSoWidget = { ten: string; moTa: string; mac: readonly [number, number]; ngu?: readonly string[]; tuDe?: true; ghi?: true; rong?: true; moi?: string };
export type BoSoMan = { id: string; ten: string; kh: string; nhom: string; o: O[] };
export type BoSoId = 'home';
export type BoSo = {
  id: BoSoId;
  /** đường của trang */
  goc: string;
  /** tên trên thẻ trình duyệt */
  ten: string;
  widget: Record<string, BoSoWidget>;
  nhom: Record<string, string>;
  man: BoSoMan[];
  manMacDinh: string;
  /** trang khác của MOS2 mở tại chỗ trong ngăn trang nhúng */
  trangKhac: { kh: string; ten: string; href: string }[];
};

export const BO_SO: Record<BoSoId, BoSo> = {
  home: {
    id: 'home', goc: '/home', ten: 'Home', widget: WIDGET, nhom: NHOM, man: MAN, manMacDinh: MAN_MAC_DINH,
    trangKhac: [
      { kh: 'TC', ten: 'Trang chủ cũ', href: '/' },
      { kh: 'PL', ten: 'Plays', href: '/plays' },
      { kh: 'SH', ten: 'Shop', href: '/shop' },
      { kh: 'TD', ten: 'Tiến độ', href: '/plays?view=tiendo' },
    ],
  },
};

export const widgetCuaBo = (b: BoSo, ma: string): BoSoWidget | undefined => b.widget[ma];
export const coWidgetBo = (b: BoSo) => (ma: string) => Object.prototype.hasOwnProperty.call(b.widget, ma);
export const macCuaBo = (b: BoSo, ma: string): [number, number] => { const m = b.widget[ma]?.mac; return m ? [m[0], m[1]] : [16, 24]; };
export const manCuaBo = (b: BoSo, id: string | undefined): BoSoMan => b.man.find((m) => m.id === id) ?? b.man.find((m) => m.id === b.manMacDinh)!;
export const nhomCuaMa = (ma: string) => ma.replace(/\d+$/, '');
/** bộ sổ đang giữ màn này (phần lưu bố cục chỉ nhận mã màn → tự tìm bộ) */
export const boCuaMan = (man: string): BoSo | null => Object.values(BO_SO).find((b) => b.man.some((m) => m.id === man)) ?? null;

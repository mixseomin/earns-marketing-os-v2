// BỘ DỰNG theo mẫu máy (may-dung-mau.ts khai tên) — THUẦN (client + máy chủ cùng đọc): mỗi mẫu = vẽ ASS + lệnh ffmpeg + 3 shot kịch bản.
// Thêm kiểu video máy mới = viết một tệp may-dung-<kiểu>.ts rồi thêm một dòng ở đây; may-dung.ts (dựng), may.ts (máy → video), may-ui.tsx (màn) không đổi.
// LUẬT ĐỌC (anh 17/10/2026): nhịp + thời lượng của mẫu TÍNH THEO ĐỀ bằng may-dung-ass.ts › giayDoc (mỗi khối chữ đứng đủ thời gian đọc + 1,5s đệm
// rồi mới chuyển); test của mẫu phải kiểm điều đó (xem may-dung-scam.test.mts / may-dung-land.test.mts). Không đặt mốc giây cứng cho khối có chữ.
import { assMotDung, kichBanMotDung, lenhMotDung, DAI as DAI_DO_CHU, type DeMotDung } from './may-dung-do-chu';
import { anhScam, assScam, kichBanScam, lenhScam, nhipScam, tuNguonScam, type DeScam } from './may-dung-scam';
import { anhLand, assLand, kichBanLand, lenhLand, nhipLand, tuNguonLand, type DeLand } from './may-dung-land';
import { anhThi, assThi, kichBanThi, lenhThi, nhipThi, truyVanThi, tuNguonThi, type DeThi } from './may-dung-thi';
import type { MauMayDung } from './may-dung-mau';

export type DeMay = DeMotDung | DeScam | DeLand | DeThi;
export type ShotMau = { tu: number; den: number; canh: string; hanh_dong: string };
type LenhVao = { de: DeMay; ass: string; nen: string | null; fontsDir: string; ra: string; khung?: number };
/** tuNguon: một dòng tệp nguồn đề của mẫu → dòng nạp máy { slug, chu_de, de, dang } (may-dung.mts --nap-nguon). */
type BoDung = { ass: (de: DeMay) => string; lenh: (o: LenhVao) => string[]; shots: (de: DeMay) => ShotMau[]; /** thời lượng theo đề (luật đọc: nhịp tính theo chữ) */ dai: (de: DeMay) => number; /** ảnh tĩnh cắt từ video cho bài ảnh (nền x_anh): giây + khung cắt [x, y, w, h] */ anh?: (de: DeMay) => { t: number; cat: [number, number, number, number] }[]; tuNguon?: (x: never) => { slug: string; chu_de: string; de: DeMay; dang: Record<string, string> }; /** truy vấn ảnh nền Pexels khi video chưa có nen_url (anh-nen.ts) — mặc định chu_de */ truyVanAnh?: (de: DeMay, chuDe: string) => string };

export const BO_DUNG: Record<MauMayDung, BoDung> = {
  'do-chu-mot-dung': { ass: (de) => assMotDung(de as DeMotDung), lenh: (o) => lenhMotDung({ ...o, de: o.de as DeMotDung }), shots: (de) => kichBanMotDung(de as DeMotDung).shots, dai: () => DAI_DO_CHU, truyVanAnh: (_de, chuDe) => `${chuDe} cozy` },
  'scam-or-real': { ass: (de) => assScam(de as DeScam), lenh: (o) => lenhScam({ ...o, de: o.de as DeScam }), shots: (de) => kichBanScam(de as DeScam).shots, dai: (de) => nhipScam(de as DeScam).DAI, anh: (de) => anhScam(de as DeScam), tuNguon: tuNguonScam as never },
  'before-you-land': { ass: (de) => assLand(de as DeLand), lenh: (o) => lenhLand({ ...o, de: o.de as DeLand }), shots: (de) => kichBanLand(de as DeLand).shots, dai: (de) => nhipLand(de as DeLand).DAI, anh: (de) => anhLand(de as DeLand), tuNguon: tuNguonLand as never },
  'cau-hoi-thi': { ass: (de) => assThi(de as DeThi), lenh: (o) => lenhThi({ ...o, de: o.de as DeThi }), shots: (de) => kichBanThi(de as DeThi).shots, dai: (de) => nhipThi(de as DeThi).DAI, anh: (de) => anhThi(de as DeThi), truyVanAnh: (de) => truyVanThi(de as DeThi), tuNguon: tuNguonThi as never },
};
/** 3 shot kịch bản của một video theo mẫu của máy (tab Mẫu, ngăn video). */
/** Truy vấn ảnh nền thật cho video chưa có nen_url (xuatVideo → anh-nen.ts). */
export const truyVanAnhMau = (mau: MauMayDung, de: DeMay, chuDe: string): string => (BO_DUNG[mau]?.truyVanAnh ?? ((_d: DeMay, c: string) => c))(de, chuDe);
export const shotsMau = (mau: MauMayDung, de: DeMay): ShotMau[] => (BO_DUNG[mau] ?? BO_DUNG['do-chu-mot-dung']).shots(de);

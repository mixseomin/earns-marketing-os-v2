// BỘ DỰNG theo mẫu máy (may-dung-mau.ts khai tên) — THUẦN (client + máy chủ cùng đọc): mỗi mẫu = vẽ ASS + lệnh ffmpeg + 3 shot kịch bản.
// Thêm kiểu video máy mới = viết một tệp may-dung-<kiểu>.ts rồi thêm một dòng ở đây; may-dung.ts (dựng), may.ts (máy → video), may-ui.tsx (màn) không đổi.
import { assMotDung, kichBanMotDung, lenhMotDung, DAI as DAI_DO_CHU, type DeMotDung } from './may-dung-do-chu';
import { assScam, kichBanScam, lenhScam, tuNguonScam, DAI as DAI_SCAM, type DeScam } from './may-dung-scam';
import { assLand, kichBanLand, lenhLand, tuNguonLand, DAI as DAI_LAND, type DeLand } from './may-dung-land';
import type { MauMayDung } from './may-dung-mau';

export type DeMay = DeMotDung | DeScam | DeLand;
export type ShotMau = { tu: number; den: number; canh: string; hanh_dong: string };
type LenhVao = { de: DeMay; ass: string; nen: string | null; fontsDir: string; ra: string; khung?: number };
/** tuNguon: một dòng tệp nguồn đề của mẫu → dòng nạp máy { slug, chu_de, de, dang } (may-dung.mts --nap-nguon). */
type BoDung = { ass: (de: DeMay) => string; lenh: (o: LenhVao) => string[]; shots: (de: DeMay) => ShotMau[]; dai: number; tuNguon?: (x: never) => { slug: string; chu_de: string; de: DeMay; dang: Record<string, string> } };

export const BO_DUNG: Record<MauMayDung, BoDung> = {
  'do-chu-mot-dung': { ass: (de) => assMotDung(de as DeMotDung), lenh: (o) => lenhMotDung({ ...o, de: o.de as DeMotDung }), shots: (de) => kichBanMotDung(de as DeMotDung).shots, dai: DAI_DO_CHU },
  'scam-or-real': { ass: (de) => assScam(de as DeScam), lenh: (o) => lenhScam({ ...o, de: o.de as DeScam }), shots: (de) => kichBanScam(de as DeScam).shots, dai: DAI_SCAM, tuNguon: tuNguonScam as never },
  'before-you-land': { ass: (de) => assLand(de as DeLand), lenh: (o) => lenhLand({ ...o, de: o.de as DeLand }), shots: (de) => kichBanLand(de as DeLand).shots, dai: DAI_LAND, tuNguon: tuNguonLand as never },
};
/** 3 shot kịch bản của một video theo mẫu của máy (tab Mẫu, ngăn video). */
export const shotsMau = (mau: MauMayDung, de: DeMay): ShotMau[] => (BO_DUNG[mau] ?? BO_DUNG['do-chu-mot-dung']).shots(de);

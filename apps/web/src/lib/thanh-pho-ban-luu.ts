// MÔ HÌNH THÀNH PHỐ + BẢN LƯU ĐĨA (anh 22/10/2026 "mở city.on.tc là vào thẳng bản 3D, không load cái gì kia"): tính số thật mất tới ~8 giây khi
// bộ nhớ đệm hết, nên mỗi lần tính xong ghi mô hình ra đĩa (/var/lib/mos2, sống qua deploy). city.on.tc dựng 3D ngay từ bản lưu, số mới nạp ở nền.
// Mọi chỗ cần mô hình (trang /city, /api/social/thanh-pho, /api/ext/thanh-pho) đi qua moHinhMoi() để bản lưu luôn là lần tính gần nhất.
import 'server-only';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getSocialLive } from './social-traffic';
import { tinhThanhPho, type PhoMoHinh } from './social-thanh-pho';

const TEP = process.env.MOS2_DATA_DIR ? `${process.env.MOS2_DATA_DIR}/thanh-pho.json` : '/var/lib/mos2/thanh-pho.json';
export type BanThanhPho = { luc: string; mh: PhoMoHinh };

export async function moHinhMoi(): Promise<BanThanhPho> {
  const live = await getSocialLive(), ban = { luc: live.luc, mh: tinhThanhPho(live) };
  try { mkdirSync(dirname(TEP), { recursive: true }); writeFileSync(TEP, JSON.stringify(ban)); } catch (e) { console.error('thanh-pho: không ghi được bản lưu', (e as Error).message); }
  return ban;
}
/** bản lưu gần nhất; chưa có (máy mới) / hỏng → null, bên gọi tự tính */
export function banLuu(): BanThanhPho | null {
  try { return JSON.parse(readFileSync(TEP, 'utf8')) as BanThanhPho; } catch { return null; }
}

// TRẢ NGAY, TÍNH Ở NỀN (anh 30/10/2026 "page đó đang load chậm vãi"): /api/social/thanh-pho trước đây gọi moHinhMoi() mỗi lần → đo 23,3 giây một lượt, tab Thành phố
// (mặc định của Social) và city.on.tc gọi lại mỗi phút nên các lượt tính còn chồng lên nhau. Giờ: có bản lưu thì trả luôn; cũ hơn TUOI_MOI thì khởi một lượt tính nền
// (một lượt một lúc — lượt sau gắn vào lượt đang chạy), lần gọi kế lấy số mới. Chưa có bản lưu (máy mới) mới phải chờ tính.
const TUOI_MOI = 60_000;
let dangTinh: Promise<BanThanhPho> | null = null;
const tinhMotLuot = () => (dangTinh ??= moHinhMoi().finally(() => { dangTinh = null; }));
export async function moHinhNhanh(): Promise<BanThanhPho> {
  const luu = banLuu();
  if (!luu) return tinhMotLuot();
  if (Date.now() - Date.parse(luu.luc) > TUOI_MOI) void tinhMotLuot().catch((e: Error) => console.error('thanh-pho: tính nền hỏng', e.message));
  return luu;
}

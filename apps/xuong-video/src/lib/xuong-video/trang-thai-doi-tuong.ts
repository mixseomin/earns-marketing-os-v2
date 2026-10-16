// TRẠNG THÁI ĐỐI TƯỢNG THEO SHOT (anh 16/10/2026: "show trạng thái đạo cụ, nhân vật… trên timeline, ở dưới, và điểm số của chúng").
// Mỗi đối tượng (người · đạo cụ · sản phẩm · bối cảnh) × mỗi shot: có mặt không, đang ở trạng thái nào, lỗi gì, điểm 0–10 — rồi điểm cả tập.
// KHÔNG tự đặt luật mới: gom kết quả các máy đã có —
//   bangDoiTuong (phu-thuoc.ts): gắn chưa · thiếu ảnh · khác biến thể · nhắc tên mà chưa gắn
//   soLienMach (so-lien-mach.ts): dáng · trạng thái cơ thể / trang phục · đồ đang cầm · lỗi đứt mạch (cổng lienMachTap)
//   kiem_khung (khung.ts): lỗi máy kiểm khung có nhắc tên đối tượng, chỉ khi kết quả kiểm còn đúng keyframe đang dùng
//   soi_clip (soi-clip.ts): lỗi soi clip của shot gắn sản phẩm
// Thuần, client lẫn server dùng được. Tự kiểm: trang-thai-doi-tuong.test.mts.
import { bangDoiTuong } from './phu-thuoc';
import { soLienMach, chuDang, type DongSo } from './so-lien-mach';
import { loiSoiClip, type Canh, type NhanVat, type PhanCanh } from './kieu';

export type MucDoiTuong = 'tot' | 'vang' | 'do' | 'trong';
export type OTrangThai = { canhId: number; co: boolean; muc: MucDoiTuong; chu: string; loi: string[]; diem: number | null };
export type DongDoiTuong = { nv: NhanVat; o: OTrangThai[]; diem: number | null; soLoi: number };

const THU_TU: Record<string, number> = { nhan_vat: 0, dao_cu: 1, san_pham: 2, boi_canh: 3 };
/** Trừ điểm mỗi loại lỗi — một chỗ khai, lane và hover đọc cùng số. */
export const TRU_DIEM = { thieu_anh: 10, nhac_chua_gan: 6, khac_bien_the: 3, lien_mach: 3, kiem_khung: 3, soi_clip: 4 } as const;

const nhacTen = (chu: string, ten: string) => ten.trim().length >= 2 && chu.toLowerCase().includes(ten.trim().toLowerCase());

export function trangThaiDoiTuong(canh: Canh[], nhanVat: NhanVat[], phanCanh?: Pick<PhanCanh, 'ten' | 'ngay' | 'lien_truoc'>[]): DongDoiTuong[] {
  const bang = bangDoiTuong(canh, nhanVat);
  const so = soLienMach(canh, phanCanh, nhanVat);
  return bang
    .sort((a, b) => (THU_TU[a.nv.loai] ?? 9) - (THU_TU[b.nv.loai] ?? 9))
    .map(({ nv, o }) => {
      const dongSo = new Map<number, DongSo>((so.nhanVat[nv.ten] ?? []).map((d) => [d.canhId, d]));
      const oTt: OTrangThai[] = canh.map((c, i) => {
        const b = o[i]!;
        const loi: string[] = []; let diem = 10;
        if (!b.gan && !b.nhac) return { canhId: c.id, co: false, muc: 'trong', chu: '', loi, diem: null };
        if (!b.gan && b.nhac) { loi.push('mô tả shot nhắc tên mà chưa gắn mẫu — keyframe sẽ vẽ theo chữ'); diem -= TRU_DIEM.nhac_chua_gan; }
        if (b.thieu.length) { loi.push(`mẫu chưa đủ: ${b.thieu.join(', ')}`); diem -= TRU_DIEM.thieu_anh; }
        if (b.khac) { loi.push(`biến thể "${b.bt ?? 'gốc'}" khác đa số shot`); diem -= TRU_DIEM.khac_bien_the; }
        const d = dongSo.get(c.id);
        for (const x of d?.loi ?? []) { loi.push(`liền mạch: ${x}`); diem -= TRU_DIEM.lien_mach; }
        const kk = c.kiem_khung;
        if (kk && kk.url === c.keyframe_url && !kk.dat && !kk.duyet_tay) for (const x of kk.loi) if (nhacTen(`${x.mo_ta} ${x.sua}`, nv.ten)) { loi.push(`kiểm khung: ${x.mo_ta}`); diem -= TRU_DIEM.kiem_khung; }
        if (nv.loai === 'san_pham' && b.gan) for (const x of loiSoiClip(c)) { loi.push(`soi clip: ${x}`); diem -= TRU_DIEM.soi_clip; }
        // Chữ trạng thái: người / đạo cụ có sổ liền mạch → dáng · trạng thái · đồ cầm; không thì biến thể đang dùng.
        const chu = d ? [d.an ? 'khuất' : chuDang(d), d.trang_den || d.trang, d.cam ? `cầm ${d.cam}` : ''].filter(Boolean).join(' · ') : b.gan ? (b.bt ?? 'có mặt') : 'nhắc tên, chưa gắn';
        const dd = Math.max(0, diem);
        return { canhId: c.id, co: b.gan, muc: dd >= 9 ? 'tot' : dd >= 5 ? 'vang' : 'do', chu, loi, diem: dd };
      });
      const coDiem = oTt.filter((x) => x.diem != null);
      return { nv, o: oTt, diem: coDiem.length ? Math.round((coDiem.reduce((a, x) => a + x.diem!, 0) / coDiem.length) * 10) / 10 : null, soLoi: oTt.reduce((a, x) => a + x.loi.length, 0) };
    })
    .filter((r) => r.o.some((x) => x.diem != null));
}

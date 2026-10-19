// TRẠNG THÁI ĐỐI TƯỢNG THEO SHOT (anh 16/10/2026: "show trạng thái đạo cụ, nhân vật… trên timeline, ở dưới, và điểm số của chúng").
// Mỗi đối tượng (người · đạo cụ · sản phẩm · bối cảnh) × mỗi shot: có mặt không, đang ở trạng thái nào, lỗi gì, điểm 0–10 — rồi điểm cả tập.
// KHÔNG tự đặt luật mới: gom kết quả các máy đã có —
//   bangDoiTuong (phu-thuoc.ts): gắn chưa · thiếu ảnh · khác biến thể · nhắc tên mà chưa gắn
//   soLienMach (so-lien-mach.ts): dáng · trạng thái cơ thể / trang phục · đồ đang cầm · lỗi đứt mạch (cổng lienMachTap)
//   kiem_khung (khung.ts): lỗi máy kiểm khung có nhắc tên đối tượng, chỉ khi kết quả kiểm còn đúng keyframe đang dùng
//   soi_clip (soi-clip.ts): lỗi soi clip của shot gắn sản phẩm
// CÂY (anh 18/10/2026: "thiết kế dạng tree để show được chi tiết của từng nhóm · show những gì tính điểm ra để check bằng mắt"): mỗi ô tách thành
// NHÁNH — mẫu · trang phục · vị trí · dáng · trạng thái · đồ nhận dạng · kiểm khung · soi clip; điểm ô = 10 trừ các khoản của nhánh, nên cây và điểm
// đọc CÙNG một nguồn. Vị trí tả bằng chữ (cạnh vật nào của set, cách ai bao xa, quay về máy ra sao) — không in toạ độ.
// Thuần, client lẫn server dùng được. Tự kiểm: trang-thai-doi-tuong.test.mts.
import { bangDoiTuong } from './phu-thuoc';
import { soLienMach, chuDang, type DongSo } from './so-lien-mach';
import { boSetCuaShot, huongVoiMay } from './bo-set-3d';
import { DANG } from './cau-hoi-khung';
import { LA_NHAN_DANG } from './kiem-ai-3d';
import { bieuCam, camThuc, loiMachBieuCam } from './qc-cam-xuc';
import { loiSoiClip, vatHien, type BoSet, type Canh, type May3d, type NhanVat, type PhanCanh, type VatSet } from './kieu';

export type MucDoiTuong = 'tot' | 'vang' | 'do' | 'trong';
export type MaNhanh = 'mau' | 'ngoai' | 'vi_tri' | 'dang' | 'bieu' | 'trang' | 'nd' | 'kiem' | 'soi';
export const TEN_NHANH: Record<MaNhanh, string> = { mau: 'Mẫu · biến thể', ngoai: 'Trang phục · bề ngoài', vi_tri: 'Vị trí', dang: 'Dáng · động tác', bieu: 'Biểu cảm', trang: 'Trạng thái', nd: 'Đồ nhận dạng', kiem: 'Kiểm khung', soi: 'Soi clip' };
/** Một nhánh của ô: chữ nhìn được + các khoản trừ (lý do · số điểm). */
export type ONhanh = { ma: MaNhanh; chu: string; tru: { chu: string; diem: number }[] };
export type OTrangThai = { canhId: number; co: boolean; muc: MucDoiTuong; chu: string; loi: string[]; diem: number | null; nhanh: ONhanh[] };
export type DongDoiTuong = { nv: NhanVat; o: OTrangThai[]; diem: number | null; soLoi: number; nhanh: MaNhanh[] };

const THU_TU: Record<string, number> = { nhan_vat: 0, dao_cu: 1, san_pham: 2, boi_canh: 3 };
/** Trừ điểm mỗi loại lỗi — một chỗ khai, lane và hover đọc cùng số. */
export const TRU_DIEM = { thieu_anh: 10, nhac_chua_gan: 6, khac_bien_the: 3, lien_mach: 3, kiem_khung: 3, soi_clip: 4, lien_mach_bieu_cam: 3 } as const;
export const mucDiem = (d: number): MucDoiTuong => (d >= 9 ? 'tot' : d >= 5 ? 'vang' : 'do');

const nhacTen = (chu: string, ten: string) => ten.trim().length >= 2 && chu.toLowerCase().includes(ten.trim().toLowerCase());
/** Lỗi liền mạch (cổng lienMachTap / sổ) thuộc nhánh nào — theo chữ của cổng. */
export const nhanhLienMach = (x: string, laNguoi: boolean): MaNhanh =>
  /trang phục|bề ngoài|tóc|trang điểm|đồ trên người|đồ đeo|vết|thiếu khai/i.test(x) ? (laNguoi ? 'ngoai' : 'trang')
    : /chỗ|vị trí|hướng|quay|nhảy|dời|trục|đi ngược|màn/i.test(x) ? 'vi_tri' : laNguoi ? 'dang' : 'trang';

type ViTri = May3d['vi_tri'][number];
const TEN_MC: Record<string, string> = { mc_di_bo: 'đi bộ', mc_sai_buoc: 'sải bước', mc_quy_xuong: 'quỳ xuống', mc_dung_day: 'đứng dậy khỏi ghế', mc_dung_len_quy: 'đứng lên từ tư thế quỳ', mc_dang_quy: 'đang quỳ một gối', mc_cai_nhau: 'cãi nhau, vung tay', mc_giai_thich: 'nói, giải thích bằng tay', mc_chong_ghe: 'chống tay lên ghế', mc_uong: 'uống', mc_chi_tay: 'chỉ tay', giat: 'giật phắt món đồ' };
/** Mã động tác (vi_tri.dien) → chữ: 'hat@0.25-0.45' → "hất mạnh món đồ ra trước (25–45% shot)". */
export const chuDien = (d: string) => {
  const [ma, mt] = String(d).split('@'); const ten = DANG[ma!] ?? TEN_MC[ma!] ?? ma!;
  if (!mt) return ten; const [a, b] = mt.split('-').map(Number);
  return `${ten} (${Math.round(a! * 100)}${b != null && !Number.isNaN(b) ? `–${Math.round(b * 100)}` : ''}% shot)`;
};
const xy = (p: number[] | undefined) => (p && p.length >= 2 ? [p[0]!, p[1]!] as const : null);
const kc = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
const choVat = (v: VatSet) => xy('goc' in v ? v.goc : v.tam);
const met = (cm: number) => `${(Math.round(cm / 10) / 10).toLocaleString('vi-VN')} m`;
/** VỊ TRÍ BẰNG CHỮ: đồ set gần nhất (bỏ mặt nền), NGƯỜI gần nhất trong shot (nguoi = tên nhân vật, không tính đồ vật), hướng so với máy, đi đâu. Không in toạ độ. */
export function moTaViTri(v: ViTri, m: May3d, vat: VatSet[], laNguoi: boolean, nguoi: ReadonlySet<string>): string {
  if (v.an) return 'ngoài khung (khuất)';
  if (v.cam && !laNguoi) return `trong tay ${v.cam}${v.den ? ', đặt xuống trong shot' : ''}`;
  const cho = (p: readonly number[]) => {
    const g = vat.filter((x) => !x.nen && x.ten !== v.ten).map((x) => ({ ten: x.ten, d: choVat(x) })).filter((x): x is { ten: string; d: readonly [number, number] } => !!x.d)
      .map((x) => ({ ten: x.ten, d: kc(p, x.d) })).sort((a, b) => a.d - b.d)[0];
    return g && g.d <= 300 ? `${g.d <= 120 ? 'cạnh' : 'gần'} ${g.ten}` : '';
  };
  const p = xy(v.tam); if (!p) return '';
  const ng = m.vi_tri.filter((x) => x.ten !== v.ten && nguoi.has(x.ten) && !x.an && xy(x.tam)).map((x) => ({ ten: x.ten, d: kc(p, xy(x.tam)!) })).sort((a, b) => a.d - b.d)[0];
  const h = laNguoi ? huongVoiMay(m, v) : null;
  const den = xy(v.den ?? undefined); const di = den && kc(p, den) >= 40 ? `đi ${met(kc(p, den))} → ${cho(den) || 'chỗ mới'}` : '';
  return [cho(p), ng ? `cách ${ng.ten} ${met(ng.d)}` : '', h ? (h.lech <= 35 ? 'nhìn về máy' : h.lech <= 80 ? 'nghiêng ¾ về máy' : h.lech <= 120 ? 'quay ngang' : 'quay lưng về máy') : '', di].filter(Boolean).join(' · ');
}

export function trangThaiDoiTuong(canh: Canh[], nhanVat: NhanVat[], phanCanh?: Pick<PhanCanh, 'ten' | 'ngay' | 'lien_truoc'>[], sets: Pick<BoSet, 'id' | 'du_lieu'>[] = []): DongDoiTuong[] {
  const bang = bangDoiTuong(canh, nhanVat);
  const so = soLienMach(canh, phanCanh, nhanVat);
  const machBc = loiMachBieuCam(canh, nhanVat);
  const tenNguoi = new Set(nhanVat.filter((v) => v.loai === 'nhan_vat').map((v) => v.ten));
  const vatCua = (c: Canh) => { const sid = c.may_3d ? boSetCuaShot(c, nhanVat) : null; const s = sets.find((x) => x.id === sid); return s ? vatHien(s.du_lieu.vat, c.may_3d?.them) : []; };
  return bang
    .sort((a, b) => (THU_TU[a.nv.loai] ?? 9) - (THU_TU[b.nv.loai] ?? 9))
    .map(({ nv, o }) => {
      const dongSo = new Map<number, DongSo>((so.nhanVat[nv.ten] ?? []).map((d) => [d.canhId, d]));
      const laNguoi = nv.loai === 'nhan_vat';
      const oTt: OTrangThai[] = canh.map((c, i) => {
        const b = o[i]!;
        if (!b.gan && !b.nhac) return { canhId: c.id, co: false, muc: 'trong', chu: '', loi: [], diem: null, nhanh: [] };
        const nh = new Map<MaNhanh, ONhanh>(); const them = (ma: MaNhanh, chu = '') => { let x = nh.get(ma); if (!x) nh.set(ma, (x = { ma, chu, tru: [] })); else if (chu && !x.chu) x.chu = chu; return x; };
        // MẪU · BIẾN THỂ
        const mau = them('mau', b.gan ? `${b.bt ?? 'bản gốc'}${b.thieu.length ? ' · thiếu ảnh mẫu' : ''}` : 'nhắc tên, chưa gắn');
        if (!b.gan && b.nhac) mau.tru.push({ chu: 'mô tả shot nhắc tên mà chưa gắn mẫu — keyframe sẽ vẽ theo chữ', diem: TRU_DIEM.nhac_chua_gan });
        if (b.thieu.length) mau.tru.push({ chu: `mẫu chưa đủ: ${b.thieu.join(', ')}`, diem: TRU_DIEM.thieu_anh });
        if (b.khac) mau.tru.push({ chu: `biến thể "${b.bt ?? 'gốc'}" khác đa số shot`, diem: TRU_DIEM.khac_bien_the });
        // SỔ LIỀN MẠCH: trang phục · vị trí · dáng (người) / vị trí · trạng thái (đồ)
        const d = dongSo.get(c.id); const vt = c.may_3d?.vi_tri.find((x) => x.ten === nv.ten);
        if (d) {
          if (laNguoi) them('ngoai', d.ngoai.map((g) => `${g.ten}: ${g.mo || 'không'}${g.ket && g.ket !== g.mo ? ` → ${g.ket}` : ''}`).join(' · ') || 'chưa khai');
          if (vt && c.may_3d) them('vi_tri', moTaViTri(vt, c.may_3d, vatCua(c), laNguoi, tenNguoi));
          if (laNguoi) them('dang', [d.an ? 'khuất' : chuDang(d), ...d.dien.map(chuDien), d.cam ? `cầm ${d.cam}` : ''].filter(Boolean).join(' · '));
          else them('trang', [d.trang || 'nguyên', d.trang_den && d.trang_den !== d.trang ? `→ ${d.trang_den}` : '', d.chia ? `chia ${d.chia} mảnh` : '', vt?.nghieng ? `nghiêng ${vt.nghieng}°` : '', vt?.tran ? `${vt.tran} đổ ra` : ''].filter(Boolean).join(' '));
          for (const x of d.loi) them(nhanhLienMach(x, laNguoi)).tru.push({ chu: `liền mạch: ${x}`, diem: TRU_DIEM.lien_mach });
        }
        // BIỂU CẢM (#1419): kế hoạch nét mặt đầu → cuối shot (bieu_cam) + nét cấm + lỗi liền mạch biểu cảm với shot trước — cùng nguồn cổng keyframe đọc.
        // Chưa khai chỉ hiện chữ, không trừ: phim/QC nào bắt khai thì cổng keyframe (batCamXuc) đã chặn riêng.
        if (laNguoi && b.gan) {
          const bc = (c.bieu_cam ?? []).find((x) => x.nv === nv.ten && bieuCam(x.dau) && bieuCam(x.cuoi));
          const ten = (k: string) => bieuCam(k)?.ten ?? k;
          const bn = them('bieu', bc ? [bc.dau === bc.cuoi ? `giữ ${ten(bc.dau)}` : `${ten(bc.dau)} → ${ten(bc.cuoi)}`, bc.lat ? 'cú lật' : '', camThuc(bc).length ? `cấm ${camThuc(bc).map(ten).join(', ')}` : ''].filter(Boolean).join(' · ') : 'chưa khai');
          for (const x of machBc[c.id] ?? []) if (x.includes(`: ${nv.ten} cuối`)) bn.tru.push({ chu: x.replace(/^LIỀN MẠCH BIỂU CẢM: /, 'liền mạch: '), diem: TRU_DIEM.lien_mach_bieu_cam });
        }
        // ĐỒ NHẬN DẠNG (bối cảnh): tranh, biểu đồ, màn chiếu, bảng chỉ dẫn… thấy trong khung 3D
        if (nv.loai === 'boi_canh' && c.khung_xam?.thay) {
          const ds = c.khung_xam.thay.filter((t) => LA_NHAN_DANG.test(t.en ?? '')).map((t) => `${t.ten} ${Math.round(t.pt)}%`);
          if (ds.length) them('nd', ds.join(' · '));
        }
        // KIỂM KHUNG: chỉ khi kết quả kiểm còn đúng keyframe đang dùng
        const kk = c.kiem_khung;
        if (c.keyframe_url) {
          const hop = kk && kk.url === c.keyframe_url;
          const k = them('kiem', !hop ? 'chưa kiểm keyframe này' : kk!.duyet_tay ? 'duyệt tay' : kk!.dat ? 'đạt' : 'có lỗi');
          if (hop && !kk!.dat && !kk!.duyet_tay) for (const x of kk!.loi) {
            const nd = nv.loai === 'boi_canh' && /^\[(nd:|boi_canh)/.test(x.mo_ta);
            if (nd || nhacTen(`${x.mo_ta} ${x.sua}`, nv.ten)) (nd && nh.has('nd') ? nh.get('nd')! : k).tru.push({ chu: `kiểm khung: ${x.mo_ta}`, diem: TRU_DIEM.kiem_khung });
          }
          if (hop && !k.tru.length && !kk!.dat && !kk!.duyet_tay) k.chu = 'lỗi không nhắc tên này';
        }
        if (nv.loai === 'san_pham' && b.gan) { const l = loiSoiClip(c); if (l.length || c.soi_clip) them('soi', l.length ? `${l.length} lỗi` : 'đạt').tru.push(...l.map((x) => ({ chu: `soi clip: ${x}`, diem: TRU_DIEM.soi_clip }))); }
        const nhanh = [...nh.values()];
        const loi = nhanh.flatMap((x) => x.tru.map((t) => t.chu));
        const dd = Math.max(0, 10 - nhanh.reduce((a, x) => a + x.tru.reduce((s, t) => s + t.diem, 0), 0));
        // Chữ trạng thái: người / đạo cụ có sổ liền mạch → dáng · trạng thái · đồ cầm; không thì biến thể đang dùng.
        const chu = d ? [d.an ? 'khuất' : chuDang(d), d.trang_den || d.trang, d.cam ? `cầm ${d.cam}` : ''].filter(Boolean).join(' · ') : b.gan ? (b.bt ?? 'có mặt') : 'nhắc tên, chưa gắn';
        return { canhId: c.id, co: b.gan, muc: mucDiem(dd), chu, loi, diem: dd, nhanh };
      });
      const coDiem = oTt.filter((x) => x.diem != null);
      const thuTuNhanh: MaNhanh[] = ['mau', 'ngoai', 'vi_tri', 'dang', 'bieu', 'trang', 'nd', 'kiem', 'soi'];
      return { nv, o: oTt, diem: coDiem.length ? Math.round((coDiem.reduce((a, x) => a + x.diem!, 0) / coDiem.length) * 10) / 10 : null, soLoi: oTt.reduce((a, x) => a + x.loi.length, 0),
        nhanh: thuTuNhanh.filter((m) => oTt.some((x) => x.nhanh.some((n) => n.ma === m))) };
    })
    .filter((r) => r.o.some((x) => x.diem != null));
}

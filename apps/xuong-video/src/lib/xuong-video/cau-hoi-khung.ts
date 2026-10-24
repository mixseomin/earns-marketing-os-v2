// CÂU HỎI KIỂM KHUNG kiểu DSG (Davidsonian Scene Graph, Google 2023 — arxiv 2310.18235; TIFA 2303.11897): thay vì hỏi chung "ảnh có ổn không", sinh
// từ DỮ LIỆU shot một danh sách câu có / không, mỗi câu một sự thật nguyên tử (ai có mặt, mặc gì, quay mặt đâu, đồ nhận dạng đúng không…), câu phụ
// thuộc chỉ tính khi câu gốc đúng ("mặc vest trắng" chỉ hỏi khi "có Hạ"). Người chấm (Claude trong phiên — kiem-khung.mts --in, hoặc lượt API) trả lời
// từng câu; câu "không" = một lỗi đúng loại (khung.ts › LOAI_LOI_KHUNG). Anh 17/10/2026: "xem shot nào phải sinh lại keyframe" — câu hỏi lấy từ dữ
// liệu hiện tại (sổ người, 3D, ảnh chuẩn), nên keyframe cũ sinh từ prompt / 3D cũ lộ ra ngay câu nào sai. Thuần — tự kiểm: cau-hoi-khung.test.mts
import type { Canh, May3d, NhanVat } from './kieu';
import type { LoaiLoiKhung } from './khung';
import { bienTheTheoSo, huongVoiMay, PT_THAY } from './bo-set-3d';
import { LA_NHAN_DANG } from './kiem-ai-3d';
import { dauBoiCanh } from './prompt-khoi';
import { coKhongGian, dang, dichNhin, doCam, doDaMat, nguoiKhung, nguoiNgoai, nhinCan, thayMat, viTri, type KhongGian } from './khong-gian';
import type { LucKhung } from './so-vat';

export type CauHoi = { ma: string; hoi: string; loai: LoaiLoiKhung; phu_thuoc?: string };
/** DÁNG ở khung mở (mã động tác dung-set.py › DONG_TAC) → câu hỏi nhìn được. Chỉ dáng rõ trên hình; mocap 'mc_*' (đi, chạy) không hỏi. */
export const DANG: Record<string, string> = { chong_ban: 'chống hai tay lên mặt bàn, người đổ về trước', cui_nguoi: 'cúi người về phía trước', om_thung: 'ôm thùng trước bụng', cam_truoc: 'cầm món đồ trước ngực',
  khoanh_tay: 'khoanh tay', thuyet_trinh: 'một tay mở về phía màn chiếu', gioi_thieu: 'đưa tay giới thiệu người bên cạnh', gio_cao: 'giơ cao món đồ', lac_treo: 'chìa tay, món đồ treo lủng lẳng ngang mặt người đối diện', hat: 'hất mạnh món đồ ra trước', dua_truoc_mat: 'đưa món đồ lên trước mặt người đối diện',
  om_mat_khoc: 'hai tay ôm mặt, cúi đầu', om_nguc_khoc: 'gập người, tay ấn ngực', quy_khoc: 'quỵ hai gối, gục người', ngua_mat_gao: 'ngửa mặt ra sau, tay buông thõng', chi_tay_gian: 'chỉ thẳng tay về phía trước',
  lui_so: 'lùi lại, hai tay đưa lên che', om_nguoi: 'hai tay tự ôm lấy mình', tay_che_mieng: 'hai tay che miệng', tay_tran_cui: 'cúi người, một tay áp trán' };
const ngan = (t: string, n = 90) => { const x = t.trim().replace(/\s+/g, ' '); return x.length > n ? `${x.slice(0, n).replace(/[\s,;]+\S*$/, '')}…` : x; };

export function cauHoiKhung(x: { canh: Pick<Canh, 'khung_xam' | 'ky_thuat' | 'dan_dung' | 'may_3d'> & Partial<Pick<Canh, 'thu_tu'>>; nhanVat: NhanVat[]; may?: May3d | null; /** sơ đồ cảnh 2D (phim không 3D — doc-db › boiCanhCanh.khongGian) */ kg?: KhongGian | null; /** khung được kiểm: đầu (keyframe_url) / cuối (keyframe_ket) */ luc?: LucKhung }): CauHoi[] {
  const { canh, nhanVat } = x; const m = x.may ?? canh.may_3d; const kx = canh.khung_xam;
  const out: CauHoi[] = []; const chen = canh.ky_thuat?.co_canh === 'insert';
  // CẬN TAY: cận chèn mà chủ thể là món đang cầm / đeo ở tay → mặt người ngoài khung. Cận vết trên áo (#2) thì khung 3D vẫn có đầu — không hỏi "không thấy mặt".
  const canTay = chen && (kx?.kiem ?? []).some((k) => k.bat_buoc && k.trong_khung && m?.vi_tri.some((v) => v.ten === k.nhan_vat && v.cam && (!v.deo || v.deo.startsWith('cotay'))));
  const bc = nhanVat.find((v) => v.loai === 'boi_canh');
  if (bc?.mo_ta.trim()) out.push({ ma: 'boi_canh', loai: 'bo_tri', hoi: `Bối cảnh đúng: "${dauBoiCanh(bc.mo_ta)}"?` });
  // khung đầu hỏi khoảnh khắc MỞ, khung cuối hỏi khoảnh khắc KẾT (câu kết mang cả đồ ngoài khung đưa vào — #353 #8 nắm tay cầm dây thẻ đứt)
  const lucHoi = x.luc ?? 'dau';
  if (lucHoi === 'dau' && canh.dan_dung?.mo?.trim()) out.push({ ma: 'mo', loai: 'trang_thai', hoi: `Đúng khoảnh khắc MỞ shot: "${ngan(canh.dan_dung.mo, 120)}"?` });
  if (lucHoi === 'ket' && canh.dan_dung?.ket?.trim()) out.push({ ma: 'ket', loai: 'trang_thai', hoi: `Đúng khoảnh khắc KẾT shot: "${ngan(canh.dan_dung.ket.replace(/\s*(BODY POSE|OBJECT STATE) in this frame.*$/s, ''), 160)}"?` });
  const chuThe = (kx?.kiem ?? []).filter((k) => k.bat_buoc && k.trong_khung);
  const nguoi: string[] = [];
  for (const k of chuThe) {
    const a = nhanVat.find((v) => v.ten === k.nhan_vat); const vt = m?.vi_tri.find((v) => v.ten === k.nhan_vat); const co = `co:${k.nhan_vat}`;
    if (a?.loai === 'nhan_vat') {
      nguoi.push(a.ten);
      out.push({ ma: co, loai: 'thieu', hoi: canTay ? `Có tay / cổ tay của ${a.ten} trong khung?` : `Có ${a.ten} trong khung (${ngan(a.mo_ta, 70)})?` });
      const ao = vt ? bienTheTheoSo(vt, a).map((b) => b.mo_ta).filter(Boolean) : [];
      const dang = (vt?.dien ?? []).map((d) => String(d)).filter((d) => !d.includes('@') || Number(d.split('@')[1]!.split('-')[0]) <= 0.01).map((d) => DANG[d.split('@')[0]!]).filter(Boolean);
      if (dang.length) out.push({ ma: `dang:${a.ten}`, phu_thuoc: co, loai: 'trang_thai', hoi: `${a.ten} đang ${dang.join(', ')}?` });
      if (ao.length) out.push({ ma: `ao:${a.ten}`, phu_thuoc: co, loai: 'nhan_dang', hoi: `${a.ten} mặc đúng: ${ngan(ao.join('; '), 120)}?` });
      if (canTay) out.push({ ma: `chen:${a.ten}`, phu_thuoc: co, loai: 'thua', hoi: `Cận chèn: KHÔNG thấy mặt ${a.ten} (chỉ tay / cổ tay)?` });
      else if (!chen && m && vt) { const h = huongVoiMay(m, vt); if (h && h.lech <= 80) out.push({ ma: `mat:${a.ten}`, phu_thuoc: co, loai: 'vi_tri', hoi: `${a.ten} quay mặt về phía máy, thấy mặt (3D lệch ${h.lech}°)?` }); }
    } else {
      out.push({ ma: co, loai: 'thieu', hoi: `Có ${k.nhan_vat}${a?.mo_ta ? ` (${ngan(a.mo_ta, 70)})` : ''} rõ trong khung?` });
      if (vt?.cam) out.push({ ma: `cam:${k.nhan_vat}`, phu_thuoc: co, loai: 'vi_tri', hoi: `${k.nhan_vat} nằm trên ${vt.deo ? `${vt.deo.startsWith('cotay_t') ? 'cổ tay trái' : vt.deo.startsWith('cotay_p') ? 'cổ tay phải' : vt.deo} của` : 'tay / người'} ${vt.cam}?` });
    }
  }
  // KHÔNG 3D mà có SƠ ĐỒ CẢNH (khong-gian.ts): cùng các câu ai có mặt · dáng · thấy mặt / quay lưng · nhìn phía nào · đứng bên nào · ai KHÔNG được thấy ·
  // đồ trên người — trước đây phim không 3D chỉ được hỏi bối cảnh + khoảnh khắc mở (anh 24/10/2026: "phần chấm điểm chỉ áp dụng cho phim 3D")
  const kg = x.kg; const luc = x.luc ?? 'dau';
  if (!kx?.kiem?.length && coKhongGian(kg, canh)) {
    const thu = canh.thu_tu ?? 0; const BEN = (v: number) => (v < -0.33 ? 'bên TRÁI' : v > 0.33 ? 'bên PHẢI' : 'GIỮA');
    // cận chèn khai khung rỗng (không mặt người): hỏi người đang giữ / đeo món đồ của shot — tay / đồ của họ phải có, mặt thì không
    const sd = canh.ky_thuat?.sd; const trong = nguoiKhung(kg, canh, luc) ?? [];
    const hoiNguoi = chen && !trong.length ? kg.nguoi.filter((n) => sd?.o[n] != null && doCam(kg, thu, n, luc).length) : trong;
    for (const ten of hoiNguoi) {
      const a = nhanVat.find((v) => v.ten === ten); const co = `co:${ten}`; nguoi.push(ten);
      out.push({ ma: co, loai: 'thieu', hoi: chen ? `Có tay / đồ trên tay của ${ten} trong khung?` : `Có ${ten} trong khung${a?.mo_ta ? ` (${ngan(a.mo_ta, 70)})` : ''}?` });
      const d = dang(kg, thu, ten, luc); if (d && !chen) out.push({ ma: `dang:${ten}`, phu_thuoc: co, loai: 'trang_thai', hoi: `Dáng ${ten}: ${d.vi}?` });
      // đồ CẦM / mang rõ (thẻ, hộp) → mã vat (đã hiệu chỉnh, chặn); vết / nếp / trang phục trên người → mã mac (chi tiết nhỏ, Gemini báo nhầm ở khung tối / nghiêng — chỉ cảnh báo)
      for (const v of doCam(kg, thu, ten, luc)) out.push({ ma: `${/vết|nếp|tóc|áo|váy|trang phục|stain|wrinkle|hair/i.test(`${v.mon} ${v.vi}`) ? 'mac' : 'vat'}:${v.mon}`, phu_thuoc: co, loai: 'trang_thai', hoi: `${v.mon}: ${v.vi}?` });
      for (const mon of doDaMat(kg, thu, ten, luc)) out.push({ ma: `vang:${mon}`, phu_thuoc: co, loai: 'thua', hoi: `KHÔNG thấy ${mon} trên người ${ten} (đã sang tay người khác)?` });
      if (chen) { out.push({ ma: `chen:${ten}`, phu_thuoc: co, loai: 'thua', hoi: `Cận chèn: KHÔNG thấy mặt ${ten} (chỉ tay / đồ)?` }); continue; }
      const tm = thayMat(kg, canh, ten, luc);
      if (tm === true) out.push({ ma: `mat:${ten}`, phu_thuoc: co, loai: 'vi_tri', hoi: `${ten} quay mặt về phía máy, thấy mặt?` });
      else if (tm === false) out.push({ ma: `lung:${ten}`, phu_thuoc: co, loai: 'vi_tri', hoi: `${ten} quay lưng / quay 3/4 lưng về máy (thấy gáy, không thấy trọn mặt)?` });
      const h = nhinCan(kg, canh, ten, luc); const dn = dichNhin(canh, ten, luc);
      if (h && dn) out.push({ ma: `nhin:${ten}`, phu_thuoc: co, loai: 'vi_tri', hoi: `${ten} nhìn sang ${h < 0 ? 'TRÁI' : 'PHẢI'} màn (về ${kg.so_do.ten?.[dn] ?? dn}), không nhìn ống kính?` });
      const vt = viTri(kg, canh, ten, luc); if (vt != null) out.push({ ma: `ben:${ten}`, phu_thuoc: co, loai: 'vi_tri', hoi: `${ten} ở ${vt > 1 || vt < -1 ? `sát mép ${vt < 0 ? 'trái' : 'phải'} (vừa bước vào)` : BEN(vt)} khung?` });
    }
    if (!chen) for (const ten of nguoiNgoai(kg, canh, luc)) out.push({ ma: `ngoai:${ten}`, loai: 'thua', hoi: `KHÔNG thấy mặt / thân người ${ten} trong khung (chỉ tay hoặc đồ ${ten} đưa vào mép khung thì vẫn tính là không thấy)?` });
  }
  if (nguoi.length && !chen) out.push({ ma: 'so_nguoi', loai: 'thua', hoi: `Đúng ${nguoi.length} nhân vật chính (${nguoi.join(', ')}) — không nhân đôi, không người lạ chen tiền cảnh?` });
  for (const t of (kx?.thay ?? []).filter((t) => t.pt >= PT_THAY && LA_NHAN_DANG.test(t.en ?? ''))) out.push({ ma: `nd:${t.ten}`, loai: 'nhan_dang', hoi: `${ngan(t.en ?? t.ten, 90)} — đúng nội dung ảnh chuẩn trên khung 3D (chữ, hình)?` });
  if (m) {
    const g = Math.round((Math.atan2((m.nhin[2] ?? 0) - (m.dat[2] ?? 0), Math.hypot(m.nhin[0]! - m.dat[0]!, m.nhin[1]! - m.dat[1]!)) * 180) / Math.PI);
    out.push({ ma: 'goc', loai: 'vi_tri', hoi: `Góc máy ${g >= 8 ? `THẤP, ngước lên ~${g}°` : g <= -8 ? `CAO, chúc xuống ~${-g}°` : 'ngang tầm'} như khung 3D?` });
  }
  const chinh = chuThe.filter((k) => nhanVat.some((v) => v.ten === k.nhan_vat && v.loai === 'nhan_vat')).sort((a, b) => b.cao_khung_pt - a.cao_khung_pt)[0];
  if (chinh && !chen) out.push({ ma: 'co_canh', loai: 'vi_tri', hoi: `Cỡ khung đúng 3D: ${chinh.nhan_vat} cao khoảng ${Math.round(Math.min(100, chinh.cao_khung_pt))}% chiều cao khung (±15)?` });
  out.push({ ma: 'chu', loai: 'thua', hoi: 'Không có chữ / logo / phụ đề lạ (ngoài nội dung đồ nhận dạng)?' });
  return out;
}

/** In danh sách câu hỏi cho người chấm (thẻ shot của kiem-khung). */
export const inCauHoi = (ds: CauHoi[]) => ds.length ? `CÂU HỎI KIỂM (trả lời từng câu có / không; câu có "← sau" chỉ tính khi câu gốc "có"; mỗi câu "không" = một lỗi đúng loại trong ngoặc):\n${ds.map((c) => `  [${c.ma}] (${c.loai}) ${c.hoi}${c.phu_thuoc ? ` ← sau [${c.phu_thuoc}]` : ''}`).join('\n')}` : '';
/** Đáp án → lỗi: câu "không" mà câu gốc (nếu có) "có". dap: ma → true (có) / false (không). */
export function loiTuDapAn(ds: CauHoi[], dap: Record<string, boolean>): { loai: LoaiLoiKhung; mo_ta: string }[] {
  return ds.filter((c) => dap[c.ma] === false && (!c.phu_thuoc || dap[c.phu_thuoc] !== false)).map((c) => ({ loai: c.loai, mo_ta: `[${c.ma}] không: ${c.hoi}` }));
}

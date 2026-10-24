// Tự kiểm khong-gian.ts trên dữ liệu thật của cảnh Thang máy (phim #353) + phá thử từng cổng.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { keThuaNhin } from './so-do-canh';
import { coKhongGian, dang, diChuyen, doCam, loiMach2d, nguoiKhung, nguoiNgoai, nhinCan, thayMat, viTri, type KhongGian, type ShotKg } from './khong-gian';

const du = JSON.parse(readFileSync(new URL('../../../scripts/du-lieu/reelshort-thang-may.json', import.meta.url), 'utf8'));
const kg: KhongGian = { so_do: du.so_do, nguoi: du.nguoi, so_vat: du.so_vat, so_dang: du.so_dang, ten_en: du.ten_en };
const tao = (shot: typeof du.shot): ShotKg[] => keThuaNhin(kg.so_do, shot).map((m: any, i: number) => ({ id: 100 + i + 1, thu_tu: i + 1, phan_doan: du.phan_doan, ky_thuat: { sd: m.sd, sd_ket: m.sd_ket ?? undefined, co_canh: m.co }, dan_dung: { noi: m.noi } }));
const ds = tao(du.shot); const S = (n: number) => ds[n - 1]!;

assert.ok(coKhongGian(kg, S(1)) && !coKhongGian(null, S(1)) && !coKhongGian(kg as KhongGian | null, { ky_thuat: {} }));
assert.deepStrictEqual(nguoiKhung(kg, S(4)), ['Lâm Hạ', 'Vivian']);
assert.deepStrictEqual(nguoiKhung(kg, S(16)), ['Vivian']); assert.deepStrictEqual(nguoiNgoai(kg, S(16)), ['Lâm Hạ']);
assert.strictEqual(nguoiKhung(kg, { ky_thuat: {} }), null, 'không sơ đồ → null, không phải []');
assert.strictEqual(thayMat(kg, S(1), 'Lâm Hạ'), false, '#1 quay lưng');
assert.strictEqual(thayMat(kg, S(2), 'Lâm Hạ', 'dau'), false, '#2 đầu nửa lưng'); assert.strictEqual(thayMat(kg, S(2), 'Lâm Hạ', 'ket'), true, '#2 cuối quay đầu lộ mặt');
assert.strictEqual(nhinCan(kg, S(4), 'Vivian'), -1); assert.strictEqual(nhinCan(kg, S(1), 'Lâm Hạ'), null, 'quay lưng: không đo mắt');
assert.ok((viTri(kg, S(3), 'Vivian') ?? 0) > 1, '#3 Vivian đang vào từ mép phải');
const di = diChuyen(kg, S(3)); assert.strictEqual(di[0]?.ten, 'Vivian'); assert.strictEqual(di[0]?.dx, -1); assert.ok(di[0]!.met > 5);
assert.ok(dang(kg, 2, 'Lâm Hạ', 'ket')!.vi.includes('không cúi')); assert.ok(dang(kg, 5, 'Vivian', 'dau')!.vi.includes('buông')); assert.ok(dang(kg, 5, 'Vivian', 'ket')!.doi);
assert.ok(doCam(kg, 9, 'Vivian').some((x) => x.mon === 'Thẻ nhân viên'));
// dữ liệu thật: không lỗi mạch
assert.deepStrictEqual(loiMach2d(kg, ds), {}, JSON.stringify(loiMach2d(kg, ds)));
assert.deepStrictEqual(loiMach2d(null, ds), {});
// PHÁ THỬ 1 — vượt trục: #5 đặt máy sang phía bên kia đường Hạ–Vivian
{ const kg2 = { ...kg, so_do: { ...kg.so_do, may: { ...kg.so_do.may, sau: { dat: [0.3, 7.6] as [number, number], nhin: [0.3, 5.9] as [number, number] } } } };
  const d2 = ds.map((c) => (c.thu_tu === 5 ? { ...c, ky_thuat: { ...c.ky_thuat, sd: { ...c.ky_thuat!.sd!, may: 'sau' } } } : c));
  assert.ok((loiMach2d(kg2, d2)[105] ?? []).some((x) => x.startsWith('qua trục liền nhau')), JSON.stringify(loiMach2d(kg2, d2))); }
// PHÁ THỬ 2 — cắt theo ánh mắt mà không thấy: #12 (cận Thần) nối 'nhin' sang #13 chỉ có Hạ, Thần nhìn lối vào
{ const d2 = ds.map((c) => (c.thu_tu === 12 ? { ...c, dan_dung: { noi: 'nhin' } } : c));
  assert.ok((loiMach2d(kg, d2)[113] ?? []).some((x) => x.includes('NHÌN → THẤY'))); }
// cận chèn nhưng người được nhìn không cầm gì → vẫn lỗi
{ const so_vat = Object.fromEntries(Object.entries(kg.so_vat!).map(([k, v]) => [k, v.map((m) => (m.ai === 'Vivian' ? { ...m, ai: null } : m))]));
  assert.ok((loiMach2d({ ...kg, so_vat }, ds)[109] ?? []).some((x) => x.includes('NHÌN → THẤY'))); }
// PHÁ THỬ 3 — bỏ mọi shot toàn
{ const d2 = ds.map((c) => ({ ...c, ky_thuat: { ...c.ky_thuat, co_canh: c.ky_thuat?.co_canh === 'ws' ? 'ms' : c.ky_thuat?.co_canh } }));
  assert.ok((loiMach2d(kg, d2)[101] ?? []).some((x) => x.includes('TỔNG THỂ'))); }
// PHÁ THỬ 4 — đổi dáng không sự kiện
{ const so_dang = { ...kg.so_dang!, 'Dáng Vivian': kg.so_dang!['Dáng Vivian']!.map((m) => (m.tu === 10 ? { ...m, su_kien: undefined } : m)) };
  assert.ok((loiMach2d({ ...kg, so_dang }, ds)[110] ?? []).some((x) => x.startsWith('đứt mạch dáng'))); }
console.log('khong-gian.test: ok');
// MURCH dùng sơ đồ: có sơ đồ → chấm thật; không có 3D lẫn sơ đồ → 'chưa chấm' (0 điểm), không phải điểm mặc định; vượt trục → trừ mặt phẳng màn hình
{ const { diemMurchTap } = await import('./diem-murch');
  const NV = du.nguoi.map((t: string, i: number) => ({ id: i + 1, ten: t, loai: 'nhan_vat', bo_set_id: null, khoi_3d: null }));
  const idCua = (t: string) => NV.find((x: { ten: string }) => x.ten === t)?.id;
  const canh = ds.map((c, i) => ({ ...c, nhan_vat: (du.shot[i].nv as string[]).map(idCua).filter(Boolean), cam_xuc: 0, hanh_dong: du.shot[i].hd, dan_dung: { ...c.dan_dung, dien: 'x' }, may_3d: null, khung_xam: null, phat_s: 2, thoi_luong_s: 2, thoai: [] }));
  const kgt = { [du.phan_doan]: kg };
  const co = diemMurchTap(canh as never, NV, [], { kg: kgt }); const khong = diemMurchTap(canh as never, NV, []);
  assert.strictEqual(co[104]!.phan.hai_chieu, 1); assert.ok(!co[104]!.ly_do.ba_chieu, JSON.stringify(co[104]!.ly_do));
  assert.strictEqual(khong[104]!.phan.hai_chieu, 0); assert.ok(khong[104]!.ly_do.ba_chieu?.includes('chưa chấm')); assert.ok(khong[104]!.tong < co[104]!.tong, `${khong[104]!.tong} < ${co[104]!.tong}`);
  assert.ok(co[101]!.ly_do.cam_xuc?.includes('không thấy mặt') ?? false, '#1 Hạ quay lưng → máy không thấy mặt');
  const kg2 = { ...kg, so_do: { ...kg.so_do, may: { ...kg.so_do.may, sau: { dat: [0.3, 7.6] as [number, number], nhin: [0.3, 5.9] as [number, number] } } } };
  const vuot = diemMurchTap(canh.map((c) => (c.thu_tu === 5 ? { ...c, ky_thuat: { ...c.ky_thuat, sd: { ...c.ky_thuat!.sd!, may: 'sau' } } } : c)) as never, NV, [], { kg: { [du.phan_doan]: kg2 } });
  assert.ok(vuot[105]!.phan.hai_chieu < 1, JSON.stringify(vuot[105]!.ly_do)); }
console.log('khong-gian.test: ok (Murch)');
// CẢNH BÁO 2D: dữ liệu thật sạch; phá thử luật 30° (#13 cận Hạ dùng lại đúng máy #12 với chủ thể Hạ), ống kính (cận bằng máy toàn 26 mm), khoảng nhìn
{ const { canhBao2d } = await import('./khong-gian');
  assert.deepStrictEqual(canhBao2d(kg, ds), {});
  const d30 = ds.map((c) => (c.thu_tu === 3 ? { ...c, ky_thuat: { ...c.ky_thuat, sd: { ...c.ky_thuat!.sd!, may: 'can_ha', khung: ['Lâm Hạ'] }, sd_ket: undefined, co_canh: 'mcu' } } : c));
  assert.ok((canhBao2d(kg, d30)[103] ?? []).some((x) => x.startsWith('luật 30°')), JSON.stringify(canhBao2d(kg, d30)[103]));
  const dOng = ds.map((c) => (c.thu_tu === 2 ? { ...c, ky_thuat: { ...c.ky_thuat, co_canh: 'cu', sd: { ...c.ky_thuat!.sd!, may: 'toan' } } } : c));
  assert.ok((canhBao2d(kg, dOng)[102] ?? []).some((x) => x.startsWith('ống kính')));
  const kgN = { ...kg, so_do: { ...kg.so_do, moc: { ...kg.so_do.moc, vi_le: [2.6, 5.9] as [number, number] } } };
  const dN = ds.map((c) => (c.thu_tu === 4 ? { ...c, ky_thuat: { ...c.ky_thuat, sd: { ...c.ky_thuat!.sd!, o: { ...c.ky_thuat!.sd!.o, Vivian: 'vi_le' }, nhin: { Vivian: 'loi_vao' } } } } : c));
  assert.ok((canhBao2d(kgN, dN)[104] ?? []).some((x) => x.startsWith('khoảng nhìn')), JSON.stringify(canhBao2d(kgN, dN)[104])); }
console.log('khong-gian.test: ok (cảnh báo)');
// CÂU HỎI KIỂM KHUNG 2D: #4 hỏi có Hạ + Vivian, Vivian thấy mặt nhìn TRÁI, Hạ quay lưng (vai tiền cảnh); #16 hỏi KHÔNG thấy Hạ; #2 cuối hỏi dáng không cúi
{ const { cauHoiKhung } = await import('./cau-hoi-khung');
  const NV = du.nguoi.map((t: string, i: number) => ({ id: i + 1, ten: t, loai: 'nhan_vat', mo_ta: '' }));
  const hoi = (n: number, luc: 'dau' | 'ket' = 'dau') => cauHoiKhung({ canh: { ...S(n), khung_xam: null, may_3d: null, dan_dung: {} } as never, nhanVat: NV as never, kg, luc }).map((q) => `${q.ma}|${q.hoi}`);
  const h4 = hoi(4); assert.ok(h4.some((x) => x.startsWith('co:Lâm Hạ')) && h4.some((x) => x.startsWith('co:Vivian')));
  assert.ok(h4.some((x) => x.startsWith('mat:Vivian')) && h4.some((x) => x.startsWith('nhin:Vivian') && x.includes('TRÁI')), h4.join('\n')); assert.ok(h4.some((x) => x.startsWith('lung:Lâm Hạ')));
  assert.ok(hoi(16).some((x) => x.startsWith('ngoai:Lâm Hạ')));
  assert.ok(hoi(2, 'ket').some((x) => x.startsWith('dang:Lâm Hạ') && x.includes('không cúi')));
  assert.ok(hoi(6).some((x) => x.startsWith('chen:')), 'cận chèn');
  assert.ok(!cauHoiKhung({ canh: { ...S(4), khung_xam: null, may_3d: null, dan_dung: {} } as never, nhanVat: NV as never }).some((q) => q.ma.startsWith('co:')), 'không sơ đồ → không bịa câu'); }
console.log('khong-gian.test: ok (câu hỏi kiểm khung)');
// SOI MẶT 2D: người gán mặt theo sd.khung (#16 chỉ Vivian, không gán nhầm mặt cho Hạ)
{ const { nguoiSoiMat } = await import('./khung');
  assert.deepStrictEqual(nguoiSoiMat(S(16) as never, ['Lâm Hạ', 'Vivian']), ['Vivian']); assert.deepStrictEqual(nguoiSoiMat({}, ['Lâm Hạ']), ['Lâm Hạ']); }
console.log('khong-gian.test: ok (soi mặt)');
// TIMELINE trạng thái đối tượng 2D: Vivian #4 có vị trí + dáng; đổi dáng không cớ → trừ điểm nhánh dáng
{ const { trangThaiDoiTuong } = await import('./trang-thai-doi-tuong');
  const NV = du.nguoi.map((t: string, i: number) => ({ id: i + 1, ten: t, loai: 'nhan_vat', mo_ta: '', anh_ref: ['x'], bien_the: [], khoi_3d: null, bo_set_id: null }));
  const idCua = (t: string) => NV.find((x: { ten: string }) => x.ten === t)?.id;
  const canh = ds.map((c, i) => ({ ...c, canh: du.phan_doan, nhan_vat: (du.shot[i].nv as string[]).map(idCua).filter(Boolean), bien_the: [], hanh_dong: du.shot[i].hd, may_3d: null, khung_xam: null, bieu_cam: [], keyframe_url: null, prompt_anh: '', thoai: [] }));
  const kgt = { [du.phan_doan]: kg };
  const vi = trangThaiDoiTuong(canh as never, NV as never, [], [], kgt).find((r) => r.nv.ten === 'Vivian')!;
  const o4 = vi.o[3]!; assert.ok(o4.nhanh.some((n) => n.ma === 'vi_tri' && n.chu.includes('nhìn')), JSON.stringify(o4.nhanh)); assert.ok(o4.nhanh.some((n) => n.ma === 'dang' && n.chu.includes('buông')));
  const so_dang = { ...kg.so_dang!, 'Dáng Vivian': kg.so_dang!['Dáng Vivian']!.map((m) => (m.tu === 10 ? { ...m, su_kien: undefined } : m)) };
  const vi2 = trangThaiDoiTuong(canh as never, NV as never, [], [], { [du.phan_doan]: { ...kg, so_dang } }).find((r) => r.nv.ten === 'Vivian')!;
  assert.ok(vi2.o[9]!.nhanh.some((n) => n.ma === 'dang' && n.tru.length), JSON.stringify(vi2.o[9]!.nhanh)); }
console.log('khong-gian.test: ok (timeline)');
// SỔ LIỀN MẠCH 2D + quãng đi
{ const { soLienMach } = await import('./so-lien-mach'); const { diCmShot } = await import('./khong-gian');
  const canh = ds.map((c) => ({ ...c, canh: du.phan_doan, may_3d: null }));
  const so = soLienMach(canh as never, [], du.nguoi.map((t: string) => ({ ten: t, khoi_3d: null })), { [du.phan_doan]: kg });
  const v3 = so.nhanVat['Vivian']!.find((d) => d.thu_tu === 3)!; assert.ok(v3.trang.includes('buông'), v3.trang); assert.ok(so.nhanVat['Lâm Hạ']!.find((d) => d.thu_tu === 16)!.an, '#16 Hạ khuất');
  assert.ok(diCmShot({ [du.phan_doan]: kg }, S(3)) > 500); assert.strictEqual(diCmShot(null, S(3)), 0); }
console.log('khong-gian.test: ok (sổ liền mạch)');

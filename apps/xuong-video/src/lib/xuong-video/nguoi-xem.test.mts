// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/nguoi-xem.test.mts
import assert from 'node:assert';
import { banNguoiXem, maBan, maKichBan, chanNguoiXem, maTheoCanh, phuTheoCanh } from './nguoi-xem';
import type { ThuNguoiXem } from './kieu';
const sh = (thu_tu: number, hanh_dong: string, chu_man: string, thoai: { nhan_vat: string; loi: string }[]) => ({ thu_tu, phan_doan: '', phat_s: 2, thoi_luong_s: 4, hanh_dong, chu_man, loi_thoai: '', thoai: thoai.map((d) => ({ ...d, dien_xuat: 'NỘI BỘ' })) });
const ds = [sh(1, 'The crow holds the cheese', 'THE BIGGEST CHEESE', [{ nhan_vat: '', loi: 'Felix had a plan.' }]), sh(2, 'Felix grins', '', [{ nhan_vat: 'Felix', loi: 'Ahem.' }])];
const b = banNguoiXem(ds);
assert.ok(b.includes('#1 [0.0–2.0s] THẤY: The crow holds the cheese | CHỮ TRÊN MÀN: THE BIGGEST CHEESE | NGHE: Người dẫn (giọng ngoài khung): "Felix had a plan."'), b);
assert.ok(b.includes('#2 [2.0–4.0s]') && b.includes('Felix: "Ahem."') && !b.includes('NỘI BỘ'), 'diễn xuất là ghi chú nội bộ, người xem không đọc được');
const ma = maKichBan(ds);
assert.notStrictEqual(maBan(b), ma, 'mã kịch bản không chứa giây');
const kq = (o: Partial<ThuNguoiXem>): ThuNguoiXem => ({ ma, luc: '', model: '', ke_lai: '', hieu: { ai: '', muon: '', can: '', lat: '', ket: '' }, diem: 8, cho_kho: [], khop: true, lech: '', dat: true, ...o });
assert.deepStrictEqual(chanNguoiXem(kq({}), ds), []);
assert.ok(chanNguoiXem(null, ds)[0]!.includes('chưa kiểm'));
assert.ok(chanNguoiXem(kq({}), [ds[0]!, { ...ds[1]!, chu_man: 'PLAN A' }])[0]!.includes('đã sửa sau lần kiểm'), 'sửa chữ màn → phải kiểm lại');
assert.deepStrictEqual(chanNguoiXem(kq({}), [ds[0]!, { ...ds[1]!, phat_s: 3.4 }]), [], 'khớp giọng đổi giây → KHÔNG bắt kiểm lại');
assert.ok(chanNguoiXem(kq({ dat: false, diem: 4, khop: false, lech: 'không biết truyện gốc', cho_kho: [{ shot: 8, van_de: 'quạ hát mà câm', sua: '' }] }), ds)[0]!.includes('#8 quạ hát mà câm'));
assert.deepStrictEqual(chanNguoiXem(null, []), [], 'tập chưa tách cảnh: chưa có gì để thử');
// ÁP BẢN SỬA: giữ giọng câu không đổi, câu đổi phải đọc lại; chèn shot đúng chỗ; tên anchor → id
import { keHoachSua, LOI_CAN_KEYFRAME } from './nguoi-xem';
const cu = [{ id: 10, thu_tu: 1, nhan_vat: [8], thoai: [{ nhan_vat: '', dien_xuat: 'dry', loi: 'Felix had a plan.', url: 'u1', dai: 2 }] }, { id: 11, thu_tu: 2, nhan_vat: [], thoai: [{ nhan_vat: 'Felix', dien_xuat: '', loi: 'Ahem.', url: 'u2' }] }, { id: 12, thu_tu: 3, nhan_vat: [], thoai: [] }];
const kh = keHoachSua(cu, [{ id: 7, ten: 'Crow' }, { id: 8, ten: 'Vineyard' }],
  [{ shot: 1, hanh_dong: 'a', chu_man: 'WANTS CHEESE.', thoai: [{ nhan_vat: '', dien_xuat: 'dry', loi: 'Felix had a plan.' }, { nhan_vat: '', dien_xuat: '', loi: 'Make her sing.' }], prompt_anh: 'p', doi_hinh: true, phat_s: 1.2, nhan_vat: ['Crow'] },
   { shot: 9, hanh_dong: '', chu_man: '', thoai: [], prompt_anh: '', doi_hinh: false, phat_s: 3 }],
  [{ sau_shot: 2, canh: 'Claw', hanh_dong: 'The crow moves the cheese to its claw', chu_man: '', thoai: [], prompt_anh: 'close-up', nhan_vat: ['crow', 'Ghost'], phat_s: 2.5 }]);
assert.strictEqual(kh.capNhat.length, 1, 'shot không tồn tại thì bỏ qua');
assert.strictEqual(kh.capNhat[0]!.thoai[0]!.url, 'u1'); assert.strictEqual(kh.capNhat[0]!.thoai[1]!.url, null);
assert.strictEqual(kh.capNhat[0]!.thoai_url, 'u1'); assert.strictEqual(kh.capNhat[0]!.chu_man, 'WANTS CHEESE'); assert.strictEqual(kh.capNhat[0]!.phat_s, 2); assert.strictEqual(kh.capNhat[0]!.loi, LOI_CAN_KEYFRAME);
assert.deepStrictEqual(kh.capNhat[0]!.nhan_vat, [8, 7], 'giữ anchor cũ + gắn anchor Claude ghi');
assert.deepStrictEqual(kh.thuTu, [10, 11, 'm0', 12]); assert.deepStrictEqual(kh.chen[0]!.nhan_vat, [7]); assert.strictEqual(kh.chen[0]!.sau_id, 11);
// CỔNG theo nhánh: kiểm trên nhánh A; đang sinh shot nhánh B (danh sách B) vẫn phải so mã với nhánh A — không chặn oan
import { chanTienKy } from './quy-trinh';
const A = [sh(1, 'hook A', 'A?', []), sh(2, 'body', '', [])]; const B = [sh(1, 'hook B', 'B?', []), sh(2, 'body', '', [])];
const TQ2 = { so: 1, brief: 'Một brief đủ dài để qua cổng tiền kỳ', beats: [{ ten: 'a', cam_xuc: -2 }, { ten: 'b', cam_xuc: 1 }, { ten: 'c', cam_xuc: 3 }], phan_canh: [{ ten: 'A' }], nhac_url: null, nhac_phan_canh: {}, thu_nguoi_xem: kq({ ma: maKichBan(A) }) };
const PQ2 = { phong_cach: 'cinematic night city, teal and orange, anamorphic', laQc: false };
const nx = (r: string[]) => r.filter((x) => x.startsWith('người xem'));
assert.deepStrictEqual(nx(chanTienKy(TQ2, PQ2, B, A)), [], 'nhánh B + so với A → qua');
assert.ok(nx(chanTienKy(TQ2, PQ2, B))[0]?.includes('đã sửa'), 'không truyền nhánh A → so nhầm với B (đúng lỗi cũ) — kiểm đỏ được');
// Khung truyện phẳng: chặn phim truyện, KHÔNG chặn QC (QC mở bằng tính năng / ưu đãi không có nhịp âm — 15/10/2026).
{ const phang = { ...TQ2, beats: [{ ten: 'Mở', cam_xuc: 1 }, { ten: 'Giải quyết', cam_xuc: 3 }, { ten: 'Chốt', cam_xuc: 5 }] };
  assert.ok(chanTienKy(phang, PQ2, A, A).some((x) => x.includes('phẳng')), 'phim truyện phẳng → chặn');
  assert.ok(!chanTienKy(phang, { ...PQ2, laQc: true }, A, A).some((x) => x.includes('phẳng')), 'QC phẳng → không chặn'); }
console.log('nguoi-xem.test: ok');

// Kiểm theo cảnh: sửa cảnh B sau lần kiểm cả tập → chỉ B bị chặn; kiểm riêng B đạt → qua; chèn shot ở B làm đánh số lại C → C vẫn được phủ.
{
  const sh = (thu_tu: number, phan_doan: string, hanh_dong: string) => ({ thu_tu, phan_doan, hanh_dong, phat_s: 3, thoi_luong_s: 3, chu_man: '', thoai: [], loi_thoai: '' });
  const goc = [sh(1, 'A', 'a1'), sh(2, 'B', 'b1'), sh(3, 'C', 'c1')];
  const ca = { ma: maKichBan(goc), ma_canh: maTheoCanh(goc), luc: '', model: '', ke_lai: '', hieu: { ai: '', muon: '', can: '', lat: '', ket: '' }, diem: 8, cho_kho: [], khop: true, lech: '', dat: true };
  const moi = [sh(1, 'A', 'a1'), sh(2, 'B', 'b1 sửa'), sh(3, 'B', 'b2 mới'), sh(4, 'C', 'c1')];
  const chan = chanNguoiXem(ca, moi);
  if (chan.length !== 1 || !chan[0]!.includes('“B”')) throw new Error(`chỉ cảnh B bị chặn: ${JSON.stringify(chan)}`);
  const rieng = { ...ca, ma: maTheoCanh(moi).B!, ma_canh: undefined };
  if (chanNguoiXem({ ...ca, canh: { B: rieng } }, moi).length) throw new Error('kiểm riêng B đạt → qua');
  if (chanNguoiXem({ ...ca, canh: { B: { ...rieng, dat: false, diem: 4 } } }, moi).length !== 1) throw new Error('kiểm riêng B chưa đạt → chặn');
  if (!phuTheoCanh(ca, moi).find((x) => x.ten === 'C')!.phu) throw new Error('C đánh số lại vẫn được phủ');
  console.log('nguoi-xem.test: theo cảnh ok');
  // tomTatNguoiXem — một kết luận cho nhãn: vỏ bản cả tập (ma '', dat false, 0/10) + mọi cảnh kiểm riêng đạt → đạt theo cảnh, khoảng điểm thật (#51)
  const { tomTatNguoiXem } = await import('./nguoi-xem');
  const mc = maTheoCanh(goc);
  const r = (ten: string, diem: number, dat = true) => ({ ...ca, ma: mc[ten]!, ma_canh: undefined, diem, dat });
  const vo = { ...ca, ma: '', ma_canh: undefined, dat: false, diem: 0, canh: { A: r('A', 8), B: r('B', 9), C: r('C', 8) } };
  const k1 = tomTatNguoiXem(vo, goc);
  if (!k1.dat || !k1.theoCanh || k1.soCanh !== 3 || JSON.stringify(k1.diem) !== '[8,9]') throw new Error(`đạt theo cảnh: ${JSON.stringify(k1)}`);
  const k2 = tomTatNguoiXem({ ...vo, canh: { ...vo.canh, B: r('B', 4, false) } }, goc);
  if (k2.dat || k2.theoCanh) throw new Error(`một cảnh chưa đạt → chưa đạt: ${JSON.stringify(k2)}`);
  const k3 = tomTatNguoiXem(ca, goc);
  if (!k3.dat || k3.theoCanh || JSON.stringify(k3.diem) !== '[8,8]') throw new Error(`bản cả tập khớp mã → điểm cả tập: ${JSON.stringify(k3)}`);
  if (tomTatNguoiXem(null, goc).dat) throw new Error('chưa kiểm → chưa đạt');
  console.log('nguoi-xem.test: tóm tắt nhãn ok');
  // Bản cả tập KHỚP mã nhưng hỏng (0/10 chữ rác) + SAU ĐÓ mọi cảnh kiểm riêng đạt → qua (phim #306, 25/10/2026); cả tập mới hơn → vẫn chặn.
  const hong = { ...ca, dat: false, diem: 0, lech: 'viec-cao-vua', luc: '2026-10-25T11:45:00Z' };
  const rr = (ten: string, luc: string, dat = true) => ({ ...r(ten, 8, dat), luc });
  const sau = { A: rr('A', '2026-10-25T11:46:00Z'), B: rr('B', '2026-10-25T11:46:00Z'), C: rr('C', '2026-10-25T11:46:00Z') };
  if (!chanNguoiXem(hong, goc).length) throw new Error('cả tập hỏng, chưa kiểm cảnh → chặn');
  if (chanNguoiXem({ ...hong, canh: sau }, goc).length) throw new Error('mọi cảnh kiểm riêng đạt SAU lần cả tập → qua');
  if (!chanNguoiXem({ ...hong, canh: { ...sau, C: rr('C', '2026-10-25T11:46:00Z', false) } }, goc).length) throw new Error('một cảnh chưa đạt → chặn');
  if (!chanNguoiXem({ ...hong, canh: { A: sau.A, B: sau.B } }, goc).length) throw new Error('thiếu một cảnh → chặn');
  if (!chanNguoiXem({ ...hong, canh: { ...sau, B: rr('B', '2026-10-25T11:40:00Z') } }, goc).length) throw new Error('cảnh kiểm TRƯỚC lần cả tập → cả tập mới hơn thắng → chặn');
  const k4 = tomTatNguoiXem({ ...hong, canh: sau }, goc);
  if (!k4.dat || !k4.theoCanh) throw new Error(`nhãn: đạt theo cảnh: ${JSON.stringify(k4)}`);
  console.log('nguoi-xem.test: cảnh thay bản cả tập hỏng ok');
}

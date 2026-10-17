// Tự kiểm trang-thai-doi-tuong.ts: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/trang-thai-doi-tuong.test.mts
import assert from 'node:assert';
import { trangThaiDoiTuong, TRU_DIEM, moTaViTri, chuDien, nhanhLienMach } from './trang-thai-doi-tuong';
import type { Canh, NhanVat } from './kieu';

const nv = (id: number, loai: string, ten: string, anh = true) => ({ id, loai, ten, mo_ta: 'mô tả', anh_ref: anh ? ['https://x/a.jpg'] : [], bien_the: [], khoi_3d: null } as unknown as NhanVat);
const shot = (id: number, gan: number[], o: Partial<Canh> = {}) => ({ id, thu_tu: id, canh: `Shot ${id}`, nhan_vat: gan, bien_the: [], prompt_anh: '', hanh_dong: '', keyframe_url: `k${id}`, video_url: null, video_cuoi_url: null, kiem_khung: null, soi_clip: null, may_3d: null, ...o } as unknown as Canh);

const MIKE = nv(1, 'nhan_vat', 'Mike'), QUAN = nv(2, 'san_pham', 'JettJeans'), HOP = nv(3, 'dao_cu', 'Box', false);
const r = trangThaiDoiTuong([
  shot(1, [1, 2]),
  shot(2, [1], { hanh_dong: 'Mike holds JettJeans up' }),                          // quần nhắc tên mà chưa gắn
  shot(3, [1, 2, 3], { kiem_khung: { url: 'k3', dat: false, loi: [{ loai: 'nhan_vat', mo_ta: 'Mike thừa một tay', sua: '' }], luc: '', model: '' } }),
  shot(4, [2], { video_url: 'v4', soi_clip: { url: 'v4', luc: '', loi: ['chữ lạ'], do: { mau: [], chu: [] } } }),
  shot(5, [1], { kiem_khung: { url: 'cu', dat: false, loi: [{ loai: 'x', mo_ta: 'Mike lệch', sua: '' }], luc: '', model: '' } }),   // kiểm khung của keyframe cũ → không tính
], [MIKE, QUAN, HOP]);

const dong = (ten: string) => r.find((x) => x.nv.ten === ten)!;
assert.deepStrictEqual(r.map((x) => x.nv.ten), ['Mike', 'Box', 'JettJeans'], 'xếp: người → đạo cụ → sản phẩm');
// Mike: shot 1, 2, 5 = 10; shot 3 trừ kiểm khung; vắng shot 4.
assert.deepStrictEqual(dong('Mike').o.map((x) => x.diem), [10, 10, 10 - TRU_DIEM.kiem_khung, null, 10]);
assert.strictEqual(dong('Mike').diem, 9.3, '(10+10+7+10)/4 = 9,25 → 9,3');
// Quần: shot 2 nhắc tên chưa gắn (co=false nhưng có điểm), shot 4 soi clip lỗi.
assert.strictEqual(dong('JettJeans').o[1]!.co, false);
assert.strictEqual(dong('JettJeans').o[1]!.diem, 10 - TRU_DIEM.nhac_chua_gan);
assert.strictEqual(dong('JettJeans').o[3]!.diem, 10 - TRU_DIEM.soi_clip);
// Hộp chưa có ảnh mẫu → 0 điểm, đỏ.
assert.strictEqual(dong('Box').o[2]!.diem, 0);
assert.strictEqual(dong('Box').o[2]!.muc, 'do');
// Đối tượng không xuất hiện shot nào → không có làn.
assert.ok(!trangThaiDoiTuong([shot(1, [1])], [MIKE, nv(9, 'dao_cu', 'Lamp')]).some((x) => x.nv.ten === 'Lamp'));
// CÂY: điểm ô = 10 − tổng khoản trừ của các nhánh; lỗi kiểm khung nằm ở nhánh 'kiem', mẫu thiếu ở nhánh 'mau'
const o3 = dong('Mike').o[2]!;
assert.deepStrictEqual(o3.nhanh.find((n) => n.ma === 'kiem')!.tru.map((t) => t.diem), [TRU_DIEM.kiem_khung]);
for (const r0 of r) for (const o of r0.o) if (o.diem != null) assert.strictEqual(o.diem, Math.max(0, 10 - o.nhanh.reduce((a, n) => a + n.tru.reduce((x, t) => x + t.diem, 0), 0)));
assert.ok(dong('Box').o[2]!.nhanh.find((n) => n.ma === 'mau')!.tru.length === 1);
assert.strictEqual(dong('Mike').o[4]!.nhanh.find((n) => n.ma === 'kiem')!.chu, 'chưa kiểm keyframe này', 'kiểm khung của keyframe cũ');
// VỊ TRÍ BẰNG CHỮ: đồ set gần nhất (bỏ tường), người gần nhất, hướng so với máy, đi tới đâu — không toạ độ
const vat = [{ ten: 'Tường', hinh: 'hop', tam: [0, 0, 0], co: [1, 1, 1], mau: '#000', nen: true }, { ten: 'Thang máy 1', hinh: 'hop', tam: [-100, 470, 0], co: [1, 1, 1], mau: '#000' }, { ten: 'Bàn', hinh: 'hop', tam: [300, 100, 0], co: [1, 1, 1], mau: '#000' }] as never;
const may = { dat: [-100, 200, 150], nhin: [-100, 380, 150], ong_kinh: 35, vi_tri: [{ ten: 'Hạ', tam: [-100, 380, 0], huong: 180 }, { ten: 'Vivian', tam: [0, 365, 0], huong: -90, den: [250, 120, 0] }] } as never;
const chuHa = moTaViTri({ ten: 'Hạ', tam: [-100, 380, 0], huong: 0 } as never, may, vat, true);
assert.strictEqual(chuHa, 'cạnh Thang máy 1 · cách Vivian 1 m · nhìn về máy');
assert.ok(!/\d+, \d+/.test(chuHa), 'không in toạ độ');
assert.ok(moTaViTri({ ten: 'Vivian', tam: [0, 365, 0], huong: -90, den: [250, 120, 0] } as never, may, vat, true).includes('→ cạnh Bàn'));
assert.strictEqual(moTaViTri({ ten: 'Thẻ', tam: [0, 0, 0], cam: 'Vivian' } as never, may, vat, false), 'trong tay Vivian');
assert.strictEqual(chuDien('hat@0.25-0.45'), 'hất mạnh món đồ ra trước (25–45% shot)');
assert.strictEqual(chuDien('mc_sai_buoc'), 'sải bước');
assert.strictEqual(nhanhLienMach('Hạ đổi trang phục giữa cảnh', true), 'ngoai');
assert.strictEqual(nhanhLienMach('Hạ nhảy chỗ 120 cm so với shot trước', true), 'vi_tri');
console.log('trang-thai-doi-tuong: đạt');

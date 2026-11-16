// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/hoan-cong-lien.test.mts
import assert from 'node:assert';
import { lechNoiTiep, dongLech, hoanCongCu, type HoanCong } from './hoan-cong-lien';
const k = (nguoi: string[], dao: [string, string][]) => ({ nguoi: nguoi.map((ai) => ({ ai })), dao_cu: dao.map(([ten, nguoi_giu]) => ({ ten, nguoi_giu, cach_giu: 'tay' })) }) as never;
const hc = (dau: unknown, cuoi: unknown): HoanCong => ({ url: 'u', luc_cham: '', doan: [0, 1], dau: { t: 0, boc: dau as never, chieu: [] }, cuoi: { t: 1, boc: cuoi as never, chieu: [] } });
// ca phim #3071 #15 → #16: cuối #15 tiền thừa đã giơ lên (tay nhóc), đầu #16 nhóc vẫn cầm ở hông → cùng người, không lỗi đổi tay;
// đầu #16 mà tiền ở tay chú (chú có mặt) → đổi tay không có trên hình
const s15 = { so: 15, phan_doan: 'Quay về', hc: hc(k(['Chú'], []), k(['Chú', 'Nhóc'], [['Tiền thừa', 'Nhóc']])) };
assert.deepStrictEqual(lechNoiTiep([s15, { so: 16, phan_doan: 'Quay về', hc: hc(k(['Nhóc'], [['tiền thừa (nhàu)', 'Nhóc']]), k(['Nhóc'], [])) }]), []);
assert.ok(lechNoiTiep([s15, { so: 16, phan_doan: 'Quay về', hc: hc(k(['Nhóc', 'Chú'], [['Tiền thừa', 'Chú']]), k([], [])) }])[0]!.chu.includes('đổi tay'));
assert.ok(lechNoiTiep([s15, { so: 16, phan_doan: 'Quay về', hc: hc(k(['Nhóc'], []), k([], [])) }])[0]!.chu.includes('biến mất'));
assert.deepStrictEqual(lechNoiTiep([s15, { so: 16, phan_doan: 'Khác', hc: hc(k(['Nhóc'], []), k([], [])) }]), [], 'khác phân cảnh không so');
assert.deepStrictEqual(lechNoiTiep([s15, { so: 16, phan_doan: 'Quay về' }]), [], 'shot sau chưa hoàn công → chưa so');
assert.strictEqual(dongLech({ t: 0, boc: {} as never, chieu: [{ thanh_phan: 'a', du_kien: '', thuc_te: '', muc: 'khớp', ghi_chu: '' }, { thanh_phan: 'b', du_kien: '', thuc_te: '', muc: 'thiếu', ghi_chu: '' }] }).length, 1);
assert.ok(hoanCongCu({ url: 'cu' } as HoanCong, 'moi') && !hoanCongCu({ url: 'x' } as HoanCong, 'x'));
console.log('✓ hoan-cong-lien (nối tiếp trạng thái thật qua cú cắt)');

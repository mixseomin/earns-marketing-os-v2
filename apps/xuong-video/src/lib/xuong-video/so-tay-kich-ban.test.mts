// Tự kiểm so-tay-kich-ban.ts: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/so-tay-kich-ban.test.mts
import assert from 'node:assert';
import { cachViet, vanSoTay, kiemTheGag, chonGag, ketLuan, kichBanTuGag, PHEP_THU_GAG, type TheGag, type DiemGag } from './so-tay-kich-ban';

assert.strictEqual(cachViet('mv_gag_hoat_hinh'), 'gag');
assert.strictEqual(cachViet('phim_doc_tong_tai'), 'thuong');
assert.strictEqual(cachViet(''), 'thuong');
assert.ok(vanSoTay('mv_gag_hoat_hinh').includes('[GAG n]') && vanSoTay('mv_gag_hoat_hinh').includes('Thay vai'));
assert.ok(!vanSoTay('phim_doc_tong_tai').includes('[GAG n]') && vanSoTay('phim_doc_tong_tai').includes('Hook 3 giây'));

const g = (ten: string, co_che: string, muc: number, o: Partial<TheGag> = {}): TheGag => ({ ten, van_de: 'v', ra_tay: 'r', day_them: 'd', phan_ung: 'p', co_che, vi_sao_noi: 'n', muc, ...o });
const full = (ten: string, tong: number, sua: Record<string, number> = {}): DiemGag => ({ ten, diem: Object.fromEntries(PHEP_THU_GAG.map((p) => [p.ma, sua[p.ma] ?? 2])), ly_do_loai: '', phen: '', tong });

// máy kiểm: ô trống + trùng cơ chế (bỏ dấu, hoa thường) — kiểm có thể đỏ
const loi = kiemTheGag([g('A', 'Móc vật đang bay', 1), g('B', 'moc vat dang bay', 2), g('C', 'x', 3, { day_them: ' ' })]);
assert.ok(loi.some((l) => l.includes('trùng cơ chế')) && loi.some((l) => l.includes('thiếu ô day_them')), loi.join(' | '));
assert.deepStrictEqual(kiemTheGag([g('A', 'a', 1), g('B', 'b', 2)]), []);

// chọn: trượt một phép (0) là loại; thử mù không hiểu là loại; trùng cơ chế giữ bản điểm cao; xếp theo muc tăng; quá K → loại "thừa"
const ds = [g('nho', 'a', 1), g('to', 'b', 9), g('truot', 'c', 5), g('trung_thap', 'a', 4), g('mu', 'd', 3), g('vua', 'e', 5)];
const diem = [full('nho', 10), full('to', 12), full('truot', 11, { thay_vai: 0 }), full('trung_thap', 8), full('mu', 10), full('vua', 9)];
const r = chonGag(ds, diem, [{ ten: 'mu', ke_lai: 'không rõ', hieu: false, buon_cuoi: 0 }], 2);
assert.deepStrictEqual(r.chon.map((x) => x.ten), ['nho', 'to']);
assert.ok(r.loai.find((x) => x.ten === 'truot')!.vi.includes('Thay vai'));
assert.ok(r.loai.find((x) => x.ten === 'mu')!.vi.includes('thử mù'));
assert.ok(r.loai.find((x) => x.ten === 'trung_thap')!.vi.includes('trùng cơ chế'));
assert.ok(r.loai.find((x) => x.ten === 'vua')!.vi.includes('thừa'));

// kết luận: một mục 0 là chưa đạt dù điểm cao; máy báo lỗi là chưa đạt
const m = (d: number[]) => d.map((x, i) => ({ ma: `m${i}`, ten: `M${i}`, diem: x, ly_do: '' }));
assert.strictEqual(ketLuan(m([2, 2, 2, 2]), [], []).dat, true);
assert.strictEqual(ketLuan(m([2, 2, 2, 0]), [], []).dat, false);
assert.ok(ketLuan(m([2, 2, 2, 0]), [], []).ket_luan.includes('trượt M3'));
assert.strictEqual(ketLuan(m([2, 2, 2, 2]), ['trùng'], []).dat, false);
assert.strictEqual(ketLuan(m([1, 1, 1, 1]), [], []).diem, 5);
assert.ok(kichBanTuGag([g('A', 'a', 1)], 'Mở').startsWith('Mở\n\n[GAG 1] A'));
console.log('✓ so-tay-kich-ban');

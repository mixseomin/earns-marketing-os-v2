// Tự kiểm bộ kiểm quảng cáo. Chạy: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/kiem-qc.test.mts
import assert from 'node:assert';
import { kiemQc } from './kiem-qc';
import { giayBeat } from './dien-anh';
import { locNhanh, cacNhanh, giayPhat, lamTronClip } from './kieu';

const nv = [{ id: 1, loai: 'nhan_vat' }, { id: 2, loai: 'san_pham' }] as const;
type S = Parameters<typeof kiemQc>[0]['canh'][number];
const shot = (p: Partial<S> & { thu_tu: number }): S => ({ nhan_vat: [1, 2], phan_doan: '', chu_man: '', nhanh: '', phat_s: null, thoi_luong_s: 4, loi_thoai: '', thoai: [], trang_thai: 'nhap', keyframe_url: null, ...p });
const qc = { ten: 'Bra', link: '', diem_noi_bat: '1676 đánh giá 5 sao, đổi trả 45 ngày', doi_tuong: '', uu_dai: '$24.99 giảm 70%', thi_truong: 'Mỹ', anh: [] };
const ok = (ds: ReturnType<typeof kiemQc>, k: string) => ds.find((x) => x.key === k)!.ok;

// Bản đạt: hook 2s có chữ, sản phẩm sớm, bằng chứng số thật, trấn an, CTA chữ.
const dat = [
  shot({ thu_tu: 1, phat_s: 2, chu_man: 'Vai hằn đỏ mỗi tối?', thoai: [{ nhan_vat: 'A', dien_xuat: '', loi: 'Đeo bra gọng cả ngày' }] }),
  shot({ thu_tu: 2, phat_s: 3, chu_man: 'Không gọng, vẫn nâng' }),
  shot({ thu_tu: 3, phat_s: 3, chu_man: '1676 đánh giá 5 sao', phan_doan: 'Bằng chứng' }),
  shot({ thu_tu: 4, phat_s: 3, chu_man: 'Đổi trả 45 ngày' }),
  shot({ thu_tu: 5, phat_s: 3, chu_man: 'Giảm 70% · Mua ngay' }),
];
let r = kiemQc({ loai: 'quang_cao', canh: dat, nhanVat: nv as never, qc, mucTieuS: 14 });
assert.ok(r.every((x) => x.ok), JSON.stringify(r.filter((x) => !x.ok)));

// Bản như phim bra cũ: hook 6s không chữ, 64s cho 24s, số bịa, không trấn an, CTA không chữ.
const hong = [
  shot({ thu_tu: 1, thoi_luong_s: 6, thoai: [{ nhan_vat: 'A', dien_xuat: '', loi: 'Đeo bra gọng 10 tiếng mỗi ngày tối về vai hằn đỏ hết luôn nè mấy bà ơi thiệt là khổ' }] }),
  shot({ thu_tu: 2, thoi_luong_s: 6, nhan_vat: [1], chu_man: 'Khoá 3 nấc dây 2cm' }),
  shot({ thu_tu: 3, thoi_luong_s: 6, nhan_vat: [1] }),
  shot({ thu_tu: 4, thoi_luong_s: 6, nhan_vat: [1] }),
];
r = kiemQc({ loai: 'quang_cao', canh: hong, nhanVat: nv as never, qc, mucTieuS: 24 });
assert.strictEqual(ok(r, 'dai'), true);          // 24s đúng mục tiêu
assert.strictEqual(ok(r, 'hook'), false);        // 6s, không chữ
assert.strictEqual(ok(r, 'sp_som'), true);       // shot 1 có sản phẩm ở 0s
assert.strictEqual(ok(r, 'sp_23'), false);       // 1/4
assert.strictEqual(ok(r, 'bang_chung'), false);  // "3", "2" không có trong mục 0 → nhưng chỉ số ≥2 ký tự mới tính; "10" trong thoại thì bịa
assert.ok(r.find((x) => x.key === 'bang_chung')!.chu.includes('10'));
assert.strictEqual(ok(r, 'cta'), false);
assert.strictEqual(ok(r, 'tran_an'), false);
assert.strictEqual(ok(r, 'toc_do'), false);      // 20 từ / 6s > 2,8
// Phim thường: chỉ kiểm độ dài.
r = kiemQc({ loai: 'phim', canh: hong, nhanVat: nv as never, mucTieuS: 60 });
assert.deepStrictEqual(r.map((x) => x.key), ['dai']);
assert.strictEqual(r[0]!.ok, false);
// Không mục tiêu → không có mục 'dai'.
assert.ok(!kiemQc({ loai: 'quang_cao', canh: dat, nhanVat: nv as never, qc }).some((x) => x.key === 'dai'));

// Nhánh hook: thân '' + A/B; locNhanh lấy thân + một nhánh; không chọn → nhánh đầu.
const nhanh = [shot({ thu_tu: 1, nhanh: 'A', chu_man: 'A' }), shot({ thu_tu: 2, nhanh: 'B', chu_man: 'B' }), shot({ thu_tu: 3 })];
assert.deepStrictEqual(cacNhanh(nhanh), ['A', 'B']);
assert.deepStrictEqual(locNhanh(nhanh, 'B').map((c) => c.thu_tu), [2, 3]);
assert.deepStrictEqual(locNhanh(nhanh).map((c) => c.thu_tu), [1, 3]);
assert.deepStrictEqual(locNhanh(nhanh, 'Z').map((c) => c.thu_tu), [1, 3]);
// giayPhat / lamTronClip.
assert.strictEqual(giayPhat({ phat_s: 2.5, thoi_luong_s: 4 }), 2.5);
assert.strictEqual(giayPhat({ phat_s: null, thoi_luong_s: 6 }), 6);
assert.strictEqual(giayPhat({ phat_s: 0, thoi_luong_s: 0 }), 4);
assert.deepStrictEqual([lamTronClip(1.5), lamTronClip(4), lamTronClip(5), lamTronClip(9)], [4, 4, 6, 8]);
// giayBeat: quảng cáo 30s → 7 beat, cộng = 30, hook 0–3.
const gb = giayBeat('quang_cao', 30);
assert.strictEqual(gb.length, 7); assert.deepStrictEqual([gb[0]!.tu, gb[0]!.den], [0, 3]); assert.strictEqual(gb[gb.length - 1]!.den, 30);
// Phim không có phan → chia đều.
const gp = giayBeat('phim', 80); assert.strictEqual(gp[0]!.den, 10); assert.strictEqual(gp[gp.length - 1]!.den, 80);
console.log('kiem-qc.test: ok');

// Bám QC mẫu (09/10/2026): số shot thân phải bằng mẫu, tổng giây ±10%.
{
  const { kiemQc: kq } = await import('./kiem-qc');
  const mau = { nguon: '', video_url: '', chu_bai: '', tieu_de: '', cta: '', ghi_chu: '', shots: [{ giay: 2, loai: 'hook' as const, chu_man: 'a', hinh: '' }, { giay: 2, loai: 'cta' as const, chu_man: 'b', hinh: '' }] };
  const nvM = [{ id: 1, loai: 'san_pham' }] as never;
  const s = (thu_tu: number, phat_s: number, nhanh = '') => ({ thu_tu, nhan_vat: [1], phan_doan: '', chu_man: 'x', nhanh, phat_s, thoi_luong_s: 4, loi_thoai: '', thoai: [], trang_thai: 'nhap', keyframe_url: null }) as never;
  const qcM = { ten: 'X', link: '', diem_noi_bat: '', doi_tuong: '', uu_dai: '', thi_truong: '', anh: [], mau };
  const dat = kq({ loai: 'quang_cao', canh: [s(1, 2, 'A'), s(2, 2), s(3, 2, 'B')], nhanVat: nvM, qc: qcM, nhanh: 'A' }).find((m) => m.key === 'mau')!;
  assert.ok(dat.ok, dat.chiTiet);
  const thieu = kq({ loai: 'quang_cao', canh: [s(1, 2, 'A')], nhanVat: nvM, qc: qcM, nhanh: 'A' }).find((m) => m.key === 'mau')!;
  assert.ok(!thieu.ok && /1\/2 shot/.test(thieu.chu));
  const lech = kq({ loai: 'quang_cao', canh: [s(1, 4, 'A'), s(2, 4)], nhanVat: nvM, qc: qcM, nhanh: 'A' }).find((m) => m.key === 'mau')!;
  assert.ok(!lech.ok && /lệch/.test(lech.chiTiet ?? ''));
  assert.ok(!kq({ loai: 'quang_cao', canh: [s(1, 2, 'A')], nhanVat: nvM, qc: { ...qcM, mau: undefined }, nhanh: 'A' }).some((m) => m.key === 'mau'));
}
console.log('kiem-qc.test: mẫu ok');

// Ngôn ngữ: phim EN mà chữ màn/thoại tiếng Việt → ✗ ngon_ngu; phim vi không kiểm; chữ EN thuần → ✓.
{
  const vi = { thu_tu: 1, nhan_vat: [], phan_doan: '', chu_man: 'CHỈ $34.99', nhanh: '', phat_s: 2, thoi_luong_s: 4, loi_thoai: '', thoai: [{ nhan_vat: 'Bà Linda', dien_xuat: '', loi: 'Rẻ không tin nổi.' }], trang_thai: 'nhap', keyframe_url: null } as never;
  const en = { ...(vi as object), thu_tu: 2, chu_man: 'ONLY $34.99', thoai: [{ nhan_vat: 'Linda', dien_xuat: '', loi: 'Unbelievably cheap.' }] } as never;
  const r1 = kiemQc({ loai: 'short', canh: [vi, en], nhanVat: [], ngonNgu: 'en' });
  const m1 = r1.find((x) => x.key === 'ngon_ngu')!;
  assert.strictEqual(m1.ok, false); assert.ok(m1.chiTiet!.includes('1 shot') && m1.chiTiet!.includes('#1'), m1.chiTiet);
  assert.strictEqual(kiemQc({ loai: 'short', canh: [en], nhanVat: [], ngonNgu: 'en' }).find((x) => x.key === 'ngon_ngu')!.ok, true);
  assert.strictEqual(kiemQc({ loai: 'short', canh: [vi], nhanVat: [], ngonNgu: 'vi' }).some((x) => x.key === 'ngon_ngu'), false);
  console.log('kiem-qc.test: ngôn ngữ ok');
}
// Cổng model: phim EN mà shot còn ghi chú diễn xuất / hành động / anchor tiếng Việt → chặn; sạch → null; phim vi → không chặn.
{
  const { chanChuModel, shotLechNgonNgu } = await import('./kieu');
  const shot = { thu_tu: 3, chu_man: 'ONLY $34.99', loi_thoai: '', thoai: [{ nhan_vat: 'Linda', dien_xuat: 'cười khẽ', loi: 'So cheap.' }], hanh_dong: 'Linda holds two hangers' };
  assert.ok(chanChuModel('en', { shot })?.includes('shot #3'), 'diễn xuất tiếng Việt phải bị chặn');
  assert.ok(chanChuModel('en', { anchor: [{ ten: 'Bà Linda', mo_ta: 'woman' }] })?.includes('anchor "Bà Linda"'));
  assert.ok(chanChuModel('en', { phongCach: 'UGC dọc, màu thật' })?.includes('phong cách phim'));
  assert.equal(chanChuModel('en', { phongCach: 'Vertical UGC', shot: { ...shot, thoai: [{ nhan_vat: 'Linda', dien_xuat: 'soft laugh', loi: 'So cheap.' }] }, anchor: [{ ten: 'Linda', mo_ta: 'woman, 58' }] }), null);
  assert.equal(chanChuModel('vi', { phongCach: 'UGC dọc' }), null);
  assert.deepEqual(shotLechNgonNgu('en', [{ ...shot, thoai: [], hanh_dong: 'Ông Tom giơ quần' } as never]), [3]);   // hành động tiếng Việt cũng tính
  console.log('kiem-qc.test: cổng model ok');
}
// Cảm xúc khán giả phẳng (gần hết shot ở 0) → cờ đỏ; có đường cảm xúc → đạt (phim #5 10/10/2026: 24/25 shot = 0).
{
  const sh = (thu_tu: number, cam_xuc: number) => ({ thu_tu, nhan_vat: [], phan_doan: '', chu_man: 'x', nhanh: '', phat_s: 2, thoi_luong_s: 2, loi_thoai: '', thoai: [], trang_thai: 'nhap', keyframe_url: null, cam_xuc });
  const phang = kiemQc({ loai: 'phim', canh: [sh(1, 2), sh(2, 0), sh(3, 0)] as never, nhanVat: [] }).find((x) => x.key === 'cam_xuc');
  assert.ok(phang && !phang.ok, JSON.stringify(phang));
  const co = kiemQc({ loai: 'phim', canh: [sh(1, 2), sh(2, -1), sh(3, 0)] as never, nhanVat: [] }).find((x) => x.key === 'cam_xuc');
  assert.ok(co?.ok, JSON.stringify(co));
  console.log('kiem-qc.test: cảm xúc ok');
}

// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/khop-giong.test.mts
import assert from 'node:assert';
import { canPhat, coGianMoc, kiemTieng } from './khop-giong';
import type { Canh } from './kieu';

const c = (thoai: Canh['thoai']) => ({ thoai, loi_thoai: '', nhan_vat: [], thoai_url: null }) as never;
const dai = (u: string) => ({ a: 2.2, b: 1.1 } as Record<string, number>)[u] ?? null;
// 2,2s đọc tự nhiên + thở 0,5 = 2,7
assert.strictEqual(canPhat(c([{ nhan_vat: '', dien_xuat: '', loi: 'x', url: 'a' }]), [], dai), 2.7);
// hai dòng: 2,2 + 0,15 + 1,1 + 0,5 = 3,95 → làm tròn lên 4,0
assert.strictEqual(canPhat(c([{ nhan_vat: '', dien_xuat: '', loi: 'x', url: 'a' }, { nhan_vat: '', dien_xuat: '', loi: 'y', url: 'b' }]), [], dai), 4);
assert.strictEqual(canPhat(c([{ nhan_vat: '', dien_xuat: '', loi: 'x' }]), [], dai), null, 'chưa có giọng');
assert.strictEqual(canPhat(c([{ nhan_vat: '', dien_xuat: '', loi: 'x', url: 'zz' }]), [], dai), null, 'không đo được');
assert.strictEqual(coGianMoc('ONE NIGHT LEFT.\n@1.2 SIGN ANYWAY?', 1.5), 'ONE NIGHT LEFT.\n@1.8 SIGN ANYWAY?');
assert.strictEqual(coGianMoc('Check\n@1,4 free\n@2.4s astrolas.com', 2), 'Check\n@2.8 free\n@4.8 astrolas.com');
assert.strictEqual(canPhat(c([{ nhan_vat: '', dien_xuat: '', loi: 'x', url: 'a' }]), [], dai, 1.2), 2.4, 'phim hành động đọc 1,2×: 2,2/1,2 + 0,5 = 2,33 → 2,4');
// MÁY KIỂM TIẾNG — ca Fox Tales 13/10/2026: lời dẫn 2,66s trong shot 2,5s, Felix "Ahem" 1,04s trong shot 1,2s
const FELIX = { id: 1, phim_id: 1, loai: 'nhan_vat', ten: 'Felix', mo_ta: '', anh_ref: [], giong: '', giong_model: '', giong_id: '', giong_mau_url: null } as never;
const sh = (thu_tu: number, phat_s: number, thoai: Canh['thoai']) => ({ thu_tu, phat_s, thoi_luong_s: 4, thoai, loi_thoai: '', nhan_vat: [], hanh_dong: 'x' });
const hong = kiemTieng([sh(1, 2.5, [{ nhan_vat: '', dien_xuat: '', loi: 'Felix had a plan. A famous one.', url: 'd', dai: 2.66 }]), sh(2, 1.2, [{ nhan_vat: 'Felix', dien_xuat: '', loi: 'Ahem.', url: 'f', dai: 1.04 }]), sh(3, 3, [])], [FELIX]);
assert.ok(hong.some((x) => x.startsWith('#1: câu dẫn chưa dứt')), hong.join('|'));
assert.ok(hong.some((x) => x.startsWith('#2: shot có câu nói chỉ 1.2s')), hong.join('|'));
// sau khi khớp đúng luật mới: 2,66+0,5 → 3,2s ; Ahem 1,04+0,5 → 1,6 nhưng không dưới 2s → sạch
assert.deepStrictEqual(kiemTieng([sh(1, 3.2, [{ nhan_vat: '', dien_xuat: '', loi: 'a', url: 'd', dai: 2.66 }]), sh(2, 2, [{ nhan_vat: 'Felix', dien_xuat: '', loi: 'b', url: 'f', dai: 1.04 }]), sh(3, 3, [])], [FELIX]), []);
// chưa đo độ dài → không kêu oan
assert.deepStrictEqual(kiemTieng([sh(1, 1, [{ nhan_vat: '', dien_xuat: '', loi: 'a', url: 'd' }]), sh(2, 3, [])], [FELIX]).filter((x) => !x.includes('shot có câu nói')), []);
console.log('khop-giong.test: ok');
import { camCongCuVe } from './kieu';
assert.ok(camCongCuVe('naive wax crayon drawing on paper').includes('NO human hands'));
assert.strictEqual(camCongCuVe('cinematic 3D Pixar look'), '');

// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/khop-giong.test.mts
import assert from 'node:assert';
import { canPhat, coGianMoc } from './khop-giong';
import type { Canh } from './kieu';

const c = (thoai: Canh['thoai']) => ({ thoai, loi_thoai: '', nhan_vat: [], thoai_url: null }) as never;
const dai = (u: string) => ({ a: 2.2, b: 1.1 } as Record<string, number>)[u] ?? null;
// 2,2s ở tốc 1,1 = 2,0s + đệm 0,2 = 2,2
assert.strictEqual(canPhat(c([{ nhan_vat: '', dien_xuat: '', loi: 'x', url: 'a' }]), [], dai), 2.2);
// hai dòng: 2,0 + 0,15 + 1,0 + 0,2 = 3,35 → làm tròn lên 3,4
assert.strictEqual(canPhat(c([{ nhan_vat: '', dien_xuat: '', loi: 'x', url: 'a' }, { nhan_vat: '', dien_xuat: '', loi: 'y', url: 'b' }]), [], dai), 3.4);
assert.strictEqual(canPhat(c([{ nhan_vat: '', dien_xuat: '', loi: 'x' }]), [], dai), null, 'chưa có giọng');
assert.strictEqual(canPhat(c([{ nhan_vat: '', dien_xuat: '', loi: 'x', url: 'zz' }]), [], dai), null, 'không đo được');
assert.strictEqual(coGianMoc('ONE NIGHT LEFT.\n@1.2 SIGN ANYWAY?', 1.5), 'ONE NIGHT LEFT.\n@1.8 SIGN ANYWAY?');
assert.strictEqual(coGianMoc('Check\n@1,4 free\n@2.4s astrolas.com', 2), 'Check\n@2.8 free\n@4.8 astrolas.com');
console.log('khop-giong.test: ok');

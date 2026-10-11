// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/phu-thuoc.test.mts
import assert from 'node:assert';
import { phuThuocShot } from './phu-thuoc';
import type { Canh, NhanVat } from './kieu';

const shot = (p: Partial<Canh>): Canh => ({ id: 1, tap_id: 1, thu_tu: 1, canh: '', prompt_anh: 'a man', prompt_video: '', nhan_vat: [], bien_the: [], thoai: [], loi_thoai: '', thoai_url: null,
  keyframe_url: null, keyframe_uv: [], video_url: null, video_cuoi_url: null, trang_thai: 'nhap', ...p } as unknown as Canh);
const sp = { id: 9, ten: 'Quần', loai: 'san_pham', mo_ta: 'quần', anh_ref: [], bien_the: [] } as unknown as NhanVat;

// keyframe: thiếu prompt + sản phẩm chưa có ảnh gốc → chặn; có keyframe sẵn → lưu ý; clip shot trước dùng nó làm khung cuối → lưu ý.
let k = phuThuocShot('keyframe', shot({ prompt_anh: '', nhan_vat: [9] }), [sp], { noiKhung: true });
assert.deepStrictEqual(k.chan, ['chưa có prompt ảnh', 'Quần: chưa có ảnh gốc']);
k = phuThuocShot('keyframe', shot({ thu_tu: 2, keyframe_url: 'k' }), [], { noiKhung: true, truoc: shot({ thu_tu: 1, video_url: 'v' }) });
assert.strictEqual(k.chan.length, 0);
assert.ok(k.luu_y.some((x) => x.includes('clip shot #1')) && k.luu_y.some((x) => x.includes('dải ứng viên')));
assert.ok(!phuThuocShot('keyframe', shot({ thu_tu: 2 }), [], { noiKhung: false, truoc: shot({ video_url: 'v' }) }).luu_y.length, 'tắt nối khung → không cảnh báo');

// video: chưa có keyframe / chưa duyệt → chặn; shot sau chưa keyframe khi nối khung → lưu ý; thoại chưa có giọng → lưu ý.
assert.deepStrictEqual(phuThuocShot('video', shot({}), [], { noiKhung: false }).chan, ['chưa có keyframe']);
assert.deepStrictEqual(phuThuocShot('video', shot({ keyframe_url: 'k' }), [], { noiKhung: false }).chan, ['chưa duyệt keyframe']);
const v = phuThuocShot('video', shot({ keyframe_url: 'k', trang_thai: 'duyet', thoai: [{ nhan_vat: '', dien_xuat: '', loi: 'hi' }] }), [], { noiKhung: true, ke: shot({ thu_tu: 2 }) });
assert.strictEqual(v.chan.length, 0);
assert.ok(v.luu_y.some((x) => x.includes('shot #2 chưa có keyframe')) && v.luu_y.some((x) => x.includes('chưa sinh giọng')), v.luu_y.join('|'));
assert.ok(!phuThuocShot('video', shot({ keyframe_url: 'k', trang_thai: 'duyet', thoai: [{ nhan_vat: '', dien_xuat: '', loi: 'hi', url: 'g' }] }), [], { noiKhung: false }).luu_y.length);
console.log('phu-thuoc.test: ok');
{
  const { khacCauLenh } = await import('./phu-thuoc');
  assert.deepStrictEqual(khacCauLenh('A man stands. He smiles. No text.', 'A man stands. He laughs! No text.'), { them: ['He laughs!'], bot: ['He smiles.'] });
  assert.deepStrictEqual(khacCauLenh('Same.', 'Same.'), { them: [], bot: [] });
  console.log('phu-thuoc.test: khác câu lệnh ok');
}

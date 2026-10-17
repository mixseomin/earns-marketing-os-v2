// Tự kiểm thẻ liên kết đồ vật: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/the-vat.test.mts
import assert from 'node:assert';
import { dienThe, goiThe, theTrong } from './prompt-khoi';
const goi = goiThe([{ ten: 'Lâm Hạ', loai: 'nhan_vat' }, { ten: 'Thùng đồ cá nhân', loai: 'dao_cu', mo_ta: 'Plain brown cardboard office box: a small succulent' }], [{ ten: 'Màn trình chiếu', en: 'large presentation screen, wall-mounted' }]);
assert.equal(dienThe("Over {Lâm Hạ}'s shoulder ({Thùng đồ cá nhân} edge in foreground) toward the {Màn trình chiếu}", goi), "Over Lâm Hạ's shoulder (plain brown cardboard office box edge in foreground) toward the large presentation screen");
assert.equal(dienThe('holding the {Không có}', goi), 'holding the {Không có}');   // tên sai: giữ nguyên để bộ chấm chặn
assert.deepEqual(theTrong('{A} và {B}'), ['A', 'B']);
console.log('the-vat: ok');

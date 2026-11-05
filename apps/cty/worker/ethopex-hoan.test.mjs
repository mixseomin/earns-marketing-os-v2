// Sổ hoãn ROAS / NB hết hạn khi bản luật đổi (05/11/2026: bỏ luật trùng phim mà 3 gốc vẫn bị giữ tới hết ngày). Chạy: MOS2_DIR=$PWD node apps/cty/worker/ethopex-hoan.test.mjs
import assert from 'node:assert';
const { hoanHopLe, banLuat, dichCua } = await import('./ethopex.mjs');
const ban = banLuat(), ngay = '2026-11-05';
assert.notStrictEqual(ban, '0-0', 'banLuat phải đọc được mtime nhan-ban.py + cong.py (đặt MOS2_DIR = gốc repo)');
assert.strictEqual(hoanHopLe({ ngay, ban, giu: {} }, ngay), true, 'cùng ngày + cùng bản luật → dùng sổ hoãn');
assert.strictEqual(hoanHopLe({ ngay, ban: ban + 'x', giu: {} }, ngay), false, 'bản luật đổi → bỏ sổ hoãn');
assert.strictEqual(hoanHopLe({ ngay, giu: {} }, ngay), false, 'sổ cũ chưa ghi bản luật → bỏ (xét lại)');
assert.strictEqual(hoanHopLe({ ngay: '2026-11-04', ban, giu: {} }, ngay), false, 'sang ngày → bỏ');
assert.strictEqual(hoanHopLe(null, ngay), false);
// mức đích = dấu '→ $N' cuối câu (21:22 05/11/2026: G10 hồi '→ $10 → $30' bị gửi $10)
assert.strictEqual(dichCua({ chu: 'hạ về $10 ngày 02/11 · ROI +53% ≥ 30% → $10 → $30 (luật G10 hồi)' }), '30');
assert.strictEqual(dichCua({ chu: '#80315 · $1 → $3 · spending hôm nay 110%' }), '3');
assert.strictEqual(dichCua({ chu: 'ROI -11% · $15 → $1 (luật H2)' }), '1');
assert.strictEqual(dichCua({ chu: '→ TẮT (luật G10)' }), undefined);
console.log('ethopex-hoan: đạt');

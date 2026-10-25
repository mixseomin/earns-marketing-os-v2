// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/cum-shot.test.mts
import assert from 'node:assert';
import { chiaCum, lichCum, vaoTuCatThat, DUNG_DUOC, VAO_DAU } from './cum-shot';

// Cảnh Thang máy phim #353: giây phát 17 shot thật → 6 cụm theo nhịp (đến · giật thẻ · thang mở · đối đáp · quay đi · vào thang)
const phat = [1.5, 1.5, 2, 1.5, 1.5, 1, 2, 1, 1.5, 1.5, 2, 3, 1.5, 4.7, 5, 1.5, 3];
const ds = phat.map((p, i) => ({ id: i + 1, thu_tu: i + 1, phan_doan: 'Thang máy', phat_s: p, thoi_luong_s: 4 }));
assert.deepStrictEqual(chiaCum(ds).map((c) => c.map((x) => x.thu_tu)), [[1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12], [13, 14], [15, 16], [17]]);
for (const c of chiaCum(ds)) assert.ok(c.reduce((s, x) => s + x.phat_s, 0) <= DUNG_DUOC + 1e-6 || c.length === 1);
// đổi phân cảnh = cụm mới dù còn chỗ
assert.deepStrictEqual(chiaCum([...ds.slice(0, 2), { ...ds[2]!, phan_doan: 'Sảnh' }]).map((c) => c.length), [2, 1]);
// shot dài hơn trần đứng riêng, không làm rỗng cụm
assert.deepStrictEqual(chiaCum([{ ...ds[0]!, phat_s: 9 }, ds[1]!]).map((c) => c.length), [1, 1]);
assert.deepStrictEqual(chiaCum([]), []);

// lịch: bắt đầu ở VAO_DAU, liền nhau, mỗi đoạn ≥ giây phát, phủ đúng phần dùng được
const l = lichCum(ds.slice(4, 9));
assert.strictEqual(l[0]!.tu, VAO_DAU);
l.forEach((x, i) => { if (i) assert.strictEqual(x.tu, l[i - 1]!.den); assert.ok(x.den - x.tu >= phat[4 + i]! - 1e-6); });
assert.ok(Math.abs(l.at(-1)!.den - (VAO_DAU + DUNG_DUOC)) < 0.02);

// điểm cắt đo đủ → dùng điểm đo; thiếu → theo lịch, báo theoDo=false
const cum = ds.slice(4, 9);
const d = vaoTuCatThat(cum, [1.6, 2.7, 4.8, 5.9]);
assert.ok(d.theoDo); assert.deepStrictEqual(d.vao, [0.2, 1.65, 2.75, 4.85, 5.95]); assert.deepStrictEqual(d.ngan, []);
const t = vaoTuCatThat(cum, [3.1]);
assert.ok(!t.theoDo); assert.deepStrictEqual(t.vao, lichCum(cum).map((x) => x.tu));
// đoạn đo ngắn hơn giây phát → báo shot đó (bản dựng sẽ lấn sang góc kế)
assert.deepStrictEqual(vaoTuCatThat(cum, [0.6, 2.7, 4.8, 5.9]).ngan, [5]);
// neo người — người của shot cảnh Thang máy (H Hạ, V Vivian, T Thần, X người lạ) + shot có khung kết
const nguoi = [['H'], ['H'], ['V', 'H'], ['V'], ['V', 'H'], ['V', 'H'], ['V', 'H'], ['H'], ['V'], ['V'], ['T', 'H', 'V', 'X'], ['T'], ['H'], ['V'], ['H'], ['V'], ['H']];
const ket = [0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1];
const neo = { nguoi: (c: { thu_tu: number }) => nguoi[c.thu_tu - 1]!, coKet: (c: { thu_tu: number }) => !!ket[c.thu_tu - 1] };
const cn = chiaCum(ds, DUNG_DUOC, neo).map((c) => c.map((x) => x.thu_tu));
assert.deepStrictEqual(cn, [[1, 2, 3], [4, 5, 6, 7, 8], [9, 10, 11], [12, 13], [14], [15], [16, 17]]);
// mọi cụm nhiều shot: người của cụm ⊆ người shot đầu ∪ người shot cuối có khung kết
for (const c of cn.filter((x) => x.length > 1)) { const co = new Set([...nguoi[c[0]! - 1]!, ...(ket[c.at(-1)! - 1] ? nguoi[c.at(-1)! - 1]! : [])]); assert.ok(c.every((t) => nguoi[t - 1]!.every((x) => co.has(x))), String(c)); }
// phá thử: cụm cũ #1–#4 (Vivian chỉ ở #3, #4 không khung kết) phải bị tách
assert.ok(!cn.some((c) => c.includes(1) && c.includes(4)));
console.log('✓ cum-shot');

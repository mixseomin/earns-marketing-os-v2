// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/cum-shot.test.mts
import assert from 'node:assert';
import { giuNguyenVan } from './prompt-khoi';
import { chiaCumCan, cauNgoaiCua, chiaCum, lichCum, vaoTuCatThat, vaoLienMach, thamChieuCum, promptCumMoi, giayClipSeedance, kepVaoDoan, DUNG_DUOC, VAO_DAU } from './cum-shot';
import { lienCon, noiKhungShot } from './kieu';

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
// ảnh tham chiếu: biến thể của shot thắng ảnh mẫu; mỗi người một ảnh danh tính trước; bối cảnh = khung shot rộng nhất, luôn giữ một ô
const nv = (id: number, ten: string, bt: { id: number; anh_url: string }[], ref: string[]) => ({ id, ten, loai: 'nhan_vat', bien_the: bt, anh_ref: ref, anh_mat: null }) as never;
const ha = nv(1, 'Lâm Hạ', [{ id: 160, anh_url: 'ha-khong-the' }, { id: 150, anh_url: 'ha-co-the' }], ['ha-mau']);
const vi = nv(2, 'Vivian', [], ['vi-mau', 'vi-phu']);
const shot = (kf: string, co: string, bienThe: number[], ds: unknown[]) => ({ canh: { keyframe_url: kf, ky_thuat: { co_canh: co }, bien_the: bienThe, nhan_vat: (ds as { id: number }[]).map((v) => v.id) } as never, nhanVat: ds as never });
const t1 = thamChieuCum([shot('kf-cu', 'cu', [160], [ha]), shot('kf-ws', 'ws', [], [vi, ha])]);
assert.deepStrictEqual(t1.anh, ['ha-khong-the', 'vi-mau', 'ha-mau', 'vi-phu', 'kf-ws']);
assert.ok(!/Lâm Hạ|Vivian/.test(t1.goi) && t1.goi.startsWith('Reference image 1 is a character sheet; Reference image 2 is a character sheet') && t1.goi.endsWith('the location (lighting, set, colours)'));
assert.deepStrictEqual(thamChieuCum([shot('kf-cu', 'cu', [160], [ha]), shot('kf-ws', 'ws', [], [vi])], 3).anh, ['ha-khong-the', 'vi-mau', 'kf-ws']);
// nhãn ảnh: tên → 'reference image N' (ảnh danh tính đầu), ảnh cuối là bối cảnh
assert.deepStrictEqual(t1.tag, { 'Lâm Hạ': 'reference image 1', Vivian: 'reference image 2' }); assert.ok(t1.them.startsWith(`Reference image ${t1.anh.length} is the location`));
// cú máy liền: shot nối tiếp nhau (#5–#9: 1,5 · 1 · 2 · 1 · 1,5 giây)
assert.deepStrictEqual(vaoLienMach(ds.slice(4, 9)), [0.2, 1.7, 2.7, 4.7, 5.7]);

// PROMPT KIỂU MỚI: #2 (cu) · #2.9 con của #2 (mcu) · #3.1 con của #3 cùng máy ws · #3 (ws). Người: Lâm Hạ (áo sơ mi lụa trắng) — không được gọi tên
const nvHa = { id: 1, ten: 'Lâm Hạ', loai: 'nhan_vat', mo_ta: 'cô gái 24 tuổi, tóc đen dài' };
const look = new Map([['Lâm Hạ', { trang_phuc: [{ mo_ta: 'white silk blouse, black trousers' }] }]]) as never;
const ps = (id: number, so: number, xep: number, co: string, dien: string, con_cua: number | null = null, thoai: { nhan_vat: string; loi: string; dien_xuat: string }[] = [], phat_s = 1) => ({
  canh: { id, thu_tu: so, thu_tu_phat: xep, con_cua, phat_s, ky_thuat: { co_canh: co }, canh: '', thoai, nhan_vat: [1], loi_thoai: '', dan_dung: { dien: `${dien}. OBJECT STATE in this frame: box hugged` } } as never, nhanVat: [nvHa] as never, look });
const bon = [ps(2, 2, 2, 'cu', 'Hạ hears heels and starts turning her head. Static camera', null, [], 1.5), ps(29, 2.9, 2.04, 'mcu', 'Continuing, Hạ keeps turning toward the entrance. Static camera', 2, [], 0.5),
  ps(31, 3.1, 2.51, 'ws', 'Lâm Hạ finishes the turn', 3, [], 0.5), ps(3, 3, 3, 'ws', 'Vivian strides in', null, [], 2.5)];
// mặc định GỘP shot con → 2 góc; tên → nhãn nhìn thấy; câu máy một lần; bỏ "Continuing," thừa; không khối trạng thái / mốc giây "0:00–0:02"
// THỜI LƯỢNG: mỗi shot "(about N s)" = giây phát shot cha + shot con gộp vào; tổng ở câu mở
const p2 = promptCumMoi(bon);
assert.ok(p2.startsWith('A 5-second, 2-shot') && !/OBJECT STATE|\d:\d\d|Hạ/.test(p2), p2);
assert.ok(p2.includes('Throughout: the woman in the white silk blouse keep'), p2);
assert.ok(p2.includes('Shot 1 (about 2 s): Close-up, static camera — the woman in the blouse hears heels and starts turning her head; then the woman in the blouse keeps turning toward the entrance'), p2);
assert.ok(p2.includes('Shot 2 (about 3 s): Wide shot — the woman in the blouse finishes the turn; then Vivian strides in') && p2.endsWith('no on-screen text, captions, logo or watermark.'), p2);
// không gộp: 4 góc; #2 → #2.9 và #3.1 → #3 = liền khung (cuối trước là đầu sau, kể cả đổi cỡ cảnh), #2.9 → #3.1 = cắt thật; nhãn ảnh ở câu định nghĩa
const p4 = promptCumMoi(bon, { gopCon: false, tag: { 'Lâm Hạ': '@image1' } });
assert.ok(p4.startsWith('A 5-second, 4-shot') && p4.includes('Shot 2 (about 0.5 s)') && p4.includes('Shot 2 (about 0.5 s): Medium close-up, continuous from the last frame') && p4.includes('Shot 4 (about 2.5 s): Wide shot, continuous from the last frame') && !/Shot 3[^:]*: Wide shot, continuous/.test(p4) && p4.includes('white silk blouse (@image1)'), p4);
// thoại: "says:" không ngoặc kép (Google: ngoặc kép → chữ trên hình)
const pt = promptCumMoi([ps(5, 5, 5, 'mcu', 'Hạ looks up', null, [{ nhan_vat: 'Lâm Hạ', loi: '"Chị cần gì?"', dien_xuat: '' }])]);
assert.ok(pt.includes('the woman in the blouse says: Chị cần gì?') && !pt.includes('"'), pt);
// NGUYÊN VĂN thoại: nhân vật tên "Chú" nói câu bắt đầu bằng "Chú" — người nói đổi sang nhãn, chữ trong câu giữ nguyên (15/11/2026 #3071 #6)
const nvChu = { id: 1, ten: 'Chú', loai: 'nhan_vat', mo_ta: 'người đàn ông 30 tuổi' };
const pc = promptCumMoi([{ ...ps(6, 6, 6, 'cu', 'Chú holds out a note', null, [{ nhan_vat: 'Chú', loi: 'Chú cho cháu 5k.', dien_xuat: '' }]), nhanVat: [nvChu] as never, look: null }]);
assert.ok(pc.includes('says: Chú cho cháu 5k.') && pc.split('Chú').length - 1 === 1, pc);
// giuNguyenVan: đổi tên chỉ chạy ngoài câu nguyên văn; hai câu, câu dài che trước; không có câu nào thì đổi như thường
assert.strictEqual(giuNguyenVan('Chú says: Chú cho cháu 5k. Chú smiles', ['Chú cho cháu 5k.'], (s) => s.replace(/Chú/g, 'the man')), 'the man says: Chú cho cháu 5k. the man smiles');
assert.strictEqual(giuNguyenVan('Chú: Chú ơi; Chú ơi, lại đây', ['Chú ơi', 'Chú ơi, lại đây'], (s) => s.replace(/Chú/g, 'X')), 'X: Chú ơi; Chú ơi, lại đây');
assert.strictEqual(giuNguyenVan('Chú smiles', [], (s) => s.replace(/Chú/g, 'X')), 'X smiles');
// phá thử: shot con mà cha KHÔNG có trong cụm → đứng riêng, không mất
assert.ok(promptCumMoi(bon.slice(1, 3)).startsWith('A 1-second, 2-shot'));
// giãn cho đầy clip model sinh (VideoExpress ~6 s): 5 s → 6 s, tỉ lệ giữ nguyên (2 s : 3 s → 2.5 : 3.5 làm tròn 0,5)
const p6 = promptCumMoi(bon, { giay: 6 });
assert.ok(p6.startsWith('A 6-second, 2-shot') && p6.includes('Shot 1 (about 2.5 s)') && p6.includes('Shot 2 (about 3.5 s)'), p6);
// SHOT CON LIỀN KHUNG (anh 01/11/2026): cuối #2 = đầu #2.9, cuối #3.1 = đầu #3; #2.9 → #3.1 là cắt; #2 → #3 không liền
assert.ok(lienCon(2, 2.9) && lienCon(3.1, 3) && !lienCon(2.9, 3.1) && !lienCon(2, 3) && !lienCon(3, 3));
assert.ok(noiKhungShot(false, { thu_tu: 2 }, { thu_tu: 2.9 }) && noiKhungShot(false, { thu_tu: 3.1 }, { thu_tu: 3 }) && !noiKhungShot(false, { thu_tu: 2.9 }, { thu_tu: 3.1 }));
// tập bật nối khung cả tập: #2.9 → #3.1 vẫn là cắt; shot thường #4 → #5 vẫn nối; shot tự chọn 'lien_may' thì nối
assert.ok(!noiKhungShot(true, { thu_tu: 2.9 }, { thu_tu: 3.1 }) && noiKhungShot(true, { thu_tu: 4 }, { thu_tu: 5 }) && noiKhungShot(true, { thu_tu: 2.9, ky_thuat: { chuyen_canh: 'lien_may' } }, { thu_tu: 3.1 }));
console.log('✓ cum-shot');

// chiaCumCan (14/11/2026 #3071): cảnh 1 = 10 shot 18,9 s → 2 cụm cân 9,8 + 9,1 (tham ra 14,7 + 4,2); shot > trần đứng riêng; đổi phân cảnh = cụm mới
{ const mk = (thu_tu: number, phat_s: number, phan_doan: string) => ({ id: thu_tu, thu_tu, phan_doan, phat_s, thoi_luong_s: 6 }) as never;
  const g1 = [2, 1.2, 1.2, 2, 1.4, 2, 1.6, 3.3, 2.2, 2].map((p, i) => mk(i + 1, p, 'A'));
  const g2 = [1.2, 1.2, 1.53, 3.5, 4, 5.2].map((p, i) => mk(i + 11, p, 'B'));
  const c = chiaCumCan([...g1, ...g2, mk(17, 20, 'C')], 15).map((x) => x.map((y: { thu_tu: number }) => y.thu_tu));
  assert.deepStrictEqual(c, [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10], [11, 12, 13, 14], [15, 16], [17]], JSON.stringify(c)); }
console.log('✓ cum-shot chiaCumCan');

// cauNgoaiCua: người sau ô cửa → câu giữ máy ngoài toa; không ai sau cửa → rỗng (phá thử: bỏ o_dau thì phải rỗng)
{ const sh = (o?: string) => ({ may_3d: { vi_tri: [{ ten: 'Chú', o_dau: o }] } }) as never;
  assert.ok(cauNgoaiCua([sh('inside the train carriage, behind the open passenger window')]).startsWith('In this shot, the camera stays OUTSIDE'));
  assert.ok(cauNgoaiCua([sh(), sh('behind the open passenger window')]).startsWith('In shot 2,'));
  assert.strictEqual(cauNgoaiCua([sh('standing on the platform')]), ''); }
// giây clip Seedance (một nguồn cho báo giá + lượt gửi, 15/11/2026): cụm C #11–15 (shot cuối có thoại) 11,43 s → 14; cụm E (thoại ở shot giữa) 9,6 s → 10, không đuôi;
// shot lẻ #10 2 s → ⌈2⌉ + 2 = 4; #8 3,3 s → 6; clip lẻ có đoạn dư đầu 1,65 s → 6; trần 15
assert.strictEqual(giayClipSeedance([1.5, 1.5, 1.43, 3.5, 3.5], { cuoiCoThoai: true }), 14);
assert.strictEqual(giayClipSeedance([1.5, 2, 3, 3.1]), 10);
assert.strictEqual(giayClipSeedance([2], { cuoiCoThoai: true }), 4);
assert.strictEqual(giayClipSeedance([3.3], { cuoiCoThoai: true }), 6);
assert.strictEqual(giayClipSeedance([2], { vaoDau: 1.65, cuoiCoThoai: true }), 6);
assert.strictEqual(giayClipSeedance([14.5], { cuoiCoThoai: true }), 15);
assert.strictEqual(giayClipSeedance([4]), 4);
// kẹp điểm vào trong đoạn (ca thật #2 phim #3071: vào 0,2, phát 1,2, đoạn 0–1,25 → 0,05); đoạn ngắn hơn giây dùng → null
assert.strictEqual(kepVaoDoan(0.2, [0, 1.25], 1.2), 0.05);
assert.strictEqual(kepVaoDoan(0.5, [0.4, 3], 1.2), 0.5);
assert.strictEqual(kepVaoDoan(0.2, [0.3, 1.2], 1.2), null);
// câu hành động cụm = mở → diễn → kết + hướng màn (ca thật #2: trước chỉ còn "scan, then a sudden stop")
{ const nv2 = { id: 1, ten: 'Chú', loai: 'nhan_vat', mo_ta: 'a man' };
  const p2 = promptCumMoi([{ canh: { id: 2, thu_tu: 2, phat_s: 1.2, ky_thuat: { co_canh: 'mcu' }, canh: '', thoai: [], nhan_vat: [1], loi_thoai: '', bien_the: [],
    dan_dung: { mo: 'man looking down the platform to the left; the train stands still at the platform, not moving', dien: 'scan, then a sudden stop',
      ket: 'head stopped facing screen right, eyes fixed on the boy; the train stands still at the platform, not moving', huong: 'head turns left to right, ends facing screen right' } } as never, nhanVat: [nv2] as never }]);
  assert.ok(p2.includes('looking down the platform to the left') && p2.includes('scan, then a sudden stop') && p2.includes('facing screen right, eyes fixed on the boy') && p2.includes('screen direction: head turns left to right'), p2);
  assert.strictEqual(p2.split('the train stands still at the platform').length - 1, 1, 'mệnh đề trùng giữa mở và kết chỉ ghi một lần'); }
// cắt thừa ở đuôi (ca thật cụm #2–#4 job 8369: phát 1,2 / 1,2 / 2, cú cắt 1,21 · 4,38 · 5,54, clip 7,1 s) → hai cú đầu là ranh giới, shot cuối dừng ở 5,49;
// cú thừa nằm giữa (trước tổng giây phát) → không đo
{ const c3 = [1.2, 1.2, 2].map((p, i) => ({ id: i, thu_tu: i + 2, phat_s: p, thoi_luong_s: 4 })) as never[];
  const r = vaoTuCatThat(c3, [1.21, 4.38, 5.54], 7.1); assert.ok(r.theoDo && r.het === 5.49 && r.vao[1] === 1.26 && r.vao[2] === 4.43, JSON.stringify(r));
  assert.ok(!vaoTuCatThat(c3, [0.6, 1.21, 2.5], 7.1).theoDo, 'cú thừa giữa cụm → không đo'); }
console.log('✓ cum-shot cauNgoaiCua');

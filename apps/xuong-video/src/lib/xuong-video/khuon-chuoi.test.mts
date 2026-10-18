import assert from 'node:assert';
import { KHUON_CHUOI, QUY_CHUAN_DONG, kiemKhuon, xepHang, khuonTheoKey } from './khuon-chuoi';
import { THU_VIEN, THE_LOAI } from './dien-anh';
import { LUAT_DUNG_CANH } from './luat-dung';

// Mọi vai / luật / thể loại khuôn nhắc tới phải có thật trong thư viện (đổi tên ở thư viện là test đỏ, không lệch im lặng).
const vai = new Set(THU_VIEN.filter((k) => k.nhom === 'vai').map((k) => k.key));
const luat = new Set(LUAT_DUNG_CANH.map((l) => l.key));
const tl = new Set(THE_LOAI.map((t) => t.key));
for (const k of KHUON_CHUOI) {
  for (const b of k.buoc) {
    for (const v of b.vai) assert.ok(vai.has(v), `${k.key}/${b.ten}: vai lạ ${v}`);
    for (const l of b.luat ?? []) assert.ok(luat.has(l), `${k.key}/${b.ten}: luật lạ ${l}`);
  }
  if (k.the_loai !== 'tat_ca') for (const t of k.the_loai) assert.ok(tl.has(t), `${k.key}: thể loại lạ ${t}`);
  assert.ok(k.nguon.length > 0, `${k.key}: khuôn phải có nguồn`);
}
for (const [t, q] of Object.entries(QUY_CHUAN_DONG)) { assert.ok(tl.has(t as never)); for (const k of q!.khuon) assert.ok(khuonTheoKey(k), `${t}: khuôn lạ ${k}`); }

// kiemKhuon: đúng vai → tốt; sai vai → đỏ; thiếu bước "nên" → vàng; lùi bước → đỏ
const s = (id: number, v: string, l: string[] = []) => ({ id, thu_tu: id, ky_thuat: { vai: v, luat: l } });
const va = { khuon: 'va_mat', shots: { 1: 0, 2: 1, 3: 2, 4: 4 } };
const ok = kiemKhuon(va, [s(1, 'thiet_lap'), s(2, 'hanh_dong', ['gioi_thieu']), s(3, 'nguoi_thu_ba', ['gia_tri_doi']), s(4, 'hanh_dong')], 'phim_doc')!;
assert.strictEqual(ok.shots.every((x) => x.muc === 'tot'), true);
assert.strictEqual(ok.muc, 'vang', 'thiếu "Mặt kẻ thua" (nen) → vàng');
assert.ok(ok.loi.some((l) => l.includes('Mặt kẻ thua')));
const sai = kiemKhuon(va, [s(1, 'chi_tiet'), s(2, 'hanh_dong', ['gioi_thieu']), s(3, 'nguoi_thu_ba', ['gia_tri_doi']), s(4, 'hanh_dong')], 'phim_doc')!;
assert.strictEqual(sai.shots[0]!.muc, 'do');
const lui = kiemKhuon({ khuon: 'phat_hien', shots: { 1: 2, 2: 0 } }, [s(1, 'phan_ung', ['giu_phan_ung']), s(2, 'phan_ung')])!;
assert.strictEqual(lui.shots[1]!.muc, 'do', 'bước lùi');
assert.strictEqual(lui.loi.some((l) => l.includes('Vật / điều lạ')), true, 'thiếu bước bắt buộc');
assert.ok(kiemKhuon({ khuon: 'truoc_sau', shots: { 1: 0 } }, [s(1, 'hanh_dong')], 'phim_doc')!.loi.some((l) => l.includes('dòng phim')));
assert.strictEqual(kiemKhuon({ khuon: 'khong_co', shots: {} }, []), null);
// xepHang: khuôn chồng khoảng → hàng riêng
const a = kiemKhuon({ khuon: 'gai_bi_mat', shots: { 2: 0, 9: 1 } }, [s(2, 'chi_tiet', ['motif']), s(9, 'chi_tiet', ['chenh_thong_tin'])])!;
const b = kiemKhuon({ khuon: 'phat_hien', shots: { 4: 0, 5: 1, 6: 2 } }, [s(4, 'phan_ung'), s(5, 'chi_tiet'), s(6, 'phan_ung')])!;
const c = kiemKhuon({ khuon: 'ket_treo', shots: { 10: 0, 11: 1, 12: 2 } }, [s(10, 'hanh_dong'), s(11, 'phan_ung'), s(12, 'chi_tiet')])!;
const tt = new Map([2, 4, 5, 6, 9, 10, 11, 12].map((x) => [x, x]));
assert.deepStrictEqual(xepHang([a, b, c], tt).map((h) => h.map((k) => k.kh.key)), [['gai_bi_mat', 'ket_treo'], ['phat_hien']]);
// thiếu mã luật chỉ là gợi ý, không đổi màu
const khongLuat = kiemKhuon(va, [s(1, 'thiet_lap'), s(2, 'hanh_dong'), s(3, 'nguoi_thu_ba'), s(4, 'hanh_dong')], 'phim_doc')!;
assert.ok(khongLuat.shots.every((x) => x.muc === 'tot') && khongLuat.shots[1]!.goiY.length === 1);
// shot gánh nhiều bước → vàng + lời gợi tách, không tính sai vai
const gop = kiemKhuon({ khuon: 'phat_hien', shots: { 1: [0, 1, 2] } }, [s(1, 'phan_ung')])!;
assert.strictEqual(gop.shots[0]!.muc, 'vang'); assert.ok(gop.shots[0]!.loi[0]!.includes('tách thành 3 shot'));
assert.deepStrictEqual(gop.shots[0]!.buocs, [0, 1, 2]);
// bước thiếu đứng đúng chỗ: sau shot cuối có bước nhỏ hơn
const th = kiemKhuon(va, [s(1, 'thiet_lap'), s(2, 'hanh_dong', ['gioi_thieu']), s(3, 'nguoi_thu_ba', ['gia_tri_doi']), s(4, 'hanh_dong')], 'phim_doc')!;
assert.deepStrictEqual(th.thieu.map((t) => [t.ten, t.sau]), [['Mặt kẻ thua', 4]]);
const thDau = kiemKhuon({ khuon: 'phat_hien', shots: { 5: 1, 6: 2 } }, [s(5, 'chi_tiet'), s(6, 'phan_ung')])!;
assert.deepStrictEqual(thDau.thieu.map((t) => [t.buoc, t.sau]), [[0, null]], 'bước đầu thiếu → đứng trước shot đầu');
console.log(`✓ khuon-chuoi (${KHUON_CHUOI.length} khuôn)`);

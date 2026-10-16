// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/concept.test.mts
import assert from 'node:assert';
import { oChuTuKhung, oHinhCua, gtBienThe, toHopCap, trongVong, khacGoc, tienCapCents, tienDungRiengCents, duKienCap, maToHop, hopKhuon, PA_DU_KIEN, type TplConcept, type Concept, type BienTheHinh, type PhuongAn } from './concept';

// ô chữ: theo thứ tự shot, bỏ ô sản phẩm / ảnh / _hinh; ô nhóm nhân vật vẫn là chữ khi nằm trong chữ màn (nguoi_gioi_thieu)
const o = [{ k: 'san_pham', ten: 'Sản phẩm' }, { k: 'noi_dau', ten: 'Nỗi đau' }, { k: 'tinh_huong', ten: 'Tình huống' }, { k: 'noi_dau_hinh', ten: 'Hình nỗi đau' },
  { k: 'nguoi_gioi_thieu', ten: 'Người giới thiệu' }, { k: 'nhan_vat_hinh', ten: 'Hình nhân vật' }, { k: 'boi_canh', ten: 'Bối cảnh' }, { k: 'khong_dung', ten: 'x' }];
const khung = [{ loai: 'hook', giay: 2, chu: '{{tinh_huong}}…' }, { loai: 'noi_dau', giay: 3, chu: '{{noi_dau}}' }, { loai: 'giai_phap', giay: 3, chu: '{{nguoi_gioi_thieu}}' }, { loai: 'end_card', giay: 2, chu: '{{san_pham}}' }];
const oc = oChuTuKhung(o, khung);
assert.deepStrictEqual(oc.map((x) => x.k), ['tinh_huong', 'noi_dau', 'nguoi_gioi_thieu']);
assert.strictEqual(oc[0]!.loai, 'hook');
assert.deepStrictEqual(oHinhCua(o, oc), ['noi_dau_hinh', 'nhan_vat_hinh', 'boi_canh']);

// biến thể → ô; '—' và rỗng không ghi
assert.deepStrictEqual(gtBienThe({ nguoi_chinh: 'man, Black, 40s', nguoi_phu: '—', boi_canh: 'supermarket' }, ['nhan_vat_hinh', 'nguoi_2_hinh', 'boi_canh', 'boi_canh_2']),
  { nhan_vat_hinh: 'man, Black, 40s', boi_canh: 'supermarket' });

const t: TplConcept = { id: 22, ten: 'Kể chuyện', dong: 'ugc', khuon: 'ke_chuyen', so_shot: 12, giay: 35, shot_nguoi: 9, shot_boi: 12, shot_ca: 12, o_chu: oc, o_hinh: [] };
const c = { id: 1, ma: '1A', path: 'P1', path_ten: '', nb: 'PA', ten: 'Đùi to', du_lieu: {} } as unknown as Concept;
const bt: BienTheHinh[] = [{ id: 10, cap_id: 5, so: 1, nguoi_chinh: 'a', nguoi_phu: '', boi_canh: 'nhà', goc: true }, { id: 11, cap_id: 5, so: 2, nguoi_chinh: 'b', nguoi_phu: '', boi_canh: 'siêu thị', goc: false }];
const pa: PhuongAn[] = [
  ...[1, 2, 3].map((so) => ({ id: so, cap_id: 5, o: 'tinh_huong', so, chu: `H${so}`, nguon: '' })),
  ...[1, 2].map((so) => ({ id: 10 + so, cap_id: 5, o: 'noi_dau', so, chu: `N${so}`, nguon: '' })),
];
// thiếu phương án một ô → chưa ghép được, báo đúng ô
const k0 = toHopCap(c, t, { id: 5, concept_id: 1, template_id: 22, bat: true }, bt, pa);
assert.strictEqual(k0.ds.length, 0); assert.deepStrictEqual(k0.thieu.map((x) => x.k), ['nguoi_gioi_thieu']);
const pa2 = [...pa, { id: 30, cap_id: 5, o: 'nguoi_gioi_thieu', so: 1, chu: 'G1', nguon: '' }];
const k = toHopCap(c, t, { id: 5, concept_id: 1, template_id: 22, bat: true }, bt, pa2);
assert.strictEqual(k.ds.length, 2 * 3 * 2 * 1);
assert.strictEqual(new Set(k.ds.map((x) => x.ma)).size, k.ds.length, 'mã QC không trùng');
assert.strictEqual(maToHop('1A', 22, 2, oc, { tinh_huong: 3, noi_dau: 1, nguoi_gioi_thieu: 1 }), '1A.T22.V2.311');
// vòng 1: chỉ đổi hook (V1, ô khác = 1) → 3 · vòng 2: chỉ đổi diễn viên → 2 · vòng 3: đổi thân (V1, hook 1) → 2 · cả ma trận → 12
assert.strictEqual(k.ds.filter((x) => trongVong(x, oc, 1)).length, 3);
assert.strictEqual(k.ds.filter((x) => trongVong(x, oc, 2)).length, 2);
assert.strictEqual(k.ds.filter((x) => trongVong(x, oc, 3)).length, 2);
assert.strictEqual(k.ds.filter((x) => trongVong(x, oc, 0)).length, 12);
// phần khác gốc: V2 + nỗi đau 2 (hook không tính — hook là tên)
const x = k.ds.find((y) => y.bien_the.so === 2 && y.chon.noi_dau === 2 && y.chon.tinh_huong === 1)!;
assert.deepStrictEqual(khacGoc(x, oc, pa2).map((d) => d.ten), ['V2', 'Nỗi đau']);
// tiền: bộ gốc + mỗi biến thể thêm chỉ các shot có người / bối cảnh
const g = { shot_cents: 20, kb_cents: 40, chu_cents: 15 };
assert.strictEqual(tienCapCents(t, 1, g), 40 + 12 * 20);
assert.strictEqual(tienCapCents(t, 3, g), 40 + 12 * 20 + 2 * 12 * 20);
assert.strictEqual(duKienCap(t, 2), 2 * 3 * 2 * 1);   // hook 3 · nỗi đau (ô đầu loại đòn bẩy) 2 · giải pháp 1
// ô thứ hai cùng loại nỗi đau chỉ 1 phương án
assert.strictEqual(PA_DU_KIEN([{ loai: 'hook' }, { loai: 'noi_dau' }, { loai: 'noi_dau' }, { loai: 'bang_chung' }], 2), 1);
assert.strictEqual(PA_DU_KIEN([{ loai: 'hook' }, { loai: 'noi_dau' }, { loai: 'noi_dau' }, { loai: 'bang_chung' }], 3), 2);
assert.ok(hopKhuon('ke_chuyen', 'PA') && !hopKhuon('uu_dai', 'PA'));
// dựng riêng một creative: kịch bản + mỗi shot có ô chữ (3 ô → 3 shot), không tính shot giữ hình
assert.strictEqual(tienDungRiengCents(t, g), 40 + 3 * 20);
console.log('concept.test: ok');

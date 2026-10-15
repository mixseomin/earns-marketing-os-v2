// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/kho-creative.test.mts
import assert from 'node:assert';
import { dongCreative, gomThanhPhan, banDo, oMaTran, chuShot, COT_KHUON, type CreativeKho, type ShotKho } from './kho-creative';

const sh = (phim_id: number, thu_tu: number, phan_doan: string, chu_man: string, o: Partial<ShotKho> = {}): ShotKho =>
  ({ phim_id, thu_tu, phan_doan, chu_man, loi: '', hanh_dong: '', co_hinh: false, co_clip: false, co_giong: false, can_giong: false, sua_luc: '2026-10-15T00:00:00Z', ...o });
const cr = (id: number, goc: [number, string][], tpl: [string, string] | null, xuat?: string): CreativeKho =>
  ({ id, ten: `#${id}`, sua_luc: '', anh: null, ngon_ngu: 'en', phong_cach: '', goc: goc.map(([gid, loai]) => ({ id: gid, sp: 325, loai, ten: `g${gid}` })),
    tpl: tpl ? { id: 1, dong: tpl[0], khuon: tpl[1], ten: '' } : null, xuat: xuat ? { url: 'u', luc: xuat } : null });

// chữ shot: bỏ mốc @giây, gộp dòng trùng
assert.strictEqual(chuShot({ chu_man: 'PAY ? GET\n@0.55 PAY 1 GET 3\n@1.35 PAY 1 GET 3', loi: '' }), 'PAY ? GET / PAY 1 GET 3');
assert.strictEqual(chuShot({ chu_man: '', loi: 'Grab yours now.' }), 'Grab yours now.');

// nấc sản xuất + chỗ kẹt + sửa sau xuất
const s = [sh(53, 1, 'hook', '70% OFF?!', { co_hinh: true, can_giong: true }), sh(53, 2, 'end_card', 'JettJeans · 70% OFF')];
const d = dongCreative(cr(53, [[24714, 'ai_phan_doi']], ['ugc', 'uu_dai']), s);
assert.deepStrictEqual(d.nac.map((x) => x.tt), ['xong', 'dang', 'chua', 'chua', 'chua']);
assert.strictEqual(d.ket, 'kẹt hình'); assert.strictEqual(d.hook, '70% OFF?!'); assert.strictEqual(d.cta, 'JettJeans · 70% OFF');
assert.strictEqual(dongCreative(cr(53, [], null, '2026-10-14T00:00:00Z'), s).sua_sau_xuat, true, 'shot sửa sau lần xuất → cờ');
assert.strictEqual(dongCreative(cr(53, [], null, '2026-10-16T00:00:00Z'), s).sua_sau_xuat, false);
assert.strictEqual(dongCreative(cr(9, [], null), [sh(9, 1, 'hook', 'x')]).nac[2]!.tt, 'xong', 'không câu nào cần giọng → nấc giọng xong');

// thành phần: cùng câu ở 2 creative = 1 thành phần dùng ở 2 nơi; end_card gộp vào CTA
const tp = gomThanhPhan([...s, sh(55, 7, 'end_card', 'JettJeans · 70% off'), sh(55, 1, 'hook', '"Those jeans will stretch out"')],
  [{ phim_id: 53, loai: 'san_pham', ten: 'JettJeans', mo_ta: 'jeans', so_anh: 6, giong: '' }, { phim_id: 55, loai: 'nhan_vat', ten: 'Ray', mo_ta: '58', so_anh: 0, giong: 'nam 58' }],
  [{ id: 53, phong_cach: 'UGC iPhone' }]);
const cta = tp.find((t) => t.loai === 'cta')!;
assert.deepStrictEqual(cta.dung_o, [53, 55], 'CTA cùng câu (khác hoa thường) gộp một');
assert.strictEqual(tp.filter((t) => t.loai === 'hook').length, 2);
assert.ok(tp.some((t) => t.loai === 'giong' && t.noi_dung === 'nam 58'));
assert.ok(tp.some((t) => t.loai === 'phong_cach'));

// bản đồ: creative gắn 2 loại góc → có mặt ở 2 hàng; không template → cột ngoài
const ds = [cr(5, [[24736, 'ai_phan_doi'], [24772, 'ai_chan_dung']], null), cr(54, [[24736, 'ai_phan_doi'], [24757, 'ai_noi_dau']], ['ugc', 'so_sanh'])];
const bd = banDo(ds);
assert.deepStrictEqual(bd.ai_phan_doi!.ngoai, [5]); assert.deepStrictEqual(bd.ai_phan_doi!.ugc, [54]); assert.deepStrictEqual(bd.ai_chan_dung!.ngoai, [5]);
assert.deepStrictEqual(bd.ai_mong_muon!.ugc, []);
assert.deepStrictEqual(oMaTran(ds, 24736, { dong: 'ugc', khuon: 'so_sanh' }), [54]);
assert.deepStrictEqual(oMaTran(ds, 24736, { dong: 'ngoai', khuon: '' }), [5]);
assert.ok(COT_KHUON.length >= 17 && new Set(COT_KHUON.map((k) => `${k.dong}.${k.khuon}`)).size === COT_KHUON.length, 'cột khuôn không trùng');
console.log('kho-creative.test: ok');
assert.strictEqual(new Set(COT_KHUON.map((k) => k.ngan)).size, COT_KHUON.length, `viết tắt cột khuôn trùng: ${COT_KHUON.map((k) => k.ngan).join(' ')}`);
console.log('kho-creative.test: viết tắt không trùng ok', COT_KHUON.map((k) => k.ngan).join(' '));

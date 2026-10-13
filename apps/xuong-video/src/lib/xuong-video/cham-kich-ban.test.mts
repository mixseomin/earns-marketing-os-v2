// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/cham-kich-ban.test.mts
import assert from 'node:assert';
import { chamKichBan, nhipCua } from './cham-kich-ban';
import { chanTienKy } from './quy-trinh';

assert.strictEqual(nhipCua('Hook'), 'hook'); assert.strictEqual(nhipCua('Inciting'), 'van_de'); assert.strictEqual(nhipCua('Escalation'), 'leo_thang');
assert.strictEqual(nhipCua('Climax'), 'leo_thang'); assert.strictEqual(nhipCua('Turn'), 'lat_nguoc'); assert.strictEqual(nhipCua('Cliffhanger'), 'ket'); assert.strictEqual(nhipCua('Lật ngược'), 'lat_nguoc');

const shot = (phat: number, pd: string, chu = '') => ({ phat_s: phat, thoi_luong_s: 4, phan_doan: pd, chu_man: chu, thoai: [], loi_thoai: '' });
const pc = [{ ten: 'A', beat: 'Hook' }, { ten: 'B', beat: 'Inciting' }, { ten: 'C', beat: 'Escalation' }, { ten: 'D', beat: 'Twist' }, { ten: 'E', beat: 'Cliffhanger' }];
const beats = pc.map((p) => ({ ten: p.beat }));
const canh = [shot(2.5, 'A', 'WHAT IF?'), shot(8, 'B'), shot(20, 'C'), shot(15, 'D'), shot(8, 'E')];   // lật ngược ở 30.5/53.5 = 57%
const series = { dong_co: 'Zeus làm nhân viên văn phòng; mỗi tập một quyền năng gây hoạ', khan_gia: '', dinh_dang: '', tap: [{ so: 1, ten: '', logline: 'Zeus muốn qua ngày đầu đi làm nhưng sét của ông cứ phóng ra mỗi lần bực' }, { so: 2, ten: '', logline: '' }] };

// đạt đủ
let k = chamKichBan({ tap: { so: 1, beats, phan_canh: pc }, canh, kt: { series } });
assert.deepStrictEqual(k.chan, [], k.chan.join('|')); assert.strictEqual(k.diem, 100);
// thiếu lật ngược + hook dài + không logline → 3 mục chặn
const noi = (phat: number, dai?: number) => ({ ...shot(phat, 'A'), thoai: [{ nhan_vat: '', dien_xuat: '', loi: 'What if a fox could talk?', ...(dai ? { dai } : {}) }] });
k = chamKichBan({ tap: { so: 2, beats: beats.filter((b) => b.ten !== 'Twist'), phan_canh: pc.filter((p) => p.beat !== 'Twist') }, canh: [noi(5), ...canh.slice(1)], kt: { series } });
assert.strictEqual(k.chan.length, 3, k.chan.join('|')); assert.ok(k.chan.some((x) => x.includes('Lật ngược')) && k.chan.some((x) => x.includes('giây 5')) && k.chan.some((x) => x.includes('logline')));
// hook = lúc câu móc tới người xem: shot đầu 3,2s mà câu đọc xong ở 2,66s → đạt; câu dài 4s → chặn; có chữ màn từ giây 0 → đạt
const hk = (c0: ReturnType<typeof noi>) => chamKichBan({ tap: { so: 1, beats, phan_canh: pc }, canh: [c0, ...canh.slice(1)], kt: { series } }).muc.find((x) => x.key === 'hook')!.dat;
assert.strictEqual(hk(noi(3.2, 2.66)), true); assert.strictEqual(hk(noi(4.5, 4)), false); assert.strictEqual(hk({ ...noi(5), chu_man: 'WHAT IF?' }), true);
// tập 1 còn tập 2 sau mà kết không phải móc → mục móc không đạt (không chặn)
k = chamKichBan({ tap: { so: 1, beats: [...beats.slice(0, 4), { ten: 'Resolution' }], phan_canh: pc }, canh, kt: { series } });
assert.ok(k.muc.some((x) => x.key === 'moc' && !x.dat)); assert.deepStrictEqual(k.chan, []);
// lật ngược quá sớm
k = chamKichBan({ tap: { so: 1, beats, phan_canh: pc }, canh: [shot(2, 'A', 'X'), shot(3, 'B'), shot(3, 'C'), shot(30, 'D'), shot(5, 'E')], kt: { series } });
assert.ok(k.muc.some((x) => x.key === 'vi_tri_lat' && !x.dat));
// cổng: chỉ phim có kinh thánh series bị chặn; phim lẻ chỉ chấm điểm
const TQ = { so: 2, brief: 'Một brief đủ dài để qua cổng tiền kỳ', beats: [{ ten: 'a', cam_xuc: -2 }, { ten: 'b', cam_xuc: 1 }, { ten: 'c', cam_xuc: 3 }], phan_canh: [{ ten: 'A' }], nhac_url: null, nhac_phan_canh: {} };
const PQ = { phong_cach: 'cinematic night city, teal and orange, anamorphic', laQc: false };
assert.deepStrictEqual(chanTienKy(TQ, PQ), []);
assert.ok(chanTienKy(TQ, { ...PQ, series }).some((x) => x.startsWith('kịch bản:')));
console.log('cham-kich-ban.test: ok');

// Tên nhịp kiểu cũ của khuôn short ('Dồn nén', 'Chốt') vẫn nhận ra (dữ liệu tách trước 14/10/2026)
import { nhipCua as nc2, chamKichBan as ck2 } from './cham-kich-ban';
assert.strictEqual(nc2('Dồn nén'), 'leo_thang'); assert.strictEqual(nc2('Chốt'), 'ket'); assert.strictEqual(nc2('Kết / móc'), 'ket');
// Phim KHÔNG LỜI: shot đầu chỉ có hành động vẫn đạt hook; phim thường thì không
const s1 = { phat_s: 3, thoi_luong_s: 4, phan_doan: 'a', chu_man: '', thoai: [], loi_thoai: '', hanh_dong: 'A giant hand drops a red gummy bear and switches off the lamp' };
const hook = (khong_loi: boolean) => ck2({ tap: { so: 1, beats: [], phan_canh: [] }, canh: [s1], kt: { logline: 'x'.repeat(30), khong_loi } }).muc.find((m) => m.key === 'hook')!.dat;
assert.strictEqual(hook(true), true, 'không lời: hook bằng hình'); assert.strictEqual(hook(false), false, 'phim thường vẫn đòi chữ/lời');
console.log('cham-kich-ban.test (không lời): ok');

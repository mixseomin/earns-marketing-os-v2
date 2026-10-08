// Tự kiểm bộ dựng lệnh ffmpeg của bản xuất. Chạy: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/xuat.test.mts
import assert from 'node:assert';
import { keHoachXuat, urlCanXuat, ngatDong } from './xuat';
import type { Canh, NhanVat } from './kieu';

const nv = [{ id: 1, ten: 'Lan', loai: 'nhan_vat' }, { id: 2, ten: 'Bra', loai: 'san_pham' }] as unknown as NhanVat[];
const shot = (p: Partial<Canh> & { thu_tu: number }): Canh => ({ id: p.thu_tu, tap_id: 1, canh: `C${p.thu_tu}`, goc_may: '', hanh_dong: '', loi_thoai: '', am_thanh: '', thoai_url: null, am_thanh_url: null, phan_doan: '', cam_xuc: 0, ky_thuat: {}, thoai: [], trang_phuc: '', phat_s: null, chu_man: '', nhanh: '', thoi_luong_s: 4, nhan_vat: [1, 2], bien_the: [], prompt_anh: '', prompt_video: '', keyframe_url: null, keyframe_uv: [], video_url: null, video_cuoi_url: null, nguon_video: {}, video_phien_ban: [], trang_thai: 'nhap', loi: '', chi_phi_cents: 0, ...p } as Canh);
const canh = [
  shot({ thu_tu: 1, phat_s: 2, video_url: 'https://x/c1.mp4', chu_man: 'Vai hằn đỏ mỗi tối?', thoai: [{ nhan_vat: 'Lan', dien_xuat: '', loi: 'Đeo bra gọng cả ngày', url: 'https://x/g1.mp3' }], nhanh: 'A' }),
  shot({ thu_tu: 2, phat_s: 2, video_url: 'https://x/c1b.mp4', chu_man: 'Hook B', nhanh: 'B' }),
  shot({ thu_tu: 3, phat_s: 3, keyframe_url: 'https://x/k3.jpg', am_thanh_url: 'https://x/s3.mp3', phan_doan: 'Demo', thoai: [{ nhan_vat: 'Lan', dien_xuat: '', loi: 'Không gọng' }] }),
  shot({ thu_tu: 4, phat_s: 2.5, video_cuoi_url: 'https://x/c4f.mp4', video_url: 'https://x/c4.mp4', chu_man: 'Giảm 70% · Mua ngay', phan_doan: 'CTA' }),
];
const tap = { nhac_url: 'https://x/n.mp3', nhac_phan_canh: { Demo: 'https://x/nd.mp3' } };
// urlCanXuat: nhánh A → clip A, không clip B; bản cuối thay nháp; nhạc phân cảnh có → không lấy bài cả tập.
const u = urlCanXuat(canh, nv, tap, 'A');
assert.deepStrictEqual(u.sort(), ['https://x/c1.mp4', 'https://x/c4f.mp4', 'https://x/g1.mp3', 'https://x/k3.jpg', 'https://x/nd.mp3', 'https://x/s3.mp3'].sort());
assert.ok(urlCanXuat(canh, nv, { nhac_url: 'https://x/n.mp3', nhac_phan_canh: {} }, 'B').includes('https://x/n.mp3'));
const nl = (url: string, dai: number | null, coAm = true) => ({ url, duong: `/tmp/t/${url.split('/').pop()}`, dai, coAm });
const nguyenLieu = [nl('https://x/c1.mp4', 4), nl('https://x/g1.mp3', 1.4), nl('https://x/k3.jpg', null, false), nl('https://x/s3.mp3', 3), nl('https://x/c4f.mp4', 4, false), nl('https://x/nd.mp3', 10)];
const kh = keHoachXuat({ loai: 'quang_cao', tiLe: '9:16', canh, nhanVat: nv, tap, qc: { ten: 'Bra', uu_dai: '$24.99 · đổi trả 45 ngày', link: '', diem_noi_bat: '', doi_tuong: '', thi_truong: '', anh: [] }, nhanh: 'A', nguyenLieu, font: '/f/DejaVuSans-Bold.ttf', thuMuc: '/tmp/t', ra: '/tmp/t/ra.mp4' });
assert.deepStrictEqual(kh.canhThieu, []);
assert.strictEqual(kh.giay, 2 + 3 + 2.5 + 2);                    // 3 shot nhánh A + end card 2s
const loc = kh.tep.find((x) => x.duong.endsWith('/loc.txt'))!.noiDung;
assert.ok(loc.includes('trim=0:2,setpts=PTS-STARTPTS,scale=1080:1920'));        // shot 1 cắt 2s, 9:16
assert.ok(/-loop 1 -framerate 30 -t 3 -i \/tmp\/t\/k3.jpg/.test(kh.args.join(' ')));  // keyframe tĩnh 3s
assert.ok(!kh.args.join(' ').includes('c1b.mp4'));                   // nhánh B không vào bản A
assert.ok(loc.includes('adelay=0:all=1'));                           // giọng shot 1 ở 0ms
assert.ok(loc.includes('volume=0.8,adelay=2000:all=1'));             // hiệu ứng shot 3 ở 2000ms
assert.ok(loc.includes('aloop=loop=-1') && loc.includes('volume=0.22,adelay=2000:all=1'));  // nhạc phân cảnh Demo từ 2s
assert.ok(!loc.includes('[0:a]atrim'));                              // clip 1 có giọng riêng → không lấy tiếng clip
assert.ok(!/\[\d+:a\]atrim=0:2\.5/.test(loc));                       // clip 4 không có luồng tiếng → không tham chiếu :a
assert.ok(loc.includes("enable='between(t,0,1.4)'"));                // phụ đề theo độ dài giọng
assert.ok(loc.includes("enable='between(t,0,3)'"));                  // không giọng → chia đều giây phát
assert.ok(loc.includes('concat=n=4:v=1:a=0[vout]') && loc.includes('amix=inputs=') && loc.includes('loudnorm=I=-14'));
assert.ok(loc.includes('color=c=0x101014:s=1080x1920:d=2'));          // end card
assert.ok(kh.tep.find((x) => x.duong.endsWith('/man_0_0.txt'))!.noiDung === 'Vai hằn đỏ mỗi tối?');
assert.ok(kh.tep.find((x) => x.duong.endsWith('/man_2_0.txt'))!.noiDung === 'Giảm 70%% · Mua ngay');   // '%' thoát cho drawtext
assert.ok(loc.includes('y=h*0.15+0') && loc.includes("y=(h-"));                      // dòng đầu ở 15% chiều cao; end card giữa màn
assert.ok(kh.args.includes('-/filter_complex') && kh.args[kh.args.length - 1] === '/tmp/t/ra.mp4');
// Thiếu nguyên liệu → shot bị ghi thiếu, không chết.
const kh2 = keHoachXuat({ loai: 'phim', tiLe: '16:9', canh, nhanVat: nv, tap, nhanh: 'B', nguyenLieu: [nl('https://x/c4f.mp4', 4, false)], font: '/f', thuMuc: '/tmp/t', ra: '/tmp/t/ra.mp4' });
assert.deepStrictEqual(kh2.canhThieu, ['#2 C2', '#3 C3']);
assert.strictEqual(kh2.giay, 2.5);                                   // phim: không end card
assert.ok(kh2.tep.find((x) => x.duong.endsWith('/loc.txt'))!.noiDung.includes('anullsrc'));  // không âm → im lặng
// Không shot nào có hình → args rỗng.
assert.deepStrictEqual(keHoachXuat({ loai: 'phim', tiLe: '9:16', canh, nhanVat: nv, tap, nguyenLieu: [], font: '/f', thuMuc: '/t', ra: '/t/r.mp4' }).args, []);
// ngatDong.
assert.deepStrictEqual(ngatDong('Giảm 70% cho 100 đơn đầu tiên hôm nay', 12), ['Giảm 70% cho', '100 đơn đầu', 'tiên hôm nay']);
assert.deepStrictEqual(ngatDong('  a  ', 5), ['a']);
console.log('xuat.test: ok');

// Tự kiểm bộ dựng lệnh ffmpeg của bản xuất. Chạy: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/xuat.test.mts
import assert from 'node:assert';
import { keHoachXuat, urlCanXuat, ngatDong, doanChuMan, tepAss, chuManHien } from './xuat';
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
assert.ok(!loc.includes('enable=') && !kh.tep.some((x) => /\/pd_/.test(x.duong)));   // không vẽ phụ đề thoại lên hình (#1231)
const ass = kh.tep.find((x) => x.duong.endsWith('/chu.ass'))!.noiDung;
assert.strictEqual((ass.match(/^Dialogue:/gm) ?? []).length, 2);          // chỉ shot có chữ màn mới có chữ (shot 3 không có)
assert.ok(loc.includes('concat=n=4:v=1:a=0[vcat]') && loc.includes("[vcat]ass=filename='/tmp/t/chu.ass'[vout]"));   // chữ vẽ một lần bằng libass
assert.ok(loc.includes('amix=inputs=') && loc.includes('loudnorm=I=-14'));
assert.ok(loc.includes('color=c=0x101014:s=1080x1920:d=2'));          // end card
assert.ok(ass.includes('Dialogue: 0,0:00:00.00,0:00:02.00,Man,,0,0,0,,{\\an5\\pos(540,330)}Vai hằn đỏ mỗi tối?'), ass);   // 0–2s, giữa ngang, mặc định trên: 15% + nửa khối
assert.ok(ass.includes('0:00:05.00,0:00:07.50') && ass.includes('Giảm 70% · Mua ngay'));   // shot 4 từ 5s; '%' giữ nguyên
assert.ok(ass.includes('Style: Man,DejaVu Sans,67,&H00FFFFFF&,&H00FFFFFF&,&H00000000&'));   // mặc định: trắng viền đen như cũ
assert.ok(loc.includes("y=(h-"));                      // end card (drawtext) giữa màn
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

// QC mẫu (09/10/2026): logo góc, chữ màn ở dưới, end card dùng ảnh sản phẩm — urlCanXuat phải kéo logo + ảnh; kế hoạch phải overlay + đặt chữ đúng chỗ.
{
  const qc = { ten: 'Bra', uu_dai: 'FLASH SALE · SHOP NOW', link: '', diem_noi_bat: '', doi_tuong: '', thi_truong: '', anh: ['https://x/sp.jpg'], logo_url: 'https://x/logo.png', vi_tri_chu: 'duoi' as const };
  const u2 = urlCanXuat(canh, nv, tap, 'A', qc);
  assert.ok(u2.includes('https://x/logo.png') && u2.includes('https://x/sp.jpg'));
  const kh2 = keHoachXuat({ loai: 'quang_cao', tiLe: '9:16', canh, nhanVat: nv, tap, qc, nhanh: 'A', nguyenLieu: [...nguyenLieu, nl('https://x/logo.png', null, false), nl('https://x/sp.jpg', null, false)], font: '/f.ttf', thuMuc: '/tmp/t', ra: '/tmp/t/ra.mp4' });
  const loc2 = kh2.tep.find((x) => x.duong.endsWith('/loc.txt'))!.noiDung;
  assert.ok(loc2.includes('overlay=W-w-32:58:shortest=1'), 'logo overlay góc trên phải');      // 1080×0.03=32 · 1920×0.03=58
  assert.ok(kh2.tep.find((x) => x.duong.endsWith('/chu.ass'))!.noiDung.includes('\\pos(540,1190)'), 'chữ màn ở dưới (62%)');
  assert.ok(loc2.includes('colorlevels=rimax=0.55') && loc2.includes('y=h*0.78-'), 'end card trên ảnh sản phẩm, chữ 1/4 dưới');
  assert.strictEqual(kh2.giay, 2 + 3 + 2.5 + 2);
  // Không logo, không ảnh → như cũ: không overlay, end card nền tối.
  const kh3 = keHoachXuat({ loai: 'quang_cao', tiLe: '9:16', canh, nhanVat: nv, tap, qc: { ...qc, anh: [], logo_url: '', vi_tri_chu: 'tren' }, nhanh: 'A', nguyenLieu, font: '/f.ttf', thuMuc: '/tmp/t', ra: '/tmp/t/ra.mp4' });
  const loc3 = kh3.tep.find((x) => x.duong.endsWith('/loc.txt'))!.noiDung;
  assert.ok(!loc3.includes('overlay=W-w-') && loc3.includes('color=c=0x101014'));   // không logo → không overlay góc
  // Ảnh tĩnh (shot chưa có clip): vừa khung trên nền mờ, KHÔNG cắt (ảnh vuông thật của shop giữ nguyên hai bên).
  assert.ok(loc3.includes('force_original_aspect_ratio=decrease') && loc3.includes('boxblur=24:2') && loc3.includes('overlay=(W-w)/2:(H-h)/2'), 'ảnh tĩnh fit + nền mờ');
}
console.log('xuat.test: mẫu ok');

// Chữ màn kiểu QC mẫu (10/10/2026): đổi chữ theo giây trong shot, chữ xanh viền trắng, số + '?' màu vàng, giữa màn, font Montserrat.
{
  const d = doanChuMan('PAY ? GET ? PANTS\n@0.9 PAY 1 GET ? PANTS\n@1.6 PAY 1 GET 3 PANTS', 2);
  assert.deepStrictEqual(d, [{ tu: 0, den: 0.9, dong: ['PAY ? GET ? PANTS'] }, { tu: 0.9, den: 1.6, dong: ['PAY 1 GET ? PANTS'] }, { tu: 1.6, den: 2, dong: ['PAY 1 GET 3 PANTS'] }]);
  assert.deepStrictEqual(doanChuMan('Dòng một\nDòng hai', 2), [{ tu: 0, den: 2, dong: ['Dòng một', 'Dòng hai'] }]);
  assert.deepStrictEqual(doanChuMan('', 2), []);
  assert.deepStrictEqual(doanChuMan('@3 quá giờ', 2), []);          // mốc vượt giây phát → bỏ, không ra câu 0 giây
  assert.strictEqual(chuManHien('PAY ? GET ? PANTS\n@1.6 PAY 1 GET 3 PANTS'), 'PAY 1 GET 3 PANTS');
  const a = tepAss({ W: 1080, H: 1920, viTri: 'giua', kieu: { font: 'Montserrat Black', mau: '#1E66D0', vien: '#FFFFFF', nhan: '#FFD400', co: 0.075 }, cau: d });
  assert.ok(a.includes('Style: Man,Montserrat Black,81,&H00D0661E&,&H00D0661E&,&H00FFFFFF&'), a);   // BGR trong ASS
  assert.ok(a.includes('{\\an5\\pos(540,960)}PAY {\\c&H0000D4FF&}1{\\c&H00D0661E&} GET {\\c&H0000D4FF&}?{\\c&H00D0661E&} PANTS'), a);   // số/? vàng
  assert.strictEqual((a.match(/^Dialogue:/gm) ?? []).length, 3);
  // Xuất riêng shot 1 (xem thử): chỉ shot đó, không end card.
  const k1 = keHoachXuat({ loai: 'quang_cao', tiLe: '9:16', canh, nhanVat: nv, tap, qc: { ten: 'Bra', uu_dai: 'SALE', link: '', diem_noi_bat: '', doi_tuong: '', thi_truong: '', anh: [] }, nhanh: 'A', nguyenLieu, font: '/f.ttf', thuMuc: '/tmp/t', ra: '/tmp/t/ra.mp4', chiThuTu: [1], fontsDir: '/x/fonts' });
  assert.strictEqual(k1.giay, 2);
  assert.ok(k1.tep.find((x) => x.duong.endsWith('/loc.txt'))!.noiDung.includes("fontsdir='/x/fonts'"));
  console.log('xuat.test: chữ màn kiểu mẫu ok');
}
// Dòng thoại có độ trễ (tre): giọng vào đúng giây như QC mẫu.
{
  const c1 = [{ ...canh[0]!, thoai: [{ nhan_vat: '', dien_xuat: '', loi: 'Pay one get three pants.', url: 'https://x/g1.mp3', tre: 0.47 }] }];
  const k = keHoachXuat({ loai: 'phim', tiLe: '9:16', canh: c1 as never, nhanVat: nv, tap: { nhac_url: null, nhac_phan_canh: {} }, nhanh: 'A', nguyenLieu, font: '/f', thuMuc: '/tmp/t', ra: '/tmp/t/ra.mp4' });
  const l = k.tep.find((x) => x.duong.endsWith('/loc.txt'))!.noiDung;
  assert.ok(l.includes('adelay=470:all=1'), 'giọng trễ 0,47s');
  assert.ok(!l.includes('atempo'), 'giọng 1,4s vừa phần còn lại 1,53s → không tăng tốc');
  const k2 = keHoachXuat({ loai: 'phim', tiLe: '9:16', canh: c1 as never, nhanVat: nv, tap: { nhac_url: null, nhac_phan_canh: {} }, nhanh: 'A', nguyenLieu: nguyenLieu.map((x) => (x.url === 'https://x/g1.mp3' ? { ...x, dai: 1.96 } : x)), font: '/f', thuMuc: '/tmp/t', ra: '/tmp/t/ra.mp4' });
  assert.ok(k2.tep.find((x) => x.duong.endsWith('/loc.txt'))!.noiDung.includes('atempo=1.281,'), 'giọng 1,96s trong 1,53s → nhanh 1,28×');
  console.log('xuat.test: trễ giọng ok');
}

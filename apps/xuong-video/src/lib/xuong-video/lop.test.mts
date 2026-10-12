// Tự kiểm lớp phủ. Chạy: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/lop.test.mts
import assert from 'node:assert';
import { lopMoi, MAU_LOP, lopAss, lopAnhLoc, lopHien, hieuUngTai } from './lop';
import { keHoachXuat, urlCanXuat } from './xuat';
import type { Canh, NhanVat } from './kieu';

const W = 1080, H = 1920;
const chu = lopMoi('chu', 1, { chu: 'SAVE\n70%', x: 0.5, y: 0.25, co: 0.1, vao: 'pop', xoay: 10, mo: 0.5 });
const hinh = lopMoi('hinh', 2, { dang: 'tron', x: 0.8, y: 0.3, w: 0.3, h: 0.3 * W / H, mau: '#E11D48', vao: 'truot' });
const anh = lopMoi('anh', 0.5, { url: 'https://x/logo.png', x: 0.2, y: 0.1, w: 0.25, den: 3 });
const a = lopAss([chu, hinh, anh], W, H);
assert.strictEqual(a.events.length, 2);                                               // ảnh không vào ASS
assert.ok(a.events[0]!.startsWith('Dialogue: 1,0:00:01.00,0:00:03.50,Lop0'), a.events[0]);
assert.ok(a.events[0]!.includes('\\pos(540,480)') && a.events[0]!.includes('\\frz-10') && a.events[0]!.includes('\\alpha&H80&') && a.events[0]!.includes('\\fscx60') && a.events[0]!.endsWith('SAVE\\N70%'), a.events[0]);
assert.ok(a.events[1]!.includes('\\move(864,672,864,576,0,250)') && a.events[1]!.includes('\\p1}m 162 0 b'), a.events[1]);   // hình tròn trượt lên
assert.ok(a.styles.some((x) => x.startsWith('Style: Lop0,Montserrat Black,108,')) && a.styles.some((x) => x.startsWith('Style: LopHinh,')));
const f = lopAnhLoc(anh, 7, W, H, 'vcat', 'vla0');
assert.ok(f.startsWith('[7:v]scale=270:-2,format=rgba,colorchannelmixer=aa=1,fade=t=in:st=0.5:d=0.3:alpha=1,fade=t=out:st=2.7:d=0.3:alpha=1[la7];[vcat][la7]overlay=x=216-w/2:y=192-h/2:enable=\'between(t\\,0.5\\,3)\'[vla0]'), f);
// Hiện ở giây t: ảnh dưới chữ/hình; ẩn thì không hiện; hiệu ứng vào/ra.
assert.deepStrictEqual(lopHien([chu, anh], 1.5).map((l) => l.loai), ['anh', 'chu']);
assert.deepStrictEqual(lopHien([{ ...chu, an: true }], 1.5), []);
assert.ok(hieuUngTai(hinh, 2).dy > 0.04 && hieuUngTai(hinh, 2.5).dy === 0 && hieuUngTai(chu, 1).scale === 0.6);
// Mẫu dựng sẵn ra đúng loại lớp.
assert.deepStrictEqual(MAU_LOP.find((m) => m.key === 'huy_hieu')!.tao(0, 0.5625).map((l) => l.loai), ['hinh', 'chu']);
// Bản xuất: ảnh phủ sau ghép hình, chữ/hình vào ASS, chữ màn lớp 100; urlCanXuat tải ảnh lớp.
const nv = [] as unknown as NhanVat[];
const shot = { id: 1, tap_id: 1, thu_tu: 1, canh: 'C1', goc_may: '', hanh_dong: '', loi_thoai: '', am_thanh: '', thoai_url: null, am_thanh_url: null, phan_doan: '', cam_xuc: 0, ky_thuat: {}, thoai: [], trang_phuc: '', phat_s: 4, chu_man: 'Hi', nhanh: '', kieu_chu: {}, thoi_luong_s: 4, nhan_vat: [], bien_the: [], prompt_anh: '', prompt_video: '', keyframe_url: null, keyframe_uv: [], video_url: 'https://x/c.mp4', video_cuoi_url: null, trang_thai: 'xong', loi: '', chi_phi_cents: 0 } as unknown as Canh;
const tap = { nhac_url: null, nhac_phan_canh: {}, lop: [chu, hinh, anh] };
assert.ok(urlCanXuat([shot], nv, tap).includes('https://x/logo.png'));
const kh = keHoachXuat({ loai: 'phim', tiLe: '9:16', canh: [shot], nhanVat: nv, tap, nguyenLieu: [{ url: 'https://x/c.mp4', duong: '/t/c.mp4', dai: 5, coAm: false }, { url: 'https://x/logo.png', duong: '/t/l.png', dai: null, coAm: false }], font: '/f', thuMuc: '/t', ra: '/t/r.mp4' });
const loc = kh.tep.find((x) => x.duong.endsWith('/loc.txt'))!.noiDung;
assert.ok(loc.includes('[vcat][la') && loc.includes("[vla0]ass=filename='/t/chu.ass'[vout]"), loc);
const ass = kh.tep.find((x) => x.duong.endsWith('/chu.ass'))!.noiDung;
assert.ok(ass.includes('Dialogue: 100,') && ass.includes(',Lop0,') && ass.includes(',LopHinh,'), ass);
console.log('lop.test: ok');
// Hiệu ứng khung kiểu CapCut + chữ gõ/nảy (11/10/2026).
{
  const { lopHieuUngLoc, hieuUngKhungTai, HIEU_UNG, GO_CHU_MS } = await import('./lop');
  const hu = (k: string, tu: number) => lopMoi('hieu_ung', tu, { hu: k as never, cuong: 1 });
  assert.ok(lopHieuUngLoc(hu('chop', 1), W, H, 'a', 'b', 0).startsWith("[a]eq=brightness='0.6*max(0\\,1-(t-1)/0.35)':eval=frame:enable='between(t\\,1\\,2)'[b]"));
  const r = lopHieuUngLoc(hu('rung', 0), W, H, 'a', 'b', 3);
  assert.ok(r.includes('[hu3a][hu3c]overlay=0:0:eof_action=pass:enable='));   // crop không có timeline → tách luồng + overlay
  assert.ok(r.includes('[hu3b]trim=start=0:end=') && r.includes(',setpts=PTS+0/TB[hu3c]'), 'nhánh rung chỉ xử lý đúng khoảng của lớp');
  assert.strictEqual(HIEU_UNG.length, 8);
  for (const h of HIEU_UNG) assert.ok(!lopHieuUngLoc(hu(h.key, 0), W, H, 'a', 'b', 0).includes('null'), h.key);
  const k = hieuUngKhungTai([hu('den_trang', 0), hu('zoom', 0), hu('chop', 5)], 0.5, 270);
  assert.ok(k.filter.includes('grayscale(1)') && k.transform.includes('scale(1.12)') && k.chop === 0);
  // Hiệu ứng không vẽ như một vật, không vào ASS.
  assert.deepStrictEqual(lopHien([hu('rung', 0)], 0.5), []);
  assert.strictEqual(lopAss([hu('rung', 0)], W, H).events.length, 0);
  const go = lopAss([lopMoi('chu', 0, { chu: 'AB', vao: 'go_chu' })], W, H).events[0]!;
  assert.ok(go.includes(`\\t(${GO_CHU_MS},${GO_CHU_MS + 1},\\alpha&H00&)}B`), go);
  assert.ok(lopAss([lopMoi('chu', 0, { vao: 'nay' })], W, H).events[0]!.includes('\\fscx115'));
  console.log('lop.test: hiệu ứng ok');
}
// Chọn nhiều + gộp nhóm (#1289) — bấm một lớp chọn cả nhóm; Shift bật/tắt; đổi cỡ/xoay cả nhóm quanh tâm chung.
{
  const { chonLopMoi, gopNhom, boNhom, bienDoiNhom, nhomCua } = await import('./lop');
  const a = { ...lopMoi('chu', 0), id: 'a' }, b = { ...lopMoi('hinh', 0), id: 'b' }, c = { ...lopMoi('anh', 0), id: 'c' };
  let ds = [a, b, c];
  assert.deepStrictEqual(chonLopMoi(ds, ['a'], 'b', false), ['b']);
  assert.deepStrictEqual(chonLopMoi(ds, ['a'], 'b', true), ['a', 'b']);
  assert.deepStrictEqual(chonLopMoi(ds, ['a', 'b'], 'b', true), ['a']);
  assert.strictEqual(gopNhom(ds, ['a']), ds);   // một lớp không thành nhóm
  ds = gopNhom(ds, ['a', 'b'], 'g1');
  assert.deepStrictEqual(nhomCua(ds, 'b'), ['a', 'b']);
  assert.deepStrictEqual(chonLopMoi(ds, [], 'a', false), ['a', 'b']);
  assert.deepStrictEqual(chonLopMoi(ds, ['c'], 'a', true), ['c', 'a', 'b']);
  assert.deepStrictEqual(nhomCua(boNhom(ds, ['a', 'b']), 'a'), ['a']);
  // Xoay 90° quanh tâm trên khung 9:16 (100×200 px): lớp ở bên phải tâm 10px → xuống dưới tâm 10px.
  const p = bienDoiNhom([{ ...a, x: 0.6, y: 0.5, xoay: 0 }], 0.5, 0.5, 1, 90, 100, 200);
  assert.deepStrictEqual([p.a!.x, p.a!.y, p.a!.xoay], [0.5, 0.55, 90]);
  const q = bienDoiNhom([{ ...b, x: 0.6, y: 0.5, w: 0.2, h: 0.1 }], 0.5, 0.5, 2, 0, 100, 200);
  assert.deepStrictEqual([q.b!.x, q.b!.w, q.b!.h], [0.7, 0.4, 0.2]);
  console.log('lop.test: nhóm ok');
}

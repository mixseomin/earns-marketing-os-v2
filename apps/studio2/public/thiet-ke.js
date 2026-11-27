'use strict';
// CÔNG CỤ THIẾT KẾ creative tĩnh — studio2.on.tc/thiet-ke.html (anh 20/11/2026: "studio2.on.tc có thể làm công cụ thiết kế đc ko?" → "Thiết kế vẫn làm").
// Dựng mẫu creative QC phim ngắn (kiểu các mẫu etp dt_* / free_*: tên vàng nổi khối, nút WATCH NOW viền vàng, dải WATCH FREE…) bằng LỚP thay cho vẽ tay
// từng mẫu bằng PIL (apps/xuong-video/scripts/ethopex/dung-mau.py). Lõi khung vẽ = Fabric.js 7.4.0 (MIT, đặt sẵn ở lib/fabric-7.4.0) — chọn sau khi tra
// Fabric / Konva / react-design-editor / filerobot / penpot (20/11/2026): Fabric có sẵn chọn-kéo-xoay, chữ sửa tại chỗ, tô chuyển, bóng, xuất JSON + PNG.
// Lưu: bảng xv_thiet_ke qua đường đọc / ghi của studio (actions-thiet-ke.ts). Ô chữ có thể chứa {ten} {cau_nhu} {nhan}; lớp ảnh đánh dấu "ô ảnh phim"
// là chỗ máy dựng thay bằng khung phim thật. QC tham chiếu + vạch vùng an toàn là lớp DOM nằm ngoài khung vẽ nên không bao giờ lọt vào ảnh xuất.
const F = window.fabric;
// Fabric 7 đổi gốc mặc định sang TÂM; mọi toạ độ ở đây tính từ góc trên-trái như bảng thuộc tính hiện
Object.assign(F.FabricObject.ownDefaults, { originX: 'left', originY: 'top' });
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** thuộc tính riêng của nhà, phải đi theo mỗi lớp khi lưu: tên lớp · vai (anh_phim = ô ảnh phim máy thay) · khoá lớp · chữ gốc khi đang xem dữ liệu thử */
const RIENG = ['ten_lop', 'vai', 'khoa_lop', 'chu_goc'];
const PHONG = ['Anton', 'Bebas Neue', 'Oswald', 'Montserrat', 'Roboto Condensed', 'Be Vietnam Pro', 'Playfair Display', 'Cinzel', 'Bangers', 'Archivo Black', 'Teko', 'Barlow Condensed', 'Dancing Script', 'Great Vibes', 'Lobster', 'IBM Plex Sans'];
/** vùng an toàn Meta 9:16 — cùng số với dung-mau.py: ~14% trên bị tên Page che (chữ đỉnh đặt từ 12%), 20–35% dưới bị chữ QC + nút */
const VACH_AN = [[0.12, 'chữ đỉnh từ đây (12%)'], [0.14, 'tên Page che tới 14%'], [0.65, 'chữ QC + nút có thể che từ 65%'], [0.80, 'chắc chắn bị che từ 80%']];
const ANH_TOI_DA = 1440;   // cạnh dài tối đa của ảnh nhúng — giữ mỗi bản dưới trần 1,9 MB của đường ghi

const S = { id: null, w: 1080, h: 1920, z: 1, hoan: [], lai: [], im: false, tc: null, thu: false };
const cv = new F.Canvas($('#cv'), { preserveObjectStacking: true, backgroundColor: '#111111', width: S.w, height: S.h });

// ── gọi studio (cùng khuôn goiDuong của studio2.js)
async function goiDuong(duong, ham, args) {
  let r; try { r = await fetch(`/api/xv/${duong}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ham, args }) }); }
  catch { throw new Error('không gọi được máy chủ studio (có thể phiên đăng nhập đã hết, hãy tải lại trang)'); }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.loi) throw new Error(j?.loi || `máy chủ studio trả lỗi ${r.status}`);
  return j.kq;
}
const doc = (ham, ...a) => goiDuong('doc', ham, a);
async function ghi(ham, ...a) { const kq = await goiDuong('ghi', ham, a); if (kq && kq.ok === false) throw new Error(kq.loi || 'studio từ chối'); return kq?.data ?? kq; }

let hen;
function bao(cau, loi = false) { const b = $('#bao'); b.textContent = cau; b.className = 'tk-bao' + (loi ? ' loi' : ''); b.hidden = false; clearTimeout(hen); if (!loi) hen = setTimeout(() => { b.hidden = true; }, 4000); }

// ── khung + thu phóng: khung hiển thị co theo màn, Fabric zoom = z nên toạ độ lớp vẫn là px thật (1080×1920)
function vuaKhung() {
  const v = $('#vung').getBoundingClientRect(), z = Math.min((v.width - 40) / S.w, (v.height - 40) / S.h, 1);
  S.z = z > 0 ? z : 0.3;
  cv.setDimensions({ width: Math.round(S.w * S.z), height: Math.round(S.h * S.z) }); cv.setZoom(S.z);   // toạ độ lớp vẫn là px thật; xuất ảnh nhân 1/z
  $('#san').style.width = `${S.w * S.z}px`; $('#san').style.height = `${S.h * S.z}px`;
  cv.calcOffset(); cv.requestRenderAll(); veVachAn();
}
function veVachAn() {
  const l = $('#luoiAn'), bat = $('#vungAn').checked && S.h > S.w;
  l.innerHTML = bat ? VACH_AN.map(([p, t]) => `<i style="top:${p * 100}%"></i><b style="top:calc(${p * 100}% + 2px)">${esc(t)}</b>`).join('') : '';
}
addEventListener('resize', vuaKhung);
$('#vungAn').addEventListener('change', veVachAn);

// ── hoàn tác: chụp JSON sau mỗi thay đổi (gộp các thay đổi sát nhau)
const json = () => cv.toObject(RIENG);
let chupHen;
function chup() { if (S.im) return; clearTimeout(chupHen); chupHen = setTimeout(() => { S.hoan.push(JSON.stringify(json())); if (S.hoan.length > 60) S.hoan.shift(); S.lai = []; nhapNhap(); }, 120); }
async function nap(o) { S.im = true; try { await cv.loadFromJSON(o); await napPhong(); cv.getObjects().forEach(khoaLai); cv.requestRenderAll(); } finally { S.im = false; } veLop(); veThuocTinh(); }
async function hoanTac() { if (S.hoan.length < 2) return; S.lai.push(S.hoan.pop()); await nap(JSON.parse(S.hoan.at(-1))); }
async function lamLai() { const t = S.lai.pop(); if (!t) return; S.hoan.push(t); await nap(JSON.parse(t)); }
['object:added', 'object:removed', 'object:modified'].forEach((e) => cv.on(e, () => { chup(); veLop(); }));
cv.on('text:changed', chup);
['selection:created', 'selection:updated', 'selection:cleared'].forEach((e) => cv.on(e, () => { veLop(); veThuocTinh(); }));
cv.on('object:moving', () => veThuocTinh(true)); cv.on('object:scaling', () => veThuocTinh(true)); cv.on('object:rotating', () => veThuocTinh(true));

// ── nháp trên máy người dùng (mất điện / đóng tab không mất việc) — chỉ là tiện, bản thật là nút Lưu
const NHAP = 'tk-nhap-v1';
let nhapHen;
function nhapNhap() { clearTimeout(nhapHen); nhapHen = setTimeout(() => { try { localStorage.setItem(NHAP, JSON.stringify({ id: S.id, w: S.w, h: S.h, ten: $('#tenBan').value, ma: $('#maMau').value, tm: $('#thuMuc').value, fabric: json() })); } catch { /* đầy bộ nhớ trình duyệt: bỏ nháp */ } }, 800); }

// ── phông: nạp đủ các phông mà lớp chữ dùng rồi mới vẽ (không thì Fabric đo chữ theo phông dự phòng, khung chữ lệch)
async function napPhong() {
  const can = new Set();
  const duyet = (o) => { if (o.fontFamily) can.add(`${o.fontStyle === 'italic' ? 'italic ' : ''}${o.fontWeight || 400} 40px "${o.fontFamily}"`); (o._objects || []).forEach(duyet); };
  cv.getObjects().forEach(duyet);
  await Promise.all([...can].map((f) => document.fonts.load(f).catch(() => null)));
  const lam = (o) => { if (o.initDimensions) { o.initDimensions(); o.setCoords(); } (o._objects || []).forEach(lam); };
  cv.getObjects().forEach(lam);
}

// ── ảnh: thu nhỏ trước khi nhúng (webp giữ được nền trong)
function docTep(f) { return new Promise((ok, hong) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => hong(new Error('không đọc được tệp ảnh')); r.readAsDataURL(f); }); }
async function thuNho(url, toiDa = ANH_TOI_DA) {
  const im = new Image(); im.src = url; await im.decode();
  const k = Math.min(1, toiDa / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
  c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/webp', 0.86);
}
function chonTep() { return new Promise((ok) => { const i = $('#chonAnh'); i.value = ''; i.onchange = () => ok(i.files[0] || null); i.click(); }); }
const ANH_CHO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f55"/><stop offset="1" stop-color="#1b1e2b"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/><text x="540" y="960" font-family="sans-serif" font-size="64" fill="#9aa0bb" text-anchor="middle">ẢNH PHIM</text><text x="540" y="1040" font-family="sans-serif" font-size="34" fill="#7d849f" text-anchor="middle">máy dựng thay bằng khung phim thật</text></svg>');
/** phủ kín khung (như object-fit: cover), căn giữa */
function phuKin(im, w = S.w, h = S.h, x = 0, y = 0) { const k = Math.max(w / im.width, h / im.height); im.set({ scaleX: k, scaleY: k, left: x + (w - im.width * k) / 2, top: y + (h - im.height * k) / 2 }); }

// ── khối mẫu: dựng theo các mẫu đối thủ đã mổ trong etp-mau-cr.json (dt_*, free_*)
const VANG = () => new F.Gradient({ type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 0, y2: 1 }, colorStops: [{ offset: 0, color: '#fff6c2' }, { offset: 0.45, color: '#f2c24b' }, { offset: 1, color: '#9a6410' }] });
const bong = (mau = 'rgba(0,0,0,0.65)', mo = 18, x = 0, y = 8) => new F.Shadow({ color: mau, blur: mo, offsetX: x, offsetY: y });
function chu(text, o = {}) { return new F.Textbox(text, { fontFamily: 'Montserrat', fontWeight: 900, fontSize: 72, fill: '#ffffff', textAlign: 'center', width: S.w * 0.84, left: S.w * 0.08, top: S.h * 0.5, lineHeight: 1.05, splitByGrapheme: false, ...o }); }
function vienThuoc(text, o = {}) {   // nút viên thuốc: khối bo tròn + chữ, gộp thành một lớp
  const h = o.h || 120, w = o.w || S.w * 0.62, r = new F.Rect({ width: w, height: h, rx: h / 2, ry: h / 2, fill: o.nen || '#111111', stroke: o.vien || null, strokeWidth: o.vien ? (o.day || 6) : 0, originX: 'center', originY: 'center' });
  const t = new F.Textbox(text, { width: w - h * 0.6, fontFamily: o.phong || 'Montserrat', fontWeight: o.dam || 900, fontSize: o.co || h * 0.42, fill: o.mau || '#ffffff', textAlign: 'center', originX: 'center', originY: 'center', charSpacing: o.gian ?? 40 });
  return new F.Group([r, t], { left: (S.w - w) / 2, top: o.y ?? S.h * 0.7, ten_lop: o.ten || `Nút ${text}` });
}
const KHOI = {
  ten_vang: { ten: 'Tên vàng nổi khối', lam: () => [chu('{ten}', { fontFamily: 'Playfair Display', fontWeight: 900, fontSize: 104, fill: VANG(), stroke: '#3b2408', strokeWidth: 3, paintFirst: 'stroke', shadow: bong(), top: S.h * 0.6, ten_lop: 'Tên phim vàng' })] },
  watch_now: { ten: 'Nút WATCH NOW viền vàng', lam: () => [vienThuoc('WATCH NOW', { nen: '#141414', vien: '#e8b54a', day: 7, ten: 'Nút WATCH NOW' })] },
  watch_free_do: { ten: 'Nút Watch Free đỏ', lam: () => [vienThuoc('Watch Free', { nen: '#e1251b', w: S.w * 0.46, h: 104, gian: 0, dam: 700, ten: 'Nút Watch Free đỏ' })] },
  dai_free: { ten: 'Dải trắng WATCH FREE', lam: () => { const y = S.h * 0.12; return [new F.Rect({ left: 0, top: y, width: S.w, height: 96, fill: '#ffffff', ten_lop: 'Dải trắng' }), chu('WATCH MOVIES NOW! FREE', { fontFamily: 'Archivo Black', fontWeight: 400, fontSize: 50, fill: '#0a0a0a', width: S.w, left: 0, top: y + 18, ten_lop: 'Chữ dải trắng' })]; } },
  cau_nhu: { ten: 'Câu nhử trên đỉnh', lam: () => [chu('{cau_nhu}', { fontFamily: 'Playfair Display', fontWeight: 700, fontStyle: 'italic', fontSize: 64, shadow: bong('rgba(0,0,0,0.8)', 14, 0, 4), top: S.h * 0.12, ten_lop: 'Câu nhử' })] },
  nhan_vang: { ten: 'Nhãn All Episodes viền vàng', lam: () => [vienThuoc('{nhan}', { nen: 'rgba(10,10,10,0.82)', vien: '#d9a441', day: 3, h: 84, w: S.w * 0.7, mau: '#f2c24b', dam: 700, gian: 60, y: S.h * 0.14, ten: 'Nhãn tập' })] },
  free_do: { ten: 'Dải trắng + nút Free đỏ', lam: () => [new F.Rect({ left: 0, top: S.h * 0.14, width: S.w, height: 88, fill: '#ffffff', ten_lop: 'Dải nhãn' }), chu('{nhan}', { fontWeight: 900, fontSize: 46, fill: '#111111', width: S.w, left: 0, top: S.h * 0.14 + 18, ten_lop: 'Chữ nhãn' }), new F.Rect({ left: S.w * 0.3, top: S.h * 0.14 + 80, width: S.w * 0.4, height: 6, fill: '#e1251b', ten_lop: 'Gạch đỏ' }), vienThuoc('Watch For Free', { nen: '#e1251b', gian: 10, ten: 'Nút Watch For Free' })] },
  trinh_phat: { ten: 'Khung trình phát + nút play', lam: () => { const d = S.h * 0.22; return [new F.Rect({ left: 0, top: 0, width: S.w, height: d, fill: '#000000', ten_lop: 'Dải đen trên' }), new F.Rect({ left: 0, top: S.h - d, width: S.w, height: d, fill: '#000000', ten_lop: 'Dải đen dưới' }),
    new F.Group([new F.Circle({ radius: 80, fill: '#e1251b', originX: 'center', originY: 'center' }), new F.Triangle({ width: 70, height: 80, fill: '#ffffff', angle: 90, left: 8, originX: 'center', originY: 'center' })], { left: S.w / 2 - 80, top: S.h / 2 - 80, ten_lop: 'Nút play' }),
    chu('EXCLUSIVE', { fontFamily: 'Bebas Neue', fontWeight: 400, fontSize: 64, fill: '#e1251b', charSpacing: 200, top: S.h - d + 30, ten_lop: 'Nhãn EXCLUSIVE' }), chu('{ten}', { fontFamily: 'Oswald', fontWeight: 700, fontSize: 76, top: S.h - d + 110, ten_lop: 'Tên phim' })]; } },
  watch_more: { ten: 'Nhãn nhỏ WATCH MORE', lam: () => [chu('WATCH MORE', { fontFamily: 'Montserrat', fontWeight: 700, fontSize: 38, charSpacing: 300, top: S.h * 0.13, ten_lop: 'WATCH MORE' })] },
  phu_de: { ten: 'Phụ đề thoại', lam: () => [chu('Câu thoại của cảnh…', { fontFamily: 'Roboto Condensed', fontWeight: 700, fontSize: 50, stroke: '#000000', strokeWidth: 6, paintFirst: 'stroke', top: S.h * 0.58, ten_lop: 'Phụ đề' })] },
};
$('#dsKhoi').innerHTML = Object.entries(KHOI).map(([k, v]) => `<button data-khoi="${k}">${esc(v.ten)}</button>`).join('');

async function them(ds) {
  ds = [].concat(ds); ds.forEach((o) => { if (!o.ten_lop) o.ten_lop = tenMacDinh(o); cv.add(o); });
  await napPhong(); cv.setActiveObject(ds.at(-1)); cv.requestRenderAll();
}
function tenMacDinh(o) { return o.vai === 'anh_phim' ? 'Ô ảnh phim' : o.type === 'textbox' ? `Chữ: ${String(o.text).slice(0, 18)}` : o.type === 'image' ? 'Ảnh' : o.type === 'circle' ? 'Hình tròn' : o.type === 'group' ? 'Nhóm' : 'Khối'; }

async function themAnhPhim() {
  const im = await F.FabricImage.fromURL(ANH_CHO); im.set({ vai: 'anh_phim', ten_lop: 'Ô ảnh phim' }); phuKin(im);
  cv.add(im); cv.sendObjectToBack(im); cv.setActiveObject(im); cv.requestRenderAll();
}
async function themAnhTuMay() {
  const f = await chonTep(); if (!f) return;
  try { const im = await F.FabricImage.fromURL(await thuNho(await docTep(f))); const k = Math.min(1, (S.w * 0.8) / im.width); im.set({ scaleX: k, scaleY: k, left: (S.w - im.width * k) / 2, top: S.h * 0.3, ten_lop: f.name.slice(0, 40) }); await them(im); }
  catch (e) { bao(`Không nạp được ảnh: ${e.message}`, true); }
}

document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.khoi) return them(KHOI[b.dataset.khoi].lam());
  const t = b.dataset.them;
  if (t === 'anhPhim') return themAnhPhim();
  if (t === 'anh') return themAnhTuMay();
  if (t === 'chu') return them(chu('Chữ mới', { fontWeight: 700, fontSize: 64 }));
  if (t === 'hinh') return them(new F.Rect({ left: S.w * 0.2, top: S.h * 0.4, width: S.w * 0.6, height: 160, fill: '#e1251b', rx: 0, ry: 0 }));
  if (t === 'tron') return them(new F.Circle({ left: S.w / 2 - 90, top: S.h / 2 - 90, radius: 90, fill: '#ffffff' }));
  const l = b.dataset.lam;
  if (l) return LAM[l]?.(b);
  const lop = b.dataset.lop;
  if (lop) return lamLop(lop, Number(b.dataset.i));
});

// ── QC tham chiếu: ảnh DOM phủ lên khung (không phải lớp Fabric → không vào ảnh xuất), lưu kèm bản ở dạng thu nhỏ
function veThamChieu() { const a = $('#anhTC'); a.hidden = !S.tc; if (S.tc) a.src = S.tc; a.style.opacity = $('#moTC').value / 100; a.classList.toggle('duoi', !$('#tren').checked); cv.backgroundColor = S.tc && !$('#tren').checked ? 'rgba(0,0,0,0)' : '#111111'; cv.requestRenderAll(); }
$('#moTC').addEventListener('input', veThamChieu); $('#tren').addEventListener('change', veThamChieu);

// ── dữ liệu thử: thay {ten} {cau_nhu} {nhan} để nhìn bản thật; tắt thì trả chữ gốc
const thuGiaTri = () => Object.fromEntries([...document.querySelectorAll('[data-thu]')].map((i) => [i.dataset.thu, i.value]));
function duyetChu(f) { const di = (o) => { if (typeof o.text === 'string') f(o); (o._objects || []).forEach(di); }; cv.getObjects().forEach(di); }
function apThu() {
  S.im = true;
  duyetChu((o) => { if (S.thu) { if (o.chu_goc == null && /\{(ten|cau_nhu|nhan)\}/.test(o.text)) { o.chu_goc = o.text; } if (o.chu_goc != null) { const g = thuGiaTri(); o.set('text', o.chu_goc.replace(/\{(ten|cau_nhu|nhan)\}/g, (_, k) => g[k] || '')); } }
    else if (o.chu_goc != null) { o.set('text', o.chu_goc); o.chu_goc = undefined; } o.initDimensions?.(); });
  cv.getObjects().forEach((o) => o.setCoords()); cv.requestRenderAll(); S.im = false;
}
$('#xemThu').addEventListener('change', () => { S.thu = $('#xemThu').checked; apThu(); });
document.querySelectorAll('[data-thu]').forEach((i) => i.addEventListener('input', () => { if (S.thu) apThu(); }));
/** bản để lưu / xuất mẫu: luôn là chữ GỐC (có {ten}…), dù đang xem dữ liệu thử */
function jsonGoc() { const o = json(); const tra = (x) => { if (x.chu_goc != null) { x.text = x.chu_goc; delete x.chu_goc; } (x.objects || []).forEach(tra); }; o.objects.forEach(tra); return o; }

// ── danh sách lớp (trên cùng = lớp trên cùng)
function veLop() {
  const ds = cv.getObjects(), chon = new Set(cv.getActiveObjects());
  $('#dsLop').innerHTML = ds.map((o, i) => [o, i]).reverse().map(([o, i]) => `<li class="${chon.has(o) ? 'chon' : ''}" data-i="${i}"><span title="${esc(o.ten_lop)}">${o.vai === 'anh_phim' ? '🎬 ' : ''}${esc(o.ten_lop || tenMacDinh(o))}</span>
    <button data-lop="len" data-i="${i}" title="Đưa lên">↑</button><button data-lop="xuong" data-i="${i}" title="Đưa xuống">↓</button>
    <button data-lop="an" data-i="${i}" title="Ẩn / hiện">${o.visible ? '👁' : '·'}</button><button data-lop="khoa" data-i="${i}" title="Khoá / mở">${o.khoa_lop ? '🔒' : '🔓'}</button></li>`).join('') || '<li class="tk-mo">Chưa có lớp nào.</li>';
}
$('#dsLop').addEventListener('click', (ev) => { if (ev.target.closest('button')) return; const li = ev.target.closest('li[data-i]'); if (!li) return; const o = cv.getObjects()[Number(li.dataset.i)]; if (o && !o.khoa_lop) { cv.setActiveObject(o); cv.requestRenderAll(); } });
function khoaLai(o) { const k = !!o.khoa_lop; o.set({ selectable: !k, evented: !k }); }
function lamLop(viec, i) {
  const o = cv.getObjects()[i]; if (!o) return;
  if (viec === 'len') cv.bringObjectForward(o); if (viec === 'xuong') cv.sendObjectBackwards(o);
  if (viec === 'an') o.set('visible', !o.visible);
  if (viec === 'khoa') { o.khoa_lop = !o.khoa_lop; khoaLai(o); if (o.khoa_lop && cv.getActiveObject() === o) cv.discardActiveObject(); }
  cv.requestRenderAll(); chup(); veLop();
}

// ── thuộc tính lớp đang chọn
const so = (v, d = 0) => (Number.isFinite(+v) ? Math.round(+v * 10 ** d) / 10 ** d : 0);
const hex = (c) => { if (typeof c !== 'string') return '#ffffff'; if (/^#[0-9a-f]{6}$/i.test(c)) return c; const m = c.match(/\d+(\.\d+)?/g); return m && m.length >= 3 ? '#' + m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join('') : '#ffffff'; };
/** lớp chữ để chỉnh: chính nó, hoặc chữ trong nhóm (nút viên thuốc) */
const chuCua = (o) => (o?.type === 'textbox' ? o : o?._objects?.find((x) => x.type === 'textbox'));
const nenCua = (o) => (o?.type === 'group' ? o._objects.find((x) => x.type === 'rect' || x.type === 'circle') : ['rect', 'circle', 'triangle'].includes(o?.type) ? o : null);
function veThuocTinh(chiViTri = false) {
  const o = cv.getActiveObject(), h = $('#thuocTinh');
  if (!o) { h.innerHTML = '<p class="tk-mo">Chọn một lớp trên khung để chỉnh.</p>'; return; }
  if (chiViTri) { for (const [k, v] of Object.entries(viTri(o))) { const i = h.querySelector(`[data-tt="${k}"]`); if (i && document.activeElement !== i) i.value = v; } return; }
  if (o.type === 'activeselection') { h.innerHTML = `<p class="tk-mo">Đang chọn ${o._objects.length} lớp.</p><button data-lam="gop">Gộp thành một nhóm</button>`; return; }
  const t = chuCua(o), n = nenCua(o), vt = viTri(o), g = t && typeof t.fill === 'object' && t.fill?.colorStops;
  h.innerHTML = `<label>Tên lớp <input class="tk-o" data-tt="ten_lop" value="${esc(o.ten_lop || '')}"></label>
    <div class="tk-luoi2"><label>X <input class="tk-o" type="number" data-tt="x" value="${vt.x}"></label><label>Y <input class="tk-o" type="number" data-tt="y" value="${vt.y}"></label>
    <label>Rộng <input class="tk-o" type="number" data-tt="w" value="${vt.w}"></label><label>Cao <input class="tk-o" type="number" data-tt="h" value="${vt.h}"></label>
    <label>Xoay ° <input class="tk-o" type="number" data-tt="xoay" value="${vt.xoay}"></label><label>Độ hiện % <input class="tk-o" type="number" min="0" max="100" data-tt="mo" value="${so((o.opacity ?? 1) * 100)}"></label></div>
    <div class="tk-hang"><button data-lam="giuaNgang">Giữa ngang</button><button data-lam="nhanDoi">Nhân đôi</button><button data-lam="xoaLop">Gỡ lớp</button></div>
    ${o.type === 'image' ? `<label class="tk-hang"><input type="checkbox" data-tt="anh_phim" ${o.vai === 'anh_phim' ? 'checked' : ''}> Ô ảnh phim (máy thay bằng khung phim thật)</label>
      <div class="tk-hang"><button data-lam="doiAnh">Đổi ảnh…</button><button data-lam="phuKin">Phủ kín khung</button></div>` : ''}
    ${o.type === 'group' && !t ? '' : o.type === 'group' ? '<div class="tk-hang"><button data-lam="tachNhom">Tách nhóm</button></div>' : ''}
    ${t ? `<h3>Chữ</h3><textarea data-tt="text">${esc(t.chu_goc ?? t.text)}</textarea><p class="tk-ghichu">Dùng {ten} {cau_nhu} {nhan} cho chữ máy điền theo từng phim.</p>
      <div class="tk-luoi2"><label>Phông <select class="tk-o" data-tt="fontFamily">${PHONG.map((p) => `<option ${p === t.fontFamily ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
      <label>Cỡ <input class="tk-o" type="number" data-tt="fontSize" value="${so(t.fontSize)}"></label>
      <label>Độ đậm <select class="tk-o" data-tt="fontWeight">${[400, 500, 700, 900].map((w) => `<option ${+t.fontWeight === w ? 'selected' : ''}>${w}</option>`).join('')}</select></label>
      <label>Căn <select class="tk-o" data-tt="textAlign">${[['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']].map(([v, n2]) => `<option value="${v}" ${t.textAlign === v ? 'selected' : ''}>${n2}</option>`).join('')}</select></label>
      <label>Giãn chữ <input class="tk-o" type="number" data-tt="charSpacing" value="${so(t.charSpacing)}"></label><label>Giãn dòng <input class="tk-o" type="number" step="0.05" data-tt="lineHeight" value="${so(t.lineHeight, 2)}"></label></div>
      <label class="tk-hang"><input type="checkbox" data-tt="nghieng" ${t.fontStyle === 'italic' ? 'checked' : ''}> Nghiêng</label>
      <div class="tk-luoi3"><label>Màu <input type="color" data-tt="fill" value="${hex(g ? g[0].color : t.fill)}"></label>
      <label><span><input type="checkbox" data-tt="toChuyen" ${g ? 'checked' : ''}> Tô chuyển</span><input type="color" data-tt="fill2" value="${hex(g ? g.at(-1).color : '#9a6410')}"></label>
      <label>Viền <input type="color" data-tt="stroke" value="${hex(t.stroke || '#000000')}"></label></div>
      <div class="tk-luoi2"><label>Độ dày viền <input class="tk-o" type="number" min="0" data-tt="strokeWidth" value="${so(t.strokeWidth)}"></label>
      <label>Bóng mờ <input class="tk-o" type="number" min="0" data-tt="bongMo" value="${so(t.shadow?.blur)}"></label>
      <label>Bóng lệch Y <input class="tk-o" type="number" data-tt="bongY" value="${so(t.shadow?.offsetY)}"></label><label>Màu bóng <input type="color" data-tt="bongMau" value="${hex(t.shadow?.color || '#000000')}"></label></div>` : ''}
    ${n ? `<h3>Khối</h3><div class="tk-luoi3"><label>Nền <input type="color" data-tt="nFill" value="${hex(n.fill)}"></label><label>Viền <input type="color" data-tt="nStroke" value="${hex(n.stroke || '#000000')}"></label>
      <label>Dày viền <input class="tk-o" type="number" min="0" data-tt="nStrokeWidth" value="${so(n.strokeWidth)}"></label></div>
      ${n.type === 'rect' ? `<label>Bo góc <input class="tk-o" type="number" min="0" data-tt="nBo" value="${so(n.rx)}"></label>` : ''}
      <label class="tk-hang"><input type="checkbox" data-tt="nTrong" ${n.fill === 'transparent' || n.fill === null ? 'checked' : ''}> Nền trong suốt</label>` : ''}`;
}
function viTri(o) { const r = o.getBoundingRect(); return { x: so(o.left), y: so(o.top), w: so(o.getScaledWidth()), h: so(o.getScaledHeight()), xoay: so(o.angle), _r: r }; }
function doiThuocTinh(ev) {
  const i = ev.target, k = i.dataset.tt, o = cv.getActiveObject(); if (!k || !o) return;
  const v = i.type === 'checkbox' ? i.checked : i.type === 'number' ? Number(i.value) : i.value, t = chuCua(o), n = nenCua(o);
  switch (k) {
    case 'ten_lop': o.ten_lop = v; veLop(); break;
    case 'x': o.set('left', v); break; case 'y': o.set('top', v); break; case 'xoay': o.rotate(v); break; case 'mo': o.set('opacity', Math.max(0, Math.min(100, v)) / 100); break;
    case 'w': if (o.type === 'textbox') o.set('width', v / (o.scaleX || 1)); else o.set('scaleX', v / o.width); break;
    case 'h': if (o.type !== 'textbox') o.set('scaleY', v / o.height); break;
    case 'anh_phim': o.vai = v ? 'anh_phim' : undefined; veLop(); break;
    case 'text': if (t.chu_goc != null) { t.chu_goc = v; apThu(); } else t.set('text', v); break;
    case 'nghieng': t.set('fontStyle', v ? 'italic' : 'normal'); break;
    case 'fill': case 'fill2': case 'toChuyen': {
      const a = ev.currentTarget.querySelector('[data-tt="fill"]').value, b = ev.currentTarget.querySelector('[data-tt="fill2"]').value, chuyen = ev.currentTarget.querySelector('[data-tt="toChuyen"]').checked;
      t.set('fill', chuyen ? new F.Gradient({ type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 0, y2: 1 }, colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }] }) : a); break; }
    case 'stroke': t.set('stroke', v); if (!t.strokeWidth) t.set('strokeWidth', 3); t.set('paintFirst', 'stroke'); break;
    case 'strokeWidth': t.set({ strokeWidth: v, paintFirst: 'stroke' }); break;
    case 'bongMo': case 'bongY': case 'bongMau': { const s = t.shadow || bong('#000000', 0, 0, 0); t.set('shadow', new F.Shadow({ color: k === 'bongMau' ? v : s.color, blur: k === 'bongMo' ? v : s.blur, offsetX: 0, offsetY: k === 'bongY' ? v : s.offsetY })); break; }
    case 'fontFamily': case 'fontWeight': case 'fontSize': case 'textAlign': case 'charSpacing': case 'lineHeight': t.set(k, k === 'fontWeight' ? Number(v) : v); break;
    case 'nFill': n.set('fill', v); break; case 'nStroke': n.set('stroke', v); if (!n.strokeWidth) n.set('strokeWidth', 4); break; case 'nStrokeWidth': n.set('strokeWidth', v); break;
    case 'nBo': n.set({ rx: v, ry: v }); break; case 'nTrong': n.set('fill', v ? 'transparent' : '#e1251b'); break;
    default: return;
  }
  const lam = async () => { if (t && /^font|text|nghieng/.test(k)) { await napPhong(); } if (o.type === 'group') { o.triggerLayout?.(); } o.setCoords(); cv.requestRenderAll(); chup(); };
  lam();
}
$('#thuocTinh').addEventListener('input', doiThuocTinh);
$('#thuocTinh').addEventListener('change', (ev) => { if (ev.target.tagName === 'SELECT' || ev.target.type === 'checkbox') doiThuocTinh(ev); });

// ── nút trên thanh + nút trong thuộc tính
const LAM = {
  moi: () => { if (cv.getObjects().length && !confirm('Mở bản trống mới? Bản đang vẽ chưa lưu sẽ chỉ còn trong nháp trình duyệt.')) return; S.id = null; S.tc = null; $('#tenBan').value = ''; $('#maMau').value = ''; veNutMau(); $('#thuMuc').value = QL.tm === '*' ? '' : QL.tm; cv.clear(); cv.backgroundColor = '#111111'; S.hoan = []; chup(); veThamChieu(); veLop(); veThuocTinh(); },
  hoanTac, lamLai,
  xuat: () => { cv.discardActiveObject(); cv.requestRenderAll(); const a = document.createElement('a'); a.download = `${($('#tenBan').value || 'thiet-ke').replace(/[^\p{L}\p{N}]+/gu, '-')}-${S.w}x${S.h}.png`; a.href = cv.toDataURL({ format: 'png', multiplier: S.w / cv.width }); a.click(); },
  luu, mo, chonMau: () => moHopMau(), apPhim: () => moHopPhim(),
  thamChieu: async () => { const f = await chonTep(); if (!f) return; try { S.tc = await thuNho(await docTep(f), 900); veThamChieu(); chup(); } catch (e) { bao(`Không nạp được ảnh tham chiếu: ${e.message}`, true); } },
  boThamChieu: () => { S.tc = null; veThamChieu(); },
  giuaNgang: () => { const o = cv.getActiveObject(); if (o) { const r = o.getBoundingRect(); o.set('left', o.left + (S.w - r.width) / 2 - r.left); o.setCoords(); cv.requestRenderAll(); chup(); veThuocTinh(); } },
  nhanDoi: async () => { const o = cv.getActiveObject(); if (!o) return; const c = await o.clone(RIENG); c.set({ left: o.left + 30, top: o.top + 30 }); c.ten_lop = `${o.ten_lop || tenMacDinh(o)} (bản sao)`; await them(c); },
  xoaLop: () => { cv.getActiveObjects().forEach((o) => cv.remove(o)); cv.discardActiveObject(); cv.requestRenderAll(); },
  gop: () => { const a = cv.getActiveObject(); if (a?.type !== 'activeselection') return; const ds = a.removeAll(); ds.forEach((o) => cv.remove(o)); const g = new F.Group(ds, { ten_lop: 'Nhóm' }); cv.add(g); cv.setActiveObject(g); cv.requestRenderAll(); },
  tachNhom: () => { const g = cv.getActiveObject(); if (g?.type !== 'group') return; const ds = g.removeAll(); cv.remove(g); ds.forEach((o) => cv.add(o)); cv.setActiveObject(new F.ActiveSelection(ds, { canvas: cv })); cv.requestRenderAll(); },
  doiAnh: async () => { const o = cv.getActiveObject(); if (o?.type !== 'image') return; const f = await chonTep(); if (!f) return; const w = o.getScaledWidth(), h = o.getScaledHeight(), x = o.left, y = o.top;
    await o.setSrc(await thuNho(await docTep(f))); o.set({ scaleX: 1, scaleY: 1 }); phuKin(o, w, h, x, y); o.setCoords(); cv.requestRenderAll(); chup(); },
  phuKin: () => { const o = cv.getActiveObject(); if (o?.type !== 'image') return; o.set({ angle: 0 }); phuKin(o); o.setCoords(); cv.requestRenderAll(); chup(); veThuocTinh(); },
};

// ── lưu / mở
async function luu() {
  const ten = $('#tenBan').value.trim(); if (!ten) { $('#tenBan').focus(); return bao('Đặt tên cho bản thiết kế trước khi lưu.', true); }
  cv.discardActiveObject(); cv.requestRenderAll();
  const du = { ban: 1, fabric: jsonGoc(), tham_chieu: S.tc ? { anh: S.tc, mo: Number($('#moTC').value), tren: $('#tren').checked } : null, du_lieu_thu: thuGiaTri() };
  const anh = cv.toDataURL({ format: 'jpeg', quality: 0.8, multiplier: 240 / cv.width });
  try { S.id = await ghi('luuThietKe', { id: S.id, ten, ma_mau: $('#maMau').value || null, thu_muc: $('#thuMuc').value, rong: S.w, cao: S.h, du_lieu: du, anh_xem: anh }); history.replaceState(null, '', `?id=${S.id}`); const tm = chuanTM($('#thuMuc').value); $('#thuMuc').value = tm; QL.ban = null; napTM(); bao(`Đã lưu bản #${S.id} “${ten}” vào ${tm ? '📁 ' + tm : 'thư mục gốc'}.`); }
  catch (e) { bao(`Chưa lưu được: ${e.message}`, true); }
}
// ── quản lý tệp: thư mục dạng đường 'a/b' ('' = gốc, '*' = mọi bản mới sửa). Thư mục là cột thu_muc + bảng xv_thiet_ke_thu_muc (giữ thư mục trống) — actions-thiet-ke.ts
const QL = { tm: '', ban: null, cay: [], tim: '' };
const chuanTM = (x) => String(x ?? '').split('/').map((t) => t.trim().replace(/\s+/g, ' ').slice(0, 60)).filter(Boolean).slice(0, 6).join('/');
const chaTM = (d) => d.split('/').slice(0, -1).join('/'), tenTM = (d) => d.split('/').at(-1);
/** cây thư mục cho ô chọn thư mục trên thanh + hộp Mở (đọc lại sau mỗi lần đổi) */
async function napTM() { try { QL.cay = await doc('dsThuMucTK'); } catch { QL.cay = QL.cay || []; } $('#dsTM').innerHTML = QL.cay.map((d) => `<option value="${esc(d)}">`).join(''); return QL.cay; }
async function mo() {
  const h = $('#hopMo'); if (!h.open) h.showModal();
  if (!QL.ban) { $('#dsBan').innerHTML = '<p class="tk-mo">Đang đọc…</p>'; try { [QL.ban] = await Promise.all([doc('dsThietKe'), napTM()]); } catch (e) { $('#dsBan').innerHTML = `<p class="tk-bao loi">Không đọc được danh sách: ${esc(e.message)}</p>`; return; } }
  veQL();
}
function veQL() {
  const ban = QL.ban || [], cay = QL.cay, tm = QL.tm, tim = QL.tim.trim().toLowerCase();
  const dem = (d) => ban.filter((b) => b.thu_muc === d || b.thu_muc.startsWith(d + '/')).length;
  const nut = (d, nhan, sau, so) => `<button data-di="${esc(d)}" data-tha="${esc(d)}" class="${d === tm && !tim ? 'chon' : ''}" style="padding-left:${6 + sau * 14}px" title="${esc(d || 'Thư mục gốc')}"><span>${nhan}</span><small>${so}</small></button>`;
  $('#cayTM').innerHTML = nut('*', '🕘 Mới sửa (mọi thư mục)', 0, ban.length) + nut('', '🏠 Gốc', 0, ban.filter((b) => !b.thu_muc).length)
    + cay.map((d) => nut(d, `📁 ${esc(tenTM(d))}`, d.split('/').length, dem(d))).join('');
  const vet = tim ? [`🔎 “${esc(QL.tim)}”`] : tm === '*' ? ['🕘 Mới sửa'] : ['<button data-di="">🏠 Gốc</button>', ...tm.split('/').filter(Boolean).map((t, i, a) => `<button data-di="${esc(a.slice(0, i + 1).join('/'))}">${esc(t)}</button>`)];
  $('#tmVet').innerHTML = vet.join('<span>›</span>');
  $('#tmDoi').disabled = !!tim || tm === '' || tm === '*';
  const con = tim || tm === '*' ? [] : cay.filter((d) => chaTM(d) === tm);
  const ds = tim ? ban.filter((b) => `${b.ten} ${b.ma_mau || ''} ${b.thu_muc} #${b.id}`.toLowerCase().includes(tim)) : tm === '*' ? ban.slice(0, 60) : ban.filter((b) => b.thu_muc === tm);
  const chon = `<option value="">Chuyển tới…</option><option value="/">🏠 Gốc</option>${cay.map((d) => `<option value="${esc(d)}">📁 ${esc(d)}</option>`).join('')}<option value="+">+ thư mục mới…</option>`;
  $('#dsBan').innerHTML = con.map((d) => `<button class="tk-tm" data-di="${esc(d)}" data-tha="${esc(d)}" draggable="true" data-keo-tm="${esc(d)}"><b>📁</b>${esc(tenTM(d))}<span class="tk-ghichu">${dem(d)} bản</span></button>`).join('')
    + ds.map((b) => `<div class="tk-the${b.id === S.id ? ' dang' : ''}" draggable="true" data-keo="${b.id}"><button class="tk-the-mo" data-mo="${b.id}" title="Mở bản này"><img src="${esc(b.anh_xem || '')}" alt=""><strong>#${b.id} ${esc(b.ten)}</strong></button>
      <span class="tk-ghichu">${b.rong}×${b.cao}${b.ma_mau ? ' · ' + esc(b.ma_mau) : ''}${(tim || tm === '*') ? `<br>${b.thu_muc ? '📁 ' + esc(b.thu_muc) : '🏠 gốc'}` : ''}</span>
      <div class="tk-the-hang"><select class="tk-o" data-chuyen="${b.id}" title="Chuyển bản này sang thư mục khác">${chon}</select><button data-cat="${b.id}" title="Ẩn khỏi danh sách (không xoá)">Cất đi</button></div></div>`).join('')
    || '';
  if (!con.length && !ds.length) $('#dsBan').innerHTML = `<p class="tk-mo">${tim ? 'Không có bản nào khớp.' : 'Thư mục trống. Bấm Lưu khi ô 📁 trên thanh ghi thư mục này để cất bản vào đây, hoặc kéo bản từ thư mục khác thả vào.'}</p>`;
}
/** mọi thao tác thư mục: làm xong thì đọc lại cả danh sách lẫn cây (vài trăm dòng, rẻ) */
async function lamQL(viec, tb) { try { await viec(); QL.ban = null; await mo(); if (tb) bao(tb); } catch (e) { bao(`Chưa làm được: ${e.message}`, true); } }
const chuyenBan = (id, d) => lamQL(async () => { await ghi('chuyenThuMucTK', [id], d); if (id === S.id) $('#thuMuc').value = d; }, `Đã chuyển bản #${id} vào ${d ? '📁 ' + d : 'thư mục gốc'}.`);
const chuyenTM = (a, cha) => { const b = chuanTM(cha ? `${cha}/${tenTM(a)}` : tenTM(a)); if (b === a || b.startsWith(a + '/')) return; return lamQL(async () => { await ghi('doiThuMucTK', a, b); if (QL.tm === a || QL.tm.startsWith(a + '/')) QL.tm = b + QL.tm.slice(a.length); }, `Đã chuyển thư mục “${a}” thành “${b}”.`); };
$('#hopMo').addEventListener('click', (ev) => {
  const t = ev.target.closest('button'); if (!t || t.tagName !== 'BUTTON') return;
  if (t.dataset.tm === 'dong') return $('#hopMo').close();
  if (t.dataset.mo) { $('#hopMo').close(); return moBan(Number(t.dataset.mo)); }
  if (t.dataset.di !== undefined) { QL.tm = t.dataset.di; QL.tim = ''; $('#timBan').value = ''; return veQL(); }
  if (t.dataset.cat) { const b = QL.ban?.find((x) => x.id === Number(t.dataset.cat)); if (!confirm(`Cất bản #${t.dataset.cat} “${b?.ten || ''}” khỏi danh sách? (Không xoá — bản vẫn còn trong kho.)`)) return; return lamQL(() => ghi('luuTruThietKe', Number(t.dataset.cat), true), `Đã cất bản #${t.dataset.cat}.`); }
  if (t.dataset.tm === 'moi') { const goc = QL.tm === '*' ? '' : QL.tm, ten = chuanTM(prompt(`Tên thư mục mới${goc ? ` (nằm trong “${goc}”)` : ''} — gõ a/b để lồng:`) || ''); if (!ten) return;
    const d = chuanTM(goc ? `${goc}/${ten}` : ten); return lamQL(async () => { await ghi('taoThuMucTK', d); QL.tm = d; }, `Đã tạo 📁 ${d}.`); }
  if (t.dataset.tm === 'doi') { const a = QL.tm, b = chuanTM(prompt('Tên mới (gõ cả đường để chuyển chỗ, vd “Ethopex/Tên vàng”):', a) || ''); if (!b || b === a) return;
    return lamQL(async () => { await ghi('doiThuMucTK', a, b); QL.tm = b; if (chuanTM($('#thuMuc').value).startsWith(a)) $('#thuMuc').value = b + chuanTM($('#thuMuc').value).slice(a.length); }, `Đã đổi “${a}” thành “${b}”.`); }
});
$('#hopMo').addEventListener('change', (ev) => {
  const id = Number(ev.target.dataset.chuyen); if (!id) return; let v = ev.target.value; ev.target.value = ''; if (!v) return;
  if (v === '+') { v = chuanTM(prompt('Tên thư mục mới (gõ a/b để lồng):') || ''); if (!v) return; }
  chuyenBan(id, v === '/' ? '' : v);
});
$('#timBan').addEventListener('input', (ev) => { QL.tim = ev.target.value; veQL(); });
// kéo-thả: bản → thư mục (chuyển bản) · thư mục → thư mục (chuyển cả thư mục vào trong)
$('#hopMo').addEventListener('dragstart', (ev) => { const k = ev.target.closest('[data-keo],[data-keo-tm]'); if (!k) return; ev.dataTransfer.setData('text/plain', k.dataset.keo ? `ban:${k.dataset.keo}` : `tm:${k.dataset.keoTm}`); ev.dataTransfer.effectAllowed = 'move'; });
$('#hopMo').addEventListener('dragover', (ev) => { const d = ev.target.closest('[data-tha]'); if (!d || d.dataset.tha === '*') return; ev.preventDefault(); document.querySelectorAll('.tk-tha').forEach((x) => x !== d && x.classList.remove('tk-tha')); d.classList.add('tk-tha'); });
$('#hopMo').addEventListener('dragleave', (ev) => ev.target.closest?.('[data-tha]')?.classList.remove('tk-tha'));
$('#hopMo').addEventListener('drop', (ev) => {
  const d = ev.target.closest('[data-tha]'); document.querySelectorAll('.tk-tha').forEach((x) => x.classList.remove('tk-tha')); if (!d || d.dataset.tha === '*') return; ev.preventDefault();
  const [loai, gt] = ev.dataTransfer.getData('text/plain').split(/:(.*)/s);
  if (loai === 'ban') { const b = QL.ban?.find((x) => x.id === Number(gt)); if (b && b.thu_muc !== d.dataset.tha) chuyenBan(b.id, d.dataset.tha); }
  if (loai === 'tm' && gt !== d.dataset.tha) chuyenTM(gt, d.dataset.tha);
});
async function datKho(w, h) { S.w = w; S.h = h; $('#kho').value = `${w}x${h}`; if (![...$('#kho').options].some((o) => o.value === `${w}x${h}`)) $('#kho').add(new Option(`${w}×${h}`, `${w}x${h}`)); vuaKhung(); }
async function moBan(id) {
  try { const b = await doc('docThietKe', id); if (!b) return bao(`Không có bản #${id}.`, true);
    S.id = b.id; $('#tenBan').value = b.ten; $('#maMau').value = b.ma_mau || ''; veNutMau(); $('#thuMuc').value = b.thu_muc || ''; await datKho(b.rong, b.cao);
    const d = b.du_lieu || {}; S.tc = d.tham_chieu?.anh || null; if (d.tham_chieu) { $('#moTC').value = d.tham_chieu.mo ?? 45; $('#tren').checked = !!d.tham_chieu.tren; }
    for (const [k, v] of Object.entries(d.du_lieu_thu || {})) { const i = document.querySelector(`[data-thu="${k}"]`); if (i) i.value = v; }
    S.hoan = []; await nap(d.fabric || { objects: [] }); chup(); veThamChieu(); if (S.thu) apThu(); history.replaceState(null, '', `?id=${b.id}`); bao(`Đã mở bản #${b.id} “${b.ten}”.`); }
  catch (e) { bao(`Không mở được bản #${id}: ${e.message}`, true); }
}
$('#kho').addEventListener('change', () => { const [w, h] = $('#kho').value.split('x').map(Number); datKho(w, h); });

// ── phím tắt (bỏ qua khi đang gõ trong ô nhập hoặc đang sửa chữ trên khung)
document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || cv.getActiveObject()?.isEditing) return;
  const m = e.metaKey || e.ctrlKey, o = cv.getActiveObject();
  if (m && e.key.toLowerCase() === 'z') { e.preventDefault(); return e.shiftKey ? lamLai() : hoanTac(); }
  if (m && e.key.toLowerCase() === 's') { e.preventDefault(); return luu(); }
  if (m && e.key.toLowerCase() === 'd') { e.preventDefault(); return LAM.nhanDoi(); }
  if (!o) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return LAM.xoaLop(); }
  const d = e.shiftKey ? 10 : 1, mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
  if (mv) { e.preventDefault(); o.set({ left: o.left + mv[0], top: o.top + mv[1] }); o.setCoords(); cv.requestRenderAll(); chup(); veThuocTinh(true); }
});

// ── chọn mẫu etp BẰNG ẢNH (anh 20/11/2026: "phải trực quan, cho xem trước, thông tin đầy đủ") — #maMau là ô ẩn giữ mã, nút trên thanh hiện ảnh + tên
const MAU = { ds: [], nhom: '', tim: '', chon: '' };
const anhNho = new Map();
/** 'mau-cr:<tệp>' → data URL qua máy chủ (ảnh nằm trong repo etp2, studio2 không phục vụ thẳng) · link https dùng nguyên */
function srcAnh(src) { if (!/^mau-cr:/.test(src)) return Promise.resolve(src); if (!anhNho.has(src)) anhNho.set(src, doc('anhMauCrS2', src).catch(() => null)); return anhNho.get(src); }
const xemAnh = new IntersectionObserver((ds) => ds.forEach((d) => { if (!d.isIntersecting) return; xemAnh.unobserve(d.target); const i = d.target;
  srcAnh(i.dataset.src).then((u) => { if (u) i.src = u; else i.replaceWith(Object.assign(document.createElement('span'), { textContent: 'ảnh không tải được' })); }); }), { rootMargin: '200px' });
const lazy = (root) => root.querySelectorAll('img[data-src]').forEach((i) => xemAnh.observe(i));
const mauCua = (ma) => MAU.ds.find((m) => m.ma === ma);
const nhanTT = (t) => `<span class="tk-nhan ${/chạy|dùng|duyệt|on|live/i.test(t) ? 'ok' : /tắt|bỏ|off|cũ/i.test(t) ? 'xam' : ''}">${esc(t || 'chưa ghi trạng thái')}</span>`;
async function napMau() { MAU.ds = await doc('dsMauCrS2') || []; veNutMau(); }
function veNutMau() {
  const m = mauCua($('#maMau').value), a = $('#nutMau .tk-nut-mau-anh');
  $('#nutMau .tk-nut-mau-chu').textContent = m ? `${m.ma} · ${m.ten}` : $('#maMau').value ? `${$('#maMau').value} (mẫu không còn trong sổ)` : '— không gắn mẫu etp —';
  a.style.backgroundImage = ''; const s = m?.anh?.[0]?.src; if (s) srcAnh(s).then((u) => { if (u && mauCua($('#maMau').value) === m) a.style.backgroundImage = `url("${u}")`; });
}
async function moHopMau() {
  if (!MAU.ds.length) { try { await napMau(); } catch (e) { return bao(`Không đọc được danh sách mẫu etp: ${e.message}`, true); } }
  MAU.chon = $('#maMau').value || MAU.ds[0]?.ma || ''; veHopMau(); $('#hopMau').showModal();
  $(`#dsMau [data-ma="${CSS.escape(MAU.chon)}"]`)?.scrollIntoView({ block: 'nearest' });
}
function veHopMau() {
  const nhom = [...new Set(MAU.ds.map((m) => m.nhom || 'khác'))];
  $('#mauNhom').innerHTML = ['', ...nhom].map((n) => `<button data-mau-nhom="${esc(n)}" class="${MAU.nhom === n ? 'chon' : ''}">${n ? esc(n) : 'Tất cả'} <small>${n ? MAU.ds.filter((m) => (m.nhom || 'khác') === n).length : MAU.ds.length}</small></button>`).join('');
  const q = MAU.tim.toLowerCase(), dang = $('#maMau').value;
  const ds = MAU.ds.filter((m) => (!MAU.nhom || (m.nhom || 'khác') === MAU.nhom) && (!q || `${m.ma} ${m.ten} ${m.mo_ta} ${m.loai}`.toLowerCase().includes(q)));
  $('#dsMau').innerHTML = ds.map((m) => `<button class="tk-mau-the ${m.ma === MAU.chon ? 'chon' : ''} ${m.ma === dang ? 'dang' : ''}" data-ma="${esc(m.ma)}" title="${esc(m.mo_ta)}">
      <span class="tk-mau-anh">${m.anh[0] ? `<img data-src="${esc(m.anh[0].src)}" alt="">` : `<span class="tk-mau-chu"><i>chưa có ảnh mẫu</i>${esc(m.mo_ta.slice(0, 220))}</span>`}${m.anh.length > 1 ? `<span class="tk-so-anh">${m.anh.length} ảnh</span>` : ''}</span>
      <b>${esc(m.ten)}</b><small>${esc(m.ma)}${m.ma === dang ? ' · đang gắn' : ''}</small><span>${nhanTT(m.trang_thai)}</span></button>`).join('') || '<p class="tk-mo">Không có mẫu khớp.</p>';
  lazy($('#dsMau')); veCtMau();
}
function veCtMau() {
  const m = mauCua(MAU.chon), ct = $('#ctMau'); if (!m) { ct.innerHTML = '<p class="tk-mo">Chọn một mẫu bên trái để xem đủ ảnh và thông tin.</p>'; return; }
  const dong = (k, v) => (v && (!Array.isArray(v) || v.length) ? `<dt>${k}</dt><dd>${esc(Array.isArray(v) ? v.join(', ') : v)}</dd>` : '');
  ct.innerHTML = `<h4>${esc(m.ten)}</h4><div>${nhanTT(m.trang_thai)} <span class="tk-nhan xam">${esc(m.ma)}</span> ${m.nhom ? `<span class="tk-nhan xam">${esc(m.nhom)}</span>` : ''}</div>
    ${m.anh.length ? `<div class="tk-mau-dai">${m.anh.map((a) => `<figure><img data-src="${esc(a.src)}" alt="" data-phong="1"><figcaption>${esc(a.nhan)}</figcaption></figure>`).join('')}</div>` : '<p class="tk-mo">Mẫu này chưa có ảnh mẫu nào trong kho etp (chưa máy dựng, chưa có QC gốc).</p>'}
    ${m.mo_ta ? `<p>${esc(m.mo_ta)}</p>` : ''}
    <dl>${dong('Loại', m.loai)}${dong('Dạng', m.dang)}${dong('Nhãn', m.nhan)}${dong('Dùng cho', m.dung_cho)}${dong('Thể loại', m.the_loai)}${dong('Máy dựng', m.may)}</dl>
    ${m.quy_trinh.length ? `<div><h3>Quy trình máy dựng</h3><ol>${m.quy_trinh.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
    <div class="tk-mau-nut"><button class="tk-chinh" data-mau="gan">Gắn mẫu này</button><button data-mau="bo">Không gắn mẫu</button></div>`;
  lazy(ct);
}
function ganMau(ma) { $('#maMau').value = ma; veNutMau(); nhapNhap(); $('#hopMau').close(); bao(ma ? `Bản này gắn mẫu ${ma} — bấm Lưu để giữ.` : 'Đã bỏ gắn mẫu etp — bấm Lưu để giữ.'); }
$('#hopMau').addEventListener('click', (ev) => {
  const i = ev.target.closest('img[data-phong]'); if (i?.src) return window.open(i.src, '_blank', 'noopener');
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.mauNhom != null) { MAU.nhom = b.dataset.mauNhom; return veHopMau(); }
  if (b.dataset.ma) { MAU.chon = b.dataset.ma; document.querySelectorAll('#dsMau .tk-mau-the').forEach((x) => x.classList.toggle('chon', x === b)); return veCtMau(); }
  if (b.dataset.mau === 'dong') return $('#hopMau').close();
  if (b.dataset.mau === 'gan') return ganMau(MAU.chon);
  if (b.dataset.mau === 'bo') return ganMau('');
});
$('#hopMau').addEventListener('dblclick', (ev) => { const b = ev.target.closest('.tk-mau-the'); if (b) ganMau(b.dataset.ma); });
$('#timMau').addEventListener('input', () => { MAU.tim = $('#timMau').value.trim(); veHopMau(); });

// ── TEMPLATE áp lên PHIM THẬT (anh 20/11/2026: "mỗi phim khi áp dụng sẽ nhìn thấy kết quả khác nhau") — mỗi phim vẽ trên một khung ẩn từ bản gốc ({ten}…),
//    {ten} = tên phim, ô ảnh phim = ảnh bìa thật, {cau_nhu} / {nhan} = dữ liệu thử bên trái (máy sinh câu nhử lúc dựng). Khung đang sửa không bị đụng.
const PT = { ds: null, kq: new Map(), luot: 0 };
async function moHopPhim() {
  $('#ptLon').hidden = true; $('#hopPhim').showModal();
  if (!PT.ds) { $('#ptLuoi').innerHTML = '<p class="tk-mo">Đang đọc danh sách phim…</p>'; try { PT.ds = await doc('dsPhimThuS2') || []; } catch (e) { PT.ds = null; $('#ptLuoi').innerHTML = `<p class="tk-bao loi">Không đọc được phim: ${esc(e.message)}</p>`; return; } }
  veLuoiPhim();
}
async function veLuoiPhim() {
  const luot = ++PT.luot, goc = jsonGoc(), g = thuGiaTri(), co = !!cv.getObjects().some((o) => o.vai === 'anh_phim');
  $('#ptGhi').textContent = `${PT.ds.length} phim có ảnh bìa sạch · {cau_nhu} = “${g.cau_nhu.slice(0, 40)}${g.cau_nhu.length > 40 ? '…' : ''}”, {nhan} = “${g.nhan}” (dữ liệu thử)${co ? '' : ' · bản này CHƯA có Ô ảnh phim nên ảnh phim không hiện'}`;
  if (!PT.ds.length) { $('#ptLuoi').innerHTML = '<p class="tk-mo">Kho etp chưa có phim nào có ảnh bìa sạch.</p>'; return; }
  $('#ptLuoi').innerHTML = PT.ds.map((p, i) => `<button class="tk-pt" data-pt-i="${i}"><span class="tk-pt-anh" style="aspect-ratio:${S.w}/${S.h}">đang vẽ…</span><b>${esc(p.ten)}</b><small>#${p.content_id}${p.locale ? ' · ' + esc(p.locale) : ''} · ${p.ten.length} ký tự</small></button>`).join('');
  PT.kq.clear(); let i = 0;
  const lam = async () => { while (i < PT.ds.length && luot === PT.luot) { const k = i++, p = PT.ds[k];
    const o = $(`#ptLuoi [data-pt-i="${k}"] .tk-pt-anh`);
    try { const kq = await veLenPhim(goc, p, g); if (luot !== PT.luot) return; PT.kq.set(k, kq);
      o.innerHTML = `<img src="${kq.url}" alt="">${kq.tran.length ? `<span class="tk-tran" title="${esc(kq.tran.join(' · '))}">⚠ chữ tràn</span>` : ''}`; }
    catch (e) { o.textContent = `không vẽ được: ${e.message}`; } } };
  await Promise.all([lam(), lam(), lam()]);
}
async function anhPhim(id) { const k = `phim:${id}`; if (!anhNho.has(k)) anhNho.set(k, doc('anhPhimS2', id).catch(() => null)); return anhNho.get(k); }
async function veLenPhim(goc, p, g) {
  const sc = new F.StaticCanvas(null, { width: S.w, height: S.h, renderOnAddRemove: false });
  try {
    await sc.loadFromJSON(JSON.parse(JSON.stringify(goc)));
    const thay = (o) => { if (typeof o.text === 'string' && /\{(ten|cau_nhu|nhan)\}/.test(o.text)) { o.set('text', o.text.replace(/\{(ten|cau_nhu|nhan)\}/g, (_, k) => (k === 'ten' ? p.ten : g[k] || ''))); o.initDimensions?.(); }
      (o._objects || []).forEach(thay); if (o.type === 'group') o.triggerLayout?.(); };
    sc.getObjects().forEach(thay);
    const o = sc.getObjects().filter((x) => x.vai === 'anh_phim');
    if (o.length) { const u = await anhPhim(p.content_id); if (u) for (const im of o) { const w = im.getScaledWidth(), h = im.getScaledHeight(), x = im.left, y = im.top; await im.setSrc(u); im.set({ scaleX: 1, scaleY: 1 }); phuKin(im, w, h, x, y); } }
    const tran = [];   // chữ nào thò ra ngoài khung, hoặc dài xuống vùng chắc chắn bị nút / chữ QC che (80% — vạch đỏ cuối), sau khi thay tên thật
    const coChu = (x) => typeof x.text === 'string' || (x._objects || []).some(coChu);
    const xet = (x) => { if (!coChu(x)) return; x.setCoords(); const r = x.getBoundingRect(), ten = x.ten_lop || String(x.text || 'nhóm chữ').slice(0, 24);
      if (r.left < -2 || r.top < -2 || r.left + r.width > S.w + 2 || r.top + r.height > S.h + 2) tran.push(`${ten}: ra ngoài khung`);
      else if (S.h > S.w && r.top < S.h * 0.8 && r.top + r.height > S.h * 0.8 + 2) tran.push(`${ten}: lấn xuống vùng bị che (80%)`); };
    sc.getObjects().forEach(xet);
    sc.renderAll();
    return { url: sc.toDataURL({ format: 'jpeg', quality: 0.86, multiplier: Math.min(1, 560 / S.w) }), tran };
  } finally { sc.dispose(); }
}
$('#ptCo').addEventListener('input', () => $('#ptLuoi').style.setProperty('--co', `${$('#ptCo').value}px`));
$('#hopPhim').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) { if (ev.target.closest('#ptLon') && !ev.target.closest('#ptLon div')) $('#ptLon').hidden = true; return; }
  if (b.dataset.pt === 'dong') return $('#hopPhim').close();
  if (b.dataset.pt === 'lai') { $('#ptLon').hidden = true; return veLuoiPhim(); }
  if (b.dataset.pt === 'tat') { $('#ptLon').hidden = true; return; }
  if (b.dataset.pt === 'thu') { const p = PT.ds[+b.dataset.i]; $('[data-thu="ten"]').value = p.ten; $('#xemThu').checked = true; S.thu = true; apThu(); $('#hopPhim').close(); return bao(`Khung đang sửa hiện tên “${p.ten}” (chỉ là dữ liệu thử, bản lưu vẫn giữ {ten}).`); }
  if (b.dataset.ptI != null) { const k = +b.dataset.ptI, kq = PT.kq.get(k), p = PT.ds[k]; if (!kq) return;
    $('#ptLon').innerHTML = `<img src="${kq.url}" alt=""><div><strong>${esc(p.ten)}</strong><p>#${p.content_id}${p.locale ? ' · ' + esc(p.locale) : ''} · tên dài ${p.ten.length} ký tự</p>
      ${kq.tran.length ? `<p style="color:#ff8a80">⚠ ${esc(kq.tran.join(' · '))} — sửa cỡ chữ / độ rộng khung chữ rồi bấm ↻ Vẽ lại.</p>` : '<p>Chữ nằm gọn trong khung.</p>'}
      ${p.mo_ta ? `<p>${esc(p.mo_ta)}</p>` : ''}<button data-pt="thu" data-i="${k}">Xem tên phim này trên khung đang sửa</button><button data-pt="tat">Đóng ảnh lớn</button></div>`;
    $('#ptLon').hidden = false; }
});

// ── khởi động: mẫu etp để gắn · mở bản trên URL, hoặc nháp, hoặc bản trống có sẵn ô ảnh phim
(async () => {
  vuaKhung(); napTM();
  napMau().catch((e) => bao(`Không đọc được danh sách mẫu etp: ${e.message}`, true));
  const id = Number(new URLSearchParams(location.search).get('id'));
  if (id) return moBan(id);
  let n = null; try { n = JSON.parse(localStorage.getItem(NHAP) || 'null'); } catch { n = null; }
  if (n?.fabric?.objects?.length) { S.id = n.id || null; $('#tenBan').value = n.ten || ''; $('#thuMuc').value = n.tm || ''; await datKho(n.w || 1080, n.h || 1920); await nap(n.fabric); $('#maMau').value = n.ma || ''; veNutMau(); chup(); bao('Đã mở lại bản nháp trên trình duyệt này (chưa chắc đã lưu — bấm Lưu để giữ).'); return; }
  await themAnhPhim(); chup();
})();

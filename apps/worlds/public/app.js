// SỔ THẾ GIỚI (worlds.on.tc) — xem các thế giới hư cấu lưu theo chuẩn OnlyWorlds (+ trường nhà lop / sinh_tu / tu_vung / nguon).
// Dữ liệu: the-gioi/index.json + the-gioi/<id>.json (nằm trong repo, sửa bằng git, kiểm bằng scripts/kiem.mjs).
// Đường dẫn = #<thế giới>/<tab>/<phần tử> → F5 / gửi link mở lại đúng chỗ.
const LOP = [['goc', 'Gốc'], ['phat', 'Phát sinh'], ['nhu', 'Nhu cầu'], ['hinh', 'Hình khối'], ['xa', 'Xã hội'], ['su', 'Lịch sử'], ['truyen', 'Mầm truyện']];
const TEN_LOP = Object.fromEntries(LOP);
const LOAI = { Phenomenon: 'Hiện tượng', Object: 'Vật', Collective: 'Tập thể', Location: 'Nơi chốn', Need: 'Nhu cầu', Construct: 'Cấu trúc', Language: 'Ngôn ngữ', Character: 'Nhân vật', Event: 'Sự kiện', Law: 'Luật', Narrative: 'Truyện', Species: 'Loài', Ability: 'Năng lực', Creature: 'Sinh vật', Family: 'Dòng họ', Institution: 'Thiết chế', Title: 'Danh hiệu', Trait: 'Đặc điểm', Relation: 'Quan hệ', Zone: 'Vùng', Map: 'Bản đồ', Pin: 'Ghim', Marker: 'Dấu' };
const TAB = [['chuoi', 'Chuỗi nhân quả'], ['thanh-phan', 'Thành phần'], ['thoi-gian', 'Dòng thời gian'], ['tieng', 'Tiếng nói']];

const $ = (s, g = document) => g.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lay = (u) => fetch(`${u}?t=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' }).then((r) => { if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r.json(); });

let DS = [];
const KHO = new Map();
const chinh = $('#chinh'), ngan = $('#ngan');

function baoLoi(e) { chinh.innerHTML = `<p class="trong">Lỗi khi nạp: ${esc(e.message || e)}</p>`; }

async function theGioi(id) {
  if (!KHO.has(id)) {
    const w = await lay(`the-gioi/${id}.json`);
    w.theo = new Map(w.elements.map((e) => [e.id, e]));
    w.sinhRa = new Map(w.elements.map((e) => [e.id, []]));
    for (const e of w.elements) for (const p of e.sinh_tu || []) w.sinhRa.get(p)?.push(e.id);
    KHO.set(id, w);
  }
  return KHO.get(id);
}

const docHash = () => { const [w = '', tab = 'chuoi', el = ''] = decodeURIComponent(location.hash.slice(1)).split('/'); return { w, tab, el }; };
const link = (w, tab, el) => `#${[w, tab, el].filter(Boolean).join('/')}`;
const nam = (e) => e.start_date ?? e.date ?? null;

function veDs(hienTai) {
  $('#ds-tg').innerHTML = DS.map((w) => `<a href="${link(w.id, 'chuoi')}" style="--m:${esc(w.mau)}" class="${w.id === hienTai ? 'dang' : ''}">${esc(w.name)}<small>${esc(w.phong_cach)} · ${w.so_phan_tu} phần tử</small></a>`).join('');
}

function theNho(w, e, tab, kem = '') {
  return `<a class="the" data-id="${esc(e.id)}" href="${link(w.id, tab, e.id)}"><b>${esc(e.name)}</b><span class="loai">${esc(LOAI[e.type] || e.type)}${nam(e) != null ? ' · ' + nam(e) : ''}</span>${kem}</a>`;
}

function veChuoi(w, el) {
  const cot = LOP.map(([k, ten]) => {
    const ds = w.elements.filter((e) => e.lop === k);
    if (!ds.length) return '';
    return `<div class="cot"><h3>${ten} · ${ds.length}</h3>${ds.map((e) => theNho(w, e, 'chuoi')).join('')}</div>`;
  }).join('');
  return `<p class="goi">Mỗi cột sinh ra từ các cột bên trái. Bấm một thẻ để thấy nó sinh từ đâu và sinh ra những gì.</p><div class="chuoi${el ? ' co-chon' : ''}">${cot}<svg></svg></div>`;
}

// nét nối: cha → thẻ đang chọn → con (chỉ trong tab Chuỗi)
function noiDay(w, el) {
  const khung = $('.chuoi'); if (!khung) return;
  const svg = $('svg', khung); svg.innerHTML = '';
  if (!el || !w.theo.has(el)) return;
  const cha = new Set(), con = new Set();
  const leo = (id) => { for (const p of w.theo.get(id)?.sinh_tu || []) if (!cha.has(p)) { cha.add(p); leo(p); } };
  const xuong = (id) => { for (const c of w.sinhRa.get(id) || []) if (!con.has(c)) { con.add(c); xuong(c); } };
  leo(el); xuong(el);
  khung.querySelectorAll('.the').forEach((t) => { const id = t.dataset.id; t.classList.toggle('chon', id === el); t.classList.toggle('lq', cha.has(id) || con.has(id)); });
  const g = khung.getBoundingClientRect();
  svg.setAttribute('width', khung.scrollWidth); svg.setAttribute('height', khung.scrollHeight);
  const o = (id) => { const t = khung.querySelector(`.the[data-id="${CSS.escape(id)}"]`); if (!t) return null; const r = t.getBoundingClientRect(); return { l: r.left - g.left + khung.scrollLeft, r: r.right - g.left + khung.scrollLeft, y: r.top - g.top + r.height / 2 }; };
  const mau = getComputedStyle(khung).getPropertyValue('--m') || '#888';
  let d = '';
  const canh = (a, b) => { const A = o(a), B = o(b); if (!A || !B) return; const x1 = A.r, x2 = B.l; const dx = Math.max(30, (x2 - x1) / 2); d += `M${x1},${A.y} C${x1 + dx},${A.y} ${x2 - dx},${B.y} ${x2},${B.y} `; };
  for (const id of [...cha, el]) for (const c of w.sinhRa.get(id) || []) if (cha.has(c) || c === el) canh(id, c);
  for (const id of [el, ...con]) for (const c of w.sinhRa.get(id) || []) if (con.has(c)) canh(id, c);
  svg.innerHTML = `<path d="${d}" fill="none" stroke="${mau}" stroke-width="1.6" stroke-opacity=".75"/>`;
}

function veThanhPhan(w) {
  const nhom = new Map();
  for (const e of w.elements) { if (!nhom.has(e.type)) nhom.set(e.type, []); nhom.get(e.type).push(e); }
  return [...nhom].sort((a, b) => b[1].length - a[1].length).map(([t, ds]) => `<section class="nhom"><h3>${esc(LOAI[t] || t)} <span>${t} · ${ds.length}</span></h3><div class="luoi">${ds.map((e) => theNho(w, e, 'thanh-phan', e.description ? `<p>${esc(e.description)}</p>` : '')).join('')}</div></section>`).join('');
}

function veThoiGian(w) {
  const ds = w.elements.filter((e) => nam(e) != null).sort((a, b) => nam(a) - nam(b));
  if (!ds.length) return '<p class="trong">Thế giới này chưa có mốc năm nào.</p>';
  return `<div class="dong">${ds.map((e) => `<a class="moc${e.id === 'hien-tai' ? ' nay' : ''}" href="${link(w.id, 'thoi-gian', e.id)}"><span class="nam">${nam(e)}</span><b>${esc(e.name)}</b><span class="nhan">${esc(LOAI[e.type] || e.type)}</span>${e.description ? `<p>${esc(e.description)}</p>` : ''}</a>`).join('')}<a class="moc nay"><span class="nam">${w.hien_tai}</span><b>Năm hiện tại của truyện</b></a></div>`;
}

function veTieng(w) {
  const ds = w.elements.filter((e) => e.type === 'Language');
  if (!ds.length) return '<p class="trong">Thế giới này chưa có ngôn ngữ nào.</p>';
  return ds.map((e) => `<h3><a href="${link(w.id, 'tieng', e.id)}">${esc(e.name)}</a></h3><table><tr><th>Từ</th><th>Nghĩa</th></tr>${(e.tu_vung || []).map(([t, n]) => `<tr><td>${esc(t)}</td><td>${esc(n)}</td></tr>`).join('')}</table>`).join('');
}

function veNgan(w, tab, el) {
  const e = w.theo.get(el);
  if (!e) { ngan.hidden = true; return; }
  const dsLk = (ids) => ids.length ? ids.map((id) => { const x = w.theo.get(id); return x ? `<a class="lk" href="${link(w.id, tab, id)}">${esc(x.name)}<small>${esc(LOAI[x.type] || x.type)} · ${esc(TEN_LOP[x.lop] || x.lop)}</small></a>` : ''; }).join('') : '<p class="trong">Không có.</p>';
  const them = Object.entries(e).filter(([k]) => !['id', 'type', 'name', 'description', 'lop', 'sinh_tu', 'tu_vung'].includes(k));
  ngan.style.setProperty('--m', w.mau);
  ngan.innerHTML = `<button class="dong-x" title="Đóng (Esc)">✕</button>
    <div class="loai">${esc(LOAI[e.type] || e.type)} · ${esc(TEN_LOP[e.lop] || e.lop)}</div>
    <h2>${esc(e.name)}</h2>
    <p>${e.description ? esc(e.description) : '<span class="trong">Chưa có mô tả.</span>'}</p>
    ${them.map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(Array.isArray(v) ? v.join(', ') : v)}</div>`).join('')}
    ${e.tu_vung ? `<h4>Từ vựng</h4><table>${e.tu_vung.map(([t, n]) => `<tr><td>${esc(t)}</td><td>${esc(n)}</td></tr>`).join('')}</table>` : ''}
    <h4>Sinh từ</h4>${dsLk(e.sinh_tu || [])}
    <h4>Sinh ra</h4>${dsLk(w.sinhRa.get(e.id) || [])}
    <h4>Bản ghi OnlyWorlds</h4><pre>${esc(JSON.stringify(e, null, 1))}</pre>`;
  ngan.hidden = false;
  $('.dong-x', ngan).onclick = () => { location.hash = link(w.id, tab); };
}

function veHuongDan() {
  ngan.hidden = true;
  chinh.innerHTML = `<div class="hd"><h1>Cách thêm thế giới</h1>
  <p>Mỗi thế giới là <b>một tệp JSON</b> trong repo, thư mục <code>/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/worlds/public/the-gioi/</code> (iMac), theo chuẩn <a href="https://onlyworlds.com" target="_blank" rel="noopener">OnlyWorlds</a> (22 loại phần tử, MIT). Thêm thế giới = thêm tệp + một dòng trong <code>index.json</code>, rồi đẩy lên git; trang tự hiện.</p>
  <h3>Một phần tử</h3>
  <pre>{ "id": "ferrovora", "type": "Phenomenon", "name": "Vi khuẩn Ferrovora",
  "description": "…", "lop": "goc", "sinh_tu": [] }</pre>
  <ul>
   <li><b>type</b>: loại OnlyWorlds (Character, Location, Construct, Event, Law, Language, Narrative…) cộng loại nhà <code>Need</code> (nhu cầu).</li>
   <li><b>lop</b> (trường nhà): tầng trong chuỗi, một trong <code>goc · phat · nhu · hinh · xa · su · truyen</code>.</li>
   <li><b>sinh_tu</b> (trường nhà): id các phần tử sinh ra nó. Đây là sợi dây nhân quả; tab Chuỗi vẽ theo trường này.</li>
   <li>Năm: <code>start_date</code> (Event) hoặc <code>date</code> (Law). Ngôn ngữ có <code>tu_vung: [[từ, nghĩa]]</code>.</li>
  </ul>
  <h3>Kiểm trước khi đẩy</h3>
  <pre>node apps/worlds/scripts/kiem.mjs</pre>
  <p>Máy báo đỏ khi: <code>sinh_tu</code> trỏ id không có, id trùng, thiếu <code>lop</code>/<code>type</code>, phần tử không phải Gốc mà không sinh từ đâu, hay vòng nhân quả khép kín.</p>
  </div>`;
}

async function ve() {
  const { w: wid, tab, el } = docHash();
  if (wid === 'huong-dan') { veDs(''); return veHuongDan(); }
  if (!wid || !DS.some((x) => x.id === wid)) { location.replace(link(DS[0].id, 'chuoi')); return; }
  veDs(wid);
  const w = await theGioi(wid);
  document.title = `${w.name} · Sổ Thế Giới`;
  chinh.style.setProperty('--m', w.mau);
  const than = tab === 'thanh-phan' ? veThanhPhan(w) : tab === 'thoi-gian' ? veThoiGian(w) : tab === 'tieng' ? veTieng(w) : veChuoi(w, el);
  chinh.innerHTML = `<header class="dau"><h1>${esc(w.name)}</h1><div class="phong">${esc(w.phong_cach)}</div>
    <div class="neu">${esc(w.cau_hoi_goc)}</div><p class="tom">${esc(w.description)}</p>
    <div class="so">${w.elements.length} phần tử · ${new Set(w.elements.map((e) => e.type)).size} loại · năm hiện tại ${w.hien_tai}${w.sprawl ? ` · trên Sprawl: ${esc(w.sprawl)}` : ''}</div></header>
    <nav class="tabs">${TAB.map(([k, ten]) => `<a href="${link(w.id, k)}" class="${k === (TAB.some((t) => t[0] === tab) ? tab : 'chuoi') ? 'dang' : ''}">${ten}</a>`).join('')}</nav>
    <div id="than">${than}</div>`;
  if (tab === 'chuoi' || !TAB.some((t) => t[0] === tab)) requestAnimationFrame(() => noiDay(w, el));
  veNgan(w, tab, el);
}

addEventListener('hashchange', () => ve().catch(baoLoi));
addEventListener('resize', () => { const { w, el } = docHash(); if (KHO.has(w)) noiDay(KHO.get(w), el); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ngan.hidden) { const { w, tab } = docHash(); location.hash = link(w, tab); } });

lay('the-gioi/index.json').then((d) => { DS = d.worlds; return ve(); }).catch(baoLoi);

import(`./chung/gopy.js?v=${Date.now()}`).then(({ ganGopY }) => ganGopY({ nut: $('#b-gy'), nguCanh: () => `Sổ Thế Giới ${location.hash}` }))
  .catch((e) => { const b = $('#b-gy'); b.title = 'Hòm góp ý không nạp được: ' + e.message; b.style.opacity = '.4'; });

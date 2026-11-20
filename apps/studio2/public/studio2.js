// Studio 2 — studio2.on.tc. tra-repo-ok: chuyển nguyên mã trình dựng của bản bấm thử anh đã duyệt (artifact v10, 19/11/2026), không viết khối mới.
// Dữ liệu ba phim mẫu: du-lieu.js (scripts/dl.py dựng từ scripts/du-lieu-goc/). Tài sản: public/v/.
const VID = (m) => `v/${m}.mp4`, ANH = (m) => `v/${m}.jpg`, NV = (m) => `v/nv/${m}--goc.jpg`;
const BUOC = ['Ý tưởng', 'Kiểu video', 'Nội dung', 'Vẻ ngoài', 'Xem lại'];

// ── Hệ template: mỗi KIỂU thuộc một NHÓM; nhóm giữ bộ câu hỏi + gợi ý. Thêm kiểu = thêm một dòng.
const NHOM = {
  nguoi: { hoi: 'Nói về ai?', chon: ['Steve Jobs', 'Beyoncé', 'Marilyn Monroe', 'Barack Obama', 'Elvis Presley', 'Angelina Jolie', 'Kim Kardashian', 'Meghan Markle'],
    mo: (x) => [`${x} didn't get lucky. The chart shows when everything turned.`, `Three years changed ${x}'s life. All three were written in the chart.`, `Everyone knows ${x}'s story. Almost no one has seen the chart.`,
      `What was the sky doing the year ${x} lost everything?`, `${x} was born under a sky that promised a hard start.`, `Before the fame, ${x}'s chart had one long quiet chapter.`],
    y: ['Tuổi thơ và điểm xuất phát', 'Năm bước ngoặt đầu tiên', 'Giai đoạn khó nhất', 'Đỉnh cao sự nghiệp', 'Chuyện tình cảm', 'Chặng đang tới'] },
  cap: { hoi: 'Cặp nào?', chon: ['Leo + Scorpio', 'Aries + Cancer', 'Gemini + Virgo', 'Taurus + Aquarius', 'Libra + Capricorn', 'Pisces + Sagittarius'],
    mo: (x) => [`${x}: great chemistry, terrible timing.`, `Everyone says ${x} can't work. Here is what the signs actually say.`, `${x} fight about one thing. It is always the same thing.`,
      `${x} look perfect from outside. Inside, it is a negotiation.`, `If you are in a ${x} relationship, watch this before your next argument.`, `${x}: who apologises first?`],
    y: ['Điểm hút nhau', 'Chỗ dễ cãi nhau', 'Cách nói chuyện', 'Tiền bạc và việc nhà', 'Lúc giận nhau', 'Lời khuyên để bền'] },
  than: { hoi: 'Nhân vật nào?', anh: true, chon: ['aphrodite', 'apollo', 'ares', 'artemis', 'athena', 'chiron', 'hades', 'eros'],
    mo: (x) => [`The story behind ${x} is darker than your horoscope admits.`, `${x} was placed among the stars. It was not a reward.`, `You know the sign. Nobody told you about ${x}.`,
      `${x} made one mistake. The sky still remembers it.`, `Before it was a zodiac sign, it was ${x}'s worst day.`, `Why did the Greeks put ${x} in the sky?`],
    y: ['Nhân vật là ai', 'Chuyện gì đã xảy ra', 'Vì sao được đưa lên trời', 'Liên hệ với tính cách của cung', 'Chi tiết ít người biết', 'Bài học của câu chuyện'] },
  laso: { hoi: 'Phần nào của lá số?', chon: ['Saturn return', 'Rising sign', 'Moon sign', 'Venus', 'Mars', 'Midheaven'],
    mo: (x) => [`Your ${x} is not what the apps told you.`, `Find your ${x} in ten seconds. Here is what it means.`, `Most people read their ${x} wrong.`,
      `Nobody warns you about your ${x}.`, `Your ${x} explains the thing you keep repeating.`, `Stop skipping your ${x}. It runs more of your life than your Sun sign.`],
    y: ['Nó là gì', 'Tìm nó ở đâu trong lá số', 'Ý nghĩa theo từng cung', 'Hiểu lầm hay gặp', 'Ví dụ từ người nổi tiếng', 'Nên làm gì với nó'] },
  troi: { hoi: 'Sự kiện nào?', chon: ['Full Moon in Taurus', 'Mercury retrograde', 'Leonids meteor shower', 'Saturn direct', 'New Moon in Sagittarius', 'Venus enters Capricorn'],
    mo: (x) => [`${x} is this week. Here is what to watch.`, `Look up this week: ${x}.`, `${x} lands differently on every sign. Find yours.`,
      `Feeling off? ${x} started three days ago.`, `${x}: what to start, what to leave alone.`, `The sky changes this week. ${x} is the reason.`],
    y: ['Chuyện gì đang xảy ra', 'Khi nào nhìn thấy', 'Cung nào chịu ảnh hưởng nhiều', 'Nên làm gì', 'Nên tránh gì', 'Lần kế tiếp là khi nào'] },
};
const KET = ['Mời người xem mở lá số của chính họ trên Astrolas', 'Hỏi một câu để người xem trả lời ở bình luận', 'Hẹn video sau cùng chủ đề'];
const KIEU = [
  { ma: 'chart-chapters', nhom: 'nguoi', ten: 'Kể đời một người theo từng chặng', thu: () => `Steve Jobs: a life in chapters`, tu: ['đời', 'người', 'life', 'jobs', 'beyonc', 'nổi tiếng', 'celebrity', 'chặng'] },
  { ma: 'ask-the-chart', nhom: 'nguoi', ten: 'Một năm bước ngoặt của một người', thu: (y) => `The year everything changed`, tu: ['một năm', 'year', 'bước ngoặt', 'năm 19', 'năm 20'] },
  { ma: 'read-your-chart', nhom: 'laso', ten: 'Giải thích một phần lá số', thu: () => `What your Saturn return really means`, tu: ['saturn', 'rising', 'moon', 'venus', 'mars', 'lá số', 'chart', 'return', 'giải thích', 'nghĩa'] },
  { ma: 'sign-x-sign', nhom: 'cap', ten: 'Hai cung hợp nhau không', thu: (y) => `Can these two signs last?`, tu: ['hợp', 'cặp', 'yêu', 'love', 'compat', '+', ' và ', 'couple'] },
  { ma: 'chart-vs-chart', nhom: 'cap', ten: 'So lá số hai người', thu: (y) => `Two charts, side by side`, tu: ['so ', 'versus', ' vs', 'hai người'] },
  { ma: 'zodiac-myths', nhom: 'than', ten: 'Chuyện thần thoại của một cung', thu: (y) => `The myth your sign comes from`, tu: ['thần thoại', 'myth', 'hy lạp', 'greek', 'leo', 'scorpio', 'cung'] },
  { ma: 'myth-behind', nhom: 'than', ten: 'Nhân vật đứng sau một chòm sao', thu: (y) => `Who is behind this constellation?`, tu: ['chòm sao', 'constellation', 'thần', 'god', 'nhân vật'] },
  { ma: 'sky-calendar', nhom: 'troi', ten: 'Chuyện trên trời tuần này', thu: (y) => `This week in the sky`, tu: ['tuần', 'week', 'trăng', 'moon', 'retrograde', 'nghịch hành', 'mưa sao', 'meteor', 'hôm nay'] },
];
const Y_MAU = ['Saturn return ở tuổi 29', 'Cuộc đời Steve Jobs qua lá số', 'Leo và Scorpio có hợp nhau không', 'Trăng tròn tuần này', 'Thần thoại sau cung Bọ Cạp'];
const HINH = [['Tranh khắc cổ', 'zodiac-myths'], ['Bản đồ sao', 'chart-chapters'], ['Tối giản', 'read-your-chart']];
/** ảnh ô thứ i của dải xem lại: kiểu hình có bộ khung riêng thì lấy khung thứ i, không thì ảnh mẫu lệch vị trí */
const KHUNG = { 'zodiac-myths': (i) => `v/leo-k${i * 2 + 1}.jpg`, 'read-your-chart': (i) => `v/ryc-k${i + 1}.jpg` };
const GIONG = ['Ấm, chậm rãi', 'Trẻ, nhanh', 'Kể chuyện đêm khuya'], NHAC = ['Trầm, huyền bí', 'Sáng, nhẹ', 'Không nhạc'];

const S = { b: 1, y: '', thamKhao: '', kieu: null, ai: null, luot: 0, mo: null, moTu: '', ych: [], ket: null, cau: 0, hinh: null, giong: null, nhac: null, xong: false, dang: false, chuaUng: false, max: 1, loi: {}, tg: {}, cs: [0,1,2,3,4], ve2lai: {}, nvMo: {}, thay: {} };
const $ = (s) => document.querySelector(s), esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const K = () => KIEU.find((k) => k.ma === S.kieu), N = () => NHOM[K().nhom];
const tenAi = (a) => (a ? a[0].toUpperCase() + a.slice(1) : '');
const dsMo = () => { const m = N().mo(tenAi(S.ai)); return m.slice((S.luot % 2) * 3, (S.luot % 2) * 3 + 3); };

/** xếp kiểu theo độ khớp với ý vừa gõ: đếm từ khoá trúng; hoà thì giữ thứ tự gốc */
function xepKieu() {
  const y = ` ${S.y.toLowerCase()} `;
  return KIEU.map((k, i) => ({ k, d: k.tu.filter((t) => y.includes(t)).length, i })).sort((a, b) => b.d - a.d || a.i - b.i).map((x) => x.k);
}
/** đoán sẵn "nói về ai" từ ý: tên trong danh sách gợi ý xuất hiện trong câu gõ */
function doanAi() { const y = S.y.toLowerCase(); return N().chon.find((c) => c.toLowerCase().split(/ \+ | /).every((w) => y.includes(w))) ?? null; }

function di(b) { S.b = b; S.max = Math.max(S.max, b); ve(); window.scrollTo({ top: 0 }); }
function ve() {
  $('#buoc').innerHTML = BUOC.map((t, i) => `<li><button type="button" data-b="${i + 1}" class="${S.b === i + 1 ? 'day' : i + 1 <= S.max ? 'qua' : ''}" ${i + 1 <= S.max && !S.xong && !S.dang ? '' : 'tabindex="-1"'}><i>${i + 1 < S.b ? '✓' : i + 1}</i>${t}</button></li>`).join('');
  $('#trai').innerHTML = S.xong ? veXong() : S.dang ? veDang() : [ve1, ve2, ve3, ve4, ve5][S.b - 1]();
  $('#phai').innerHTML = vePhai();
}
const chan = (truoc, tiep, khoa, giup) => `<div class="chan"><span>${truoc ? '<button type="button" class="nut phu2" data-v="lui">← Quay lại</button>' : ''}</span>
  <span style="display:flex;gap:10px;flex-wrap:wrap">${giup ? '<button type="button" class="nut chu" data-v="giup">Chọn giúp tôi</button>' : ''}<button type="button" class="nut" data-v="tiep" ${khoa ? 'disabled' : ''}>${tiep}</button></span></div>`;

function ve1() {
  return `<h2>Bạn muốn làm video về điều gì?</h2><p class="phu">Viết một câu là đủ. Các bước sau đều có gợi ý sẵn để bấm.</p>
  <textarea id="oY" rows="3" placeholder="Ví dụ: Saturn return ở tuổi 29">${esc(S.y)}</textarea>
  <div><div class="nhom">Chưa rõ? Thử một ý</div><div class="day-chip">${Y_MAU.map((y) => `<button type="button" class="chip" data-y="${esc(y)}">${esc(y)}</button>`).join('')}</div></div>
  <details ${S.thamKhao ? 'open' : ''}><summary>Có video hoặc hình muốn làm giống (không bắt buộc)</summary>
    <div style="display:grid;gap:8px;margin-top:10px"><input type="text" id="oTk" placeholder="Dán link YouTube, TikTok hoặc Reels" value="${esc(S.thamKhao)}">
    <span class="nho">Ở bản thật: dán link là hiện ngay thẻ video, kéo thả được hình vào đây.</span><div id="thayTk">${veThay()}</div></div></details>
  ${chan(false, 'Tiếp →', !S.y.trim())}`;
}
function ve2() {
  const ds = xepKieu(), dau = ds.slice(0, 3), sau = ds.slice(3);
  const the = (k) => `<button type="button" class="the" data-kieu="${k.ma}" aria-pressed="${S.kieu === k.ma}"><div class="hinh"><video muted loop playsinline preload="none" poster="${ANH(k.ma)}" src="${VID(k.ma)}"></video></div>
    <div class="ten"><b>${k.ten}</b><span>Ví dụ: “${esc(k.thu())}”</span></div></button>`;
  return `<h2>Video của bạn nên theo kiểu nào?</h2><p class="phu">Rê chuột (hoặc chạm) vào một thẻ để xem video mẫu của kiểu đó.</p>
  <div><div class="nhan-hop" style="margin-bottom:8px">Hợp nhất với “${esc(S.y.trim())}”</div><div class="kieu">${dau.map(the).join('')}</div></div>
  <details ${sau.some((k) => k.ma === S.kieu) ? 'open' : ''}><summary>Xem thêm kiểu khác</summary><div class="kieu" style="margin-top:12px">${sau.map(the).join('')}</div></details>
  ${chan(true, 'Tiếp →', !S.kieu, true)}`;
}
function ve3() {
  const n = N(), c = S.cau;
  const dau = `<div class="nhan-hop">Câu ${c + 1} / 4 · ${K().ten}</div>`;
  let than = '', khoa = false;
  if (c === 0) { khoa = !S.ai;
    than = `<h2>${n.hoi}</h2>` + (n.anh
      ? `<div class="luoi-anh">${n.chon.map((x) => `<button type="button" class="the" data-ai="${x}" aria-pressed="${S.ai === x}"><div class="hinh"><img src="${NV(x)}" alt=""></div><div class="ten"><b>${tenAi(x)}</b></div></button>`).join('')}</div>`
      : `<div class="day-chip">${n.chon.map((x) => `<button type="button" class="chip" data-ai="${esc(x)}" aria-pressed="${S.ai === x}">${esc(x)}</button>`).join('')}</div>`)
      + `<input type="text" id="oAi" placeholder="Hoặc gõ tên khác" value="${n.chon.includes(S.ai) || !S.ai ? '' : esc(S.ai)}">`;
  } else if (c === 1) { khoa = !S.mo;
    than = `<h2>Mở đầu thế nào?</h2><p class="phu">Câu đầu tiên quyết định người ta có xem tiếp không. Chọn câu bạn thấy muốn nghe tiếp nhất.</p>
      <div class="lua">${dsMo().map((m) => `<button type="button" data-mo="${esc(m)}" aria-pressed="${S.mo === m}"><span>${esc(m)}</span></button>`).join('')}</div>
      <input type="text" id="oMo" placeholder="Hoặc tự viết câu mở đầu" value="${esc(S.moTu)}">
      <div><button type="button" class="nut chu" data-v="khac">↻ Gợi ý khác</button></div>`;
  } else if (c === 2) { khoa = S.ych.length !== 3;
    than = `<h2>Nhấn vào 3 ý nào?</h2><p class="phu">Chọn đúng 3 ý. Đã chọn ${S.ych.length} / 3.</p>
      <div class="lua vuong">${n.y.map((y) => `<button type="button" data-ych="${esc(y)}" aria-pressed="${S.ych.includes(y)}"><span>${esc(y)}</span></button>`).join('')}</div>`;
  } else { khoa = !S.ket;
    than = `<h2>Kết video bằng gì?</h2><div class="lua">${KET.map((k) => `<button type="button" data-ket="${esc(k)}" aria-pressed="${S.ket === k}"><span>${esc(k)}</span></button>`).join('')}</div>`;
  }
  return dau + than + chan(true, c < 3 ? 'Câu tiếp →' : 'Tiếp →', khoa, true);
}
function ve4() {
  const nhom = (ten, ds, khoa) => `<div><h3>${ten}</h3><div class="lua">${ds.map((x) => `<button type="button" data-${khoa}="${esc(x)}" aria-pressed="${S[khoa] === x}"><span>${esc(x)}</span></button>`).join('')}</div></div>`;
  return `<h2>Video trông và nghe thế nào?</h2>
  <div><h3 class="nhom">Hình</h3><div class="ve-hinh">${HINH.map(([t, m]) => `<button type="button" class="the" data-hinh="${t}" aria-pressed="${S.hinh === t}"><div class="hinh"><img src="${ANH(m)}" alt=""></div><div class="ten"><b>${t}</b></div></button>`).join('')}</div></div>
  <div class="ba">${nhom('Giọng đọc', GIONG, 'giong')}${nhom('Nhạc nền', NHAC, 'nhac')}</div>
  <span class="nho">Ở bản thật: mỗi giọng và mỗi bản nhạc có nút nghe thử.</span>
  ${chan(true, 'Tiếp →', !(S.hinh && S.giong && S.nhac), true)}`;
}
const cacO = () => [['Mở đầu', S.mo, 3, 1], ...S.ych.map((y, i) => [`Ý ${i + 1}`, y, 3, 2]), ['Kết', S.ket, 3, 3]];
function ve5() {
  const m = HINH.find((h) => h[0] === S.hinh)[1];
  return `<h2>Video của bạn sẽ như thế này</h2><p class="phu">Bấm vào một ô để đổi riêng phần đó. Ưng rồi thì bấm Làm video, hoặc mở trong trình dựng để chỉnh từng cảnh trên timeline.</p>
  <div class="dai">${cacO().map(([t, x, b, c], i) => `<button type="button" class="o" data-ve="${b}" data-cau="${c}"><div class="hinh"><img src="${anhO(i)}" alt="" style="object-position:${i * 25}% ${i * 22}%"></div><div class="tx"><b>${t}</b><span>${esc(x)}</span></div></button>`).join('')}</div>
  <div class="hop"><div><span class="nho">Kiểu video</span><br><b>${K().ten}</b> · ${esc(tenAi(S.ai))}</div><div><span class="nho">Vẻ ngoài</span><br>${S.hinh} · giọng ${S.giong.toLowerCase()} · nhạc ${S.nhac.toLowerCase()}</div></div>
  <div class="chan"><span><button type="button" class="nut phu2" data-v="lui">← Quay lại</button></span><span style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="nut phu2" data-d="moDung">Mở trong trình dựng</button><button type="button" class="nut" data-v="lam">Làm video</button></span></div>`;
}

const THAY = [['Độ dài', 'Khoảng 45 giây, 6 cảnh', 'Ngắn hơn|Dài hơn'], ['Nhịp', 'Nhanh, đổi cảnh mỗi 7 giây', 'Chậm lại|Nhanh hơn'],
  ['Hình', 'Tranh vẽ tay màu ấm, có viền giấy cũ', 'Tranh khắc cổ|Bản đồ sao|Tối giản'], ['Nhân vật', '3 nhân vật, một người dẫn chuyện', '1|2|4+'],
  ['Giọng', 'Một giọng nữ kể, có lời thoại ngắn', 'Giọng nam|Không thoại'], ['Mở đầu', 'Câu hỏi bất ngờ trong 2 giây đầu', 'Kể thẳng vào chuyện']];
function veThay() {
  if (!S.thamKhao.trim()) return '';
  return `<div class="hop" style="margin-top:10px"><b>Chúng tôi thấy gì ở video của bạn</b><span class="nho">Bấm vào chỗ chưa đúng để sửa. Video mới sẽ làm theo những điểm này, nội dung vẫn là ý của bạn.</span>
  <div class="thay">${THAY.map(([t, v, k], i) => `<span class="nho">${t}</span><b>${esc(S.thay[i] || v)}</b><span class="day-chip">${k.split('|').map((x) => `<button type="button" class="chip" data-thay="${i}" data-g="${esc(x)}" aria-pressed="${S.thay[i] === x}">${esc(x)}</button>`).join('')}</span>`).join('')}</div>
  <span class="nho">Kiểu này chưa có mẫu sẵn: máy lưu thành một kiểu mới để lần sau chọn lại được.</span></div>`;
}
const anhO = (i) => { const m = HINH.find((h) => h[0] === S.hinh)[1]; return KHUNG[m] ? KHUNG[m](i) : ANH(m); };
function veDang() { return `<h2>Đang làm video của bạn</h2><p class="phu" id="dangChu">Đang viết lời…</p><div class="thanh"><i id="thanh"></i></div><span class="nho">Bản thật mất khoảng một giờ; xong sẽ có tin báo kèm link.</span>`; }
function veXong() {
  const phan = ['Mở đầu', 'Ý 1', 'Ý 2', 'Ý 3', 'Kết', 'Hình', 'Giọng', 'Cả video'];
  return `<h2>Video của bạn đã xong</h2><p class="phu">Xem ở khung bên phải. Đây là video mẫu của kiểu bạn chọn; bản thật sẽ mang đúng nội dung bạn vừa chọn.</p>
  <div class="chan"><span style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="nut" data-v="tai">⬇ Tải video</button><button type="button" class="nut phu2" data-v="chua">Chưa ưng</button><button type="button" class="nut phu2" data-d="moDung">Sửa trong trình dựng</button></span>
    <button type="button" class="nut chu" data-v="moi">＋ Làm video khác</button></div>
  <div id="baoTai"></div>
  ${S.chuaUng ? `<div class="hop"><b>Chưa ưng phần nào?</b><span class="nho">Bấm một phần, máy đưa bạn về đúng chỗ đó với gợi ý mới.</span><div class="day-chip">${phan.map((p) => `<button type="button" class="chip" data-sua="${p}">${p}</button>`).join('')}</div></div>` : ''}`;
}
function vePhai() {
  if (S.xong) return `<div class="dt"><video src="${VID(S.kieu)}" poster="${ANH(S.kieu)}" controls playsinline preload="metadata"></video></div><span class="nho">Video mẫu của kiểu đã chọn</span>`;
  if (!S.kieu) return `<div class="dt"><div class="trong">${S.y.trim() ? `“${esc(S.y.trim())}”` : 'Video của bạn sẽ hiện ở đây'}</div></div><span class="nho">Xem trước</span>`;
  if (S.b === 2) return `<div class="dt"><video src="${VID(S.kieu)}" poster="${ANH(S.kieu)}" muted loop autoplay playsinline></video></div><span class="nho">Mẫu: ${K().ten}</span>`;
  const m = S.hinh ? HINH.find((h) => h[0] === S.hinh)[1] : S.kieu;
  return `<div class="dt"><img src="${ANH(m)}" alt=""><div class="mo"></div><div class="chu"><b>${esc(S.mo || (S.ai ? tenAi(S.ai) : S.y.trim()))}</b>
    <span>${[S.ai && tenAi(S.ai), ...S.ych].filter(Boolean).map(esc).join(' · ')}</span></div></div><span class="nho">Xem trước · đổi theo lựa chọn của bạn</span>`;
}

function tiep() {
  if (S.b === 2 && !S.ai) S.ai = doanAi();
  if (S.b === 3 && S.cau < 3) { S.cau++; return ve(); }
  di(S.b + 1);
}
function lui() { if (S.b === 3 && S.cau > 0) { S.cau--; return ve(); } di(S.b - 1); }
function giup() {
  if (S.b === 2) S.kieu = xepKieu()[0].ma, S.ai = doanAi();
  else if (S.b === 3) { const n = N();
    if (S.cau === 0) S.ai = S.ai || doanAi() || n.chon[0]; else if (S.cau === 1) S.mo = dsMo()[0], S.moTu = ''; else if (S.cau === 2) S.ych = n.y.slice(0, 3); else S.ket = KET[0]; }
  else if (S.b === 4) S.hinh = S.hinh || HINH[0][0], S.giong = S.giong || GIONG[0], S.nhac = S.nhac || NHAC[0];
  ve();
}
function lam() {
  S.dang = true; ve(); const chu = ['Đang viết lời…', 'Đang dựng hình…', 'Đang đọc lời và ghép nhạc…', 'Đang kiểm lại lần cuối…'];
  let i = 0; const t = setInterval(() => { i++; const th = $('#thanh'); if (th) th.style.width = `${i * 25}%`; const c = $('#dangChu'); if (c && chu[i]) c.textContent = chu[i];
    if (i >= 4) { clearInterval(t); S.dang = false; S.xong = true; ve(); } }, 700);
  requestAnimationFrame(() => { const th = $('#thanh'); if (th) th.style.width = '8%'; });
}
function sua(p) {
  S.xong = false; S.chuaUng = false; S.luot++;
  if (p === 'Mở đầu') { S.mo = null; S.cau = 1; return di(3); }
  if (/^Ý/.test(p)) { S.cau = 2; return di(3); }
  if (p === 'Kết') { S.cau = 3; return di(3); }
  if (p === 'Hình' || p === 'Giọng') return di(4);
  S.kieu = null; S.ai = null; S.mo = null; S.ych = []; S.ket = null; S.cau = 0; di(2);
}

document.addEventListener('click', (e) => {
  if (E.menu && !e.target.closest('#dMenu, [data-d=menu]')) { E.menu = null; veTren(); veMenu(); }
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.d) return lamD(d.d, d, b);
  if (d.b && +d.b <= S.max && !S.xong && !S.dang) return di(+d.b);
  if (d.y) { S.y = d.y; return ve(); }
  if (d.kieu) { if (S.kieu !== d.kieu) { S.kieu = d.kieu; S.ai = null; S.mo = null; S.moTu = ''; S.ych = []; S.cau = 0; S.luot = 0; } return ve(); }
  if (d.ai) { if (S.ai !== d.ai) { S.ai = d.ai; S.mo = null; } return ve(); }
  if (d.mo) { S.mo = d.mo; S.moTu = ''; return ve(); }
  if (d.ych) { const i = S.ych.indexOf(d.ych); if (i >= 0) S.ych.splice(i, 1); else if (S.ych.length < 3) S.ych.push(d.ych); return ve(); }
  if (d.ket) { S.ket = d.ket; return ve(); }
  if (d.hinh) { S.hinh = d.hinh; return ve(); } if (d.giong) { S.giong = d.giong; return ve(); } if (d.nhac) { S.nhac = d.nhac; return ve(); }
  if (d.ve) { S.cau = +d.cau; return di(+d.ve); }
  if (d.thay) { S.thay[d.thay] = S.thay[d.thay] === d.g ? undefined : d.g; $('#thayTk').innerHTML = veThay(); return; }
  if (d.sua) return sua(d.sua);
  if (d.v === 'tiep') return tiep(); if (d.v === 'lui') return lui(); if (d.v === 'giup') return giup(); if (d.v === 'lam') return lam();
  if (d.v === 'khac') { S.luot++; S.mo = null; return ve(); }
  if (d.v === 'chua') { S.chuaUng = !S.chuaUng; return ve(); }
  if (d.v === 'tai') { $('#baoTai').innerHTML = '<div class="bao">Bản bấm thử không tải được tệp. Ở bản thật, nút này tải video, ảnh bìa và lời giới thiệu.</div>'; return; }
  if (d.v === 'moi') { Object.assign(S, { b: 1, y: '', thamKhao: '', kieu: null, ai: null, luot: 0, mo: null, moTu: '', ych: [], ket: null, cau: 0, hinh: null, giong: null, nhac: null, xong: false, chuaUng: false, max: 1, loi: {}, tg: {}, cs: [0,1,2,3,4], ve2lai: {}, nvMo: {}, thay: {} }); return ve(); }
});
document.addEventListener('input', (e) => {
  const t = e.target, nut = $('[data-v=tiep]');
  if (t.dataset.f) return goD(t);
  if (t.id === 'tlZoom') { E.pxs = +t.value; return veTlClip(); }
  if (t.id === 'qtBrief') { E.kb.brief = t.value; return; }
  if (t.id === 'csCauHoi') { E.cs.cauHoi = t.value; return; }
  if (t.dataset.cs) { E.cs.nguoi[+t.dataset.i][t.dataset.cs] = t.value; return; }
  if (t.id === 'taoTen') { E.tao.ten = t.value; return; }
  if (t.id === 'taoTimGoi') { E.tao.timGoi = t.value; $('#taoGoi').innerHTML = veGoiTao(); return; }
  if (t.id === 'tplTen') { E.tao.tpl.tenPhim = t.value; return; }
  if (t.dataset.tplO) { E.tao.tpl.gt[t.dataset.tplO] = t.value; return; }
  if (t.id === 'taoY') { E.tao.y = t.value; return; }
  if (t.id === 'mnTim') { E.tim = t.value; clearTimeout(hTim); hTim = setTimeout(timPhim, 300); return; }
  if (t.id === 'oY') { S.y = t.value; if (nut) nut.disabled = !S.y.trim(); $('#phai').innerHTML = vePhai(); }
  if (t.id === 'oTk') { S.thamKhao = t.value; $('#thayTk').innerHTML = veThay(); }
  if (t.id === 'oAi') { S.ai = t.value.trim() || null; S.mo = null; if (nut) nut.disabled = !S.ai; $('#phai').innerHTML = vePhai(); }
  if (t.id === 'oMo') { S.moTu = t.value; S.mo = t.value.trim() || null; if (nut) nut.disabled = !S.mo; $('#phai').innerHTML = vePhai(); document.querySelectorAll('[data-mo]').forEach((x) => x.setAttribute('aria-pressed', 'false')); }
});
// thẻ kiểu: rê chuột / chạm = phát video mẫu
const phat = (e, chay) => { const v = e.target.closest?.('.the[data-kieu]')?.querySelector('video'); if (!v) return; if (chay) v.play().catch(() => {}); else { v.pause(); v.currentTime = 0; } };
document.addEventListener('pointerenter', (e) => phat(e, true), true);
document.addEventListener('pointerleave', (e) => phat(e, false), true);

// ───────── TRÌNH DỰNG. Hai bản trên cùng một dự án: GỌN (4 hàng, 3 bảng cố định) và PRO (widget xếp theo loại hình video).
const CD = ['Phóng gần', 'Lùi xa', 'Lia ngang', 'Đứng yên'], CHUYEN = ['Cắt thẳng', 'Mờ dần'], VITRI = ['Trên', 'Giữa', 'Dưới'], KCHU = ['Đậm', 'Viền vàng', 'Hộp nền', 'Tắt chữ'];
const CO = ['Toàn', 'Trung', 'Trung cận', 'Cận', 'Đặc tả'], GM = ['Ngang', 'Thấp', 'Cao'], ONG = ['Rộng', 'Chuẩn', 'Chân dung', 'Macro'], NUA_GOC = { 'Rộng': 34, 'Chuẩn': 24, 'Chân dung': 15, 'Macro': 9 };
const TILE = { '9:16': 0.5625, '1:1': 1, '16:9': 1.7778 }, TOC = { 'Chậm': 0.88, 'Vừa': 1, 'Nhanh': 1.15 };
const KHO_HINH = [...Array(9)].map((_, i) => `v/leo-k${i + 1}.jpg`).concat([...Array(7)].map((_, i) => `v/ryc-k${i + 1}.jpg`), KIEU.map((k) => ANH(k.ma)));
const KHO_NV = [['heracles', 'Heracles'], ['su-tu-nemea', 'Sư tử Nemea'], ['hera', 'Hera'], ['zeus', 'Zeus'], ['athena', 'Athena'], ['apollo', 'Apollo'], ['artemis', 'Artemis'], ['hermes', 'Hermes']];
const IC = { 'Quy trình': '<path d="M2 4l1.200 1.200 2-2.300M2 8.200l1.200 1.200 2-2.300M2 12.400l1.200 1.200 2-2.300M8 4.200h6M8 8.400h6M8 12.600h6"/>', 'Cẩm nang': '<path d="M3 2.500h8.500a1.500 1.500 0 011.500 1.500v9.500H4.500A1.500 1.500 0 013 12zM3 12a1.500 1.500 0 011.500-1.500H13M5.500 5h5M5.500 7.500h3.500"/>', 'Hàng đợi': '<path d="M2 3.500h12M2 8h7.500M2 12.500h5M12.500 8.500v5M10 11h5"/>', 'Nhật ký': '<path d="M5.500 4h8M5.500 8h8M5.500 12h5"/><circle cx="2.600" cy="4" r=".7"/><circle cx="2.600" cy="8" r=".7"/><circle cx="2.600" cy="12" r=".7"/>', 'Mẫu': '<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>',
  'Hình': '<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2.5 11l3.5-3.5 2.5 2.5 2-2 3 3"/><circle cx="10.5" cy="6" r="1"/>', 'Nhân vật': '<circle cx="8" cy="5.5" r="2.6"/><path d="M2.8 14c.6-3 2.6-4.3 5.2-4.3s4.6 1.3 5.2 4.3"/>',
  'Chữ': '<path d="M3 4V3h10v1M8 3v10M6 13h4"/>', 'Giọng': '<rect x="6" y="2" width="4" height="7" rx="2"/><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2"/>', 'Nhạc': '<path d="M6 12V3.5l7-1.5v8.5"/><circle cx="4.5" cy="12" r="1.6"/><circle cx="11.5" cy="10.5" r="1.6"/>',
  '3D': '<path d="M8 1.8l5.4 3v6.4L8 14.2l-5.4-3V4.8zM2.6 4.8L8 7.8l5.4-3M8 7.8v6.4"/>', 'Đoạn': '<path d="M3 2v12M3 3h8l-1.5 2.5L11 8H3"/>', 'Tiếng động': '<path d="M2 8h1.5M5 5v6M7.5 3v10M10 6v4M12.5 7v2"/>',
  'Cảm xúc': '<path d="M1.5 9h3l1.5-4 2.5 7 1.5-3h4.5"/>', 'Máy': '<rect x="1.5" y="4.5" width="9" height="7" rx="1.5"/><path d="M10.5 7l4-2v6l-4-2"/>', 'Diễn': '<circle cx="9" cy="3" r="1.5"/><path d="M4 7l3-1.5 2.5 1 1.5 2.5M8.5 6.5L7 10l2 1.5V14M7 10l-3 3"/>',
  'Thoại': '<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/>', 'Soát': '<circle cx="8" cy="8" r="6"/><path d="M5.2 8.2l2 2 3.6-4"/>', 'Mặt bằng': '<path d="M2 3.5l4-1.5 4 1.5 4-1.5v10.5l-4 1.5-4-1.5-4 1.5zM6 2v10.5M10 3.5V14"/>',
  'Phân cảnh': '<rect x="1.5" y="3" width="5.5" height="4" rx=".8"/><rect x="9" y="3" width="5.5" height="4" rx=".8"/><rect x="1.5" y="9" width="5.5" height="4" rx=".8"/><rect x="9" y="9" width="5.5" height="4" rx=".8"/>',
  'Kịch bản': '<path d="M3 3.5h10M3 6.5h10M3 9.5h7M3 12.5h5"/>', 'Thuộc tính': '<path d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7"/><circle cx="10.5" cy="4.5" r="1.5"/><circle cx="5.5" cy="11.5" r="1.5"/>',
  'Thư viện': '<path d="M1.8 4.2h4.2l1.5 1.6h6.700v7H1.8z"/>', 'Khung xem': '<rect x="1.5" y="3" width="13" height="10" rx="1.5"/><path d="M6.8 6l3 2-3 2z"/>', 'Bố cục': '<rect x="1.8" y="2.5" width="12.4" height="11" rx="1.5"/><path d="M6 2.5v11M6 8h8.2"/>',
  'Tách': '<path d="M8 1.5v13M5 5L2.5 8 5 11M11 5l2.5 3L11 11"/>', 'Nhân đôi': '<rect x="2" y="2" width="8.5" height="8.5" rx="1.5"/><path d="M13.8 6v6.3a1.5 1.5 0 0 1-1.5 1.5H6"/>', 'Xoá': '<path d="M2.5 4.5h11M6 4.5V2.8h4v1.700M4 4.5l.7 9h6.600l.7-9"/>',
  'Hoàn tác': '<path d="M5.5 3L2.5 6l3 3M2.5 6h6.5a4 4 0 0 1 0 8H6"/>', 'Làm lại': '<path d="M10.5 3l3 3-3 3M13.5 6H7a4 4 0 0 0 0 8h3"/>', 'Thêm': '<path d="M8 2.5v11M2.5 8h11"/>', 'Tiếng': '<path d="M2.5 6v4h2.5l3.5 3V3L5 6zM11 5.5a3.5 3.5 0 0 1 0 5"/>',
  'Tắt tiếng': '<path d="M2.5 6v4h2.5l3.5 3V3L5 6zM11 6l3.5 4M14.5 6L11 10"/>', 'Khung': '<path d="M2 5V2.5h2.5M11.5 2.5H14V5M14 11v2.5h-2.5M4.5 13.5H2V11"/><rect x="5.5" y="5" width="5" height="6"/>', 'Trái': '<path d="M9.5 3.5L5 8l4.5 4.5"/>', 'Phải': '<path d="M6.5 3.5L11 8l-4.5 4.5"/>', 'Đóng': '<path d="M4 4l8 8M12 4l-8 8"/>' };
IC['Lời đọc'] = IC['Giọng'];
IC['Lớp'] = '<path d="M8 2l6 3-6 3-6-3zM2 8l6 3 6-3M2 11l6 3 6-3"/>'; IC['Mắt'] = '<path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>'; IC['Mắt tắt'] = IC['Mắt'] + '<path d="M3 13L13 3"/>';
const ic = (t) => `<svg class="ic" viewBox="0 0 16 16" aria-hidden="true">${IC[t]}</svg>`;
let soId = 0; const idMoi = () => `c${++soId}`;
const canhMoi = (o) => ({ id: idMoi(), nhan: 'Cảnh', loi: '', chu: '', mota: '', anh: KHO_HINH[0], tg: 6, cd: CD[0], chuyen: CHUYEN[0], viTri: 'Dưới', nv: [], ve: false, co: '', gm: '', ong: '', thoai: [], td: '', cx: 0, pd: '', ...o });

function duAnMau() {
  return { ten: 'Leo: the lion no blade could cut', loai: 'hinh', tile: '9:16', kieu: 'zodiac-myths', giong: GIONG[2], toc: 'Vừa', nhac: NHAC[0], am: 55, nhoLai: true, kieuChu: KCHU[0],
    nvs: [{ id: 'heracles', ten: 'Heracles', vai: 'Nhân vật', mo: 'Trẻ, vai rộng, khoác da sư tử' }, { id: 'su-tu-nemea', ten: 'Sư tử Nemea', vai: 'Nhân vật', mo: 'Bộ lông vàng, không vũ khí nào xuyên qua' }, { id: 'hera', ten: 'Hera', vai: 'Nhân vật', mo: 'Đội vương miện, áo choàng tím' }],
    canh: [
      canhMoi({ nhan: 'Mở đầu', chu: 'The lion no blade could cut', loi: 'Every Leo carries a lion that no weapon could kill.', anh: 'v/leo-k1.jpg', tg: 5, nv: ['su-tu-nemea'], pd: 'Mở', cx: 1 }),
      canhMoi({ nhan: 'Ý 1', chu: 'Hera sends a monster', loi: 'Hera raised the Nemean lion to break the one hero she hated most.', anh: 'v/leo-k3.jpg', tg: 7, cd: 'Lia ngang', nv: ['hera', 'su-tu-nemea'], pd: 'Thân', cx: 1 }),
      canhMoi({ nhan: 'Ý 2', chu: 'Arrows bounce off', loi: 'Heracles shot first. The arrows bounced off its golden hide like rain.', anh: 'v/leo-k5.jpg', tg: 4, nv: ['heracles', 'su-tu-nemea'], pd: 'Thân', cx: 2 }),
      canhMoi({ nhan: 'Ý 3', chu: 'Bare hands', loi: 'So he dropped the bow, cornered it in a cave, and fought with bare hands.', anh: 'v/leo-k7.jpg', tg: 7, cd: 'Lùi xa', chuyen: 'Mờ dần', nv: ['heracles', 'su-tu-nemea'], pd: 'Thân', cx: 3 }),
      canhMoi({ nhan: 'Kết', chu: 'Open your own chart', loi: 'Zeus set the lion among the stars. See where Leo sits in your own chart on Astrolas.', anh: 'v/leo-k9.jpg', tg: 8, chuyen: 'Mờ dần', pd: 'Kết', cx: 1 }),
    ] };
}
/** dựng dự án từ một MẪU (kiểu video) + những gì đã chọn ở lối tạo nhanh; ý chưa có lời thì để chỗ cho máy viết */
function duAnTu(ma, o = {}) {
  const k = KIEU.find((x) => x.ma === ma), n = NHOM[k.nhom], ai = o.ai || n.chon[0], hm = o.hinhMa || ma, f = (i) => (KHUNG[hm] ? KHUNG[hm](i) : ANH(hm));
  const mo = o.mo || n.mo(tenAi(ai))[0], y = o.ych?.length ? o.ych : n.y.slice(0, 3), ket = o.ket || KET[0];
  return { ten: o.ten || k.thu(), loai: 'hinh', tile: '9:16', kieu: ma, giong: o.giong || GIONG[0], toc: 'Vừa', nhac: o.nhac || NHAC[0], am: 55, nhoLai: true, kieuChu: KCHU[0],
    nvs: n.anh ? [{ id: ai, ten: tenAi(ai), vai: 'Nhân vật', mo: '' }] : [],
    canh: [canhMoi({ nhan: 'Mở đầu', chu: mo.split(/[.?!:]/)[0], loi: mo, anh: f(0), tg: 5, nv: n.anh ? [ai] : [], pd: 'Mở' }),
      ...y.map((t, i) => canhMoi({ nhan: `Ý ${i + 1}`, chu: t, loi: `[Máy viết lời cho ý: ${t}]`, anh: f(i + 1), tg: 7, cd: CD[(i + 1) % 3], pd: 'Thân' })),
      canhMoi({ nhan: 'Kết', chu: '', loi: `[Máy viết lời kết: ${ket}]`, anh: f(4), tg: 6, chuyen: 'Mờ dần', pd: 'Kết' })] };
}
/** dự án lấy từ phim thật của studio (DL): mỗi cảnh nhớ `tu` = giây bắt đầu trong video gốc, `khop` = độ dài đã khớp tiếng */
function tuDL(k) { const p = JSON.parse(JSON.stringify(DL[k])); return { giong: GIONG[0], toc: 'Vừa', nhac: k === 'cn' ? NHAC[2] : NHAC[1], am: 55, nhoLai: true, kieuChu: KCHU[0], ...p, canh: p.canh.map((c) => canhMoi({ ...c, khop: c.tg })) }; }
// ── phim THẬT của studio.on.tc: đọc qua đường đọc song song của studio (POST /api/xv/doc — vhost studio2 chuyển /api/xv/ sang cổng studio, cùng phiên SSO mos2)
//    rồi ghép về mô hình dự án ở đây. Bản gốc từng cảnh giữ ở GOC (theo id cảnh) cho việc soi bước / nhật ký — không nằm trong D vì sổ hoàn tác chép cả D.
const TRONG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 16"><rect width="9" height="16" fill="#2a2d3a"/></svg>');
async function goiDuong(duong, ham, args) {
  let r; try { r = await fetch(`/api/xv/${duong}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ham, args }) }); } catch { throw new Error('không gọi được máy chủ studio (có thể phiên đăng nhập đã hết, hãy tải lại trang)'); }
  const j = await r.json().catch(() => null);
  if (r.status === 524 || r.status === 504) throw Object.assign(new Error('studio chưa trả lời kịp; việc có thể vẫn đang chạy bên đó, chờ một phút rồi bấm ↻ đọc lại'), { chuaKip: true });
  if (!r.ok || !j || j.loi) throw new Error(j?.loi || `máy chủ studio trả lỗi ${r.status}`); return j.kq;
}
const goi = (ham, ...args) => goiDuong('doc', ham, args);
/** chạy một bước LÀM PHIM trên studio (sổ hàm ghi của studio: lib/ghi-ham.ts); studio từ chối (cổng quy trình, cổng tiền, thiếu quyền) → ném đúng câu studio nói */
async function ghiSv(ham, ...args) { const kq = await goiDuong('ghi', ham, args); if (kq && kq.ok === false) throw new Error(kq.loi || 'studio từ chối bước này'); return kq && typeof kq === 'object' && 'data' in kq ? kq.data : kq; }
/** ảnh trong kho studio → bản thu nhỏ (studio tự thu + nhớ); thứ khác giữ nguyên; không có ảnh → ô xám */
const nho = (u, w = 640) => (!u ? TRONG : /^https:\/\/img\.on\.tc\/xuong-video\/(?!nho\/).+\.(jpe?g|png|webp)$/i.test(u) ? `/api/xv/nho?u=${encodeURIComponent(u)}&w=${w}` : u);
const S_CO = { ws: 'Toàn', els: 'Toàn', ls: 'Toàn', ms: 'Trung', two: 'Trung', ots: 'Trung', pov: 'Trung', mcu: 'Trung cận', cu: 'Cận', ecu: 'Đặc tả', insert: 'Đặc tả' }, S_GOC = { ngang: 'Ngang', thap: 'Thấp', sat_dat: 'Thấp', cao: 'Cao' }, S_ONG = { rong: 'Rộng', chuan: 'Chuẩn', chan_dung: 'Chân dung', macro: 'Macro' };
const S_CD = { tinh: 'Đứng yên', cam_tay: 'Đứng yên', day: 'Phóng gần', day_vao: 'Phóng gần', lui: 'Lùi xa', lia: 'Lia ngang', truot: 'Lia ngang', theo: 'Lia ngang' }, S_VAI = { nhan_vat: 'Nhân vật', dao_cu: 'Đồ vật', boi_canh: 'Bối cảnh' };
const MAU_NV = ['#c8553d', '#3d7ec8', '#5aa469', '#b08a2e', '#8a5ac8', '#c85a9a'];
let GOC = {};
function tuStudio(pd, tap, ds) {
  const p = pd.phim, tile = TILE[p.kinh_thanh?.ti_le] ? p.kinh_thanh.ti_le : '9:16', so = (x) => Math.round(+x || 0), hoa = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // phim nhiều tập có cả trăm anchor: chỉ lấy thứ tập này dùng
  const dung = new Set(ds.flatMap((c) => c.nhan_vat || []).filter((x) => x != null)), nvs = pd.nhanVat.filter((n) => (dung.size ? dung.has(n.id) || dung.has(n.ten) : pd.nhanVat.length <= 12)).slice(0, 40).map((n) => ({ id: `n${n.id}`, ten: n.ten, vai: S_VAI[n.loai] || 'Nhân vật', anh: nho(n.anh_ref?.[0], 320), mo: (n.mo_ta || '').slice(0, 140) }));
  // shot ghi anchor bằng số (phim thường) hoặc bằng tên (video máy dựng)
  const idNv = new Map(pd.nhanVat.flatMap((n) => [[n.id, `n${n.id}`], [n.ten, `n${n.id}`]]).filter(([, v]) => nvs.some((x) => x.id === v))), laNguoi = new Set(pd.nhanVat.filter((n) => n.loai === 'nhan_vat').map((n) => n.ten));
  // studio ghi giây theo hai cách: phim có clip từng shot → phat_s là SỐ GIÂY PHÁT của shot; video máy dựng (không có clip từng shot) → phat_s là MỐC BẮT ĐẦU trong video cả tập
  const ps = ds.map((c) => c.phat_s), laMoc = !ds.some((c) => c.video_cuoi_url || c.video_url) && ds.length > 1 && ps[0] === 0 && ps.every((x, i) => x != null && (!i || x > ps[i - 1]));
  GOC = {}; const khoi = {}; let tu = 0;
  const canh = !ds.length ? [canhMoi({ nhan: 'Chưa có cảnh', anh: TRONG, tg: 4 })] : ds.map((c, i) => {
    const kt = c.ky_thuat || {}, kx = c.khung_xam || null, m = c.may_3d || null, id = `s${c.id}`; GOC[id] = c;
    const tg = lam2(Math.max(0.5, laMoc ? (i < ds.length - 1 ? ps[i + 1] - ps[i] : Math.max(1, (+tap.thoi_luong_s || ps[i] + (+c.thoi_luong_s || 4)) - ps[i])) : +(c.phat_s ?? c.thoi_luong_s ?? 4) || 4));
    const thoai = (Array.isArray(c.thoai) ? c.thoai : []).filter((t) => t.loi).map((t) => ({ ai: t.nhan_vat || 'Lời dẫn', cau: t.loi }));
    const vt = (Array.isArray(m?.vi_tri) ? m.vi_tri : []).filter((v) => Array.isArray(v.tam)).map((v) => ({ ten: v.ten, x: so(v.tam[0]), y: so(v.tam[1]), h: v.huong }));
    for (const v of vt) khoi[v.ten] ??= { w: 45, h: 45, nguoi: laNguoi.has(v.ten), mau: MAU_NV[Object.keys(khoi).length % MAU_NV.length] };
    const canKiem = new Set((Array.isArray(kx?.kiem) ? kx.kiem : []).map((k) => k.nhan_vat));   // khung trên hình 3D: chỉ người + thứ cổng khung đang soát, không vẽ khung cho đồ nền
    const hop = Object.fromEntries(Object.entries(kx?.hop || {}).filter(([k, b]) => Array.isArray(b) && b.length === 4 && (laNguoi.has(k) || canKiem.has(k))).map(([k, b]) => [k, b.map((x) => Math.round(x * 1000) / 1000)]));
    const o = canhMoi({ id, nhan: (c.canh || '').replace(/^\[[^\]]*\]\s*/, '').replace(/\s*\(.*\)$/, '') || `Cảnh ${i + 1}`, loi: thoai.length ? thoai.map((t) => t.cau).join(' ') : c.loi_thoai || '',
      chu: (c.chu_man || '').split('\n').map((x) => x.replace(/^@[\d.]+\s*/, '').trim()).filter(Boolean).join(' · '), anh: nho(c.keyframe_url), k3: typeof kx?.mau === 'string' && kx.mau ? nho(kx.mau) : undefined,
      tg, khop: tg, tu: laMoc ? ps[i] : lam2(tu), vid: c.video_cuoi_url || c.video_url || undefined, tuV: +kt.vao_s || 0, vid3: kx?.clip?.url || undefined, tu3: +kx?.clip?.vao || 0,
      goc: c.goc_may || '', co: S_CO[kt.co_canh] || '', gm: S_GOC[kt.goc] || '', ong: S_ONG[kt.ong_kinh] || '', cd: S_CD[kt.chuyen_dong] || 'Đứng yên', chuyen: /mo|fade|dissolve/i.test(kt.chuyen_canh || '') ? 'Mờ dần' : 'Cắt thẳng',
      mota: c.hanh_dong_vi || c.hanh_dong || '', thoai, td: c.am_thanh || '', cx: +c.cam_xuc || 0, pd: c.phan_doan || '', hop: Object.keys(hop).length ? hop : undefined,
      m3: m && Array.isArray(m.dat) && Array.isArray(m.nhin) ? { dat: [so(m.dat[0]), so(m.dat[1])], nhin: [so(m.nhin[0]), so(m.nhin[1])], vt } : null, pb: c.video_phien_ban?.length || 0,
      soi: c.soi_clip && !c.soi_clip.bo_qua ? (c.soi_clip.loi || []).map((s) => hoa(String(s).replace(/:[\s\S]*$/, '').trim())) : [],
      kiem: (Array.isArray(kx?.kiem) ? kx.kiem : []).filter((k) => k.bat_buoc).map((k) => ({ n: k.nhan_vat, ok: !!k.trong_khung })), nv: (c.nhan_vat || []).map((n) => idNv.get(n)).filter(Boolean) });
    tu += tg; return o;
  });
  NEN = {}; THU_TU0 = ds.map((c) => `s${c.id}`); for (const o of canh) if (GOC[o.id]) NEN[o.id] = nenCanh(o);
  const co3d = canh.some((c) => c.m3), tl = p.kinh_thanh?.the_loai || '';
  // loại hình (chọn bố cục): có 3D → phim nhân vật 3D · quảng cáo · máy dựng · tài liệu / video cả tập lời dẫn → tài liệu · còn lại là phim ngắn / series
  const loai = co3d ? 'phim' : p.loai === 'quang_cao' || /^qc_/.test(tl) ? 'qc' : p.loai === 'may_dung' ? 'may' : tl === 'tai_lieu' || laMoc ? 'tailieu' : 'doc';
  if (ds.length) for (const c of ds) if (!GOC[`s${c.id}`]) GOC[`s${c.id}`] = c;
  return { ten: p.ten + (pd.tap.length > 1 ? ` · tập ${tap.so}` : ''), loai, tile, kieu: 'chart-chapters', vid: tap.video_url || tap.xuat?.[tap.xuat.length - 1]?.url || undefined,
    giong: GIONG[0], toc: 'Vừa', nhac: tap.nhac_url ? NHAC[1] : NHAC[2], am: 55, nhoLai: true, kieuChu: KCHU[0], nvs, set: co3d ? { vat: [], khoi } : undefined, canh, that: { phim: p.id, tap: tap.id, soTap: pd.tap.length, trong: !ds.length, kt: p.kinh_thanh || {}, moTa: p.mo_ta || '', loaiPhim: p.loai, brief: String(tap.brief || '').split('\n\n=== CÁCH KỂ (Studio 2 tự ghép')[0], kichBan: tap.kich_ban || '', xuatUrl: tap.video_url || '', laMoc, nx: tap.thu_nguoi_xem || null, mau: pd.nhanVat.map((x) => ({ id: x.id, ten: x.ten, loai: x.loai, anh: x.anh_ref?.[0] || '' })), coCachKe: String(tap.brief || '').includes('=== CÁCH KỂ (Studio 2 tự ghép'), mauNguoi: pd.nhanVat.filter((x) => x.loai === 'nhan_vat').map((x) => x.id) } };
}
/** dự án chờ: khung trống hiện trong lúc đọc phim thật */
const duAnCho = () => ({ ten: 'Đang mở phim…', loai: 'hinh', tile: '9:16', kieu: 'chart-chapters', giong: GIONG[0], toc: 'Vừa', nhac: NHAC[2], am: 55, nhoLai: true, kieuChu: KCHU[0], nvs: [], canh: [canhMoi({ nhan: 'Đang mở', anh: TRONG, tg: 4 })], cho: true });
const LOAI = { hinh: 'Kể chuyện bằng hình', tailieu: 'Tài liệu lời dẫn', phim: 'Phim nhân vật 3D', doc: 'Phim ngắn · series', qc: 'Quảng cáo', may: 'Video máy dựng' };
const DU_AN = { cn: { bia: 'v/cn/k14.jpg', tao: () => tuDL('cn') }, ynt: { bia: 'v/ynt/k3.jpg', tao: () => tuDL('ynt') }, leo: { bia: 'v/leo-k1.jpg', tao: duAnMau } };
// ── widget: mỗi bảng là một widget; mỗi LOẠI HÌNH video có một bố cục (danh sách widget theo thứ tự trái sang phải), đổi được và nhớ lại
const WG = { tv: ['Thư viện', '252px'], kb: ['Kịch bản', '300px'], pc: ['Phân cảnh', 'minmax(220px, .8fr)'], xem: ['Khung xem', 'minmax(0, 1.3fr)'], mb: ['Mặt bằng', 'minmax(190px, .75fr)'], lp: ['Lớp', '250px'], nk: ['Nhật ký', '300px'], hd: ['Hàng đợi', '320px'], cn: ['Cẩm nang', '340px'], qt: ['Quy trình', '320px'], tt: ['Thuộc tính', '300px'] };
// BỐ CỤC ĐẶT SẴN theo loại video — mỗi bố cục là các widget đã đặt chỗ trên lưới 24 × 16 ([x, y, rộng, cao]); `cho` = các thể loại của studio.on.tc dùng bố cục này
// (gói thể loại: apps/xuong-video/src/lib/xuong-video/goi-the-loai.ts · template QC: apps/xuong-video/mau/templates.json · video máy dựng: may-dung-*.ts).
// Sáu bố cục đầu là mặc định của sáu loại hình (LOAI); 'soi' là bố cục làm việc dùng cho mọi loại. Thêm loại video mới = thêm một mục ở đây + tên ở LOAI.
const BO_CUC = {
  phim: { ten: 'Phim nhân vật 3D', cho: 'Series hoạt hình, phim ngắn dựng 3D: phân cảnh, mặt bằng, máy quay', o: { pc: [0, 0, 6, 16], xem: [6, 0, 10, 16], mb: [16, 0, 8, 8], tt: [16, 8, 8, 8] } },
  doc: { ten: 'Phim ngắn · series', cho: 'Phim ngắn dọc, kinh dị, hài, tình cảm, anime, MV, trailer', o: { pc: [0, 0, 6, 16], xem: [6, 0, 8, 16], kb: [14, 0, 4, 16], tt: [18, 0, 6, 16] } },
  qc: { ten: 'Quảng cáo', cho: 'UGC, khuyến mãi, demo sản phẩm, thử đồ, các template quảng cáo', o: { kb: [0, 0, 6, 16], xem: [6, 0, 8, 16], tt: [14, 0, 10, 8], nk: [14, 8, 10, 8] } },
  tailieu: { ten: 'Tài liệu lời dẫn', cho: 'Tài liệu ngắn, giải thích, tin tức, video bản đồ: lời dẫn và lớp hình', o: { kb: [0, 0, 6, 16], xem: [6, 0, 10, 16], lp: [16, 0, 8, 8], tt: [16, 8, 8, 8] } },
  hinh: { ten: 'Kể chuyện bằng hình', cho: 'Kể chuyện có người dẫn, thiếu nhi, slideshow ảnh: chọn hình và lời', o: { tv: [0, 0, 6, 16], xem: [6, 0, 12, 16], tt: [18, 0, 6, 16] } },
  may: { ten: 'Video máy dựng', cho: 'Top, so sánh, câu đố, lật thẻ, carousel: máy dựng cả tập từ dữ liệu', o: { kb: [0, 0, 6, 16], xem: [6, 0, 12, 16], tt: [18, 0, 6, 16] } },
  lam: { ten: 'Làm video mới', cho: 'Đi từng bước của quy trình studio: ý tưởng, kịch bản, cảnh, ảnh, giọng, clip, xuất (phim của studio)', o: { qt: [0, 0, 8, 16], xem: [8, 0, 8, 16], kb: [16, 0, 8, 8], tt: [16, 8, 8, 8] } },
  soi: { ten: 'Soi từng bước sinh', cho: 'Gỡ lỗi mọi loại video: phân cảnh và nhật ký lượt sinh (phim của studio)', o: { pc: [0, 0, 6, 16], xem: [6, 0, 8, 16], nk: [14, 0, 10, 8], tt: [14, 8, 10, 8] } },
};
const viMau = (k) => Object.fromEntries(Object.entries(BO_CUC[k].o).map(([w, [x, y, rong, cao]]) => [w, { x, y, w: rong, h: cao }]));
const BC_MAU = Object.fromEntries(Object.entries(BO_CUC).map(([k, b]) => [k, Object.keys(b.o).sort((a, c) => b.o[a][0] - b.o[c][0] || b.o[a][1] - b.o[c][1])]));

let D = duAnMau();
const E = { man: 'dung', ban: 'pro', da: 'cn', nguon: 'anh', hop: true, tat: false, ttTab: 'may', bc: JSON.parse(JSON.stringify(BC_MAU)), menu: null,
  t: 0, chon: null, pxs: 22, tab: 'Mẫu', chay: false, lui: [], toi: [], xuat: null, moDoi: false, moNv: false, moThem: false, dangGo: false, o: 'tv', vua: false, canhDang: null, solo: null, tap: null, tim: '', kq: undefined, kqLoi: '', nkBuoc: 'anh', nk: null, nkMo: null, nkCt: {}, qt: null, qtMo: '', gia: null, cho: '', dangBuoc: {}, loiBuoc: null, kb: { brief: '', giay: 45 }, goiY: null, viecNx: 0, xuatThat: null, tao: null, bcUrl: '', chuKy: '', nguoi: null, nhuMoi: false, doi: null, coSo: undefined, cs: { cauHoi: '', nguoi: [{}] }, dangLuu: false, luoi: { pb: 2, n: 12, hien: false, vi: {}, ten: {} }, tlCao: 0 };
try { const l = JSON.parse(localStorage.getItem('studio2') || 'null'); if (l) { if (l.ban === 'gon' || l.ban === 'pro') E.ban = l.ban; if (DU_AN[l.da] || /^\d+$/.test(l.da || '')) { E.da = l.da; E.tap = +l.tap || null; } for (const k in BC_MAU) if (Array.isArray(l.bc?.[k]) && l.bc[k].includes('xem') && l.bc[k].every((w) => WG[w])) E.bc[k] = l.bc[k]; if ([6, 12, 24].includes(l.luoi?.n)) E.luoi.n = l.luoi.n; E.luoi.hien = !!l.luoi?.hien; if (l.luoi?.pb === 2 && l.luoi.vi && typeof l.luoi.vi === 'object') for (const k in BC_MAU) { if (BO_CUC[l.luoi.ten?.[k]]) E.luoi.ten[k] = l.luoi.ten[k];   // pb: bản 1 tự ghi bố cục một hàng vào sổ, che mất bố cục đặt sẵn → bỏ
     if (l.luoi.vi[k]) E.luoi.vi[k] = l.luoi.vi[k];
     const nh = (Array.isArray(l.luoi.nhom?.[k]) ? l.luoi.nhom[k] : []).filter((x) => Array.isArray(x?.ds) && x.ds.length > 1 && x.ds.every((w) => WG[w])); if (nh.length) (E.luoi.nhom ||= {})[k] = nh.map((x) => ({ ds: [...new Set(x.ds)], mo: x.mo })); }   // nhóm tab trong ô
   if (l.tlCao >= 110) E.tlCao = +l.tlCao; E.nhuMoi = !!l.nhuMoi; E.qtXem = !!l.qtXem; } } catch {}
try { const q = new URLSearchParams(location.search); if (q.get('ban') === 'gon' || q.get('ban') === 'pro') E.ban = q.get('ban'); if (DU_AN[q.get('phim')] || /^\d+$/.test(q.get('phim') || '')) { E.da = q.get('phim'); E.tap = +q.get('tap') || null; } } catch {}
const luu = () => { try { localStorage.setItem('studio2', JSON.stringify({ ban: E.ban, da: E.da, tap: E.tap, bc: E.bc, luoi: E.luoi, tlCao: E.tlCao, nhuMoi: E.nhuMoi, qtXem: E.qtXem })); } catch {} try { history.replaceState(null, '', `?${E.da ? `phim=${E.da}` : 'trang=moi'}${E.tap ? `&tap=${E.tap}` : ''}&ban=${E.ban}${pro() && D.that && co('nk') ? `&nk=${E.nkBuoc}` : ''}${E.luoi.ten[D.loai] && E.luoi.vi[D.loai] ? `&bc=${E.luoi.ten[D.loai]}` : ''}`); } catch {} };
const pro = () => E.ban === 'pro', boCuc = () => (D.trongTrang ? ['qt', 'xem'] : pro() ? E.bc[D.loai].filter((w) => ((w !== 'nk' && w !== 'qt' && w !== 'hd') || !!D.that) && (!D.that || ((w !== 'lp' || coLop()) && (w !== 'mb' || !!D.set)))) : D.that ? ['qt', 'xem', 'tt'] : BC_MAU.hinh), co = (w) => boCuc().includes(w);
const tong = () => D.canh.reduce((a, c) => a + c.tg, 0), canh = (id) => D.canh.find((c) => c.id === id), vt = (id) => D.canh.findIndex((c) => c.id === id);
const batDau = (i) => D.canh.slice(0, i).reduce((a, c) => a + c.tg, 0), lam2 = (x) => Math.round(x * 100) / 100;
const gio = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const docS = (c) => c.loi.trim().split(/\s+/).filter(Boolean).length / (2.6 * TOC[D.toc]);
/** lời dài hơn cảnh: cảnh từ phim thật so với độ dài đã khớp tiếng, cảnh tự viết thì ước theo số từ */
const dai = (c) => (c.khop != null ? c.tg < c.khop - 0.05 : docS(c) > c.tg + 0.3), canDai = (c) => (c.khop != null ? c.khop : Math.ceil(docS(c) * 2) / 2);
const soLoi = (c) => (dai(c) ? 1 : 0) + (c.ban3 ? 1 : 0) + (c.soi?.length || 0) + (c.kiem?.filter((k) => !k.ok).length || 0);
function canhTai(t) { let s = 0; for (let i = 0; i < D.canh.length; i++) { const c = D.canh[i]; if (t < s + c.tg || i === D.canh.length - 1) return { c, i, s }; s += c.tg; } }
const canhChon = () => (E.chon && E.chon.id !== 'nhac' ? canh(E.chon.id) : null);
const anhNv = (n) => n.anh || NV(n.id), nguoiNoi = () => [...new Set(D.canh.flatMap((c) => c.thoai.map((t) => t.ai)))];
const coLop = () => D.canh.some((c) => c.lop), coClip = () => !!D.vid || D.canh.some((c) => c.vid), nguonCo = () => [coLop() ? 'lop' : null, D.vid3 || D.canh.some((c) => c.k3 || c.vid3) ? '3d' : null, 'anh', coClip() ? 'clip' : null].filter(Boolean);
const TEN_NG = { lop: 'Lớp', '3d': '3D', anh: 'Ảnh', clip: 'Clip' }, nguonDau = () => (!pro() ? 'anh' : coLop() ? 'lop' : coClip() ? 'clip' : 'anh');
const khoHinh = () => [...new Set([...D.canh.map((c) => c.anh), ...KHO_HINH])].slice(0, 30);

const ghi = () => { E.lui.push(JSON.stringify(D)); if (E.lui.length > 80) E.lui.shift(); E.toi = []; };
function hoan(tu, sang) { if (!tu.length) return; sang.push(JSON.stringify(D)); D = JSON.parse(tu.pop()); if (E.chon && E.chon.id !== 'nhac' && !canh(E.chon.id)) E.chon = null; E.t = Math.min(E.t, tong()); veD(); }
let hBao = 0;
function bao(chu, hoanTac, lau) { const b = $('#dBao'); b.innerHTML = `<span>${esc(chu)}</span>${hoanTac ? '<button type="button" data-d="lui">Hoàn tác</button>' : ''}`; b.hidden = false; clearTimeout(hBao); hBao = setTimeout(() => { b.hidden = true; }, lau || 4500); }
function moDuAn(k) { D = DU_AN[k].tao(); GOC = {}; E.nk = null; E.nkCt = {}; E.qt = null; E.gia = null; E.cho = ''; E.dangBuoc = {}; E.loiBuoc = null; E.xuatThat = null; dungTheo(); E.da = k; E.tap = null; E.lui = []; E.toi = []; E.chon = null; E.t = 0; E.canhDang = null; E.nguon = nguonDau(); E.solo = null; E.tab = 'Mẫu'; luu(); }

/** mở một phim THẬT của studio: đọc phim + cảnh của tập, ghép về dự án. Lỗi thì báo ngay trên thanh báo và giữ phim đang mở (lúc khởi động: về phim mẫu). */
let soMo = 0;
async function moPhimThat(pid, tid, khoiDong) {
  const so = ++soMo; E.dangMo = true; if (khoiDong) D = duAnCho(); else { dungChay(); E.menu = null; veD(); }   // lúc khởi động: man('dung') ở cuối tệp vẽ khung chờ
  try {
    const [pd, ds0] = await Promise.all([goi('docPhim', +pid), tid ? goi('dsCanh', +tid) : null]); if (so !== soMo) return;
    if (!pd) throw new Error('studio không trả phim này (phim không còn, hoặc tài khoản chưa có quyền quản trị studio)');
    const tap = pd.tap.find((t) => t.id === +tid) || pd.tap.find((t) => t.so_canh > 0) || pd.tap[0]; if (!tap) throw new Error('phim này chưa có tập nào (mở trong studio để thêm tập)');
    const ds = ds0 && tap.id === +tid ? ds0 : await goi('dsCanh', tap.id); if (so !== soMo) return;
    D = tuStudio(pd, tap, ds); E.nk = null; E.nkCt = {}; E.nkMo = null; datPhimThat(ds, tap); if (D.that.trong && !BO_CUC[E.bcUrl] && !E.bc[D.loai].includes('qt')) E.bcUrl = 'lam';   // phim chưa có cảnh: luôn mở bố cục Làm video mới (có widget Quy trình)
    if (BO_CUC[E.bcUrl]) { E.bc[D.loai] = [...BC_MAU[E.bcUrl]]; E.luoi.vi[D.loai] = viMau(E.bcUrl); E.luoi.ten[D.loai] = E.bcUrl; if (E.luoi.nhom) delete E.luoi.nhom[D.loai]; } E.bcUrl = ''; E.da = String(pd.phim.id); E.tap = tap.id; E.lui = []; E.toi = []; E.chon = null; E.t = 0; E.canhDang = null; E.nguon = nguonDau(); E.solo = null; E.tab = 'Mẫu'; E.vua = false; E.dangMo = false; luu(); man('dung');
  } catch (e) { if (so !== soMo) return; E.dangMo = false; if (khoiDong || D.cho) { if (nguoiMoi()) { D = duAnTrong(); E.da = null; E.tap = null; } else moDuAn('cn'); } veD(); bao(`Không mở được phim #${pid}: ${e.message}`, false, 15000); }
}
/** danh sách phim của studio trong menu chọn phim: gõ là tìm (studio lọc theo tên), chưa gõ = phim sửa gần đây */
let hTim = 0, soTim = 0;
async function timPhim() {
  const so = ++soTim; E.kq = null; E.kqLoi = ''; veKq();
  // studio lọc theo quyền: quản trị thấy phim của studio (chưa gõ: bỏ creative quảng cáo hàng loạt), người trong đội chỉ thấy phim của mình
  try { const r = await goi('dsPhimS2', E.tim.trim(), nguoiMoi()); if (so !== soTim) return; E.kq = r.ds; E.kqTong = r.tong; }
  catch (e) { if (so !== soTim) return; E.kq = []; E.kqLoi = e.message; }
  veKq();
}
function veKqTim() {
  if (E.kqLoi) return `<div class="bao">Không đọc được danh sách phim: ${esc(E.kqLoi)}</div>`;
  if (!E.kq) return '<span class="nho">Đang tìm…</span>';
  if (!E.kq.length) return `<span class="nho">${E.tim.trim() ? 'Không có phim nào khớp tên này.' : !nguoiMoi() ? 'Studio chưa có phim nào.' : 'Bạn chưa có video nào. Bấm ＋ trên thanh trên để tạo video đầu tiên.'}</span>`;
  return E.kq.map((p) => { const tap = (p.tap_tom || []).filter((t) => t.so_canh > 0), dang = E.da === String(p.id);
    return `<button type="button" class="mn-da" data-d="phimThat" data-g="${p.id}" aria-pressed="${dang}" ${(p.tap_tom || []).length ? '' : 'disabled'}><img src="${nho(p.anh, 160)}" alt="" loading="lazy"><span><b>${esc(p.ten)}</b><small>#${p.id}${p.chu && !p.cua_toi ? ` · của ${esc(p.chu)}` : ''} · ${tap.length ? `${tap.length > 1 ? `${tap.length} tập · ` : ''}${tap.reduce((x, t) => x + t.so_canh, 0)} cảnh` : (p.tap_tom || []).length ? 'chưa có cảnh · mở để làm tiếp' : 'chưa có tập'}</small></span></button>`
      + (tap.length > 1 ? `<div class="day-bt mn-tap">${tap.slice(0, 60).map((t) => `<button type="button" class="bt" data-d="phimThat" data-g="${p.id}" data-k="${t.id}" aria-pressed="${dang && E.tap === t.id}" title="${esc(t.ten || '')} · ${t.so_canh} cảnh">Tập ${t.so}</button>`).join('')}</div>` : ''); }).join('')
    + (E.kqTong > E.kq.length ? `<span class="nho">Còn ${E.kqTong - E.kq.length} phim nữa, gõ tên để lọc.</span>` : '');
}
function datMenu() { const m = $('#dMenu'); if (!E.menu || m.hidden) return; const r = E.menu.r, w = m.offsetWidth, cao = m.offsetHeight;
  m.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`; m.style.top = `${r.bottom + 6 + cao > window.innerHeight && r.top - cao - 6 > 0 ? r.top - cao - 6 : r.bottom + 6}px`; }
const veKq = () => { const el = $('#mnKq'); if (el) { el.innerHTML = veKqTim(); datMenu(); } };

// ── widget trên LƯỚI 2 CHIỀU (bản Pro, màn ngang) — thư viện gridstack 14.1.0 (MIT, lib/gridstack-14.1.0): nắm ĐẦU widget kéo tới ô bất kỳ,
//    kéo MÉP / GÓC để co giãn ngang + dọc, widget khác tự nhường chỗ; lưới vừa đúng một màn (không cuộn). Độ mịn lưới chọn ở menu Bố cục (6 × 4 · 12 × 8 · 24 × 16).
//    Vị trí nhớ theo từng loại hình ở E.luoi.vi[loại][widget] = { x, y, w, h } tính theo lưới MỊN NHẤT 24 × 16 (đổi độ mịn không mất bố cục).
//    Bản Gọn + màn hẹp không dùng lưới: lớp bọc .w-o thành display: contents, bố cục cũ chạy như trước. E.bc[loại] vẫn là danh sách widget đang bật.
const HANG = { 6: 4, 12: 8, 24: 16 }, NANG = { tv: 5, kb: 5, pc: 5, xem: 9, mb: 5, lp: 4, nk: 5, hd: 5, cn: 5, qt: 6, tt: 5 };
let GS = null, gsDang = false, gsDau = '';
for (const w in WG) { const s = $(`#w-${w}`), o = document.createElement('div'), c = document.createElement('div'); o.className = 'grid-stack-item w-o'; o.id = `o-${w}`; c.className = 'grid-stack-item-content'; s.before(o); c.append(s); o.append(c); }
// TAB TRONG Ô (anh 20/11/2026: "các widget cho phép xếp chồng lên nhau và trở thành tab giống mos2.on.tc/home") — học cách làm của trang chủ mos2 (apps/web/src/lib/home/luoi.ts: gop / boTab / moTab).
//   Sổ: E.luoi.nhom[loại] = [{ ds: [widget…], mo: tab đang mở }]. Trên lưới cả nhóm là MỘT ô đứng tên widget CHỦ (cái đầu trong nhóm còn bật; vị trí của ô ghi dưới tên nó);
//   khung các widget còn lại được chuyển vào ô của chủ, chỉ tab đang mở hiện ra. Gộp: nắm đầu một widget kéo đi → trên đầu mỗi widget khác hiện dải "Thả vào đây"
//   (đặt ở chỗ đầu widget đứng LÚC BẮT ĐẦU kéo, vì gridstack đẩy ô khác chạy khi kéo ngang qua) → thả trong dải là gộp. Tách: nút "Tách" trên đầu ô.
function nhomTab(ds) { const ra = {}; for (const g of E.luoi.nhom?.[D.loai] || []) { const con = g.ds.filter((w) => ds.includes(w)); if (con.length > 1) ra[con[0]] = { ds: con, mo: con.includes(g.mo) ? g.mo : con[0], goc: g.ds }; } return ra; }
let keoTab = null; const chuot = { x: 0, y: 0 }; document.addEventListener('mousemove', (e) => { chuot.x = e.clientX; chuot.y = e.clientY; if (keoTab) soiDichTab(e); }, true);   // gridstack chỉ báo 'drag' khi ô nhảy sang ô lưới khác, nên dải dưới con trỏ sáng theo chuột
const dichDuoi = (e) => { const p = typeof e?.clientX === 'number' && (e.clientX || e.clientY) ? { x: e.clientX, y: e.clientY } : chuot; return keoTab?.dich.find((o) => { const r = o.getBoundingClientRect(); return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom; }); };
function ketKeoTab() { for (const o of keoTab?.dich || []) o.remove(); keoTab = null; }
function batDauKeoTab(el) { ketKeoTab(); const w = el?.gridstackNode?.id; if (!w || !GS) return; const kc = 24 / E.luoi.n, kr = 16 / HANG[E.luoi.n], truoc = {}, nh = nhomTab(boCuc()), dich = [];
  for (const nd of GS.engine.nodes) truoc[nd.id] = { x: nd.x * kc, y: nd.y * kr, w: nd.w * kc, h: nd.h * kr };
  for (const nd of GS.engine.nodes) { if (nd.id === w) continue; const r = $(`#o-${nd.id} .wg:not(.tab-an) > .w-dau`)?.getBoundingClientRect(); if (!r || !r.width) continue;
    const o = document.createElement('div'); o.className = 'tab-dich'; o.dataset.chu = nd.id; o.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    o.textContent = `＋ Thả vào đây: thành tab cùng ${(nh[nd.id]?.ds || [nd.id]).map((m) => WG[m][0]).join(', ')}`; document.body.append(o); dich.push(o); }
  keoTab = { w, truoc, dich }; }
function soiDichTab(e) { if (!keoTab) return; const d = dichDuoi(e); for (const o of keoTab.dich) o.classList.toggle('trung', o === d); }
/** thả ô `tu` vào ô `vao` (tên widget chủ của hai ô): `tu` và các tab của nó thành tab trong ô `vao`, tab vừa thả là tab đang mở; chỗ cũ của `tu` nhường cho widget kề bên. `vi` = vị trí các ô trước khi kéo. */
function gopTab(tu, vao, vi) { const L = D.loai, nh = (E.luoi.nhom ||= {})[L] ||= [], cua = (w) => nh.find((g) => g.ds.includes(w)), a = cua(tu), b = cua(vao), them = a ? a.ds : [tu], mo = a ? a.mo : tu; if (tu === vao || (a && a === b)) return;
  if (a) nh.splice(nh.indexOf(a), 1); if (b) { b.ds.push(...them.filter((x) => !b.ds.includes(x))); b.mo = mo; } else nh.push({ ds: [vao, ...them], mo });
  if (vi[tu]) boO(vi, tu); E.luoi.vi[L] = vi; delete E.luoi.ten[L]; gsDau = ''; luu(); veD(); bao('Đã xếp thành tab trong một ô. Bấm tên tab để đổi, nút "Tách" để đưa tab đang mở ra ô riêng.'); }
/** đưa widget `w` ra khỏi ô nhiều tab: các tab còn lại giữ nguyên ô, `w` nhận một ô mới (cắt từ widget rộng nhất) */
function tachTab(w) { const L = D.loai, nh = E.luoi.nhom?.[L] || [], gr = nh.find((x) => x.ds.includes(w)); if (!gr) return; if (luoiBat() && GS) ghiLuoi();
  const ds = boCuc(), chuCu = gr.ds.find((x) => ds.includes(x)); gr.ds.splice(gr.ds.indexOf(w), 1); const chuMoi = gr.ds.find((x) => ds.includes(x)); if (gr.mo === w) gr.mo = chuMoi || gr.ds[0];
  const vi = E.luoi.vi[L]; if (vi && chuCu === w && chuMoi && vi[w]) { vi[chuMoi] = vi[w]; delete vi[w]; }
  if (gr.ds.length < 2) nh.splice(nh.indexOf(gr), 1); delete E.luoi.ten[L]; gsDau = ''; luu(); veD(); bao(`Đã tách ${WG[w][0]} ra ô riêng.`); }
/** bố cục đặt sẵn đang dùng (để tô đậm trong menu): chưa sắp tay = của loại hình; đã sắp = bố cục nào trùng khít thì là nó */
const dangBc = () => (E.luoi.vi[D.loai] ? E.luoi.ten[D.loai] || '' : D.loai);
const luoiBat = () => pro() && window.innerWidth > 900 && E.man === 'dung' && typeof GridStack !== 'undefined', caoO = () => Math.max(24, $('#dGiua').clientHeight / HANG[E.luoi.n]);
/** bố cục mặc định: một hàng cao hết khu, bề rộng chia theo NANG (Khung xem rộng nhất); nhiều widget hơn số cột thì xếp hai hàng */
function luoiMau(ds, n, r) {
  const hang = ds.length > n ? [ds.slice(0, Math.ceil(ds.length / 2)), ds.slice(Math.ceil(ds.length / 2))] : [ds], vi = {};
  hang.forEach((hg, k) => { const tong = hg.reduce((a, w) => a + NANG[w], 0), rong = hg.map((w) => Math.max(1, Math.floor(NANG[w] / tong * n))); let du = n - rong.reduce((a, x) => a + x, 0);
    for (const w of ['xem', ...hg]) { if (du <= 0) break; const i = hg.indexOf(w); if (i >= 0) { rong[i]++; du--; } }
    let x = 0; const h = Math.floor(r / hang.length), y = k * h; hg.forEach((w, i) => { vi[w] = { x, y, w: rong[i], h: k === hang.length - 1 ? r - y : h }; x += rong[i]; }); });
  return vi;
}
/** bật thêm một widget: lấy phần bên phải của widget đang rộng nhất (thường là Khung xem); không ai đủ rộng → để gridstack tự tìm chỗ */
function chenO(vi, n) { const ung = Object.entries(vi).filter(([, v]) => v.w >= 2).sort((a, b) => b[1].w * b[1].h - a[1].w * a[1].h || (b[0] === 'xem') - (a[0] === 'xem'))[0]; if (!ung) return null;
  const c = ung[1], nw = Math.max(1, Math.min(Math.round(n / 4), Math.floor(c.w / 2))); c.w -= nw; return { x: c.x + c.w, y: c.y, w: nw, h: c.h }; }
/** tắt một widget: chỗ trống nhường cho widget liền kề cùng hàng cùng chiều cao (ưu tiên Khung xem, rồi bên trái) */
function boO(vi, w) { const r = vi[w]; delete vi[w]; const ke = Object.entries(vi).filter(([, a]) => a.y === r.y && a.h === r.h && (a.x + a.w === r.x || a.x === r.x + r.w)).sort((a, b) => (b[0] === 'xem') - (a[0] === 'xem') || a[1].x - b[1].x)[0];
  if (ke) { if (ke[1].x > r.x) ke[1].x = r.x; ke[1].w += r.w; return; }
  const doc = Object.entries(vi).find(([, a]) => a.x === r.x && a.w === r.w && (a.y + a.h === r.y || a.y === r.y + r.h)); if (doc) { if (doc[1].y > r.y) doc[1].y = r.y; doc[1].h += r.h; } }
/** đọc vị trí thật trên lưới; `nho` = ghi vào sổ của loại hình (chỉ khi người dùng đã tự sắp — chưa sắp thì loại đó cứ theo bố cục đặt sẵn) */
function ghiLuoi(nho = true) { if (!GS) return; const kc = 24 / E.luoi.n, kr = 16 / HANG[E.luoi.n], vi = {}; for (const nd of GS.engine.nodes) vi[nd.id] = { x: nd.x * kc, y: nd.y * kr, w: nd.w * kc, h: nd.h * kr }; if (nho) E.luoi.vi[D.loai] = vi; gsDau = JSON.stringify([E.luoi.n, D.loai, vi]); }
function tatLuoi() { const g = $('#dGiua'); if (GS) { GS.destroy(false); GS = null; } gsDau = ''; g.classList.remove('luoi-bat', 'grid-stack', 'dang-keo', 'hien-luoi'); g.style.height = ''; g.style.minHeight = '';
  ketKeoTab(); for (const w in WG) { const o = $(`#o-${w}`), noi = o.firstElementChild, k = $(`#w-${w}`); if (k.parentElement !== noi) noi.append(k); k.classList.remove('tab-an'); o.hidden = false; o.removeAttribute('style'); for (const a of [...o.attributes]) if (a.name.startsWith('gs-')) o.removeAttribute(a.name); o.querySelectorAll(':scope > .ui-resizable-handle').forEach((x) => x.remove()); } }
function dongBoLuoi(ds) {
  if (!luoiBat() || !$('#dGiua').clientHeight) return tatLuoi();
  const g = $('#dGiua'), n = E.luoi.n, r = HANG[n], kc = 24 / n, kr = 16 / r;
  // nhóm tab: chỉ widget chủ là ô trên lưới; khung các widget cùng nhóm nằm trong ô của chủ, tab đang mở mới hiện
  const nh = nhomTab(ds), chuT = {}; for (const [c, x] of Object.entries(nh)) for (const m of x.ds) chuT[m] = c; ds = ds.filter((w) => !chuT[w] || chuT[w] === w);
  for (const w in WG) { const c = chuT[w], noi = $(`#o-${c || w}`).firstElementChild, k = $(`#w-${w}`); if (k.parentElement !== noi) noi.append(k); k.classList.toggle('tab-an', !!c && nh[c].mo !== w); }
  if (!GS) { g.classList.add('luoi-bat');
    GS = GridStack.init({ column: n, maxRow: r, cellHeight: caoO(), margin: 4, mode: 'float', animate: false, auto: false, handle: '.w-dau', draggable: { handle: '.w-dau', cancel: 'button, input, a, textarea, select' }, resizable: { handles: 'e, se, s, sw, w' }, alwaysShowResizeHandle: false }, g);
    GS.on('dragstart resizestart', (e, el) => { g.classList.add('dang-keo'); if (e?.type === 'dragstart') batDauKeoTab(el); });
    GS.on('dragstop resizestop', (e) => { g.classList.remove('dang-keo'); const k = keoTab, d = k && e?.type === 'dragstop' ? dichDuoi(e) : null, vao = d?.dataset.chu; ketKeoTab(); if (gsDang) return;
      if (vao) return void setTimeout(() => gopTab(k.w, vao, k.truoc), 0);   // thả trong dải "Thả vào đây": gộp thành tab (làm sau khi gridstack khép lượt kéo)
      ghiLuoi(); delete E.luoi.ten[D.loai]; luu(); veD(); }); }
  g.style.setProperty('--so-cot', n); g.style.setProperty('--so-hang', r); g.classList.toggle('hien-luoi', E.luoi.hien);
  const daSap = !!E.luoi.vi[D.loai], goc = E.luoi.vi[D.loai] || viMau(D.loai), mep = (a, b, k, toiDa) => { let m0 = Math.max(0, Math.min(toiDa - 1, Math.round(a / k))), m1 = Math.min(toiDa, Math.round((a + b) / k)); if (m1 <= m0) m1 = m0 + 1; return [m0, m1 - m0]; }, kep = (v) => { const [x, w] = mep(v.x, v.w, kc, n), [y, h] = mep(v.y, v.h, kr, r); return { x, y, w, h }; };
  let vi = goc ? Object.fromEntries(Object.entries(goc).filter(([w, v]) => WG[w] && v && v.w > 0 && v.h > 0).map(([w, v]) => [w, kep(v)])) : {};
  for (const [c, x] of Object.entries(nh)) { if (!vi[c]) { const m = x.goc.find((y) => vi[y]); if (m) vi[c] = vi[m]; } for (const y of x.goc) if (y !== c) delete vi[y]; }   // vị trí của ô đi theo widget chủ hiện tại
  if (!Object.keys(vi).length) vi = luoiMau(ds, n, r);
  else { for (const w of Object.keys(vi)) if (!ds.includes(w)) boO(vi, w); for (const w of ds) if (!vi[w]) vi[w] = chenO(vi, n) || { w: Math.max(1, Math.round(n / 4)), h: r }; }
  const dau = JSON.stringify([n, D.loai, Object.fromEntries(Object.entries(vi).map(([w, v]) => [w, { x: v.x * kc, y: v.y * kr, w: v.w * kc, h: v.h * kr }]))]);
  if (dau === gsDau && ds.every((w) => $(`#o-${w}`).gridstackNode) && GS.engine.nodes.length === ds.length) return;   // lưới đang đúng như sổ: không đụng (veD gọi rất dày)
  gsDang = true; GS.batchUpdate(); GS.removeAll(false, false);
  for (const w in WG) $(`#o-${w}`).hidden = !ds.includes(w);
  for (const w of [...ds].sort((a, b) => (vi[a].y ?? 99) - (vi[b].y ?? 99) || (vi[a].x ?? 99) - (vi[b].x ?? 99))) GS.makeWidget($(`#o-${w}`), { id: w, ...vi[w], autoPosition: vi[w].x == null });
  GS.batchUpdate(false); gsDang = false; ghiLuoi(daSap);
}
// chiều cao một ô = chiều cao khu widget / số hàng: khu này co giãn theo cửa sổ + timeline (timeline vẽ SAU bố cục) nên đo lại mỗi khi nó đổi cỡ
let caoCu = 0; new ResizeObserver(() => { if (!GS) return; const c = caoO(); if (Math.abs(c - caoCu) > 0.2) { caoCu = c; GS.cellHeight(c); } }).observe($('#dGiua'));
// kéo mép trên timeline để đổi chiều cao (bản Pro, màn ngang); bấm đúp = về chiều cao tự nhiên
const datTlCao = () => { $('#dung').style.setProperty('--tl-cao', E.tlCao ? `${E.tlCao}px` : 'auto'); $('#dung').classList.toggle('tl-tay', !!E.tlCao); };
let keoTl = null; datTlCao();
$('#tlKeo').addEventListener('pointerdown', (e) => { if (e.button || !luoiBat()) return; e.preventDefault(); keoTl = { y: e.clientY, h0: $('#dTl').getBoundingClientRect().height }; $('#tlKeo').setPointerCapture(e.pointerId); document.body.classList.add('keo-doc'); });
$('#tlKeo').addEventListener('pointermove', (e) => { if (!keoTl) return; E.tlCao = Math.round(Math.max(110, Math.min(window.innerHeight * 0.62, keoTl.h0 + keoTl.y - e.clientY))); datTlCao(); if (GS) GS.cellHeight(caoO()); });
const thaTl = () => { if (!keoTl) return; keoTl = null; document.body.classList.remove('keo-doc'); luu(); veD(); if (GS) GS.cellHeight(caoO()); };
$('#tlKeo').addEventListener('pointerup', thaTl); $('#tlKeo').addEventListener('pointercancel', thaTl);
$('#tlKeo').addEventListener('dblclick', () => { E.tlCao = 0; datTlCao(); luu(); veD(); if (GS) GS.cellHeight(caoO()); });

// ── LÀM VIDEO THẬT trên studio (chỉ phim của studio): hộp tạo video, widget QUY TRÌNH (16 mục studio tính: đạt / thiếu gì / gác cổng nào) và các NÚT BƯỚC.
//    Mỗi nút gọi đúng một bước của studio qua đường ghi; studio tự gác cổng quy trình + cổng tiền, từ chối thì câu của studio hiện ngay dưới nút.
//    Bước tốn tiền: bấm lần đầu hiện giá ước, bấm lần nữa mới chạy — mỗi lần bấm một bước, xem kết quả rồi mới bấm bước kế (không chạy chuỗi).
const GIA_CHU = { viet: 0.05, tach: 0.06, nx: 0.02, nxSua: 0.05, pc: 3.7, anchor: 0.1 };   // ¢ mỗi lượt máy viết, chỉ để báo trước; tiền thật xem ở Nhật ký. Viết kịch bản + tách cảnh: số thật của ba lượt 20/11/2026 trên đường chữ studio đang đi (donk:claude-opus-5-5: 0,05¢ · 0,05¢ · 0,06¢); con số cũ 7¢ / 43¢ là của đường Claude chính hãng, đường ấy giờ chỉ chạy khi các cổng rẻ đều hỏng
const TEN_BUOC = { astro: 'Hỏi Astrolas', brief: 'Lưu ý tưởng', viet: 'Máy viết kịch bản', tach: 'Máy tách thành cảnh', nx: 'Thử người xem', nxSua: 'Máy sửa theo góp ý người xem', vaiTt: 'Đặt shot tổng thể cho phân cảnh còn thiếu', ganNguoi: 'Gắn mẫu người vào các cảnh có người', boKhuon: 'Bỏ khuôn dựng phim truyện của tập này', kiemKhung: 'Máy kiểm khung các ảnh', soiBo: 'Nhận các clip máy soi báo lỗi', uvMoi: 'Dùng ảnh mới vẽ cho các cảnh', mauVe: 'Vẽ lại ảnh mẫu', kfMau: 'Vẽ lại các cảnh dùng mẫu này', giong1: 'Đọc lại lời cảnh này', traPhi: 'Cho phép video trả phí cho tập này', kfLech: 'Vẽ lại các ảnh máy báo lệch', khungNhan: 'Nhận các ảnh máy báo lệch', nxNhan: 'Tôi nhận kịch bản này', pc: 'Máy gợi ý phong cách', pcDung: 'Dùng gợi ý này', anchor: 'Máy đề xuất nhân vật, bối cảnh', anhMau: 'Vẽ ảnh mẫu còn thiếu',
  kf: 'Vẽ ảnh các cảnh chưa có', kf1: 'Vẽ lại ảnh cảnh này', duyet: 'Duyệt các ảnh đã có', duyet1: 'Duyệt ảnh cảnh này', giong: 'Đọc lời cả tập', animatic: 'Chốt nhịp trước khi dựng clip', clip: 'Dựng clip các cảnh đã duyệt', clip1: 'Dựng clip cảnh này', nhac: 'Sinh nhạc nền', xuat: 'Xuất video' };
const NUT_QT = { brief: ['brief'], truyen: ['tach'], kich_ban: ['viet', 'tach'], nguoi_xem: ['nx', 'nxSua', 'nxNhan'], phong_cach: ['pc'], phan_canh: ['vaiTt'], mau_doi_tuong: ['anchor', 'anhMau'], mau_boi_canh: ['ganNguoi', 'anchor', 'anhMau'], keyframe: ['kf', 'uvMoi', 'duyet'], giong: ['giong'], nhac: ['nhac'] };
const canhThat = () => D.canh.map((c) => GOC[c.id]).filter(Boolean);
const canhThieu = (b) => canhThat().filter((c) => (b === 'uv' ? !c.dang_sinh_anh && Array.isArray(c.keyframe_uv) && c.keyframe_uv.length > 1 && c.keyframe_uv.at(-1) !== c.keyframe_url : b === 'lech' ? !!c.keyframe_url && c.kiem_khung?.dat === false && !c.kiem_khung.duyet_tay && c.kiem_khung.url === c.keyframe_url : b === 'kf' ? !c.keyframe_url && !c.dang_sinh_anh : b === 'duyet' ? c.keyframe_url && (c.trang_thai === 'co_keyframe' || c.trang_thai === 'nhap') : c.trang_thai === 'duyet' && !c.video_url && !c.video_cuoi_url && !c.video_dang));
/** giá ước của một bước (¢): 0 = không tốn · null = có tốn nhưng chưa ước được */
/** bộ sinh video chính của phim (kinh_thanh.bo_sinh_video; studio mặc định 'h3'): 'h3' / 'seedance' = bấm dựng clip chỉ xếp hàng, lô chạy sau trên máy thuê / Kie */
const boSinh = () => D.that?.kt?.bo_sinh_video || 'h3', xepHang = () => boSinh() === 'h3' || boSinh() === 'seedance';
/** các cảnh đang gắn mẫu `id` */
const canhMau = (id) => canhThat().filter((c) => (Array.isArray(c.nhan_vat) ? c.nhan_vat : []).map(Number).includes(+id));
function giaBuoc(k) { const g = E.gia || {}, [b, sid] = k.split(':'), giay = (ds) => ds.reduce((a, c) => a + (+c.thoi_luong_s || 0), 0);
  switch (b) { case 'soiBo': case 'uvMoi': case 'traPhi': case 'khungNhan': case 'vaiTt': case 'ganNguoi': case 'boKhuon': case 'brief': case 'nxNhan': case 'pcDung': case 'duyet': case 'duyet1': case 'animatic': case 'xuat': return 0;
    case 'viet': case 'tach': case 'nx': case 'nxSua': case 'pc': case 'anchor': return GIA_CHU[b];
    case 'kf': return g.anh1 ? g.anh1 * canhThieu('kf').length : null; case 'kfLech': return g.anh1 ? g.anh1 * canhThieu('lech').length : null; case 'mauVe': return g.anh1 || null; case 'kfMau': return g.anh1 ? g.anh1 * canhMau(sid).length : null; case 'kf1': return g.anh1 || null;
    case 'clip': return xepHang() ? 0 : g.giay1 ? g.giay1 * giay(canhThieu('clip')) : null; case 'clip1': return xepHang() ? 0 : g.giay1 && GOC[sid] ? g.giay1 * (+GOC[sid].thoi_luong_s || 0) : null;
    case 'giong': return g.giong ?? null; case 'nhac': return g.nhac ?? null; default: return null; } }
/** chạy một việc lần lượt cho từng cảnh; cảnh nào studio từ chối thì ghi lại rồi ĐI TIẾP cảnh sau (trước đây dừng cả loạt ở cảnh đầu tiên bị từ chối), cuối cùng báo đủ từng cảnh */
async function lanLuot(ds, lam) { const loi = []; let ok = 0, khoaVx = 0; for (const c of ds) { try { await lam(c); ok++; } catch (e) { if (/chưa thử VideoExpress/.test(e.message)) khoaVx++; else loi.push(`cảnh ${Math.round(+c.thu_tu)}: ${String(e.message).replace(/^Shot #\d+ /, '')}`); } }
  if (khoaVx) loi.unshift(`${khoaVx} cảnh: studio đang khoá video trả phí. Luật của studio là thử dựng bằng VideoExpress (0₫) trước, hoặc quản trị bấm "Cho phép video trả phí cho tập này" ngay trong mục Dựng clip`);
  if (loi.length) throw new Error(`${ok}/${ds.length} cảnh chạy được, ${ds.length - ok} cảnh bị từ chối — ${loi.join(' ‖ ')}`); }
/** VẼ LẠI ảnh của cảnh đã có ảnh: studio chỉ thêm ỨNG VIÊN (keyframe_uv), ảnh đang dùng giữ nguyên. Người bấm "vẽ lại" là muốn ảnh mới → nhớ số ứng viên lúc bấm
 *  (E.thayUv), lần đọc lại nào thấy cảnh đó có thêm ứng viên thì chọn ứng viên mới nhất (chonKeyframe, 0đ). Trang đóng trước khi ảnh về thì còn nút "Dùng ảnh mới vẽ". */
const veLaiCanh = (c) => { (E.thayUv ||= {})[c.id] = Array.isArray(c.keyframe_uv) ? c.keyframe_uv.length : 0; return ghiSv('sinhKeyframe', c.id, 1); };
async function apUvMoi() { const cho = E.thayUv || {}; let doi = 0;
  for (const c of canhThat()) { const n0 = cho[c.id]; if (n0 == null || c.dang_sinh_anh) continue; const uv = Array.isArray(c.keyframe_uv) ? c.keyframe_uv : []; if (uv.length <= n0) continue;
    delete cho[c.id]; if (uv.at(-1) !== c.keyframe_url) { try { await ghiSv('chonKeyframe', c.id, uv.at(-1)); doi++; } catch {} } }
  return doi; }
const BUOC_SV = {
  brief: (t) => { if (t.coCachKe && E.coSo === undefined) throw new Error('đang đọc cơ sở Astrolas của video, bấm lại sau vài giây'); return ghiSv('suaTap', t.tap, { brief: t.coCachKe ? briefDayDu() : E.kb.brief.trim() }); },
  astro: async (t) => { const q = (E.cs.cauHoi || E.kb.brief).trim(); if (q.length < 8) throw new Error('gõ điều bạn muốn Astrolas phân tích'); E.coSo = await ghiSv('phanTichAstrolasS2', t.tap, { cauHoi: q, nguoi: E.cs.nguoi, ngonNgu: t.kt.ngon_ngu || 'vi' }); },
  viet: (t) => { if (!E.kb.brief.trim()) throw new Error('chưa có ý tưởng: gõ điều bạn muốn chia sẻ và bạn nghĩ gì về nó'); return ghiSv('vietKichBanTap', t.tap, briefDayDu(), E.kb.giay); },
  tach: (t) => ghiSv('tachCanhTap', t.tap, 0, E.kb.giay),
  nx: async (t) => { E.viecNx = await ghiSv('batDauNguoiXem', t.tap); },
  nxSua: async (t) => { E.nxSua = { tap: t.tap, ...(await ghiSv('suaTheoNguoiXem', t.tap)) }; },
  nxNhan: (t) => ghiSv('duyetNguoiXemTayAction', t.tap),
  pc: async (t) => { E.goiY = await ghiSv('goiYAIKinhThanh', t.phim); },
  pcDung: async (t) => { const g = E.goiY; if (!g) return; await ghiSv('suaPhim', t.phim, { mo_ta: g.mo_ta || t.moTa, kinh_thanh: { ...t.kt, phong_cach: g.phong_cach, ...(g.logline ? { logline: g.logline } : {}), ...(g.chu_de ? { chu_de: g.chu_de } : {}) } }); E.goiY = null; },
  anchor: (t) => ghiSv('goiYAIBoAnchor', t.phim),
  // studio chỉ vẽ ảnh cho mẫu mà cảnh đang dùng; trả 0 ảnh thì phải nói ra, không thì người làm tưởng nút chết
  anhMau: async (t) => { const r = await ghiSv('sinhAnhThieuAction', t.phim) || {}, so = (+r.goc || 0) + (+r.bienThe || 0), phu = [...(r.loi || []), ...(r.cho || []).map((x) => `${x}: chờ ảnh gốc`)];
    if (!so) throw new Error(phu.join(' · ') || 'studio không vẽ ảnh nào: mẫu còn thiếu ảnh chưa được gắn vào cảnh nào (studio chỉ vẽ mẫu mà cảnh đang dùng). Gắn mẫu vào cảnh, hoặc mở phim ở studio để bỏ mẫu thừa.');
    bao(`Studio đang vẽ ${so} ảnh mẫu, xong sẽ tự hiện.${phu.length ? ' Chưa vẽ được: ' + phu.join(' · ') : ''}`, false, 9000); },
  // phân cảnh từ 3 shot trở lên phải có một shot tổng thể (ai ở đâu): lấy shot rộng nhất của phân cảnh đó, tránh shot đang là vai duy nhất của cả tập (phản ứng / tâm trạng / chủ quan)
  vaiTt: async () => { const ds = canhThat(), v = (c) => c.ky_thuat?.vai || '', dem = (x) => ds.filter((c) => v(c) === x).length, RONG = ['ews', 'ws', 'trung_toan', 'two', 'ms'], pd = {}; let sua = 0;
    for (const c of ds) if (c.phan_doan) (pd[c.phan_doan] ||= []).push(c);
    for (const g of Object.values(pd)) { if (g.length < 3 || g.some((c) => ['tong_the', 'thiet_lap'].includes(v(c)))) continue;
      const ung = g.filter((c) => !(['phan_ung', 'tam_trang', 'chu_quan', 'nguoi_thu_ba'].includes(v(c)) && dem(v(c)) < 2)), hang = (c) => { const i = RONG.indexOf(c.ky_thuat?.co_canh); return i < 0 ? 9 : i; }, c = (ung.length ? ung : g).slice().sort((a, b) => hang(a) - hang(b))[0];
      await ghiSv('suaCanh', c.id, { ky_thuat: { ...(c.ky_thuat || {}), vai: 'tong_the' } }); sua++; }
    if (!sua) throw new Error('không thấy phân cảnh nào thiếu shot tổng thể; bấm ↻ đọc lại quy trình'); },
  // studio báo "shot có người mà chưa gắn mẫu người": phim có đúng MỘT mẫu người (người kể) thì gắn vào các cảnh đó
  ganNguoi: async (t) => { const m = t.mauNguoi || [], so = (E.qt?.ds?.find((x) => x.key === 'mau_boi_canh')?.thieu || []).map((x) => +(x.match(/^#(\d+)/) || [])[1]).filter(Boolean);
    if (!m.length) throw new Error('phim chưa có mẫu người nào. Bấm "Máy đề xuất nhân vật, bối cảnh" trước.'); if (m.length > 1) throw new Error('phim có nhiều mẫu người, máy không biết cảnh nào của ai. Gắn từng cảnh ở studio.');
    if (!so.length) throw new Error('quy trình không báo cảnh nào thiếu mẫu người; bấm ↻ đọc lại'); let gan = 0;
    for (const c of canhThat()) { const cu = Array.isArray(c.nhan_vat) ? c.nhan_vat : []; if (!so.includes(Math.round(+c.thu_tu)) || cu.includes(m[0])) continue; await ghiSv('suaCanh', c.id, { nhan_vat: [...cu, m[0]] }); gan++; }
    bao(`Đã gắn mẫu người vào ${gan} cảnh. Mẫu chưa có ảnh thì bấm "Vẽ ảnh mẫu còn thiếu".`, false, 8000); },
  // khuôn dựng (Phát hiện, Vả mặt, Kết treo…) là của phim truyện; video chia sẻ góc nhìn không theo khuôn đó thì gỡ, studio chụp bản trước để hoàn tác
  boKhuon: (t) => ghiSv('luuKhuonChuoi', t.tap, []),
  kf: () => lanLuot(canhThieu('kf'), (c) => ghiSv('sinhKeyframe', c.id, 1)),
  kf1: (t, sid) => { const c = GOC[sid]; (E.thayUv ||= {})[c.id] = Array.isArray(c.keyframe_uv) ? c.keyframe_uv.length : 0; return ghiSv('sinhLaiCanhS2', c.id, 'anh', layYc()); },
  uvMoi: () => lanLuot(canhThieu('uv'), (c) => ghiSv('chonKeyframe', c.id, c.keyframe_uv.at(-1))),
  duyet: () => lanLuot(canhThieu('duyet'), (c) => ghiSv('duyetCanh', c.id, true)),
  duyet1: (t, sid) => ghiSv('duyetCanh', GOC[sid].id, true),
  giong: (t) => ghiSv('sinhGiong', t.tap),
  animatic: (t) => ghiSv('duyetAnimatic', t.tap),
  // SINH THỦ CÔNG từng thứ: ảnh mẫu của một mẫu (ảnh cũ vào thùng rác studio, vẽ mới từ mô tả), ảnh các cảnh dùng mẫu đó, lời đọc của một cảnh
  mauVe: async (t, id) => { await ghiSv('veLaiAnhMauS2', t.phim, +id, layYc()); bao('Studio đang vẽ ảnh mẫu mới, xong sẽ tự hiện. Các cảnh dùng mẫu này vẫn giữ ảnh cũ tới khi bấm vẽ lại.', false, 9000); },
  kfMau: (t, id) => lanLuot(canhMau(id), veLaiCanh),
  giong1: (t, sid) => ghiSv('sinhLaiCanhS2', GOC[sid].id, 'giong', layYc()),
  traPhi: async (t) => { const so = await ghiSv('moTraPhiS2', t.tap, true); bao(`Đã mở video trả phí cho ${+so || 0} cảnh. Mở khoá không tốn tiền; tiền chỉ phát sinh khi lô dựng chạy.`, false, 9000); },
  // studio không cho xuất khi máy soi báo clip có lỗi (chữ lạ, vật thể lạ…): người làm xem clip thấy máy báo quá tay thì nhận clip đó (boQuaSoiClipAction, 0đ)
  soiBo: () => { const so = [...String(E.loiXuat || '').matchAll(/#(\d+):/g)].map((m) => +m[1]); return lanLuot(canhThat().filter((c) => so.includes(Math.round(+c.thu_tu))), (c) => ghiSv('boQuaSoiClipAction', c.id)).then(() => { E.loiXuat = ''; }); },
  kfLech: () => lanLuot(canhThieu('lech'), veLaiCanh),
  khungNhan: () => lanLuot(canhThieu('lech'), (c) => ghiSv('duyetKhungTayAction', c.id)),
  kiemKhung: async (t) => { const r = await ghiSv('kiemKhungTapAction', t.tap) || {}; bao(`Máy đã kiểm ${+r.shot || 0} ảnh trong ${+r.khoi || 0} khối cảnh: ${+r.lech ? `${+r.lech} ảnh lệch, xem ở mục Storyboard rồi vẽ lại ảnh đó` : 'không ảnh nào lệch'}.`, false, 9000); },
  clip: async () => { const ds = canhThieu('clip'); await lanLuot(ds, (c) => ghiSv('sinhVideoCanh', c.id)); if (xepHang()) bao(`Đã xếp hàng ${ds.length} cảnh cho bộ ${boSinh() === 'h3' ? 'H3 (máy thuê)' : 'Seedance'}. Hàng chạy theo lô do quản trị khởi động; clip xong sẽ tự hiện ở đây.`, false, 12000); },
  clip1: (t, sid) => ghiSv('sinhLaiCanhS2', GOC[sid].id, 'clip', layYc()),
  nhac: (t) => ghiSv('sinhNhac', t.tap),
  xuat: async (t) => { E.xuatThat = { job: await ghiSv('xuatTap', t.tap), tt: 'chay', url: null, loi: '' }; },
};
const veBuoc = () => { if (co('qt')) veQt(); if (co('tt')) veTt(); if (E.xuat === 'that') vePhu(); };
async function chayBuoc(k) {
  const t = D.that, b = k.split(':')[0]; if (!t || E.dangBuoc[k] || !BUOC_SV[b]) return; const gia = giaBuoc(k);
  if (coSua()) return bao('Có chỗ sửa chưa lưu. Bấm “Lưu về studio” trên thanh trên trước, rồi chạy bước này (chạy bước sẽ đọc lại phim từ studio).', false, 9000);
  if (gia !== 0 && E.cho !== k) { E.cho = k; E.loiBuoc = null; veBuoc(); setTimeout(() => { if (E.cho === k) { E.cho = ''; veBuoc(); } }, 8000); return bao(`${TEN_BUOC[b]}: ${gia == null ? 'bước này có tốn tiền' : `khoảng ${tienDo(gia)}`}. Bấm lần nữa để chạy.`); }
  E.cho = ''; E.dangBuoc[k] = true; E.loiBuoc = null; veBuoc();
  const truoc = E.chuKy;
  try { await BUOC_SV[b](t, k.split(':')[1]); delete E.dangBuoc[k]; await taiLai(true); napHd(true); theoDoi(); }
  catch (e) { if (b === 'xuat' && /lỗi soi/.test(e.message)) E.loiXuat = e.message;
    if (e.chuaKip) { E.dangBuoc[k] = 'lau'; veBuoc(); return choBuoc(k, truoc, t.tap); } delete E.dangBuoc[k]; E.loiBuoc = { k, loi: e.message }; await taiLai(true).catch(() => {}); }
  veBuoc();
}
/** cổng mạng cắt câu trả lời ở 100 giây mà bước vẫn chạy bên studio (tách cảnh thật 20/11/2026: 298 giây): giữ nút ở "vẫn đang chạy", 10 giây đọc lại phim một lần, dữ liệu đổi thì hiện kết quả; quá 12 phút mới báo */
function choBuoc(k, truoc, tap, lan = 0) { setTimeout(async () => { if (D.that?.tap !== tap || E.dangBuoc[k] !== 'lau') return;
  try { await taiLai(false); } catch {}
  if (D.that?.tap !== tap) return;
  if (E.chuKy !== truoc) { delete E.dangBuoc[k]; await taiLai(true).catch(() => {}); theoDoi(); return veBuoc(); }
  if (lan >= 72) { delete E.dangBuoc[k]; E.loiBuoc = { k, loi: 'đã chờ 12 phút mà phim chưa có gì mới. Bấm ↻ đọc lại; vẫn chưa có thì chạy lại bước này.' }; return veBuoc(); }
  choBuoc(k, truoc, tap, lan + 1); }, 10000); }
/** SINH LẠI có ô yêu cầu riêng (anh 20/11/2026: "ảnh, clip, voice luôn có kèm 1 nút để sinh lại; bấm vào thì hiện 1 input để thêm yêu cầu riêng (optional)…
 *  có cảnh báo về chi phí trước khi bấm submit"). Bấm nút → hộp: ô yêu cầu (bỏ trống = sinh lại theo cấu trúc chung) + dòng chi phí + nút Sinh lại. */
const SINH_LAI = { kf1: 'anh', clip1: 'clip', giong1: 'giong', mauVe: 'mau' };
const giaSl = (k) => { const b = k.split(':')[0], g = giaBuoc(k); if (b === 'clip1' && xepHang()) return 'Xếp hàng không tốn tiền. Khi lô H3 chạy trên máy thuê: khoảng 2.550₫ cho cảnh này (3 bản, máy tự chọn bản tốt nhất).';
  return `${g ? `Chi phí khoảng ${tienDo(g)} theo giá studio báo` : 'Bước này có tốn tiền (studio chưa báo được giá)'}${b === 'giong1' ? '' : '; có yêu cầu riêng thì thêm một lượt dịch nhỏ'}. Tiền thật xem ở Hàng đợi.`; };
const hopSl = (k) => (E.sl?.k === k ? `<div class="sl-hop"><textarea id="slYc" rows="2" maxlength="600" placeholder="Yêu cầu riêng cho lần sinh này (không bắt buộc). Bỏ trống = sinh lại theo cấu trúc chung" aria-label="Yêu cầu riêng">${esc(E.sl.yc)}</textarea>`
  + `<span class="nho sl-gia">${giaSl(k)}</span><div class="day-bt"><button type="button" class="bt chinh" data-d="slChay" data-g="${k}">Sinh lại</button><button type="button" class="bt" data-d="slThoi">Thôi</button></div></div>` : '');
const layYc = () => { const y = E.slYc || ''; E.slYc = ''; return y; };
function nutBuoc(k) { const b = k.split(':')[0], sid = k.split(':')[1], gia = giaBuoc(k), cho = E.cho === k, ban = E.dangBuoc[k], c = sid ? GOC[sid] : null;
  const n = b === 'kf' || b === 'duyet' || b === 'clip' ? canhThieu(b).length : b === 'kfLech' || b === 'khungNhan' ? canhThieu('lech').length : b === 'kfMau' ? canhMau(sid).length : b === 'uvMoi' ? canhThieu('uv').length : -1;
  const tat = ban || n === 0 || (b === 'duyet1' && !(c?.keyframe_url && (c.trang_thai === 'co_keyframe' || c.trang_thai === 'nhap'))) || (b === 'clip1' && !['duyet', 'xong'].includes(c?.trang_thai)) || (b === 'pcDung' && !E.goiY) || (b === 'nxSua' && !(D.that?.nx && !D.that.nx.dat));
  const ten = b === 'clip' && xepHang() ? `Xếp hàng dựng clip bằng ${boSinh() === 'h3' ? 'H3' : 'Seedance'}` : b === 'kf1' && c && !c.keyframe_url ? 'Vẽ ảnh cảnh này' : b === 'clip1' && c && (c.video_url || c.video_cuoi_url) ? 'Dựng lại clip cảnh này' : TEN_BUOC[b];
  if (SINH_LAI[b] && !ban) return `<button type="button" class="bt" data-d="slMo" data-g="${k}" aria-expanded="${E.sl?.k === k}" ${tat ? 'disabled' : ''}${xemQt() ? ` title="${esc(ten)}${tipAttr(SINH_LAI[b] === 'mau' ? 'mau' : SINH_LAI[b], sid)}"` : ''}>↻ ${ten}</button>${hopSl(k)}`
    + (E.loiBuoc?.k === k ? `<div class="bao">Studio không chạy bước này: ${esc(E.loiBuoc.loi)}</div>` : '');
  return `<button type="button" class="bt${cho ? ' chinh' : ''}" data-d="buoc" data-g="${k}" ${tat ? 'disabled' : ''}${b === 'clip1' && !['duyet', 'xong'].includes(c?.trang_thai) ? ' title="Duyệt ảnh của cảnh trước, studio mới cho dựng clip"' : ''}>${ban === 'lau' ? 'Vẫn đang chạy bên studio… xong sẽ tự hiện (có bước mất 5 phút)' : ban ? 'Đang chạy…' : cho ? `Bấm lần nữa để chạy${gia ? ` · khoảng ${tienDo(gia)}` : ''}` : `${ten}${n > 0 ? ` (${n})` : ''}${gia === 0 ? '' : gia == null ? ' · có tốn tiền' : ` · khoảng ${tienDo(gia)}`}`}</button>`
    + (E.loiBuoc?.k === k ? `<div class="bao">Studio không chạy bước này: ${esc(E.loiBuoc.loi)}</div>` : ''); }
/** thứ studio đang giữ về phim này sau mỗi lần đọc: ô ý tưởng, chữ ký dữ liệu (để vòng theo dõi biết có gì đổi) */
function datPhimThat(ds, tap) { E.cho = ''; E.dangBuoc = {}; E.loiBuoc = null; E.goiY = null; E.nxSua = null; E.xuatThat = null; E.viecNx = 0; E.qtMo = ''; dungTheo(); E.kb = { brief: tachBrief(tap.brief), giay: +tap.thoi_luong_s || 45 }; E.coSo = undefined; E.cs = { cauHoi: '', nguoi: [{}] }; E.chuKy = chuKy(ds, tap); E.qt = null; }
const chuKy = (ds, tap) => JSON.stringify([tap.kich_ban?.length, tap.video_url, tap.brief, tap.thu_nguoi_xem?.luc || tap.thu_nguoi_xem?.ma || '', ds.map((c) => [c.id, c.keyframe_url, c.video_url, c.video_cuoi_url, c.trang_thai, !!c.dang_sinh_anh, !!c.dang_sinh_giong, !!c.video_dang, c.thoai_url, (Array.isArray(c.thoai) ? c.thoai : []).map((x) => (x.url || '') + (x.loi || '').length).join(), c.phat_s, (c.hanh_dong || '').length, c.kiem_khung ? JSON.stringify(c.kiem_khung).length : 0, c.ky_thuat?.tra_phi ? 1 : 0, Array.isArray(c.keyframe_uv) ? c.keyframe_uv.length : 0])]);
/** đọc lại phim đang mở từ studio; `ep` = vẽ lại dù dữ liệu không đổi. Giữ kim, cảnh đang chọn, bố cục. */
async function taiLai(ep) { const t = D.that; if (!t) return;
  const [pd, ds] = await Promise.all([goi('docPhim', t.phim), goi('dsCanh', t.tap)]), tap = pd?.tap.find((x) => x.id === t.tap); if (!pd || !tap || D.that?.tap !== t.tap) return;
  const moi = chuKy(ds, tap) + (pd.nhanVat || []).map((x) => x.anh_ref?.[0] || '').join(); if (!ep && moi === E.chuKy) return;
  const kim = E.t, chonCu = E.chon; D = tuStudio(pd, tap, ds); E.kb = { brief: E.kb.brief || tachBrief(tap.brief), giay: E.kb.giay }; E.chuKy = moi; E.qt = E.qt ? { ...E.qt, cu: true } : null; E.nk = null; E.nkCt = {}; E.lui = []; E.toi = [];
  E.t = Math.min(kim, Math.max(0, tong() - 0.01)); E.chon = chonCu && chonCu.id !== 'nhac' && canh(chonCu.id) ? chonCu : null; E.canhDang = null; if (!nguonCo().includes(E.nguon)) E.nguon = nguonDau();
  if (await apUvMoi()) return taiLai(true);
  if (xemQt()) napHd(true);
  await napQt(true); veD(); }
async function napQt(ep) { const t = D.that; if (!t) return; if (!ep && E.qt?.tap === t.tap && !E.qt.cu) return; const cu = E.qt?.tap === t.tap ? E.qt.ds : null; E.qt = { tap: t.tap, ds: cu, loi: '' };
  try { const [ds, g1, g2, cs] = await Promise.all([goi('quyTrinhTap', t.phim, t.tap), goi('uocTien', t.tap), goi('uocAm', t.tap), goi('docCoSoS2', t.tap).catch(() => null)]); if (D.that?.tap !== t.tap) return;
    E.coSo = cs || null; if (cs && !E.cs.cauHoi && !E.cs.nguoi.some((n) => n.ten || n.ngay)) E.cs = { cauHoi: cs.cau_hoi, nguoi: cs.nguoi.length ? cs.nguoi.map((n) => ({ ...n })) : [{}] };
    E.qt = { tap: t.tap, ds: ds || [], loi: ds ? '' : 'studio không tính được quy trình của tập này' }; E.gia = { anh1: g1?.anh1 || 0, giay1: g1?.giayDuyet ? g1.videoTong / g1.giayDuyet : 0, giong: g2?.giong ?? null, nhac: Object.values(g2?.nhac || {})[0] ?? null }; }
  catch (e) { E.qt = { tap: t.tap, ds: cu || [], loi: e.message }; }
  if (!ep && co('qt')) veQt(); }
/** vòng theo dõi việc đang chạy bên studio (vẽ ảnh, đọc lời, dựng clip, thử người xem, xuất): 7 giây đọc lại một lần, hết việc thì tự dừng */
let hTheo = 0, demTheo = 0;
const dungTheo = () => { clearInterval(hTheo); hTheo = 0; };
function theoDoi() { if (hTheo || !D.that) return; demTheo = 0; hTheo = setInterval(async () => {
  if (!D.that) return dungTheo(); const a = document.activeElement; if (E.chay || coSua() || (a && /TEXTAREA|INPUT/.test(a.tagName) && a.closest('#dung'))) return;   // đang phát / đang gõ: không vẽ lại dưới tay người dùng
  demTheo++;
  try { if (E.viecNx) { const v = await goi('docViecNen', { id: E.viecNx }); if (!v || v.trang_thai !== 'chay') { if (v?.trang_thai === 'loi') E.loiBuoc = { k: 'nx', loi: v.loi }; E.viecNx = 0; await taiLai(true); } }
    if (E.xuatThat?.tt === 'chay') { const x = await goi('trangThaiXuat', E.xuatThat.job); E.xuatThat = { ...E.xuatThat, tt: x.trang_thai === 'xong' ? 'xong' : x.trang_thai === 'loi' ? 'loi' : 'chay', url: x.url, loi: x.loi }; if (E.xuatThat.tt !== 'chay') { await taiLai(true); if (E.xuat === 'that') vePhu(); } }
    await taiLai(false); } catch {}
  if (co('hd')) await napHd(true).catch(() => {});
  const con = (E.hd?.tong && (E.hd.tong.cho || E.hd.tong.chay)) || E.viecNx || E.xuatThat?.tt === 'chay' || canhThat().some((c) => c.dang_sinh_anh || c.dang_sinh_giong || c.dang_sinh_sfx || c.video_dang);
  if ((!con && demTheo >= 3) || demTheo > 260) dungTheo(); }, 7000); }
const veMauTao = () => { const o = E.tao; if (!o) return ''; if (!o.mau) return '<span class="nho">Đang đọc danh sách mẫu…</span>'; if (!o.mau.length) return '<span class="nho">Studio không trả mẫu nào.</span>';
  return o.mau.map((m) => `<button type="button" class="bt${o.mauCho === m.key ? ' chinh' : ''}" data-d="taoMau" data-g="${esc(m.key)}" ${o.dang ? 'disabled' : ''} title="${esc(m.mo_ta)}">${o.mauCho === m.key ? `Bấm lần nữa để tạo · máy tách cảnh ngay, khoảng ${tienDo(GIA_CHU.tach * m.so_tap)}` : esc(m.nhan)}</button>`).join(''); };
async function taoVideo(mau) { const o = E.tao; if (!o || o.dang) return; if (!mau && !o.ten.trim()) { o.loi = 'chưa đặt tên video'; return vePhu(); } o.dang = true; o.loi = ''; vePhu();
  try { let id, tap;
    if (mau) { id = await ghiSv('taoPhimMau', mau); tap = (await goi('docPhim', id))?.tap[0]?.id; }
    else ({ phim: id, tap } = await ghiSv('taoPhimS2', { ten: o.ten.trim(), loai: o.loai, goi: o.goi, brief: o.y.trim() }));
    if (!tap) throw new Error(`đã tạo phim #${id} nhưng chưa có tập; mở phim trong menu tên phim`);
    E.tao = null; E.bcUrl = 'lam'; E.kq = undefined; vePhu(); await moPhimThat(id, tap); }
  catch (e) { o.dang = false; o.loi = e.message; vePhu(); } }
async function taoTuTemplate() { const o = E.tao, t = o?.tpl; if (!t || !t.o || o.dang) return; if (!t.tenPhim.trim()) { o.loi = 'chưa đặt tên phim mới'; return vePhu(); } o.dang = true; o.loi = ''; vePhu();
  try { const r = await ghiSv('taoPhimTuTemplate', t.id, t.tenPhim.trim(), t.gt), tap = (await goi('docPhim', r.phimId))?.tap[0]?.id; if (!tap) throw new Error(`đã tạo phim #${r.phimId} nhưng chưa có tập`);
    E.tao = null; E.bcUrl = 'lam'; E.kq = undefined; vePhu(); await moPhimThat(r.phimId, tap); }
  catch (e) { o.dang = false; o.loi = e.message; vePhu(); } }
/** danh sách gói thể loại của studio trong hộp tạo: gõ là lọc (theo tên, nhóm, mô tả), xếp theo nhóm; bấm gói đang chọn lần nữa = bỏ chọn */
function veGoiTao() { const o = E.tao; if (!o) return ''; if (!o.goiDs) return '<span class="nho">Đang đọc thể loại…</span>'; const q = o.timGoi.trim().toLowerCase(), ds = o.goiDs.filter((g) => !q || `${g.ten} ${g.nhom} ${g.mo_ta}`.toLowerCase().includes(q));
  if (!ds.length) return '<span class="nho">Không có thể loại nào khớp.</span>';
  return [...new Set(ds.map((g) => g.nhom))].map((n) => `<span class="nho">${esc(n)}</span><div class="day-bt">${ds.filter((g) => g.nhom === n).map((g) => `<button type="button" class="bt" data-d="taoGoi" data-g="${esc(g.key)}" aria-pressed="${o.goi === g.key}" title="${esc(g.mo_ta)} · ${g.ti_le} · ${g.do_dai_s[0]}–${g.do_dai_s[1]} giây">${esc(g.ten)}</button>`).join('')}</div>`).join(''); }
async function napDoi() { if (!E.doi) return; try { const ds = await goi('dsDoiS2'); if (E.doi) { E.doi.ds = ds; E.doi.loi = ''; } } catch (e) { if (E.doi) { E.doi.ds = E.doi.ds || []; E.doi.loi = e.message; } } vePhu(); }
// NGƯỜI MỚI = người trong đội (không phải quản trị), hoặc quản trị đang bật "Xem như người mới" để tự đi thử đúng lối của họ: danh sách chỉ có video
// chính mình tạo (không phim cũ của studio, không phim mẫu), không link sang studio, không mục Đội; vào là gặp video đang làm dở hoặc hộp tạo video.
// Quyền ở máy chủ không đổi theo nút này (quản trị vẫn là quản trị) — nút chỉ đổi thứ được BÀY ra, để thấy người mới kẹt ở đâu.
const laQtThat = () => !!E.nguoi && E.nguoi.role === 'admin', nguoiMoi = () => E.nhuMoi || (!!E.nguoi && E.nguoi.role !== 'admin');
const laQuanTri = () => !E.nhuMoi && (!E.nguoi || E.nguoi.role === 'admin');   // chưa biết là ai thì coi như quản trị (máy chủ vẫn tự chặn), biết rồi mới ẩn bớt
/** khung trống của người chưa có video nào (hoặc chưa mở video nào) */
const duAnTrong = () => ({ ...duAnCho(), ten: 'Chưa có video', cho: false, trongTrang: true });
/** màn bắt đầu của người mới: mở video mới sửa gần nhất của chính họ; chưa có cái nào thì mở hộp tạo video */
async function veNhaMoi() { const so = ++soMo; dungChay(); E.menu = null; E.dangMo = true; D = duAnTrong(); GOC = {}; NEN = {}; E.da = null; E.tap = null; E.qt = null; E.nk = null; E.lui = []; E.toi = []; E.chon = null; E.t = 0; E.canhDang = null; E.kq = undefined; if (E.man === 'dung') veD();
  try { const r = await goi('dsPhimS2', '', true); if (so !== soMo) return; E.dangMo = false; const p = r.ds.find((x) => x.tap_tom.length);
    if (p) return void moPhimThat(p.id, p.tap_tom[0].id); luu(); veD(); if (!E.tao) lamD('taoThat'); }
  catch (e) { if (so !== soMo) return; E.dangMo = false; luu(); veD(); bao(`Chưa mở được danh sách video của bạn: ${e.message}`, false, 15000); } }

// ── CƠ SỞ PHÂN TÍCH TỪ ASTROLAS (anh 20/11/2026): nhóm làm video chia sẻ chiêm tinh theo GÓC NHÌN CÁ NHÂN của từng người, lấy astrolas.com làm cơ sở
//    phân tích. Người làm video gõ câu muốn phân tích + (nếu có) ngày giờ nơi sinh của người / cặp họ nói tới → studio hỏi cầu nối của site
//    (phanTichAstrolasS2): site dựng lá số rồi trả bản phân tích có căn cứ, lưu theo tập. Lúc máy viết kịch bản, đề bài = ý tưởng của người làm video
//    + lời dặn "ngôi thứ nhất, giữ quan điểm của họ" + bản phân tích này (mọi vị trí sao phải lấy từ đây). Không hỏi thì kịch bản chỉ nói ở mức quan điểm.
const DAU_GHEP = '\n\n=== CÁCH KỂ (Studio 2 tự ghép, đừng sửa từ dòng này) ===\n';
const tachBrief = (s) => String(s || '').split(DAU_GHEP)[0];
function briefDayDu() { const c = E.coSo, ls = (c?.la_so || []).filter((x) => x.dung_duoc && (x.mat_troi || x.mat_trang));
  return E.kb.brief.trim() + DAU_GHEP + 'Đây là video CHIA SẺ GÓC NHÌN CÁ NHÂN về chiêm tinh: chính người làm video kể với người xem.\n'
    + '- Lời kể ngôi thứ nhất ("tôi") xuyên suốt, giọng trò chuyện, nói thẳng với người xem. KHÔNG dựng thành phim có nhân vật khác; KHÔNG bịa thêm người, tên riêng, đoạn hội thoại hay sự kiện đời tư nào mà người làm video không nêu ở trên.\n'
    + '- Mỗi cảnh là một ý họ chia sẻ, kèm hình minh hoạ được: người kể trong không gian đời thường của họ, màn hình lá số, hình tượng trưng cho vị trí sao đang nói tới.\n'
    + '- Các dữ kiện lá số lấy từ Astrolas (hành tinh, cung, nhà, góc chiếu, số độ) là căn cứ của video. Khi rút gọn, chia cảnh hay sửa lời vẫn phải GIỮ chúng trong lời kể: câu dài thì tách ra nhiều cảnh ngắn, không thay bằng câu chung chung.\n'
    + '- Lời là lời KỂ phủ lên hình minh hoạ, không phải thoại phim: không cần cận mặt người nói cho từng câu, không cần tình tiết hay cú lật.\n'
    + '- Giữ đúng quan điểm của họ; không nói thay "các nhà chiêm tinh", không hứa đoán tương lai.'
    + (c?.phan_tich ? `\n\nCƠ SỞ PHÂN TÍCH TỪ ASTROLAS (astrolas.com tính từ lá số thật). Mọi vị trí sao, cung, nhà, góc chiếu nhắc trong kịch bản PHẢI lấy từ phần này, không tự thêm, không đổi số:\n${ls.map((x) => `- ${x.ten || 'Lá số'}: Mặt Trời ${x.mat_troi}, Mặt Trăng ${x.mat_trang}${x.moc ? `, cung Mọc ${x.moc}` : ''}`).join('\n')}${ls.length ? '\n' : ''}${c.phan_tich}\n\nCâu kết: mời người xem tự xem lá số của họ trên astrolas.com.`
      : '\n\nChưa có bản phân tích Astrolas cho video này: không nêu vị trí sao cụ thể của ai, chỉ chia sẻ ở mức quan điểm cá nhân.'); }
function veCoSo() { const c = E.coSo, s = E.cs;
  return `<textarea id="csCauHoi" rows="2" placeholder="Bạn muốn Astrolas phân tích điều gì? Ví dụ: Sao Thổ ở nhà 7 nói gì về chuyện cưới muộn của người này">${esc(s.cauHoi)}</textarea>
    <span class="nho">Lá số của ai (bỏ trống nếu chỉ hỏi chung về một cung, một sao):</span>
    ${s.nguoi.map((n, i) => `<div class="cs-n"><input type="text" data-cs="ten" data-i="${i}" value="${esc(n.ten || '')}" placeholder="Tên" aria-label="Tên người ${i + 1}" autocomplete="off"><input type="date" data-cs="ngay" data-i="${i}" value="${esc(n.ngay || '')}" aria-label="Ngày sinh người ${i + 1}" title="Ngày sinh"><input type="time" data-cs="gio" data-i="${i}" value="${esc(n.gio || '')}" aria-label="Giờ sinh người ${i + 1}" title="Giờ sinh (không biết thì bỏ trống)"><input type="text" data-cs="noi" data-i="${i}" value="${esc(n.noi || '')}" placeholder="Nơi sinh: thành phố, nước" aria-label="Nơi sinh người ${i + 1}" autocomplete="off"></div>`).join('')}
    ${s.nguoi.length < 3 ? '<div><button type="button" class="bt" data-d="csThem">＋ Thêm một người (so hai lá số)</button></div>' : ''}
    <div class="qt-nut">${nutBuoc('astro')}</div>
    ${c ? `<div class="cs-kq">${c.la_so.filter((x) => x.dung_duoc && (x.mat_troi || x.mat_trang)).map((x) => `<span class="cs-ls" title="Lá số astrolas.com đã dựng cho người này">${esc(x.ten || 'Lá số')}: ☉ ${esc(x.mat_troi)} · ☽ ${esc(x.mat_trang)}${x.moc ? ` · Mọc ${esc(x.moc)}` : ''}</span>`).join('')}
      <details class="nk-ct" open><summary>Astrolas phân tích · ${gioVn(c.luc)}${c.usd ? ` · ${tienDo(c.usd * 100)}` : ''}</summary><pre>${esc(c.phan_tich)}</pre></details>
      ${c.nguon.length ? `<span class="nho">Nguồn: ${c.nguon.slice(0, 4).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join(' · ')}</span>` : ''}</div>`
      : `<span class="nho">${c === undefined ? 'Đang đọc…' : 'Chưa hỏi Astrolas. Không hỏi thì kịch bản chỉ nói ở mức quan điểm, không nêu vị trí sao của ai.'}</span>`}`; }

// ── LƯU SỬA VỀ STUDIO (phim của studio): so từng cảnh với thứ studio đang giữ (NEN, đặt lúc đọc phim) → nút "Lưu về studio" trên thanh trên.
//    Lưu được: lời / thoại, chữ màn, giây phát, cỡ cảnh · góc · ống kính · chuyển động máy, thứ tự cảnh. Chưa lưu được từ đây (báo rõ khi lưu):
//    mô tả, tên cảnh, đoạn, tiếng động, cảm xúc, nhân vật có mặt, vào cảnh, thêm / xoá / tách cảnh — các thứ này studio giữ ở dạng khác (tiếng Anh, mã phân cảnh…).
let NEN = {}, THU_TU0 = [];
const nenCanh = (o) => ({ loi: o.loi, thoai: JSON.stringify(o.thoai), chu: o.chu, tg: o.tg, co: o.co, gm: o.gm, ong: o.ong, cd: o.cd, khac: JSON.stringify([o.mota, o.nhan, o.pd, o.td, o.cx, o.viTri, o.nv, o.chuyen]) });
const N_CO = { 'Toàn': 'ws', 'Trung': 'ms', 'Trung cận': 'mcu', 'Cận': 'cu', 'Đặc tả': 'ecu' }, N_GOC = { 'Ngang': 'ngang', 'Thấp': 'thap', 'Cao': 'cao' }, N_ONG = { 'Rộng': 'rong', 'Chuẩn': 'chuan', 'Chân dung': 'chan_dung', 'Macro': 'macro' }, N_CD = { 'Đứng yên': 'tinh', 'Phóng gần': 'day', 'Lùi xa': 'lui', 'Lia ngang': 'lia' };
/** các cảnh có chỗ sửa lưu được: [{ id số của studio, d = đúng phần đổi gửi cho suaCanh }] */
function suaDs() { const ra = []; if (!D.that) return ra;
  for (const c of D.canh) { const g = GOC[c.id], n = NEN[c.id]; if (!g || !n) continue; const d = {};
    if (JSON.stringify(c.thoai) !== n.thoai) { const goc = Array.isArray(g.thoai) ? g.thoai : []; let i = 0; const moi = goc.map((x) => (x.loi ? (c.thoai[i] ? { ...x, loi: c.thoai[i++].cau } : (i++, null)) : x)).filter(Boolean);
      for (; i < c.thoai.length; i++) moi.push({ nhan_vat: c.thoai[i].ai === 'Lời dẫn' ? '' : c.thoai[i].ai, dien_xuat: '', loi: c.thoai[i].cau }); d.thoai = moi.map((x) => ({ nhan_vat: x.nhan_vat || '', dien_xuat: x.dien_xuat || '', loi: x.loi || '', ...(typeof x.tre === 'number' ? { tre: x.tre } : {}) })); }
    else if (!c.thoai.length && c.loi !== n.loi) d.loi_thoai = c.loi;
    if (c.chu !== n.chu) d.chu_man = c.chu;
    if (Math.abs(c.tg - n.tg) > 0.01 && !D.that.laMoc) d.phat_s = c.tg;
    const kt = {}; if (c.co !== n.co && N_CO[c.co]) kt.co_canh = N_CO[c.co]; if (c.gm !== n.gm && N_GOC[c.gm]) kt.goc = N_GOC[c.gm]; if (c.ong !== n.ong && N_ONG[c.ong]) kt.ong_kinh = N_ONG[c.ong]; if (c.cd !== n.cd && N_CD[c.cd]) kt.chuyen_dong = N_CD[c.cd];
    if (Object.keys(kt).length) d.ky_thuat = { ...(g.ky_thuat || {}), ...kt };
    if (Object.keys(d).length) ra.push({ id: g.id, d }); }
  return ra; }
/** thứ tự cảnh đổi (cùng tập cảnh như studio đang giữ) → danh sách id theo thứ tự mới; có thêm / mất cảnh thì không xếp */
function thuTuDoi() { const that = D.canh.filter((c) => GOC[c.id]).map((c) => c.id); if (that.length !== THU_TU0.length || that.length !== D.canh.length || that.every((id, i) => id === THU_TU0[i])) return null; return that.map((id) => GOC[id].id); }
function khongLuuDuoc() { const r = new Set(); if (!D.that) return ''; if (D.canh.some((c) => !GOC[c.id]) && !D.that.trong) r.add('cảnh mới thêm / tách'); if (THU_TU0.some((id) => !canh(id))) r.add('cảnh đã xoá');
  for (const c of D.canh) { const n = NEN[c.id]; if (n && JSON.stringify([c.mota, c.nhan, c.pd, c.td, c.cx, c.viTri, c.nv, c.chuyen]) !== n.khac) r.add('mô tả, tên cảnh, đoạn, tiếng động, cảm xúc, nhân vật, vào cảnh'); if (n && Math.abs(c.tg - n.tg) > 0.01 && D.that.laMoc) r.add('độ dài cảnh của video máy dựng'); }
  return [...r].join('; '); }
const coSua = () => !!D.that && !D.that.trong && (suaDs().length > 0 || !!thuTuDoi() || !!khongLuuDuoc());
function veLuuNut() { if (!D.that || D.that.trong) return ''; const n = suaDs().length + (thuTuDoi() ? 1 : 0), kl = khongLuuDuoc(); if (!n && !kl) return '';
  return `${n ? `<button type="button" class="bt chinh" data-d="luuVe" ${E.dangLuu ? 'disabled' : ''} title="Ghi lời, chữ màn, giây phát, máy quay, thứ tự cảnh về studio">${E.dangLuu ? 'Đang lưu…' : `Lưu ${n} chỗ sửa về studio`}</button>` : ''}${kl ? `<span class="thu canh" title="Chưa lưu được từ đây: ${esc(kl)}. Sửa các thứ này ở studio.">có chỗ sửa chưa lưu được</span>` : ''}<button type="button" class="bt" data-d="boSua" title="Bỏ mọi chỗ sửa chưa lưu, đọc lại phim từ studio">Bỏ sửa</button>`; }
const veLuu = () => { const el = $('#dLuu'); if (el) el.innerHTML = veLuuNut(); };
async function luuVeStudio() { const t = D.that; if (!t || E.dangLuu) return; const ds = suaDs(), tt = thuTuDoi(), kl = khongLuuDuoc(); if (!ds.length && !tt) return; E.dangLuu = true; veLuu(); let xong = 0;
  try { for (const x of ds) { await ghiSv('suaCanh', x.id, x.d); xong++; } if (tt) await ghiSv('xepCanh', t.tap, tt);
    E.dangLuu = false; await taiLai(true); bao(`Đã lưu về studio: ${ds.length} cảnh${tt ? ', thứ tự cảnh' : ''}.${kl ? ` Chưa lưu được từ đây: ${kl}.` : ''}`, false, kl ? 12000 : 5000); }
  catch (e) { E.dangLuu = false; veLuu(); bao(`Lưu dở dang (${xong}/${ds.length} cảnh đã ghi): ${e.message}`, false, 15000); } }
/** kết quả thử người xem của studio, đủ để người làm biết sửa gì: người xem kể lại, từng chỗ vấp kèm gợi ý sửa, cảnh rút ngắn được */
function veNx() { const x = D.that?.nx; if (!x) return ''; const dong = (c, s) => `<li><b>Cảnh ${+c.shot}</b> ${s}</li>`;
  return `<div class="qt-nx"><b>Người xem thử chấm ${+x.diem}/10${x.dat ? ' · đạt' : ' · cần từ 7'}${x.duyet_tay ? ' · bạn đã nhận kịch bản này' : ''}</b>`
    + (x.ke_lai ? `<p><i>Họ kể lại:</i> ${esc(x.ke_lai)}</p>` : '') + (x.khop === false && x.lech ? `<p><i>Lệch ý bạn:</i> ${esc(x.lech)}</p>` : '')
    + (x.cho_kho?.length ? `<details open><summary>${x.cho_kho.length} chỗ họ vấp, kèm gợi ý sửa</summary><ul>${x.cho_kho.map((c) => dong(c, `${esc(c.van_de)}<br><span class="nho">Gợi ý: ${esc(c.sua)}</span>`)).join('')}</ul></details>` : '')
    + (x.cat?.length ? `<details><summary>${x.cat.length} cảnh rút ngắn được</summary><ul>${x.cat.map((c) => dong(c, `bớt ${+c.bot_s} giây. ${esc(c.ly_do)}`)).join('')}</ul></details>` : '')
    + (E.nxSua?.tap === D.that.tap ? `<p class="qt-da-sua">Máy vừa sửa ${+E.nxSua.sua} cảnh, thêm ${+E.nxSua.them} cảnh${E.nxSua.ghi_chu ? `: ${esc(E.nxSua.ghi_chu)}` : ''}. Bấm "Thử người xem" để chấm lại bản mới.</p>` : '') + '</div>'; }
/** từng mẫu của phim (người, bối cảnh, đồ vật): ảnh mẫu đang dùng + nút vẽ lại ảnh mẫu + nút vẽ lại các cảnh đang gắn mẫu đó */
function veMau() { const ds = D.that?.mau || []; if (!ds.length) return '';
  return `<details class="nk-ct qt-mau" open><summary>${ds.length} mẫu của phim: vẽ lại từng mẫu</summary>${ds.map((x) => `<div class="qt-mau-o">${x.anh ? `<img src="${esc(nho(x.anh, 320))}" alt="" loading="lazy"${xemQt() ? ` title="Ảnh mẫu ${esc(x.ten)}${tipAttr('mau', x.id)}"` : ''}>` : '<i>chưa có ảnh</i>'}<div><b>${esc(x.ten)}</b><small>${S_VAI[x.loai] || x.loai}${canhMau(x.id).length ? ` · ${canhMau(x.id).length} cảnh dùng` : ' · chưa cảnh nào dùng'}</small><div class="qt-nut">${nutBuoc(`mauVe:${x.id}`)}${canhMau(x.id).length ? nutBuoc(`kfMau:${x.id}`) : ''}</div></div></div>`).join('')}</details>`; }
function veQt() {
  const el = $('#dQt'), t = D.that; if (!t) { el.innerHTML = D.trongTrang ? `<div class="qt-trong"><b>${E.dangMo ? 'Đang mở…' : 'Bắt đầu từ góc nhìn của bạn'}</b><span class="nho">Gõ điều bạn muốn chia sẻ về chiêm tinh. Hỏi Astrolas để có lá số và bản phân tích làm căn cứ. Máy viết kịch bản theo giọng của bạn rồi chia thành cảnh; bạn duyệt từng bước: ảnh, giọng đọc, clip, rồi xuất video.</span><button type="button" class="bt chinh" data-d="taoThat">＋ Tạo video mới</button></div>` : '<div class="trong-w sang">Quy trình chỉ có ở phim của studio.<br>Bấm ＋ trên thanh trên để tạo video mới.</div>'; return; }
  if (E.qt?.tap !== t.tap || E.qt.cu) napQt();
  const lk = laQuanTri() ? `<a class="qt-lk" href="https://studio.on.tc/?m=phim&mId=${t.phim}&tab=storyboard" target="_blank" rel="noopener">Làm ở studio ↗</a>` : '<span class="nho">Bước này hiện chỉ quản trị làm được ở studio.</span>', nut = (ds) => `<div class="qt-nut">${ds.map(nutBuoc).join('')}</div>`;
  const kb = t.kichBan ? `<details class="nk-ct"${t.trong ? ' open' : ''}><summary>Kịch bản đang có</summary><pre>${esc(t.kichBan)}</pre></details>` : '';
  const yTuong = `<textarea id="qtBrief" rows="4" placeholder="Bạn muốn chia sẻ điều gì về chiêm tinh, bạn nghĩ gì về nó? Kể theo trải nghiệm và quan điểm của chính bạn">${esc(E.kb.brief)}</textarea>${hg('Dài', `<div class="day-bt">${[30, 45, 60, 90, 120].map((s) => `<button type="button" class="bt" data-d="qtGiay" data-g="${s}" aria-pressed="${E.kb.giay === s}">${s}s</button>`).join('')}</div>`)}`;
  let h = `<div class="qt-dau"><b>${t.trong ? 'Bắt đầu video mới' : 'Quy trình của tập'}</b><span class="nho">${t.trong || !E.qt?.ds ? '' : `${E.qt.ds.filter((m) => m.ok).length}/${E.qt.ds.length} mục đạt`}</span><button type="button" class="bt hd-mo" data-d="cnBat" title="Mở widget Cẩm nang: quy trình sản xuất theo từng loại video, từng bước bấm ở đâu, tốn bao nhiêu">Cẩm nang</button>${t.trong ? '' : `<button type="button" class="bt hd-mo" data-d="hdBat" id="qtHd" title="Mở widget Hàng đợi: mọi việc sinh ảnh, clip, tiếng của phim, lỗi và tiền">${nhanHd()}</button>`}<button type="button" class="bt ic-bt" data-d="qtTai" title="Đọc lại từ studio" aria-label="Đọc lại từ studio">↻</button></div>`;
  if (E.viecNx) h += '<div class="qt-chay"><i></i>Máy đang thử làm người xem…</div>';
  if (E.qt?.loi) h += `<div class="bao">Không đọc được quy trình: ${esc(E.qt.loi)}</div>`;
  if (t.trong) h += `<div class="qt-buoc"><h3>1 · Góc nhìn của bạn</h3>${yTuong}${nut(['brief'])}</div>
    <div class="qt-buoc"><h3>2 · Cơ sở từ Astrolas</h3>${veCoSo()}</div>
    <div class="qt-buoc"><h3>3 · Kịch bản</h3>${kb || '<span class="nho">Chưa có kịch bản. Máy viết theo góc nhìn của bạn, lấy phần Astrolas phân tích làm căn cứ, rồi tự chấm.</span>'}${nut(['viet'])}</div>
    <div class="qt-buoc"><h3>4 · Tách thành cảnh</h3><span class="nho">Máy chia kịch bản thành từng cảnh có hình, lời, cỡ máy. Xong thì cảnh hiện lên timeline và các bước kế mở ra ở đây.</span>${t.kichBan ? nut(['tach']) : '<span class="nho">Cần có kịch bản trước.</span>'}</div>${lk}`;
  else if (!E.qt?.ds) h += '<span class="nho">Đang đọc quy trình từ studio…</span>';
  else { const ds = E.qt.ds, mo = E.qtMo || ds.find((m) => !m.ok)?.key || '', coClip = canhThat().filter((c) => c.video_url || c.video_cuoi_url).length, CONG = { keyframe: 'vẽ ảnh', video: 'dựng clip', xuat: 'xuất' };
    for (const nhom of ['Tiền kỳ', 'Sản xuất', 'Hậu kỳ']) { h += `<h3>${nhom}</h3>`;
      for (const m of ds.filter((x) => x.nhom === nhom)) { const dangMo = mo === m.key;
        h += `<div class="qt-m ${m.ok ? 'xong' : m.cong ? 'loi' : 'bao'}${dangMo ? ' mo' : ''}"><button type="button" data-d="qtMo" data-g="${m.key}" aria-expanded="${dangMo}"><i></i><b>${esc(m.ten)}${giaiQt(m.key)}</b>${m.ok ? '' : `<span class="so">${m.thieu.length}</span>`}${!m.ok && m.cong ? `<u title="Chưa đạt thì studio không cho ${CONG[m.cong]}">chặn ${CONG[m.cong]}</u>` : ''}</button>`
          + (dangMo ? `<div class="qt-mo">${m.thieu.length ? `<ul>${m.thieu.slice(0, 5).map((x) => `<li>${esc(x)}</li>`).join('')}${m.thieu.length > 5 ? `<li>và ${m.thieu.length - 5} chỗ nữa</li>` : ''}</ul>` : ''}<span class="nho">${esc(m.lam)}</span>${m.key === 'brief' ? `${yTuong}<h3>Cơ sở từ Astrolas</h3>${veCoSo()}` : ''}${m.key === 'kich_ban' ? kb : ''}${m.key === 'nguoi_xem' ? veNx() : ''}${m.key === 'mau_doi_tuong' ? veMau() : ''}${(m.key === 'keyframe' || m.key === 'clip') && /khuôn "/.test(E.loiBuoc?.loi || '') ? `<span class="nho">Studio đang ép các cảnh theo khuôn dựng của phim truyện. Video chia sẻ góc nhìn không cần khuôn đó:</span>${nut(['boKhuon'])}` : ''}
            ${m.key === 'phong_cach' && E.goiY ? `<div class="qt-goi-y"><b>Máy gợi ý</b><p>${esc(E.goiY.phong_cach)}</p>${nut(['pcDung'])}</div>` : ''}${NUT_QT[m.key] ? nut(NUT_QT[m.key]) : ''}${laQuanTri() || !NUT_QT[m.key] ? lk : ''}</div>` : '') + '</div>';
        if (m.key === 'giong') h += `<div class="qt-m ${coClip === canhThat().length ? 'xong' : 'thieu'}${mo === 'clip' ? ' mo' : ''}"><button type="button" data-d="qtMo" data-g="clip" aria-expanded="${mo === 'clip'}"><i></i><b>Dựng clip${giaiQt('clip')}</b><span class="so">${coClip}/${canhThat().length}</span></button>${mo === 'clip' ? `<div class="qt-mo"><span class="nho">Thứ tự: máy kiểm khung các ảnh → bấm Xuất video một lần (bản dựng từ ảnh, để nghe nhịp) → chốt nhịp → dựng clip cho cảnh đã duyệt ảnh. Bộ dựng lấy theo thiết lập của phim; clip đang chờ máy thì hiện "đang dựng" ở Nhật ký.</span>${canhThieu('lech').length ? `<details class="nk-ct"><summary>${canhThieu('lech').length} ảnh máy báo lệch so với kịch bản</summary><ul>${canhThieu('lech').map((c) => `<li><b>Cảnh ${Math.round(+c.thu_tu)}</b> ${esc((c.kiem_khung.loi || []).map((x) => x.mo_ta).join(' · ').slice(0, 420))}</li>`).join('')}</ul></details><span class="nho">Vẽ lại thì phải duyệt và kiểm lại ảnh mới; thấy máy báo quá tay thì nhận ảnh đang có.</span>` : ''}${nut(['kiemKhung', 'kfLech', 'khungNhan', 'animatic', ...(laQtThat() && canhThat().some((c) => !c.ky_thuat?.tra_phi && !c.ky_thuat?.vx?.uuid) ? ['traPhi'] : []), 'clip'])}${lk}</div>` : ''}</div>`; } }
    h += `<div class="qt-buoc"><h3>Xuất</h3>${E.xuatThat?.tt === 'chay' ? '<div class="qt-chay"><i></i>Studio đang ghép video…</div>' : ''}${E.xuatThat?.tt === 'loi' ? `<div class="bao">Xuất hỏng: ${esc(E.xuatThat.loi)}</div>` : ''}${nut(['xuat'])}${E.loiXuat ? `<span class="nho">Xem lại các clip studio nêu ở trên. Clip sai thật thì dựng lại cảnh đó; thấy máy soi báo quá tay thì:</span>${nut(['soiBo'])}` : ''}</div>`; }
  el.innerHTML = h;
}

// Mỗi dòng Quy trình của tập có một dấu (i): rê chuột vào hiện một câu phần đó dùng để làm gì (card #1724 studio2)
const QT_GIAI = {
  brief: 'Bản giao việc của tập: muốn nói gì, cho ai xem, giọng phim thế nào. Mọi bước sau bám vào đây.',
  truyen: 'Các nhịp truyện chính (mở, dồn, lật, kết) để tập có xương sống trước khi viết lời.',
  kich_ban: 'Lời thoại và diễn biến từng đoạn, máy chấm điểm theo các tiêu chí của một kịch bản tốt.',
  nguoi_xem: 'Máy đóng vai người xem lần đầu, kiểm xem họ có hiểu và theo kịp câu chuyện không.',
  tham_khao: 'Câu chữ lấy từ quảng cáo mẫu đang chạy tốt, làm chỗ dựa cho lời của mình.',
  phan_canh: 'Chia kịch bản thành từng cảnh: ở đâu, ai, làm gì, nói gì.',
  phong_cach: 'Ánh sáng, bảng màu, chất hình chung của cả tập để mọi ảnh trông cùng một phim.',
  mau_doi_tuong: 'Ảnh mẫu của nhân vật / sản phẩm để máy vẽ giữ đúng mặt, đúng dáng ở mọi cảnh.',
  mau_boi_canh: 'Ảnh mẫu của từng bối cảnh để các cảnh cùng nơi trông giống nhau.',
  shot_list: 'Cỡ cảnh, góc máy, độ dài từng shot để hình có nhịp, không đều đều.',
  keyframe: 'Ảnh khung chính của từng shot; duyệt xong mới được dựng clip.',
  giong: 'Thu giọng đọc lời thoại trước, để clip dựng khớp đúng độ dài câu nói.',
  clip: 'Biến ảnh khung đã duyệt thành đoạn video chuyển động cho từng cảnh.',
  tieng: 'Máy nghe lại từng câu: không bị cắt, không chồng tiếng, đủ to để nghe rõ.',
  nhac: 'Nhạc nền của tập, đặt cả tập hoặc theo từng phân cảnh.',
  sfx: 'Tiếng động (bước chân, cửa, va chạm…) ở các điểm cắt để phim sống hơn.',
  chuyen_canh: 'Cách nối giữa hai shot (cắt thẳng, mờ dần…) ở các điểm cắt.',
  logo: 'Logo và lời kêu gọi hành động ở cuối video quảng cáo.',
};
const giaiQt = (k) => (QT_GIAI[k] ? ` <span class="qt-i" title="${esc(QT_GIAI[k])}" aria-label="${esc(QT_GIAI[k])}">i</span>` : '');

// ── NHẬT KÝ (chỉ phim thật): dải BƯỚC của cảnh đang ở kim — mỗi bước một đèn (xong / thiếu / hỏng / cần xem / đang chạy) — và các LƯỢT SINH của bước đó
//    đọc từ sổ lượt sinh của studio (nhatKyTap: bản gọn cả tập; nhatKyCanh: câu lệnh nguyên văn + tham số của một cảnh, chỉ tải khi mở một lượt).
const BUOC_NK = [['kb', 'Kịch bản', 'Kịch bản'], ['3d', '3D', '3D'], ['anh', 'Ảnh', 'Hình'], ['clip', 'Clip', 'Khung xem'], ['giong', 'Giọng', 'Giọng'], ['soat', 'Soát', 'Soát']];
const buocLuot = (j) => (j.loai === 'anh' ? 'anh' : j.loai === 'video' || j.loai === 'nang_cap' ? 'clip' : j.loai === 'am' ? 'giong' : 'soat');
const gioVn = (iso) => { const d = new Date(iso); if (Number.isNaN(+d)) return ''; const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hour12: false }).formatToParts(d).map((x) => [x.type, x.value])); return `${p.hour}:${p.minute} ${p.day}/${p.month}`; };
const tienDo = (c) => (c > 0 ? `$${(c / 100).toFixed(c < 1 ? 4 : c < 10 ? 3 : 2)}` : '');   // dưới 1¢ hiện bốn số lẻ, không thì bước rẻ thành "$0.000"
/** lượt còn "chờ / chạy" quá 20 phút coi là treo — không báo "đang chạy" khi máy không còn chạy thật */
const ttLuot = (j) => (j.trang_thai === 'xong' ? ['xong', 'xong'] : j.trang_thai === 'loi' ? ['loi', 'hỏng'] : Date.now() - Date.parse(j.luc) < 20 * 60e3 ? ['dang', 'đang chạy'] : ['thieu', 'không thấy kết quả']);
const luotCanh = (g) => (E.nk?.ds || []).filter((j) => j.canh_id === g.id);
function buocCanh(c) {
  const g = GOC[c.id]; if (!g) return null; const kx = g.khung_xam || null, js = luotCanh(g), cuoi = (b) => js.find((j) => buocLuot(j) === b), hong = (b) => cuoi(b)?.trang_thai === 'loi', chay = (b) => js.some((j) => buocLuot(j) === b && ttLuot(j)[0] === 'dang');
  const thieuKhung = (Array.isArray(kx?.kiem) ? kx.kiem : []).filter((k) => k.bat_buoc && !k.trong_khung).map((k) => k.nhan_vat);
  const cau = (Array.isArray(g.thoai) ? g.thoai : []).filter((t) => t.loi), coTieng = cau.filter((t) => t.url).length, coClip = !!(g.video_cuoi_url || g.video_url), soi = g.soi_clip && !g.soi_clip.bo_qua ? g.soi_clip.loi || [] : [];
  const tapMay = !D.canh.some((x) => x.vid) && !!D.vid;   // video máy dựng: cả tập là một video, không có clip / tiếng riêng từng cảnh
  return {
    kb: g.hanh_dong || g.loi_thoai || cau.length ? ['xong', 'Đã có hành động và lời của cảnh'] : ['thieu', 'Chưa viết hành động cho cảnh này'],
    '3d': !g.may_3d && !kx ? ['khong', 'Cảnh này không dựng 3D'] : thieuKhung.length ? ['loi', `Khung 3D thiếu: ${thieuKhung.join(', ')}`] : kx?.mau ? ['xong', 'Đã có khung 3D, đủ người cần thấy'] : ['thieu', 'Đã đặt máy nhưng chưa dựng khung 3D'],
    anh: chay('anh') || g.dang_sinh_anh ? ['dang', 'Đang vẽ ảnh'] : g.keyframe_url ? (hong('anh') ? ['bao', 'Đã có ảnh, nhưng lượt vẽ gần nhất bị hỏng'] : ['xong', 'Đã có ảnh']) : hong('anh') ? ['loi', 'Chưa có ảnh: lượt vẽ gần nhất bị hỏng'] : ['thieu', 'Chưa vẽ ảnh'],
    clip: chay('clip') || g.video_dang ? ['dang', `Đang dựng clip${g.video_dang?.ngan ? ` (${g.video_dang.ngan})` : ''}`] : coClip ? (hong('clip') ? ['bao', 'Đã có clip, nhưng lượt dựng gần nhất bị hỏng'] : ['xong', 'Đã có clip']) : hong('clip') ? ['loi', 'Chưa có clip: lượt dựng gần nhất bị hỏng'] : tapMay ? ['khong', 'Video này dựng cả tập một lần, không có clip riêng từng cảnh'] : ['thieu', 'Chưa dựng clip'],
    giong: !cau.length && !g.loi_thoai ? ['khong', 'Cảnh này không có lời'] : tapMay && !coTieng && !g.thoai_url ? ['khong', 'Video này đọc lời cả tập một lần, không có tiếng riêng từng cảnh'] : chay('giong') || g.dang_sinh_giong ? ['dang', 'Đang đọc lời'] : (cau.length ? coTieng === cau.length : !!g.thoai_url) ? ['xong', 'Đã có tiếng cho mọi câu'] : hong('giong') ? ['loi', 'Thiếu tiếng: lượt đọc gần nhất bị hỏng'] : ['thieu', cau.length ? `Mới có tiếng ${coTieng}/${cau.length} câu` : 'Chưa có tiếng'],
    soat: !coClip ? ['khong', 'Chưa có clip để soát'] : !g.soi_clip ? ['thieu', 'Clip chưa được máy soát'] : soi.length ? ['bao', `Máy soát thấy ${soi.length} điểm cần xem`] : ['xong', 'Máy soát không thấy lỗi'],
  };
}
let soNk = 0;
async function napNk() { if (!D.that || E.nk?.tap === D.that.tap) return; const so = ++soNk, tap = D.that.tap; E.nk = { tap, ds: null, loi: '' };
  try { const ds = await goi('nhatKyTap', tap); if (so !== soNk) return; E.nk = { tap, ds, loi: '' }; } catch (e) { if (so !== soNk) return; E.nk = { tap, ds: [], loi: e.message }; }
  if (D.that?.tap === tap && co('nk')) veNk(); }
async function napNkCanh() { const c = canhTai(Math.min(E.t, tong() - 0.001)).c, g = GOC[c.id]; if (!g || E.nkCt[g.id]) return; E.nkCt[g.id] = 'dang';
  try { const ds = await goi('nhatKyCanh', g.id); E.nkCt[g.id] = Object.fromEntries(ds.map((j) => [j.id, j])); } catch (e) { E.nkCt[g.id] = { loi: e.message }; }
  if (co('nk')) veNk(); }
// ── CẨM NANG (anh 20/11/2026: "cần 1 widget hay checklist về quy trình sx từng loại film, video như tài liệu tham khảo") ─────────────────────────────────────────
// Hai phần: (1) ĐỊNH DẠNG — đọc từ thư viện studio (camNangS2: gói thể loại, khung beat, cảm xúc người xem, luật dựng nhấn); (2) CÁC BƯỚC TRÊN STUDIO 2 — danh sách dưới
// đây, ghi theo lượt chạy thật phim #7999 (20/11/2026): nút nào, studio chặn gì, tiền và thời gian đã đo. `muc` = mục Quy trình của tập, để phim đang mở tự đánh dấu.
// `chi` = chỉ hiện cho nhóm đó ('goc' = chia sẻ góc nhìn có Astrolas · 'qc' = quảng cáo · 'phim' = phim truyện / mạng xã hội / kiến thức).
const CN_GOC = { key: 'goc_nhin', ten: 'Chia sẻ góc nhìn (có Astrolas)', ic: '🔭', nhom: 'Studio 2', mo_ta: 'Người làm video kể quan điểm của chính họ về chiêm tinh, lấy bản phân tích lá số của Astrolas làm căn cứ. Lời kể ngôi thứ nhất phủ lên hình minh hoạ, không dựng thành phim có nhân vật khác.', loai: 'short', ti_le: '9:16', do_dai_s: [30, 120], tham_chieu: 'Phim #7999 (20/11/2026) là bài làm thử đầu tiên của dạng này.', khung: null, khan_gia: [], luat: [] };
const CN_BUOC = [
  { ten: 'Ý tưởng', muc: ['brief'], lam: 'Gõ điều muốn nói và chọn độ dài. Đây là bản giao việc cho mọi bước sau.', o: 'Quy trình › Brief › "Lưu ý tưởng"', tien: 'không tốn tiền' },
  { ten: 'Cơ sở từ Astrolas', chi: 'goc', lam: 'Nêu câu hỏi, thêm ngày giờ nơi sinh nếu nói về một lá số cụ thể. Astrolas trả bản phân tích có vị trí sao thật; kịch bản chỉ được dùng dữ kiện từ đây.', o: 'Quy trình › Brief › "Hỏi Astrolas"', tien: 'khoảng $0.0003 một câu hỏi, gần 1 phút' },
  { ten: 'Kịch bản', muc: ['truyen', 'kich_ban'], lam: 'Máy viết kịch bản theo ý tưởng và khung truyện của định dạng. Studio tự chấm (logline, hook 3 giây đầu, đủ nhịp); điểm này để tham khảo, không chặn bước sau.', o: 'Quy trình › Kịch bản › "Máy viết kịch bản"', tien: 'thật 0,05¢, khoảng 2 phút' },
  { ten: 'Tách thành cảnh', muc: ['shot_list'], lam: 'Máy chia kịch bản thành từng cảnh: hình, lời, cỡ cảnh, máy quay, và tạo sẵn mẫu bối cảnh, đồ vật.', o: 'Quy trình › Kịch bản › "Máy tách thành cảnh"', tien: 'thật 0,06¢, khoảng 5 phút (nút giữ "vẫn đang chạy" rồi tự hiện kết quả)' },
  { ten: 'Người xem có hiểu không', muc: ['nguoi_xem'], lam: 'Máy đóng vai người xem, kể lại phim và chấm; cần từ 7/10. Chưa đạt thì cho máy sửa theo góp ý rồi thử lại, hoặc người làm nhận kịch bản khi thấy máy chấm sai.', o: 'Quy trình › Người xem hiểu phim', tien: 'thử 0,02¢ · sửa 0,03¢', chan: 'vẽ ảnh', luu: { goc: 'Máy chấm theo luật phim truyện (đòi cận mặt người nói, cú lật) nên dạng chia sẻ góc nhìn thường chỉ 5/10 dù người xem hiểu đúng ý. Máy sửa có thể làm rơi dữ kiện lá số: đọc lại lời sau khi sửa.' } },
  { ten: 'Phân cảnh', muc: ['phan_canh'], lam: 'Mỗi phân cảnh từ 3 cảnh trở lên cần một cảnh tổng thể cho biết ai ở đâu; cả tập cần có cảnh phản ứng và cảnh tâm trạng.', o: 'Quy trình › Phân cảnh › "Đặt shot tổng thể cho phân cảnh còn thiếu"', tien: 'không tốn tiền', chan: 'vẽ ảnh', luu: { qc: 'Quảng cáo không bị xét luật vai kể này.' } },
  { ten: 'Phong cách hình', muc: ['phong_cach'], lam: 'Chốt một phong cách cố định cho cả phim: chất liệu, màu, ánh sáng, ống kính.', o: 'Quy trình › Phong cách hình › "Máy gợi ý phong cách" rồi "Dùng gợi ý này"', tien: 'studio báo trước 3,7¢', chan: 'vẽ ảnh' },
  { ten: 'Mẫu nhân vật, sản phẩm, bối cảnh', muc: ['mau_doi_tuong', 'mau_boi_canh'], lam: 'Mỗi người, đồ vật, bối cảnh xuất hiện nhiều lần cần một ảnh mẫu để các cảnh vẽ giống nhau. Cảnh có người phải gắn mẫu người. Mô tả mẫu người nên ghi rõ người nước nào, tuổi, tóc, trang phục có màu.', o: 'Quy trình › Mẫu nhân vật › "Máy đề xuất nhân vật, bối cảnh" · "Gắn mẫu người vào các cảnh có người" · "Vẽ ảnh mẫu còn thiếu" · từng mẫu có "↻ Vẽ lại ảnh mẫu"', tien: 'đề xuất 0,1¢ · mỗi ảnh mẫu thật 0,77¢', chan: 'vẽ ảnh', luu: { qc: 'Quảng cáo: một sản phẩm, một người dùng, một bối cảnh; ảnh cảnh phải thấy đúng sản phẩm.', goc: 'Người kể nên là ảnh thật của chính người làm video; Studio 2 chưa có chỗ tải ảnh thật lên (studio thì có).' } },
  { ten: 'Ảnh từng cảnh', muc: ['keyframe'], lam: 'Vẽ ảnh cho mọi cảnh rồi duyệt. Studio có thể từ chối từng cảnh theo luật máy quay hoặc nhịp hình; lời từ chối ghi rõ cảnh nào, sửa gì. Vẽ lại một cảnh thì ảnh mới về tự được dùng, ảnh cũ vẫn nằm trong lưới để chọn lại.', o: 'Quy trình › Storyboard › "Vẽ ảnh các cảnh chưa có" · "Duyệt các ảnh đã có" · từng cảnh: Thuộc tính › tab Hình › "↻ Vẽ lại ảnh cảnh này"', tien: 'mỗi ảnh thật 0,77–1,5¢, 1–2 phút', chan: 'dựng clip', luu: { goc: 'Studio ép cảnh theo khuôn dựng phim truyện (Phát hiện, Vả mặt…): bấm "Bỏ khuôn dựng phim truyện của tập này".', phim: 'Khuôn dựng báo thiếu bước thì sửa vai kể của cảnh hoặc chèn cảnh ở studio.' } },
  { ten: 'Giọng đọc', muc: ['giong', 'tieng'], lam: 'Đọc mọi dòng lời. Studio tự chỉnh giây của cảnh theo độ dài câu đọc.', o: 'Quy trình › Giọng trước video › "Đọc lời cả tập" · từng cảnh: tab Hình › "↻ Đọc lại lời cảnh này"', tien: 'thật 5,3¢ cho 12 dòng', chan: 'dựng clip' },
  { ten: 'Nhạc nền', muc: ['nhac', 'sfx'], lam: 'Một bản nhạc nền cho cả tập.', o: 'Quy trình › Nhạc nền › "Sinh nhạc nền"', tien: 'thật 1,9¢', chan: 'xuất' },
  { ten: 'Kiểm khung và chốt nhịp', lam: 'Máy so từng ảnh với kịch bản và ảnh cảnh liền kề; ảnh lệch thì vẽ lại hoặc nhận. Sau đó xuất một bản dựng từ ảnh để nghe nhịp cả phim rồi chốt nhịp.', o: 'Quy trình › Dựng clip › "Máy kiểm khung các ảnh" · "Vẽ lại / Nhận các ảnh máy báo lệch" · "Xuất video" · "Chốt nhịp trước khi dựng clip"', tien: 'kiểm khung thật 0,06¢ cho 15 ảnh, khoảng 4 phút', chan: 'dựng clip' },
  { ten: 'Dựng clip', lam: 'Quản trị mở video trả phí cho tập, rồi xếp hàng các cảnh. Bộ H3 chạy trên máy thuê: tiến trình trên iMac tự thuê máy khi hàng lặng 4 phút, sinh 3 bản mỗi cảnh, studio soi và chọn bản tốt nhất.', o: 'Quy trình › Dựng clip › "Cho phép video trả phí cho tập này" · "Xếp hàng dựng clip bằng H3" · từng cảnh: tab Hình › "↻ Dựng clip cảnh này"', tien: 'xếp hàng không tốn tiền; lô H3 đo được khoảng 18 phút cho lượt đầu, giá máy 0,2–0,9$ một giờ', luu: { goc: 'Phim không dựng 3D: mỗi cảnh một clip câm dựng từ ảnh cảnh, lời kể ghép lúc xuất.' } },
  { ten: 'Xuất video', muc: ['chuyen_canh', 'logo'], lam: 'Studio ghép hình, giọng, nhạc. Cảnh chưa có clip thì dùng ảnh. Máy soi báo clip có lỗi thì dựng lại cảnh đó, hoặc nhận clip khi thấy máy báo quá tay.', o: 'Quy trình › Xuất › "Xuất video" · "Nhận các clip máy soi báo lỗi"', tien: 'không tốn tiền, khoảng 2 phút' },
  { ten: 'Theo dõi', lam: 'Mọi việc sinh ảnh, clip, tiếng đều vào Hàng đợi: đang chờ, đang chạy, lỗi nguyên văn, tiền thật từng việc và tổng tiền cả phim.', o: 'Quy trình › nút "Hàng đợi"', tien: '' },
];
const cnNhom = (g) => (g.key === 'goc_nhin' ? 'goc' : g.loai === 'quang_cao' ? 'qc' : 'phim');
async function napCn() { if (E.cn?.ds || E.cn?.dang) return; E.cn = { ...(E.cn || {}), dang: true };
  try { E.cn = { ...E.cn, ds: [CN_GOC, ...(await goi('camNangS2'))], dang: false, loi: '' }; } catch (e) { E.cn = { ...E.cn, ds: [CN_GOC], dang: false, loi: e.message }; }
  if (co('cn')) veCn(); }
function veCn() { const el = $('#dCn'); if (!E.cn?.ds) { el.innerHTML = '<span class="nho">Đang đọc cẩm nang từ thư viện của studio…</span>'; return void napCn(); }
  const ds = E.cn.ds, t = D.that, macDinh = t?.coCachKe || nguoiMoi() ? 'goc_nhin' : ds.find((g) => g.key === t?.kt?.goi)?.key || ds[0].key, g = ds.find((x) => x.key === (E.cn.goi || macDinh)) || ds[0], nh = cnNhom(g);
  const nhom = [...new Set(ds.map((x) => x.nhom))], qt = t && E.qt?.tap === t.tap && E.qt.ds ? Object.fromEntries(E.qt.ds.map((m) => [m.key, m.ok])) : null;
  const dau = (b) => { if (!qt || !b.muc) return ''; const ok = b.muc.every((k) => qt[k] !== false); return `<u class="${ok ? 'xong' : 'thieu'}">${ok ? 'phim này: đạt' : 'phim này: chưa đạt'}</u>`; };
  el.innerHTML = `<div class="qt-dau"><b>Cẩm nang sản xuất</b><span class="nho">chọn loại video</span></div>`
    + (E.cn.loi ? `<div class="bao">Không đọc được thư viện studio (${esc(E.cn.loi)}); chỉ còn dạng của Studio 2.</div>` : '')
    + nhom.map((n) => `<div class="cn-nhom"><small>${esc(n)}</small><div class="day-bt">${ds.filter((x) => x.nhom === n).map((x) => `<button type="button" class="bt" data-d="cnGoi" data-g="${x.key}" aria-pressed="${x.key === g.key}">${x.ic || ''} ${esc(x.ten)}</button>`).join('')}</div></div>`).join('')
    + `<div class="cn-the"><h3>${g.ic || ''} ${esc(g.ten)}</h3><p>${esc(g.mo_ta)}</p><span class="nho">Khung ${esc(g.ti_le)} · mỗi video ${g.do_dai_s[0]}–${g.do_dai_s[1]} giây${g.tham_chieu ? ` · Tham chiếu: ${esc(g.tham_chieu)}` : ''}</span>`
    + (g.khung ? `<details open><summary>Khung truyện: ${esc(g.khung.ten)} (${g.khung.beats.length} nhịp)</summary><ol>${g.khung.beats.map((b) => `<li><b>${esc(b.ten)}</b> ${esc(b.mo_ta)}</li>`).join('')}</ol></details>` : '')
    + (g.khan_gia.length ? `<details><summary>Cảm xúc người xem theo thời gian</summary><p>${g.khan_gia.map(esc).join(' → ')}</p></details>` : '')
    + (g.luat.length ? `<details><summary>${g.luat.length} luật dựng cần nhấn</summary><ul>${g.luat.map((l) => `<li><b>${esc(l.ten)}</b> ${esc(l.luat)}</li>`).join('')}</ul></details>` : '') + '</div>'
    + `<h3 class="cn-h">Các bước trên Studio 2</h3><ol class="cn-buoc">${CN_BUOC.filter((b) => !b.chi || b.chi === nh).map((b) => `<li><b>${esc(b.ten)}</b>${dau(b)}${b.chan ? `<i>chưa đạt thì studio chặn ${b.chan}</i>` : ''}<p>${esc(b.lam)}</p><span class="nho">Bấm ở: ${esc(b.o)}${b.tien ? ` · Tiền, thời gian: ${esc(b.tien)}` : ''}</span>${b.luu?.[nh] ? `<span class="cn-luu">${esc(b.luu[nh])}</span>` : ''}</li>`).join('')}</ol>`
    + '<span class="nho">Số tiền và thời gian là số đo thật ngày 20/11/2026 trên phim #7999; giá từng lượt xem ở Hàng đợi.</span>'; }
/** TIỀN THẬT KHI RÊ CHUỘT (chỉ quản trị thật): mọi thứ tốn tiền — ảnh cảnh, clip, lời đọc, nhạc, ảnh mẫu — có title ghi tổng tiền thật + từng lượt đã sinh ra nó
 *  (giờ, model, trạng thái, tiền, lỗi) đọc từ sổ việc của studio (E.hd, hangDoiS2). Sổ chưa đọc thì title nói đang đọc. Người dùng thường không thấy dòng này. */
const LOAI_TIP = { anh: ['anh'], clip: ['video'], giong: ['am'], nhac: ['am'], mau: ['anh'] };
/** CHẾ ĐỘ QUẢN TRỊ (anh 20/11/2026: "thêm 1 option để chọn chế độ của admin riêng. Default vẫn như của mọi người"): mặc định TẮT — quản trị thấy giao diện như mọi người;
 *  bật công tắc trên thanh trên thì mới hiện tiền thật + các lượt sinh khi rê chuột. Người không phải quản trị không có công tắc. */
const xemQt = () => laQtThat() && !!E.qtXem;
function tipTien(kieu, id) { if (!xemQt() || !D.that) return '';
  if (E.hd?.phim !== D.that.phim) { if (!E.hdDang) { E.hdDang = 1; napHd(true).finally(() => { E.hdDang = 0; }); } return '\n— Chi phí thật: đang đọc sổ việc của studio…'; }   // một lượt đọc cho cả trang, không mỗi ô một lượt
  const cid = kieu === 'mau' ? null : GOC[id]?.id, la = LOAI_TIP[kieu] || [];
  const ds = (E.hd.viec || []).filter((v) => la.includes(v.loai) && (kieu === 'mau' ? v.nhan_vat_id === +id : kieu === 'nhac' ? v.canh_id == null && v.nhan_vat_id == null && /nhạc|music/i.test(`${v.nhan} ${v.model}`) : v.canh_id === cid)).sort((a, b) => a.id - b.id);
  if (!ds.length) return '\n— Chi phí thật: chưa có lượt sinh nào trong 300 việc gần nhất của phim';
  const tong = ds.reduce((a, v) => a + v.cents, 0), g = (x) => { const d = new Date(x); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }); };
  return `\n— Chi phí thật: ${tienDo(tong) || '$0'} · ${ds.length} lượt\n` + ds.slice(-8).map((v) => `${g(v.luc)} · ${(v.model || v.provider).replace(/^.*[:/]/, '')} · ${HD_TT[v.trang_thai] || v.trang_thai}${v.cents ? ` · ${tienDo(v.cents)}` : ''}${v.loi ? ` · lỗi: ${v.loi.slice(0, 90)}` : ''}`).join('\n') + (ds.length > 8 ? `\n(và ${ds.length - 8} lượt cũ hơn, xem ở Hàng đợi)` : ''); }
const tipAttr = (kieu, id) => esc(tipTien(kieu, id));
/** HÀNG ĐỢI SINH của cả phim (anh 20/11/2026: "cần chỗ quản lý các queue sinh ảnh, video, voice… để xem lỗi, thành công cũng như chi phí"): 300 việc mới nhất
 *  trong sổ việc của studio (hangDoiS2) — ảnh cảnh, ảnh mẫu, lời đọc, nhạc, clip, chữ, xuất — kèm trạng thái, lỗi nguyên văn, tiền thật. Tự đọc lại theo vòng theo dõi. */
const HD_LOAI = { anh: 'Ảnh', video: 'Clip', am: 'Tiếng', chu: 'Chữ', xuat: 'Xuất' }, HD_TT = { cho: 'Đang chờ', hang: 'Trong hàng H3', hang_h3: 'Chờ máy thuê', chay: 'Đang chạy', xong: 'Xong', loi: 'Lỗi' };
async function napHd(ep) { const t = D.that; if (!t) return; if (!ep && E.hd?.phim === t.phim) return;
  try { const r = await goi('hangDoiS2', t.phim); if (D.that?.phim !== t.phim) return; E.hd = { phim: t.phim, ...r, loi: '' }; } catch (e) { E.hd = { phim: t.phim, viec: E.hd?.viec || [], tong: E.hd?.tong || null, loi: e.message }; }
  if (co('hd')) veHd(); if (co('qt')) { const o = document.querySelector('#qtHd'); if (o) o.textContent = nhanHd(); } if (xemQt()) veTlClip(); }
const nhanHd = () => { const g = E.hd?.tong; return g ? `Hàng đợi${g.cho + g.chay ? ` · ${g.cho + g.chay} đang chờ` : ''}${g.loi ? ` · ${g.loi} lỗi` : ''}` : 'Hàng đợi'; };
function veHd() { const el = $('#dHd'), t = D.that; if (!t) { el.innerHTML = '<div class="trong-w sang">Hàng đợi chỉ có ở phim của studio.</div>'; return; }
  if (E.hd?.phim !== t.phim) { el.innerHTML = '<span class="nho">Đang đọc hàng đợi từ studio…</span>'; return void napHd(); }
  const g = E.hd.tong || { cho: 0, chay: 0, loi: 0, xong: 0, cents: 0 }, loc = E.hdLoc || 'het', LOC = [['het', 'Tất cả'], ['dang', `Chờ + chạy (${g.cho + g.chay})`], ['loi', `Lỗi (${g.loi})`], ['anh', 'Ảnh'], ['video', 'Clip'], ['am', 'Tiếng']];
  const ds = (E.hd.viec || []).filter((v) => loc === 'het' || (loc === 'dang' ? ['cho', 'hang', 'hang_h3', 'chay'].includes(v.trang_thai) : loc === 'loi' ? v.trang_thai === 'loi' : v.loai === loc));
  const gioN = (x) => { const d = new Date(x); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }, giay = (v) => { const a = new Date(v.luc), b = new Date(v.xong_luc), k = Math.round((b - a) / 1000); return v.trang_thai === 'xong' && k > 0 ? ` · ${k < 90 ? `${k} giây` : `${Math.round(k / 60)} phút`}` : ''; };
  el.innerHTML = `<div class="qt-dau"><b>Hàng đợi sinh</b><span class="nho">${g.xong} xong · tổng ${tienDo(g.cents) || '$0'}</span><button type="button" class="bt ic-bt" data-d="hdTai" title="Đọc lại từ studio" aria-label="Đọc lại từ studio">↻</button></div>`
    + (E.hd.loi ? `<div class="bao">Không đọc được hàng đợi: ${esc(E.hd.loi)}</div>` : '')
    + `<div class="day-bt hd-loc">${LOC.map(([k, ten]) => `<button type="button" class="bt" data-d="hdLoc" data-g="${k}" aria-pressed="${loc === k}">${ten}</button>`).join('')}</div>`
    + (ds.length ? ds.map((v) => `<div class="hd-v ${v.trang_thai}"><b>${HD_LOAI[v.loai] || esc(v.loai)}</b><span class="hd-ten">${esc(v.doi_tuong || v.nhan || '')}${v.doi_tuong && v.nhan ? `<small>${esc(v.nhan)}</small>` : ''}</span><u>${HD_TT[v.trang_thai] || esc(v.trang_thai)}</u>`
      + `<small class="hd-phu">#${v.id} · ${gioN(v.luc)}${giay(v)} · ${esc((v.model || v.provider || '').replace(/^.*[:/]/, ''))}${v.cents ? ` · ${tienDo(v.cents)}` : ''}</small>${v.loi ? `<div class="bao">${esc(v.loi)}</div>` : ''}</div>`).join('') : '<span class="nho">Không có việc nào ở mục này.</span>'); }
function veNk() {
  const el = $('#dNk'); if (!D.that) { el.innerHTML = '<div class="trong-w sang">Nhật ký chỉ có ở phim của studio.<br>Mở một phim thật trong menu tên phim.</div>'; return; }
  if (E.nk?.tap !== D.that.tap) napNk();
  const { c, i } = canhTai(Math.min(E.t, tong() - 0.001)), g = GOC[c.id]; if (!g) { el.innerHTML = '<div class="trong-w sang">Cảnh này mới thêm ở đây nên studio chưa có nhật ký.</div>'; return; }
  const B = buocCanh(c), b = E.nkBuoc, [tt, cau] = B[b], js = luotCanh(g), cua = js.filter((j) => buocLuot(j) === b), tien = js.reduce((a, j) => a + j.cents, 0), ct = E.nkCt[g.id];
  const pre = (t, chu) => (chu ? `<details class="nk-ct"><summary>${t}</summary><pre>${esc(chu)}</pre></details>` : ''), anh = (u, chu) => (u ? `<figure class="nk-anh"><img src="${nho(u, 320)}" alt=""><figcaption>${chu}</figcaption></figure>` : '');
  const nguon = (u) => (u && g.nguon_tep?.[u] ? `<span class="nho" title="${esc(g.nguon_tep[u].day)}">${esc(g.nguon_tep[u].ngan)}</span>` : '');
  let than = '';
  if (b === 'kb') than = `<p class="nk-chu">${esc(g.hanh_dong_vi || g.hanh_dong || 'Chưa có mô tả hành động.')}</p>${g.goc_may ? `<p class="nho">Máy: ${esc(g.goc_may)}</p>` : ''}${c.loi ? `<p class="nk-chu">“${esc(c.loi)}”</p>` : ''}`;
  if (b === '3d') than = anh(g.khung_xam?.mau, 'Khung 3D máy đang thấy') + (Array.isArray(g.khung_xam?.kiem) ? g.khung_xam.kiem.filter((k) => k.bat_buoc).map((k) => `<div class="soat ${k.trong_khung ? 'ok' : 'loi'}"><i></i><span>${esc(k.nhan_vat)} ${k.trong_khung ? 'có trong khung' : 'KHÔNG thấy trong khung'}</span></div>`).join('') : '');
  if (b === 'anh') than = anh(g.keyframe_url, `Ảnh đang dùng${g.keyframe_luc ? ` · vẽ ${gioVn(g.keyframe_luc)}` : ''} ${nguon(g.keyframe_url)}`) + ((g.keyframe_uv || []).length > 1 ? `<span class="nho">Đã vẽ ${g.keyframe_uv.length} bản, đang dùng một.</span>` : '') + pre('Câu lệnh vẽ ảnh hiện tại', g.prompt_anh);
  if (b === 'clip') than = ((g.video_phien_ban || []).length ? `<div class="nk-pb">${g.video_phien_ban.map((v, k) => { const dung = v.url === g.video_cuoi_url || v.url === g.video_url; return `<span class="${dung ? 'pb-dung' : ''}" title="${esc([v.model, v.luc ? gioVn(v.luc) : '', dung ? 'đang dùng' : ''].filter(Boolean).join(' · '))}">${k + 1}${v.nhan ? ` ${esc(v.nhan)}` : ''}</span>`; }).join('')}</div><span class="nho">${g.video_phien_ban.length} bản clip, bản tô đậm đang dùng. ${nguon(g.video_cuoi_url || g.video_url)}</span>` : '') + pre('Câu lệnh dựng clip hiện tại', g.prompt_video);
  if (b === 'giong') than = (Array.isArray(g.thoai) ? g.thoai : []).filter((t) => t.loi).map((t) => `<div class="soat ${t.url ? 'ok' : 'canh'}"><i></i><span><b>${esc(t.nhan_vat || 'Lời dẫn')}:</b> ${esc(t.loi)}</span></div>`).join('');
  if (b === 'soat') than = (g.soi_clip && !g.soi_clip.bo_qua ? (g.soi_clip.loi || []).map((s) => `<div class="soat canh"><i></i><span>${esc(s)}</span></div>`).join('') : '') + (g.loi ? `<div class="soat loi"><i></i><span>${esc(g.loi)}</span></div>` : '');
  const dongLuot = (j) => { const [k, ten] = ttLuot(j), mo = E.nkMo === j.id, d = mo && ct && ct !== 'dang' ? ct[j.id] : null;
    return `<div class="nk-l ${k}${mo ? ' mo' : ''}"><button type="button" data-d="nkMo" data-g="${j.id}" aria-expanded="${mo}"><i></i><span class="so">${gioVn(j.luc)}</span><b>${esc(j.model || j.provider)}</b><span class="nk-tt">${ten}</span><span class="so">${tienDo(j.cents)}</span></button>`
      + (mo ? `<div class="nk-mo">${j.loi ? `<div class="bao"><b>Máy báo:</b> ${esc(j.loi)}</div>` : ''}${ct === 'dang' || !ct ? '<span class="nho">Đang đọc câu lệnh…</span>' : ct.loi ? `<div class="bao">Không đọc được chi tiết: ${esc(ct.loi)}</div>` : d ? `${d.cau_lenh ? `<span class="nho">Câu lệnh đã gửi</span><pre>${esc(d.cau_lenh)}</pre>` : ''}${Object.keys(d.chi_tiet || {}).length ? `<dl>${Object.entries(d.chi_tiet).map(([x, y]) => `<dt>${esc(x)}</dt><dd>${esc(Array.isArray(y) ? y.join('\n') : String(y))}</dd>`).join('')}</dl>` : ''}` : ''}${j.output_url ? `<a href="${esc(j.output_url)}" target="_blank" rel="noopener">Mở tệp kết quả ↗</a>` : ''}<span class="nho">Lượt #${j.id}${j.nhan ? ` · ${esc(j.nhan)}` : ''}${j.provider ? ` · qua ${esc(j.provider)}` : ''}</span></div>` : '') + '</div>'; };
  el.innerHTML = `<div class="nk-dau"><b>Cảnh ${i + 1}</b><span class="nho">${esc(c.nhan)}</span><span class="so" title="Tổng tiền các lượt sinh của cảnh này">${tienDo(tien)}</span></div>
    <div class="nk-buoc" role="tablist">${BUOC_NK.map(([k, ten, icn]) => `<button type="button" role="tab" data-d="nkBuoc" data-g="${k}" aria-selected="${b === k}" class="${B[k][0]}" title="${ten}: ${esc(B[k][1])}">${ic(icn)}<span>${ten}</span><i></i></button>`).join('')}</div>
    <div class="nk-than"><div class="nk-cau ${tt}"><i></i><span>${esc(cau)}</span></div>${than}
    ${E.nk?.loi ? `<div class="bao">Không đọc được sổ lượt sinh: ${esc(E.nk.loi)}</div>` : !E.nk?.ds ? '<span class="nho">Đang đọc sổ lượt sinh…</span>' : b === 'kb' || b === '3d' ? '' : cua.length ? `<h3>${cua.length} lượt sinh</h3>${cua.slice(0, 40).map(dongLuot).join('')}${cua.length > 40 ? `<span class="nho">Còn ${cua.length - 40} lượt cũ hơn.</span>` : ''}` : '<span class="nho">Bước này chưa có lượt sinh nào trong sổ.</span>'}</div>`;
}

// ── vẽ
// chú giải nút ngăn Thuộc tính — câu lấy thẳng từ thư viện điện ảnh studio.on.tc (apps/xuong-video/src/lib/xuong-video/dien-anh.ts); góp ý #giao-20261120T1045-chuyen-7dc1
const GIAI_NUT = {
  'Toàn': 'Toàn cảnh — Thấy trọn người và không gian quanh: hành động lớn, vị trí nhân vật.',
  'Trung': 'Trung cảnh — Từ hông trở lên: hội thoại, cử chỉ tay. Cỡ cảnh "kể chuyện" mặc định.',
  'Trung cận': 'Cận trung — Từ ngực trở lên: thoại có cảm xúc, nói vào máy (UGC).',
  'Cận': 'Cận mặt — Cảm xúc chiếm trọn khung: phản ứng, nước mắt, quyết định.',
  'Đặc tả': 'Đặc tả — Chỉ một chi tiết: mắt, bàn tay, giọt mồ hôi. Căng thẳng tột độ hoặc chi tiết sản phẩm.',
  'Ngang': 'Ngang tầm mắt — Trung tính, gần gũi: khán giả ngang hàng nhân vật.',
  'Thấp': 'Góc thấp (hất lên) — Nhân vật trông mạnh, oai, đáng sợ hoặc anh hùng.',
  'Cao': 'Góc cao (nhìn xuống) — Nhân vật nhỏ bé, yếu thế, cô đơn.',
  'Rộng': 'Góc rộng 24mm — Không gian giãn, gần mà méo nhẹ: phiêu lưu, hài.',
  'Chuẩn': 'Chuẩn 35–50mm — Gần mắt người, tự nhiên.',
  'Chân dung': 'Chân dung 85mm — Nền xoá mịn, mặt nổi bật: cảm xúc, sản phẩm.',
  'Macro': 'Macro — Chi tiết siêu cận: chất vải, đường may, giọt nước.',
  'Phóng gần': 'Đẩy chậm vào (push-in) — Máy tiến dần vào mặt: khoảnh khắc nhận ra, cảm xúc dâng.',
  'Lùi xa': 'Lùi ra (pull-out) — Máy lùi xa: hé lộ bối cảnh, cô đơn, kết cảnh.',
  'Lia ngang': 'Lia ngang (pan) — Quét không gian, theo hướng nhìn của nhân vật.',
  'Đứng yên': 'Máy đứng yên — Để diễn xuất tự nói; hợp hài (đúng nhịp) và chính kịch.',
  'Cắt thẳng': 'Cắt thẳng — Mặc định, gọn.',
  'Mờ dần': 'Hoà tan (dissolve) — Hình chồng mờ: thời gian trôi, hồi ức.',
  'Trên': 'Chữ ở trên — Đặt chữ phía trên khung, chừa chỗ cho mặt và hành động ở giữa, dưới.',
  'Giữa': 'Chữ ở giữa — Chữ là tâm điểm của cảnh (câu hook, con số); dùng khi không có mặt người ở giữa khung.',
  'Dưới': 'Chữ ở dưới — Kiểu phụ đề quen mắt, người xem đọc mà không rời hành động.',
  'cx0': 'Mức 0 — Bình thường: cảnh dẫn, thông tin, người xem nghỉ nhịp.',
  'cx1': 'Mức 1 — Hơi gợn: tò mò, bắt đầu để ý.',
  'cx2': 'Mức 2 — Căng: lo lắng, hồi hộp, cảm xúc dâng.',
  'cx3': 'Mức 3 — Đỉnh: khoảnh khắc nhận ra, nước mắt, cú sốc. Người xem nín thở.',
  'lop': 'Lớp — Ảnh dựng từ các lớp (nền, nhân vật, đồ vật) tách riêng, sửa từng lớp không phải sinh lại cả ảnh.',
  '3d': '3D — Khung dựng sơ bộ 3D: kiểm vị trí, góc máy trước khi sinh ảnh thật.',
  'anh': 'Ảnh — Khung hình chính của cảnh, dùng làm khung đầu khi sinh clip.',
  'clip': 'Clip — Đoạn video đã sinh của cảnh.',
};
const giaiNut = (k) => (GIAI_NUT[k] ? ` title="${esc(GIAI_NUT[k])}"` : '');
const chipD = (ds, cur, d, k) => `<div class="day-bt">${ds.map((x) => `<button type="button" class="bt" data-d="${d}"${k ? ` data-k="${k}"` : ''} data-g="${esc(x)}" aria-pressed="${cur === x}"${giaiNut(x)}>${esc(x)}</button>`).join('')}</div>`;
const muc = (t, than) => `<div class="muc"><h3>${t}</h3>${than}</div>`, hg = (t, than) => `<div class="hg"><span>${t}</span><div>${than}</div></div>`;
const nutIc = (t, d, g = '', them = '') => `<button type="button" class="bt ic-bt" data-d="${d}" data-g="${g}" title="${t}" aria-label="${t}" ${them}>${ic(t)}</button>`;
function veD() {
  const el = $('#dung'); el.classList.toggle('pro', pro()); el.dataset.o = E.o; veBoCuc(); veTren();
  if (co('tv')) veTv(); if (co('tt')) veTt(); if (co('pc')) vePc(); if (co('kb')) veKb(); if (co('mb')) veMb(); if (co('lp')) veLp(); if (co('nk')) veNk(); if (co('hd')) veHd(); if (co('cn')) veCn(); if (co('qt')) veQt();
  veTl(); veKhung(); veKim(); vePhu(); veMenu();
  document.querySelectorAll('.d-doi .bt').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === E.o)));
}
function veBoCuc() {
  const ds = boCuc(), nhT = luoiBat() ? nhomTab(ds) : {}, chuT = {}; for (const [c, x] of Object.entries(nhT)) for (const m of x.ds) chuT[m] = c;
  $('#dGiua').style.gridTemplateColumns = luoiBat() ? '' : pro() ? ds.map((w) => WG[w][1]).join(' ') : '292px minmax(0, 1fr) 304px';
  for (const w in WG) { const el = $(`#w-${w}`), i = ds.indexOf(w); el.hidden = i < 0; el.style.order = i + 10; if (i < 0 || !pro()) continue;
    let them = '';
    if (w === 'xem') { const ng = nguonCo(), ten = TEN_NG;
      them = (ng.length > 1 ? `<span class="doan-bt">${ng.map((n) => `<button type="button" class="bt" data-d="nguon" data-g="${n}" aria-pressed="${E.nguon === n}">${ten[n]}</button>`).join('')}</span>` + `<button type="button" class="bt" data-d="ss" aria-pressed="${!!E.ss}" title="Xem các nguồn cạnh nhau cùng lúc để so sánh">So sánh</button>` : '')
        + (D.canh.some((c) => c.hop) ? `<button type="button" class="bt ic-bt" data-d="hopBat" title="Khung nhân vật trên hình 3D" aria-label="Khung nhân vật trên hình 3D" aria-pressed="${E.hop}">${ic('Khung')}</button>` : '')
        + (coClip() ? `<button type="button" class="bt ic-bt" data-d="tat" title="${E.tat ? 'Bật tiếng' : 'Tắt tiếng'}" aria-label="${E.tat ? 'Bật tiếng' : 'Tắt tiếng'}">${ic(E.tat ? 'Tắt tiếng' : 'Tiếng')}</button>` : ''); }
    const gr = nhT[chuT[w]];
    $(`#wd-${w}`).innerHTML = (gr ? `<span class="w-tabs" role="tablist" aria-label="Các widget trong ô này">${gr.ds.map((m) => `<button type="button" role="tab" class="w-tab" data-d="tabMo" data-g="${m}" aria-selected="${m === gr.mo}" title="${WG[m][0]}">${ic(WG[m][0])}<b>${WG[m][0]}</b></button>`).join('')}</span>` : `<span class="w-ten" tabindex="0" role="button" data-wg="${w}" aria-label="Widget ${WG[w][0]}: kéo để dời tới ô khác, phím mũi tên trái phải để đổi chỗ với widget bên cạnh" title="Kéo để dời · thả lên đầu widget khác để xếp thành tab · kéo mép hoặc góc widget để co giãn · phím ← → đổi chỗ">${ic(WG[w][0])}<b>${WG[w][0]}</b></span>`) + `<span class="w-them">${them}</span><span class="w-nut">${gr ? `<button type="button" class="bt w-tach" data-d="tabTach" data-g="${w}" title="Đưa tab đang mở ra ô riêng">Tách</button>` : ''}${w === 'xem' ? '' : `<button type="button" class="bt ic-bt" data-d="wg" data-g="${w}" title="Ẩn widget này" aria-label="Ẩn widget này">${ic('Đóng')}</button>`}</span>`; }
  dongBoLuoi(ds);
}
const chipMoi = () => (E.nhuMoi && laQtThat() ? '<button type="button" class="thu canh nut" data-d="nhuMoi" title="Đang ẩn phim cũ của studio, phim mẫu và mọi thứ chỉ quản trị thấy. Bấm để về lại chế độ quản trị.">Đang xem như người mới · Thoát</button>' : '');
function veTren() {
  const p = pro(), ten = (t, d, them = '') => (p ? nutIc(t, d, '', them) : `<button type="button" class="bt" data-d="${d}" ${them}>${t === 'Hoàn tác' ? '↶ ' : t === 'Làm lại' ? '↷ ' : ''}${t}</button>`);
  $('#dTren').innerHTML = `<span class="ten-hang">Studio 2</span>
  <button type="button" class="bt da-nut" data-d="menu" data-g="da" aria-haspopup="true" aria-expanded="${E.menu?.loai === 'da'}"><b>${esc(D.ten)}</b><small>${LOAI[D.loai]}</small><span aria-hidden="true">▾</span></button>
  ${D.that ? `<span class="thu that">${nguoiMoi() ? 'Video của bạn' : 'Phim của studio'}${laQuanTri() ? ` <a href="https://studio.on.tc/?m=phim&mId=${D.that.phim}&tab=storyboard" target="_blank" rel="noopener">Mở trong studio ↗</a>` : ''}</span><span id="dLuu">${veLuuNut()}</span>${chipMoi()}` : `<span class="thu">${E.dangMo ? 'Đang đọc…' : D.trongTrang ? 'Chưa mở video nào' : 'Phim mẫu · dữ liệu đóng sẵn'}</span>${E.nguoi && !laQuanTri() && !E.nguoi.quyen.dung ? '<span class="thu canh" title="Phim mẫu vẫn xem được. Muốn tạo và làm video thật thì nhờ quản trị cấp quyền ở mục Đội.">Tài khoản chưa được cấp quyền dùng phim thật</span>' : ''}${chipMoi()}`}
  <span class="day"><span class="doan-bt" role="group" aria-label="Phiên bản">${[['gon', 'Gọn'], ['pro', 'Pro']].map(([k, t]) => `<button type="button" class="bt" data-d="ban" data-g="${k}" aria-pressed="${E.ban === k}">${t}</button>`).join('')}</span>
  ${p ? `<button type="button" class="bt ic-bt" data-d="menu" data-g="bc" title="Bố cục widget" aria-label="Bố cục widget" aria-haspopup="true" aria-expanded="${E.menu?.loai === 'bc'}">${ic('Bố cục')}</button>` : ''}
  ${ten('Hoàn tác', 'lui', E.lui.length ? '' : 'disabled')}${ten('Làm lại', 'toi', E.toi.length ? '' : 'disabled')}
  ${laQtThat() ? `<button type="button" class="bt qt-xem" data-d="qtXem" aria-pressed="${!!E.qtXem}" title="Chế độ quản trị: rê chuột vào ảnh, clip, lời đọc, nhạc, ảnh mẫu để xem tiền thật và các lượt đã sinh ra chúng. Tắt = giao diện như mọi người">${E.qtXem ? 'Quản trị: bật' : 'Quản trị'}</button>` : ''}
  <button type="button" class="bt gop-y" data-gop-y-mo title="Góp ý / báo lỗi về Studio 2: gửi kèm ảnh, xem trả lời và theo dõi từng góp ý ở tab Của tôi" aria-label="Góp ý, báo lỗi">💬${p ? '' : ' Góp ý'}</button>
  ${p ? `<button type="button" class="bt ic-bt" data-d="taoThat" title="Tạo video mới trên studio" aria-label="Tạo video mới trên studio">${ic('Thêm')}</button>` : '<button type="button" class="bt" data-d="taoThat">＋ Tạo video mới</button>'}<button type="button" class="bt chinh" data-d="xuat">Xuất video</button></span>`;
}
function veMenu() {
  const m = $('#dMenu'); m.hidden = !E.menu; if (!E.menu) { m.innerHTML = ''; return; } let h = '';
  if (E.menu.loai === 'da') h = `<h3>${nguoiMoi() ? 'Video của bạn' : 'Phim của studio'}</h3><input type="text" id="mnTim" placeholder="Tìm theo tên" value="${esc(E.tim)}" aria-label="Tìm video" autocomplete="off"><div class="mn-kq" id="mnKq">${veKqTim()}</div>`
    + (laQuanTri() ? '<div class="day-bt"><button type="button" class="bt" data-d="doiMo">Đội và quyền</button><button type="button" class="bt" data-d="nhuMoi" title="Ẩn phim cũ của studio, phim mẫu và mọi thứ chỉ quản trị thấy, để tự đi thử đúng lối của một người mới">Xem như người mới</button></div>' : '')
    + (nguoiMoi() ? '<div><button type="button" class="bt chinh" data-d="taoThat">＋ Tạo video mới</button></div>' : `<h3>Video mẫu để thử</h3>${Object.entries(DU_AN).map(([k, a]) => `<button type="button" class="mn-da" data-d="duAn" data-g="${k}" aria-pressed="${E.da === k}"><img src="${a.bia}" alt=""><span><b>${esc(a.ten)}</b><small>${LOAI[a.loai]} · ${a.so} cảnh · ${gio(a.dai)}</small></span></button>`).join('')}`);
  else { const ds = boCuc();
    h = `<h3>Bố cục cho loại “${LOAI[D.loai]}”</h3><div class="mn-wg">${Object.keys(WG).map((w) => `<button type="button" class="bt" data-d="wg" data-g="${w}" aria-pressed="${ds.includes(w)}" ${w === 'xem' ? 'disabled' : ''}>${ic(WG[w][0])}${WG[w][0]}</button>`).join('')}</div>
    <h3>Bố cục đặt sẵn theo loại video</h3><div class="mn-bc">${Object.entries(BO_CUC).map(([k, b]) => `<button type="button" data-d="bcMau" data-g="${k}" aria-pressed="${dangBc() === k}" title="${esc(b.cho)}"><svg viewBox="-.5 -.5 25 17" aria-hidden="true">${Object.entries(b.o).map(([w, [x, y, rong, cao]]) => `<rect class="${w === 'xem' ? 'xem' : ''}" x="${x + 0.3}" y="${y + 0.3}" width="${rong - 0.6}" height="${cao - 0.6}" rx=".8"/>`).join('')}</svg><span><b>${b.ten}${k === D.loai ? ' <i>mặc định</i>' : ''}</b><small>${Object.keys(b.o).map((w) => WG[w][0]).join(' · ')}</small></span></button>`).join('')}</div>
    <h3>Lưới</h3><div class="day-bt">${[[6, 'Thô 6 × 4'], [12, 'Vừa 12 × 8'], [24, 'Mịn 24 × 16']].map(([n, t]) => `<button type="button" class="bt" data-d="luoi" data-g="${n}" aria-pressed="${E.luoi.n === n}">${t}</button>`).join('')}</div>
    <div class="day-bt"><button type="button" class="bt" data-d="luoiHien" aria-pressed="${E.luoi.hien}">Luôn hiện lưới</button><button type="button" class="bt" data-d="luoiLai">Xếp lại một hàng</button></div>
    <span class="nho">Kéo đầu widget để dời tới ô khác, kéo mép hoặc góc widget để co giãn ngang và dọc. Mỗi loại hình video nhớ một bố cục riêng.</span>`; }
  m.innerHTML = h; datMenu();
}
function veTv() {
  const T = ['Mẫu', 'Hình', 'Nhân vật', 'Chữ', 'Giọng', 'Nhạc']; let h = '';
  if (E.tab === 'Mẫu') h = `<span class="nho">Bấm một mẫu để dựng sẵn cả video theo kiểu đó, rồi sửa từng cảnh.</span><div class="luoi2">${KIEU.map((k) => `<button type="button" class="o-mau" data-d="mau" data-g="${k.ma}" aria-pressed="${D.kieu === k.ma}"><img src="${ANH(k.ma)}" alt="" loading="lazy"><span>${k.ten}</span></button>`).join('')}</div>`;
  if (E.tab === 'Hình') h = `${muc('Vẽ hình mới', `<input type="text" id="tvMoTa" placeholder="Tả hình bạn cần, vd: sư tử nằm dưới trăng"><div><button type="button" class="bt" data-d="veHinh">Vẽ và thêm vào timeline</button></div>`)}
    ${muc('Hình có sẵn', `<span class="nho">Bấm một hình để thêm thành cảnh mới sau cảnh đang chọn.</span><div class="luoi3">${khoHinh().map((a) => `<button type="button" class="o-hinh cong" data-d="hinh" data-g="${a}" aria-label="Thêm hình thành cảnh mới"><img src="${a}" alt="" loading="lazy"></button>`).join('')}</div>`)}`;
  if (E.tab === 'Nhân vật') { const con = KHO_NV.filter(([i]) => !D.nvs.some((n) => n.id === i)), nhom = [...new Set(D.nvs.map((n) => n.vai))];
    h = `<span class="nho">Mỗi nhân vật, đồ vật giữ một vẻ ngoài suốt video. Gắn vào cảnh ở bảng Thuộc tính.</span>
    ${nhom.map((v) => `${nhom.length > 1 ? `<h3>${v}</h3>` : ''}${D.nvs.filter((n) => n.vai === v).map((n) => `<div class="o-nv"><img src="${anhNv(n)}" alt=""><div><b>${esc(n.ten)}</b><span class="nho">có mặt ở ${D.canh.filter((c) => c.nv.includes(n.id)).length} cảnh</span>
      <input type="text" data-f="nvmo" data-id="${n.id}" id="nv-${n.id}" placeholder="Tả vẻ ngoài" value="${esc(n.mo)}"><span class="day-bt"><button type="button" class="bt" data-d="veNv" data-g="${n.id}">Vẽ lại</button><button type="button" class="bt" data-d="boNv" data-g="${n.id}">Bỏ</button></span></div></div>`).join('')}`).join('') || '<span class="nho">Video này chưa có nhân vật.</span>'}
    ${E.moNv ? muc('Chọn nhân vật', `<div class="day-bt">${con.map(([i, t]) => `<button type="button" class="bt" data-d="themNv" data-g="${i}">${t}</button>`).join('')}</div><span class="nho">Bản thật: gõ tên hoặc tải hình để tạo nhân vật riêng.</span>`) : `<div><button type="button" class="bt" data-d="moNv">＋ Thêm nhân vật</button></div>`}`; }
  if (E.tab === 'Chữ') h = `<span class="nho">Kiểu chữ dùng chung cho cả video. Nội dung chữ sửa ở từng đoạn trên hàng Chữ.</span><div class="luoi2">${KCHU.map((k, i) => `<button type="button" class="o-chu" data-d="kchu" data-g="${k}" aria-pressed="${D.kieuChu === k}"><small>${k}</small>${i < 3 ? `<span class="k-chu kc-${i}" style="position:static;font-size:15px;transform:none">Your sign</span>` : ''}</button>`).join('')}</div>`;
  const hang = (ds, cur, d) => ds.map((x) => `<div class="hang${cur === x ? ' dang' : ''}"><b>${x}</b><button type="button" class="bt tron" data-d="nghe" data-g="${x}">▶ Nghe thử</button><button type="button" class="bt" data-d="${d}" data-g="${x}" aria-pressed="${cur === x}">${cur === x ? '✓ Đang dùng' : 'Dùng'}</button></div>`).join('');
  if (E.tab === 'Giọng') h = `<span class="nho">Một giọng đọc cho cả video.</span>${hang(GIONG, D.giong, 'giong')}`;
  if (E.tab === 'Nhạc') h = `<span class="nho">Nhạc nền chạy suốt video, tự nhỏ lại khi có giọng đọc.</span>${hang(NHAC, D.nhac, 'nhac')}`;
  $('#dTv').innerHTML = `<div class="tv-tab">${T.map((t) => `<button type="button" data-d="tab" data-g="${t}" title="${t}" aria-pressed="${E.tab === t}">${ic(t)}<span>${t}</span></button>`).join('')}</div><div class="tv-than">${h}</div>`;
}
const veCb = (c) => (dai(c) ? `<div class="bao">${c.khop != null ? `Cảnh đang ngắn hơn lời đã thu (${c.khop} giây) nên lời sẽ bị cắt.` : `Lời này đọc mất khoảng ${docS(c).toFixed(1)} giây, cảnh chỉ dài ${c.tg} giây nên sẽ bị cắt.`}<button type="button" class="bt" data-d="vuaLoi">Kéo dài cảnh cho vừa</button></div>`
  : c.loi.trim() ? `<span class="nho">${c.khop != null ? 'Lời đã thu, vừa với cảnh' : `Đọc hết khoảng ${docS(c).toFixed(1)} giây · cảnh dài ${c.tg} giây`}</span>` : '');
function canhBao() {
  const o = D.canh.map((c, i) => (dai(c) ? `Cảnh ${i + 1} (${c.nhan}): lời dài hơn cảnh` : !c.loi.trim() && ['hinh', 'tailieu', 'may'].includes(D.loai) ? `Cảnh ${i + 1} (${c.nhan}): chưa có lời đọc` : null)).filter(Boolean);
  if (pro()) { const n = D.canh.filter((c) => c.soi?.length || c.ban3).length; if (n) o.push(`${n} cảnh còn điểm cần xem ở thẻ Soát`); }
  if (D.tile === '9:16' && tong() > 60) o.push(`Video dài ${Math.round(tong())} giây: Shorts và Reels chỉ nhận tới 60 giây`);
  return o;
}
function veTt() {
  const ch = E.chon, c = canhChon(), o = [];
  let dau = 'Video';
  if (!ch) { const cb = canhBao();
    o.push(muc('Tên video', `<input type="text" id="dTen" data-f="ten" value="${esc(D.ten)}">`), muc('Tỉ lệ khung', chipD(Object.keys(TILE), D.tile, 'tile')), muc('Tổng quan', `<span>${D.canh.length} cảnh · dài <b class="so">${gio(tong())}</b></span>`),
      cb.length ? `<div class="bao"><b>${cb.length} chỗ nên xem</b>${cb.slice(0, 4).map((x) => `<span>${esc(x)}</span>`).join('')}${cb.length > 4 ? `<span>và ${cb.length - 4} chỗ nữa</span>` : ''}${D.canh.some(dai) ? '<button type="button" class="bt" data-d="suaHet">Sửa giúp tôi</button>' : ''}</div>` : '',
      `<span class="nho">Bấm một đoạn trên timeline để sửa đoạn đó. Kéo mép phải của cảnh để đổi độ dài, kéo cả cảnh để đổi thứ tự.</span>`);
  } else if (ch.id === 'nhac') { dau = 'Nhạc nền';
    o.push(muc('Bản nhạc', chipD(NHAC, D.nhac, 'nhac')), muc(`Âm lượng · <span id="iAmSo">${D.am}</span>%`, `<input type="range" id="iAm" data-f="am" min="0" max="100" value="${D.am}" aria-label="Âm lượng nhạc">`),
      `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="iNho" data-f="nhoLai" ${D.nhoLai ? 'checked' : ''}> Tự nhỏ lại khi có giọng đọc</label>`);
  } else if (pro()) { dau = `${vt(c.id) + 1} · ${esc(c.nhan)}`; o.push(veTtPro(c));
  } else { const i = vt(c.id); dau = `Cảnh ${i + 1} · ${esc(c.nhan)}`;
    o.push(`<div class="day-bt" role="group" aria-label="Phần đang sửa">${[['canh', 'Hình'], ['chu', 'Chữ'], ['giong', 'Lời đọc']].map(([l, t]) => `<button type="button" class="bt" data-d="loai" data-g="${l}" aria-pressed="${ch.loai === l}">${t}</button>`).join('')}</div>`);
    if (ch.loai === 'canh') o.push(
      `<div class="tt-anh"><img src="${c.anh}" alt=""><div class="day-bt"><button type="button" class="bt" data-d="moDoi" aria-pressed="${E.moDoi}">Đổi hình</button><button type="button" class="bt" data-d="veLai">${c.ve ? 'Đang vẽ…' : 'Vẽ lại cảnh'}</button></div></div>`, luoiDoi(c),
      muc('Tả cảnh bạn muốn thấy', `<input type="text" id="iMoTa" data-f="mota" placeholder="vd: Heracles ôm cổ sư tử trong hang tối" value="${esc(c.mota)}">`), chipNv(c, true),
      muc('Chuyển động', chipD(CD, c.cd, 'cd')), muc('Thời lượng', nutTg(c)),
      `<details id="iThem" ${E.moThem ? 'open' : ''}><summary>Thêm: cách vào cảnh, thứ tự, tên cảnh</summary>${[muc('Vào cảnh bằng', chipD(CHUYEN, c.chuyen, 'chuyen')), muc('Thứ tự', nutThuTu(i)), muc('Tên cảnh', `<input type="text" id="iNhan" data-f="nhan" value="${esc(c.nhan)}">`)].join('')}</details>`);
    if (ch.loai === 'chu') o.push(muc('Chữ trên màn hình', `<textarea id="iChu" data-f="chu" rows="2" placeholder="Một cụm ngắn, dưới 6 từ">${esc(c.chu)}</textarea><span class="nho">Chữ ngắn thì người xem đọc kịp trong lúc nghe.</span>`),
      muc('Vị trí', chipD(VITRI, c.viTri, 'viTri')), muc('Kiểu chữ (cả video)', chipD(KCHU, D.kieuChu, 'kchu')));
    if (ch.loai === 'giong') o.push(muc('Lời đọc của cảnh này', `<textarea id="iLoi" data-f="loi" rows="4" placeholder="Gõ lời đọc bằng tiếng Anh">${esc(c.loi)}</textarea><div id="iCb">${veCb(c)}</div>
        <div class="day-bt"><button type="button" class="bt" data-d="nganLoi">Rút gọn</button>${i === 0 ? '<button type="button" class="bt" data-d="goiY">↻ Câu mở khác</button>' : ''}</div>`),
      muc('Giọng đọc (cả video)', chipD(GIONG, D.giong, 'giong')), muc('Tốc độ đọc', chipD(Object.keys(TOC), D.toc, 'toc')));
  }
  $('#dTt').innerHTML = `<div class="tt-dau"><b>${dau}</b>${ch ? '<button type="button" class="bt tron" data-d="boChon">Bỏ chọn</button>' : ''}</div>${o.join('')}`;
}
const luoiDoi = (c) => (E.moDoi ? `<div class="luoi3">${khoHinh().slice(0, 18).map((a) => `<button type="button" class="o-hinh" data-d="doiHinh" data-g="${a}" aria-pressed="${c.anh === a}" aria-label="Dùng hình này"><img src="${a}" alt="" loading="lazy"></button>`).join('')}</div>` : '');
const chipNv = (c, coTieuDe) => { if (!D.nvs.length) return ''; const h = `<div class="day-bt">${D.nvs.map((n) => `<button type="button" class="bt nv-bt" data-d="nvCanh" data-g="${n.id}" aria-pressed="${c.nv.includes(n.id)}"><img src="${anhNv(n)}" alt="">${esc(n.ten)}</button>`).join('')}</div>`; return coTieuDe ? muc('Nhân vật trong cảnh', h) : h; };
const nutTg = (c) => `<div class="tg"><button type="button" class="bt" data-d="tg" data-g="-0.5" aria-label="Bớt nửa giây">−</button><b class="so">${c.tg} giây</b><button type="button" class="bt" data-d="tg" data-g="0.5" aria-label="Thêm nửa giây">+</button></div>`;
const nutThuTu = (i) => `<div class="day-bt"><button type="button" class="bt" data-d="doiCho" data-g="-1" ${i ? '' : 'disabled'}>← Đưa lên trước</button><button type="button" class="bt" data-d="doiCho" data-g="1" ${i < D.canh.length - 1 ? '' : 'disabled'}>Đưa ra sau →</button></div>`;
/** bảng Thuộc tính bản Pro: năm thẻ theo việc (Máy · Diễn · Thoại · Hình · Soát), mỗi thẻ là các hàng nhãn trái, điều khiển phải */
function veTtPro(c) {
  const i = vt(c.id), n = soLoi(c), T = [['may', 'Máy'], ['dien', 'Diễn'], ['thoai', 'Thoại'], ['hinh', 'Hình'], ['soat', 'Soát']], t = E.ttTab; let h = '';
  if (t === 'may') h = hg('Cỡ cảnh', chipD(CO, c.co, 'dat', 'co')) + hg('Góc', chipD(GM, c.gm, 'dat', 'gm')) + hg('Ống kính', chipD(ONG, c.ong, 'dat', 'ong')) + hg('Máy', chipD(CD, c.cd, 'cd')) + hg('Vào cảnh', chipD(CHUYEN, c.chuyen, 'chuyen'))
    + hg('Dài', nutTg(c)) + hg('Thứ tự', nutThuTu(i)) + hg('Đoạn', `<input type="text" id="iPd" data-f="pd" value="${esc(c.pd)}" placeholder="Tên đoạn">`) + hg('Tên', `<input type="text" id="iNhan" data-f="nhan" value="${esc(c.nhan)}">`);
  if (t === 'dien') h = `<textarea id="iMoTa" data-f="mota" rows="4" placeholder="Chuyện gì xảy ra trong cảnh này">${esc(c.mota)}</textarea>` + hg('Có mặt', chipNv(c) || '<span class="nho">Chưa có nhân vật</span>')
    + hg('Cảm xúc', `<div class="cx">${[0, 1, 2, 3].map((v) => `<button type="button" data-d="dat" data-k="cx" data-g="${v}" aria-pressed="${c.cx === v}" aria-label="Mức ${v}"${giaiNut(`cx${v}`)}></button>`).join('')}</div>`);
  if (t === 'thoai') h = (c.thoai.length ? c.thoai.map((l, k) => `<div class="thoai-d"><i class="dau" title="${esc(l.ai)}">${esc(l.ai[0])}</i><textarea id="iTh${k}" data-f="thoai" data-i="${k}" rows="2">${esc(l.cau)}</textarea></div>`).join('')
      : `<textarea id="iLoi" data-f="loi" rows="4" placeholder="Lời đọc của cảnh này">${esc(c.loi)}</textarea>`) + `<div id="iCb">${veCb(c)}</div>`
    + (nguoiNoi().length ? `<div><button type="button" class="bt" data-d="themThoai">＋ Câu thoại</button></div>` : '')
    + hg('Chữ', `<input type="text" id="iChu" data-f="chu" value="${esc(c.chu)}" placeholder="Chữ trên màn hình">`) + hg('Vị trí', chipD(VITRI, c.viTri, 'viTri')) + hg('Tiếng', `<input type="text" id="iTd" data-f="td" value="${esc(c.td)}" placeholder="Tiếng động của cảnh">`);
  if (t === 'hinh') { const ng = nguonCo(), ten = TEN_NG;
    h = `<div class="ba-anh">${ng.map((g) => `<button type="button" class="o-hinh" data-d="nguon" data-g="${g}" aria-pressed="${E.nguon === g}"${giaiNut(g)}><img src="${g === 'lop' && c.nen ? c.nen : g === '3d' && c.k3 ? c.k3 : c.anh}" alt="" style="aspect-ratio:${TILE[D.tile]}"><small>${ten[g]}</small></button>`).join('')}</div>`
      + (c.pb ? hg('Bản dựng', `<div class="day-bt">${[...Array(Math.min(c.pb, 6))].map((_, k) => `<button type="button" class="bt" data-d="banPb" aria-pressed="${k === Math.min(c.pb, 6) - 1}">${c.pb - Math.min(c.pb, 6) + k + 1}</button>`).join('')}</div>`) : '')
      + `<div class="day-bt"><button type="button" class="bt" data-d="moDoi" aria-pressed="${E.moDoi}">Đổi ảnh</button>${GOC[c.id] && D.that ? '' : `<button type="button" class="bt" data-d="veLai">${c.ve ? 'Đang vẽ…' : 'Vẽ lại ảnh'}</button><button type="button" class="bt" data-d="dungClip">Dựng lại clip</button>`}${c.m3 ? '<button type="button" class="bt" data-d="dung3d">Dựng lại 3D</button>' : ''}</div>` + (GOC[c.id] && D.that ? `<div class="qt-nut">${nutBuoc(`kf1:${c.id}`)}${nutBuoc(`duyet1:${c.id}`)}${c.thoai.length || c.loi ? nutBuoc(`giong1:${c.id}`) : ''}${nutBuoc(`clip1:${c.id}`)}</div>${(GOC[c.id].keyframe_uv || []).length > 1 ? `<span class="nho">Các ảnh đã vẽ của cảnh này, bấm để dùng:</span><div class="luoi3">${GOC[c.id].keyframe_uv.slice(-9).map((u) => `<button type="button" class="o-hinh" data-d="uvChon" data-g="${esc(u)}" aria-pressed="${GOC[c.id].keyframe_url === u}" aria-label="Dùng ảnh này"><img src="${esc(nho(u, 320))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}` : '') + luoiDoi(c); }
  if (t === 'soat') { const r = [], d = (l, chu, nut = '') => r.push(`<div class="soat ${l}"><i></i><span>${chu}</span>${nut}</div>`);
    if (c.kiem?.length) { const th = c.kiem.filter((k) => !k.ok).map((k) => k.n); if (th.length) d('loi', `Thiếu trong khung 3D: ${esc(th.join(', '))}`); else d('ok', 'Đủ nhân vật trong khung 3D'); }
    if (dai(c)) d('loi', 'Lời dài hơn cảnh', '<button type="button" class="bt" data-d="vuaLoi">Kéo dài</button>'); else if (c.loi.trim()) d('ok', 'Lời vừa thời lượng');
    if (c.ban3) d('canh', 'Khung 3D chưa khớp mặt bằng vừa sửa', '<button type="button" class="bt" data-d="dung3d">Dựng lại</button>');
    (c.soi || []).forEach((s, k) => d('canh', `Clip: ${esc(s.toLowerCase())}`, `<button type="button" class="bt" data-d="boSoi" data-g="${k}">Đã xem</button>`));
    if (i) d('ok', 'Nối với cảnh trước');
    h = (r.join('') || '<span class="nho">Chưa có gì để soát.</span>') + (D.that && !co('nk') ? '<div><button type="button" class="bt" data-d="nkBat">Xem từng bước sinh của cảnh</button></div>' : ''); }
  return `<div class="tt-tab" role="tablist">${T.map(([k, ten]) => `<button type="button" role="tab" data-d="ttTab" data-g="${k}" aria-selected="${t === k}" title="${ten}">${ic(ten)}<span>${ten}</span>${k === 'soat' && n ? `<u>${n}</u>` : ''}</button>`).join('')}</div><div class="tt-pro">${h}</div>`;
}
function vePc() {
  const g = []; D.canh.forEach((c, i) => { const k = c.pd || ''; if (!g.length || g.at(-1).k !== k) g.push({ k, ds: [] }); g.at(-1).ds.push([c, i]); });
  const { c: dang } = canhTai(Math.min(E.t, tong() - 0.001));
  $('#dPc').innerHTML = g.map(({ k, ds }) => `${k ? `<h3>${esc(k)}<span class="so">${gio(ds.reduce((a, [c]) => a + c.tg, 0))}</span></h3>` : ''}<div class="pc-luoi" style="--cot:${D.tile === '16:9' ? 104 : 66}px">${ds.map(([c, i]) => `<button type="button" class="pc-o${E.chon?.id === c.id ? ' chon' : ''}${dang.id === c.id ? ' dang' : ''}" data-d="chonCanh" data-g="${c.id}" title="${esc(c.nhan)}" style="aspect-ratio:${TILE[D.tile]}">
    <img src="${E.nguon === '3d' && c.k3 ? c.k3 : c.anh}" alt="" loading="lazy"><b>${i + 1}</b><i>${c.tg}s</i>${soLoi(c) ? '<u title="Có điểm cần xem"></u>' : ''}</button>`).join('')}</div>`).join('');
}
function veKb() {
  $('#dKb').innerHTML = D.canh.map((c, i) => `<button type="button" class="kb-d${E.chon?.id === c.id ? ' chon' : ''}" data-d="chonLoi" data-g="${c.id}"><b class="so">${i + 1}</b><span>${c.thoai.length ? c.thoai.map((l) => `<em>${esc(l.ai)}</em> ${esc(l.cau)}`).join(' ') : esc(c.loi) || '<span class="nho">Không lời</span>'}</span><i class="so">${c.tg}s</i></button>`).join('');
}
/** widget Lớp: các thành phần ghép nên cảnh đang ở kim, lớp trên cùng đứng đầu (như bảng lớp của AE). Mắt = ẩn / hiện, bấm tên = chỉ xem lớp đó. */
function veLp() {
  const { c, i } = canhTai(Math.min(E.t, tong() - 0.001)), el = $('#dLp');
  if (!c.lop) { el.innerHTML = `<div class="trong-w sang">${coLop() ? 'Cảnh này chưa tách lớp.' : 'Video này dựng từ ảnh và clip nên không tách lớp.<br>Lớp dùng cho video ghép từ bản đồ, hình dán và chữ.'}</div>`; return; }
  const an = c.an || [], solo = E.solo?.id === c.id ? E.solo.k : null;
  const thu = (l) => { const [x0, y0, x1, y1] = l.hop, w = x1 - x0 + 1, h = y1 - y0 + 1, z = Math.min(40 / w, 40 / h, 0.6); return `background-image:url('${l.anh}');background-size:${360 * z}px ${640 * z}px;background-position:${(44 - w * z) / 2 - x0 * z}px ${(44 - h * z) / 2 - y0 * z}px`; };
  el.innerHTML = `<div class="lp-dau"><span class="nho">Cảnh ${i + 1} · ${c.lop.length} lớp trên bản đồ</span>${solo || an.length ? '<button type="button" class="bt tron" data-d="lopHet">Hiện tất cả</button>' : ''}</div>`
    + [...c.lop].reverse().map((l) => `<div class="lp-d${solo === l.k ? ' solo' : ''}${an.includes(l.k) ? ' an' : ''}"><button type="button" class="bt ic-bt" data-d="lopAn" data-g="${l.k}" aria-pressed="${!an.includes(l.k)}" title="${an.includes(l.k) ? 'Hiện lớp' : 'Ẩn lớp'}" aria-label="Ẩn hoặc hiện lớp ${l.ten}">${ic(an.includes(l.k) ? 'Mắt tắt' : 'Mắt')}</button>
      <button type="button" class="lp-than" data-d="lopSolo" data-g="${l.k}" title="Chỉ xem lớp này" aria-pressed="${solo === l.k}"><span class="lp-anh" style="${thu(l)}"></span><span><b>${ic(l.bt)}${l.ten}</b><small>${esc(l.chi)}</small></span></button></div>`).join('')
    + `<div class="lp-d nen"><span class="bt ic-bt" aria-hidden="true">${ic('Mắt')}</span><span class="lp-than"><span class="lp-anh" style="background-image:url('${c.nen}');background-size:cover"></span><span><b>${ic('Mặt bằng')}Bản đồ nền</b><small>Luôn hiện</small></span></span></div>`;
}
/** mặt bằng nhìn từ trên xuống của cảnh đang ở kim: bối cảnh, người, máy quay và vùng máy thấy. Kéo người / máy / điểm ngắm để sửa. */
function veMb() {
  const { c, i } = canhTai(Math.min(E.t, tong() - 0.001)), el = $('#dMb');
  if (!D.set || !c.m3) { el.innerHTML = `<div class="trong-w">${D.set ? 'Cảnh này chưa có mặt bằng 3D.' : 'Video này không dựng 3D.<br>Mặt bằng dùng cho phim có nhân vật di chuyển trong bối cảnh.'}</div>`; return; }
  const m = c.m3, kh = D.set.khoi, Y = (y) => -y, nguoi = m.vt.filter((v) => kh[v.ten]?.nguoi);
  if (!keoMb || E.mbK?.id !== c.id) { const xs = [m.dat[0], m.nhin[0], ...nguoi.map((v) => v.x)], ys = [m.dat[1], m.nhin[1], ...nguoi.map((v) => v.y)], le = 230, r = (el.clientWidth || 300) / Math.max(120, (el.clientHeight || 340) - 38);
    let w = Math.max(760, Math.max(...xs) - Math.min(...xs) + 2 * le), h = Math.max(760, Math.max(...ys) - Math.min(...ys) + 2 * le); if (w / h < r) w = h * r; else h = w / r;
    E.mbK = { id: c.id, x: (Math.max(...xs) + Math.min(...xs)) / 2 - w / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 + h / 2, w, h, u: w / (el.clientWidth || 300) }; }
  const K = E.mbK, u = K.u;
  const nen = D.set.vat.map((v) => `<rect x="${v.x}" y="${Y(v.y + v.h)}" width="${v.w}" height="${v.h}" fill="${v.mau}" opacity="${v.nen ? 0.5 : 0.95}"><title>${esc(v.ten)}</title></rect>`).join('');
  const vat = m.vt.map((v, k) => { const o = kh[v.ten]; if (!o) return '';
    if (!o.nguoi) return o.h > 200 ? `<rect x="${v.x - o.w / 2}" y="${Y(v.y + o.h / 2)}" width="${o.w}" height="${o.h}" fill="#2f7d4a" opacity=".85"><title>${esc(v.ten)}</title></rect>` : '';
    const g = (v.h || 0) * Math.PI / 180;
    return `<g class="mb-nv" data-keo="nv:${k}"><line x1="${v.x}" y1="${Y(v.y)}" x2="${v.x + Math.sin(g) * 20 * u}" y2="${Y(v.y + Math.cos(g) * 20 * u)}" stroke-width="${2.5 * u}"/><circle cx="${v.x}" cy="${Y(v.y)}" r="${11 * u}" fill="${o.mau}" stroke-width="${1.5 * u}"/><text x="${v.x}" y="${Y(v.y) + 4 * u}" font-size="${11 * u}">${esc(v.ten[0])}</text><title>${esc(v.ten)}</title></g>`; }).join('');
  const [dx, dy] = m.dat, [nx, ny] = m.nhin, a = Math.atan2(ny - dy, nx - dx), L = Math.max(260, Math.hypot(nx - dx, ny - dy) * 1.25), f = (NUA_GOC[c.ong] || 24) * Math.PI / 180;
  const p = (g) => `${dx + Math.cos(g) * L},${Y(dy + Math.sin(g) * L)}`;
  el.innerHTML = `<svg viewBox="${K.x} ${-K.y} ${K.w} ${K.h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Mặt bằng cảnh ${i + 1}">${nen}${vat}<polygon class="mb-thay" points="${dx},${Y(dy)} ${p(a - f)} ${p(a + f)}" stroke-width="${1.2 * u}"/><line class="mb-ngam" x1="${dx}" y1="${Y(dy)}" x2="${nx}" y2="${Y(ny)}" stroke-width="${1.2 * u}" stroke-dasharray="${5 * u} ${4 * u}"/>
    <circle class="mb-diem" data-keo="nhin" cx="${nx}" cy="${Y(ny)}" r="${7 * u}" stroke-width="${2 * u}"><title>Điểm ngắm</title></circle><g class="mb-may" data-keo="may" transform="translate(${dx} ${Y(dy)}) scale(${u})"><circle r="12"/><path d="M-7 -4.500h9v9h-9zM2 0l6 -4v8z"/><title>Máy quay</title></g></svg>
    <div class="mb-chan"><span class="nho">Cảnh ${i + 1} · ${esc(c.co || 'máy')}${c.ong ? ` · ống ${esc(c.ong.toLowerCase())}` : ''}</span>${c.ban3 ? '<button type="button" class="bt" data-d="dung3d">Dựng lại 3D</button>' : ''}</div>`;
}
/** các hàng của timeline: bản Gọn có 4 hàng cố định; Pro thêm hàng theo dữ liệu dự án có (đoạn, 3D, từng người nói, tiếng động, cảm xúc) */
function hangTl() {
  const p = pro(), r = [['thuoc', p ? 20 : 22, '']];
  if (p && D.canh.some((c) => c.pd)) r.push(['doan', 16, 'Đoạn']);
  if (!p || D.canh.some((c) => c.chu)) r.push(['chu', p ? 22 : 30, 'Chữ']); r.push(['hinh', p ? 46 : 58, 'Hình']);
  if (p && D.canh.some((c) => c.k3)) r.push(['k3', 22, '3D']);
  if (p && coLop()) r.push(['lp', 22, 'Lớp']);
  const ng = nguoiNoi(); if (p && ng.length) ng.forEach((n) => r.push([`noi:${n}`, 22, n])); else r.push(['giong', p ? 22 : 30, 'Lời đọc']);
  if (p && D.canh.some((c) => c.td)) r.push(['td', 22, 'Tiếng động']);
  r.push(['nhac', p ? 22 : 30, 'Nhạc']);
  if (p && D.canh.some((c) => c.cx)) r.push(['cx', 26, 'Cảm xúc']);
  return r;
}
function veTl() { veTlCong(); veTlClip(); }
function veTlClip() {
  const p = pro(), R = hangTl(), T = tong(), W = T * E.pxs, kc = p ? 3 : 4, buoc = E.pxs >= 34 ? 1 : E.pxs >= 16 ? 2 : E.pxs >= 9 ? 5 : 10, la = (id, l) => (E.chon?.id === id && (p ? id !== 'nhac' || l === 'nhac' : E.chon.loai === l) ? ' chon' : '');
  let vach = ''; for (let s = 0; s <= T; s += buoc) vach += `<span style="left:${s * E.pxs}px">${gio(s)}</span>`;
  const H = {}, them = (k, h) => { H[k] = (H[k] || '') + h; }, coNoi = p && nguoiNoi().length > 0; let x = 0, doan = null; const diem = [];
  const dongDoan = () => { if (doan) them('doan', `<div class="dn" style="left:${doan.x}px;width:${doan.w - 2}px">${esc(doan.k)}</div>`); };
  D.canh.forEach((c, i) => { const w = c.tg * E.pxs, st = `left:${x}px;width:${Math.max(4, w - 2)}px`, a = `role="button" tabindex="0" data-clip="${c.id}"`;
    if (c.pd && doan?.k === c.pd) doan.w += w; else { dongDoan(); doan = c.pd ? { k: c.pd, x, w } : null; }
    if (D.kieuChu !== 'Tắt chữ' && (c.chu || !p)) them('chu', `<div class="clip chu${la(c.id, 'chu')}" ${a} data-loai="chu" style="${st}"><span>${esc(c.chu) || '＋ chữ'}</span></div>`);
    them('hinh', `<div class="clip canh${la(c.id, 'canh')}${c.vid ? ' co-clip' : ''}" ${a} data-loai="canh" aria-label="Cảnh ${i + 1} ${esc(c.nhan)}, ${c.tg} giây${c.vid ? ', đã có clip' : ', chưa có clip'}" title="${i + 1} · ${esc(c.nhan)}${c.vid ? ' · đã có clip' : ' · chưa có clip (đang dùng ảnh)'}${GOC[c.id] ? `${tipAttr('anh', c.id)}${c.vid ? `&#10;&#10;CLIP${tipAttr('clip', c.id)}` : ''}` : ''}" style="${st};background-image:url('${c.anh}')"><b>${w < 76 ? i + 1 : `${i + 1} · ${esc(c.nhan)}`}</b>${w >= 44 ? `<i>${c.tg}s</i>` : ''}${c.vid ? '<em class="nhan-clip" aria-hidden="true">▶ clip</em>' : ''}${p && soLoi(c) ? '<u></u>' : ''}<span class="tay" data-tay="${c.id}"></span></div>`);
    if (c.k3) them('k3', `<div class="clip k3${c.ban3 ? ' loi' : ''}" ${a} data-loai="k3" title="Khung 3D cảnh ${i + 1}" style="${st};background-image:url('${c.k3}')"></div>`);
    if (c.lop) them('lp', `<div class="clip lp${la(c.id, 'lp')}" ${a} data-loai="lp" title="${c.lop.filter((l) => !['nam', 'tem', 'tu'].includes(l.k)).map((l) => l.ten).join(', ') || 'Chỉ có bản đồ'}" style="${st}">${c.lop.filter((l) => !['nam', 'tem', 'tu'].includes(l.k)).map((l) => ic(l.bt)).join('')}</div>`);
    if (coNoi) c.thoai.forEach((l) => them(`noi:${l.ai}`, `<div class="clip giong${la(c.id, 'giong')}${dai(c) ? ' loi' : ''}" ${a} data-loai="giong" style="${st}"${GOC[c.id] && xemQt() ? ` title="Lời đọc cảnh ${i + 1}${tipAttr('giong', c.id)}"` : ''}><span>${esc(l.cau)}</span></div>`));
    else if (c.loi || !p) them('giong', `<div class="clip giong${la(c.id, 'giong')}${dai(c) ? ' loi' : ''}" ${a} data-loai="giong" style="${st}"${GOC[c.id] && xemQt() ? ` title="Lời đọc cảnh ${i + 1}${tipAttr('giong', c.id)}"` : ''}><span>${esc(c.loi) || '＋ lời đọc'}</span></div>`);
    if (c.td) them('td', `<div class="clip td" ${a} data-loai="td" style="${st}"><span>${esc(c.td)}</span></div>`);
    diem.push([Math.round(x + w / 2), 21 - (c.cx / 3) * 16]); x += w; });
  dongDoan();
  H.hinh += `<button type="button" class="them" data-d="themCanh" style="left:${W + 4}px" aria-label="Thêm cảnh">＋</button>`;
  H.nhac = `<div class="clip nhac${la('nhac', 'nhac')}" role="button" tabindex="0" data-clip="nhac" data-loai="nhac" style="left:0;width:${W - 2}px"${D.that && xemQt() ? ` title="Nhạc nền${tipAttr('nhac')}"` : ''}><span>♪ ${esc(D.nhac)}${D.nhac === 'Không nhạc' ? '' : ` · ${D.am}%`}</span></div>`;
  H.cx = `<svg class="cx-ve" width="${Math.ceil(W)}" height="26" aria-hidden="true"><polyline points="${diem.map((d) => d.join(',')).join(' ')}"/>${diem.map(([a, b]) => `<circle cx="${a}" cy="${b}" r="2.5"/>`).join('')}</svg>`;
  const tpl = R.map((r) => `${r[1]}px`).join(' '), tr = $('#tlTrong'), nh = $('#tlNhan'); let y = 0; for (const r of R) { if (r[0] === 'hinh') break; y += r[1] + kc; }
  tr.style.width = `${W + 70}px`; tr.style.gridTemplateRows = tpl; tr.style.gap = `${kc}px`; nh.style.gridTemplateRows = tpl; nh.style.gap = `${kc}px`;
  nh.innerHTML = R.map(([k, , t]) => (k === 'thuoc' ? '<span></span>' : `<span title="${esc(t)}">${k.startsWith('noi:') ? `<i class="dau">${esc(t[0])}</i>` : ic(t)}<b>${esc(t)}</b></span>`)).join('');
  tr.innerHTML = R.map(([k]) => (k === 'thuoc' ? `<div class="thuoc" id="thuoc">${vach}</div>` : `<div class="track">${H[k] || ''}</div>`)).join('')
    + `<div class="kim" id="kim"><i></i></div><div class="tha" id="tha" hidden style="top:${y}px;height:${p ? 46 : 58}px"></div>`;
  veKim();
}
function veTlCong() {
  const p = pro(), c = canhChon(), n = (t, d, them = '') => (p ? `<button type="button" class="bt ic-bt" data-d="${d}" title="${t}" aria-label="${t}" ${them}>${ic(t)}</button>` : `<button type="button" class="bt" data-d="${d}" ${them}>${t === 'Tách' ? '✂ Tách tại kim' : t}</button>`);
  $('#tlCong').innerHTML = `${n('Tách', 'tach')}${n('Nhân đôi', 'nhanDoi', c ? '' : 'disabled')}${n('Xoá', 'xoa', c ? '' : 'disabled')}
    <span class="gian"></span><span class="so" id="tlGio"></span><button type="button" class="bt" data-d="vua">Vừa khung</button><input type="range" id="tlZoom" min="6" max="70" value="${Math.round(E.pxs)}" aria-label="Phóng to timeline">`;
}
function veKim(theo) {
  const k = $('#kim'); if (!k) return; k.style.left = `${E.t * E.pxs}px`;
  const g = `${gio(E.t)} / ${gio(tong())}`, tg = $('#tlGio'); if (tg) tg.textContent = g; $('#kGio').textContent = g;
  if (theo) { const cu = $('#tlCuon'), x = E.t * E.pxs; if (x > cu.scrollLeft + cu.clientWidth - 60 || x < cu.scrollLeft) cu.scrollLeft = Math.max(0, x - 40); }
}
function veKhung() {
  const T = tong(), { c, s } = canhTai(Math.min(E.t, T - 0.001)), p = Math.min(1, Math.max(0, (E.t - s) / c.tg)), a = $('#kA'), v = $('#kV');
  const ng = pro() && nguonCo().includes(E.nguon) ? E.nguon : 'anh', rieng = ng === 'clip' ? c.vid : ng === '3d' ? c.vid3 : null, src = rieng || (ng === 'clip' ? D.vid : ng === '3d' ? D.vid3 : null), tu0 = rieng ? (ng === 'clip' ? c.tuV : c.tu3) : c.tu, hopBat = pro() && E.hop && ng === '3d' && !E.chay && !!c.hop && Math.abs(E.t - s) < 0.05, coVid = !!src && tu0 != null && !hopBat, laLop = ng === 'lop' && !!c.lop, anh = laLop ? c.nen : ng === '3d' && c.k3 ? c.k3 : c.anh;
  $('#w-xem').style.setProperty('--r', TILE[D.tile]);
  if (a.dataset.src !== anh) { a.dataset.src = anh; a.src = anh; }
  a.style.transform = ng !== 'anh' && !(ng === 'lop' && !laLop) ? 'none' : { 'Phóng gần': `scale(${1 + 0.14 * p})`, 'Lùi xa': `scale(${1.14 - 0.14 * p})`, 'Lia ngang': `scale(1.12) translateX(${(p - 0.5) * 7}%)`, 'Đứng yên': 'none' }[c.cd];
  a.style.opacity = ng === 'anh' && E.chay && c.chuyen === 'Mờ dần' && s > 0 && E.t - s < 0.5 ? ((E.t - s) / 0.5).toFixed(2) : 1;
  v.hidden = !coVid;
  if (coVid) { if (v.dataset.src !== src) { v.dataset.src = src; v.src = src; } v.muted = ng === '3d' || E.tat; const d = tu0 + Math.min(E.t - s, c.tg);
    if (E.chay) { if (v.paused) { try { v.currentTime = d; } catch {} v.play().catch(() => {}); } else if (Math.abs(v.currentTime - d) > 0.35) v.currentTime = d; }
    else { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - d) > 0.04) { try { v.currentTime = d; } catch {} } }
  } else if (!v.paused) v.pause();
  const kl = laLop ? `${c.id}|${(c.an || []).join()}|${E.solo?.id === c.id ? E.solo.k : ''}` : '', L = $('#kLop');
  if (L.dataset.k !== kl) { L.dataset.k = kl; L.innerHTML = laLop ? c.lop.filter((l) => (E.solo?.id === c.id ? l.k === E.solo.k : !(c.an || []).includes(l.k))).map((l) => `<img src="${l.anh}" alt="">`).join('') : ''; }
  const chu = (ng === 'anh' || (ng === 'lop' && !laLop)) && D.kieuChu !== 'Tắt chữ' ? c.chu : '', ch = $('#kChu'); ch.textContent = chu; ch.className = `k-chu kc-${KCHU.indexOf(D.kieuChu)} kv-${VITRI.indexOf(c.viTri)}`;
  $('#kMo').hidden = !chu; $('#kVe').hidden = !c.ve;
  const hop = hopBat ? c.id : '', lop = $('#kHop');
  if (lop.dataset.k !== hop) { lop.dataset.k = hop; lop.innerHTML = hop ? Object.entries(c.hop).filter(([, b]) => b[2] - b[0] > 0.02).map(([t, b]) => `<div style="left:${b[0] * 100}%;top:${b[1] * 100}%;width:${(b[2] - b[0]) * 100}%;height:${(b[3] - b[1]) * 100}%"><span>${esc(t)}</span></div>`).join('') : ''; }
  veSs(c, s, ng);
  if (E.canhDang !== c.id) { E.canhDang = c.id; E.solo = null; if (pro()) { if (co('mb')) veMb(); if (co('lp')) veLp(); if (co('nk')) { E.nkMo = null; veNk(); } document.querySelectorAll('.pc-o.dang').forEach((x) => x.classList.remove('dang')); document.querySelector(`.pc-o[data-g="${c.id}"]`)?.classList.add('dang'); } }
}
// So sánh (góp ý #1714): các nguồn khác (Lớp / 3D / Ảnh / Clip) hiện cạnh khung chính, cùng cảnh, cùng thời điểm
function veSs(c, s, ng) {
  const k = $('#k'), vg = k.parentElement, ds = E.ss && pro() ? nguonCo().filter((n) => n !== ng) : [], key = ds.join();
  vg.classList.toggle('ss', ds.length > 0); vg.style.setProperty('--n', ds.length + 1); k.dataset.ten = ds.length ? TEN_NG[ng] : '';
  if (vg.dataset.ss !== key) { vg.dataset.ss = key; vg.querySelectorAll('.k-ss').forEach((x) => x.remove());
    ds.forEach((n) => vg.insertAdjacentHTML('beforeend', `<div class="k k-ss" data-ng="${n}" data-ten="${TEN_NG[n]}"><img alt=""><video playsinline muted preload="metadata" hidden></video></div>`)); }
  vg.querySelectorAll('.k-ss').forEach((o) => { const n = o.dataset.ng, a = o.querySelector('img'), v = o.querySelector('video');
    const rieng = n === 'clip' ? c.vid : n === '3d' ? c.vid3 : null, src = rieng || (n === 'clip' ? D.vid : n === '3d' ? D.vid3 : null), tu0 = rieng ? (n === 'clip' ? c.tuV : c.tu3) : c.tu, coVid = !!src && tu0 != null;
    const anh = n === 'lop' && c.nen ? c.nen : n === '3d' && c.k3 ? c.k3 : c.anh; if (a.dataset.src !== anh) { a.dataset.src = anh; a.src = anh; }
    v.hidden = !coVid; if (!coVid) { if (!v.paused) v.pause(); return; }
    if (v.dataset.src !== src) { v.dataset.src = src; v.src = src; } const d = tu0 + Math.min(E.t - s, c.tg);
    if (E.chay) { if (v.paused) { try { v.currentTime = d; } catch {} v.play().catch(() => {}); } else if (Math.abs(v.currentTime - d) > 0.35) v.currentTime = d; }
    else { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - d) > 0.04) { try { v.currentTime = d; } catch {} } } });
}
function vePhu() {
  const p = $('#dPhu'); p.hidden = !E.xuat && !E.tao && !E.doi; if (!E.xuat && !E.tao && !E.doi) { p.innerHTML = ''; return; } let h = '';
  if (E.doi) { const o = E.doi;
    h = `<h2>Đội và quyền dùng Studio 2</h2><span class="nho">Mặc định chưa ai trong đội dùng được phim thật. Cấp “Dùng” thì người đó tạo và làm video của riêng mình (không thấy phim của người khác). Cấp thêm “Bấm bước tốn tiền” thì họ chạy được máy viết, vẽ ảnh, giọng, clip, nhạc. Mỗi lượt bấm đều ghi sổ.</span>
    ${o.loi ? `<div class="bao">${esc(o.loi)}</div>` : ''}${!o.ds ? '<span class="nho">Đang đọc danh sách…</span>' : `<div class="doi-ds">${o.ds.map((m) => `<div class="doi-d"><span><b>${esc(m.ten)}</b><small>${m.role === 'admin' ? 'quản trị · đủ quyền' : `${m.role === 'viewer' ? 'chỉ xem' : 'thành viên'}${m.so_phim ? ` · ${m.so_phim} phim` : ''}`}</small></span>${m.role === 'admin' ? '' : `<button type="button" class="bt" data-d="doiDat" data-g="${m.user_id}" data-k="dung" aria-pressed="${m.dung}">Dùng</button><button type="button" class="bt" data-d="doiDat" data-g="${m.user_id}" data-k="sinh" aria-pressed="${m.sinh}" ${m.dung ? '' : 'disabled'}>Bấm bước tốn tiền</button>`}</div>`).join('')}</div>`}
    <div class="day-bt"><button type="button" class="bt" data-d="doiDong">Đóng</button></div>`; }
  if (E.tao) { const o = E.tao, g = o.goiDs?.find((x) => x.key === o.goi);
    h = `<h2>Tạo video mới trên studio</h2><div class="tt-tab tao-tab" role="tablist">${[['moi', 'Tạo mới'], ['tpl', 'Từ template']].map(([k, t]) => `<button type="button" role="tab" data-d="taoTab" data-g="${k}" aria-selected="${o.tab === k}">${t}</button>`).join('')}</div>`;
    if (o.tab === 'moi') h += `<label class="nho" for="taoTen">Tên video</label><input type="text" id="taoTen" value="${esc(o.ten)}" placeholder="Ví dụ: Vì sao tôi không sợ Sao Thổ quay về" autocomplete="off">
    <span class="nho">Thể loại${g ? `: <b>${esc(g.ten)}</b> · ${g.ti_le} · ${g.do_dai_s[0]}–${g.do_dai_s[1]} giây` : ' (chọn một gói của studio, hoặc để trống và chọn loại bên dưới)'}</span>
    <input type="text" id="taoTimGoi" value="${esc(o.timGoi)}" placeholder="Tìm thể loại: kinh dị, quảng cáo, giải thích…" autocomplete="off" aria-label="Tìm thể loại"><div class="tao-goi" id="taoGoi">${veGoiTao()}</div>
    ${g ? '' : `<span class="nho">Loại video</span><div class="day-bt">${[['short', 'Short video'], ['phim', 'Phim nhiều tập'], ['quang_cao', 'Quảng cáo']].map(([k, t]) => `<button type="button" class="bt" data-d="taoLoai" data-g="${k}" aria-pressed="${o.loai === k}">${t}</button>`).join('')}</div>`}
    <label class="nho" for="taoY">Ý tưởng (để sau cũng được)</label><textarea id="taoY" rows="3" placeholder="Bạn muốn chia sẻ điều gì về chiêm tinh, bạn nghĩ gì về nó">${esc(o.y)}</textarea>
    ${o.loi ? `<div class="bao">Studio không tạo được: ${esc(o.loi)}</div>` : ''}
    <div class="day-bt"><button type="button" class="bt chinh" data-d="taoChay" ${o.dang ? 'disabled' : ''}>${o.dang ? 'Đang tạo…' : 'Tạo video'}</button><button type="button" class="bt" data-d="taoDong">Thôi</button></div>
    <details class="nk-ct"><summary>Hoặc bắt đầu từ một mẫu dựng sẵn</summary><div class="tao-mau" id="taoMau">${veMauTao()}</div></details>
    <span class="nho">Tạo khung phim không tốn tiền. Phim nằm trong studio; tạo xong ở đây mở widget Quy trình để làm từng bước.${nguoiMoi() ? '' : ' <button type="button" class="lk" data-d="moTao">Xem lối 5 bước (bản bấm thử)</button>'}</span>`;
    else if (!o.tpl) h += `<span class="nho">Template là phim đã dựng sẵn kịch bản, cảnh, chữ; chỉ cần điền vài ô (sản phẩm, ưu đãi…) là ra phim mới. Tạo từ template không tốn tiền.</span>${o.loi ? `<div class="bao">${esc(o.loi)}</div>` : ''}
    ${!o.tplDs ? '<span class="nho">Đang đọc danh sách template…</span>' : !o.tplDs.length ? '<span class="nho">Studio chưa có template nào.</span>' : `<div class="tao-tpl">${o.tplDs.map((t) => `<button type="button" class="mn-da" data-d="taoTpl" data-g="${t.id}" title="${esc(t.mo_ta)}"><img src="${nho(t.anh, 160)}" alt="" loading="lazy"><span><b>${esc(t.ten.replace(/^Template · /, ''))}</b><small>${t.so_shot} cảnh</small></span></button>`).join('')}</div>`}
    <div class="day-bt"><button type="button" class="bt" data-d="taoDong">Thôi</button></div>`;
    else h += `<div class="day-bt"><button type="button" class="bt" data-d="taoTplLui">← Template khác</button><b class="tpl-ten">${esc(o.tpl.ten.replace(/^Template · /, ''))}</b></div>
    ${!o.tpl.o ? '<span class="nho">Đang đọc các ô cần điền…</span>' : `<label class="nho" for="tplTen">Tên phim mới</label><input type="text" id="tplTen" value="${esc(o.tpl.tenPhim)}" placeholder="Ví dụ: Bra không gọng · ưu đãi tháng 12" autocomplete="off">
      <div class="tpl-o">${o.tpl.o.map((x) => `<label class="nho" for="tplO-${esc(x.k)}">${esc(x.ten || x.k)}</label>${x.dai || /\n/.test(o.tpl.gt[x.k] || '') ? `<textarea id="tplO-${esc(x.k)}" data-tpl-o="${esc(x.k)}" rows="2" placeholder="${esc(x.goi_y || '')}">${esc(o.tpl.gt[x.k] || '')}</textarea>` : `<input type="text" id="tplO-${esc(x.k)}" data-tpl-o="${esc(x.k)}" value="${esc(o.tpl.gt[x.k] || '')}" placeholder="${esc(x.goi_y || '')}" autocomplete="off">`}`).join('')}</div>`}
    ${o.loi ? `<div class="bao">Studio không tạo được: ${esc(o.loi)}</div>` : ''}
    <div class="day-bt"><button type="button" class="bt chinh" data-d="taoTplChay" ${o.dang || !o.tpl.o ? 'disabled' : ''}>${o.dang ? 'Đang tạo…' : 'Tạo từ template'}</button><button type="button" class="bt" data-d="taoDong">Thôi</button></div>`; }
  if (E.xuat === 'that') { const x = E.xuatThat, t = D.that;
    h = `<h2>Xuất video</h2>${x?.tt === 'xong' && x.url ? `<video src="${esc(x.url)}" controls playsinline preload="metadata" style="aspect-ratio:${TILE[D.tile]}"></video><span class="nho">Bản vừa xuất nằm trong studio. <a href="${esc(x.url)}" target="_blank" rel="noopener">Mở tệp ↗</a></span>`
      : x?.tt === 'chay' ? `<p class="phu">Studio đang ghép video (lượt #${x.job})…</p><div class="thanh"><i style="width:60%"></i></div><span class="nho">Có thể đóng hộp này; xong thì bản mới hiện ở nguồn Clip.</span>`
      : `<span class="nho">Studio ghép các clip, giọng, nhạc, chữ của tập thành một tệp MP4. Mục nào trong Quy trình gác cổng xuất mà chưa đạt thì studio từ chối và nói rõ thiếu gì.</span>${t.xuatUrl ? `<span class="nho">Tập này đã có một bản xuất trước đó: <a href="${esc(t.xuatUrl)}" target="_blank" rel="noopener">mở ↗</a></span>` : ''}`}
    ${x?.tt === 'loi' ? `<div class="bao">Xuất hỏng: ${esc(x.loi)}</div>` : ''}<div class="qt-nut">${x?.tt === 'chay' ? '' : nutBuoc('xuat')}</div><div class="day-bt"><button type="button" class="bt" data-d="dong">Đóng</button></div>`; }
  if (E.xuat === 'kiem') { const cb = canhBao(), sua = D.canh.some((c) => dai(c));
    h = `<h2>${cb.length} chỗ nên xem trước khi xuất</h2><ul>${cb.slice(0, 6).map((x) => `<li>${esc(x)}</li>`).join('')}${cb.length > 6 ? `<li>và ${cb.length - 6} chỗ nữa</li>` : ''}</ul>
    <div class="day-bt">${sua ? '<button type="button" class="bt chinh" data-d="suaHet">Sửa giúp tôi</button>' : ''}<button type="button" class="bt" data-d="xuatChay">Vẫn xuất</button><button type="button" class="bt" data-d="dong">Quay lại sửa</button></div>`; }
  if (E.xuat === 'dang') h = `<h2>Đang làm video của bạn</h2><p class="phu" id="xChu">Đang khớp lời với từng cảnh…</p><div class="thanh"><i id="xThanh"></i></div><span class="nho">Bản thật mất khoảng một giờ; xong sẽ có tin báo kèm link. Trong lúc chờ bạn vẫn mở video khác ra làm được.</span>`;
  if (E.xuat === 'xong') h = `<h2>Video đã xong</h2><video src="${D.vid || VID(D.kieu)}" poster="${D.canh[0].anh}" controls playsinline preload="metadata" style="aspect-ratio:${D.vid ? TILE[D.tile] : 0.5625}"></video><span class="nho">${D.vid ? 'Đây là bản đã xuất của phim này trong studio.' : 'Đây là video mẫu của kiểu đang dùng; bản thật mang đúng timeline bạn vừa dựng.'}</span><div id="xTai"></div>
    <div class="day-bt"><button type="button" class="bt chinh" data-d="tai">⬇ Tải video</button><button type="button" class="bt" data-d="dong">Chưa ưng, sửa tiếp</button></div>`;
  p.innerHTML = `<div class="hop-phu${E.tao || E.doi ? ' rong' : ''}" role="dialog" aria-modal="true" aria-label="${E.doi ? 'Đội và quyền' : E.tao ? 'Tạo video mới' : 'Xuất video'}">${h}</div>`;
}

// ── phát
let rf = 0, moc = 0;
function nutChay() { const n = $('#kChay'); n.textContent = E.chay ? '❚❚ Dừng' : '▶ Phát'; n.setAttribute('aria-pressed', String(E.chay)); }
function dungChay() { E.chay = false; cancelAnimationFrame(rf); nutChay(); veKhung(); }
function chay() {
  if (E.chay) return dungChay(); if (E.t >= tong() - 0.05) E.t = 0; E.chay = true; moc = performance.now() - E.t * 1000; nutChay(); veKhung();
  const vong = (n) => { if (!E.chay) return; E.t = (n - moc) / 1000; if (E.t >= tong()) { E.t = tong(); veKim(true); return dungChay(); } veKhung(); veKim(true); rf = requestAnimationFrame(vong); };
  rf = requestAnimationFrame(vong);
}
function tua(t) { E.t = Math.max(0, Math.min(tong(), t)); if (E.chay) moc = performance.now() - E.t * 1000; veKhung(); veKim(); }
function chon(id, loai) {
  if (loai === 'k3') { loai = 'canh'; E.ttTab = 'hinh'; if (nguonCo().includes('3d')) E.nguon = '3d'; } else if (loai === 'lp') { loai = 'canh'; E.nguon = 'lop'; } else if (loai === 'td') { loai = 'giong'; E.ttTab = 'thoai'; }
  else if (loai !== 'canh') E.ttTab = 'thoai'; else if (E.ttTab === 'thoai') E.ttTab = 'may';
  E.chon = { id, loai }; E.moDoi = false; E.o = 'tt';
  if (id !== 'nhac') { const i = vt(id), s = batDau(i); if (E.t < s || E.t >= s + D.canh[i].tg) E.t = s + 0.001; }
  veD();
}
function vuaKhung() { const w = $('#tlCuon').clientWidth - 90; E.pxs = Math.max(6, Math.min(70, w / tong())); }

// ── hành động
function lamD(a, d = {}, nut) {
  const c = canhChon(), g = d.g;
  const doi = (f) => { ghi(); f(); veD(); };
  switch (a) {
    case 'tab': E.tab = g; E.moNv = false; return veTv();
    case 'o': E.o = g; return veD();
    case 'lui': return hoan(E.lui, E.toi);
    case 'toi': return hoan(E.toi, E.lui);
    case 'chay': return chay();
    case 'dau': dungChay(); return tua(0);
    case 'cuoi': dungChay(); return tua(tong());
    case 'boChon': E.chon = null; return veD();
    case 'loai': return chon(E.chon.id, g);
    case 'chonCanh': return chon(g, 'canh');
    case 'chonLoi': return chon(g, 'giong');
    case 'ttTab': E.ttTab = g; E.moDoi = false; return veTt();
    case 'menu': { const r = nut.getBoundingClientRect(); E.menu = E.menu?.loai === g ? null : { loai: g, r: { left: r.left, top: r.top, bottom: r.bottom } }; veTren(); veMenu(); if (E.menu?.loai === 'da' && E.kq === undefined) timPhim(); return; }
    case 'ban': dungChay(); E.ban = g; E.menu = null; luu(); E.nguon = nguonDau(); E.vua = false; return man('dung');
    case 'duAn': soMo++; E.dangMo = false; dungChay(); E.menu = null; moDuAn(g); E.vua = false; return man('dung');
    case 'phimThat': return void moPhimThat(g, d.k || null);
    case 'nguon': E.nguon = g; return veD();
    case 'ss': E.ss = !E.ss; return veD();
    case 'hopBat': E.hop = !E.hop; if (E.hop && E.nguon !== '3d' && nguonCo().includes('3d')) { dungChay(); E.nguon = '3d'; } return veD();
    case 'tat': E.tat = !E.tat; return veD();
    case 'lopAn': { const y = canhTai(Math.min(E.t, tong() - 0.001)).c; ghi(); y.an = y.an || []; const k = y.an.indexOf(g); if (k >= 0) y.an.splice(k, 1); else y.an.push(g); E.solo = null; E.nguon = 'lop'; dungChay(); return veD(); }
    case 'lopSolo': { const y = canhTai(Math.min(E.t, tong() - 0.001)).c; E.solo = E.solo?.id === y.id && E.solo.k === g ? null : { id: y.id, k: g }; E.nguon = 'lop'; dungChay(); return veD(); }
    case 'lopHet': { const y = canhTai(Math.min(E.t, tong() - 0.001)).c; if (y.an?.length) { ghi(); y.an = []; } E.solo = null; return veD(); }
    case 'tabMo': { const gr = (E.luoi.nhom?.[D.loai] || []).find((x) => x.ds.includes(g)); if (gr && gr.mo !== g) { gr.mo = g; luu(); veD(); } return; }
    case 'tabTach': return tachTab(g);
    case 'wg': { delete E.luoi.ten[D.loai]; const ds = E.bc[D.loai], i = ds.indexOf(g); if (i >= 0) ds.splice(i, 1); else ds.splice(g === 'tt' || g === 'mb' || g === 'lp' || g === 'nk' || g === 'qt' ? (ds.includes('tt') && g !== 'tt' ? ds.indexOf('tt') : ds.length) : Math.max(0, ds.indexOf('xem')), 0, g); luu(); return veD(); }
    case 'wgDi': { if (luoiBat() && GS) { ghiLuoi(); delete E.luoi.ten[D.loai]; } const ds = E.bc[D.loai], vi = E.luoi.vi[D.loai], hien = luoiBat() && vi ? boCuc().filter((w) => vi[w]).sort((a, b) => vi[a].y - vi[b].y || vi[a].x - vi[b].x) : boCuc(), kia = hien[hien.indexOf(g) + +d.k]; if (!kia) return;
      if (luoiBat() && vi) [vi[g], vi[kia]] = [vi[kia], vi[g]]; else { const i = ds.indexOf(g), j = ds.indexOf(kia); [ds[i], ds[j]] = [ds[j], ds[i]]; } luu(); veD(); return document.querySelector(`.w-ten[data-wg="${g}"]`)?.focus(); }
    case 'buoc': return void chayBuoc(g);
    case 'qtMo': E.qtMo = E.qtMo === g ? '-' : g; return veQt();
    case 'qtTai': E.loiBuoc = null; return void taiLai(true);
    case 'qtGiay': E.kb.giay = +g; return veQt();
    case 'csThem': if (E.cs.nguoi.length < 3) E.cs.nguoi.push({}); return veQt();
    case 'qtBat': { const ds = E.bc[D.loai]; if (!ds.includes('qt')) ds.unshift('qt'); delete E.luoi.ten[D.loai]; luu(); return veD(); }
    case 'taoThat': dungChay(); E.menu = null; E.xuat = null; E.tao = { ten: '', loai: 'short', y: '', dang: false, loi: '', mau: null, mauCho: '', tab: 'moi', goi: '', goiDs: null, timGoi: '', tplDs: null, tpl: null }; vePhu(); goi('dsGoiTheLoai').then((ds) => { if (E.tao) { E.tao.goiDs = ds || []; const o = $('#taoGoi'); if (o) o.innerHTML = veGoiTao(); } }).catch(() => { if (E.tao) E.tao.goiDs = []; }); veTren(); veMenu(); $('#taoTen')?.focus(); goi('dsMauPhim').then((ds) => { if (E.tao) { E.tao.mau = ds || []; const o = $('#taoMau'); if (o) o.innerHTML = veMauTao(); } }).catch(() => { if (E.tao) E.tao.mau = []; }); return;
    case 'nhuMoi': E.nhuMoi = !E.nhuMoi; E.menu = null; E.kq = undefined; E.tim = ''; luu(); if (E.nhuMoi) return void veNhaMoi(); if (D.trongTrang) { moDuAn('cn'); return man('dung'); } return veD();
    case 'luuVe': return void luuVeStudio();
    case 'boSua': return void taiLai(true);
    case 'doiMo': E.menu = null; E.doi = { ds: null, loi: '' }; veTren(); veMenu(); vePhu(); return void napDoi();
    case 'doiDat': { const m = E.doi?.ds?.find((x) => x.user_id === +g); if (!m) return; const dung = d.k === 'dung' ? !m.dung : m.dung || true, sinh = d.k === 'sinh' ? !m.sinh : m.sinh; ghiSv('datQuyenS2', m.user_id, dung, dung && sinh).then(napDoi).catch((e) => { E.doi.loi = e.message; vePhu(); }); return; }
    case 'doiDong': E.doi = null; return vePhu();
    case 'taoTab': E.tao.tab = g; E.tao.loi = ''; vePhu(); if (g === 'tpl' && !E.tao.tplDs) goi('dsTemplateS2').then((ds) => { if (E.tao) { E.tao.tplDs = ds || []; vePhu(); } }).catch((e) => { if (E.tao) { E.tao.tplDs = []; E.tao.loi = e.message; vePhu(); } }); return;
    case 'taoGoi': E.tao.goi = E.tao.goi === g ? '' : g; return vePhu();
    case 'taoTpl': E.tao.tpl = { id: +g, ten: E.tao.tplDs.find((x) => x.id === +g)?.ten || '', o: null, gt: {}, tenPhim: '' }; vePhu(); goi('docTemplate', +g).then((r) => { if (!E.tao?.tpl || E.tao.tpl.id !== +g) return; if (!r?.ok) { E.tao.loi = r?.loi || 'không đọc được template'; E.tao.tpl = null; return vePhu(); } E.tao.tpl.o = r.data.o.filter((o) => o.dung); for (const o of E.tao.tpl.o) E.tao.tpl.gt[o.k] = o.mau || ''; vePhu(); }).catch((e) => { if (E.tao) { E.tao.loi = e.message; E.tao.tpl = null; vePhu(); } }); return;
    case 'taoTplLui': E.tao.tpl = null; E.tao.loi = ''; return vePhu();
    case 'taoTplChay': return void taoTuTemplate();
    case 'taoLoai': E.tao.loai = g; document.querySelectorAll('[data-d=taoLoai]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.g === g))); return;
    case 'taoChay': return void taoVideo(null);
    case 'taoMau': if (E.tao.mauCho !== g) { E.tao.mauCho = g; $('#taoMau').innerHTML = veMauTao(); return; } return void taoVideo(g);
    case 'taoDong': E.tao = null; return vePhu();
    case 'nkBuoc': E.nkBuoc = g; E.nkMo = null; luu(); return veNk();
    case 'nkMo': E.nkMo = E.nkMo === +g ? null : +g; veNk(); if (E.nkMo) napNkCanh(); return;
    case 'hdBat': { const ds = E.bc[D.loai]; if (!ds.includes('hd')) ds.splice(ds.includes('tt') ? ds.indexOf('tt') : ds.length, 0, 'hd'); delete E.luoi.ten[D.loai]; luu(); return veD(); }
    case 'qtXem': E.qtXem = !E.qtXem; luu(); if (E.qtXem) napHd(true); veTren(); veTlClip(); if (co('qt')) veQt(); return bao(E.qtXem ? 'Đã bật chế độ quản trị: rê chuột vào ảnh, clip, lời đọc, nhạc, ảnh mẫu để xem tiền thật.' : 'Đã tắt chế độ quản trị: giao diện như mọi người.');
    case 'cnBat': { const ds = E.bc[D.loai]; if (!ds.includes('cn')) ds.splice(ds.includes('tt') ? ds.indexOf('tt') : ds.length, 0, 'cn'); delete E.luoi.ten[D.loai]; luu(); return veD(); }
    case 'cnGoi': E.cn = { ...(E.cn || {}), goi: g }; return veCn();
    case 'hdLoc': E.hdLoc = g; return veHd();
    case 'hdTai': return void napHd(true);
    case 'slMo': E.sl = E.sl?.k === g ? null : { k: g, yc: '' }; veBuoc(); return void document.querySelector('#slYc')?.focus();
    case 'slThoi': E.sl = null; return veBuoc();
    case 'slChay': { E.slYc = (document.querySelector('#slYc')?.value || '').trim(); E.sl = null; E.cho = g; return void chayBuoc(g); }
    case 'nkBat': { const ds = E.bc[D.loai]; if (!ds.includes('nk')) ds.splice(ds.includes('tt') ? ds.indexOf('tt') : ds.length, 0, 'nk'); if (g) E.nkBuoc = g; luu(); return veD(); }
    case 'bcMau': E.bc[D.loai] = [...BC_MAU[g]]; if (E.luoi.nhom) delete E.luoi.nhom[D.loai]; delete E.luoi.ten[D.loai]; if (g === D.loai) delete E.luoi.vi[D.loai]; else { E.luoi.vi[D.loai] = viMau(g); E.luoi.ten[D.loai] = g; } luu(); return veD();
    case 'luoi': E.luoi.n = +g; tatLuoi(); luu(); return veD();
    case 'luoiHien': E.luoi.hien = !E.luoi.hien; luu(); return veD();
    case 'luoiLai': delete E.luoi.ten[D.loai]; E.luoi.vi[D.loai] = luoiMau(boCuc(), 24, 16); luu(); return veD();
    case 'moTao': dungChay(); E.menu = null; E.tao = null; vePhu(); return man('tao');
    case 'veDung': return man('dung');
    case 'moDung': { const hm = HINH.find((h) => h[0] === S.hinh)?.[1];
      D = duAnTu(S.kieu, { ai: S.ai, mo: S.mo, ych: S.ych, ket: S.ket, hinhMa: hm, ten: S.y.trim(), giong: S.giong, nhac: S.nhac }); E.da = null; E.nguon = 'anh'; E.lui = []; E.toi = []; E.chon = null; E.t = 0; E.vua = false; return man('dung'); }
    case 'mau': { const k = KIEU.find((x) => x.ma === g); ghi(); D = duAnTu(g, { giong: D.giong, nhac: D.nhac }); E.chon = null; E.t = 0; E.nguon = 'anh'; vuaKhung(); veD(); return bao(`Đã dựng lại theo mẫu “${k.ten}”.`, true); }
    case 'themCanh': if (D.that && a === 'themCanh') { if (coSua()) return bao('Có chỗ sửa chưa lưu. Bấm “Lưu về studio” trước rồi thêm cảnh.', false, 9000); return void ghiSv('themCanh', D.that.tap).then(() => taiLai(true)).then(() => { const c = D.canh[D.canh.length - 1]; if (c) { chon(c.id, 'hinh'); tua(batDau(D.canh.length - 1)); } bao('Đã thêm một cảnh trống vào tập trên studio.'); }).catch((e) => bao(`Studio không thêm được cảnh: ${e.message}`, false, 12000)); }
    // falls through
    case 'hinh': case 'veHinh': {
      const mo = a === 'veHinh' ? $('#tvMoTa').value.trim() : ''; if (a === 'veHinh' && !mo) { $('#tvMoTa').focus(); return bao('Gõ vài chữ tả hình bạn cần rồi bấm lại.'); }
      const sau = c ? vt(c.id) : D.canh.length - 1, moi = canhMoi({ nhan: `Cảnh ${D.canh.length + 1}`, anh: a === 'hinh' ? g : D.canh[sau].anh, mota: mo, ve: a === 'veHinh', tg: 5, pd: D.canh[sau].pd });
      ghi(); D.canh.splice(sau + 1, 0, moi); chon(moi.id, 'canh');
      if (a === 'veHinh') veXongCanh(moi.id, 'Bản thật vẽ hình theo lời tả, đúng nét của mẫu đang dùng.');
      return; }
    case 'uvChon': if (D.that && c && GOC[c.id]) return void ghiSv('chonKeyframe', GOC[c.id].id, g).then(() => taiLai(true), (e) => bao(`Studio không đổi được ảnh: ${e.message}`, false, 8000)); return;
    case 'veLai': if (D.that && c && GOC[c.id]) return void chayBuoc(`kf1:${c.id}`); if (!c || c.ve) return; ghi(); c.ve = true; veD(); return veXongCanh(c.id, 'Bản thật vẽ lại riêng cảnh này, nhân vật giữ nguyên vẻ ngoài.');
    case 'dungClip': if (D.that && c && GOC[c.id]) return void chayBuoc(`clip1:${c.id}`); return bao('Bản thật dựng lại clip của riêng cảnh này và thêm thành một bản dựng mới.');
    case 'banPb': return bao('Bản thật đổi cảnh sang bản dựng đó, các cảnh khác giữ nguyên.');
    case 'dung3d': { const y = c || canhTai(Math.min(E.t, tong() - 0.001)).c; bao('Bản thật dựng lại khung 3D theo mặt bằng mới trong vài giây.'); setTimeout(() => { y.ban3 = false; veD(); }, 1200); return; }
    case 'boSoi': return doi(() => { c.soi.splice(+g, 1); });
    case 'themThoai': return doi(() => { c.thoai.push({ ai: nguoiNoi()[0], cau: '' }); c.khop = null; });
    case 'dat': return doi(() => { const k = d.k; c[k] = k === 'cx' ? +g : c[k] === g ? '' : g; if (k === 'ong' && c.m3) c.ban3 = true; });
    case 'moDoi': E.moDoi = !E.moDoi; return veTt();
    case 'doiHinh': return doi(() => { c.anh = g; });
    case 'cd': return doi(() => { c.cd = g; });
    case 'chuyen': return doi(() => { c.chuyen = g; });
    case 'viTri': return doi(() => { c.viTri = g; });
    case 'nvCanh': return doi(() => { const i = c.nv.indexOf(g); if (i >= 0) c.nv.splice(i, 1); else c.nv.push(g); });
    case 'tg': return doi(() => { c.tg = Math.max(1, Math.min(30, lam2(c.tg + +g))); });
    case 'doiCho': return doi(() => { const i = vt(c.id); D.canh.splice(i, 1); D.canh.splice(i + +g, 0, c); });
    case 'vuaLoi': return doi(() => { c.tg = canDai(c); });
    case 'suaHet': ghi(); D.canh.forEach((x) => { if (dai(x)) x.tg = canDai(x); }); if (E.xuat) E.xuat = canhBao().length ? 'kiem' : 'dang'; veD(); if (E.xuat === 'dang') chayXuat(); return bao('Đã kéo dài các cảnh cho vừa lời đọc.', true);
    case 'nganLoi': { const m = c.loi.match(/^.*?[.?!](\s|$)/); if (!m || m[0].trim() === c.loi.trim()) return bao('Lời này đã là một câu. Bản thật viết lại cho gọn hơn mà vẫn giữ ý.'); return doi(() => { c.loi = m[0].trim(); c.khop = null; }); }
    case 'goiY': { const k = KIEU.find((x) => x.ma === D.kieu), ds = NHOM[k.nhom].mo(D.nvs[0]?.ten || tenAi(NHOM[k.nhom].chon[0])); return doi(() => { c.loi = ds[(ds.indexOf(c.loi) + 1) % ds.length]; c.khop = null; }); }
    case 'kchu': return doi(() => { D.kieuChu = g; });
    case 'giong': return doi(() => { D.giong = g; });
    case 'toc': return doi(() => { D.toc = g; });
    case 'nhac': return doi(() => { D.nhac = g; });
    case 'tile': return doi(() => { D.tile = g; });
    case 'nghe': return bao('Bản bấm thử chưa có tiếng mẫu. Bản thật phát mẫu 5 giây.');
    case 'moNv': E.moNv = true; return veTv();
    case 'themNv': return doi(() => { D.nvs.push({ id: g, ten: KHO_NV.find(([i]) => i === g)[1], vai: 'Nhân vật', mo: '' }); E.moNv = false; });
    case 'boNv': return doi(() => { D.nvs = D.nvs.filter((n) => n.id !== g); D.canh.forEach((x) => { x.nv = x.nv.filter((n) => n !== g); }); });
    case 'veNv': return bao('Bản thật vẽ lại theo lời tả, rồi cập nhật mọi cảnh có nhân vật hay đồ vật này.');
    case 'tach': { const { c: x, i, s } = canhTai(Math.min(E.t, tong() - 0.001)), o = Math.round((E.t - s) * 10) / 10;
      if (o < 0.5 || x.tg - o < 0.5) return bao('Đặt kim vào giữa một cảnh, cách hai mép ít nhất nửa giây, rồi bấm Tách.');
      ghi(); const w = x.loi.split(/\s+/).filter(Boolean), k = Math.round(w.length * o / x.tg), sau = canhMoi({ ...x, id: idMoi(), nv: [...x.nv], thoai: [], soi: [], nhan: `${x.nhan} (tiếp)`, loi: w.slice(k).join(' '), tg: lam2(x.tg - o), tu: x.tu != null ? lam2(x.tu + o) : undefined, tuV: x.vid ? lam2(x.tuV + o) : undefined, tu3: x.vid3 ? lam2(x.tu3 + o) : undefined, khop: null });
      if (x.thoai.length) sau.loi = ''; else x.loi = w.slice(0, k).join(' '); x.tg = o; x.khop = null; D.canh.splice(i + 1, 0, sau); E.chon = { id: sau.id, loai: 'canh' }; return veD(); }
    case 'nhanDoi': if (!c) return; ghi(); { const b = canhMoi({ ...JSON.parse(JSON.stringify(c)), id: idMoi() }); D.canh.splice(vt(c.id) + 1, 0, b); E.chon = { id: b.id, loai: 'canh' }; } return veD();
    case 'xoa': if (!c) return;
      if (E.chon.loai === 'chu') return doi(() => { c.chu = ''; });
      if (E.chon.loai === 'giong') return doi(() => { c.loi = ''; c.thoai = []; c.khop = null; });
      if (D.canh.length < 2) return bao('Video cần ít nhất một cảnh.');
      ghi(); D.canh.splice(vt(c.id), 1); E.chon = null; E.t = Math.min(E.t, tong()); veD(); return bao(`Đã xoá cảnh “${c.nhan}”.`, true);
    case 'vua': vuaKhung(); return veTl();
    case 'xuat': dungChay(); if (D.that) { E.xuat = 'that'; return vePhu(); } E.xuat = canhBao().length ? 'kiem' : 'dang'; vePhu(); if (E.xuat === 'dang') chayXuat(); return;
    case 'xuatChay': E.xuat = 'dang'; vePhu(); return chayXuat();
    case 'dong': E.xuat = null; return vePhu();
    case 'tai': $('#xTai').innerHTML = '<div class="bao">Bản bấm thử không tải được tệp. Ở bản thật, nút này tải video, ảnh bìa và lời giới thiệu.</div>'; return;
  }
}
function veXongCanh(id, chu) { bao(chu); setTimeout(() => { const x = canh(id); if (!x) return; const k = khoHinh(); x.ve = false; x.anh = k[(k.indexOf(x.anh) + 1) % k.length]; veD(); }, 1500); }
function chayXuat() {
  const chu = ['Đang khớp lời với từng cảnh…', 'Đang vẽ và dựng hình…', 'Đang đọc lời và ghép nhạc…', 'Đang kiểm lại lần cuối…']; let i = 0;
  const t = setInterval(() => { if (E.xuat !== 'dang') return clearInterval(t); i++; const th = $('#xThanh'); if (th) th.style.width = `${i * 25}%`; const x = $('#xChu'); if (x && chu[i]) x.textContent = chu[i];
    if (i >= 4) { clearInterval(t); E.xuat = 'xong'; vePhu(); } }, 700);
}
function man(m) {
  E.man = m; $('#dung').hidden = m !== 'dung'; $('#tao').hidden = m !== 'tao'; document.documentElement.classList.toggle('dung-mo', m === 'dung'); window.scrollTo({ top: 0 });
  if (m === 'tao') { Object.assign(S, { b: 1, y: '', thamKhao: '', kieu: null, ai: null, luot: 0, mo: null, moTu: '', ych: [], ket: null, cau: 0, hinh: null, giong: null, nhac: null, xong: false, dang: false, chuaUng: false, max: 1, thay: {} }); return ve(); }
  $('#dung').classList.toggle('pro', pro()); if (!E.vua) { E.vua = true; veBoCuc(); vuaKhung(); } veD();
}

// ── timeline: bấm chọn · kéo cảnh đổi thứ tự · kéo mép phải đổi độ dài · bấm / kéo thước để tua
let keo = null;
const cuon = $('#tlCuon'), xT = (e) => e.clientX - $('#tlTrong').getBoundingClientRect().left;
function denDau(id, dx) { const i0 = vt(id), tam = (batDau(i0) + D.canh[i0].tg / 2) * E.pxs + dx; let den = 0, x = 0; D.canh.forEach((c, i) => { if (i !== i0 && tam > (x + c.tg / 2) * E.pxs) den++; x += c.tg; }); return den; }
cuon.addEventListener('pointerdown', (e) => {
  if (e.button || e.target.closest('[data-d]')) return;
  const tay = e.target.closest('[data-tay]'), cl = e.target.closest('[data-clip]');
  if (tay) { const c = canh(tay.dataset.tay); ghi(); E.chon = { id: c.id, loai: 'canh' }; keo = { loai: 'cat', c, x0: e.clientX, tg0: c.tg }; }
  else if (cl) keo = { loai: cl.dataset.loai === 'canh' ? 'doi' : 'bam', id: cl.dataset.clip, l: cl.dataset.loai, x0: e.clientX, el: cl, dong: false };
  else { keo = { loai: 'tua' }; dungChay(); tua(xT(e) / E.pxs); }
  try { cuon.setPointerCapture(e.pointerId); } catch {}
});
cuon.addEventListener('pointermove', (e) => {
  if (!keo) return; const dx = e.clientX - keo.x0;
  if (keo.loai === 'tua') tua(xT(e) / E.pxs);
  else if (keo.loai === 'cat') { keo.c.tg = Math.max(1, Math.min(30, Math.round((keo.tg0 + dx / E.pxs) * 2) / 2)); veTlClip(); veKhung(); }
  else if (keo.loai === 'doi' && (keo.dong || Math.abs(dx) > 6)) { keo.dong = true; keo.el.style.transform = `translateX(${dx}px)`; keo.el.classList.add('dang-keo');
    keo.den = denDau(keo.id, dx); const i0 = vt(keo.id), j = keo.den < i0 ? keo.den : keo.den + 1, th = $('#tha'); th.hidden = false; th.style.left = `${batDau(j) * E.pxs - 2}px`; }
});
const tha = () => { if (!keo) return; const k = keo; keo = null;
  if (k.loai === 'cat') return veD();
  if (k.loai === 'doi' && k.dong) { const i0 = vt(k.id); if (k.den !== i0) { ghi(); const [c] = D.canh.splice(i0, 1); D.canh.splice(k.den, 0, c); } E.chon = { id: k.id, loai: 'canh' }; return veD(); }
  if (k.loai === 'doi' || k.loai === 'bam') chon(k.id, k.l); };
cuon.addEventListener('pointerup', tha);
cuon.addEventListener('pointercancel', () => { const k = keo; keo = null; if (k && (k.loai === 'cat' || k.dong)) veD(); });

// ── mặt bằng: kéo người, máy quay, điểm ngắm
let keoMb = null;
const mbEl = $('#dMb'), toaDo = (e) => { const s = mbEl.querySelector('svg'), p = new DOMPoint(e.clientX, e.clientY).matrixTransform(s.getScreenCTM().inverse()); return [Math.round(p.x), Math.round(-p.y)]; };
mbEl.addEventListener('pointerdown', (e) => { const k = e.target.closest('[data-keo]'); if (!k) return; dungChay(); keoMb = { k: k.dataset.keo, c: canhTai(Math.min(E.t, tong() - 0.001)).c, da: false }; try { mbEl.setPointerCapture(e.pointerId); } catch {} e.preventDefault(); });
mbEl.addEventListener('pointermove', (e) => { if (!keoMb) return; const [x, y] = toaDo(e), m = keoMb.c.m3; if (!keoMb.da) { ghi(); keoMb.da = true; keoMb.c.ban3 = true; }
  if (keoMb.k === 'may') m.dat = [x, y]; else if (keoMb.k === 'nhin') m.nhin = [x, y]; else { const v = m.vt[+keoMb.k.slice(3)]; v.x = x; v.y = y; } veMb(); });
const thaMb = () => { if (!keoMb) return; const da = keoMb.da; keoMb = null; if (da) veD(); };
mbEl.addEventListener('pointerup', thaMb); mbEl.addEventListener('pointercancel', thaMb);

document.addEventListener('keydown', (e) => {
  if (E.man !== 'dung') return; const a = document.activeElement, go = a && /INPUT|TEXTAREA|SELECT/.test(a.tagName), m = e.metaKey || e.ctrlKey;
  if (a?.dataset?.wg && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); return lamD('wgDi', { g: a.dataset.wg, k: e.key === 'ArrowLeft' ? -1 : 1 }); }
  if (e.key === 'Escape' && E.menu) { E.menu = null; veTren(); return veMenu(); }
  if (e.key === 'Escape' && E.xuat) return lamD('dong');
  if (go || E.xuat) return;
  if (e.key === 'Enter' && a?.dataset.clip) { e.preventDefault(); return chon(a.dataset.clip, a.dataset.loai); }
  if (e.key === ' ' && a?.tagName !== 'BUTTON') { e.preventDefault(); return chay(); }
  if (m && e.key.toLowerCase() === 'z') { e.preventDefault(); return lamD(e.shiftKey ? 'toi' : 'lui'); }
  if (m && e.key.toLowerCase() === 'b') { e.preventDefault(); return lamD('tach'); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && canhChon()) { e.preventDefault(); return lamD('xoa'); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); dungChay(); tua(E.t + (e.key === 'ArrowLeft' ? -1 : 1)); }
});
document.addEventListener('toggle', (e) => { if (e.target.id === 'iThem') E.moThem = e.target.open; }, true);
document.addEventListener('focusin', (e) => { if (e.target.dataset?.f) E.dangGo = false; });
window.addEventListener('resize', () => { if (E.menu) { E.menu = null; veTren(); veMenu(); } if (E.man === 'dung') { veBoCuc(); if (GS) GS.cellHeight(caoO()); } });
/** ô gõ của trình dựng: sửa thẳng vào dự án, không vẽ lại bảng đang gõ (giữ con trỏ) */
function goD(t) {
  const f = t.dataset.f, c = canhChon(); if (!E.dangGo) { ghi(); E.dangGo = true; const n = document.querySelector('#dTren [data-d=lui]'); if (n) n.disabled = false; }
  if (D.that) setTimeout(veLuu, 0);
  if (f === 'ten') { D.ten = t.value; const b = document.querySelector('.da-nut b'); if (b) b.textContent = D.ten; }
  else if (f === 'am') { D.am = +t.value; $('#iAmSo').textContent = D.am; }
  else if (f === 'nhoLai') D.nhoLai = t.checked;
  else if (f === 'nvmo') D.nvs.find((n) => n.id === t.dataset.id).mo = t.value;
  else if (f === 'thoai' && c) { c.thoai[+t.dataset.i].cau = t.value; c.loi = c.thoai.map((l) => l.cau).join(' '); c.khop = null; $('#iCb').innerHTML = veCb(c); }
  else if (c) { c[f] = t.value; if (f === 'loi') { c.khop = null; $('#iCb').innerHTML = veCb(c); } }
  veTlClip(); veKhung(); if (pro() && co('kb') && (f === 'loi' || f === 'thoai')) veKb();
}
for (const k in DU_AN) { const p = DU_AN[k].tao(); Object.assign(DU_AN[k], { ten: p.ten, loai: p.loai, so: p.canh.length, dai: p.canh.reduce((a, c) => a + c.tg, 0) }); }
// link có &nk=<bước>: bật widget Nhật ký ở bước đó (đặt ở đây vì BUOC_NK khai sau khối đọc URL đầu tệp)
goi('toiS2').then((t) => { E.nguoi = t; if (!laQtThat()) E.nhuMoi = false; if (nguoiMoi() && !D.that && (D.trongTrang || !E.dangMo)) return void veNhaMoi(); if (E.man === 'dung') { veTren(); veMenu(); if (co('qt')) veQt(); } }).catch(() => { if (D.trongTrang) { E.dangMo = false; veD(); } });   // ai đang dùng + quyền (để ẩn thứ chỉ quản trị làm được; máy chủ vẫn tự chặn)
try { const bc = new URLSearchParams(location.search).get('bc'); if (BO_CUC[bc]) E.bcUrl = bc; } catch {}   // link có &bc=<tên bố cục đặt sẵn>: áp bố cục đó khi phim mở xong
try { const nk = new URLSearchParams(location.search).get('nk'); if (BUOC_NK.some((x) => x[0] === nk)) { E.nkBuoc = nk; for (const k in E.bc) if (!E.bc[k].includes('nk')) E.bc[k].splice(E.bc[k].includes('tt') ? E.bc[k].indexOf('tt') : E.bc[k].length, 0, 'nk'); } } catch {}
if (E.nhuMoi && DU_AN[E.da]) { D = duAnTrong(); E.da = null; E.tap = null; E.dangMo = true; }
else if (DU_AN[E.da]) { moDuAn(E.da); if (BO_CUC[E.bcUrl] && E.bcUrl !== D.loai) { E.bc[D.loai] = [...BC_MAU[E.bcUrl]]; E.luoi.vi[D.loai] = viMau(E.bcUrl); E.luoi.ten[D.loai] = E.bcUrl; if (E.luoi.nhom) delete E.luoi.nhom[D.loai]; } E.bcUrl = ''; } else moPhimThat(E.da, E.tap, true);

// GÓP Ý = hòm chuẩn mos2 (packages/gop-y/CHUAN.md): index.html nạp script https://mos2.on.tc/api/gop-y-ngoai/nut, nút 💬 trên thanh trên mang data-gop-y-mo.
// Hòm đọc hàm này lúc mở để card mang đúng chỗ người gửi đang đứng (phim, tập, bản, bố cục, cảnh đang chọn, bước đang chạy / vừa bị từ chối).
window.__nguCanhTrang = () => { const t = D.that, c = E.chon && E.chon.id !== 'nhac' ? D.canh.findIndex((x) => x.id === E.chon.id) + 1 : 0, dang = Object.keys(E.dangBuoc || {});
  return [`Studio 2 · bản ${E.ban === 'pro' ? 'Pro' : 'Gọn'}${nguoiMoi() ? ' · đang xem như người mới' : ''}`, t ? `phim #${t.phim} "${D.ten}" · tập ${t.tap} · ${D.canh.length} cảnh` : `phim mẫu "${D.ten}"`,
    E.luoi?.ten?.[D.loai] ? `bố cục: ${E.luoi.ten[D.loai]}` : '', c ? `đang chọn cảnh ${c}` : '', t && E.qtMo ? `mục quy trình đang mở: ${E.qtMo}` : '', dang.length ? `bước đang chạy: ${dang.join(', ')}` : '',
    E.loiBuoc ? `studio vừa từ chối bước ${E.loiBuoc.k}: ${E.loiBuoc.loi}` : ''].filter(Boolean).join(' · ').slice(0, 1000); };

document.addEventListener('change', (e) => { if (e.target.dataset?.f === 'nhoLai') goD(e.target); });
man('dung');

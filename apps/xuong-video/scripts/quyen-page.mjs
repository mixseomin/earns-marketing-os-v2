#!/usr/bin/env node
// QUYỀN TRÊN TỪNG FACEBOOK PAGE của htuan82 — ai đang quản lý, quyền gì, Page từng đổi tên chưa.
//
// VÌ SAO PHẢI ĐỌC BẰNG TRÌNH DUYỆT (08/11/2026, anh phát hiện): Graph API `/{page}/roles` chỉ đọc vai trò Page KIỂU CŨ.
// Cả 73 Page của htuan82 đã chuyển sang Page dạng mới → /roles trả về đúng MỘT người (chủ token) kể cả khi Page có 5 người.
// Page YNT (117108601281444) là ca lộ ra lỗi này: /roles báo 1 người, thực tế 5 người, trong đó Sơn Nguyễn có Page Deletion +
// Permissions (ngang chủ Page). `/assigned_users` cũng không thay được: Facebook đòi quyền business_management mà app htuan82
// không có. Nên đường DUY NHẤT là mục Page access trong cài đặt của chính Page, đi bằng trình duyệt.
//
// Kết quả ghi vào Directus `fb_page_quyen` (as.on.tc) để lần sau tra một lệnh, không phải quét lại.
//
//   node apps/xuong-video/scripts/quyen-page.mjs                 quét Page chưa có trong Directus
//   node apps/xuong-video/scripts/quyen-page.mjs --lai           quét lại tất cả (kể cả đã có)
//   node apps/xuong-video/scripts/quyen-page.mjs --chi <page_id> chỉ một Page
//   node apps/xuong-video/scripts/quyen-page.mjs --xem           chỉ in bảng đã lưu trong Directus, không mở trình duyệt
//
// Chạy trên iMac (profile trình duyệt htuan82 nằm ở đây). Mỗi Page ~6 lệnh trình duyệt, ~35 giây.
import { execFileSync } from 'node:child_process';

const BR = `${process.env.HOME}/bin/br`;
const PROFILE = `${process.env.HOME}/Me/Earns/courseforge-demo/.capture-profile-htuan82`;
const BOX3 = 'root@167.233.241.16';
const BOX1 = 'root@5.78.65.158';
const ENV1 = '/opt/earns-marketing-os-v2/.env.production';
// Mã Page đến từ sổ token trên box3 (thật, không dựng theo mẫu) — khai nguồn một lần cho br khỏi từ chối URL.
const NGUON = 'quyen-page.mjs: ma Page doc tu /root/.secrets/fb-pages.json tren box3';

const ag = process.argv.slice(2);
const co = (t) => ag.includes(t);
const giaTri = (t) => { const i = ag.indexOf(t); return i >= 0 ? ag[i + 1] : null; };
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

function ssh(host, lenh, vaoStdin = null) {
  return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', host, lenh],
    { input: vaoStdin ?? undefined, encoding: 'utf8', maxBuffer: 32 << 20, timeout: 180_000, stdio: vaoStdin ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'] });
}

/** Lệnh br trên đúng profile htuan82; trả stdout (rỗng nếu br từ chối / lỗi — bên gọi tự xử). */
function br(...args) {
  try {
    return execFileSync(BR, args, {
      encoding: 'utf8', timeout: 180_000, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 << 20,
      env: { ...process.env, BR_PROFILE: PROFILE, BR_URL_NGUON: NGUON },
    }).trim();
  } catch (e) { return `__LOI__ ${(e.stdout || '') + (e.stderr || '')}`.slice(0, 300); }
}
const brEval = (js) => { const r = br('eval', js); return r.startsWith('__LOI__') ? null : r.trim(); };

/** Danh sách Page: mã + tên + số người theo + mục, đọc từ sổ token box3 rồi hỏi Graph API. */
function danhSachPage() {
  const py = `
import json, urllib.request, urllib.parse, urllib.error, concurrent.futures as cf
d = json.load(open("/root/.secrets/fb-pages.json"))
def do(kv):
    pid, v = kv
    u = f"https://graph.facebook.com/v21.0/{pid}?" + urllib.parse.urlencode({"fields":"name,followers_count,category","access_token":v["token"]})
    try:
        j = json.load(urllib.request.urlopen(u, timeout=25))
        return {"page_id": pid, "ten": j.get("name"), "nguoi_theo": j.get("followers_count"), "muc": j.get("category")}
    except Exception:
        return {"page_id": pid, "ten": v.get("ten"), "nguoi_theo": None, "muc": None}
with cf.ThreadPoolExecutor(12) as ex: ra = list(ex.map(do, d.items()))
print(json.dumps(ra, ensure_ascii=False))
`;
  return JSON.parse(ssh(BOX3, 'python3 -', py));
}

/** Directus: các Page đã lưu (page_id → bản ghi). */
function daLuu() {
  const sh = `set -a; . ${ENV1}; set +a
curl -s -m 30 -H "Authorization: Bearer $DIRECTUS_TOKEN" "$DIRECTUS_URL/items/fb_page_quyen?limit=-1&fields=id,page_id,ten,so_nguoi,rieng_anh,toan_quyen_ngoai,ten_cu,kiem_luc"`;
  const r = JSON.parse(ssh(BOX1, 'bash -s', sh) || '{"data":[]}');
  return new Map((r.data || []).map((x) => [String(x.page_id), x]));
}

/** Ghi một Page vào Directus (có rồi thì PATCH, chưa thì POST). */
function ghiDirectus(ban, idCu) {
  const json = JSON.stringify(ban).replace(/'/g, "'\\''");
  const sh = `set -a; . ${ENV1}; set +a
curl -s -m 30 -X ${idCu ? 'PATCH' : 'POST'} -H "Authorization: Bearer $DIRECTUS_TOKEN" -H 'Content-Type: application/json' \\
  "$DIRECTUS_URL/items/fb_page_quyen${idCu ? `/${idCu}` : ''}" -d '${json}'`;
  const r = JSON.parse(ssh(BOX1, 'bash -s', sh) || '{}');
  if (r.errors) throw new Error(`Directus: ${JSON.stringify(r.errors).slice(0, 200)}`);
  return r.data?.id;
}

// ĐỌC NGƯỜI + QUYỀN từ chữ trên trang. Khuôn Facebook in liền một dải:
//   "Nguyen Hoang Tuan (You) Page Deletion, Permissions, Content, Messages and calls, Community Activity, Ads, Insights Nguyễn Sơn Content, …"
// Mốc cắt đáng tin nhất là chữ "Insights" cuối mỗi người. Giữ NGUYÊN chữ gốc vào `lich_su` để sai khuôn vẫn không mất dữ liệu.
const QUYEN_DAU = /\b(Page Deletion|Permissions|Content|Messages and calls|Community Activity|Ads|Insights|Moderate|Create ads|View)\b/;
function docNguoi(chu) {
  const i = chu.indexOf('People with Facebook access');
  if (i < 0) return null;
  const j = chu.indexOf('People with task access');
  let doan = chu.slice(i + 'People with Facebook access'.length, j > i ? j : undefined).replace(/\bAdd new\b/g, ' ').trim();
  const ra = [];
  for (const khuc of doan.split(/Insights\s*/).map((x) => x.trim()).filter(Boolean)) {
    const m = khuc.match(QUYEN_DAU);
    if (!m) continue;
    const ten = khuc.slice(0, m.index).trim().replace(/\s+/g, ' ');
    const quyen = `${khuc.slice(m.index).trim()} Insights`.replace(/\s+/g, ' ');
    if (!ten) continue;
    ra.push({
      ten: ten.replace(/\s*\(You\)$/, ''),
      la_anh: /\(You\)$/.test(ten),
      quyen: quyen.split(',').map((x) => x.trim()).filter(Boolean),
      toan_quyen: /Page Deletion/.test(quyen) && /Permissions/.test(quyen),
    });
  }
  return ra.length ? ra : null;
}

// LỊCH SỬ QUẢN LÝ. Mốc cắt là NGÀY ("Feb 15, 2025, 6:06 PM"), KHÔNG phải dấu chấm: hành động hay chứa URL, mà
// `[^.]*\.` dừng ngay ở dấu chấm trong tên miền — bản đầu cắt "Changed the website from https://oldcars." và nuốt
// mất đích đến radarnews.live, đúng manh mối cần nhất (08/11/2026).
const NGAY = /([A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2}\s?[AP]M)/;
function docLichSu(chu) {
  const i = chu.indexOf('Management History');
  if (i < 0) return { ten_cu: null, lich_su: null };
  const doan = chu.slice(i, i + 4000).replace(/\s+/g, ' ').replace(/^Management History[^A-Z]*/, '');
  const phan = doan.split(new RegExp(NGAY.source, 'g'));
  const dong = [];
  for (let k = 0; k + 1 < phan.length; k += 2) {
    const d = `${phan[k]} ${phan[k + 1]}`.replace(/\s+/g, ' ').trim();
    if (/Changed|control|removed|added|merged/i.test(d)) dong.push(d.replace(/^(All actions|Newest|Action|Page manager|Date|Filters)\s*/gi, '').trim());
  }
  // Tên cũ: Facebook không luôn ghi dòng "Changed the name" — website cũ cũng là dấu Page từng chạy gì (YNT từng trỏ radarnews.live).
  const dauTen = dong.filter((x) => /Changed the (name|username|website)/i.test(x));
  return {
    ten_cu: dauTen.length ? dauTen.join(' | ').slice(0, 2000) : null,
    lich_su: (dong.length ? dong : [doan]).join(' | ').slice(0, 4000),
  };
}

// MỌI `goto` PHẢI CÓ `--here`. Thiếu nó, br mở TAB MỚI: trang đang đọc không đổi, `eval` vẫn đọc tab cũ, nên từ Page
// THỨ HAI trở đi luôn báo "khong lay duoc href Page settings" — lần quét đầu 08/11/2026 hỏng 72/73 Page vì đúng lỗi này,
// và nó không lộ ra khi nghiệm thu một Page duy nhất (Page đầu tình cờ đứng sẵn ở trang cần). Chạy ít nhất 3 Page khi thử.
// CHỜ THEO MỐC, KHÔNG CHỜ CỨNG (08/11/2026, anh hỏi "có cách nào nhanh hơn"): bản đầu ngủ 9–10 giây sau MỖI bước, tức
// ~40 giây một Page kể cả khi Facebook dựng xong trang trong 3 giây. Giờ hỏi trang mỗi 1,5 giây tới khi thấy đúng mốc cần,
// trần `toiDa` giây thì bỏ. Trang nào chậm vẫn được chờ đủ, trang nhanh không phải nằm không.
async function cho(jsMoc, toiDa = 16) {
  const het = Date.now() + toiDa * 1000;
  while (Date.now() < het) {
    const r = brEval(jsMoc);
    if (r && /true/.test(r)) return true;
    await nghi(1500);
  }
  return false;
}
const docChu = () => { try { return JSON.parse(brEval(`JSON.stringify((document.body.innerText||"").replace(/\\s+/g," "))`) || '""'); } catch { return ''; } };

/** Một Page: Business Suite → Page settings → Page access (+ Management History khi cần). */
async function quetMot(p, docLs) {
  const r = { page_id: String(p.page_id), ten: p.ten, nguoi_theo: p.nguoi_theo, muc: p.muc };
  br('goto', `https://business.facebook.com/latest/settings/profiles?selected_asset_id=${p.page_id}&selected_asset_type=page`, '--here');
  // Nút "Page settings" mang href redirect_to_new_page_experience có chữ ký riêng từng Page (eav/hash) — KHÔNG dựng được theo mẫu, phải lấy href thật.
  const CO_NUT = `(()=>[...document.querySelectorAll("a[href*=redirect_to_new_page_experience]")].length>0||[...document.querySelectorAll("a,div[role=button],span")].some(x=>(x.innerText||"").trim()==="Page settings"))()`;
  await cho(CO_NUT, 18);
  const href = brEval(`(()=>{const e=[...document.querySelectorAll("a,div[role=button],span")].filter(x=>(x.innerText||"").trim()==="Page settings");for(const a of e.reverse()){const h=a.closest("a")?.getAttribute("href");if(h&&/redirect_to_new_page_experience/.test(h))return h}return ""})()`);
  const link = (href || '').replace(/^"|"$/g, '').trim();
  if (!/redirect_to_new_page_experience/.test(link)) { r.ghi_chu = 'khong lay duoc href "Page settings" tu Business Suite'; return r; }
  br('goto', link, '--here');
  await cho(`(()=>/facebook\\.com\\/settings/.test(location.href))()`, 18);

  br('goto', 'https://web.facebook.com/settings/?tab=profile_access', '--here');
  await cho(`(()=>(document.body.innerText||"").includes("People with Facebook access"))()`, 20);
  let ng = null;
  try { ng = docNguoi(docChu()); } catch { /* chữ hỏng → để null, ghi_chu nói ra */ }
  if (!ng) { r.ghi_chu = 'khong doc duoc muc Page access (trang chua tai xong hoac khuon doi)'; return r; }
  const ngoai = ng.filter((x) => !x.la_anh);
  r.nguoi_quan_ly = ng.map((x) => ({ ten: x.ten, la_anh: x.la_anh, toan_quyen: x.toan_quyen, quyen: x.quyen }));
  r.so_nguoi = ng.length;
  r.rieng_anh = ngoai.length === 0;
  r.toan_quyen_ngoai = ngoai.filter((x) => x.toan_quyen).map((x) => x.ten).join(', ') || null;

  // Lịch sử chỉ đọc khi CẦN: Page sạch (một mình anh) thì lịch sử không đổi quyết định, mà nó là 1/4 thời gian mỗi Page.
  // Page có người ngoài thì đọc, vì đó là chỗ thấy ai đã làm gì (và Page từng chạy gì — YNT lộ ra radarnews.live ở đây).
  if (docLs || !r.rieng_anh) {
    br('goto', 'https://web.facebook.com/settings/?tab=profile_management_history', '--here');
    await cho(`(()=>(document.body.innerText||"").includes("Management History"))()`, 20);
    try { Object.assign(r, docLichSu(docChu())); } catch { /* bỏ qua: thiếu lịch sử không chặn phần quyền */ }
  }
  return r;
}

function inBang(ds) {
  const w = (s, n) => String(s ?? '').padEnd(n).slice(0, n);
  console.log(`${w('theo', 7)}${w('page_id', 18)}${w('ten', 30)}${w('nguoi', 6)}rieng  nguoi ngoai co toan quyen`);
  for (const x of ds.sort((a, b) => (a.so_nguoi ?? 99) - (b.so_nguoi ?? 99) || (b.nguoi_theo ?? 0) - (a.nguoi_theo ?? 0))) {
    console.log(`${w(x.nguoi_theo ?? '?', 7)}${w(x.page_id, 18)}${w(x.ten, 30)}${w(x.so_nguoi ?? '?', 6)}${w(x.rieng_anh ? 'CHI ANH' : (x.so_nguoi ? 'co nguoi ngoai' : '?'), 16)}${x.toan_quyen_ngoai || ''}`);
  }
}

const main = async () => {
  const cu = daLuu();
  if (co('--xem')) {
    const ds = [...cu.values()];
    if (!ds.length) { console.log('Directus fb_page_quyen chua co ban ghi nao — chay lenh khong co --xem de quet.'); return; }
    inBang(ds); console.log(`\n${ds.length} Page da luu trong Directus fb_page_quyen (as.on.tc).`);
    return;
  }

  let ds = danhSachPage();
  const chi = giaTri('--chi');
  if (chi) ds = ds.filter((p) => String(p.page_id) === String(chi));
  else if (!co('--lai')) ds = ds.filter((p) => !cu.has(String(p.page_id)));
  ds.sort((a, b) => (a.nguoi_theo ?? 1e9) - (b.nguoi_theo ?? 1e9));   // Page TRONG truoc: cau can tra loi som nhat
  const so = Number(giaTri('--so') || 0);   // --so N: chỉ quét N Page đầu (dùng để nghiệm thu nhiều Page mà không chạy cả 73)
  if (so > 0) ds = ds.slice(0, so);
  if (!ds.length) { console.log('khong con Page nao can quet (dung --lai de quet lai tat ca).'); return; }

  console.log(`quet ${ds.length} Page · profile htuan82 tren iMac · uoc ${Math.ceil(ds.length * 16 / 60)} phut (Page trong quet truoc)`);
  const mo = br('open', PROFILE);
  if (mo.startsWith('__LOI__')) { console.error(`khong mo duoc profile htuan82: ${mo}`); process.exit(1); }
  const xong = [];
  try {
    for (const [i, p] of ds.entries()) {
      let r;
      try { r = await quetMot(p, co('--lich-su')); } catch (e) { r = { page_id: String(p.page_id), ten: p.ten, ghi_chu: `loi quet: ${String(e.message).slice(0, 200)}` }; }
      r.kiem_luc = new Date().toISOString();
      try { ghiDirectus(r, cu.get(String(p.page_id))?.id); } catch (e) { console.error(`  ghi Directus hong (${p.ten}): ${e.message}`); }
      xong.push(r);
      const co_ngoai = r.rieng_anh === false ? ` · NGUOI NGOAI: ${r.nguoi_quan_ly.filter((x) => !x.la_anh).map((x) => x.ten).join(', ')}` : '';
      console.log(`[${i + 1}/${ds.length}] ${p.ten}: ${r.so_nguoi ?? '?'} nguoi${co_ngoai}${r.toan_quyen_ngoai ? ` · TOAN QUYEN: ${r.toan_quyen_ngoai}` : ''}${r.ghi_chu ? ` · ${r.ghi_chu}` : ''}`);
    }
  } finally {
    br('close', PROFILE);
  }
  console.log('');
  inBang(xong);
  const ngoai = xong.filter((x) => x.rieng_anh === false);
  const toan = xong.filter((x) => x.toan_quyen_ngoai);
  const hong = xong.filter((x) => x.so_nguoi == null);
  console.log(`\n${xong.length} Page da quet · ${ngoai.length} Page CO NGUOI NGOAI · ${toan.length} Page co nguoi ngoai TOAN QUYEN · ${hong.length} Page khong doc duoc`);
  if (toan.length) console.log(`CANH BAO — nguoi ngoai co quyen xoa Page: ${toan.map((x) => `${x.ten} (${x.toan_quyen_ngoai})`).join(' · ')}`);
  console.log('Da luu Directus fb_page_quyen — lan sau tra bang: node apps/xuong-video/scripts/quyen-page.mjs --xem');
};

main().catch((e) => { console.error(`quyen-page: ${e.message}`); process.exit(1); });

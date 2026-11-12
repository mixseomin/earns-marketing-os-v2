// CHUẨN SITE MỚI — Phòng Tài nguyên (anh 13/11/2026: "domain mới tạo phải lưu vault, khi launch web phải có logo, favicon, GA4… rồi add vào mos2.on.tc —
// đã có bước chuẩn hoá cho mọi website mới tạo cơ mà sao tao cứ phải nhắc lại"). Gốc: mỗi site mới do một phiên Claude dựng tay, không có bước nào
// đối chiếu lại → thiếu gì phải chờ anh nhắc. Máy này đối chiếu MỌI tên miền trong sổ hạ tầng mos2 (infra_resources kind='domain') + mọi zone
// Cloudflare của nhà, mỗi 6 giờ (trong nhịp kiem-tai-nguyen 30 phút), báo phần THIẾU vào chủ đề 🧰 Tài nguyên:
//   1. zone Cloudflare có mà sổ hạ tầng KHÔNG có dòng            → "chưa vào sổ hạ tầng (vault)"
//   2. dòng sổ chưa gắn dự án mos2 (project_id rỗng)              → "chưa gắn dự án mos2"
//   3. site đang mở được (HTTPS 200, không phải trang đỗ) mà thiếu: favicon · logo · GA4 (thẻ G-… / googletagmanager)
// Chỉ đọc + báo, $0, không gọi mô hình. Đường dựng site mới: ~/bin/newdomain (Cloudflare) → dòng sổ hạ tầng + dự án mos2 → favicon/logo/GA4 →
// ~/bin/onboard-site (GSC + Bing). Kiểm tay một tên miền:  node apps/cty/worker/site-chuan.mjs --kiem <tên miền>   ·   tự kiểm: --tu-kiem
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const CHU_KY_GIO = 6;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

/** Đối chiếu một trang (thuần, tự kiểm được): html trang chủ + favicon.ico có phải ảnh → danh sách thiếu. */
export function thieuTrang(html, faviconAnh) {
  const h = String(html || ''), thieu = [];
  if (!faviconAnh && !/<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(h)) thieu.push('favicon');
  // logo: phần tử mang chữ logo / brand, tệp logo, hoặc ảnh / svg nằm trong <header> / <nav> (logo dạng hình ở đầu trang)
  const dauTrang = (h.match(/<(header|nav)\b[\s\S]*?<\/\1>/i) || [''])[0];
  if (!/<[a-z]+[^>]*(class|id|alt|src|aria-label)=["'][^"']*(logo|brand)[^"']*["']/i.test(h) && !/\/(logo|icon-\d+)\.(svg|png|webp|jpg)/i.test(h) && !/<(img|svg)\b/i.test(dauTrang)) thieu.push('logo');
  if (!/\bG-[A-Z0-9]{6,}\b/.test(h) && !/googletagmanager\.com\/gtag/i.test(h)) thieu.push('GA4');
  return thieu;
}
/** Trang đỗ / chưa dựng (đăng ký xong chưa có web): không đòi favicon / GA4. */
export const laTrangDo = (html) => /domain (is )?(for sale|parked)|this domain|coming soon by|parkingcrew|sedoparking|^\s*$/i.test(String(html || '').slice(0, 4000));

const psqlMos2 = (q) => execFileSync('sh', ['-c', `cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -tA -F'\t' -c "$1"`, 'x', q], { encoding: 'utf8', timeout: 20000 })
  .trim().split('\n').filter(Boolean).map((l) => l.split('\t'));

// zone Cloudflare của nhà: đọc bằng các tệp khoá certbot sẵn trên box3 (đọc trong tiến trình, không in)
function zoneCloudflare() {
  const ten = new Set();
  for (const tep of ['/etc/letsencrypt/cloudflare.ini', ...(() => { try { return [fs.readFileSync('/etc/letsencrypt/renewal/on.tc.conf', 'utf8').match(/dns_cloudflare_credentials\s*=\s*(\S+)/)?.[1]].filter(Boolean); } catch { return []; } })()]) {
    let c; try { c = fs.readFileSync(tep, 'utf8'); } catch { continue; }
    const doc = (k) => c.match(new RegExp(`^\\s*${k}\\s*=\\s*(\\S+)`, 'm'))?.[1];
    const H = doc('dns_cloudflare_api_token') ? ['-H', `Authorization: Bearer ${doc('dns_cloudflare_api_token')}`] : ['-H', `X-Auth-Key: ${doc('dns_cloudflare_api_key')}`, '-H', `X-Auth-Email: ${doc('dns_cloudflare_email')}`];
    for (let trang = 1; trang < 10; trang++) {
      try {
        const j = JSON.parse(execFileSync('curl', ['-s', '-m', '20', ...H, `https://api.cloudflare.com/client/v4/zones?per_page=50&page=${trang}`], { encoding: 'utf8' }));
        for (const z of j.result || []) ten.add(z.name.toLowerCase());
        if (!j.result_info || trang >= j.result_info.total_pages) break;
      } catch { break; }
    }
  }
  return ten;
}

async function moTrang(ten) {
  try {
    const r = await fetch(`https://${ten}/`, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': UA } });
    const html = r.ok ? await r.text() : '';
    let fav = false;
    try { const f = await fetch(`https://${ten}/favicon.ico`, { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': UA } }); fav = f.ok && /^image\//.test(f.headers.get('content-type') || ''); } catch { /* không có */ }
    return { ma: r.status, html, fav };
  } catch (e) { return { ma: 0, html: '', fav: false, loi: e.message }; }
}

/** Kiểm cả sổ; kết quả lưu <DATA>/site-chuan.json, chỉ kiểm lại sau CHU_KY_GIO. Trả cảnh báo dạng { khoa, chu } cho nhịp Tài nguyên. */
export async function canhBaoSite({ ep = false } = {}) {
  const tep = `${DATA()}/site-chuan.json`;
  let cu = null; try { cu = JSON.parse(fs.readFileSync(tep, 'utf8')); } catch { /* lần đầu */ }
  if (!ep && cu && Date.now() - Date.parse(cu.luc) < CHU_KY_GIO * 36e5) return cu.canh_bao;
  const so = psqlMos2(`select lower(regexp_replace(label, '^www\\.', '')), coalesce(project_id, ''), coalesce(status, 'active') from infra_resources where kind = 'domain'`);
  const trongSo = new Map(so.map(([t, p, st]) => [t, { p, st }]));
  const cb = [];
  for (const z of zoneCloudflare()) if (!trongSo.has(z) && !/\.on\.tc$/.test(z)) cb.push({ khoa: `site:${z}:so`, chu: `Tên miền <b>${z}</b> có zone Cloudflare nhưng CHƯA vào sổ hạ tầng mos2 (vault) — thêm dòng infra_resources kind=domain + dự án` });
  for (const [ten, { p, st }] of trongSo) {
    if (st !== 'active') continue;
    if (!p) cb.push({ khoa: `site:${ten}:du-an`, chu: `Tên miền <b>${ten}</b> trong sổ hạ tầng chưa gắn dự án mos2` });
    const t = await moTrang(ten);
    if (t.ma !== 200 || laTrangDo(t.html)) continue;   // chưa có web → chưa đòi chuẩn web
    const thieu = thieuTrang(t.html, t.fav);
    if (thieu.length) cb.push({ khoa: `site:${ten}:web:${thieu.join('-')}`, chu: `Site <b>${ten}</b> đang mở nhưng thiếu: ${thieu.join(', ')} (chuẩn site mới: logo · favicon · GA4)` });
  }
  fs.mkdirSync(DATA(), { recursive: true });
  fs.writeFileSync(tep, JSON.stringify({ luc: new Date().toISOString(), canh_bao: cb }, null, 1));
  return cb;
}

if (process.argv[1]?.endsWith('site-chuan.mjs')) {
  if (process.argv.includes('--tu-kiem')) {
    const a = (await import('node:assert')).default;
    const du = `<head><link rel="icon" href="/favicon.ico"><script async src="https://www.googletagmanager.com/gtag/js?id=G-NHL6WC9B6J"></script></head><a class="logo" href="/"><img src="/icon-192.png"></a>`;
    a.deepStrictEqual(thieuTrang(du, true), [], 'đủ chuẩn → không thiếu');
    a.deepStrictEqual(thieuTrang('<html><body>hi</body></html>', false), ['favicon', 'logo', 'GA4'], 'trang trơn → thiếu cả ba');
    a.deepStrictEqual(thieuTrang('<html><body>hi</body></html>', true), ['logo', 'GA4'], 'favicon.ico là ảnh thì đủ favicon dù thiếu thẻ link');
    a.deepStrictEqual(thieuTrang('<img alt="Acme logo" src="/a.png"> gtag G-ABCDEF12', false), ['favicon'], 'logo theo alt + GA theo mã G-');
    a.ok(laTrangDo('This domain is for sale!') && !laTrangDo(du), 'nhận trang đỗ');
    a.deepStrictEqual(thieuTrang('<header><a href="/"><svg viewBox="0 0 10 10"></svg> Acme</a></header> G-ABCDEF12', true), [], 'svg trong header = có logo');
    a.deepStrictEqual(thieuTrang('<header><a class="site-brand">Acme</a></header> G-ABCDEF12', true), [], 'class brand = có logo');
    a.deepStrictEqual(thieuTrang('<header><a href="/">Acme</a></header> G-ABCDEF12', true), ['logo'], 'chỉ chữ trơn trong header = thiếu logo');
    console.log('site-chuan: 8/8 bài tự kiểm đạt');
  } else if (process.argv.includes('--kiem')) {
    const ten = process.argv[process.argv.indexOf('--kiem') + 1];
    const t = await moTrang(ten);
    console.log(JSON.stringify({ ten, https: t.ma, trang_do: laTrangDo(t.html), thieu: t.ma === 200 ? thieuTrang(t.html, t.fav) : 'chưa mở được' }));
  } else {
    console.log(JSON.stringify(await canhBaoSite({ ep: true }), null, 1));
  }
}

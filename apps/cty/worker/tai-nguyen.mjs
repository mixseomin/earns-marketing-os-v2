// PHÒNG TÀI NGUYÊN — nhịp máy `kiem-tai-nguyen` (anh 19/10/2026: "cần có phòng tài nguyên hay ai quản lý cái này cho tao" — sau một đêm slot 2proxy
// nằm không, khoá hết hạn, máy cào chết 2 ngày, box3 quá tải mà không gì tự báo). $0: không gọi mô hình. Chạy trên box3 (cty-nhip.timer).
// Mỗi nhịp đọc: (1) bảng làn ↔ máy `may_cao_lan` + lần chạy gần nhất của từng làn (DB spy), (2) hạn từng khoá 2proxy (API đơn hàng, ≤ 1 lần/giờ)
// + khoá gắn làn nào (tên biến trong /root/.secrets/spy.env), (3) tải box3. Ghi ảnh chụp <DATA>/tai-nguyen.json, cảnh báo mới → Telegram chủ đề 🧰 Tài nguyên.
// CHỈ BÁO: không gia hạn, không mua, không đổi làn (anh cấm tự gia hạn 2proxy 19/10/2026). Cùng cảnh báo chỉ nhắc lại sau 6 giờ.
//   node worker/tai-nguyen.mjs --in        in ảnh chụp + cảnh báo (không gửi)
//   node worker/tai-nguyen.mjs --tu-kiem
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const SPY_ENV = '/root/.secrets/spy.env';
/** Làn → khoá 2proxy dùng (tên biến trong spy.env). Một chỗ khai; làn mới thêm vào đây. */
export const KHOA_LAN = { TWOPROXY_KEY_XOAY: 'cao_chinh', TWOPROXY_KEYS_SONG_SONG: 'cao_chinh', TWOPROXY_KEY_DT: 'doi_thu', TWOPROXY_KEY_UU: 'goc_uu' };
export const NGUONG = { lanDungGio: 2, spyproDungGio: 3, khoaConNgay: 3, tai: 3.5, ramMB: 1200, nhacLaiGio: 6 };

/** Thuần: ảnh chụp → cảnh báo [{khoa, chu}]. lan: [{lan, may, cuoi (ISO|null)}] · khoa: [{ma, lan, het (giây epoch)}] · may: {tai, ramMB, daemon} */
export function xetCanhBao(s, bayGio = Date.now()) {
  const ra = [];
  for (const l of s.lan) {
    if (l.may === 'tat') continue;
    const gio = l.cuoi ? (bayGio - Date.parse(l.cuoi)) / 36e5 : Infinity;
    const tran = l.lan === 'spypro' ? NGUONG.spyproDungGio : NGUONG.lanDungGio;
    if (gio > tran) ra.push({ khoa: `lan:${l.lan}`, chu: `Làn <b>${l.lan}</b> (máy ${l.may}) đứng ${gio === Infinity ? 'chưa chạy lần nào' : `${gio.toFixed(1)} giờ`}` });
  }
  const lanBat = new Set(s.lan.filter((l) => l.may !== 'tat').map((l) => l.lan));
  for (const k of s.khoa) {
    const ngay = (k.het * 1000 - bayGio) / 864e5;
    if (k.het && ngay < NGUONG.khoaConNgay) ra.push({ khoa: `het:${k.ma}`, chu: `Khoá 2proxy <b>…${k.ma}</b> (${k.lan ?? 'chưa gắn làn'}) ${ngay < 0 ? 'ĐÃ HẾT HẠN' : `còn ${ngay.toFixed(1)} ngày`} — anh quyết gia hạn hay bỏ (máy không tự gia hạn)` });
    if (!k.lan || !lanBat.has(k.lan)) ra.push({ khoa: `nam:${k.ma}`, chu: `Khoá 2proxy <b>…${k.ma}</b> đang trả tiền mà ${k.lan ? `làn ${k.lan} đang tắt` : 'không làn nào dùng'} — slot nằm không` });
  }
  if (s.may.tai > NGUONG.tai) ra.push({ khoa: 'box3:tai', chu: `box3 quá tải: tải ${s.may.tai} / 4 nhân` });
  if (s.may.ramMB < NGUONG.ramMB) ra.push({ khoa: 'box3:ram', chu: `box3 thiếu RAM: còn ${s.may.ramMB} MB` });
  if (s.may.daemon === false && s.lan.some((l) => l.may === 'box3')) ra.push({ khoa: 'box3:daemon', chu: 'box3: trình duyệt máy cào (spy-cao-daemon) không chạy trong khi có làn giao box3' });
  return ra;
}

const docEnv = () => Object.fromEntries(fs.readFileSync(SPY_ENV, 'utf8').split('\n').map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const psqlSpy = (env, sql) => execFileSync('psql', [env.DATABASE_URL, '-tAF', '|', '-c', sql], { encoding: 'utf8', timeout: 20000 }).trim().split('\n').filter(Boolean).map((r) => r.split('|'));

async function hanKhoa(env, tep) {
  let c = {}; try { c = JSON.parse(fs.readFileSync(tep, 'utf8')); } catch { /* lần đầu */ }
  if (Date.now() / 1000 - (c.luc ?? 0) < 3600) return c.het ?? {};
  const api = async (q) => (await fetch(`https://app.2proxy.vn/api/proxyv2.php?key=${env.TWOPROXY_API_KEY}&${q}`, { signal: AbortSignal.timeout(30000) })).json().catch(() => []);
  const het = {};
  for (const o of (await api('sukien=listorder')) || []) {
    await new Promise((r) => setTimeout(r, 4500));   // API: "chờ 4s giữa hai lần lấy đơn"
    for (const k of (await api(`sukien=listproxy&ma_don_hang=${o.order_code}`)) || []) if (k?.proxy) het[k.proxy] = Number(k.time) || 0;
  }
  fs.writeFileSync(tep, JSON.stringify({ luc: Math.floor(Date.now() / 1000), het }));
  return het;
}

export async function chupTaiNguyen() {
  const env = docEnv();
  const cuoi = Object.fromEntries(psqlSpy(env, `select 'cao_chinh', max(bat_dau) from luot_cao union all
    select 'goc_thuong', max(greatest(lan_cao, dang_cao)) from goc_sp where coalesce(cao_luong, 'thuong') = 'thuong' union all
    select 'goc_uu', max(greatest(lan_cao, dang_cao)) from goc_sp where cao_luong = 'uu' union all
    select 'doi_thu', max(luc) from quet_trang union all select 'spypro', max(lan_cuoi) from spypro_truy_van`).map(([a, b]) => [a, b || null]));
  // Lượt cào chính chỉ ghi luot_cao khi XONG (lượt dài hàng giờ) → đang chạy thì lấy nhịp sống của lượt (luot-song.json, 30 giây/lần) hoặc
  // trạng thái lượt (trang-thai-cao.json dang_chay) — 19/10/2026 báo nhầm "cao_chinh đứng 43 giờ" khi lượt iMac đang chạy.
  const docJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  const song = docJson('/opt/spy/tep/luot-song.json'), tt = docJson('/opt/spy/tep/trang-thai-cao.json');
  const dangChay = [song?.luc ? new Date(song.luc * 1000).toISOString() : null, tt?.dang_chay && Date.now() - Date.parse(tt.bat_dau) < 12 * 36e5 ? new Date().toISOString() : null].filter(Boolean).sort().pop();
  if (dangChay && (!cuoi.cao_chinh || dangChay > new Date(cuoi.cao_chinh).toISOString())) cuoi.cao_chinh = dangChay;
  const lan = psqlSpy(env, 'select lan, may from may_cao_lan order by lan').map(([l, m]) => ({ lan: l, may: m, cuoi: cuoi[l] ? new Date(cuoi[l]).toISOString() : null }));
  const het = await hanKhoa(env, `${DATA()}/tai-nguyen-khoa.json`);
  const khoa = [];
  for (const [bien, l] of Object.entries(KHOA_LAN)) for (const k of String(env[bien] ?? '').split(/\s+/).filter(Boolean)) khoa.push({ ma: k.slice(-4), bien, lan: l, het: het[k] ?? 0 });
  for (const k of Object.keys(het)) if (!khoa.some((x) => k.endsWith(x.ma))) khoa.push({ ma: k.slice(-4), bien: null, lan: null, het: het[k] });
  const [tai] = fs.readFileSync('/proc/loadavg', 'utf8').split(' ').map(Number);
  const ramMB = Math.round(Number(fs.readFileSync('/proc/meminfo', 'utf8').match(/MemAvailable:\s+(\d+)/)[1]) / 1024);
  let daemon = false; try { daemon = execFileSync('systemctl', ['is-active', 'spy-cao-daemon'], { encoding: 'utf8' }).trim() === 'active'; } catch { /* không active */ }
  return { luc: new Date().toISOString(), lan, khoa, may: { tai, ramMB, daemon } };
}

/** Nhịp (worker/nhip.mjs): chụp → lưu → cảnh báo MỚI (hoặc quá 6 giờ chưa nhắc) → Telegram. */
export async function nhipTaiNguyen(nguoi, { ten = nguoi } = {}) {
  const s = await chupTaiNguyen();
  fs.mkdirSync(DATA(), { recursive: true });
  fs.writeFileSync(`${DATA()}/tai-nguyen.json`, JSON.stringify(s, null, 1));
  const cb = xetCanhBao(s), tep = `${DATA()}/tai-nguyen-tg.json`;
  let st = {}; try { st = JSON.parse(fs.readFileSync(tep, 'utf8')); } catch { /* lần đầu */ }
  const nhac = st.nhac ?? {}, bay = Date.now();
  const moi = cb.filter((c) => !nhac[c.khoa] || bay - nhac[c.khoa] > NGUONG.nhacLaiGio * 36e5);
  if (moi.length) {
    const { TG_BOT_TOKEN: T, TG_CHAT: C } = process.env;
    if (T && C) {
      const tg = async (m, b) => (await fetch(`https://api.telegram.org/bot${T}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: C, ...b }), signal: AbortSignal.timeout(15000) })).json();
      if (!st.topic) { const j = await tg('createForumTopic', { name: '🧰 Tài nguyên' }); if (j.ok) st.topic = j.result.message_thread_id; }
      const j = await tg('sendMessage', { message_thread_id: st.topic, parse_mode: 'HTML', text: `<b>${ten} · Phòng Tài nguyên</b>\n${moi.map((c) => `• ${c.chu}`).join('\n')}` });
      if (j.ok) for (const c of moi) nhac[c.khoa] = bay;
    }
  }
  for (const k of Object.keys(nhac)) if (!cb.some((c) => c.khoa === k)) delete nhac[k];   // hết chuyện → lần sau tái phát báo lại ngay
  fs.writeFileSync(tep, JSON.stringify({ ...st, nhac }));
  return { canh_bao: cb.length, gui: moi.length };
}

if (process.argv[1]?.endsWith('tai-nguyen.mjs')) {
  if (process.argv.includes('--tu-kiem')) {
    const assert = (await import('node:assert')).default, bay = Date.parse('2026-10-19T00:00:00Z'), gio = (h) => new Date(bay - h * 36e5).toISOString();
    const may = { tai: 1, ramMB: 4000, daemon: true };
    const k = (x) => xetCanhBao(x, bay).map((c) => c.khoa);
    assert.deepStrictEqual(k({ lan: [{ lan: 'goc_thuong', may: 'box3', cuoi: gio(0.5) }], khoa: [], may }), [], 'làn chạy 30 phút trước: im');
    assert.deepStrictEqual(k({ lan: [{ lan: 'cao_chinh', may: 'imac', cuoi: gio(32) }], khoa: [], may }), ['lan:cao_chinh'], 'máy cào chết 32 giờ (17–19/10)');
    assert.deepStrictEqual(k({ lan: [{ lan: 'cao_chinh', may: 'tat', cuoi: gio(32) }], khoa: [], may }), [], 'làn tắt: không báo đứng');
    assert.deepStrictEqual(k({ lan: [{ lan: 'cao_chinh', may: 'tat', cuoi: null }], khoa: [{ ma: 'yY4C', lan: 'cao_chinh', het: bay / 1000 + 14 * 86400 }], may }), ['nam:yY4C'], 'khoá trả tiền mà làn tắt = slot nằm không');
    assert.deepStrictEqual(k({ lan: [{ lan: 'cao_chinh', may: 'imac', cuoi: gio(0) }], khoa: [{ ma: '08wY', lan: 'cao_chinh', het: bay / 1000 + 3600 }], may }), ['het:08wY'], 'khoá còn 1 giờ');
    assert.deepStrictEqual(k({ lan: [{ lan: 'spypro', may: 'imac', cuoi: gio(2.5) }], khoa: [], may }), [], 'spypro trần 3 giờ');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may: { tai: 5.7, ramMB: 900, daemon: true } }), ['box3:tai', 'box3:ram'], 'box3 tải 5,7 (19/10)');
    console.log('tai-nguyen tu-kiem ok');
  } else if (process.argv.includes('--in')) {
    const s = await chupTaiNguyen(); console.log(JSON.stringify(s, null, 1)); console.log(xetCanhBao(s));
  }
}

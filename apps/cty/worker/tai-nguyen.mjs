// PHÒNG TÀI NGUYÊN — nhịp máy `kiem-tai-nguyen` (anh 19/10/2026: "cần có phòng tài nguyên hay ai quản lý cái này cho tao" — sau một đêm slot 2proxy
// nằm không, khoá hết hạn, máy cào chết 2 ngày, box3 quá tải mà không gì tự báo). $0: không gọi mô hình. Chạy trên box3 (cty-nhip.timer).
// Mỗi nhịp đọc: (1) bảng làn ↔ máy `may_cao_lan` + lần chạy gần nhất của từng làn (DB spy), (2) hạn từng khoá 2proxy (API đơn hàng, ≤ 1 lần/giờ)
// + khoá gắn làn nào (tên biến trong /root/.secrets/spy.env), (3) CPU bận box3 / VPS. Ghi ảnh chụp <DATA>/tai-nguyen.json, cảnh báo mới → Telegram chủ đề 🧰 Tài nguyên.
// CHỈ BÁO: không gia hạn, không mua, không đổi làn (anh cấm tự gia hạn 2proxy 19/10/2026). Cùng cảnh báo chỉ nhắc lại sau 6 giờ.
//   node worker/tai-nguyen.mjs --in        in ảnh chụp + cảnh báo (không gửi)
//   node worker/tai-nguyen.mjs --tu-kiem
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const SPY_ENV = '/root/.secrets/spy.env';
/** Làn → khoá 2proxy dùng (tên biến trong spy.env). Một chỗ khai; làn mới thêm vào đây. */
export const KHOA_LAN = { TWOPROXY_KEY_XOAY: 'cao_chinh', TWOPROXY_KEYS_SONG_SONG: 'cao_chinh', TWOPROXY_KEY_DT: 'doi_thu', TWOPROXY_KEY_UU: 'goc_uu' };
export const NGUONG = { lanDungGio: 2, spyproDungGio: 3, khoaConNgay: 3, cpuBan: 85, ramMB: 1200, nhacLaiGio: 6, taiSanConNgay: 5, ckeyDungGio: 13, vpsRamMB: 400, diaPt: 85 };
// QUÁ TẢI = % CPU BẬN THẬT trung bình giữa hai nhịp (~30 phút, /proc/stat; chờ đĩa/mạng tính là rỗi) — KHÔNG dùng load average 1 phút: nó đếm cả
// tiến trình ngồi chờ mạng/đĩa và một phút nhói là kêu (22/10/2026: box3 "thỉnh thoảng quá tải" theo nhịp deploy spy; VPS CPU rỗi 97% mà tải 4).
// Báo kèm 3 tiến trình nặng nhất lúc chụp → biết nghẽn ở đâu, không đoán.
const TOP3 = `top -b -c -n 2 -d 2 -o %CPU -w 300 | awk '/^top -/{n++} n==2 && $1 ~ /^[0-9]+$/ && c++ < 3 {a=""; for(i=12;i<=NF&&i<=15;i++) a=a" "$i; print $9"%"substr(a,1,70)}'`;
/** Thuần: hai dòng "cpu …" của /proc/stat → % CPU bận giữa hai lần đọc (rỗi = idle + iowait); không tính được → null */
export function banCpu(truoc, nay) {
  const so = (d) => String(d || '').trim().split(/\s+/).slice(1).map(Number), a = so(truoc), b = so(nay), cong = (x) => x.reduce((t, v) => t + (v || 0), 0);
  if (a.length < 5 || b.length < 5) return null;
  const tong = cong(b) - cong(a), roi = b[3] + b[4] - a[3] - a[4];
  return tong > 0 ? Math.round(100 - (100 * roi) / tong) : null;
}
// MÁY CHẠY VPS (22/10/2026): máy cào chính chạy trên VPS vpschinhhang may-cao-vn — phòng canh nó qua ssh (daemon trình duyệt + tải), tên máy trùng
// giá trị may_cao_lan.may để biết làn nào đang giao cho nó.
export const VPS = { 'may-cao-vn': { ssh: 'root@116.118.28.214', daemon: 'spy-may-cao-daemon' } };

/** Thuần: ảnh chụp → cảnh báo [{khoa, chu}]. lan: [{lan, may, cuoi (ISO|null)}] · khoa: [{ma, lan, het (giây epoch)}] · may: {ban, phut, nang, ramMB, daemon} */
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
  const nang = (m) => (m.nang?.length ? ` — nặng nhất: ${m.nang.join(' · ')}` : '');
  if (s.may.ban >= NGUONG.cpuBan) ra.push({ khoa: 'box3:tai', chu: `box3 quá tải: CPU bận ${s.may.ban}% suốt ${s.may.phut} phút qua${nang(s.may)}` });
  if (s.may.ramMB < NGUONG.ramMB) ra.push({ khoa: 'box3:ram', chu: `box3 thiếu RAM: còn ${s.may.ramMB} MB` });
  if (s.may.daemon === false && s.lan.some((l) => l.may === 'box3')) ra.push({ khoa: 'box3:daemon', chu: 'box3: trình duyệt máy cào (spy-cao-daemon) không chạy trong khi có làn giao box3' });
  // TÀI SẢN SẮP HẾT HẠN (anh 22/10/2026 "cập nhật vps mới vào cty để còn kiểm soát thời hạn, chi phí"): mọi dòng mos2 infra_resources còn < 5 ngày
  for (const t of s.taiSan ?? []) {
    const ngay = (Date.parse(t.het) - bayGio) / 864e5; if (ngay >= NGUONG.taiSanConNgay) continue;
    const tien = t.thang ? ` · ${Math.round(t.thang / 100).toLocaleString('vi-VN')} ${t.tien}/tháng` : '';
    ra.push({ khoa: `taisan:${t.id}`, chu: `Tài sản <b>${t.ten}</b> (#${t.id}, ${t.nha || '?'}) ${ngay < 0 ? 'ĐÃ HẾT HẠN' : `còn ${ngay.toFixed(1)} ngày`} — hạn ${new Date(t.het).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}${tien}. Gia hạn tay (không tự gia hạn)` });
  }
  // người bán ckey (scripts/bao-tri-ckey.mjs của spy): khoá box3:ckey = máy móc → thợ máy nhận; ckey-gia / ckey-dong = anh quyết; ckey-doi = báo một lần
  if (s.ckey !== undefined) {
    const c = s.ckey, gio = c?.cap_nhat ? (bayGio - Date.parse(c.cap_nhat)) / 36e5 : Infinity;
    if (gio > NGUONG.ckeyDungGio) ra.push({ khoa: 'box3:ckey', chu: `Việc bảo trì người bán ckey (spy-bao-tri-ckey.timer) ${gio === Infinity ? 'chưa ghi danh sách lần nào' : `đứng ${gio.toFixed(1)} giờ`} — spy đang dùng danh sách cũ` });
    for (const [k, ds] of Object.entries(c?.dong ?? {})) if (!ds.length) ra.push({ khoa: `ckey-dong:${k}`, chu: `Dòng <b>${k}</b> không còn người bán ckey nào sống — spy đang gọi tuyến đắt hơn (fal / chính hãng)` });
    for (const [k, ds] of Object.entries(c?.chi_tiet ?? {})) for (const u of ds) if (!u.song && /price .*changed|accept the new price/i.test(u.loi || '')) ra.push({ khoa: `ckey-gia:${u.id}`, chu: `Người bán ckey <b>${u.id}</b> (${k}) đổi giá — muốn dùng lại thì anh vào ckey.vn bấm chấp nhận giá mới (máy không tự bấm)` });
    const truoc = s.ckeyTruoc?.dong;
    if (truoc && c?.dong) for (const [k, ds] of Object.entries(c.dong)) {
      const cu = truoc[k] ?? [], vao = ds.filter((x) => !cu.includes(x)), ra2 = cu.filter((x) => !ds.includes(x)), ten = (x) => x.replace(/^ckey:/, '');
      if (vao.length || ra2.length) ra.push({ khoa: `ckey-doi:${k}:${c.cap_nhat}`, chu: `Người bán ckey dòng <b>${k}</b> đổi:${vao.length ? ` thêm ${vao.map(ten).join(', ')}` : ''}${ra2.length ? ` · bỏ ${ra2.map(ten).join(', ')}` : ''} → đầu chuỗi: ${ten(ds[0] || '—')}` });
    }
  }
  for (const v of s.vps ?? []) {
    const coLan = s.lan.some((l) => l.may === v.ten);
    if (!v.toi) { if (coLan) ra.push({ khoa: `vps:${v.ten}:toi`, chu: `VPS <b>${v.ten}</b> không ssh vào được — làn cào giao cho nó đang đứng` }); continue; }
    if (coLan && !v.daemon) ra.push({ khoa: `vps:${v.ten}:daemon`, chu: `VPS <b>${v.ten}</b>: trình duyệt máy cào không chạy trong khi có làn giao cho nó` });
    if (v.ramMB != null && v.ramMB < NGUONG.vpsRamMB) ra.push({ khoa: `vps:${v.ten}:ram`, chu: `VPS <b>${v.ten}</b> thiếu RAM: còn ${v.ramMB} MB trống, swap đang dùng ${v.swapMB ?? '?'} MB` });
    if (v.dia >= NGUONG.diaPt) ra.push({ khoa: `vps:${v.ten}:dia`, chu: `VPS <b>${v.ten}</b> ổ cứng đầy ${v.dia}%` });
    if (v.ban >= NGUONG.cpuBan) ra.push({ khoa: `vps:${v.ten}:tai`, chu: `VPS <b>${v.ten}</b> quá tải: CPU bận ${v.ban}% suốt ${v.phut} phút qua${nang(v)}` });
  }
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
  // nhịp sống làn ghi lúc nhận khoá (spy scripts/goc-chay.sh nhip_lan, 24/10/2026) — mới hơn dấu dữ liệu thì lấy; trước đo làn đối thủ bằng quet_trang (lúc làn rảnh
  // không ghi) → báo oan "doi_thu đứng", thợ máy chạy Claude trên iMac vô ích
  const lan = psqlSpy(env, 'select lan, may, chay_luc from may_cao_lan order by lan').map(([l, m, nhip]) => {
    const ds = [cuoi[l], nhip].filter(Boolean).map((t) => new Date(t).toISOString()).sort();
    return { lan: l, may: m, cuoi: ds.pop() || null };
  });
  const het = await hanKhoa(env, `${DATA()}/tai-nguyen-khoa.json`);
  const khoa = [];
  for (const [bien, l] of Object.entries(KHOA_LAN)) for (const k of String(env[bien] ?? '').split(/\s+/).filter(Boolean)) khoa.push({ ma: k.slice(-4), bien, lan: l, het: het[k] ?? 0 });
  for (const k of Object.keys(het)) if (!khoa.some((x) => k.endsWith(x.ma))) khoa.push({ ma: k.slice(-4), bien: null, lan: null, het: het[k] });
  // CPU bận từng máy so với lần đọc /proc/stat của nhịp trước (tệp cpu); chưa có lần trước / quá 2 giờ → đo tại chỗ 2 giây
  const tepCpu = `${DATA()}/tai-nguyen-cpu.json`; let cpu = {}; try { cpu = JSON.parse(fs.readFileSync(tepCpu, 'utf8')); } catch { /* lần đầu */ }
  const doCpu = (ten, chay) => {
    let [dong, top] = chay(`head -1 /proc/stat`).split('\n'), truoc = cpu[ten], luc = Date.now();
    if (!truoc || luc - truoc.luc > 2 * 36e5) { truoc = { dong, luc }; execFileSync('sleep', ['2']); dong = chay('head -1 /proc/stat'); luc = Date.now(); }
    cpu[ten] = { dong, luc };
    const ban = banCpu(truoc.dong, dong), phut = Math.max(1, Math.round((luc - truoc.luc) / 6e4));
    return { ban, phut, nang: ban >= NGUONG.cpuBan ? chay(TOP3).split('\n').filter(Boolean) : [] };
  };
  const sh = (c) => execFileSync('sh', ['-c', c], { encoding: 'utf8', timeout: 20000 }).trim();
  const box3 = doCpu('box3', sh);
  const ramMB = Math.round(Number(fs.readFileSync('/proc/meminfo', 'utf8').match(/MemAvailable:\s+(\d+)/)[1]) / 1024);
  let daemon = false; try { daemon = execFileSync('systemctl', ['is-active', 'spy-cao-daemon'], { encoding: 'utf8' }).trim() === 'active'; } catch { /* không active */ }
  // sổ tài sản mos2 (infra_resources): dòng còn hạn trong 30 ngày tới — đọc hỏng thì bỏ phần này, phần còn lại vẫn chạy
  let taiSan = [];
  try {
    const url = (fs.readFileSync('/opt/earns-marketing-os-v2/.env.production', 'utf8').match(/^DATABASE_URL=(.*)$/m) || [])[1]?.replace(/^["']|["']$/g, '');
    taiSan = execFileSync('psql', [url, '-tAF', '|', '-c', `select id, label, provider, expires_at, cost_monthly, currency from infra_resources where status = 'active' and expires_at is not null and expires_at < now() + interval '30 days' order by expires_at`], { encoding: 'utf8', timeout: 20000 })
      .trim().split('\n').filter(Boolean).map((r) => r.split('|')).map(([id, ten, nha, het, thang, tien]) => ({ id: Number(id), ten, nha, het: new Date(het).toISOString(), thang: Number(thang) || 0, tien }));
  } catch (e) { console.error('✗ sổ tài sản mos2:', e.message.split('\n')[0]); }
  // máy chạy VPS: daemon + tải qua ssh (ConnectTimeout 8 giây); không vào được = toi:false
  const vps = Object.entries(VPS).map(([ten, v]) => {
    try {
      const ssh = (c) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', v.ssh, c], { encoding: 'utf8', timeout: 20000 }).trim();
      const d = ssh(`systemctl is-active ${v.daemon} || true`);
      // RAM / swap / ổ cứng VPS (anh 28/10/2026: VPS cạn RAM — 286 MB trống, swap 2,2 GB — mà không ai báo; trước chỉ canh RAM box3)
      const [ramMB, swapMB, dia] = ssh(`awk '/^MemAvailable:/{a=$2}/^SwapTotal:/{t=$2}/^SwapFree:/{f=$2}END{print int(a/1024), int((t-f)/1024)}' /proc/meminfo; df --output=pcent / | tail -1 | tr -dc 0-9`).split(/\s+/).map(Number);
      return { ten, toi: true, daemon: d === 'active', ramMB, swapMB, dia, ...doCpu(ten, ssh) };
    } catch { return { ten, toi: false }; }
  });
  fs.mkdirSync(DATA(), { recursive: true }); fs.writeFileSync(tepCpu, JSON.stringify(cpu));
  // NGƯỜI BÁN CKEY (anh 26/10/2026 "giao cho Nguyên"): spy-bao-tri-ckey.timer (box3, 6 giờ) ghi danh sách sống — Nguyên canh việc đó còn chạy, dòng nào hết người bán,
  // người bán nào đổi giá (cần anh bấm chấp nhận trên ckey.vn), danh sách đổi so với nhịp trước
  const ck = docJson('/var/lib/spy/ckey-tuyen.json'), ckeyTruoc = docJson(`${DATA()}/tai-nguyen.json`)?.ckey ?? null;
  const ckey = ck ? { cap_nhat: ck.cap_nhat, dong: ck.dong, chi_tiet: ck.chi_tiet } : null;
  return { luc: new Date().toISOString(), lan, khoa, may: { ...box3, ramMB, daemon }, taiSan, vps, ckey, ckeyTruoc };
}

/** Nhịp (worker/nhip.mjs): chụp → lưu → cảnh báo MỚI (hoặc quá 6 giờ chưa nhắc) → Telegram. */
export async function nhipTaiNguyen(nguoi, { ten = nguoi } = {}) {
  const s = await chupTaiNguyen();
  fs.mkdirSync(DATA(), { recursive: true });
  fs.writeFileSync(`${DATA()}/tai-nguyen.json`, JSON.stringify(s, null, 1));
  // số dư cổng API + báo cáo ngày (tai-nguyen-api.mjs) — đọc lỗi thì phần proxy / máy vẫn chạy
  let api = null; try { api = await (await import('./tai-nguyen-api.mjs')).nhipApi({ ten, tep: `${DATA()}/tai-nguyen-api.json` }); } catch (e) { console.error('✗ số dư API:', e.message); }
  const cb = [...xetCanhBao(s), ...(api?.canhBao ?? [])], tep = `${DATA()}/tai-nguyen-tg.json`;
  let st = {}; try { st = JSON.parse(fs.readFileSync(tep, 'utf8')); } catch { /* lần đầu */ }
  const nhac = st.nhac ?? {}, bay = Date.now();
  const moi = cb.filter((c) => !nhac[c.khoa] || bay - nhac[c.khoa] > NGUONG.nhacLaiGio * 36e5);
  if (moi.length || api?.bao) {
    const { TG_BOT_TOKEN: T, TG_CHAT: C } = process.env;
    if (T && C) {
      const tg = (await import('./tg-phong.mjs')).ghiNut(async (m, b) => (await fetch(`https://api.telegram.org/bot${T}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: C, ...b }), signal: AbortSignal.timeout(15000) })).json());
      if (!st.topic) { const j = await tg('createForumTopic', { name: '🧰 Tài nguyên' }); if (j.ok) st.topic = j.result.message_thread_id; }
      if (moi.length) { const j = await tg('sendMessage', { message_thread_id: st.topic, parse_mode: 'HTML', text: `<b>${ten} · Phòng Tài nguyên</b>\n${moi.map((c) => `• ${c.chu}`).join('\n')}` });
        if (j.ok) for (const c of moi) nhac[c.khoa] = bay;
        // THỢ MÁY (iMac, worker/tho-may-viec.mjs): cảnh báo máy móc mới thành việc, trả lời dưới đúng tin này — hỏng không ảnh hưởng phần báo
        if (j.ok) try { (await import('./tho-may-viec.mjs')).themTuCanhBao(moi, { topic: st.topic, msg: j.result?.message_id }); } catch (e) { console.error('✗ hàng thợ máy:', e.message); } }
      if (api?.bao) { const j = await tg('sendMessage', { message_thread_id: st.topic, parse_mode: 'HTML', text: api.bao }); if (j.ok) api.ghiBao(); }
    }
  }
  for (const k of Object.keys(nhac)) if (!cb.some((c) => c.khoa === k)) delete nhac[k];   // hết chuyện → lần sau tái phát báo lại ngay
  fs.writeFileSync(tep, JSON.stringify({ ...st, nhac }));
  if (api) fs.writeFileSync(`${DATA()}/tai-nguyen-api.json`, JSON.stringify({ ...api.st, du: api.du, loi: api.loi, luc: new Date().toISOString() }, null, 1));
  return { canh_bao: cb.length, gui: moi.length, ...(api?.bao ? { bao_cao: api.st.baoNgay ? 'đã gửi' : 'chưa gửi được' } : {}) };
}

if (process.argv[1]?.endsWith('tai-nguyen.mjs')) {
  if (process.argv.includes('--tu-kiem')) {
    const assert = (await import('node:assert')).default, bay = Date.parse('2026-10-19T00:00:00Z'), gio = (h) => new Date(bay - h * 36e5).toISOString();
    const may = { ban: 30, phut: 30, nang: [], ramMB: 4000, daemon: true };
    const k = (x) => xetCanhBao(x, bay).map((c) => c.khoa);
    assert.deepStrictEqual(k({ lan: [{ lan: 'goc_thuong', may: 'box3', cuoi: gio(0.5) }], khoa: [], may }), [], 'làn chạy 30 phút trước: im');
    assert.deepStrictEqual(k({ lan: [{ lan: 'cao_chinh', may: 'imac', cuoi: gio(32) }], khoa: [], may }), ['lan:cao_chinh'], 'máy cào chết 32 giờ (17–19/10)');
    assert.deepStrictEqual(k({ lan: [{ lan: 'cao_chinh', may: 'tat', cuoi: gio(32) }], khoa: [], may }), [], 'làn tắt: không báo đứng');
    assert.deepStrictEqual(k({ lan: [{ lan: 'cao_chinh', may: 'tat', cuoi: null }], khoa: [{ ma: 'yY4C', lan: 'cao_chinh', het: bay / 1000 + 14 * 86400 }], may }), ['nam:yY4C'], 'khoá trả tiền mà làn tắt = slot nằm không');
    assert.deepStrictEqual(k({ lan: [{ lan: 'cao_chinh', may: 'imac', cuoi: gio(0) }], khoa: [{ ma: '08wY', lan: 'cao_chinh', het: bay / 1000 + 3600 }], may }), ['het:08wY'], 'khoá còn 1 giờ');
    assert.deepStrictEqual(k({ lan: [{ lan: 'spypro', may: 'imac', cuoi: gio(2.5) }], khoa: [], may }), [], 'spypro trần 3 giờ');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may: { ban: 92, phut: 30, nang: ['88% node nap.mjs'], ramMB: 900, daemon: true } }), ['box3:tai', 'box3:ram'], 'box3 bận 92% suốt 30 phút + thiếu RAM');
    assert.ok(xetCanhBao({ lan: [], khoa: [], may: { ...may, ban: 92, nang: ['88% node nap.mjs'] } }, bay)[0].chu.includes('nặng nhất: 88% node nap.mjs'), 'báo kèm tiến trình nặng nhất');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may: { ...may, ban: 60 } }), [], 'bận 60% (deploy nhói một lúc): im');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may: { ...may, ban: null } }), [], 'không đo được CPU: không báo bừa');
    const st = (u, n, s, i, w) => `cpu  ${u} ${n} ${s} ${i} ${w} 0 0 0 0 0`;
    assert.strictEqual(banCpu(st(0, 0, 0, 0, 0), st(90, 0, 10, 0, 0)), 100, 'toàn bận');
    assert.strictEqual(banCpu(st(0, 0, 0, 0, 0), st(10, 0, 0, 40, 50)), 10, 'chờ đĩa (iowait) tính là rỗi');
    assert.strictEqual(banCpu('', st(1, 0, 0, 1, 0)), null, 'thiếu lần trước → null');
    const ts = (id, ngay, thang = 37500000) => ({ id, ten: 'VPS may-cao-vn', nha: 'vpschinhhang', het: new Date(bay + ngay * 864e5).toISOString(), thang, tien: 'VND' });
    assert.deepStrictEqual(k({ lan: [], khoa: [], may, taiSan: [ts(17, 20)] }), [], 'tài sản còn 20 ngày: im');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may, taiSan: [ts(17, 3)] }), ['taisan:17'], 'VPS còn 3 ngày: báo');
    assert.ok(xetCanhBao({ lan: [], khoa: [], may, taiSan: [ts(17, 3)] }, bay)[0].chu.includes('375.000 VND/tháng'), 'báo kèm chi phí tháng');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may, taiSan: [ts(17, -1)] }), ['taisan:17'], 'đã hết hạn: báo');
    const lanVps = [{ lan: 'cao_chinh', may: 'may-cao-vn', cuoi: gio(0) }];
    assert.deepStrictEqual(k({ lan: lanVps, khoa: [], may, vps: [{ ten: 'may-cao-vn', toi: false }] }), ['vps:may-cao-vn:toi'], 'VPS mất kết nối khi có làn');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may, vps: [{ ten: 'may-cao-vn', toi: false }] }), [], 'VPS mất kết nối nhưng không có làn: im');
    assert.deepStrictEqual(k({ lan: lanVps, khoa: [], may, vps: [{ ten: 'may-cao-vn', toi: true, daemon: false, ban: 97, phut: 30, nang: [] }] }), ['vps:may-cao-vn:daemon', 'vps:may-cao-vn:tai'], 'VPS daemon tắt + quá tải');
    const ckT = (h, dong, chi_tiet = {}, truoc) => ({ lan: [], khoa: [], may, ckey: { cap_nhat: gio(h), dong, chi_tiet }, ckeyTruoc: truoc ? { dong: truoc } : null });
    assert.deepStrictEqual(k(ckT(2, { haiku: ['ckey:a/h'] })), [], 'ckey vừa bảo trì, đủ người bán: im');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may, ckey: null }), ['box3:ckey'], 'chưa có tệp danh sách: báo (thợ máy nhận)');
    assert.deepStrictEqual(k(ckT(20, { haiku: ['ckey:a/h'] })), ['box3:ckey'], 'việc bảo trì đứng 20 giờ');
    assert.deepStrictEqual(k(ckT(1, { sonnet: [] })), ['ckey-dong:sonnet'], 'dòng hết người bán');
    assert.deepStrictEqual(k(ckT(1, { opus: ['ckey:x/o'] }, { opus: [{ id: 't/o', song: false, loi: 'The price of this model has changed. Accept the new price in the dashboard' }] })), ['ckey-gia:t/o'], 'người bán đổi giá → anh quyết');
    assert.deepStrictEqual(k(ckT(1, { haiku: ['ckey:b/h', 'ckey:a/h'] }, {}, { haiku: ['ckey:a/h', 'ckey:c/h'] })).map((x) => x.split(':').slice(0, 2).join(':')), ['ckey-doi:haiku'], 'danh sách đổi → báo một lần');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may }), [], 'ảnh chụp cũ không có trường ckey: không báo bừa');
    const vpsT = (x) => k({ lan: lanVps, khoa: [], may, vps: [{ ten: 'may-cao-vn', toi: true, daemon: true, ban: 40, phut: 30, nang: [], ...x }] });
    assert.deepStrictEqual(vpsT({ ramMB: 286, swapMB: 2200, dia: 60 }), ['vps:may-cao-vn:ram'], 'VPS còn 286 MB (28/10/2026): báo thiếu RAM');
    assert.deepStrictEqual(vpsT({ ramMB: 850, swapMB: 2200, dia: 60 }), [], 'VPS còn 850 MB: im');
    assert.deepStrictEqual(vpsT({ ramMB: 850, dia: 91 }), ['vps:may-cao-vn:dia'], 'ổ 91%: báo');
    assert.deepStrictEqual(vpsT({}), [], 'ảnh chụp cũ chưa có RAM / ổ: không báo bừa');
    console.log('tai-nguyen tu-kiem ok');
  } else if (process.argv.includes('--in')) {
    const s = await chupTaiNguyen(); console.log(JSON.stringify(s, null, 1)); console.log(xetCanhBao(s));
  }
}

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
export const NGUONG = { lanDungGio: 2, spyproDungGio: 3, khoaConNgay: 3, cpuBan: 85, ramMB: 1200, nhacLaiGio: 6, taiSanConNgay: 5, ckeyDungGio: 13, vpsRamMB: 400, diaPt: 85, luotQuaGio: 16, napMatGio: 18, giaoDichGio: 5, matNhipPhut: 15, thoQuaGio: 8 };
// QUÁ TẢI = % CPU BẬN THẬT trung bình giữa hai nhịp (~30 phút, /proc/stat; chờ đĩa/mạng tính là rỗi) — KHÔNG dùng load average 1 phút: nó đếm cả
// tiến trình ngồi chờ mạng/đĩa và một phút nhói là kêu (22/10/2026: box3 "thỉnh thoảng quá tải" theo nhịp deploy spy; VPS CPU rỗi 97% mà tải 4).
// Báo kèm 3 tiến trình nặng nhất lúc chụp → biết nghẽn ở đâu, không đoán.
// GIỜ CPU "NICE" TÍNH LÀ RỖI (01/11/2026): lô cắt video ethopex chạy nice 19 (ffmpeg + tesseract) nhường mọi việc khác, vậy mà đếm là bận →
// box3:tai kêu 5 lần trong 2 ngày, thợ máy mở 5 lượt đều kết "không sửa" (đo: 97% bận = 67% nice + 30% việc thật). Quá tải = việc ưu tiên thường tranh nhau.
const TOP3 = `top -b -c -n 2 -d 2 -o %CPU -w 300 | awk '/^top -/{n++} n==2 && $1 ~ /^[0-9]+$/ && c++ < 3 {a=""; for(i=12;i<=NF&&i<=15;i++) a=a" "$i; print $9"%"substr(a,1,70)}'`;
/** Thuần: hai dòng "cpu …" của /proc/stat → % CPU bận giữa hai lần đọc (rỗi = nice + idle + iowait); không tính được → null */
export function banCpu(truoc, nay) {
  const so = (d) => String(d || '').trim().split(/\s+/).slice(1).map(Number), a = so(truoc), b = so(nay), cong = (x) => x.reduce((t, v) => t + (v || 0), 0);
  if (a.length < 5 || b.length < 5) return null;
  const tong = cong(b) - cong(a), roi = b[1] + b[3] + b[4] - a[1] - a[3] - a[4];
  return tong > 0 ? Math.round(100 - (100 * roi) / tong) : null;
}
// MÁY CHẠY VPS (22/10/2026): máy cào chính chạy trên VPS vpschinhhang may-cao-vn — phòng canh nó qua ssh (daemon trình duyệt + tải), tên máy trùng
// giá trị may_cao_lan.may để biết làn nào đang giao cho nó.
// MÁY CÀO NHÀ (06/11/2026, anh: "báo cho phòng tài nguyên về report định kỳ về HP này"): HP EliteDesk ở nhà, Ubuntu WSL2, nằm sau Deco nên box3 KHÔNG
// ssh vào được → máy TỰ ĐẨY ảnh chụp 5 phút / lần (spy-on-tc scripts/bao-may-nha.py, timer spy-bao-may-nha) vào `tep`; cũ quá `tre` phút = mất liên lạc.
// `ten` trùng may_cao_lan.may. Máy kiểu `tep` báo thêm từng dịch vụ (dv) và ổ C: Windows (Ubuntu nằm trong ổ ảo trên C:).
export const VPS = { 'may-cao-vn': { ssh: 'root@116.118.28.214', daemon: 'spy-may-cao-daemon' },
  'may-cao-nha': { tep: '/var/lib/spy/may-nha.json', tre: 15, daemon: 'spy-may-cao-daemon' } };

/** Thuần: ảnh chụp máy TỰ ĐẨY (scripts/bao-may-nha.py) → cùng khuôn với VPS ssh. Cũ quá v.tre phút / thiếu tệp = toi:false (cuPhut: bao lâu rồi).
 *  Ổ: lấy mức đầy hơn giữa ổ Ubuntu và ổ C: Windows (Ubuntu nằm trong ổ ảo trên C:). */
export function docMayDay(ten, v, j, bayGio = Date.now()) {
  const cuPhut = j?.luc ? Math.round((bayGio - Date.parse(j.luc)) / 6e4) : null;
  if (cuPhut == null || cuPhut > (v.tre ?? 15)) return { ten, toi: false, day: true, cuPhut };
  return { ten, toi: true, day: true, cuPhut, daemon: j.dv?.[v.daemon] === 'active', ramMB: j.ramMB, swapMB: j.swapMB,
    dia: Math.max(j.diaWsl ?? 0, j.diaC ?? 0), diaCConGB: j.diaCConGB, ban: j.ban ?? null, phut: j.phut ?? null, nang: j.nang ?? [], dv: j.dv ?? {}, chayGio: j.chayGio };
}

const gioVNChu = (t) => { const x = new Date(Date.parse(t) + 7 * 36e5).toISOString(); return `${x.slice(11, 16)} ${x.slice(8, 10)}/${x.slice(5, 7)}`; };   // 08:06 06/11
const thoatHtml = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Thuần: GIÁM SÁT PHIÊN DÀI từ ngoài máy chạy (anh 07/11/2026: "phiên chạy quá lâu mà phát sinh lỗi là bị thiệt hại vì thời gian idle… giám sát độc lập bên ngoài").
 *  Làn "đứng" chỉ đo NHỊP SỐNG, không đo KẾT QUẢ: 06/11/2026 ba lượt liền nạp hỏng (12:27, 17:02, 21:47) mà nhịp vẫn đều nên không tin nào. Đây đo thứ thật:
 *  loi = lượt thoát lỗi gần nhất (scripts/cao.sh giữ riêng, lượt sau không ghi đè) · napCuoi = lượt nạp thành công cuối (luot_cao.xong) · giaoDichGio = giao dịch DB lâu nhất
 *  · tt + song = lượt đang chạy + nhịp 30 giây · tho = dịch vụ thợ cắt HP. Khoá 'luot:' / 'tho:' không vào hàng thợ máy (LOAI_SUA): báo anh, không tự gọi Claude. */
export function xetPhienLau(p, bayGio = Date.now()) {
  const ra = [], gio = (t) => (bayGio - Date.parse(t)) / 36e5;
  if (p.chinhBat !== false) {
    if (p.loi?.ma && p.loi.xong && !(p.napCuoi && Date.parse(p.napCuoi) > Date.parse(p.loi.xong))) {
      const dong = String(p.loi.nhat_ky ?? '').split('\n').filter((l) => /Error|FATAL|heap out of memory|surrogates/.test(l) && !/^\s*(at |raise )/.test(l)).pop();
      ra.push({ khoa: `luot:loi:${p.loi.bat_dau}`, chu: `Lượt cào chính bắt đầu ${gioVNChu(p.loi.bat_dau)} <b>thoát lỗi</b> lúc ${gioVNChu(p.loi.xong)} (mã ${p.loi.ma}), chưa có lượt nạp nào thành công sau đó${dong ? `: ${thoatHtml(dong.trim().slice(0, 140))}` : ''}` });
    }
    if (p.napCuoi && gio(p.napCuoi) > NGUONG.napMatGio) ra.push({ khoa: 'luot:khong-nap', chu: `Spy <b>${gio(p.napCuoi).toFixed(0)} giờ chưa nạp được lượt nào</b> (lượt nạp xong cuối bắt đầu ${gioVNChu(p.napCuoi)})` });
    if (p.tt?.dang_chay && p.tt.bat_dau && gio(p.tt.bat_dau) > NGUONG.luotQuaGio) ra.push({ khoa: 'luot:qua-gio', chu: `Lượt cào chính chạy <b>${gio(p.tt.bat_dau).toFixed(0)} giờ</b> chưa xong (bắt đầu ${gioVNChu(p.tt.bat_dau)}, bước: ${thoatHtml(p.song?.buoc || '?')})` });
    if (p.tt?.dang_chay && p.song?.luc && (bayGio / 1000 - p.song.luc) / 60 > NGUONG.matNhipPhut) ra.push({ khoa: 'luot:mat-nhip', chu: `Lượt cào chính <b>mất nhịp ${Math.round((bayGio / 1000 - p.song.luc) / 60)} phút</b> (máy tắt / mất mạng / bị giết?) — bước cuối: ${thoatHtml(p.song.buoc || '?')}` });
  }
  if (p.giaoDichGio > NGUONG.giaoDichGio) ra.push({ khoa: 'luot:giao-dich', chu: `DB spy có <b>giao dịch mở ${p.giaoDichGio.toFixed(1)} giờ</b> — đứt mạng là mất trắng cả lượt nạp` });
  if (p.tho?.trang === 'failed') ra.push({ khoa: 'tho:loi', chu: `Thợ cắt máy HP (${p.tho.ten}) <b>thoát lỗi</b>` });
  else if (p.tho?.tu && gio(p.tho.tu) > NGUONG.thoQuaGio) ra.push({ khoa: 'tho:qua-gio', chu: `Thợ cắt máy HP (${p.tho.ten}) chạy <b>${gio(p.tho.tu).toFixed(0)} giờ</b> chưa xong (từ ${gioVNChu(p.tho.tu)})` });
  return ra;
}

/** Thuần: ảnh chụp → cảnh báo [{khoa, chu}]. lan: [{lan, may, cuoi (ISO|null)}] · khoa: [{ma, lan, het (giây epoch)}] · may: {ban, phut, nang, ramMB, daemon} */
export function xetCanhBao(s, bayGio = Date.now()) {
  const ra = s.phienLau ? xetPhienLau(s.phienLau, bayGio) : [];
  for (const l of s.lan) {
    if (l.may === 'tat') continue;
    const gio = l.cuoi ? (bayGio - Date.parse(l.cuoi)) / 36e5 : Infinity;
    const tran = l.lan === 'spypro' ? NGUONG.spyproDungGio : NGUONG.lanDungGio;
    if (gio > tran) ra.push({ khoa: `lan:${l.lan}`, chu: `Làn <b>${l.lan}</b> (máy ${l.may}) đứng ${gio === Infinity ? 'chưa chạy lần nào' : `${gio.toFixed(1)} giờ`}` });
  }
  const lanBat = new Set(s.lan.filter((l) => l.may !== 'tat').map((l) => l.lan));
  for (const k of s.khoa) {
    const ngay = (k.het * 1000 - bayGio) / 864e5;
    if (k.het && ngay < NGUONG.khoaConNgay) ra.push({ khoa: `het:${k.ma}`, chu: `Khoá 2proxy <b>…${k.ma}</b> (${k.lan ?? (k.ngoai ? `dùng cho ${k.ngoai}` : 'chưa gắn làn')}) ${ngay < 0 ? 'ĐÃ HẾT HẠN' : `còn ${ngay.toFixed(1)} ngày`} — anh quyết gia hạn hay bỏ (máy không tự gia hạn)` });
    if (!k.ngoai && (!k.lan || !lanBat.has(k.lan))) ra.push({ khoa: `nam:${k.ma}`, chu: `Khoá 2proxy <b>…${k.ma}</b> đang trả tiền mà ${k.lan ? `làn ${k.lan} đang tắt` : 'không làn nào dùng'} — slot nằm không` });
  }
  const nang = (m) => (m.nang?.length ? ` — nặng nhất: ${m.nang.join(' · ')}` : '');
  if (s.may.ban >= NGUONG.cpuBan) ra.push({ khoa: 'box3:tai', chu: `box3 quá tải: CPU bận ${s.may.ban}% suốt ${s.may.phut} phút qua${nang(s.may)}` });
  // Ổ BOX3 (01/11/2026: lên 95% — /root/.cache/ethopex 12 GB không cất được Drive — mà phòng chỉ canh ổ VPS, không ai báo). Khoá 'dia:' không vào hàng
  // thợ máy (LOAI_SUA): dọn ổ là quyết định giữ / cất của anh, thợ máy spy không được tự xoá.
  if (s.may.dia >= NGUONG.diaPt) ra.push({ khoa: 'dia:box3', chu: `box3 ổ cứng đầy ${s.may.dia}% — còn ${s.may.diaConGB} GB` });
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
    // đổi giá: máy iMac tc.on.spy.ckey-gia (spy-on-tc/scripts/ckey-gia.mjs, mỗi giờ) tự chấp nhận khi trong chốt, ghi /var/lib/spy/ckey-gia.json.
    // Nguyên chỉ báo: máy đã nhận (một lần) · vượt chốt (anh quyết, kèm giá) · máy đứng / phiên ckey hết (thợ máy, khoá box3:)
    const g = s.ckeyGia, gGio = g?.luc ? (bayGio - Date.parse(g.luc)) / 36e5 : Infinity, tuChoi = new Set(gGio < 24 ? (g.tu_choi ?? []).map((x) => x.model) : []);
    const doiGia = Object.values(c?.chi_tiet ?? {}).flat().filter((u) => !u.song && /price .*changed|accept the new price/i.test(u.loi || '')).map((u) => u.id);
    // nhom + trường dữ liệu: soanTin gom các mục ckey thành bảng <pre> (anh 31/10/2026 "trình bày lại cho dễ nhìn"); chu giữ cho hàng thợ máy / nhật ký
    if (gGio < 24) for (const x of g.nhan ?? []) ra.push({ khoa: `ckey-nhan:${x.model}:${g.luc}`, nhom: 'ckey-nhan', ...x, chu: `Máy đã tự chấp nhận giá mới người bán ckey <b>${x.model}</b> — vào ${x.vao}, ra ${x.ra} (${x.ly_do})` });
    if (gGio < 24) for (const x of g.tu_choi ?? []) ra.push({ khoa: `ckey-gia:${x.model}`, nhom: 'ckey-vuot', ...x, chu: `Người bán ckey <b>${x.model}</b> tăng giá vượt chốt — vào ${x.vao}, ra ${x.ra} (${x.ly_do}). Máy không tự nhận; spy dùng người bán khác` });
    if (doiGia.some((id) => !tuChoi.has(id))) {
      if (g?.phien === 'het' && gGio < 24) ra.push({ khoa: 'box3:ckey-gia-phien', chu: 'Phiên ckey.vn trong profile br #10 (iMac, vault #534) đã đăng xuất — máy tự chấp nhận giá ckey đứng; đăng nhập lại bằng nút Google (mikerey887)' });
      else if (gGio > 3) ra.push({ khoa: 'box3:ckey-gia', chu: `Có người bán ckey đổi giá (${doiGia.join(', ')}) mà máy tự chấp nhận giá (iMac tc.on.spy.ckey-gia) ${gGio === Infinity ? 'chưa chạy lần nào' : `đứng ${gGio.toFixed(1)} giờ`}${g?.loi ? ` — lỗi: ${g.loi.slice(0, 120)}` : ''}` });
    }
    const truoc = s.ckeyTruoc?.dong;
    if (truoc && c?.dong) for (const [k, ds] of Object.entries(c.dong)) {
      const cu = truoc[k] ?? [], vao = ds.filter((x) => !cu.includes(x)), ra2 = cu.filter((x) => !ds.includes(x)), ten = (x) => x.replace(/^ckey:/, '');
      if (vao.length || ra2.length) ra.push({ khoa: `ckey-doi:${k}:${c.cap_nhat}`, nhom: 'ckey-doi', dong: k, them: vao.map(ten), bo: ra2.map(ten), dau: ten(ds[0] || '—'), chu: `Người bán ckey dòng <b>${k}</b> đổi:${vao.length ? ` thêm ${vao.map(ten).join(', ')}` : ''}${ra2.length ? ` · bỏ ${ra2.map(ten).join(', ')}` : ''} → đầu chuỗi: ${ten(ds[0] || '—')}` });
    }
  }
  for (const v of s.vps ?? []) {
    const coLan = s.lan.some((l) => l.may === v.ten);
    if (!v.toi) { if (coLan) ra.push({ khoa: `vps:${v.ten}:toi`, chu: v.day ? `Máy cào nhà <b>${v.ten}</b> không gửi tình trạng ${v.cuPhut != null ? `${v.cuPhut} phút` : '(chưa từng gửi)'} — máy ngủ / mất mạng / mất điện? Làn cào giao cho nó đang đứng` : `VPS <b>${v.ten}</b> không ssh vào được — làn cào giao cho nó đang đứng` }); continue; }
    const chet = Object.entries(v.dv ?? {}).filter(([, t]) => t !== 'active').map(([u, t]) => `${u} (${t || '?'})`);
    if (chet.length) ra.push({ khoa: `vps:${v.ten}:dv`, chu: `Máy <b>${v.ten}</b>: dịch vụ không chạy — ${chet.join(', ')}` });
    if (coLan && !v.daemon) ra.push({ khoa: `vps:${v.ten}:daemon`, chu: `VPS <b>${v.ten}</b>: trình duyệt máy cào không chạy trong khi có làn giao cho nó` });
    if (v.ramMB != null && v.ramMB < NGUONG.vpsRamMB) ra.push({ khoa: `vps:${v.ten}:ram`, chu: `VPS <b>${v.ten}</b> thiếu RAM: còn ${v.ramMB} MB trống, swap đang dùng ${v.swapMB ?? '?'} MB` });
    if (v.dia >= NGUONG.diaPt) ra.push({ khoa: `vps:${v.ten}:dia`, chu: `VPS <b>${v.ten}</b> ổ cứng đầy ${v.dia}%` });
    if (v.ban >= NGUONG.cpuBan) ra.push({ khoa: `vps:${v.ten}:tai`, chu: `VPS <b>${v.ten}</b> quá tải: CPU bận ${v.ban}% suốt ${v.phut} phút qua${nang(v)}` });
  }
  return ra;
}

const docEnv = () => Object.fromEntries(fs.readFileSync(SPY_ENV, 'utf8').split('\n').map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const psqlSpy = (env, sql) => execFileSync('psql', [env.DATABASE_URL, '-tAF', '|', '-c', sql], { encoding: 'utf8', timeout: 20000 }).trim().split('\n').filter(Boolean).map((r) => r.split('|'));

const MOS2_URL = () => (fs.readFileSync('/opt/earns-marketing-os-v2/.env.production', 'utf8').match(/^DATABASE_URL=(.*)$/m) || [])[1]?.replace(/^["']|["']$/g, '');
const psqlMos2 = (sql) => execFileSync('psql', [MOS2_URL(), '-tAF', '|', '-c', sql], { encoding: 'utf8', timeout: 20000 }).trim().split('\n').filter(Boolean).map((r) => r.split('|'));

async function hanKhoa(env, tep) {
  let c = {}; try { c = JSON.parse(fs.readFileSync(tep, 'utf8')); } catch { /* lần đầu */ }
  if (Date.now() / 1000 - (c.luc ?? 0) < 3600 && c.don) return { het: c.het ?? {}, don: c.don };
  const api = async (q) => (await fetch(`https://app.2proxy.vn/api/proxyv2.php?key=${env.TWOPROXY_API_KEY}&${q}`, { signal: AbortSignal.timeout(30000) })).json().catch(() => []);
  const het = {}, don = {};   // don: khoá → mã đơn 2proxy, để đối với vault mos2 (data.ma_don) biết khoá dùng cho dự án nào ngoài spy
  for (const o of (await api('sukien=listorder')) || []) {
    await new Promise((r) => setTimeout(r, 4500));   // API: "chờ 4s giữa hai lần lấy đơn"
    for (const k of (await api(`sukien=listproxy&ma_don_hang=${o.order_code}`)) || []) if (k?.proxy) { het[k.proxy] = Number(k.time) || 0; don[k.proxy] = o.order_code; }
  }
  fs.writeFileSync(tep, JSON.stringify({ luc: Math.floor(Date.now() / 1000), het, don }));
  return { het, don };
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
  const { het, don } = await hanKhoa(env, `${DATA()}/tai-nguyen-khoa.json`);
  // Khoá mua cho dự án KHÁC spy (29/10/2026: …Lr23 = 2proxy US_PRO của tablaris, vault #528, báo nhầm "không làn nào dùng") — chủ ghi ở vault mos2:
  // account_state.data.ma_don + dung_cho. Đọc hỏng thì coi như không có chủ (báo dư còn hơn im).
  let chuDon = {};
  try { chuDon = Object.fromEntries(psqlMos2(`select data->>'ma_don', coalesce(data->>'dung_cho', 'acct #' || account_id) from account_state where data ? 'ma_don'`)); } catch (e) { console.error('✗ vault mos2 (ma_don):', e.message.split('\n')[0]); }
  const khoa = [];
  for (const [bien, l] of Object.entries(KHOA_LAN)) for (const k of String(env[bien] ?? '').split(/\s+/).filter(Boolean)) khoa.push({ ma: k.slice(-4), bien, lan: l, het: het[k] ?? 0 });
  for (const k of Object.keys(het)) if (!khoa.some((x) => k.endsWith(x.ma))) khoa.push({ ma: k.slice(-4), bien: null, lan: null, het: het[k], ...(chuDon[don?.[k]] ? { ngoai: chuDon[don[k]] } : {}) });
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
  const [diaConGB, dia] = sh(`df -B1G --output=avail,pcent / | tail -1`).split(/\s+/).map((x) => Number(x.replace('%', '')));
  let daemon = false; try { daemon = execFileSync('systemctl', ['is-active', 'spy-cao-daemon'], { encoding: 'utf8' }).trim() === 'active'; } catch { /* không active */ }
  // sổ tài sản mos2 (infra_resources): dòng còn hạn trong 30 ngày tới — đọc hỏng thì bỏ phần này, phần còn lại vẫn chạy
  let taiSan = [];
  try {
    taiSan = psqlMos2(`select id, label, provider, expires_at, cost_monthly, currency from infra_resources where status = 'active' and expires_at is not null and expires_at < now() + interval '30 days' order by expires_at`)
      .map(([id, ten, nha, het, thang, tien]) => ({ id: Number(id), ten, nha, het: new Date(het).toISOString(), thang: Number(thang) || 0, tien }));
  } catch (e) { console.error('✗ sổ tài sản mos2:', e.message.split('\n')[0]); }
  // máy chạy VPS: daemon + tải qua ssh (ConnectTimeout 8 giây); không vào được = toi:false
  const vps = Object.entries(VPS).map(([ten, v]) => {
    if (v.tep) return docMayDay(ten, v, docJson(v.tep));   // máy tự đẩy (máy cào nhà): đọc ảnh chụp, không ssh
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
  const ckey = ck ? { cap_nhat: ck.cap_nhat, dong: ck.dong, chi_tiet: ck.chi_tiet } : null, ckeyGia = docJson('/var/lib/spy/ckey-gia.json');
  // GIÁM SÁT PHIÊN DÀI (xetPhienLau) — đọc hỏng thì bỏ phần này, phần còn lại vẫn chạy
  let phienLau = null;
  try {
    const [[napCuoi]] = psqlSpy(env, 'select max(xong) from luot_cao'), [[gd]] = psqlSpy(env, `select coalesce(extract(epoch from now() - min(xact_start)) / 3600, 0) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()`);
    const mayNha = docJson(VPS['may-cao-nha'].tep);
    phienLau = { chinhBat: lan.find((l) => l.lan === 'cao_chinh')?.may !== 'tat', tt, song, loi: docJson('/opt/spy/tep/luot-loi-cuoi.json'), napCuoi: napCuoi ? new Date(napCuoi).toISOString() : null, giaoDichGio: Number(gd) || 0, tho: mayNha?.phien?.['etp-tho-nha'] ? { ten: 'etp-tho-nha', ...mayNha.phien['etp-tho-nha'] } : null };
  } catch (e) { console.error('✗ giám sát phiên dài:', e.message.split('\n')[0]); }
  return { luc: new Date().toISOString(), lan, khoa, may: { ...box3, ramMB, daemon, dia, diaConGB }, taiSan, vps, ckey, ckeyTruoc, ckeyGia, phienLau };
}

/** Thuần — tin Telegram: cảnh báo thường thành dòng •, mục ckey gom thành ba khối bảng <pre> (dòng ≤ 30 ký tự cho vừa màn điện thoại):
 *  ⛔ vượt chốt (anh quyết) · ✅ máy đã tự nhận · 🔄 người bán đổi theo dòng. */
export function soanTin(ten, ds) {
  const e = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ban = (id) => String(id).split('/')[0], mau = (id) => String(id).split('/').slice(1).join('/').replace(/^claude-|^om-/, '');
  const gia = (s) => String(s ?? '').replace(/\s*VND/g, '');
  const tang = (x) => x.ly_do?.match(/tăng (\d+%)/)?.[1] ? `+${x.ly_do.match(/tăng (\d+%)/)[1]}` : '';
  const giaKhoi = (xs) => xs.map((x) => [`${ban(x.model)}`, ` ${mau(x.model)}${tang(x) ? ` · ${tang(x)}` : ''}`, ` vào ${gia(x.vao)}`, ` ra  ${gia(x.ra)}`].map(e).join('\n')).join('\n\n');
  const thuong = ds.filter((c) => !c.nhom), vuot = ds.filter((c) => c.nhom === 'ckey-vuot'), nhan = ds.filter((c) => c.nhom === 'ckey-nhan'), doi = ds.filter((c) => c.nhom === 'ckey-doi');
  const khoi = [`<b>${e(ten)} · Phòng Tài nguyên</b>`];
  if (thuong.length) khoi.push(thuong.map((c) => `• ${c.chu}`).join('\n'));
  if (vuot.length) khoi.push(`⛔ <b>Tăng giá vượt chốt — máy không nhận</b>\n<i>giá ₫ / 1M token · spy dùng người bán khác</i>\n<pre>${giaKhoi(vuot)}</pre>`);
  if (nhan.length) khoi.push(`✅ <b>Máy đã tự nhận giá mới</b>\n<pre>${giaKhoi(nhan)}</pre>`);
  if (doi.length) khoi.push(`🔄 <b>Người bán ckey đổi</b>\n<pre>${doi.map((c) => [`${c.dong} → ${ban(c.dau)}`, ...c.them.map((x) => ` + ${ban(x)}`), ...c.bo.map((x) => ` − ${ban(x)}`)].map(e).join('\n')).join('\n\n')}</pre>`);
  return khoi.join('\n\n');
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
      if (moi.length) { const j = await tg('sendMessage', { message_thread_id: st.topic, parse_mode: 'HTML', text: soanTin(ten, moi) });
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
    const pk = (p) => xetPhienLau(p, bay).map((c) => c.khoa);
    assert.deepStrictEqual(pk({ napCuoi: gio(10), giaoDichGio: 3, tt: { dang_chay: true, bat_dau: gio(5) }, song: { luc: bay / 1000 - 60 } }), [], 'lượt đang chạy bình thường, nạp 3 giờ: im');
    assert.deepStrictEqual(pk({ napCuoi: gio(26) }), ['luot:khong-nap'], '06–07/11/2026: 26 giờ không lượt nạp nào thành công — nhịp sống vẫn đều');
    assert.ok(xetPhienLau({ napCuoi: '2026-10-18T01:06:00Z' }, Date.parse('2026-10-19T04:00:00Z'))[0].chu.includes('08:06 18/10'), 'giờ trong tin = GMT+7, dạng 08:06 18/10');
    const loi = { ma: 1, bat_dau: gio(9), xong: gio(1), nhat_ky: 'Error: Connection terminated unexpectedly\n    at Connection.<anonymous> (a.js:1)\nxong' };
    assert.deepStrictEqual(pk({ napCuoi: gio(10), loi }), [`luot:loi:${gio(9)}`], 'lượt thoát lỗi: báo');
    assert.ok(xetPhienLau({ napCuoi: gio(10), loi }, bay)[0].chu.includes('Connection terminated') && !xetPhienLau({ napCuoi: gio(10), loi }, bay)[0].chu.includes(' at Connection'), 'tin nêu đúng dòng lỗi, bỏ dòng stack');
    assert.deepStrictEqual(pk({ napCuoi: gio(0.5), loi }), [], 'đã có lượt nạp thành công sau lỗi: hết chuyện');
    assert.deepStrictEqual(pk({ napCuoi: gio(26), loi, chinhBat: false }), [], 'làn tắt có chủ ý: im');
    assert.deepStrictEqual(pk({ giaoDichGio: 5.5 }), ['luot:giao-dich'], 'giao dịch mở quá 5 giờ');
    assert.deepStrictEqual(pk({ tt: { dang_chay: true, bat_dau: gio(17) } }), ['luot:qua-gio'], 'lượt quá 16 giờ');
    assert.deepStrictEqual(pk({ tt: { dang_chay: true, bat_dau: gio(2) }, song: { luc: bay / 1000 - 1200 } }), ['luot:mat-nhip'], 'mất nhịp 20 phút: máy tắt / bị giết');
    assert.deepStrictEqual(pk({ tt: { dang_chay: false, bat_dau: gio(20) }, song: { luc: bay / 1000 - 9999 } }), [], 'lượt đã xong: không tính giờ, không tính nhịp');
    assert.deepStrictEqual(pk({ tho: { trang: 'failed' } }), ['tho:loi'], 'thợ cắt thoát lỗi');
    assert.deepStrictEqual(pk({ tho: { trang: 'activating', tu: gio(9) } }), ['tho:qua-gio'], 'thợ cắt quá 8 giờ');
    assert.deepStrictEqual(pk({ tho: { trang: 'activating', tu: gio(1) } }), [], 'thợ cắt 1 giờ: im');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may, phienLau: { napCuoi: gio(26) } }), ['luot:khong-nap'], 'xetCanhBao gọi phần phiên dài');
    assert.deepStrictEqual(k({ lan: [{ lan: 'goc_thuong', may: 'box3', cuoi: gio(0.5) }], khoa: [], may }), [], 'làn chạy 30 phút trước: im');
    assert.deepStrictEqual(k({ lan: [{ lan: 'cao_chinh', may: 'imac', cuoi: gio(32) }], khoa: [], may }), ['lan:cao_chinh'], 'máy cào chết 32 giờ (17–19/10)');
    assert.deepStrictEqual(k({ lan: [{ lan: 'cao_chinh', may: 'tat', cuoi: gio(32) }], khoa: [], may }), [], 'làn tắt: không báo đứng');
    assert.deepStrictEqual(k({ lan: [{ lan: 'cao_chinh', may: 'tat', cuoi: null }], khoa: [{ ma: 'yY4C', lan: 'cao_chinh', het: bay / 1000 + 14 * 86400 }], may }), ['nam:yY4C'], 'khoá trả tiền mà làn tắt = slot nằm không');
    assert.deepStrictEqual(k({ lan: [], khoa: [{ ma: 'Lr23', lan: null, ngoai: 'tablaris thu-thap', het: bay / 1000 + 30 * 86400 }], may }), [], 'khoá vault ghi dùng cho dự án khác (tablaris): không phải slot nằm không');
    assert.deepStrictEqual(k({ lan: [], khoa: [{ ma: 'Lr23', lan: null, het: bay / 1000 + 30 * 86400 }], may }), ['nam:Lr23'], 'khoá không chủ: vẫn báo');
    assert.ok(xetCanhBao({ lan: [], khoa: [{ ma: 'Lr23', lan: null, ngoai: 'tablaris thu-thap', het: bay / 1000 + 3600 }], may }, bay)[0].chu.includes('dùng cho tablaris'), 'sắp hết hạn vẫn báo, kèm chủ');
    assert.deepStrictEqual(k({ lan: [{ lan: 'cao_chinh', may: 'imac', cuoi: gio(0) }], khoa: [{ ma: '08wY', lan: 'cao_chinh', het: bay / 1000 + 3600 }], may }), ['het:08wY'], 'khoá còn 1 giờ');
    assert.deepStrictEqual(k({ lan: [{ lan: 'spypro', may: 'imac', cuoi: gio(2.5) }], khoa: [], may }), [], 'spypro trần 3 giờ');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may: { ban: 92, phut: 30, nang: ['88% node nap.mjs'], ramMB: 900, daemon: true } }), ['box3:tai', 'box3:ram'], 'box3 bận 92% suốt 30 phút + thiếu RAM');
    assert.ok(xetCanhBao({ lan: [], khoa: [], may: { ...may, ban: 92, nang: ['88% node nap.mjs'] } }, bay)[0].chu.includes('nặng nhất: 88% node nap.mjs'), 'báo kèm tiến trình nặng nhất');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may: { ...may, ban: 60 } }), [], 'bận 60% (deploy nhói một lúc): im');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may: { ...may, ban: null } }), [], 'không đo được CPU: không báo bừa');
    const st = (u, n, s, i, w) => `cpu  ${u} ${n} ${s} ${i} ${w} 0 0 0 0 0`;
    assert.strictEqual(banCpu(st(0, 0, 0, 0, 0), st(90, 0, 10, 0, 0)), 100, 'toàn bận');
    assert.strictEqual(banCpu(st(0, 0, 0, 0, 0), st(10, 0, 0, 40, 50)), 10, 'chờ đĩa (iowait) tính là rỗi');
    assert.strictEqual(banCpu(st(0, 0, 0, 0, 0), st(30, 67, 3, 0, 0)), 33, 'lô nice 19 chiếm 67% (ethopex 01/11): tính là rỗi');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may: { ...may, dia: 95, diaConGB: 4 } }), ['dia:box3'], 'ổ box3 95%');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may: { ...may, dia: 80, diaConGB: 15 } }), [], 'ổ box3 80%: im');
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
    const doiG = { opus: [{ id: 't/o', song: false, loi: 'The price of this model has changed. Accept the new price in the dashboard' }] };
    const vuot = { model: 't/o', vao: '1 → 9', ra: '2 → 18', ly_do: 'tăng 800%' };
    assert.deepStrictEqual(k(ckT(1, { opus: ['ckey:x/o'] }, doiG)), ['box3:ckey-gia'], 'đổi giá mà máy tự chấp nhận chưa chạy → thợ máy');
    assert.deepStrictEqual(k({ ...ckT(1, { opus: ['ckey:x/o'] }, doiG), ckeyGia: { luc: gio(1), phien: 'ok', nhan: [], tu_choi: [] } }), [], 'máy vừa chạy < 3 giờ: chờ lượt sau, im');
    assert.deepStrictEqual(k({ ...ckT(1, { opus: ['ckey:x/o'] }, doiG), ckeyGia: { luc: gio(1), phien: 'ok', nhan: [], tu_choi: [vuot] } }), ['ckey-gia:t/o'], 'vượt chốt → anh quyết');
    assert.deepStrictEqual(k({ ...ckT(1, { opus: ['ckey:x/o'] }, doiG), ckeyGia: { luc: gio(1), phien: 'het', nhan: [], tu_choi: [] } }), ['box3:ckey-gia-phien'], 'phiên ckey đăng xuất → thợ máy');
    assert.deepStrictEqual(k({ ...ckT(1, { opus: ['ckey:x/o'] }), ckeyGia: { luc: gio(1), phien: 'ok', nhan: [{ ...vuot, ly_do: 'ok' }], tu_choi: [] } }).map((x) => x.split(':')[0]), ['ckey-nhan'], 'máy đã nhận → báo một lần');
    assert.deepStrictEqual(k(ckT(1, { haiku: ['ckey:b/h', 'ckey:a/h'] }, {}, { haiku: ['ckey:a/h', 'ckey:c/h'] })).map((x) => x.split(':').slice(0, 2).join(':')), ['ckey-doi:haiku'], 'danh sách đổi → báo một lần');
    assert.deepStrictEqual(k({ lan: [], khoa: [], may }), [], 'ảnh chụp cũ không có trường ckey: không báo bừa');
    // máy cào nhà tự đẩy (06/11/2026)
    const BAY = Date.parse('2026-11-06T00:00:00Z'), vN = VPS['may-cao-nha'];
    const anh = (phut, x = {}) => ({ luc: new Date(BAY - phut * 6e4).toISOString(), ramMB: 8000, swapMB: 500, diaWsl: 1, diaC: 35, ban: 40, phut: 5, nang: [], dv: { 'spy-may-cao-daemon': 'active', 'spy-duong-ham-db': 'active' }, ...x });
    const lanNha = [{ lan: 'cao_chinh', may: 'may-cao-nha', cuoi: gio(0) }];
    const kNha = (j) => k({ lan: lanNha, khoa: [], may, vps: [docMayDay('may-cao-nha', vN, j, BAY)] });
    assert.deepStrictEqual(kNha(anh(3)), [], 'máy nhà gửi 3 phút trước, mọi thứ chạy: im');
    assert.deepStrictEqual(kNha(anh(40)), ['vps:may-cao-nha:toi'], 'máy nhà im 40 phút (ngủ / mất mạng): báo mất liên lạc');
    assert.deepStrictEqual(kNha(null), ['vps:may-cao-nha:toi'], 'chưa từng gửi: báo');
    assert.deepStrictEqual(kNha(anh(3, { dv: { 'spy-may-cao-daemon': 'active', 'spy-duong-ham-db': 'failed' } })), ['vps:may-cao-nha:dv'], 'đường hầm DB chết: báo dịch vụ');
    assert.deepStrictEqual(kNha(anh(3, { dv: { 'spy-may-cao-daemon': 'inactive' } })), ['vps:may-cao-nha:dv', 'vps:may-cao-nha:daemon'], 'trình duyệt chết: báo cả dịch vụ lẫn daemon');
    assert.deepStrictEqual(kNha(anh(3, { diaC: 92 })), ['vps:may-cao-nha:dia'], 'ổ C: Windows 92%: báo ổ');
    assert.ok(kNha(anh(40)).length && k({ lan: [], khoa: [], may, vps: [docMayDay('may-cao-nha', vN, anh(40), BAY)] }).length === 0, 'máy nhà mất liên lạc mà không có làn: im');
    const vpsT = (x) => k({ lan: lanVps, khoa: [], may, vps: [{ ten: 'may-cao-vn', toi: true, daemon: true, ban: 40, phut: 30, nang: [], ...x }] });
    assert.deepStrictEqual(vpsT({ ramMB: 286, swapMB: 2200, dia: 60 }), ['vps:may-cao-vn:ram'], 'VPS còn 286 MB (28/10/2026): báo thiếu RAM');
    assert.deepStrictEqual(vpsT({ ramMB: 850, swapMB: 2200, dia: 60 }), [], 'VPS còn 850 MB: im');
    assert.deepStrictEqual(vpsT({ ramMB: 850, dia: 91 }), ['vps:may-cao-vn:dia'], 'ổ 91%: báo');
    assert.deepStrictEqual(vpsT({}), [], 'ảnh chụp cũ chưa có RAM / ổ: không báo bừa');
    const tin = soanTin('Nguyên', [{ chu: 'VPS <b>x</b> mất kết nối' },
      { nhom: 'ckey-vuot', model: 'tuanxedich28/claude-sonnet-5-5-ccmax', vao: '1.560 VND → 10.660 VND', ra: '14.300 VND → 53.300 VND', ly_do: 'tăng 583% (> 50%)', chu: 'x' },
      { nhom: 'ckey-doi', dong: 'gemini-3.8-flash', them: ['hungdt/om-gemini-3.8-flash'], bo: [], dau: 'hungdt/om-gemini-3.8-flash', chu: 'x' }]);
    assert.ok(tin.includes('• VPS <b>x</b>') && tin.includes('⛔') && tin.includes('🔄') && !tin.includes('✅'), 'cảnh báo thường thành •, ckey thành khối, khối rỗng không in');
    assert.ok(tin.includes('+583%') && tin.includes('gemini-3.8-flash → hungdt'), 'bảng có % tăng và đầu chuỗi');
    for (const p of tin.match(/<pre>[\s\S]*?<\/pre>/g)) for (const d of p.replace(/<\/?pre>/g, '').split('\n')) assert.ok(d.length <= 30, `dòng bảng ≤ 30 ký tự: "${d}"`);
    console.log('tai-nguyen tu-kiem ok');
  } else if (process.argv.includes('--in')) {
    const s = await chupTaiNguyen(); console.log(JSON.stringify(s, null, 1)); console.log(xetCanhBao(s));
  }
}

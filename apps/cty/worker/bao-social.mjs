// PHÒNG SOCIAL TRAFFIC — báo cáo NGÀY của trưởng phòng Vân (anh 20/10/2026: "đã có phòng Social rồi, hãy update vào đó định kỳ mỗi ngày, Trưởng phòng").
// Nhịp máy `bao-social` (box3, cty-nhip.timer mỗi phút), $0: không gọi mô hình. Mỗi ngày một tin sau GIO_BAO (giờ VN, admin đổi được ở cột Tự làm —
// cờ `gio` của Vân trong nhip-chinh.json) vào chủ đề 📂 Social Traffic: hôm nay máy đăng lên được bao nhiêu / lịch định bao nhiêu (lỡ lượt nào),
// kho đã xếp lịch tới ngày nào theo máy × format (đỏ khi cạn trong 7 ngày), lịch dự kiến có còn được máy đăng cập nhật không.
// Nguồn: xv_may_video.da_dang (đã đăng, `ngay` = ngày VN) + xv_lich_du_kien (dang-may --du-kien ghi sau mỗi lượt, luật nhịp an toàn). Bảng đầy đủ: mos2 Social › Lịch đăng.
//   node worker/bao-social.mjs --in        in tin hôm nay (không gửi)
//   node worker/bao-social.mjs --tu-kiem
import fs from 'node:fs';
import path from 'node:path';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
export const GIO_BAO = '21:30';   // sau lượt 21:00 — lượt cuối trong ngày của máy đăng
const SAP_CAN_NGAY = 7, LICH_CU_GIO = 26;
const NEN = { youtube: 'YT', facebook: 'FB', fb_anh: 'FB ảnh', x: 'X', x_anh: 'X ảnh', tiktok: 'TikTok', instagram: 'IG', dailymotion: 'DM', threads: 'Threads', pinterest: 'Pinterest' };
const nhanNen = (n) => NEN[n] ?? (String(n).includes(':') ? `${NEN[String(n).split(':')[0]] ?? n} Page cũ` : n);   // Page cũ 'facebook:<acct>' (S06)
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ngayVn = (t = Date.now()) => new Date(t + 7 * 3600e3).toISOString().slice(0, 10);
const cong = (ngay, n) => new Date(Date.parse(`${ngay}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const dm = (n) => `${n.slice(8)}/${n.slice(5, 7)}`;
const tenNgan = (t) => String(t).split(' · ')[0];

/** Thuần: số liệu → chữ tin. s = { hom, may: [{ma, ten}], da: [{may, nen, url}], lich: {luc, ds: [{may, nen, ngay, gio, format}]} }, bayGio = epoch ms. */
export function tinBaoCao(s, bayGio = Date.now()) {
  const { hom } = s, ds = s.lich?.ds ?? [], ten = Object.fromEntries(s.may.map((m) => [m.ma, tenNgan(m.ten)]));
  const dinh = ds.filter((x) => x.ngay === hom), sau7 = cong(hom, SAP_CAN_NGAY);
  const dong = [], canh = [], gioVn = new Date(bayGio + 7 * 3600e3).toISOString().slice(11, 16); let tongLo = 0, tongCho = 0;
  for (const m of s.may) {
    const da = s.da.filter((x) => x.may === m.ma), dk = dinh.filter((x) => x.may === m.ma);
    const chua = dk.filter((x) => !da.some((d) => d.nen === x.nen)), lo = [...new Set(chua.filter((x) => x.gio <= gioVn).map((x) => x.nen))];
    const cho = [...new Set(chua.filter((x) => x.gio > gioVn).map((x) => x.nen))]; tongLo += lo.length; tongCho += cho.length;   // giờ chưa tới thì là CHỜ, không phải lỡ
    const nen = da.map((x) => (x.url ? `<a href="${esc(x.url)}">${esc(nhanNen(x.nen))}</a>` : esc(nhanNen(x.nen))));
    const ds2 = (xs) => xs.map((n) => esc(nhanNen(n))).join(', ');
    dong.push(`• <b>${esc(ten[m.ma])}</b>: ${da.length} lượt${nen.length ? ` · ${nen.join(', ')}` : ''}${lo.length ? `\n   ✗ lỡ: ${ds2(lo)}` : ''}${cho.length ? `\n   ⏳ chờ: ${ds2(cho)}` : ''}`);
  }
  // kho đã xếp lịch: máy × format — số lượt còn trong lịch từ mai + ngày lượt cuối
  const kho = new Map();
  for (const x of ds) if (x.ngay > hom) { const k = `${x.may}|${x.format ?? '—'}`, o = kho.get(k) ?? { may: x.may, format: x.format ?? '—', n: 0, den: x.ngay }; o.n++; if (x.ngay > o.den) o.den = x.ngay; kho.set(k, o); }
  const dongKho = [...kho.values()].sort((a, b) => a.den.localeCompare(b.den)).map((o) => {
    const can = o.den <= sau7; if (can) canh.push(`${ten[o.may] ?? o.may} · ${o.format}: kho chỉ đủ tới ${dm(o.den)} — cần thêm đề / dạng bài mới`);
    return `• ${esc(ten[o.may] ?? o.may)} · ${esc(o.format)}: ${o.n} lượt, đủ tới ${can ? `<b>🔴 ${dm(o.den)}</b>` : dm(o.den)}`;
  });
  for (const m of s.may) if (!ds.some((x) => x.may === m.ma && x.ngay > hom)) canh.push(`${ten[m.ma]}: không còn lượt nào trong lịch (hết bài DUYỆT hoặc kênh bị dừng)`);
  const gioLich = s.lich?.luc ? (bayGio - Date.parse(s.lich.luc)) / 36e5 : Infinity;
  if (gioLich > LICH_CU_GIO) canh.push(`lịch dự kiến không được cập nhật ${gioLich === Infinity ? 'lần nào' : `${Math.round(gioLich)} giờ`} — máy đăng iMac (dang-may) có thể không chạy`);
  if (tongLo) canh.unshift(`${tongLo} lượt lỡ hôm nay — xem nhật ký máy đăng (dang-may) trên iMac / MacBook`);
  return `📊 <b>Vân [Social Traffic]</b> · báo cáo ngày ${dm(hom)} (lúc ${gioVn})\n\n<b>Hôm nay đăng ${s.da.length} lượt · lỡ ${tongLo}${tongCho ? ` · còn chờ ${tongCho}` : ''}</b>\n${dong.join('\n')}`
    + `\n\n<b>Kho đã xếp lịch</b> (luật nhịp an toàn)\n${dongKho.join('\n') || '(trống)'}`
    + (canh.length ? `\n\n⚠️ <b>Cần xử</b>\n${canh.map((x) => `• ${esc(x)}`).join('\n')}` : '\n\n✅ Không có gì cần xử.')
    + '\n\nBảng đủ (kho theo kiểu nội dung, lưới lịch 10 ngày): mos2 › Social › Lịch đăng';
}

async function docSoLieu(sql, hom) {
  const may = await sql`select ma, ten from xv_may where chay order by id`;
  const da = await sql`select m.ma as may, d.key as nen, d.value->>'url' as url from xv_may_video v join xv_may m on m.id = v.may_id
    cross join lateral jsonb_each(coalesce(v.da_dang, '{}'::jsonb)) d where m.chay and d.value->>'ngay' = ${hom} order by m.id, d.key`;
  const [lich] = await sql`select luc::text as luc, ds from xv_lich_du_kien where id = 1`;
  return { hom, may: [...may], da: [...da], lich: lich ? { luc: lich.luc, ds: lich.ds } : null };
}
const ketNoi = async () => { if (!process.env.DATABASE_URL) throw new Error('thiếu DATABASE_URL (chạy trên box3 với .env.production)'); return (await import('postgres')).default(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5 }); };
const tepSt = () => path.join(DATA(), 'bao-social.json');

/** Nhịp: quá giờ báo mà hôm nay chưa báo → gửi một tin vào 📂 Social Traffic. Gọi từ NHIP['bao-social'] (nhip.mjs). */
export async function nhipBaoSocial(id = 'van') {
  const hom = ngayVn(), gioVn = new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 16);
  let gio = GIO_BAO; try { gio = JSON.parse(fs.readFileSync(path.join(DATA(), 'nhip-chinh.json'), 'utf8'))[id]?.gio || GIO_BAO; } catch { /* chưa chỉnh */ }
  let st = {}; try { st = JSON.parse(fs.readFileSync(tepSt(), 'utf8')); } catch { /* lần đầu */ }
  if (st.ngay === hom) return `đã báo ngày ${dm(hom)}`;
  if (gioVn < gio) return `chờ ${gio} để báo ngày ${dm(hom)}`;
  const sql = await ketNoi();
  try {
    const tin = tinBaoCao(await docSoLieu(sql, hom));
    const { tgNoiDung } = await import('./kiem-bai.mjs'), { topicPhong } = await import('./tg-phong.mjs');
    const { tg } = await tgNoiDung(), topic = await topicPhong('social-traffic', '📂 Social Traffic', tg);
    if (!topic) throw new Error('phòng Social Traffic chưa có chủ đề Telegram');
    const j = await tg('sendMessage', { message_thread_id: topic, text: tin, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    if (!j.ok) throw new Error(`telegram: ${j.description}`);
    fs.mkdirSync(DATA(), { recursive: true }); fs.writeFileSync(tepSt(), JSON.stringify({ ngay: hom, luc: new Date().toISOString(), tin: j.result.message_id }));
    return `báo cáo ngày ${dm(hom)} đã gửi`;
  } finally { await sql.end({ timeout: 2 }).catch(() => {}); }
}

if (process.argv[1]?.endsWith('bao-social.mjs') && process.argv.includes('--in')) {
  const sql = await ketNoi(); try { console.log(tinBaoCao(await docSoLieu(sql, ngayVn()))); } finally { await sql.end({ timeout: 2 }); }
}
if (process.argv[1]?.endsWith('bao-social.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  const bay = Date.parse('2026-10-20T14:30:00Z'), luc = '2026-10-20T13:10:00Z';
  const s = { hom: '2026-10-20', may: [{ ma: 'h', ten: 'Hotel · tin' }, { ma: 'f', ten: 'Front Porch' }],
    da: [{ may: 'h', nen: 'youtube', url: 'https://youtu.be/a' }, { may: 'h', nen: 'x', url: null }],
    lich: { luc, ds: [{ may: 'h', nen: 'youtube', gio: '20:00', ngay: '2026-10-20', format: 'Video ngắn' }, { may: 'h', nen: 'x', gio: '20:00', ngay: '2026-10-20', format: 'Video ngắn' }, { may: 'h', nen: 'facebook', gio: '20:00', ngay: '2026-10-20', format: 'Video ngắn' },
      { may: 'h', nen: 'youtube', ngay: '2026-11-20', format: 'Video ngắn' }, { may: 'f', nen: 'tiktok', ngay: '2026-10-22', format: 'Video ngắn' }] } };
  const a = tinBaoCao(s, bay);
  t.ok(a.includes('Hôm nay đăng 2 lượt · lỡ 1') && a.includes('lỡ: FB') && a.includes('1 lượt lỡ hôm nay'), 'đếm đã đăng + lỡ lượt (giờ đã qua)');
  const c = tinBaoCao(s, Date.parse('2026-10-20T11:00:00Z'));   // 18:00 VN, lượt 20:00 chưa tới
  t.ok(c.includes('lỡ 0 · còn chờ 1') && c.includes('⏳ chờ: FB') && !c.includes('✗ lỡ'), 'giờ chưa tới = chờ, không phải lỡ');
  t.ok(a.includes('<a href="https://youtu.be/a">YT</a>'), 'link bài đã đăng');
  t.ok(a.includes('🔴 22/10') && a.includes('Front Porch · Video ngắn: kho chỉ đủ tới 22/10'), 'kho cạn trong 7 ngày → đỏ + cần xử');
  t.ok(a.includes('đủ tới 20/11') && !a.includes('🔴 20/11'), 'kho xa không đỏ');
  t.ok(!a.includes('không được cập nhật'), 'lịch mới → không cảnh báo');
  t.ok(tinBaoCao({ ...s, lich: { ...s.lich, luc: '2026-10-18T00:00:00Z' } }, bay).includes('không được cập nhật 63 giờ'), 'lịch cũ → cảnh báo');
  const b = tinBaoCao({ ...s, lich: null, da: [] }, bay);
  t.ok(b.includes('đăng 0 lượt · lỡ 0') && b.includes('không còn lượt nào') && b.includes('không được cập nhật lần nào'), 'không có lịch → báo rõ, không vỡ');
  t.ok(!a.includes('<script') && tinBaoCao({ ...s, may: [{ ma: 'h', ten: '<b>x' }, s.may[1]] }, bay).includes('&lt;b&gt;x'), 'tên được escape');
  const dir = fs.mkdtempSync('/tmp/bao-social-'); process.env.CTY_DATA_DIR = dir;
  fs.writeFileSync(path.join(dir, 'bao-social.json'), JSON.stringify({ ngay: ngayVn() }));
  t.match(await nhipBaoSocial(), /^đã báo/, 'đã báo hôm nay → không gửi lại, không cần DB');
  fs.rmSync(dir, { recursive: true });
  console.log('✓ bao-social: đã đăng/định + lỡ lượt · kho theo máy × format (đỏ ≤ 7 ngày) · lịch cũ · không lịch · escape · một lần mỗi ngày');
}

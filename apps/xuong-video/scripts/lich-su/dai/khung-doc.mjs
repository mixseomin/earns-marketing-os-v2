#!/usr/bin/env node
// SHORT KHUNG DỌC CẮT THẲNG TỪ VIDEO DÀI 16:9 (anh 16/11/2026: "short sinh ra từ remix 1 video 16:9 ngang"): một chương của tập dài Full Chart Reading
// (crd-<người>, bản ĐÃ DỰNG brand/astrolas/ra/crd-<người>.mp4) → Short 1080×1920 ≤ 50 giây, KHÔNG dựng lại, KHÔNG đọc giọng mới (0₫, vài giây ffmpeg).
// Khác dai/cat-short.mjs (dựng lại từng câu thành khổ dọc): ở đây là nguyên đoạn hình + tiếng của bản dài, đặt vào khung dọc. Hai bố cục, xoay vòng theo chương:
//   A · khung ngang trong dọc — hook trên, tên người + chương, đoạn 16:9 ở giữa, nút "Full reading" dưới; nền = ảnh nền playlist làm mờ
//   B · tách đôi xếp chồng — bánh lá số (nửa trái bản dài) phóng to ở trên, cột chữ (nửa phải) ở dưới: kín màn dọc, chữ to gấp ~1,4 lần
// Chia chương với cat-short để cùng một chương không lên hai Short: chương LẺ → crc (dựng lại), chương CHẴN → crk (khung dọc). Mốc giờ lấy từ bản
// đã lồng tiếng (.crd-<người>.tieng.json), không từ tệp tập (tệp tập là giờ ước trước lồng tiếng). Câu cuối = thẻ kết 3 giây trỏ astrolas.com.
//   node dai/khung-doc.mjs --tu angelina-jolie [--chuong <k | all>] [--bo A|B] [--xem]
// Tệp ra: shot-code/tap-astrolas/crk-<người>-<k>.json (+ .tieng.json mốc thật) · brand/astrolas/ra/crk-<người>-<k>.mp4 → nap-tap.mjs nạp như mọi Short.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PL } from './doc-bai.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), LS = join(DIR, '..'), TAP = join(LS, '../shot-code/tap-astrolas'), RA = join(LS, 'brand/astrolas/ra');
export const MAU = 'chart-reading-khung', GIAY_TOI_DA = 50, GIAY_KET = 3, W = 1080, H = 1920;
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const FONT = '/System/Library/Fonts/Supplemental/Georgia Bold.ttf';

/** bố cục theo chương: chương chẵn 2, 6, 10… → A; 4, 8… → B (luân phiên để bước đo G9 so được hai dạng). Thuần. */
export const boCuc = (k) => (k % 4 === 2 ? 'A' : 'B');
/** đoạn cắt của chương k: từ thẻ đầu chương tới hết câu cuối còn vừa (GIAY_TOI_DA − thẻ kết), dừng trước cảnh mốc đời (nhin.tranh) hay thẻ chương kế.
 *  dai = tệp tập dài (cờ câu), C2 = .tieng.json (mốc giờ thật). Ít hơn 2 câu sau thẻ chương thì null. Thuần. */
export function doanChuong(dai, C2, k) {
  const c = dai.chuong?.[k]; if (!c || k === 0) return null;
  const het = dai.chuong[k + 1]?.cau ?? dai.cau.length - 1, tu = C2.cau[c.cau]?.tu; if (tu == null) return null;
  const ds = [c.cau];
  for (let i = c.cau + 1; i < het; i++) { const q = dai.cau[i], t = C2.cau[i]; if (q.nhin?.tranh || q.the || !t) break; if (t.den - tu > GIAY_TOI_DA - GIAY_KET) break; ds.push(i); }
  return ds.length >= 3 ? { tu, den: C2.cau[ds.at(-1)].den, ds } : null;
}
/** mã Short khung dọc cắt được từ một tập dài (chương chẵn, có đoạn đủ dài). Cần .tieng.json (tập đã dựng). Thuần theo hai tệp truyền vào. */
export const maKhung = (dai, C2) => (dai.chuong ?? []).map((_, k) => k).filter((k) => k % 2 === 0 && doanChuong(dai, C2, k)).map((k) => `crk-${dai.y_tuong.replace(/^crd-/, '')}-${k}`);
const docTieng = (slug) => { const f = join(TAP, `.crd-${slug}.tieng.json`); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; };

/** lớp chữ PNG trong suốt (PIL — ffmpeg trên iMac không có drawtext). spec: [{ y, chu, co, mau, rong?, hop? }], tự xuống dòng theo bề rộng. */
function veChu(spec, ra, { phu = 0 } = {}) {
  const py = `
import json,sys
from PIL import Image,ImageDraw,ImageFont
S=json.loads(sys.argv[1]); W=${W}; FONT=${JSON.stringify(FONT)}; im=Image.new("RGBA",(${W},${H}),(8,10,24,int(255*S["phu"]))); d=ImageDraw.Draw(im)
def chia(b,co):
    f=ImageFont.truetype(FONT,co); dong=[]; cur=""
    for w in b["chu"].split():
        t=(cur+" "+w).strip()
        if d.textlength(t,font=f)<=b.get("rong",960) or not cur: cur=t
        else: dong.append(cur); cur=w
    return f,dong+([cur] if cur else [])
het=0
for b in S["ds"]:
    co=b["co"]; f,dong=chia(b,co)
    while len(dong)>b.get("dong",9) and co>34: co-=2; f,dong=chia(b,co)   # co chữ tới khi vừa số dòng tối đa
    y=het+b.get("cach",24) if b.get("sau") else b["y"]
    for l in dong:
        w=d.textlength(l,font=f); x=(W-w)/2
        if b.get("hop"): d.rounded_rectangle((x-26,y-16,x+w+26,y+co+22),radius=16,fill=tuple(b["hop"]))
        d.text((x,y),l,font=f,fill=tuple(b["mau"])); y+=int(co*1.25)
    if b.get("logo"): lg=Image.open(b["logo"]).convert("RGBA"); lg.thumbnail((520,200)); im.alpha_composite(lg,((W-lg.width)//2,y+30)); y+=230
    het=y
im.save(sys.argv[2])`;
  const r = spawnSync('python3', ['-c', py, JSON.stringify({ ds: spec, phu }), ra], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`vẽ chữ hỏng: ${r.stderr.trim().split('\n').pop()}`);
}
const TRANG = [255, 255, 255], VANG = [242, 210, 122], XANH = [111, 168, 245, 235];

/** ffmpeg: đoạn [tu, tu+dai] của bản dài → khung dọc theo bố cục + lớp chữ + thẻ kết GIAY_KET giây. */
function dung({ video, nen, tu, dai, bo, chu, ket, ra }) {
  const T = dai + GIAY_KET, keo = `tpad=stop_mode=clone:stop_duration=${GIAY_KET}`;
  const bg = `[1:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=14,eq=brightness=-0.32[bg]`;
  const hinh = bo === 'A'
    ? `${bg};[0:v]scale=${W}:-2,${keo}[g];[bg][g]overlay=0:(H-h)/2[v1]`
    // B: bản dài 1920×1080 — bánh lá số trong ô (60,20) 1040×1040, cột chữ (1130,470) 790×560 (khuôn la-so.html khung ngang)
    : `${bg};[0:v]split[l][r];[l]crop=1040:1040:60:20,scale=1000:1000,${keo}[o];[r]crop=790:560:1130:470,scale=1000:-2,${keo}[c];[bg][o]overlay=40:250[v0];[v0][c]overlay=40:1260[v1]`;
  const g = `${hinh};[v1][2:v]overlay=0:0[v2];[v2][3:v]overlay=0:0:enable='gte(t,${dai.toFixed(2)})'[v];[0:a]afade=t=out:st=${(dai - 0.3).toFixed(2)}:d=0.3,apad=pad_dur=${GIAY_KET}[a]`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(tu), '-t', dai.toFixed(2), '-i', video, '-loop', '1', '-i', nen, '-loop', '1', '-i', chu, '-loop', '1', '-i', ket,
    '-filter_complex', g, '-map', '[v]', '-map', '[a]', '-t', T.toFixed(2), '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', ra], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg hỏng: ${r.stderr.trim().split('\n').slice(-2).join(' ')}`);
}

export async function khungMot(slug, k, { xem = false, bo = null } = {}) {
  const { docSo, kiemTap } = await import('../kiem-so-kenh.mjs'), { chonHook, ghiHookVideo } = await import('../hook-kenh.mjs');
  const { loiHook } = await import('../../../src/lib/xuong-video/hook-qc.mjs'), { dangCongCu } = await import('../nguon-site.mjs'), { nhanPlaylist } = await import('../viet-chung.mjs');
  const f = join(TAP, `crd-${slug}.json`), video = join(RA, `crd-${slug}.mp4`), C2 = docTieng(slug);
  if (!existsSync(f) || !existsSync(video) || !C2) return { loi: [`tập dài crd-${slug} chưa dựng xong (cần ${f}, ${video} và .crd-${slug}.tieng.json)`] };
  const dai = JSON.parse(readFileSync(f, 'utf8')), d = doanChuong(dai, C2, k); if (!d) return { loi: [`tập dài crd-${slug} không có chương ${k} cắt được`] };
  const so = docSo().astrolas, pl = so.playlist.find((p) => p.ma === PL), y = `crk-${slug}-${k}`, A = dai.cau[1].chu.split(',')[0], ten = dai.chuong[k].ten, B = bo ?? boCuc(k);
  const { hook, chuHook, goc } = chonHook('astrolas', PL, y), dai_ = d.den - d.tu;
  const cau = [{ chu: chuHook, khung: true, tu: 0, den: 0 },
    ...d.ds.map((i) => { const { tu, den, ...q } = C2.cau[i]; return { ...q, tu: +(tu - d.tu).toFixed(2), den: +(den - d.tu).toFixed(2) }; }),
    { nhin: { toan: 1 }, khung: true, chu: 'Full reading on our channel. Read your own birth chart free at astrolas.com.', tu: +dai_.toFixed(2), den: +(dai_ + GIAY_KET).toFixed(2) }];
  const tieuDe = `${chuHook} ${A}: ${ten}`;
  const tap = { _ghi: `Chart Reading khung dọc ${B} · ${A} · chương ${k} "${ten}" — cắt từ bản dựng crd-${slug} giây ${d.tu.toFixed(1)}–${d.den.toFixed(1)} bởi lich-su/dai/khung-doc.mjs (${d.ds.length} câu, hook QC spy #${hook.id})`,
    kenh: 'astrolas', mau: MAU, playlist_ma: PL, y_tuong: y, khung: 'doc', khung_chu: 'ngang', bo_cuc: B, tu_dai: `crd-${slug}`, doan: [+d.tu.toFixed(2), +d.den.toFixed(2)],
    tieu_de: tieuDe, goc, hook: { qc: hook.id, goc: hook.chu }, nguon_bai: dai.nguon_bai,
    dang: dangCongCu('birth', slug, {}, `${A}'s birth chart: ${ten}. One chapter of the full reading on our channel.`),
    la_so: dai.la_so, nen: dai.nen, logo: dai.logo, playlist: nhanPlaylist(pl), cau, DAI: +(dai_ + GIAY_KET).toFixed(2) };
  const loi = [...kiemTap(tap, so, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
  if (loi.length) return { loi };
  if (xem) return { tap };
  // đường ảnh nền trong tập tính từ shot-code/ (nơi long-tieng chạy); lớp chữ vẽ vào thư mục tạm, dựng xong thì bỏ
  const tam = mkdtempSync(join(tmpdir(), `${y}-`)), nen = join(LS, '../shot-code', dai.nen);
  try {
  veChu(B === 'A'
    ? [{ y: 330, chu: chuHook, co: 72, dong: 2, mau: TRANG }, { sau: 1, cach: 34, chu: `${A}'s birth chart`, co: 42, dong: 1, mau: VANG }, { sau: 1, cach: 6, chu: ten, co: 38, dong: 1, mau: VANG },
      { y: 1420, chu: 'Full 10-minute reading on our channel', co: 40, mau: TRANG, hop: XANH }]
    : [{ y: 70, chu: chuHook, co: 62, dong: 3, mau: TRANG }], join(tam, 'chu.png'));
  veChu([{ y: 640, chu: 'Read your own birth chart free', co: 64, dong: 1, mau: TRANG }, { sau: 1, cach: 10, chu: 'astrolas.com', co: 72, dong: 1, mau: VANG },
    { sau: 1, cach: 60, chu: `${A}'s full reading is on our channel`, co: 40, dong: 2, mau: TRANG, logo: join(LS, 'brand/astrolas/logo/wordmark.png') }], join(tam, 'ket.png'), { phu: 0.9 });
  var ra = join(RA, `${y}.mp4`); dung({ video, nen, tu: d.tu, dai: dai_, bo: B, chu: join(tam, 'chu.png'), ket: join(tam, 'ket.png'), ra });
  } finally { rmSync(tam, { recursive: true, force: true }); }
  writeFileSync(join(TAP, `${y}.json`), JSON.stringify(tap, null, 1) + '\n');
  writeFileSync(join(TAP, `.${y}.tieng.json`), JSON.stringify(tap, null, 1) + '\n');   // mốc thật = mốc đoạn cắt (nap-tap cắt khung chấm theo tệp này)
  ghiHookVideo(tap, ra);
  return { tap, ra };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--tu-kiem')) {
    const { strict: t } = await import('node:assert');
    const D = { y_tuong: 'crd-x', chuong: [{ ten: 'Intro', cau: 0 }, { ten: 'A', cau: 1 }, { ten: 'B', cau: 5 }, { ten: 'C', cau: 10 }],
      cau: [{}, { the: 1 }, {}, {}, {}, { the: 1 }, {}, {}, { nhin: { tranh: 'p' } }, {}, { the: 1 }, {}, {}, {}, { khung: true }] };
    const C = { cau: D.cau.map((_, i) => ({ tu: i * 10, den: i * 10 + 10 })) };
    t.deepEqual(doanChuong(D, C, 2), { tu: 50, den: 80, ds: [5, 6, 7] }, 'dừng trước cảnh mốc đời');
    t.equal(doanChuong(D, C, 0), null, 'Intro không cắt'); t.equal(doanChuong(D, C, 1)?.ds.length, 4);
    const C9 = { cau: D.cau.map((_, i) => ({ tu: i * 20, den: i * 20 + 20 })) }; t.equal(doanChuong(D, C9, 2), null, 'chưa tới 2 câu trong 47 giây thì bỏ');
    t.deepEqual(maKhung(D, C), ['crk-x-2']); t.equal(boCuc(2), 'A'); t.equal(boCuc(4), 'B'); t.equal(boCuc(6), 'A');
    console.log('khung-doc: tự kiểm đạt'); process.exit(0);
  }
  const slug = arg('tu'), ch = arg('chuong', 'all'); if (!slug) { console.error('dùng: --tu <người> [--chuong <k | all>] [--bo A|B] [--xem]'); process.exit(2); }
  const f = join(TAP, `crd-${slug}.json`), C2 = docTieng(slug); if (!existsSync(f) || !C2) { console.error(`✗ tập dài crd-${slug} chưa dựng`); process.exit(3); }
  const ks = ch === 'all' ? maKhung(JSON.parse(readFileSync(f, 'utf8')), C2).map((m) => Number(m.split('-').pop())) : [Number(ch)]; let hong = 0;
  for (const k of ks) { const r = await khungMot(slug, k, { xem: process.argv.includes('--xem'), bo: arg('bo') });
    if (r.loi) { hong++; console.log(`✗ crk-${slug}-${k}:\n${r.loi.map((l) => `   · ${l}`).join('\n')}`); } else console.log(`✓ crk-${slug}-${k} · bố cục ${r.tap.bo_cuc} · ${r.tap.DAI}s · ${r.tap.tieu_de}${r.ra ? ` → ${r.ra}` : ''}`); }
  process.exit(hong && ch !== 'all' ? 1 : 0);
}

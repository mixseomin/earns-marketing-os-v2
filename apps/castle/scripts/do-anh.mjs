#!/usr/bin/env node
// ĐO MẶT TIỀN TỪ ẢNH THẬT — MỘT LỆNH, KHÔNG AI TRẢ TIỀN (anh 20/11/2026: "chuẩn hoá và làm component chuẩn"). Chuỗi chuẩn cho mọi thẻ "đo trên ảnh thật":
//   1. KHO GÓC NHÌN  scripts/kho-goc-nhin.mjs   ảnh 3D Google + độ sâu quanh các khối cần đo (dựng một lần / vùng, nhớ ở apps/castle/.kho-goc/)
//   2. ĐỊNH VỊ ẢNH   scripts/khop-lg.py         ảnh chụp không GPS (Commons / Mapillary trong <lâu>-anh-web.json) → camera, bằng LightGlue + PnP chạy tại máy
//   3. NẮN           scripts/nan-mat.mjs        ảnh → mặt tường nhìn thẳng có thước mét (24 px/m), phần bị khối khác che tô xám
//   4. ĐẾM           scripts/dem-chi-tiet.py    răng cưa / vòm nhỏ / hàng đá góc bằng xử lý ảnh, mỗi số một độ tin
//   5. GỘP + GHI     tệp này                    mỗi mặt lấy số có độ tin cao nhất; hai ảnh cho hai số lệch > 1 thì KHÔNG ghi; --ghi mới chạm <lâu>-cua-so.json
// Sổ đo: public/du-lieu/<lâu>-do-anh.json { anh: { <tệp>: camera + điểm khớp }, mat: { "khối#cạnh": { rang_cua: { gia_tri, nhip_m, tin, anh, ung_vien } } } }.
//   node apps/castle/scripts/do-anh.mjs --khoi way/223110818[,way/…] [--tim] [--ghi] [--ghi-de] [--lam-lai]
//       --tim      tìm + tải thêm ảnh quanh khối trước (scripts/tim-anh.mjs --tai het: Commons theo danh mục + Mapillary)
//       --ghi      ghi số đạt vào <lâu>-cua-so.json (chỉ trường CHƯA có; --ghi-de: đè cả trường đã có). Không --ghi = chỉ in bảng.
//       --cua      đếm thêm CỬA SỔ + GỜ NGANG (scripts/dem-cua-so.py): ghi khi mặt đang trống cửa và ảnh phủ ≥ 90 % cạnh; mặt đã có số thì chỉ so KHỚP / LỆCH
//       --lam-lai  định vị lại cả ảnh đã có trong sổ đo
//       --vong [70,120,190,280]  kho VÒNG NHÌN VÀO (kho-goc-nhin.mjs --vong): ảnh chụp xa (đường lên, cầu, đồi) mà lưới sát chân tường không ghép được; thư mục kho riêng <vùng>_vong,
//                  vùng chỗ đứng hợp lệ nới theo vòng ngoài cùng; ảnh đã thử hỏng 2 vùng lưới vẫn được thử một lần ở kho vòng
//   node apps/castle/scripts/do-anh.mjs --tu-kiem     bài kiểm có thể hỏng: bộ đếm trên mặt vẽ có đáp án + định vị lại góc nhìn của chính kho + ghi thử tệp
// Cần venv /Users/htuan/.venvs/castle-khop (torch, lightglue, opencv, numpy, pillow) — thiếu thì lệnh in cách cài rồi dừng.
// tra-repo-ok: điều phối các bước của cảnh; phần nặng dùng thư viện có sẵn (cvg/LightGlue Apache-2.0, OpenCV) — xem khop-lg.py.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { GOC, PUB, LAU, du, doiSo } from './chung.mjs';

process.env.KMP_DUPLICATE_LIB_OK = 'TRUE'; // torch + opencv cùng nạp libomp → khop-lg.py chết 'OMP Error #15' (20/11/2026)
const PY = join(homedir(), '.venvs/castle-khop/bin/python'), SC = join(GOC, 'scripts'), KHO_GOC = join(GOC, '.kho-goc', LAU);
const co = (c) => doiSo.includes(c), gt = (c) => { const k = doiSo.indexOf(c); return k < 0 ? null : doiSo[k + 1]; };
export const NGUONG = { thay: 0.5, dung: 30, lech_px: 4, roll: 0.35, fov: [15, 95], tach_m: 3, dong_thuan: 3, tin: 0.6 }; // ảnh định vị ĐẠT · số đo ĐẠT (lô thử 71 ảnh 20/11/2026: chỉ đếm điểm khớp thì lọt lời giải lệch 45–200 m → gác chính là VÙNG + TÁCH ĐÔI; kho đúng 6 hướng cho ảnh tốt ~40–50 điểm)
const TRUONG = ['rang_cua', 'vom_nho', 'da_goc'], TIN = { rang_cua: 'tin_rang', vom_nho: 'tin_vom', da_goc: 'tin_da' }, NHIP = { rang_cua: 'rang_nhip_m', vom_nho: 'vom_nhip_m' };

/** camera giải ra có dùng được không (thuần — tự kiểm gọi). khoY: [thấp nhất, cao nhất] của mắt các góc nhìn trong kho */
export function anhDat(r, khoY, vung) {
  if (!r || r.hong) return 'không đủ điểm khớp';
  if (r.dung < NGUONG.dung) return `chỉ ${r.dung} điểm khớp đúng (< ${NGUONG.dung})`;
  if (r.lech_px > NGUONG.lech_px) return `sai số chiếu lại ${r.lech_px.toFixed(1)} px (> ${NGUONG.lech_px})`;
  if (Math.abs(r.roll) > NGUONG.roll) return `máy nghiêng ${(r.roll * 57.3).toFixed(0)}° — lời giải lật`;
  if (r.fov < NGUONG.fov[0] || r.fov > NGUONG.fov[1]) return `góc nhìn ${r.fov}° ngoài khoảng ống kính thật`;
  if (khoY && (r.y < khoY[0] - 3 || r.y > khoY[1] + 12)) return `mắt ở độ cao ${r.y.toFixed(0)} m — ngoài vùng người đứng được`;
  if (vung && (r.x < vung[0] - 20 || r.x > vung[1] + 20 || r.z < vung[2] - 20 || r.z > vung[3] + 20)) return `chỗ đứng (${r.x.toFixed(0)}, ${r.z.toFixed(0)}) nằm ngoài vùng kho góc nhìn — lời giải trượt`;
  if (!(r.tach_m <= NGUONG.tach_m)) return `hai nửa góc nhìn ra hai chỗ đứng cách nhau ${r.tach_m > 900 ? 'không giải được' : r.tach_m.toFixed(1) + ' m'} (> ${NGUONG.tach_m} m) — lời giải không vững`;
  // đồng thuận (khop-lg.py): số chỗ đứng nguồn mà giải RIÊNG từng góc cũng ra gần đúng chỗ (≤ 3 m). Đòi min(3, số chỗ đứng giải được): ảnh chỉ khớp một chỗ đứng thì phép này không phân xử được
  if (r.dong_thuan == null) return 'kết quả ghép cũ chưa có số đồng thuận — ghép lại';
  if (r.dong_thuan < Math.min(NGUONG.dong_thuan, r.cho_dung)) return `chỉ ${r.dong_thuan} / ${r.cho_dung} chỗ đứng nguồn đồng ý với chỗ đứng giải ra (< ${Math.min(NGUONG.dong_thuan, r.cho_dung)}) — lời giải trượt theo một cụm góc nhìn`;
  return null;
}
/** gộp số đếm của nhiều ảnh cho một trường (thuần): ứng viên [{ gia_tri, tin, anh, nhip_m }] → { gia_tri, … } | { khong_ghi: lý do } */
export function gop(uv) {
  // 20/11/2026 lượt Torbau: mặt hẹp bị che 60–90 % vẫn ra số 'tin 0,64–0,8' (đá góc 2 · 3 · 4, cửa sổ 1 ô trên mặt có lô-gia) → ảnh phải THẤY ≥ 50 % mặt
  const dat = uv.filter((u) => u.tin >= NGUONG.tin && Number.isFinite(u.gia_tri) && !(u.thay < NGUONG.thay)).sort((a, b) => b.tin - a.tin);
  if (!dat.length) return { khong_ghi: uv.length ? `độ tin cao nhất ${Math.max(...uv.map((u) => u.tin || 0)).toFixed(2)} < ${NGUONG.tin}` : 'không ảnh nào thấy', ung_vien: uv };
  if (dat.some((u) => Math.abs(u.gia_tri - dat[0].gia_tri) > 1)) return { khong_ghi: `các ảnh lệch nhau: ${dat.map((u) => `${u.gia_tri} (${u.anh.split('/').pop()}, tin ${u.tin})`).join(' · ')}`, ung_vien: uv };
  return { ...dat[0], so_anh: dat.length, ung_vien: uv };
}
/** tóm tắt bố cục cửa để so / in: [{cum: [[s0, s1, n]]}] → "2+1 / 1" (từng hàng từ trên xuống, số ô từng cụm) */
export const tomCua = (hang) => (hang || []).map((h) => h.cum.map((c) => c[2]).join('+')).join(' / ') || '—';
/** chọn bố cục cửa sổ cho một mặt từ nhiều ảnh (thuần): ứng viên [{ hang, phu, anh }] → bản phủ rộng nhất × tin cao nhất; ghi được khi ảnh phủ ≥ 90 % cạnh,
 *  mọi hàng tin ≥ 0,55 và (chỉ một ảnh HOẶC các ảnh phủ đủ khác cho cùng số hàng + cùng số ô từng hàng) */
export function gopCua(uv) {
  const co = uv.filter((u) => u.hang?.length && !(u.thay < NGUONG.thay)).map((u) => ({ ...u, tin: Math.min(...u.hang.map((h) => h.tin)) })).sort((a, b) => b.phu * b.tin - a.phu * a.tin);
  if (!co.length) return null; const t = co[0], du = co.filter((u) => u.phu >= 0.9 && u.tin >= 0.55), dem = (u) => u.hang.map((h) => h.cum.reduce((a, c) => a + c[2], 0)).join(',');
  const ly = t.phu < 0.9 ? `ảnh tốt nhất chỉ phủ ${(t.phu * 100).toFixed(0)} % bề ngang cạnh` : t.tin < 0.55 ? `độ tin hàng thấp nhất ${t.tin}` : du.some((u) => dem(u) !== dem(t)) ? `các ảnh lệch nhau: ${du.map((u) => `${tomCua(u.hang)} (${u.anh.split('/').pop()})`).join(' · ')}` : null;
  return { hang: t.hang.map(({ tin, ...h }) => h), tin: t.tin, phu: t.phu, anh: t.anh, so_anh: du.length || 1, ...(ly ? { khong_ghi: ly } : {}) };
}
/** ghi trường vào tệp JSON thụt 1 dấu cách mà KHÔNG dàn lại cả tệp (thuần, trả chuỗi mới): thêm dòng ngay sau dòng mở khoá; khoá chưa có thì thêm khối cuối tệp */
export function chenTruong(txt, khoa, truong) {
  const dong = Object.entries(truong).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`), mo = ` ${JSON.stringify(khoa)}: {`;
  const ds = txt.split('\n'), i = ds.findIndex((d) => d === mo || d === mo + '}' || d === mo + '},');
  if (i >= 0) {
    if (ds[i] !== mo) { const het = ds[i].endsWith(','); ds.splice(i, 1, mo, ...dong.slice(0, -1), dong.at(-1).slice(0, -1), het ? ' },' : ' }'); return ds.join('\n'); } // khối rỗng "{}"
    let j = i + 1, sau = 1; for (; j < ds.length && sau; j++) for (const c of ds[j].replace(/"(\\.|[^"\\])*"/g, '')) sau += c === '{' ? 1 : c === '}' ? -1 : 0; // dòng đóng khối = j − 1
    const trong = ds.slice(i + 1, j - 1).filter((d) => !Object.keys(truong).some((k) => d.startsWith(`  ${JSON.stringify(k)}:`))); // trường cùng tên (ghi đè) bỏ bản cũ — chỉ trường một dòng
    if (!trong.length) dong[dong.length - 1] = dong.at(-1).slice(0, -1);
    ds.splice(i + 1, j - 2 - i, ...dong, ...trong); return ds.join('\n');
  }
  const k = ds.lastIndexOf('}'); if (k < 1) throw new Error('tệp không kết bằng "}"');
  if (ds[k - 1].trim() !== '{' && !ds[k - 1].endsWith(',')) ds[k - 1] += ',';
  ds.splice(k, 0, mo, ...dong.slice(0, -1), dong.at(-1).slice(0, -1), ' }'); return ds.join('\n');
}

const chay = (lenh, ds, them = {}) => { const r = spawnSync(lenh, ds, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', maxBuffer: 64e6, ...them }); if (r.stdout) process.stdout.write(r.stdout.split('\n').filter((d) => d && !/warn/i.test(d)).map((d) => '   ' + d).join('\n') + '\n'); return r.status; };
if (!existsSync(PY)) { console.error(`thiếu venv đo ảnh. Cài một lần (≈ 840 MB):\n  uv venv --python 3.13 ~/.venvs/castle-khop\n  uv pip install --python ~/.venvs/castle-khop/bin/python torch torchvision opencv-python-headless numpy pillow "lightglue @ git+https://github.com/cvg/LightGlue.git"`); process.exit(2); }

if (co('--tu-kiem')) {
  let hong = 0; const ok = (dk, ten) => { console.log(`${dk ? '✓' : '✗'} ${ten}`); hong += !dk; };
  const tot = { dung: 194, lech_px: 3, roll: -0.09, fov: 55.5, y: 13.5, x: 45, z: -21, tach_m: 0.4, dong_thuan: 6, cho_dung: 8 }, VT = [-20, 90, -80, 50];
  ok(anhDat(tot, [8, 17], VT) === null, 'anhDat: ảnh tốt qua');
  ok(/ngoài vùng/.test(anhDat({ ...tot, dung: 254, x: 142, z: -53 }, [8, 30], VT)), 'anhDat: 254 điểm khớp nhưng chỗ đứng ngoài vùng 52 m bị loại (ca Mapillary lệch GPS 133 m)');
  ok(/không vững/.test(anhDat({ ...tot, tach_m: 7.5 }, [8, 17], VT)), 'anhDat: hai nửa góc nhìn lệch nhau 7,5 m bị loại');
  ok(/điểm khớp/.test(anhDat({ ...tot, dung: 21 }, [8, 17], VT)), 'anhDat: 21 điểm khớp bị loại');
  ok(/nghiêng/.test(anhDat({ ...tot, roll: 1.51 }, [8, 17], VT)), 'anhDat: lời giải lật (roll 87°) bị loại');
  ok(/độ cao/.test(anhDat({ ...tot, y: 90 }, [8, 17], VT)), 'anhDat: mắt lơ lửng 90 m bị loại');
  ok(/chỗ đứng nguồn/.test(anhDat({ ...tot, dong_thuan: 1, cho_dung: 9 }, [8, 17], VT)), 'anhDat: chỉ 1 / 9 chỗ đứng đồng ý bị loại (tự kiểm g044-5 trượt 18 m)');
  ok(anhDat({ ...tot, dong_thuan: 1, cho_dung: 1 }, [8, 17], VT) === null, 'anhDat: ảnh xa chỉ khớp một chỗ đứng, chỗ đó đồng ý → qua (Hohenschwangau 3390836296)');
  ok(/ghép lại/.test(anhDat({ ...tot, dong_thuan: undefined }, [8, 17], VT)), 'anhDat: kết quả cũ thiếu số đồng thuận → không nhận');
  ok(gop([{ gia_tri: 7, tin: 0.99, anh: 'a' }, { gia_tri: 8, tin: 0.7, anh: 'b' }]).gia_tri === 7, 'gop: lệch 1 → lấy số tin cao nhất');
  ok(!!gop([{ gia_tri: 7, tin: 0.99, anh: 'a' }, { gia_tri: 11, tin: 0.8, anh: 'b' }]).khong_ghi, 'gop: hai ảnh lệch 4 → không ghi');
  ok(!!gop([{ gia_tri: 7, tin: 0.4, anh: 'a' }]).khong_ghi, 'gop: độ tin 0,4 → không ghi');
  ok(!!gop([{ gia_tri: 4, tin: 0.8, anh: 'a', thay: 0.2 }]).khong_ghi && !gopCua([{ hang: [{ y0: 1, y1: 2, cum: [[1, 2, 1]], tin: 0.9 }], phu: 1, thay: 0.3, anh: 'a' }]), 'ảnh chỉ thấy 20–30 % mặt → không ghi số, không ghi cửa sổ');
  const H1 = [{ y0: 20, y1: 22, cum: [[1, 2, 2], [4, 5, 2]], tin: 0.7 }, { y0: 16, y1: 18, cum: [[1, 2, 1]], tin: 0.8 }];
  ok(tomCua(H1) === '2+2 / 1' && !gopCua([{ hang: H1, phu: 0.95, anh: 'a' }]).khong_ghi, 'gopCua: một ảnh phủ 95 % → ghi được');
  ok(/phủ/.test(gopCua([{ hang: H1, phu: 0.6, anh: 'a' }]).khong_ghi), 'gopCua: ảnh chỉ phủ 60 % cạnh → không ghi');
  ok(/lệch/.test(gopCua([{ hang: H1, phu: 0.95, anh: 'a' }, { hang: [H1[0]], phu: 0.92, anh: 'b' }]).khong_ghi), 'gopCua: hai ảnh ra số hàng khác nhau → không ghi');
  ok(chay('python3', ['-W', 'ignore', join(SC, 'dem-cua-so.py'), '--tu-kiem']) === 0 || chay(PY, ['-W', 'ignore', join(SC, 'dem-cua-so.py'), '--tu-kiem']) === 0, 'dem-cua-so.py --tu-kiem');
  const T = '{\n "a#1": {\n  "hang": [],\n  "mau": {\n   "v": 1\n  }\n },\n "b#2": {\n  "rang_cua": 3,\n  "x": "}{"\n }\n}\n';
  const t1 = chenTruong(T, 'a#1', { rang_cua: 7 }), t2 = chenTruong(t1, 'c#0', { vom_nho: 11, do_may: 'x' }), t3 = chenTruong(t2, 'b#2', { rang_cua: 5 });
  ok(JSON.parse(t1)['a#1'].rang_cua === 7 && t1.split('\n').length === T.split('\n').length + 1, 'chenTruong: thêm đúng MỘT dòng vào khoá có sẵn');
  ok(JSON.parse(t2)['c#0'].vom_nho === 11 && JSON.parse(t2)['b#2'].x === '}{', 'chenTruong: khoá mới ở cuối tệp, chuỗi chứa ngoặc không làm lệch');
  ok(JSON.parse(t3)['b#2'].rang_cua === 5 && (t3.match(/"rang_cua": [35]/g) || []).length === 1, 'chenTruong: ghi đè thay dòng cũ, không nhân đôi khoá');
  ok(chay('python3', ['-W', 'ignore', join(SC, 'dem-chi-tiet.py'), '--tu-kiem']) === 0 || chay(PY, ['-W', 'ignore', join(SC, 'dem-chi-tiet.py'), '--tu-kiem']) === 0, 'dem-chi-tiet.py --tu-kiem');
  // ĐỊNH VỊ: lấy 6 góc của kho MỚI NHẤT làm ảnh chụp, chấm bằng ĐÚNG cổng anhDat của đường đo (23/11/2026: bài cũ tính mọi lời giải sai là hỏng, kể cả lời giải
  // cổng đã loại — kho sân dưới -50_90_-70_50 có g044-5 trượt 18 m dọc trục nhìn mà cổng tách đôi loại được → báo HỎNG oan). Hỏng thật = lời giải SAI mà cổng NHẬN,
  // hoặc giải đúng < 4 / 6 góc (bộ khớp hỏng hẳn thì mọi góc bị loại, cổng không nhận gì mà vẫn phải đỏ).
  const kho1 = existsSync(KHO_GOC) ? execFileSync('find', [KHO_GOC, '-name', 'kho.json', '-maxdepth', '2'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] : null;
  if (kho1) { const ra = join(tmpdir(), `khop-tu-kiem-${process.pid}.json`); chay(PY, ['-W', 'ignore', join(SC, 'khop-lg.py'), dirname(kho1), '--tu-kiem', '--ra', ra]);
    const tk = existsSync(ra) ? JSON.parse(readFileSync(ra, 'utf8')) : [], kg = JSON.parse(readFileSync(kho1, 'utf8')), kY = [Math.min(...kg.map((g) => g.p[1])), Math.max(...kg.map((g) => g.p[1]))];
    const vg = dirname(kho1).split('/').pop().replace(/_vong$/, '').split('_').map(Number), lot = tk.filter((t) => !t.hong && !t.dung_goc && anhDat(t, kY, vg) === null), dung = tk.filter((t) => t.dung_goc).length;
    for (const t of tk.filter((t) => !t.hong && !t.dung_goc)) console.log(`   ${t.ten}: giải sai ${t.kc} m → cổng ${anhDat(t, kY, vg) ?? 'NHẬN (lọt)'}`);
    ok(tk.length === 6 && dung >= 4 && !lot.length, `khop-lg định vị lại góc nhìn kho ${dirname(kho1).split('/').pop()}: đúng ${dung} / ${tk.length} góc · lời giải sai mà cổng nhận: ${lot.length}`); }
  else console.log('– chưa có kho góc nhìn nào: bỏ bài định vị (chạy --khoi một lần sẽ dựng)');
  console.log(hong ? `do-anh tự kiểm: HỎNG ${hong} bài` : 'do-anh tự kiểm: ĐẠT'); process.exit(hong ? 1 : 0);
}

if (co('--ghi-tu-so')) { // ghi mọi số ĐẠT đang nằm trong sổ đo vào tệp cửa sổ (trường chưa có), không đo lại — bước cuối của lượt quét toàn lâu đài (do-anh-toan.mjs)
  const so = JSON.parse(readFileSync(du('do-anh'), 'utf8')), CS = JSON.parse(readFileSync(du('cua-so'), 'utf8')); let moi = readFileSync(du('cua-so'), 'utf8'), n = 0;
  for (const [mat, d] of Object.entries(so.mat || {})) for (const f of TRUONG) { const g = d[f]; if (!g || g.khong_ghi || !Number.isFinite(g.gia_tri) || (CS[mat]?.[f] !== undefined && !co('--ghi-de'))) continue; const a = so.anh[g.anh] || {};
    moi = chenTruong(moi, mat, { [f]: g.gia_tri, [`do_may_${f}`]: `máy đo ${g.luc} (scripts/do-anh.mjs, không AI): ảnh ${g.anh.split('/').pop()} (${a.tacGia || '?'}, ${a.giayPhep || '?'}) định vị ${a.dung} điểm khớp · sai số ${a.lech_px} px, nắn 24 px/m${g.nhip_m ? `, nhịp đo ${g.nhip_m} m` : ''}, độ tin ${g.tin}${g.so_anh > 1 ? `, ${g.so_anh} ảnh cùng số (±1)` : ''}` }); g.da_ghi = true; n++; console.log(`   ${mat} ${f} = ${g.gia_tri}`); }
  for (const [mat, d] of Object.entries(so.mat || {})) { const a = so.anh[d.cua_so?.anh] || {};
    if (d.cua_so?.hang?.length && !d.cua_so.khong_ghi && !CS[mat]?.hang?.length) { moi = chenTruong(moi, mat, { hang: d.cua_so.hang, do_may_hang: `máy đo ${d.cua_so.luc} (scripts/do-anh.mjs --cua, không AI): ảnh ${d.cua_so.anh.split('/').pop()} (${a.tacGia || '?'}, ${a.giayPhep || '?'}) định vị ${a.dung} điểm khớp, phủ ${(d.cua_so.phu * 100).toFixed(0)} % cạnh, độ tin ${d.cua_so.tin}` }); d.cua_so.da_ghi = true; n++; console.log(`   ${mat} cửa sổ ${tomCua(d.cua_so.hang)}`); }
    if (d.go_y?.gia_tri?.length && CS[mat]?.go_y === undefined) { moi = chenTruong(moi, mat, { go_y: d.go_y.gia_tri, do_may_go_y: `máy đo ${d.go_y.luc} (scripts/do-anh.mjs --cua, không AI): ảnh ${d.go_y.anh.split('/').pop()}` }); d.go_y.da_ghi = true; n++; console.log(`   ${mat} gờ ${d.go_y.gia_tri.join(', ')}`); } }
  if (n) { JSON.parse(moi); writeFileSync(du('cua-so'), moi); writeFileSync(du('do-anh'), JSON.stringify(so, null, 1) + '\n'); } console.log(`đã ghi ${n} trường từ sổ đo`); process.exit(0); }
const KHOI = (gt('--khoi') || '').split(',').filter(Boolean); if (!KHOI.length) { console.error('dùng: do-anh.mjs --khoi way/…[,way/…] [--tim] [--ghi] [--ghi-de] [--lam-lai] | --tu-kiem'); process.exit(1); }
const D = JSON.parse(readFileSync(join(PUB, 'du-lieu', `${LAU}.json`), 'utf8')), M = 111320, C = Math.cos(D.tam[0] * Math.PI / 180), raLatLng = (x, z) => [+(D.tam[0] - z / M).toFixed(7), +(D.tam[1] + x / (M * C)).toFixed(7)];
const dinh = KHOI.flatMap((id) => { const k = D.khoi.find((b) => b.id === id); if (!k) { console.error('không có khối ' + id); process.exit(1); } return k.ngoai[0]; });
const lam = (v, f) => f(v / 10) * 10, V = [lam(Math.min(...dinh.map((p) => p[0])) - 45, Math.floor), lam(Math.max(...dinh.map((p) => p[0])) + 45, Math.ceil), lam(Math.min(...dinh.map((p) => p[1])) - 45, Math.floor), lam(Math.max(...dinh.map((p) => p[1])) + 45, Math.ceil)];
const VONG = co('--vong') ? (/^[\d,]+$/.test(gt('--vong') || '') ? gt('--vong') : '70,120,190,280') : null, RV = VONG ? Math.max(...VONG.split(',').map(Number)) : 0;
const VUNG = VONG ? [V[0] - RV, V[1] + RV, V[2] - RV, V[3] + RV] : V; // chỗ đứng hợp lệ của lời giải
const KHO = join(KHO_GOC, V.join('_') + (VONG ? '_vong' : '')), NAN = join(KHO, 'nan'), SO = du('do-anh'); mkdirSync(NAN, { recursive: true });
const so = existsSync(SO) ? JSON.parse(readFileSync(SO, 'utf8')) : { anh: {}, mat: {} };

console.log(`1. KHO GÓC NHÌN vùng x ${V[0]}…${V[1]} · z ${V[2]}…${V[3]}`);
if (!existsSync(join(KHO, 'kho.json')) && chay(process.execPath, [join(SC, 'kho-goc-nhin.mjs'), KHO, ...V.map(String), '9', '--lau', LAU, ...(VONG ? ['--vong', VONG] : [])])) process.exit(1);
const kho = JSON.parse(readFileSync(join(KHO, 'kho.json'), 'utf8')), khoY = [Math.min(...kho.map((g) => g.p[1])), Math.max(...kho.map((g) => g.p[1]))];
console.log(`   ${kho.length} góc nhìn (${KHO})`);

const dienTich = (v) => Math.abs(v.reduce((a, p, i) => a + p[0] * v[(i + 1) % v.length][1] - v[(i + 1) % v.length][0] * p[1], 0)) / 2;
if (co('--tim')) for (const id of [...KHOI].sort((a, b) => dienTich(D.khoi.find((k) => k.id === b).ngoai[0]) - dienTich(D.khoi.find((k) => k.id === a).ngoai[0])).slice(0, 4)) { /* 4 khối lớn nhất của nhóm: khối cạnh nhau ra cùng danh mục ảnh */ console.log(`   tìm ảnh quanh ${id}`); chay(process.execPath, [join(SC, 'tim-anh.mjs'), '--khoi', id, '--r', '80', '--tai', 'het', '--lau', LAU]); }
const WEB = existsSync(du('anh-web')) ? JSON.parse(readFileSync(du('anh-web'), 'utf8')) : [], coTep = WEB.filter((a) => existsSync(join(PUB, 'du-lieu', a.tep)));
const VK = V.join('_') + (VONG ? '_vong' : ''), raCu = join(KHO, 'khop.json'), nhoKhop = existsSync(raCu) && !co('--lam-lai') ? JSON.parse(readFileSync(raCu, 'utf8')) : {};
// ảnh chưa có camera được thử ở tối đa 2 vùng (ảnh của vùng khác ghép hỏng ở vùng này là thường — không thử mãi); kết quả ghép của vùng nhớ ở khop.json: đổi ngưỡng không phải ghép lại
const canThu = coTep.filter((a) => co('--lam-lai') || (!so.anh[a.tep]?.camera && !(so.anh[a.tep]?.vung_thu || []).includes(VK) && ((so.anh[a.tep]?.vung_thu || []).filter((k) => k.endsWith('_vong') === !!VONG).length < 2))).map((a) => a.tep);
const can = canThu.filter((t) => !nhoKhop[t] || (!nhoKhop[t].hong && nhoKhop[t].dong_thuan == null)); // kết quả ghép trước khi có phép đồng thuận → ghép lại
console.log(`2. ĐỊNH VỊ ${can.length} ảnh mới + ${canThu.length - can.length} ảnh đã ghép ở vùng này (sổ ảnh web ${coTep.length} tệp, có camera ${Object.values(so.anh).filter((a) => a.camera).length})`);
if (canThu.length) {
  const ra = join(KHO, 'khop-moi.json'); if (can.length && spawnSync(PY, ['-W', 'ignore', join(SC, 'khop-lg.py'), KHO, join(PUB, 'du-lieu'), '--ra', ra, '--chi', can.join(',')], { stdio: 'inherit' }).status) process.exit(1); // in thẳng: thấy tiến độ từng ảnh
  const kqKhop = { ...nhoKhop, ...(can.length ? JSON.parse(readFileSync(ra, 'utf8')) : {}) }; writeFileSync(raCu, JSON.stringify(kqKhop, null, 1));
  for (const tep of canThu) { const r = kqKhop[tep]; if (!r) continue; const loi = anhDat(r, khoY, VUNG), w = WEB.find((a) => a.tep === tep) || {};
    so.anh[tep] = loi ? { hong: loi, vung_thu: [...new Set([...(so.anh[tep]?.vung_thu || []), VK])], luc: new Date().toISOString().slice(0, 10) } : { lat: raLatLng(r.x, r.z)[0], lng: raLatLng(r.x, r.z)[1], rong: r.w, cao: r.h, tacGia: w.tacGia || '', giayPhep: w.giayPhep || '', trang: w.trang || '',
      camera: { y: +r.y.toFixed(2), yaw: r.yaw, pitch: r.pitch, roll: r.roll, fov: r.fov }, dung: r.dung, lech_px: +r.lech_px.toFixed(2), tach_m: +r.tach_m.toFixed(2), x: +r.x.toFixed(1), z: +r.z.toFixed(1), vung: VK, luc: new Date().toISOString().slice(0, 10) }; }
  writeFileSync(SO, JSON.stringify(so, null, 1) + '\n');
}
const dat = coTep.map((a) => a.tep).filter((t) => { const a = so.anh[t]; return a?.camera && a.x >= V[0] - 20 && a.x <= V[1] + 20 && a.z >= V[2] - 20 && a.z <= V[3] + 20; }); // chỉ ảnh đứng trong vùng này
console.log(`   ${dat.length} ảnh có camera trong vùng · ${canThu.filter((t) => so.anh[t]?.hong).length} ảnh vừa bị loại`);
for (const t of canThu) if (so.anh[t]?.hong) console.log(`     ✗ ${t.split('/').pop()}: ${so.anh[t].hong}`);
if (!dat.length) { console.log('không ảnh nào định vị được — thêm ảnh (--tim) rồi chạy lại'); process.exit(0); }

console.log(`3. NẮN ${dat.length} ảnh về các mặt của ${KHOI.join(', ')}`);
if (chay(process.execPath, [join(SC, 'nan-mat.mjs'), NAN, '--cam', SO, '--anh', dat.join(','), KHOI.join(','), '--lau', LAU], { env: { ...process.env, PX: '24', LMIN: '2' } })) process.exit(1);

console.log('4. ĐẾM');
const nhan = (t) => t.split('/').pop().replace(/\.[a-z]+$/i, '').replace(/[^A-Za-z0-9_-]+/g, '-'), uv = {};
for (const t of dat) { if (!existsSync(join(NAN, `mat-${nhan(t)}.json`)) || JSON.parse(readFileSync(join(NAN, `mat-${nhan(t)}.json`), 'utf8')).length === 0) continue;
  const r = spawnSync(PY, ['-W', 'ignore', join(SC, 'dem-chi-tiet.py'), NAN, nhan(t), '--anh'], { encoding: 'utf8' }); if (r.status) { console.log(`   ${t}: bộ đếm lỗi — ${String(r.stderr).split('\n').filter(Boolean).pop()}`); continue; }
  for (const [mat, d] of Object.entries(JSON.parse(readFileSync(join(NAN, `dem-${nhan(t)}.json`), 'utf8')))) for (const f of TRUONG) {
    const gia = d[f] ?? parseInt(d[f + '_khong_chac']); if (!Number.isFinite(gia) || d[TIN[f]] === undefined) continue;
    ((uv[mat] ??= {})[f] ??= []).push({ gia_tri: gia, tin: d[TIN[f]], anh: t, ...(NHIP[f] ? { nhip_m: d[NHIP[f]] } : {}), thay: d.thay }); } }

const uvCua = {}, uvGo = {};
if (co('--cua')) { console.log('4b. ĐẾM CỬA SỔ + GỜ NGANG (--cua)');
  for (const t of dat) { if (!existsSync(join(NAN, `mat-${nhan(t)}.json`))) continue;
    const r = spawnSync(PY, ['-W', 'ignore', join(SC, 'dem-cua-so.py'), NAN, nhan(t), '--anh'], { encoding: 'utf8' }); if (r.status) { console.log(`   ${t}: bộ đếm cửa lỗi — ${String(r.stderr).split('\n').filter(Boolean).pop()}`); continue; }
    for (const [mat, d] of Object.entries(JSON.parse(readFileSync(join(NAN, `cua-${nhan(t)}.json`), 'utf8')))) { if (d.hang?.length) (uvCua[mat] ??= []).push({ hang: d.hang, phu: d.phu, thay: d.thay, anh: t }); for (const [y, tin] of d.go_y || []) (uvGo[mat] ??= []).push({ y, tin, anh: t, phu: d.phu }); } } }
console.log('5. GỘP');
const cs = readFileSync(du('cua-so'), 'utf8'), CS = JSON.parse(cs); let moi = cs, nGhi = 0;
const ngoaiLe = []; // TỜ DUYỆT CHỈ MẶT NGOẠI LỆ (23/11/2026): người / Claude chỉ nhìn mặt máy KHÔNG GHI hoặc LỆCH tệp, không đọc lại cả bảng + từng ảnh soát
for (const mat of Object.keys(uv).sort()) for (const f of TRUONG) { if (!uv[mat][f]) continue;
  const g = gop(uv[mat][f]); (so.mat[mat] ??= {})[f] = { ...g, luc: new Date().toISOString().slice(0, 10) };
  const cu = CS[mat]?.[f], ghi = !g.khong_ghi && (cu === undefined || co('--ghi-de')) && cu !== g.gia_tri;
  if (g.khong_ghi || (cu !== undefined && cu !== g.gia_tri)) ngoaiLe.push({ mat, loai: 'dem', anh: (uv[mat][f].map((u) => u.anh)), ly: `${f}: ${g.khong_ghi || `máy ${g.gia_tri} ≠ tệp ${cu}`}` });
  console.log(`   ${mat.padEnd(18)} ${f.padEnd(9)} ${g.khong_ghi ? `KHÔNG GHI — ${g.khong_ghi}` : `${g.gia_tri}${g.nhip_m ? ` (nhịp ${g.nhip_m} m)` : ''} · tin ${g.tin} · ${g.so_anh} ảnh · ${g.anh.split('/').pop()}`}${cu !== undefined ? ` · tệp đang ghi ${cu}${!g.khong_ghi && cu !== g.gia_tri ? ' ≠ máy đo' : ''}` : ''}`);
  if (ghi && co('--ghi')) { const a = so.anh[g.anh] || {};
    moi = chenTruong(moi, mat, { [f]: g.gia_tri, [`do_may_${f}`]: `máy đo ${new Date().toISOString().slice(0, 10)} (scripts/do-anh.mjs, không AI): ảnh ${g.anh.split('/').pop()} (${a.tacGia || '?'}, ${a.giayPhep || '?'}) định vị ${a.dung} điểm khớp · sai số ${a.lech_px} px, nắn 24 px/m${g.nhip_m ? `, nhịp đo ${g.nhip_m} m trên cạnh ${(CS[mat]?.L ?? '')}` : ''}, độ tin ${g.tin}${g.so_anh > 1 ? `, ${g.so_anh} ảnh cùng số (±1)` : ''}`.replace(' trên cạnh ,', ',') }); nGhi++; } }
for (const mat of Object.keys(uvCua).sort()) { const g = gopCua(uvCua[mat]); if (!g) continue; const cu = CS[mat]?.hang, trong = !cu?.length; (so.mat[mat] ??= {}).cua_so = { ...g, tep_dang_ghi: tomCua(cu), luc: new Date().toISOString().slice(0, 10) };
  if (g.khong_ghi || (!trong && tomCua(g.hang) !== tomCua(cu))) ngoaiLe.push({ mat, loai: 'cua', anh: uvCua[mat].map((u) => u.anh), ly: `cửa sổ: ${g.khong_ghi || `máy ${tomCua(g.hang)} ≠ tệp ${tomCua(cu)}`}` });
  console.log(`   ${mat.padEnd(18)} cửa sổ   máy ${tomCua(g.hang)} · tệp ${tomCua(cu)}${g.khong_ghi ? ` · KHÔNG GHI — ${g.khong_ghi}` : trong ? ' · ghi được (tệp đang trống)' : tomCua(g.hang) === tomCua(cu) ? ' · KHỚP tệp' : ' · LỆCH tệp (không đè — xem ảnh soát cua-*.png)'}`);
  if (!g.khong_ghi && trong && co('--ghi')) { const a = so.anh[g.anh] || {}; moi = chenTruong(moi, mat, { hang: g.hang, do_may_hang: `máy đo ${new Date().toISOString().slice(0, 10)} (scripts/do-anh.mjs --cua, không AI): ảnh ${g.anh.split('/').pop()} (${a.tacGia || '?'}, ${a.giayPhep || '?'}) định vị ${a.dung} điểm khớp, phủ ${(g.phu * 100).toFixed(0)} % cạnh, độ tin ${g.tin}` }); nGhi++; } }
for (const mat of Object.keys(uvGo).sort()) { const tot = uvGo[mat].filter((u) => u.tin >= 0.8 && u.phu >= 0.5), ys = []; for (const u of tot.sort((a, b) => b.tin - a.tin)) if (!ys.some((y) => Math.abs(y - u.y) < 0.6)) ys.push(u.y);
  if (!ys.length) continue; (so.mat[mat] ??= {}).go_y = { gia_tri: ys.sort((a, b) => a - b), tin: Math.min(...tot.map((u) => u.tin)), anh: tot[0].anh, luc: new Date().toISOString().slice(0, 10) };
  console.log(`   ${mat.padEnd(18)} gờ ngang  ${ys.join(', ')} m${CS[mat]?.go_y ? ` · tệp đang ghi ${JSON.stringify(CS[mat].go_y)}` : ''}`);
  if (CS[mat]?.go_y === undefined && co('--ghi')) { moi = chenTruong(moi, mat, { go_y: ys, do_may_go_y: `máy đo ${new Date().toISOString().slice(0, 10)} (scripts/do-anh.mjs --cua, không AI): ảnh ${tot[0].anh.split('/').pop()}, dải đá ≥ 80 % bề ngang mảng gạch` }); nGhi++; } }
const soMat = new Set([...Object.keys(uv), ...Object.keys(uvCua)]).size;
if (ngoaiLe.length) { const TO = join(KHO, 'ngoai-le.png'); writeFileSync(join(KHO, 'ngoai-le.json'), JSON.stringify(ngoaiLe.map((n) => ({ ...n, anh: n.anh.map(nhan) })), null, 1));
  const r = spawnSync(PY, ['-W', 'ignore', join(SC, 'to-ngoai-le.py'), NAN, join(KHO, 'ngoai-le.json'), TO], { encoding: 'utf8' });
  console.log(`6. NGOẠI LỆ ${ngoaiLe.length} / ${soMat} mặt cần nhìn — ${r.status ? `vẽ tờ hỏng: ${String(r.stderr).split('\n').filter(Boolean).pop()}` : `tờ duyệt: ${TO}`}`); for (const n of ngoaiLe) console.log(`   ${n.mat.padEnd(18)} ${n.ly}`); }
else console.log(`6. NGOẠI LỆ 0 / ${soMat} mặt — không mặt nào cần nhìn`);
writeFileSync(SO, JSON.stringify(so, null, 1) + '\n');
if (nGhi) { JSON.parse(moi); writeFileSync(du('cua-so'), moi); }
console.log(co('--ghi') ? `đã ghi ${nGhi} trường vào ${du('cua-so')} — chạy kiem-ke + trong-tai trước khi commit` : 'chưa ghi tệp cửa sổ (thêm --ghi). Ảnh soát từng mặt: ' + join(NAN, 'dem-<ảnh>-<k>.png'));
console.log(`sổ đo: ${SO}`);

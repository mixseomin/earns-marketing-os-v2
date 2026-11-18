#!/usr/bin/env node
// tra-repo-ok: dán keo nội bộ — cùng đường nạp với lich-su/nap-tap.mjs (day-demo.mts nhánh tap → may-dung.mts --nap → --xuat), chỉ khác nguồn là tập qc-brief
// NẠP VIDEO QC BRIEF ĐÃ DỰNG VÀO MÁY ĐĂNG anglebrief (anh 19/11/2026). Chỉ NẠP, không đăng: video + 3 khung + 8 khung soát lên R2, đề mẫu video-ngoai vào máy,
// Phòng Nội dung chấm ở lượt kế, máy đăng (dang-may.mjs) tự lấy bài DUYỆT theo nhịp an toàn (máy phải đang bật).
//   node scripts/qc-brief/nap.mjs scripts/qc-brief/<tập>.json "<mô tả bài>"
// Link đích mang UTM theo mẫu (utm_campaign = mẫu) để đọc GA4 G-NHL6WC9B6J theo từng mẫu.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { BOX, GOC_BOX } from '../lich-su/box3.mjs';

const tepTap = resolve(process.argv[2] ?? ''), moTa = process.argv[3];
if (!process.argv[2] || !moTa) { console.error('dùng: nap.mjs <tập.json> "<mô tả bài>"'); process.exit(2); }
const tap = JSON.parse(readFileSync(tepTap, 'utf8')), KHO = `${process.env.HOME}/.cache/qc-brief/${tap.id}`, video = join(KHO, `${tap.id}.mp4`), cau = JSON.parse(readFileSync(join(KHO, 'cau.json'), 'utf8'));
const MAY = tap.may || 'anglebrief', dau = (b) => createHash('md5').update(b).digest('hex').slice(0, 10), b = readFileSync(video), ten = `${tap.id}-${dau(b)}`;
const TAM = mkdtempSync(join(tmpdir(), 'qcb-nap-')); copyFileSync(video, join(TAM, `${ten}.mp4`));
// khung: 3 khung giữa 3 cảnh rải đều (thẻ bài) + 8 khung giữa cảnh cho Phòng Nội dung soát
const giua = (n) => { const ds = cau.canh.length <= n ? cau.canh : Array.from({ length: n }, (_, i) => cau.canh[Math.round((i * (cau.canh.length - 1)) / (n - 1))]); return ds.map((s) => Math.min(s.kt - 0.1, s.bd + 1.8)); };
const cat = (g, nhan) => { const t = `${tap.id}-${nhan}`; execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(g), '-i', video, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '4', join(TAM, `${t}.jpg`)]);
  const moi = `${t}-${dau(readFileSync(join(TAM, `${t}.jpg`)))}`; execFileSync('mv', [join(TAM, `${t}.jpg`), join(TAM, `${moi}.jpg`)]); return moi; };
const K = giua(3).map((g, i) => cat(g, `k${i}`)), S = giua(8).map((g, i) => cat(g, `s${i}`));
const bt = `/var/tmp/qcb-nap-${tap.id}`, tsx = (l) => execFileSync('ssh', [BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server timeout 300s ../../node_modules/.bin/tsx ${l}`], { encoding: 'utf8', maxBuffer: 16 << 20 });
try {
  execFileSync('ssh', [BOX, `rm -rf ${bt} && mkdir -p ${bt}/f`]); execFileSync('sh', ['-c', `scp -q ${TAM}/* ${BOX}:${bt}/f/`]);
  const u = JSON.parse(tsx(`scripts/lich-su/day-demo.mts ${MAY} ${bt}/f tap`).trim().split('\n').pop());
  // Phòng Nội dung chặn nền không phải ảnh free có nguồn → nen_url = ảnh Pexels đang làm nền video (tai_san.nen_nguon[0]); chữ đăng phải chứa link đích
  const pid = /(\d+)\/?$/.exec(tap.tai_san?.nen_nguon?.[0] ?? '')?.[1], nenPexels = pid ? `https://images.pexels.com/photos/${pid}/pexels-photo-${pid}.jpeg` : null;
  if (!nenPexels) throw new Error('tập thiếu tai_san.nen_nguon (trang Pexels của ảnh nền)');
  if (!tap.goc?.id) throw new Error('tập thiếu goc {id, sp, loai, ten} — góc spy (nhóm #4668) mà tập này phục vụ');
  const giay = Math.round(cau.DAI * 100) / 100, q = tap.nguon_qc, link = `https://anglebrief.net/?utm_source=facebook&utm_medium=social&utm_campaign=${tap.mau}&utm_content=${tap.id}`;
  const nap = [{ slug: tap.id, chu_de: tap.tieu_de, mau: 'video-ngoai', nen_url: nenPexels,
    de: { loai: 'video-ngoai', video_url: u[ten], giay, khung: K.map((x) => u[x]), soat: S.map((x) => u[x]), tom_tat: tap.tieu_de },
    dang: { title: tap.tieu_de, description: `${moTa}\n\n${link}`, link, mau: tap.mau, goc: tap.goc, ...(q ? { hook: { qc: q.library_id, goc: tap.cau[1]?.canh?.khoanh ?? tap.cau[0].chu, ngay: q.ngay, page: q.page } } : {}) } }];
  writeFileSync(join(TAM, 'nap.json'), JSON.stringify(nap)); execFileSync('scp', ['-q', join(TAM, 'nap.json'), `${BOX}:${bt}/nap.json`]);
  console.log(tsx(`scripts/may-dung.mts --may ${MAY} --nap < ${bt}/nap.json`).trim().split('\n').pop());
  console.log(tsx(`scripts/may-dung.mts --may ${MAY} --xuat ${tap.id}`).trim().split('\n').pop());
  console.log(`✓ nạp ${tap.id} · ${giay}s · ${(b.length / 1e6).toFixed(1)} MB · ${u[ten]} · Phòng Nội dung chấm ở lượt kế`);
} finally { try { execFileSync('ssh', [BOX, `rm -rf ${bt}`]); } catch { /* đã xong */ } rmSync(TAM, { recursive: true, force: true }); }

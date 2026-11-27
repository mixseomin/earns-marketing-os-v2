#!/usr/bin/env node
// tra-repo-ok: dán keo đọc wikitext Wikipedia (API parse) — không tự gõ tên cầu thủ từ trí nhớ (anh 28/11/2026 "Thêm đủ các cầu thủ").
// Lấy đội hình đội một THẬT của từng đội trong tệp đội (tran-doi.json) rồi ghi vào doi[].cauthu = [{so, ten, ngan, vt, qt}].
//   doi[].wiki = { trang: "Real_Madrid_CF", khung: "Template:Real_Madrid_CF_squad" }   (khung = navbox có tên ngắn in trên áo, tuỳ chọn)
//   node doi-hinh.mjs --doi tran-doi.json            → ghi đè cauthu, in đội hình + đội hình ra sân (xi)
// doi[].xi = [số áo…] (11 số) chọn đội ra sân; không có thì máy chọn 1 GK + 4 DF + 3 MF + 3 FW theo số áo nhỏ nhất.
import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&page=';
const UA = { 'user-agent': 'physics-sim-research/1.0' };
const boLink = (s) => s.replace(/<ref.*?(<\/ref>|\/>)/g, '').replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
const thamSo = (than) => { const d = {}; for (const x of than.split(/\|(?![^[]*\]\])/)) { const i = x.indexOf('='); if (i > 0) d[x.slice(0, i).trim()] = x.slice(i + 1).trim(); } return d; };

async function wikitext(trang) {
  const r = await fetch(API + encodeURIComponent(trang) + '&redirects=1', { headers: UA });
  const j = await r.json(); if (!j.parse) throw new Error(`Wikipedia không có trang ${trang}: ${JSON.stringify(j.error ?? j).slice(0, 200)}`);
  return j.parse.wikitext;
}

export async function layDoiHinh({ trang, khung }) {
  const w = await wikitext(trang);
  const i = w.search(/\{\{\s*[Ff]s start/), j = w.search(/\{\{\s*[Ff]s end/);
  if (i < 0 || j < i) throw new Error(`${trang}: không thấy khối {{Fs start}}…{{Fs end}} (đội hình đội một)`);
  const ds = [];
  for (const m of w.slice(i, j).matchAll(/\{\{\s*[Ff]s player\s*\|(.*)\}\}/g)) {
    const d = thamSo(m[1]); if (!d.no || !d.name) continue;
    ds.push({ so: Number(d.no), ten: boLink(d.name), vt: d.pos, qt: d.nat });
  }
  // tên ngắn in trên áo: lấy ở navbox đội ({{football squad2 player|no=|name=[[Full|Ngắn]]}}); không có thì lấy chữ cuối của tên
  const ngan = {};
  if (khung) for (const m of (await wikitext(khung)).matchAll(/football squad2 player\s*\|no=(\d+)\|name=\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g)) ngan[Number(m[1])] = boLink(m[2]);
  for (const c of ds) c.ngan = ngan[c.so] ?? c.ten.split(' ').slice(-1)[0];
  return ds;
}

export function chonXi(cauthu, xi) {
  if (xi?.length === 11) return xi.map((so) => { const c = cauthu.find((x) => x.so === so); if (!c) throw new Error(`xi: không có số áo ${so} trong đội hình`); return c; });
  const lay = (vt, n) => cauthu.filter((c) => c.vt === vt).sort((a, b) => a.so - b.so).slice(0, n);
  const ra = [...lay('GK', 1), ...lay('DF', 4), ...lay('MF', 3), ...lay('FW', 3)];
  if (ra.length !== 11) throw new Error(`đội hình thiếu người để xếp 4-3-3 (có ${ra.length}/11)`);
  return ra;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
  const tep = arg('doi', new URL('./tran-doi.json', import.meta.url).pathname), DOI = JSON.parse(readFileSync(tep, 'utf8'));
  await Promise.all(DOI.doi.map(async (d) => { if (d.wiki) d.cauthu = await layDoiHinh(d.wiki); }));
  for (const d of DOI.doi) {
    if (!d.cauthu) { console.log(`${d.ten}: không có wiki → giữ nguyên`); continue; }
    const xi = chonXi(d.cauthu, d.xi);
    console.log(`${d.ten}: ${d.cauthu.length} cầu thủ · ra sân: ${xi.map((c) => `${c.so} ${c.ngan}`).join(', ')}`);
  }
  DOI.nguon = `Wikipedia (đội hình đội một), lấy ${new Date().toISOString().slice(0, 10)}`;
  writeFileSync(tep, JSON.stringify(DOI, null, 2) + '\n');
}

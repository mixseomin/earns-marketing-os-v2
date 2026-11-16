#!/usr/bin/env node
// CỔNG GIỌNG CHUNG cho script (05/11/2026 ckey; 08/11/2026 anh: "Mọi AI API đều phải qua fallback"; 16/11/2026: chuỗi chuyển vào CỔNG AI CHUNG — spy-on-tc/server/
// cong-media.mjs › sinhGiong: ckey Speakvela/ElevenLabs-TTS 156₫ / câu (theo MÃ giọng) → fal eleven-v3 → ElevenLabs chính hãng cuối). Tệp này chỉ còn gửi từng câu
// lên cổng (POST /api/ai {loai: 'giong'}) — không giữ khoá nào. ckey lờ tên giọng nên cổng đổi tên → mã (MA_GIONG ở cổng); tên lạ = cổng báo lỗi, dừng.
// Chạy trên box3 (khoá cổng /root/.secrets/spy.env) hoặc máy có CONG_AI_KEY:
//   node scripts/lich-su/giong-ckey.mjs <yeu-cau.json> <thư-mục-ra>
//   yeu-cau.json = { giong: 'Charlotte' | '<mã>', engine?: 'v3', language?: 'en', cau: [{ khoa, chu }] }  → <ra>/<khoa>.mp3 mỗi câu; dòng cuối in tuyến + tiền thật
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SPY_ENV = '/root/.secrets/spy.env';
const docKhoa = (t) => { try { return readFileSync(t, 'utf8').match(/^CONG_AI_KEY=(.*)$/m)?.[1]?.replace(/["']/g, '').trim() || null; } catch { return null; } };
const KHOA = process.env.CONG_AI_KEY || docKhoa(SPY_ENV) || docKhoa(`${homedir()}/.secrets/cong-ai.env`);
const URL_CONG = process.env.CONG_AI_URL || (existsSync(SPY_ENV) ? 'http://127.0.0.1:3850/api/ai' : 'https://spy.on.tc/api/ai');
async function giong(c, Y) {
  const r = await fetch(URL_CONG, { method: 'POST', headers: { authorization: `Bearer ${KHOA}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(400_000),
    body: JSON.stringify({ viec: 'xv-giong-script', loai: 'giong', chu: c.chu, giong: Y.giong ?? 'Charlotte', engine: Y.engine ?? 'v3', language: Y.language ?? 'en', bo_chinh_hang: !!Y.bo_chinh_hang }) });
  const j = await r.json().catch(() => ({ loi: `cổng HTTP ${r.status}` }));
  if (!r.ok || j.loi) throw new Error(j.loi || `cổng HTTP ${r.status}`);
  return { b: Buffer.from(j.am_b64, 'base64'), model: j.model, vnd: Math.round((j.chi_usd || 0) * 26000) };
}

if (process.argv[1] === '-' || process.argv[1]?.endsWith('giong-ckey.mjs')) {   // '-': shot-code/long-tieng.mjs chạy bản repo máy mình qua stdin (node -)
  const [tep, ra] = process.argv.slice(2); if (!tep || !ra) { console.error('node giong-ckey.mjs <yeu-cau.json> <ra>'); process.exit(2); }
  const Y = JSON.parse(readFileSync(tep, 'utf8'));
  if (!KHOA) { console.error('✗ thiếu CONG_AI_KEY (box3: /root/.secrets/spy.env · máy khác: ~/.secrets/cong-ai.env)'); process.exit(3); }
  mkdirSync(ra, { recursive: true }); let vnd = 0; const tuyen = {};
  for (const c of Y.cau) {
    if (c.chu.length > 1000) { console.error(`✗ câu ${c.khoa} dài ${c.chu.length} ký tự (> 1.000 của gói 156₫)`); process.exit(4); }
    let k; try { k = await giong(c, Y); } catch (e) { console.error(`✗ câu ${c.khoa}: ${e.message}`); process.exit(/chưa có mã/.test(e.message) ? 5 : 1); }
    vnd += k.vnd; tuyen[k.model] = (tuyen[k.model] || 0) + 1;
    writeFileSync(join(ra, `${c.khoa}.mp3`), k.b);
  }
  console.log(`giọng ${Y.giong ?? 'Charlotte'} · ${Y.cau.length} câu · ${Object.entries(tuyen).map(([m, n]) => `${m} ${n}`).join(' · ')} · tiền ${vnd}₫`);
}

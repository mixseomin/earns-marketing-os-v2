#!/usr/bin/env node
// PHỦ adapter: doanh thu Chaturbate theo NGÀY (revshare 20%) → phu_su_kien loai=spend, mang=chaturbate.
//
// API affiliates/apistats chỉ trả tổng theo ngày (không breakdown campaign/track/sid — đã thử 14/09/2026),
// nên tiền Chaturbate nằm ở dòng (organic / không sid) của phễu; tách theo campaign phải đọc trên
// dashboard Chaturbate (Stats → Campaign). Token đọc từ Directus accounts (zoomxxx) qua DIRECTUS_TOKEN
// của MOS2 — không chép khoá ra chỗ khác. Chạy cron 1 lần/ngày, kéo 15 ngày gần nhất, ĐÈ theo ngày.
//   env: MOS2_EXT_KEY · DIRECTUS_URL · DIRECTUS_TOKEN · PHU_PROJECT
const MOS2 = process.env.MOS2_URL || 'http://127.0.0.1:3821';
const KEY = process.env.MOS2_EXT_KEY, DU = process.env.DIRECTUS_URL, DT = process.env.DIRECTUS_TOKEN;
const PROJECT = process.env.PHU_PROJECT || 'chatwhenbored';
const ACC = process.env.PHU_CB_ACCOUNT || '29a54138-b029-46f9-945c-c88f94d5c6bc';
if (!KEY || !DU || !DT) { console.error('thiếu MOS2_EXT_KEY/DIRECTUS_URL/DIRECTUS_TOKEN'); process.exit(1); }

const bao = async (ok, note, events = []) => {
  const res = await fetch(`${MOS2}/api/phu/ingest`, { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ project: PROJECT, events, adapter: { key: 'chaturbate-stats', name: 'Chaturbate apistats (doanh thu/ngày)', loai: 'cron', lich: '20 5 * * *', ok, note } }) });
  console.log(new Date().toISOString(), 'chaturbate:', res.status, note, await res.text().catch(() => ''));
};
try {
  const a = await (await fetch(`${DU}/items/accounts/${ACC}?fields=handle,api_config`, { headers: { authorization: `Bearer ${DT}` } })).json();
  const c = a.data.api_config || {};
  const user = c.username || a.data.handle, tok = c.affiliate_token;
  if (!tok) throw new Error('Directus account không có affiliate_token');
  const r = await fetch(`https://chaturbate.com/affiliates/apistats/?username=${user}&token=${tok}`);
  if (!r.ok) throw new Error(`apistats ${r.status}`);
  const d = await r.json();
  const events = []; const tomTat = [];
  for (const prog of d.stats || []) {
    const cols = prog.columns || [];
    for (const row of prog.rows || []) {
      const m = Object.fromEntries(cols.map((k, i) => [k, row[i]]));
      const ngay = String(m.Date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) continue;
      const payout = parseFloat(m.Payout) || 0, regs = parseInt(m['Free Registrations']) || 0, hits = parseInt(m['Raw Hits']) || 0;
      const ma = `cb:${ngay}:${String(prog.program || '').slice(0, 24).replace(/[^A-Za-z0-9]+/g, '-')}`;
      const raw = { program: prog.program, spent: m['Total Money Spent'], regs, hits, engaged: m['Engaged Hits'] };
      if (payout) events.push({ ts: `${ngay}T12:00:00Z`, loai: 'spend', platform: 'chaturbate', mang: 'chaturbate', amount: payout, ma_don: ma, nguon_du_lieu: 'api:chaturbate', raw });
      // đăng ký free = signup (không có sid → dòng organic trên /phu); ngày 0 payout vẫn ghi để cột signup không mù (16/09/2026)
      for (let i = 0; i < regs; i++) events.push({ ts: `${ngay}T12:00:00Z`, loai: 'signup', platform: 'chaturbate', mang: 'chaturbate', ma_don: `${ma}:reg${i + 1}`, nguon_du_lieu: 'api:chaturbate', raw });
      if (hits) tomTat.push(`${ngay} ${hits} hit/${regs} reg/$${payout}`);
    }
  }
  await bao(true, `${tomTat.join(' · ') || 'không hit'} · kỳ ${d.range?.start_date}→${d.range?.end_date}`, events);
} catch (e) {
  await bao(false, String(e.message));
  process.exit(1);
}

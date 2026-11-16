#!/usr/bin/env node
// XEM CHI TIẾT CHỒNG LẤN ô cửa (kiem-ke.mjs chỉ in mặt + toạ độ dọc tường): in đủ hai ô của từng cặp — mặt, s dọc tường, bậu y, cao,
// nửa bề ngang + viền khung — để biết cặp nào đè (hàng chung theo sàn tầng ba, cửa đo, mặt dựng riêng…). Chỉ đọc, không ghi tệp nào.
//   node apps/castle/scripts/xem-chong-lan.mjs --lau neuschwanstein
// tra-repo-ok: công cụ soi nội bộ trên dữ liệu riêng của cảnh.
import { moTrang } from './chung.mjs';
const { pg, dong } = await moTrang();
const ds = await pg.evaluate(() => window.__ns.chongLan());
const neo = await pg.evaluate(() => ({ san: window.__ns.MAT_SAN }));
await dong();
console.log(`mặt sân trên ${neo.san} · ${ds.length} cặp chồng lấn`);
for (const c of ds) console.log(JSON.stringify(c));

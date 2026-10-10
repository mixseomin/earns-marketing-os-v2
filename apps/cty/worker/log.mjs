// Sổ sự kiện chung của công ty — một dòng JSON mỗi sự kiện, để hiểu và debug: ai gọi mô hình gì, ai đọc tài liệu nào,
// ai gửi tin cho ai, quyết định gì, lỗi gì. Tệp theo ngày: ${CTY_DATA_DIR:-/var/lib/cty}/log/YYYY-MM-DD.jsonl.
// Loại sự kiện (loai): goi (gọi mô hình) · doc (đọc tài liệu/số) · tin (trao tay giữa nhân sự) · quyet (kết luận/trạng thái)
// · loi · he-thong. Mọi dòng có `luot` (mã lượt) để lần theo một việc từ đầu tới cuối. `node worker/log.mjs --tu-kiem` = kiểm ghi/đọc.
import fs from 'node:fs';
import path from 'node:path';

const dir = () => path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'log');

export function ghiLog(e) {
  const dong = { ts: new Date().toISOString(), ...e };
  try { fs.mkdirSync(dir(), { recursive: true }); fs.appendFileSync(path.join(dir(), `${dong.ts.slice(0, 10)}.jsonl`), JSON.stringify(dong) + '\n'); } catch (err) { console.error('log:', err.message); }
  return dong;
}

// Đọc N dòng gần nhất (mọi ngày, mới trước), lọc theo luot / tu / loai nếu có.
/** @param {{ luot?: string, tu?: string, loai?: string, n?: number }} [o] */
export function docLog({ luot, tu, loai, n = 300 } = {}) {
  if (!fs.existsSync(dir())) return [];
  const files = fs.readdirSync(dir()).filter((f) => f.endsWith('.jsonl')).sort().reverse();
  const out = [];
  for (const f of files) {
    const lines = fs.readFileSync(path.join(dir(), f), 'utf8').trim().split('\n').reverse();
    for (const l of lines) {
      let e; try { e = JSON.parse(l); } catch { continue; }
      if (luot && e.luot !== luot) continue; if (tu && e.tu !== tu && e.toi !== tu) continue; if (loai && e.loai !== loai) continue;
      out.push(e); if (out.length >= n) return out;
    }
  }
  return out;
}

if (process.argv.includes('--tu-kiem') && (process.argv[1] || '').endsWith('log.mjs')) {
  process.env.CTY_DATA_DIR = fs.mkdtempSync('/tmp/cty-log-');
  ghiLog({ luot: 'L1', loai: 'doc', tu: 'tam', chi_tiet: { tep: 'AGENTS.md', ky_tu: 1000 } });
  ghiLog({ luot: 'L1', loai: 'tin', tu: 'tam', toi: 'loc', chi_tiet: { noi_dung: 'giao việc' } });
  ghiLog({ luot: 'L2', loai: 'goi', tu: 'ky', chi_tiet: { model: 'x' } });
  const a = (c, m) => { if (!c) { console.error('✗ log.mjs:', m); process.exit(1); } };
  a(docLog().length === 3, 'ghi 3 đọc 3');
  a(docLog({ luot: 'L1' }).length === 2, 'lọc theo lượt');
  a(docLog({ tu: 'loc' }).length === 1 && docLog({ tu: 'loc' })[0].loai === 'tin', 'lọc theo người (cả tu lẫn toi)');
  a(docLog({ loai: 'goi' })[0].luot === 'L2', 'lọc theo loại, mới trước');
  console.log('✓ log.mjs: ghi/đọc/lọc đạt'); process.exit(0);
}

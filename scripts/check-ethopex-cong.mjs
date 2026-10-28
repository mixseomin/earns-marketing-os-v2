#!/usr/bin/env node
/* LUẬT: mọi lời gọi DANH SÁCH / BÁO CÁO Ethopex đi qua cổng chung apps/etp/ethopex_api.py — không ai tự gọi thẳng.
 *
 * Vì sao có tệp này. 28–29/10/2026 máy luật đọc report MỘT trang (1.000 dòng) — từ khi tài khoản htuan82 thấy thêm tài khoản của người khác,
 * report dài 1.823 dòng, camp nhà ở trang 2 thành $0: #65486 tiêu $5.12 mà máy đọc "Chi từ trước tới nay $0.00", #65722 $20 đang lãi không được
 * xét nhân bản. dong-bo.py xin 50.000 dòng một lượt trong khi máy chủ cắt 10.000; kiem-so-camp.sh và dong-bo-so-lieu.sh đọc 500 / 200 camp.
 * Anh: "sao lại limit theo trang được? Sau này sẽ có 1 tỷ camp". Gốc: mỗi script tự gọi API + tự đặt page_size → mỗi chỗ một cái trần.
 * Cổng chung (EA.api / EA.doc_het) lật đủ mọi trang theo total_pages của máy chủ — số dòng người gọi xin không còn là trần.
 *
 * Máy canh: tệp nào trong apps/ (py · sh · mjs · ts) có chuỗi api.ethopex.dev kèm /api/v1/report hoặc page_size= (tức là gọi danh sách) thì
 * phải đi qua cổng: có `EA.api` / `EA.doc_het` / `import ethopex_api` VÀ không tự fetch/urlopen report. Lệnh ghi lẻ / đọc một camp thì không bị bắt.
 * TẦM VỚI: đọc chuỗi mã. Không bắt được: script tự lật trang sai cách nhưng vẫn gọi qua một hàm tên khác. `--tu-kiem` phá thử.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const GOC = 'apps', CONG = 'apps/etp/ethopex_api.py';
// chỉ tệp git đang theo dõi (mã thật) — bỏ mã nguồn tham khảo tải về, symlink hỏng, bản dựng
const quet = (d) => execSync(`git ls-files ${d}`, { encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n').filter((p) => /\.(py|sh|mjs|ts|tsx)$/.test(p) && !p.includes('/tham-khao/'));

const loi = (ten, s) => {
  if (ten === CONG || !s.includes('api.ethopex.dev')) return null;
  const goiThang = /(urlopen|fetch)\([^\n]*api\.ethopex\.dev[^\n]*\/api\/v1\/report/.test(s) || /(fetch|urlopen)\([^\n]*api\.ethopex\.dev\/api\/v1\/[a-z-]+\?[^\n]*page_size/.test(s);
  if (goiThang) return 'tự gọi report / danh sách Ethopex thẳng (không qua cổng chung) — một trang là mất camp';
  const coDs = /\/api\/v1\/report|page_size=/.test(s);
  const quaCong = /EA\.api|EA\.doc_het|import ethopex_api/.test(s);
  return coDs && !quaCong ? 'gọi danh sách Ethopex mà không qua cổng chung apps/etp/ethopex_api.py' : null;
};

if (process.argv.includes('--tu-kiem')) {
  const sai = [
    ['a.py', 'x = urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev/api/v1/report", data=b))'],
    ['b.sh', "fetch('https://api.ethopex.dev/api/v1/campaigns?page_size=200',{headers:h})"],
    ['c.py', 'T="https://api.ethopex.dev"\nr = api("/api/v1/campaigns?page_size=500")'],
  ];
  const dung = [
    ['d.py', 'api = lambda p: json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev" + p)))\napi = lambda p, b=None: EA.api(p, b)\napi("/api/v1/report", {})'],
    ['e.py', 'urllib.request.urlopen(urllib.request.Request(f"https://api.ethopex.dev/api/v1/campaigns/{c}"))'],
  ];
  const lot = [...sai.filter(([t, s]) => !loi(t, s)).map(([t]) => `phá thử ${t} mà vẫn xanh`), ...dung.filter(([t, s]) => loi(t, s)).map(([t]) => `${t} hợp lệ mà bị đỏ`)];
  if (lot.length) { console.error('✗ check-ethopex-cong tự kiểm:\n  ' + lot.join('\n  ')); process.exit(1); }
  console.log(`✓ check-ethopex-cong tự kiểm: ${sai.length} ca sai đều đỏ, ${dung.length} ca đúng đều xanh`); process.exit(0);
}

const ds = quet(GOC).map((p) => [p, loi(p, readFileSync(p, 'utf8'))]).filter(([, e]) => e);
if (ds.length) { console.error(`✗ gọi Ethopex không qua cổng chung (${ds.length}):\n${ds.map(([p, e]) => `  ${p} — ${e}`).join('\n')}`); process.exit(1); }
console.log('✓ check-ethopex-cong: mọi danh sách / báo cáo Ethopex đi qua cổng chung (đủ mọi trang)');

// tra-repo-ok: keo noi bo — phan TS / worker cua luoi kiem-xung-dot-luat.py (viec #125 phan C, anh 19/11/2026)
// Goi: node_modules/.bin/tsx apps/etp/kiem-xung-dot-luat.mts '<json {o: [[h, chi, thu, ns], ...]}>' [duong worker ethopex.mjs]
// In JSON: khung theo gio cua etp2 (khungLuc) va worker (khungCua), cong sang cua etp2 / worker, quaCong etp2 tung o, luatThang khi phanh / khung giam.
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
// etp2 = repo riêng (27/11/2026): kiem-xung-dot-luat.py truyền gốc repo etp2 qua ETP2_GOC (apps/etp/goc_etp2.py) — tsx dùng tsconfig của repo đó cho '@/…'
const ETP2 = process.env.ETP2_GOC;
if (!ETP2 || !fs.existsSync(`${ETP2}/src/lib/etp-khung.ts`)) { console.error(`✗ không thấy etp-khung.ts ở repo etp2 (ETP2_GOC=${ETP2 ?? 'trống'})`); process.exit(2); }
const { khungLuc, congTang, quaCong, luatThang } = await import(pathToFileURL(`${ETP2}/src/lib/etp-khung.ts`).href) as {
  khungLuc: (h: number) => string; congTang: (h: number) => unknown; quaCong: (chi: number, thu: number, ns: number, h: number) => unknown; luatThang: (x: Record<string, boolean>) => unknown };

const vao = JSON.parse(process.argv[2] || '{"o":[]}') as { o: [number, number, number, number][] };
const tepWorker = process.argv[3] || '';
const gio = Array.from({ length: 24 }, (_, h) => h);
let worker: { khungCua?: (h: number) => string; congNap?: (k: string) => { tu: number; den: number; roi: number } | null } | null = null;
if (tepWorker && fs.existsSync(tepWorker)) worker = await import(pathToFileURL(tepWorker).href);
const ra = {
  khungLuc: gio.map((h) => khungLuc(h)),
  khungCua: worker?.khungCua ? gio.map((h) => worker!.khungCua!(h)) : null,
  congTangSang: congTang(9),
  congNapSang: worker?.congNap ? worker.congNap('sang') : null,
  congNapNgoai: worker?.congNap ? worker.congNap('tang') : null,
  quaCong: vao.o.map(([h, chi, thu, ns]) => quaCong(chi, thu, ns, h)),
  lyPhanh: luatThang({ phanh_cho: true }),
  lyKhung: luatThang({ khung_gio: true }),
};
console.log(JSON.stringify(ra));

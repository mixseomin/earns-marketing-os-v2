// THƯ VIỆN KỸ NĂNG CỦA CÔNG TY (anh 26/10/2026: "còn loại skill nào áp dụng cho nhân sự phòng khác cho nó giỏi lên… cấm bịa skill, phải lấy từ nguồn
// bên ngoài" → "gắn đi, rồi cài cho Long và Vân"). Kỹ năng chép nguyên SKILL.md từ ba thư viện MIT, mỗi nguồn một thư mục trong cong-ty/ky-nang/
// (README + LICENSE từng nguồn). Một chỗ tra tên → tệp cho mọi người dùng: Ngọc chấm theo loại bài (kiem-bai.mjs), Long sửa bài theo đúng kỹ năng Ngọc
// chấm, Vân xử việc phòng theo kỹ năng trong hồ sơ (máy iMac gọi CLI này qua ssh). Tên trùng giữa hai nguồn thì nguồn đứng trước trong NGUON thắng.
//   node worker/ky-nang.mjs --nguoi <id> [--loai <loại bài>] [--toi-da <số kỹ năng>] [--tran <ký tự mỗi kỹ năng>]   in chữ kỹ năng (hồ sơ người đó ∪ kỹ năng của loại bài)
//   node worker/ky-nang.mjs --tu-kiem
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';
import { parseFm } from '../scripts/fm.mjs';

export const NGUON = ['marketingskills', 'claude-skills', 'superpowers'];
const THU_VIEN = () => path.join(GOC, 'cong-ty', 'ky-nang');
/** Tệp của một kỹ năng, null khi không có trong thư viện (kỹ năng nhà như human-voice nằm ở chỗ khác). */
export const tepKyNang = (ten) => NGUON.map((n) => path.join(THU_VIEN(), n, `${ten}.md`)).find((f) => fs.existsSync(f)) ?? null;
/** Chữ của các kỹ năng (bỏ phần đầu YAML), mỗi kỹ năng cắt ở `tran` ký tự để lời giao việc không phình. Tên không có trong thư viện bị bỏ qua. */
export const chuKyNang = (ds, tran = 20000) => [...new Set(ds)].map((t) => { const f = tepKyNang(t); return f ? `### Kỹ năng: ${t}\n${fs.readFileSync(f, 'utf8').replace(/^---[\s\S]*?---\n/, '').slice(0, tran)}` : null; }).filter(Boolean).join('\n\n');
/** Kỹ năng thư viện trong hồ sơ một người (SOUL.md `skills:`). */
export const kyNangNguoi = (id) => { try { return [].concat(parseFm(fs.readFileSync(path.join(GOC, 'cong-ty', 'nhan-su', id, 'SOUL.md'), 'utf8')).fm.skills ?? []).map(String).filter((t) => tepKyNang(t)); } catch { return []; } };
/** Kỹ năng Ngọc dùng chấm một loại bài (loai-bai.json). */
export const kyNangLoai = (loai) => { try { const b = JSON.parse(fs.readFileSync(path.join(GOC, 'cong-ty', 'quy-dinh', 'noi-dung', 'loai-bai.json'), 'utf8')); return (b.loai[loai] ?? Object.values(b.loai).find((v) => v.bi_danh?.includes(loai)))?.ky_nang ?? []; } catch { return []; } };

const a = process.argv, lay = (k) => { const i = a.indexOf(k); return i > 0 ? a[i + 1] : null; };
if (a[1]?.endsWith('ky-nang.mjs') && a.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  for (const n of NGUON) t.ok(fs.existsSync(path.join(THU_VIEN(), n, 'LICENSE')), `${n}: có giấy phép`);
  t.ok(tepKyNang('copywriting').includes('/marketingskills/'), 'nguồn đầu thắng'); t.ok(tepKyNang('systematic-debugging').includes('/superpowers/')); t.equal(tepKyNang('human-voice'), null, 'kỹ năng nhà không thuộc thư viện');
  t.ok(chuKyNang(['social', 'khong-co', 'social']).match(/### Kỹ năng: social/g).length === 1, 'trùng tên một lần, tên lạ bỏ'); t.ok(!chuKyNang(['social']).includes('name: social'), 'bỏ phần đầu YAML');
  t.deepEqual(kyNangLoai('bai'), ['copywriting', 'copy-editing', 'marketing-psychology'], 'bí danh loại cũ');
  t.ok(kyNangNguoi('van').includes('social') && !kyNangNguoi('van').includes('human-voice'), 'hồ sơ: chỉ lấy tên có trong thư viện');
  console.log('ky-nang: tự kiểm đạt'); process.exit(0);
}
if (a[1]?.endsWith('ky-nang.mjs') && (lay('--nguoi') || lay('--loai'))) {
  // --toi-da N: chỉ N kỹ năng đầu (loại bài trước, rồi hồ sơ) — lời giao việc gọn, mỗi lượt Claude rẻ hơn (anh 26/10/2026: "fix cho gọn")
  console.log(chuKyNang([...new Set([...kyNangLoai(lay('--loai')), ...kyNangNguoi(lay('--nguoi') ?? '')])].slice(0, Number(lay('--toi-da')) || 99), Number(lay('--tran')) || 20000));
}

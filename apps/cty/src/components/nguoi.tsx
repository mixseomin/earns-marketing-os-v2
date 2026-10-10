// Tên nhân sự ở BẤT CỨ ĐÂU trên cty.on.tc là thực thể mở được (#1268): ảnh nhỏ + tên, bấm mở hồ sơ trong drawer
// (components/ngan/links.tsx bắt /nhan-su/*, chồng ngăn). Id lạ (giam-doc, he-thong…) hiện chữ thường. Server component — đọc hồ sơ từ cong-ty/.
import Link from 'next/link';
import { dsNhanSu } from '@/lib/cong-ty';
import { avatarDataUri, hueOf } from './avatar';

const TEN_KHAC: Record<string, string> = { 'giam-doc': 'Giám đốc', 'he-thong': 'hệ thống' };

export function Nguoi({ id, anh = true }: { id?: string | null; anh?: boolean }) {
  if (!id) return null;
  const d = dsNhanSu().find((x) => x.id === id);
  if (!d) return <span className="cty-nguoi-chu">{TEN_KHAC[id] ?? id}</span>;
  return (
    <Link href={`/nhan-su/${d.id}`} className="cty-nguoi-link" title={String(d.fm.chuc_danh ?? '')}>
      {anh && <img src={avatarDataUri(d.id, hueOf(String(d.fm.phong ?? '')))} width={18} height={18} alt="" />}
      {String(d.fm.ten)}
    </Link>
  );
}

// Dựng CHỒNG NGĂN từ URL ở máy chủ: `?ngan=a&ngan=b` → tầng 0 = a, tầng 1 = b. MỌI page.tsx gắn <ChongNgan ngan={searchParams.ngan}/>
// (scripts/tu-kiem.mjs chặn page thiếu). Không dùng slot song song: Next giữ nguyên slot khi chỉ đổi tham số URL → ✕ không đóng
// được (đo 11/10/2026 trên bản production); page thì luôn dựng lại.
import { getCurrentUser } from '@/lib/auth';
import { docChong } from '@/lib/ngan';
import { nganTheoKhoa } from './noi-dung';
import { TangNgan } from './tang';

export async function ChongNgan({ ngan }: { ngan: string | string[] | undefined }) {
  const chong = docChong(ngan);
  if (!chong.length) return null;
  const me = await getCurrentUser();
  if (!me) return null;
  const ds = await Promise.all(chong.map((k) => nganTheoKhoa(k, me.role === 'admin')));
  return <>{chong.map((k, i) => <TangNgan key={k} khoa={k} tang={i} tong={chong.length} tieuDe={ds[i]!.tieuDe}>{ds[i]!.than}</TangNgan>)}</>;
}

import { redirect } from 'next/navigation';

// Content Studio ĐÃ GỘP vào /plays (chế độ đọc). Một bài đăng chỉ nên có MỘT chỗ để xem và sửa:
// trước đây studio là surface thứ hai cho cùng dữ liệu — bài tạo bên đó không có ngày nên không
// hiện ở lịch, bản dựng bên đó là khung giả lập khác hẳn thứ sẽ đăng, và mỗi lần thêm tính năng
// (góc, series, flair, video) chỉ có một bên được. Giữ route để link cũ không gãy.
export default async function StudioRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/p/${encodeURIComponent(id)}/plays?view=feed&wt=content`);   // ở lại trong vỏ project
}

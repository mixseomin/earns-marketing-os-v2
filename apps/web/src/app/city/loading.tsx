// /city không dùng khung chờ xám của mos2 (app/loading.tsx): trang dựng từ bản lưu nên gần như tức thì — chờ thì chỉ là nền đêm của thành phố.
export default function Loading() {
  return <div aria-busy="true" aria-label="Đang mở thành phố" style={{ position: 'fixed', inset: 0, background: '#060914' }} />;
}

-- CỐT TRUYỆN ANH BỔ SUNG NGAY TRÊN PHIẾU LÊN CAMP (anh 28/11/2026 #1952 "Cần cơ chế để bổ sung thông tin ngay tại đây để sinh đủ data"):
-- phim mà Ethopex lẫn trang nguồn không cho máy đọc được cốt truyện → sinh chữ K từ chối ("không sinh để khỏi bịa"). Anh dán tóm tắt ở phiếu,
-- apps/etp/sinh-chu-kien.py đọc bảng này TRƯỚC Ethopex / trang nguồn. Bảng riêng (không thêm cột etp.phim) để máy đồng bộ phim không đè.
create table if not exists etp.cot_truyen_tay (
  content_id integer primary key,
  chu        text not null,
  nguoi      text,
  luc        timestamptz not null default now()
);

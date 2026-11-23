-- BẢN DỊCH TIẾNG VIỆT CHO HOOK (anh #1778 23/11/2026: "Các hook đều có thêm phần hiển thị tiếng Việt (dịch) để hiểu nghĩa").
-- Hook = câu mở video máy chấm đọc ra (thị trường ES/EN). etp2 dịch MỘT LẦN mỗi câu khi mở thẻ creative (apps/etp2/src/lib/actions/etp-bai.ts › dichHook,
-- cổng AI chung, dòng Haiku), nhớ ở đây theo nguyên văn — câu trùng giữa nhiều creative không dịch lại, mở lại thẻ không tốn thêm.
create table if not exists etp.dich (
  goc text primary key,          -- nguyên văn câu gốc
  vi text not null,              -- bản dịch tiếng Việt
  model text,                    -- tuyến cổng AI đã chạy
  chi_usd numeric,               -- tiền thật lượt dịch
  luc timestamptz not null default now()
);

-- CHẾ ĐỘ LUẬT MÁY CHO TỪNG NGƯỜI TRONG TEAM (anh 31/10/2026: "cho các tk quyền bật tắt Luật tự động hay chỉ thông báo qua Telegram").
--   bao     = máy luật nhà chấm camp của người đó, đề xuất bậc gửi NHẮN RIÊNG qua bot Telegram (tg_chat) — không đụng camp
--   tu_dong = máy làm luôn trên camp của người đó, đúng như Nhà, bằng PHIÊN ETHOPEX RIÊNG của người đó (sua-ngoai.py ket); anh chốt: chỉ tk của Sơn
--             (người có vai admin trong etp.quyen) — gác ở apps/web/src/lib/etp-quyen.ts quyenCheDo + action datCheDoLuat
-- Không có dòng = 'bao'. tg_ma = mã nối một lần (t.me/<bot>?start=<mã>), bot nhận /start <mã> thì ghi tg_chat rồi xoá mã.
create table if not exists etp.che_do_luat (
  nguoi_id int primary key,
  che_do text not null default 'bao' check (che_do in ('bao', 'tu_dong')),
  tg_chat bigint,
  tg_ma text unique,
  tg_luc timestamptz,          -- lúc nối bot: chỉ báo đề xuất máy thấy LẦN ĐẦU sau mốc này (nối xong không dội cả đống đề xuất cũ)
  sua_boi bigint references users(id) on delete set null,
  luc timestamptz not null default now()
);
-- đã nhắn riêng đề xuất này chưa (apps/cty/worker/etp-rieng.mjs) — mỗi đề xuất (camp × loại × ngân sách) báo một lần
alter table etp.de_xuat_bac add column if not exists bao_luc timestamptz;

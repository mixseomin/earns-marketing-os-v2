-- XEM ĐƯỢC CHI TIẾT MỌI CREATIVE (anh 31/10/2026: "và creative thì phải xem đc chi tiết chứ ?"): thẻ chi tiết creative trên etp (rê / bấm ô creative) cần video;
-- creative đội không ở etp.creative nên không có video → apps/etp/anh-creative.py lưu kèm video đọc từ Ethopex vào đây, etp-doc.ts đọc coalesce.
alter table etp.anh_cr add column if not exists video text;

"""NHẬT KÝ LUẬT — MỘT đường ghi vào studio xv_khoa_ngoai['ethopex_nhat_ky'] (giữ 1000 dòng gần nhất; dong-bo.py chép sang etp.nhat_ky).
Trước đây lam-ethopex / nhan-ban / thay-tu-choi mỗi tệp tự chép một câu update, không chặn lặp: lệnh bị cổng chặn (phim ngoài Âu-Mỹ, chưa đồng bộ…)
được nhịp gọi lại mỗi phút → mỗi lần một dòng giống hệt, 01/11/2026 đo: 1000 dòng chỉ còn 78 việc khác nhau, nhật ký thật bị đẩy khỏi kho.
LUẬT: dòng KHÔNG thành công (ok khác true) trùng (viec, id, sau, loi) với một dòng trong 24 giờ qua thì không ghi lại — lần đầu đã đủ biết; quá 24 giờ
vẫn còn chặn thì ghi một dòng mới. Dòng thành công luôn ghi (mỗi lệnh thật là một việc).
Dùng: sys.path đã có apps/etp → import nhat_ky; nhat_ky.ghi(q, dong)   (q = hàm chạy SQL của tệp gọi)"""
import datetime as dt, json

LUC = "%H:%M %d/%m/%Y"   # giờ VN — dong-bo.py đọc đúng mẫu này
GIU = 1000
LAP_GIO = 24

def luc_vn():
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime(LUC)

def ghi(q, dong):
    dong = {"luc": luc_vn(), **dong}
    v = json.dumps(dong, ensure_ascii=False).replace("'", "''")
    lap = "false" if dong.get("ok") is True else f"""exists (select 1 from jsonb_array_elements(gia_tri) x, (select '{v}'::jsonb m) d
        where x->>'viec' is not distinct from d.m->>'viec' and x->>'id' is not distinct from d.m->>'id'
          and x->>'sau' is not distinct from d.m->>'sau' and x->>'loi' is not distinct from d.m->>'loi'
          and coalesce(x->>'ok', '') <> 'true' and x->>'luc' ~ '^\\d\\d:\\d\\d \\d\\d/\\d\\d/\\d{{4}}$'
          and to_timestamp(x->>'luc', 'HH24:MI DD/MM/YYYY')::timestamp at time zone 'Asia/Ho_Chi_Minh' > now() - interval '{LAP_GIO} hours')"""
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_nhat_ky', '[]'::jsonb) on conflict (ten) do nothing")
    q(f"""update xv_khoa_ngoai set gia_tri = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select x from jsonb_array_elements(gia_tri || jsonb_build_array('{v}'::jsonb)) x
          offset greatest(jsonb_array_length(gia_tri) + 1 - {GIU}, 0)) t) where ten = 'ethopex_nhat_ky' and not {lap}""")

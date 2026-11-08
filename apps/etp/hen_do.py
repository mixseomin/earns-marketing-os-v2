"""HẸN ĐO — tới ngày máy TỰ ĐO rồi báo Telegram (anh 09/11/2026: "Làm sao để đến ngày mày tự check rồi báo cho tao biết kq").
dong-bo.py gọi chay(q) mỗi lượt (10 phút). Mỗi mục HEN: (khoá, ngày ISO giờ VN ≥ 08:00, tiêu đề, hàm đo → chữ báo). Tới hạn mà chưa báo → đo trên số thật lúc đó,
ghi etp.canh_bao 'hen_do' (Telegram) + etp.cau_hinh 'hen_do' {khoá: ngày đã báo} để không báo lại. Lỗi khi đo → báo lỗi (không im lặng), lượt sau KHÔNG thử lại
(tránh spam) — sửa xong thì xoá khoá trong etp.cau_hinh.hen_do để đo lại.
Báo hằng ngày: hôm qua là NGÀY THỊ TRƯỜNG XẤU (cong.ngay_xau) → một tin (L3 / L4 / G10 không tính ngày đó cho camp ≥ $10 + ★ ROAS).
Thêm hẹn mới = thêm một dòng HEN + một hàm đo. Chạy tay: python3 apps/etp/hen_do.py [--do <khoá>]  (in kết quả, không ghi)"""
import json, os, sys, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import cong as CG

def _roi(c, t): return round((t - c) / c * 100) if c else None

def do_ab(q, ma):
    """kết quả một lần A/B (etp.ab + etp.camp_ab): chi · thu · ROI · số camp lãi theo nhánh, từ ngày bắt đầu tới hôm qua"""
    ab = json.loads(q(f"select row_to_json(a)::text from etp.ab a where ma = '{ma}'") or "null")
    if not ab: return f"{ma}: không có trong sổ etp.ab"
    rows = q(f"""select a.nhanh, count(distinct a.camp_id), coalesce(sum(n.chi), 0), coalesce(sum(n.thu), 0),
                   count(distinct a.camp_id) filter (where a.camp_id in (select camp_id from etp.so_ngay where ngay >= '{ab['bat_dau']}' group by camp_id having sum(thu) > sum(chi) and sum(chi) >= 1))
                 from etp.camp_ab a left join etp.so_ngay n on n.camp_id = a.camp_id and n.ngay >= '{ab['bat_dau']}' and n.ngay < (now() at time zone 'utc')::date
                 where a.ab = '{ma}' and a.loai_tru is null group by 1 order by 1""").splitlines()
    ten = {k: (v or {}).get("ten", k) for k, v in (ab.get("nhanh") or {}).items()}
    dong = []
    for l in rows:
        nh, n, c, t, lai = l.split("|"); c, t = float(c), float(t)
        dong.append(f"  · {ten.get(nh, nh)} ({nh}): {n} camp · chi ${c:.0f} · thu ${t:.0f} · ROI {_roi(c, t)}% · {lai} camp lãi")
    if len(dong) < 2: return f"{ma} {ab.get('ten')}: chưa đủ hai nhánh có số ({len(dong)} nhánh) — chưa kết luận được"
    return f"{ma} · {ab.get('ten')} ({ab['bat_dau']} → {ab.get('ket_thuc')})\n  giả thuyết: {ab.get('gia_thuyet', '')[:220]}\n" + "\n".join(dong)

def do_ab03(q):
    s = do_ab(q, "AB03")
    return s + "\n→ Nhánh nhân đôi thắng (ROI không tụt, tổng lãi cặp tăng) thì đủ điều kiện mở luật NHÂN NHIỀU CAMP ROAS MỖI GỐC (kế hoạch scale ngang 09/11, bước 3) — chờ anh chốt."

def do_ab01(q):
    return do_ab(q, "AB01") + "\n(A/B nhắm nước — anh 08/11: chỉ báo kết quả, máy không tự điều chỉnh.)"

def do_ab04(q):
    return do_ab(q, "AB04") + "\n→ Nhánh $30 thắng thì camp ★ ROAS được lên $30; thua thì giữ trần $20 và scale ngang bằng nhân ROAS."

def do_chu_nhat(q):
    """ROI cả đội theo thứ trong tuần, 4 tuần — chủ nhật có thấp nhất mỗi tuần không"""
    ds = [l.split("|") for l in q("""select ngay, extract(isodow from ngay)::int, sum(chi), sum(thu) from (select ngay, chi, thu from etp.so_ngay union all select ngay, chi, thu from etp.so_ngay_ngoai) s
        where ngay >= '2026-10-19' and ngay < (now() at time zone 'utc')::date group by 1, 2 order by 1""").splitlines() if l.count("|") == 3]
    tuan = {}
    for d, w, c, t in ds:
        dd = dt.date.fromisoformat(d); tuan.setdefault(dd - dt.timedelta(days=int(w) - 1), {})[int(w)] = _roi(float(c), float(t))
    thap, du = 0, 0; chu = []
    for k in sorted(tuan):
        v = tuan[k]
        if 7 in v and len(v) == 7:
            du += 1; la = v[7] == min(v.values()); thap += la
            chu.append(f"  · tuần {k:%d/%m}: CN {v[7]}% · thấp nhất tuần {'CÓ' if la else 'không'} (tuần {min(v.values())}…{max(v.values())}%)")
    return f"Hiệu ứng chủ nhật: {thap}/{du} tuần đủ 7 ngày CN thấp nhất tuần\n" + "\n".join(chu) + ("\n→ Đủ điều kiện trình A/B AB05 (camp đến lượt chạy CN dời sang 07:00 thứ 2) — chờ anh chốt." if du and thap == du and du >= 3 else "\n→ Chưa đủ để đổi luật giờ lên camp.")

def do_t8(q):
    """T8 ngưỡng −80% từ 08/11: số camp T8 tắt, chi tới lúc tắt; camp bị T8 tắt về sau có ai đáng lẽ thắng (đội cùng creative lãi) — số tối thiểu đọc được"""
    r = q("""select count(*), coalesce(sum(s.chi), 0) from etp.nhat_ky k left join (select camp_id, sum(chi) chi from etp.so_ngay group by 1) s using (camp_id)
             where k.viec = 'tat' and k.ok and k.luat like 'T8%' and k.luc >= '2026-11-08 12:00'""").split("|")
    tr = q("""select count(*), coalesce(sum(s.chi), 0) from etp.nhat_ky k left join (select camp_id, sum(chi) chi from etp.so_ngay group by 1) s using (camp_id)
              where k.viec = 'tat' and k.ok and k.luat like 'T8%' and k.luc < '2026-11-08 12:00' and k.luc >= '2026-11-01'""").split("|")
    return (f"T8 sau khi đổi ngưỡng −80% (từ 08/11): {r[0]} camp tắt, chi tới lúc tắt ${float(r[1]):.0f}\n  trước đó (01–08/11, ngưỡng −95%): {tr[0]} camp, ${float(tr[1]):.0f}"
            "\n→ Đo kỹ trên tập sạch: python3 apps/etp/phan-tich/t8-mo-rong.py (box3) — con chạy khi anh hỏi.")

def do_po(q):
    """PO.5 (ảnh AI) vs PO.1 (gốc): camp lên từ 09/11, theo bản ghi trong thư viện"""
    rows = q("""select substring(t.ghi from 'PO\\.[0-9]') ban, count(distinct c.camp_id), coalesce(sum(n.chi), 0), coalesce(sum(n.thu), 0)
                from etp.camp c join etp.creative r using (creative_id) join etp.thu_vien t on t.creative_id = r.creative_id left join etp.so_ngay n using (camp_id)
                where r.dang = 'poster động' and c.tao >= '2026-11-08 17:00' group by 1 order by 1""").splitlines()
    dong = [f"  · {b or '?'}: {n} camp · chi ${float(c):.0f} · ROI {_roi(float(c), float(t))}%" for b, n, c, t in (l.split("|") for l in rows if l.count("|") == 3)]
    return "PO.5 (ảnh AI) vs PO.1 (gốc), camp lên từ 09/11:\n" + ("\n".join(dong) or "  chưa có camp PO nào có số")

HEN = [
    ("po_1011", "2026-11-10", "PO.5 vs PO.1 sau 1 ngày", do_po),
    ("t8_1511", "2026-11-15", "T8 ngưỡng −80% sau 7 ngày", do_t8),
    ("cn_1611", "2026-11-16", "Hiệu ứng chủ nhật (4 tuần)", do_chu_nhat),
    ("ab03_2011", "2026-11-20", "Kết quả AB03 nhân đôi ROAS", do_ab03),
    ("ab01_2011", "2026-11-20", "Kết quả AB01 nhắm nước", do_ab01),
    ("ab04_0812", "2026-12-08", "Kết quả AB04 ROAS $30", do_ab04),
]

def chay(q, luc=None):
    luc = luc or dt.datetime.now(dt.timezone.utc); vn = luc + dt.timedelta(hours=7); nay = vn.date().isoformat()
    da = json.loads(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'hen_do'), '{}')") or "{}")
    bao = []
    if vn.hour >= 8:
        for khoa, ngay, tieu_de, ham in HEN:
            if nay < ngay or khoa in da: continue
            try: chu = ham(q)
            except Exception as e: chu = f"LỖI khi đo: {str(e)[:200]} — sửa xong xoá khoá '{khoa}' trong etp.cau_hinh.hen_do để đo lại"
            bao.append((khoa, f"📅 Hẹn đo tới ngày — {tieu_de}\n{chu}")); da[khoa] = nay
        hq = (luc.date() - dt.timedelta(days=1)).isoformat(); k_ = f"xau_{hq}"
        if k_ not in da:
            x = CG.ngay_xau(q).get(hq)
            if x: bao.append((k_, f"⚠ Ngày thị trường xấu {hq}: ROI cả đội {x[0]}% (nền 7 ngày {x[1]}%) — L3 / L4 / G10 không tính ngày này cho camp ≥ ${CG.NGAY_XAU_NS} và ★ ROAS (camp nhỏ vẫn bị T1 / T8 như thường). Máy đã tự áp."))
            da[k_] = nay
    for khoa, chu in bao:
        q(f"""insert into etp.canh_bao (loai, khoa, muc, noi_dung) select 'hen_do', 'hen_do:{khoa}', 'info', $N${chu}$N$ where not exists (select 1 from etp.canh_bao where khoa = 'hen_do:{khoa}')""")
    if bao: q(f"insert into etp.cau_hinh (khoa, gia_tri) values ('hen_do', $J${json.dumps(da)}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()")
    return [k for k, _ in bao]

if __name__ == "__main__":
    a = sys.argv[1:]
    if "--do" in a:
        k = a[a.index("--do") + 1]; ham = next(h for kh, _, _, h in HEN if kh == k); print(ham(CG._q))
    else:
        for kh, ngay, td, h in HEN:
            print(f"── {kh} ({ngay}) {td}"); print(h(CG._q))

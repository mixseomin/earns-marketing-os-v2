#!/usr/bin/env python3
"""LỊCH GIỜ BẬT / TẮT CAMP THEO THỂ LOẠI (anh 25/10/2026: "Chốt kiểu này" — bảng giờ on-off theo khung ở etp.on.tc › Camp › Lịch giờ).
Ngày ngân sách của hai tài khoản reset 07:00 giờ VN (00:00 UTC) → Meta xả tiền ngay giờ đó; 13h–19h cũng lỗ ở mọi thể loại trừ vô danh (số 21–24/10).
Mỗi lượt (dong-bo.py gọi đầu lượt, 10 phút/lần):
  · camp ĐANG CHẠY mà thể loại của nó đang (hoặc trong TRUOC_PHUT phút tới sẽ) ở khung TẮT → tạm dừng (một lệnh bulk), ghi etp.lich_tat
  · camp trong etp.lich_tat mà thể loại đã sang khung BẬT (và không sắp TẮT) → bật lại, xoá khỏi etp.lich_tat
  · CHỈ bật lại camp do chính lịch tạm dừng — camp tắt vì lý do khác (anh, luật, Meta) không bao giờ bị bật. Dừng khẩn (etp.cau_hinh.dung_khan) → không bật gì.
  · công tắc tổng etp.cau_hinh['lich_gio'] = false → bật lại mọi camp đang tạm dừng vì lịch, không tắt thêm.
Ghi một dòng tóm tắt mỗi lượt có việc vào etp.nhat_ky (viec lich_tat / lich_bat).
Chạy tay (box3, đã nạp .env.production):  python3 lich-gio.py [--thu] [--luc HH:MM] | --tu-kiem
  --thu: chỉ in sẽ làm gì · --luc (chỉ đi cùng --thu): mô phỏng giờ VN đó trên camp hiện tại — liệt kê số camp sẽ tạm dừng / bật lại theo thể loại"""
import datetime as dt, json, os, subprocess, sys, urllib.request
TRUOC_PHUT = 15   # tắt sớm tối đa 15 phút trước khung TẮT (lượt chạy 10 phút/lần) — kịp chặn cú xả lúc 07:00
THU = "--thu" in sys.argv
LUC = sys.argv[sys.argv.index("--luc") + 1] if "--luc" in sys.argv else None
if LUC and not THU: raise SystemExit("--luc chỉ dùng cùng --thu (mô phỏng, không gửi lệnh)")
def q(s):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
def dieu_khien(ids, trang_thai):
    """Ethopex control bulk (cùng API nút Tắt / Bật) — trả danh sách id đã gửi thành công"""
    xong = []
    for i in range(0, len(ids), 50):
        lo = ids[i:i + 50]
        r = urllib.request.Request("https://api.ethopex.dev/api/v1/campaigns/control/batch/bulk", data=json.dumps([{"entity_type": "campaign", "entity_ids": lo, "status": trang_thai}]).encode(),
                                   method="POST", headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "etp-lich-gio"})
        try:
            d = json.load(urllib.request.urlopen(r, timeout=60)); d0 = (d.get("data") or [{}])[0] if isinstance(d, dict) else {}
            if d0.get("ok") is False: print(f"Ethopex từ chối {trang_thai} {lo[:5]}…: {d0.get('error')}", file=sys.stderr); continue
            xong += lo
        except Exception as e: print(f"lỗi gọi {trang_thai}: {e}", file=sys.stderr)
    return xong

_KHUNG = {}
def khung(t):
    """khung giờ VN của thời điểm t — MỘT nguồn: hàm SQL etp.khung_vn (sổ etp.khung_gio, migration 0333), cùng hàm trang etp.on.tc dùng"""
    if t.hour not in _KHUNG: _KHUNG[t.hour] = q(f"select etp.khung_vn({t.hour})")
    return _KHUNG[t.hour]

def main():
    vn = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)
    if LUC: vn = vn.replace(hour=int(LUC[:2]), minute=int(LUC[3:5]))
    k_nay, k_toi = khung(vn), khung(vn + dt.timedelta(minutes=TRUOC_PHUT))
    ch = {l.split("|", 1)[0]: json.loads(l.split("|", 1)[1]) for l in q("select khoa, gia_tri::text from etp.cau_hinh where khoa in ('lich_gio', 'dung_khan')").splitlines() if "|" in l}
    bat_lich, dung_khan = ch.get("lich_gio", False) is True, ch.get("dung_khan") is True
    lich = {}
    for l in q("select the_loai, khung, bat from etp.lich_gio").splitlines():
        t, k, b = l.split("|"); lich[(t, k)] = b == "t"
    on = lambda tl, k: lich.get((tl, k), lich.get(("_khac", k), True))   # thể loại lạ → theo '_khac'; không có dòng → bật
    # camp đang chạy + thể loại (kho etp, đồng bộ 10 phút)
    chay = [(int(c), t or "_khac") for c, t in (l.split("|") for l in q("""select c.camp_id, coalesce(p.the_loai, '') from etp.camp c left join etp.phim p using (content_id)
        where c.trang_thai = 'ACTIVE'""").splitlines() if "|" in l)]
    dang_tat = {int(c): t or "_khac" for c, t in (l.split("|") for l in q("""select l.camp_id, coalesce(p.the_loai, l.the_loai, '') from etp.lich_tat l
        left join etp.camp c using (camp_id) left join etp.phim p on p.content_id = c.content_id""").splitlines() if "|" in l)}
    # camp trong lich_tat đã bị lưu trữ / mất khỏi kho → bỏ khỏi sổ (không bật)
    q("delete from etp.lich_tat l where not exists (select 1 from etp.camp c where c.camp_id = l.camp_id and c.trang_thai <> 'ARCHIVED')")
    # camp trong sổ mà đang chạy lại (vd máy thay creative bị Meta từ chối xong bật lại) → tạm dừng lại luôn, không để chạy suốt khung TẮT
    can_tat = [c for c, t in chay if bat_lich and (not on(t, k_nay) or not on(t, k_toi))]
    can_bat = [c for c, t in dang_tat.items() if (not bat_lich or (on(t, k_nay) and on(t, k_toi))) and not dung_khan]
    print(f"giờ VN {vn:%H:%M} · khung {k_nay}{' → ' + k_toi if k_toi != k_nay else ''} · lịch {'BẬT' if bat_lich else 'TẮT'} · sẽ tạm dừng {len(can_tat)} · sẽ bật lại {len(can_bat)} · đang tạm dừng {len(dang_tat)}")
    if THU:
        from collections import Counter
        if can_tat: print("  sẽ tạm dừng theo thể loại:", dict(Counter(dict(chay)[c] for c in can_tat)))
        bo_qua = Counter(t for c, t in chay if c not in can_tat)
        print("  vẫn chạy theo thể loại:", dict(bo_qua))
        return
    tl_cua = dict(chay)
    if can_tat:
        ok = dieu_khien(can_tat, "paused")
        if ok:
            j = json.dumps([{"camp_id": c, "the_loai": tl_cua.get(c), "khung": k_toi if on(tl_cua.get(c, "_khac"), k_nay) else k_nay} for c in ok])
            q(f"insert into etp.lich_tat (camp_id, the_loai, khung) select camp_id, the_loai, khung from jsonb_to_recordset($J${j}$J$::jsonb) as x(camp_id int, the_loai text, khung text) on conflict do nothing")
            ghi("lich_tat", ok, f"lịch giờ: khung {k_toi if k_toi != k_nay else k_nay} TẮT cho thể loại " + ", ".join(sorted({tl_cua.get(c, '_khac') for c in ok})))
    if can_bat:
        ok = dieu_khien(can_bat, "active")
        if ok:
            q(f"delete from etp.lich_tat where camp_id in ({','.join(map(str, ok))})")
            ghi("lich_bat", ok, f"lịch giờ: khung {k_nay} BẬT" + ("" if bat_lich else " (công tắc lịch giờ tắt — bật lại hết)"))

def ghi(viec, ids, luat):
    j = json.dumps([{"viec": viec, "sau": str(len(ids)), "luat": (luat + " · camp " + ", ".join(f"#{c}" for c in ids[:40]) + (" …" if len(ids) > 40 else ""))[:1000]}], ensure_ascii=False)
    q(f"insert into etp.nhat_ky (luc, viec, camp_id, sau, ok, luat, ai) select now(), viec, null, sau, true, luat, 'máy lịch giờ (anh chốt 25/10/2026)' from jsonb_to_recordset($J${j}$J$::jsonb) as x(viec text, sau text, luat text) on conflict do nothing")

def tu_kiem():
    """--tu-kiem: mọi giờ 0–23 ra đúng khung (đối chiếu mốc anh chốt), và mốc tắt sớm 15 phút đúng chỗ — đỏ thì exit 1"""
    mong = {**{h: "k20" for h in list(range(20, 24)) + list(range(0, 7))}, 7: "k07", **{h: "k08" for h in range(8, 13)}, **{h: "k13" for h in range(13, 20)}}
    sai = [(h, khung(dt.datetime(2026, 1, 1, h)), k) for h, k in mong.items() if khung(dt.datetime(2026, 1, 1, h)) != k]
    t = lambda h, m: khung(dt.datetime(2026, 1, 1, h, m) + dt.timedelta(minutes=TRUOC_PHUT))
    sai += [(f"{h}:{m:02d}+15", t(h, m), k) for h, m, k in ((6, 44, "k20"), (6, 46, "k07"), (12, 44, "k08"), (12, 46, "k13"), (19, 46, "k20"))  if t(h, m) != k]
    print("lich-gio tự kiểm:", "ĐẠT 29/29" if not sai else f"SAI {sai}"); sys.exit(1 if sai else 0)

if __name__ == "__main__":
    tu_kiem() if "--tu-kiem" in sys.argv else main()

#!/usr/bin/env python3
"""AD BỊ META TỪ CHỐI → TỰ THAY CREATIVE NGAY TRONG CAMP (anh 23/10/2026: "có ad bị meta từ chối thì vào xem nguyên nhân fix rồi tự replace creative ngay").
Đúng cách Support Ethopex chỉ (Dol 21/10/2026): KHÔNG xoá camp — Edit camp, thay creative sạch cùng phim, Update để Meta duyệt lại. API = nút Update của app
(đọc mã app.ethopex.dev 23/10/2026): POST /api/v1/campaigns/update {"ads": [{"ad_id": <id ad Ethopex>, "creative_id": <mới>}]}.
Mỗi ad bị từ chối (delivery_status DISAPPROVED / error có DISAPPROVED):
  1. lý do = error của ad (Meta) → ghi sổ studio xv_khoa_ngoai['ethopex_tu_choi'] {creative: {camp, ly_do, luc}} — creative này không bao giờ được chọn lại
  2. creative thay = creative CÙNG PHIM đã đạt CTA (ethopex_cta_dat), chưa từng bị từ chối, khác đoạn, ưu tiên mới nhất
  3. không có → xếp hàng dựng góc mới (ethopex_cho_dung_lai, tu_choi=true: sua-cta.py trên iMac cắt góc KHÁC đoạn bị từ chối, rồi chạy lại lệnh này)
  4. Update → đọc lại camp: creative đã đổi = xong; ghi nhật ký luật (ethopex_nhat_ky); in một dòng JSON mỗi camp
Chạy trên box3: thay-tu-choi.py [--camp <id> …]   (không --camp = quét mọi camp đang chạy). Phòng Ethopex (cty ethopex.mjs) gọi khi luật báo tu_choi."""
import datetime as dt, json, os, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
vn = lambda: (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m/%Y")

def api(duong, body=None):
    r = urllib.request.Request("https://api.ethopex.dev" + duong, data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                               headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-ethopex"})
    return json.load(urllib.request.urlopen(r, timeout=60))
khoa = lambda ten: json.loads(q(f"select coalesce(gia_tri, '{{}}'::jsonb)::text from xv_khoa_ngoai where ten='{ten}'") or "{}")
def gop(ten, moi):
    v = json.dumps(moi, ensure_ascii=False).replace("'", "''")
    q(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('{ten}', '{v}'::jsonb) on conflict (ten) do update set gia_tri = coalesce(xv_khoa_ngoai.gia_tri, '{{}}'::jsonb) || excluded.gia_tri")

def bi_tu_choi(a): return a.get("delivery_status") == "DISAPPROVED" or "DISAPPROVED" in str(a.get("error") or "").upper()

def ung_vien(cid, cu, tu_choi, dat):
    """creative cùng phim (content), đạt CTA, chưa bị từ chối, khác creative cũ — mới nhất trước (studio xv_phim kinh_thanh.ethopex)"""
    r = q(f"select (kinh_thanh->'ethopex'->>'creative_id'), coalesce(kinh_thanh->'ethopex'->>'tu',''), coalesce(kinh_thanh->'ethopex'->>'den','') from xv_phim "
          f"where project='ethopex' and (kinh_thanh->'ethopex'->>'content_id')::int = {int(cid)} order by 1 desc")
    ds = [l.split("|") for l in r.splitlines() if l]
    doan_cu = next(((t, d) for c, t, d in ds if c == str(cu)), None)
    return [int(c) for c, t, d in ds if c.isdigit() and c != str(cu) and c in dat and c not in tu_choi and (t, d) != doan_cu]

def mot(camp, tu_choi, dat):
    kq = {"camp": camp, "ok": False}
    d = api(f"/api/v1/campaigns/{camp}"); a = d["ad_groups"][0]["ads"][0]
    if not bi_tu_choi(a): return {**kq, "ok": True, "viec": "khong_tu_choi"}
    cu, cid, ly = a.get("creative_id"), a.get("content_id"), str(a.get("error") or a.get("delivery_status"))[:300]
    kq.update(creative_cu=cu, content=cid, ly_do=ly)
    gop("ethopex_tu_choi", {str(cu): {"camp": camp, "ly_do": ly, "luc": vn()}}); tu_choi[str(cu)] = 1
    ds = ung_vien(cid, cu, tu_choi, dat)
    if not ds:
        gop("ethopex_cho_dung_lai", {str(cu): {"goc": camp, "luc": vn(), "ten": d["campaign"]["name"].split(": ", 1)[-1], "content_id": cid, "tu_choi": True, "ly_do": ly}})
        return {**kq, "viec": "cho_dung", "loi": "chưa có creative sạch khác cùng phim — đã xếp hàng dựng góc mới (sua-cta.py, iMac)"}
    moi = ds[0]
    api("/api/v1/campaigns/update", {"ads": [{"ad_id": a["id"], "creative_id": moi}]})
    sau = api(f"/api/v1/campaigns/{camp}")["ad_groups"][0]["ads"][0].get("creative_id")
    kq.update(creative_moi=moi, viec="thay", ok=(sau == moi), loi=None if sau == moi else f"đã gửi Update nhưng đọc lại vẫn creative #{sau}")
    dong = {"luc": vn(), "viec": "thay_creative", "id": camp, "truoc": cu, "sau": sau, "ok": kq["ok"], "loi": kq["loi"],
            "luat": f"Meta từ chối ad (lý do: {ly[:150]}) → thay creative sạch cùng phim #{moi}", "ai": "máy (anh 23/10/2026: bị từ chối thì tự thay creative ngay)"}
    v = json.dumps(dong, ensure_ascii=False).replace("'", "''")
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_nhat_ky', '[]'::jsonb) on conflict (ten) do nothing")
    q(f"update xv_khoa_ngoai set gia_tri = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select x from jsonb_array_elements(gia_tri || jsonb_build_array('{v}'::jsonb)) x offset greatest(jsonb_array_length(gia_tri) + 1 - 1000, 0)) t) where ten = 'ethopex_nhat_ky'")
    if kq["ok"]: q(f"update xv_khoa_ngoai set gia_tri = gia_tri - '{cu}' where ten='ethopex_cho_dung_lai'")
    return kq

if __name__ == "__main__":
    a = sys.argv[1:]
    camps = [int(x) for x in a[a.index("--camp") + 1:] if x.isdigit()] if "--camp" in a else [c["id"] for c in api("/api/v1/campaigns?page_size=500")["data"] if c.get("state") == "ACTIVE"]
    tu_choi, dat = khoa("ethopex_tu_choi"), khoa("ethopex_cta_dat")
    def an_toan(c):
        try: return mot(c, tu_choi, dat)
        except Exception as e: return {"camp": c, "ok": False, "loi": f"{type(e).__name__}: {str(e)[:150]}"}
    with ThreadPoolExecutor(8) as ex:
        for k in ex.map(an_toan, camps):
            if k.get("viec") != "khong_tu_choi": print(json.dumps(k, ensure_ascii=False), flush=True)

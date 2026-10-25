#!/usr/bin/env python3
"""AD BỊ META TỪ CHỐI → TỰ THAY CREATIVE NGAY TRONG CAMP (anh 23/10/2026: "có ad bị meta từ chối thì vào xem nguyên nhân fix rồi tự replace creative ngay").
Đúng cách Support Ethopex chỉ (Dol 21/10/2026): KHÔNG xoá camp — Edit camp, thay creative sạch cùng phim, Update để Meta duyệt lại. API = nút Update của app
(đọc mã app.ethopex.dev 23/10/2026): POST /api/v1/campaigns/update {"ads": [{"ad_id": <id ad Ethopex>, "creative_id": <mới>}]}.
Mỗi ad bị từ chối (delivery_status DISAPPROVED / error có DISAPPROVED):
  1. lý do = error của ad (Meta) → ghi sổ studio xv_khoa_ngoai['ethopex_tu_choi'] {creative: {camp, ly_do, luc}} — creative này không bao giờ được chọn lại
  2. creative thay = creative CÙNG PHIM đã đạt CTA (ethopex_cta_dat), chưa từng bị từ chối, khác đoạn, ưu tiên mới nhất
  3. không có → xếp hàng dựng góc mới (ethopex_cho_dung_lai, tu_choi=true: sua-cta.py trên iMac cắt góc KHÁC đoạn bị từ chối, rồi chạy lại lệnh này)
  4. Update → đọc lại camp: creative đã đổi = xong; ghi nhật ký luật (ethopex_nhat_ky); in một dòng JSON mỗi camp
  5. camp bị Ethopex dừng vì từ chối → bật lại ngay sau khi thay (anh 24/10/2026 "bật sau khi thay đi"), qua lam-ethopex.py bat + rào chắn etp
Chạy trên box3: thay-tu-choi.py [--camp <id> …]   (không --camp = quét mọi camp đang chạy).
  thay-tu-choi.py --don-doan [--thu]   → dọn đoạn quá tải (> 3 camp): camp dư không lãi thay sang góc khác cùng phim (--thu: chỉ in, không làm) Phòng Ethopex (cty ethopex.mjs) gọi khi luật báo tu_choi."""
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

DEM = {}
def so_camp_doan():
    """khoá đoạn (content:tu-den) → số camp chưa lưu trữ đang mang creative đoạn đó (kho etp) — chọn đoạn ít camp nhất (trần 3 / đoạn)"""
    if not DEM: DEM.update({k: int(n) for k, n in (l.split("|") for l in q("select c.doan, count(*) from etp.camp k join etp.creative c on c.creative_id = k.creative_id where coalesce(k.trang_thai, '') <> 'ARCHIVED' group by 1").splitlines() if "|" in l)})
    return DEM   # một lượt chạy đếm tiếp tại chỗ (kho đồng bộ 10 phút mới thấy camp vừa thay)

def ung_vien(cid, cu, tu_choi, dat):
    """creative cùng phim (content), đạt CTA, chưa bị từ chối, khác creative cũ — mới nhất trước (studio xv_phim kinh_thanh.ethopex)"""
    r = q(f"select (kinh_thanh->'ethopex'->>'creative_id'), coalesce(kinh_thanh->'ethopex'->>'tu',''), coalesce(kinh_thanh->'ethopex'->>'den','') from xv_phim "
          f"where project='ethopex' and (kinh_thanh->'ethopex'->>'content_id')::int = {int(cid)} order by 1 desc")
    ds = [l.split("|") for l in r.splitlines() if l]
    doan_cu = next(((t, d) for c, t, d in ds if c == str(cu)), None)
    ra = [int(c) for c, t, d in ds if c.isdigit() and c != str(cu) and c in dat and c not in tu_choi and (t, d) != doan_cu]
    dem, doan = so_camp_doan(), dict(l.split("|") for l in q(f"select creative_id, doan from etp.creative where content_id = {int(cid)}").splitlines() if "|" in l)
    return sorted(ra, key=lambda c: (dem.get(doan.get(str(c)), 0), -c))   # đoạn ít camp trước, rồi mới nhất

def mot(camp, tu_choi, dat):
    kq = {"camp": camp, "ok": False}
    d = api(f"/api/v1/campaigns/{camp}"); a = d["ad_groups"][0]["ads"][0]
    cu, cid = a.get("creative_id"), a.get("content_id")
    lan = str(cu) in tu_choi and not bi_tu_choi(a)   # creative đã bị từ chối ở camp khác → thay luôn ở camp này trước khi Meta từ chối tiếp
    if lan and (tu_choi.get(str(cu)) or {}).get("soat") and q(f"select tao < now() - interval '48 hours' from etp.camp where camp_id = {int(camp)}") != "f":
        lan = False   # đoạn soát cấm chỉ thay ở camp mới < 48 giờ — camp cũ Meta đã duyệt, có thể đang lãi (camp đang lãi cấm sửa)
    if not bi_tu_choi(a) and not lan: return {**kq, "ok": True, "viec": "khong_tu_choi"}
    if not lan and khoa("ethopex_thay_cho_duyet").get(str(camp)) == cu: return {**kq, "ok": True, "viec": "cho_meta_duyet"}   # vừa thay, Meta chưa duyệt lại
    ly = str(a.get("error") or a.get("delivery_status"))[:300] if not lan else (f"creative #{cu} thuộc đoạn soát cấm ({str(tu_choi[str(cu)].get('ly_do', ''))[:120]})" if (tu_choi.get(str(cu)) or {}).get("soat") else f"creative #{cu} đã bị Meta từ chối ở camp khác ({str((tu_choi.get(str(cu)) or {}).get('ly_do', ''))[:120]})")
    kq.update(creative_cu=cu, content=cid, ly_do=ly)
    if not lan: gop("ethopex_tu_choi", {str(cu): {"camp": camp, "ly_do": ly, "luc": vn()}}); tu_choi[str(cu)] = {"ly_do": ly}
    ds = ung_vien(cid, cu, tu_choi, dat)
    if not ds:
        gop("ethopex_cho_dung_lai", {str(cu): {"goc": camp, "luc": vn(), "ten": d["campaign"]["name"].split(": ", 1)[-1], "content_id": cid, "tu_choi": True, "ly_do": ly}})
        return {**kq, "viec": "cho_dung", "loi": "chưa có creative sạch khác cùng phim — đã xếp hàng dựng góc mới (sua-cta.py, iMac)"}
    moi = ds[0]
    api("/api/v1/campaigns/update", {"ads": [{"ad_id": a["id"], "creative_id": moi}]})
    sau = api(f"/api/v1/campaigns/{camp}")["ad_groups"][0]["ads"][0].get("creative_id")
    if sau == moi:
        dm = dict(l.split("|") for l in q(f"select creative_id, doan from etp.creative where creative_id in ({int(moi)}, {int(cu)})").splitlines() if "|" in l)
        if dm.get(str(moi)): DEM[dm[str(moi)]] = DEM.get(dm[str(moi)], 0) + 1
        if dm.get(str(cu)): DEM[dm[str(cu)]] = max(DEM.get(dm[str(cu)], 1) - 1, 0)
    kq.update(creative_moi=moi, viec="thay", ok=(sau == moi), loi=None if sau == moi else f"đã gửi Update nhưng đọc lại vẫn creative #{sau}")
    dong = {"luc": vn(), "viec": "thay_creative", "id": camp, "truoc": cu, "sau": sau, "ok": kq["ok"], "loi": kq["loi"],
            "luat": f"Meta từ chối ad (lý do: {ly[:150]}) → thay creative sạch cùng phim #{moi}", "ai": "máy (anh 23/10/2026: bị từ chối thì tự thay creative ngay)"}
    v = json.dumps(dong, ensure_ascii=False).replace("'", "''")
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_nhat_ky', '[]'::jsonb) on conflict (ten) do nothing")
    q(f"update xv_khoa_ngoai set gia_tri = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select x from jsonb_array_elements(gia_tri || jsonb_build_array('{v}'::jsonb)) x offset greatest(jsonb_array_length(gia_tri) + 1 - 1000, 0)) t) where ten = 'ethopex_nhat_ky'")
    if kq["ok"]:
        q(f"update xv_khoa_ngoai set gia_tri = gia_tri - '{cu}' where ten='ethopex_cho_dung_lai'")
        gop("ethopex_thay_cho_duyet", {str(camp): moi})
        if not lan and d["campaign"].get("state") == "PAUSED": kq["bat"] = bat_lai(camp)
    return kq

def bat_lai(camp):
    """BẬT LẠI SAU KHI THAY (anh 24/10/2026: "bật sau khi thay đi"): camp bị Ethopex dừng vì Meta từ chối, đã thay creative sạch → bật lại qua lam-ethopex
    (rào chắn etp cong.py: dừng khẩn / trần ngày / trần bộ vẫn chặn). Chỉ camp dừng VÌ từ chối — camp anh / luật tắt không đi qua đây."""
    r = subprocess.run(["python3", os.path.join(os.path.dirname(os.path.abspath(__file__)), "lam-ethopex.py"), "bat", str(camp),
                        "--luat", "Meta từ chối ad → đã thay creative sạch cùng phim → bật lại", "--ai", "anh (chat 24/10/2026: bật sau khi thay)"], capture_output=True, text=True, timeout=180)
    try: j = json.loads((r.stdout.strip().splitlines() or ["{}"])[-1])
    except Exception: j = {"ok": False, "loi": (r.stderr or r.stdout)[-150:]}
    if j.get("loi") == "camp đã ACTIVE": return {"ok": True, "loi": None, "ghi": "Ethopex tự bật lại sau Update"}   # 24/10/2026 #68876: Update xong Ethopex tự chuyển ACTIVE
    return {"ok": bool(j.get("ok")), "loi": j.get("loi")}

def cung_creative(camps, tu_choi):
    """mọi camp chưa lưu trữ khác đang mang creative đã bị từ chối (kho etp) — thay luôn, không đợi Meta từ chối từng camp"""
    bad = [k for k in tu_choi if k.isdigit()]
    if not bad: return []
    r = q(f"select camp_id from etp.camp where creative_id in ({','.join(bad)}) and coalesce(trang_thai, '') <> 'ARCHIVED'")
    return [int(x) for x in r.split() if int(x) not in camps]

GIU_DOAN, ROI_DU = 3, 30
def don_doan(that=True):
    """DỌN ĐOẠN QUÁ TẢI (A, anh duyệt 25/10/2026: camp tự giành cùng tệp người xem làm ROI cả phim tụt). Đoạn có > GIU_DOAN camp đang chạy:
    giữ GIU_DOAN camp tốt nhất (ROI 3 ngày trọn), camp DƯ mà không lãi (ROI 3 ngày < ROI_DU% và hôm nay < ROI_DU%, đã chạy ≥ 2 ngày) → thay creative sang
    GÓC KHÁC cùng phim (đoạn còn < 3 camp). KHÔNG tắt camp, KHÔNG đụng camp dư đang lãi. Hết góc → xếp hàng cắt góc mới (ethopex_can_goc_moi, sua-cta.py).
    Camp vừa đổi creative trong 24 giờ bỏ qua (chờ số)."""
    import datetime as _d
    nay = _d.datetime.now(_d.timezone.utc).date(); d1, d3 = (nay - _d.timedelta(days=1)).isoformat(), (nay - _d.timedelta(days=3)).isoformat()
    r = q(f"""with c as (select k.camp_id, k.content_id, k.creative_id, cr.doan, k.tao from etp.camp k join etp.creative cr using (creative_id) where k.trang_thai = 'ACTIVE' and cr.doan is not null),
                 o as (select doan from c group by 1 having count(*) > {GIU_DOAN}),
                 s3 as (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay where ngay between '{d3}' and '{d1}' group by 1),
                 sn as (select camp_id, chi, thu from etp.so_ngay where ngay = '{nay}')
             select c.doan, c.camp_id, c.content_id, c.creative_id, coalesce(s3.chi, 0), coalesce(s3.thu, 0), coalesce(sn.chi, 0), coalesce(sn.thu, 0), (current_date - (c.tao at time zone 'UTC')::date)
             from c join o using (doan) left join s3 using (camp_id) left join sn using (camp_id) order by c.doan""")
    theo = {}
    for l in r.splitlines():
        x = l.split("|")
        if len(x) == 9: theo.setdefault(x[0], []).append({"camp": int(x[1]), "content": int(x[2]), "cr": int(x[3]), "c3": float(x[4]), "t3": float(x[5]), "cn": float(x[6]), "tn": float(x[7]), "tuoi": int(x[8] or 0)})
    pct = lambda c, t: (t - c) / c * 100 if c > 0 else None
    tu_choi, dat, vua = khoa("ethopex_tu_choi"), khoa("ethopex_cta_dat"), khoa("ethopex_thay_cho_duyet"); kq = []
    nk = {str(x.get("id")): x.get("luc", "") for x in (json.loads(q("select coalesce(gia_tri, '[]'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_nhat_ky'") or "[]")) if x.get("viec") == "thay_creative"}
    for doan, ds in theo.items():
        ds.sort(key=lambda x: (-(pct(x["c3"], x["t3"]) if pct(x["c3"], x["t3"]) is not None else -1e9), -x["c3"]))
        for x in ds[GIU_DOAN:]:
            r3, rn = pct(x["c3"], x["t3"]), pct(x["cn"], x["tn"]) if x["cn"] >= 0.3 else None
            if x["tuoi"] < 2 or r3 is None or r3 >= ROI_DU or (rn is not None and rn >= ROI_DU): continue   # camp dư đang lãi / chưa đủ số → giữ
            if nk.get(str(x["camp"]), "")[-10:] == (_d.datetime.now(_d.timezone.utc) + _d.timedelta(hours=7)).strftime("%d/%m/%Y") or str(x["camp"]) in vua: continue
            ds_ = [c for c in ung_vien(x["content"], x["cr"], tu_choi, dat)]
            dm = dict(l.split("|") for l in q(f"select creative_id, doan from etp.creative where content_id = {x['content']}").splitlines() if "|" in l)
            dem = so_camp_doan(); moi = next((c for c in ds_ if dem.get(dm.get(str(c)), 0) < GIU_DOAN), None)
            dong = {"camp": x["camp"], "doan": doan, "roi3": round(r3), "roi_nay": None if rn is None else round(rn), "creative_cu": x["cr"]}
            if not moi:
                goc = ds[0]["camp"]; tenp = q(f"select coalesce(ten, '') from etp.phim where content_id = {x['content']}")
                v = json.dumps({"goc": goc, "ten": tenp, "luc": vn(), "ly_do": "dọn đoạn quá tải"}, ensure_ascii=False).replace("'", "''")
                if that: q(f"update xv_khoa_ngoai set gia_tri = gia_tri || jsonb_build_object('{x['content']}', '{v}'::jsonb) where ten='ethopex_can_goc_moi' and not gia_tri ? '{x['content']}'")
                kq.append({**dong, "viec": "cho_goc_moi", "ok": True}); continue
            if not that: kq.append({**dong, "viec": "se_thay", "creative_moi": moi, "ok": True}); continue
            try:
                d = api(f"/api/v1/campaigns/{x['camp']}"); ad = d["ad_groups"][0]["ads"][0]
                api("/api/v1/campaigns/update", {"ads": [{"ad_id": ad["id"], "creative_id": moi}]})
                sau = api(f"/api/v1/campaigns/{x['camp']}")["ad_groups"][0]["ads"][0].get("creative_id"); ok = sau == moi
            except Exception as e: ok, sau = False, None; dong["loi"] = f"{type(e).__name__}: {str(e)[:120]}"
            if ok:
                if dm.get(str(moi)): DEM[dm[str(moi)]] = DEM.get(dm[str(moi)], 0) + 1
                if dm.get(str(x["cr"])): DEM[dm[str(x["cr"])]] = max(DEM.get(dm[str(x["cr"])], 1) - 1, 0)
                gop("ethopex_thay_cho_duyet", {str(x["camp"]): moi})
            dn = {"luc": vn(), "viec": "thay_creative", "id": x["camp"], "truoc": x["cr"], "sau": sau, "ok": ok, "loi": dong.get("loi"),
                  "luat": f"dọn đoạn quá tải: đoạn {doan} có {len(ds)} camp (giữ {GIU_DOAN} tốt nhất) · camp dư ROI 3 ngày {r3:+.0f}% < {ROI_DU}% → góc khác #{moi}",
                  "ai": "máy (anh duyệt 25/10/2026: dọn đoạn quá tải, không tắt, không đụng camp lãi)"}
            v = json.dumps(dn, ensure_ascii=False).replace("'", "''")
            q(f"update xv_khoa_ngoai set gia_tri = (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select x from jsonb_array_elements(gia_tri || jsonb_build_array('{v}'::jsonb)) x offset greatest(jsonb_array_length(gia_tri) + 1 - 1000, 0)) t) where ten = 'ethopex_nhat_ky'")
            kq.append({**dong, "viec": "thay", "creative_moi": moi, "ok": ok})
    for k in kq: print(json.dumps(k, ensure_ascii=False), flush=True)
    return kq

if __name__ == "__main__":
    a = sys.argv[1:]
    if "--don-doan" in a: don_doan(that="--thu" not in a); sys.exit(0)
    camps = [int(x) for x in a[a.index("--camp") + 1:] if x.isdigit()] if "--camp" in a else [c["id"] for c in api("/api/v1/campaigns?page_size=500")["data"] if c.get("state") == "ACTIVE"]
    tu_choi, dat = khoa("ethopex_tu_choi"), khoa("ethopex_cta_dat")
    # đoạn soát CẤM (máy / người, ethopex_soat_doan ok=false) mà creative đã lên camp → thay trước khi Meta từ chối (anh 25/10/2026, ca 165796 1078s);
    # chỉ thêm vào bộ nhớ lượt này (không ghi sổ từ chối của Meta) — ung_vien cũng không chọn lại creative đoạn cấm
    sd = khoa("ethopex_soat_doan"); cam = {k for k, v in sd.items() if v.get("ok") is False}
    for l in q("select creative_id, doan from etp.creative where doan is not null").splitlines():
        c, _, dn = l.partition("|")
        if dn in cam and c not in tu_choi: tu_choi[c] = {"ly_do": f"đoạn soát cấm: {str(sd[dn].get('ghi', ''))[:120]}", "soat": True}
    def an_toan(c):
        try: return mot(c, tu_choi, dat)
        except Exception as e: return {"camp": c, "ok": False, "loi": f"{type(e).__name__}: {str(e)[:150]}"}
    for lo in (camps, None):   # lượt 2: camp khác cùng creative vừa bị từ chối
        ds = camps if lo is not None else cung_creative(set(camps), {**tu_choi, **khoa("ethopex_tu_choi")})
        for k in map(an_toan, ds):   # tuần tự: hai camp cùng phim không giành cùng một creative thay, số camp / đoạn đọc đúng
            if k.get("viec") not in ("khong_tu_choi", "cho_meta_duyet"): print(json.dumps(k, ensure_ascii=False), flush=True)

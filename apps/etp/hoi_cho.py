#!/usr/bin/env python3
"""ĐỢT LÊN HỒI CHỢ (anh chốt 18/11/2026 theo hướng dẫn Dol Ethopex khi chợ kém — sổ luật chung etp-bang-luat.json hoi_cho).
Phanh chợ nhả (hết den_len của lần phanh gần nhất — etp.canh_bao 'phanh_cho:phanh:<ngày>', không còn nấc báo sớm / rút, giá chợ 6 giờ ≥ phanh_cho.nguong)
→ so_ngay ngày Ethopex kế tiếp, mỗi nhịp worker (gọi qua nuoi_bo.py) máy làm tối đa moi_nhip camp mỗi loại:
  1. ★ ROAS TỪ CREATIVE MỚI — creative chấm Sạch, cập nhật trong cr_ngay ngày, chưa có camp, chưa bị Meta từ chối, của phim đã lãi TRƯỚC đợt sụt
     (truoc_ngay ngày trước moc_sut, camp nhà chi ≥ phim.chi, ROI ≥ phim.roi%) → nhan-ban.py <khuôn cùng tiếng> --roas <roas> --ns <ns> --creative … --bo <bộ phim>,
     trần tran_ngay camp / ngày VN, mỗi phim một camp / đợt.
  2. NHÂN BẢN BÀI CŨ — camp từng lãi tốt TRƯỚC đợt sụt (cùng cửa sổ: chi ≥ goc.chi, ROI ≥ goc.roi% — nấc NB $10 / +50%; KHÔNG dùng số gần đây đang âm)
     → nhan-ban.py <gốc> --hoi-cho --nac ($10 như NB bài cũ — anh 22/11/2026, gốc đã tắt vẫn được), trần tran_bai_cu / ngày VN.
Giờ chạy theo nhan-ban.lich_len. Mọi cổng etp vẫn áp (cong.kiem: dừng khẩn, bảo trì, Âu-Mỹ, phim cất, trần camp test / phim cho bản nhân, trần camp mới / ngày).
Mỗi creative / gốc chỉ thử MỘT lần mỗi đợt (etp.cau_hinh.hoi_cho_da) — bị cổng chặn thì không gọi lại mỗi nhịp. Camp lên được → etp.canh_bao 'hoi_cho:<camp>' (tin Telegram).
  python3 apps/etp/hoi_cho.py --xem      → trạng thái đợt + ứng viên nhịp này (không tạo gì)
  python3 apps/etp/hoi_cho.py --du-tru   → kho dự trữ creative Sạch cho đợt (máy chấm vẫn chấm phim thiếu trong lúc phanh — sổ luật san_xuat_theo_cho)
  python3 apps/etp/hoi_cho.py --tu-kiem  → bài tự kiểm hàm thuần"""
import ast, datetime as dt, json, os, re, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
import cong as CG
HC, PC = CG._BL["hoi_cho"], CG._BL["phanh_cho"]
NB = os.path.join(D, "..", "xuong-video", "scripts", "ethopex", "nhan-ban.py")
KHUON = ast.literal_eval(re.search(r"^KHUON = (\{[^}]*\})", open(os.path.join(D, "dong_phim.py")).read(), re.M).group(1))   # một nguồn: camp khuôn cùng tiếng của dòng phim
LUAT_ROAS, LUAT_BAI = "hồi chợ ★ ROAS creative mới", "hồi chợ bài cũ"
AI = "máy: đợt lên hồi chợ (anh chốt 18/11/2026 theo hướng dẫn Dol)"
q = CG._q

def dot(tt, phanh_ngay, bay):
    """hàm thuần: trạng thái etp.cau_hinh.phanh_cho + ngày phanh gần nhất (ISO, UTC) + giờ UTC → (đang đợt?, lý do). Đợt = [den_len, den_len + so_ngay ngày)."""
    if not phanh_ngay: return False, "chưa có lần phanh chợ nào"
    d = dt.date.fromisoformat(phanh_ngay); dau = dt.datetime(d.year, d.month, d.day, tzinfo=dt.timezone.utc) + dt.timedelta(days=2); het = dau + dt.timedelta(days=int(HC["so_ngay"]))
    if bay < dau: return False, f"phanh {d:%d/%m} còn tới {dau + dt.timedelta(hours=7):%H:%M %d/%m} giờ VN"
    if bay >= het: return False, f"đợt hồi chợ sau phanh {d:%d/%m} đã hết ({het + dt.timedelta(hours=7):%H:%M %d/%m} giờ VN)"
    ly = CG.phanh_cho(tt, "tao_camp", bay)
    if ly: return False, ly
    if (((tt or {}).get("rut") or {}).get("den") or "") > bay.isoformat(): return False, "đang RÚT khỏi chợ (phanh_cho.rut)"
    g = (tt or {}).get("gia6_nay")
    if g is None or float(g) < float(PC["nguong"]): return False, f"giá chợ 6 giờ {'chưa đo được' if g is None else f'{float(g) * 100:.0f}%'} — chưa về ≥ {PC['nguong'] * 100:.0f}% nền"
    return True, f"đợt hồi chợ sau phanh {d:%d/%m}: giá chợ {float(g) * 100:.0f}% nền, tới {het + dt.timedelta(hours=7):%H:%M %d/%m} giờ VN"

def da_lam(luat):
    """số camp đợt này đã lên hôm nay (ngày VN) theo nhật ký GỐC (nhan-ban ghi ngay lúc tạo)"""
    return int(q(f"""select count(*) from xv_khoa_ngoai, jsonb_array_elements(gia_tri) x where ten = 'ethopex_nhat_ky' and (x->>'ok')::boolean and x->>'luat' like '{luat}%'
                     and split_part(x->>'luc', ' ', 2) = to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')""") or 0)

CUA = f"""mo as (select '{HC['moc_sut']}'::date m),
    s as (select n.camp_id, sum(n.chi) chi, sum(n.thu) thu from etp.so_ngay n, mo where n.ngay >= m - {int(HC['truoc_ngay'])} and n.ngay < m group by 1)"""

# phim đã lãi TRƯỚC đợt sụt — một câu cho ung_vien_roas và kho dự trữ (du_tru)
PHIM_HC = f"""p as (select c.content_id, (sum(s.thu) - sum(s.chi)) / sum(s.chi) * 100 r from s join etp.camp c using (camp_id) where c.content_id is not null group by 1
              having sum(s.chi) >= {float(HC['phim']['chi'])} and (sum(s.thu) - sum(s.chi)) / sum(s.chi) * 100 >= {float(HC['phim']['roi'])})"""
# creative ★ ROAS hồi chợ dùng được: chấm Sạch, cập nhật trong cr_ngay ngày, chưa bị Meta từ chối, chưa có camp
CR_HC = f"""r.cap_nhat > now() - interval '{int(HC['cr_ngay'])} days' and r.tu_choi is null and not exists (select 1 from etp.camp k where k.creative_id = r.creative_id)"""
DU_TRU = int(HC["tran_ngay"]) * int(HC["so_ngay"])   # anh 18/11/2026: đợt dùng tối đa 5 camp ROAS / ngày × 3 ngày, mỗi phim một camp / đợt → giữ sẵn ~15 phim có creative Sạch

def du_tru(qq=None):
    """KHO DỰ TRỮ HỒI CHỢ khi phanh (sổ luật san_xuat_theo_cho, anh 18/11/2026): trong lúc phanh máy ngừng chấm / sản xuất, TRỪ creative cho phim lãi trước sụt
    còn thiếu. Trả {"co": số phim đã có ≥ 1 creative Sạch dùng được, "can": min(DU_TRU, số phim), "thieu": [phim chưa có]} — đủ thì thieu = [] (thôi chấm)."""
    qq = qq or q
    r = qq(f"""with {CUA}, {PHIM_HC},
        co as (select distinct r.content_id from etp.creative r join p using (content_id) join etp.cham_cong g on g.creative_id = r.creative_id and g.duoc_len where {CR_HC})
        select (select count(*) from p) || '|' || (select count(*) from co) || '|' || coalesce((select string_agg(content_id::text, ',' order by r desc) from p where content_id not in (select content_id from co)), '')""")
    tong, co, thieu = (r.split("|") + ["0", "0", ""])[:3]
    can = min(DU_TRU, int(tong or 0)); co = int(co or 0)
    return {"co": co, "can": can, "thieu": [] if co >= can else [int(x) for x in thieu.split(",") if x.strip().isdigit()]}

def ung_vien_roas(thu, chan):
    ds = [l.split("|", 4) for l in q(f"""with {CUA},
        {PHIM_HC}
        select r.creative_id, r.content_id, coalesce(r.lang, 'en'), round(p.r), coalesce((select v.ten from etp.thu_vien_phim v where v.content_id = r.content_id), '')
        from etp.creative r join p using (content_id) join etp.cham_cong g on g.creative_id = r.creative_id and g.duoc_len
        where {CR_HC}
        order by p.r desc, r.creative_id desc limit 60""").splitlines() if l.count("|") >= 4]
    return [{"cr": int(c), "phim": int(p), "lang": lg, "r": r, "ten": t} for c, p, lg, r, t in ds
            if f"cr:{c}" not in thu and f"phim:{p}" not in thu and int(p) not in chan and lg[:2] in KHUON]

def ung_vien_bai(thu, chan):
    ds = [l.split("|") for l in q(f"""with {CUA}
        select c.camp_id, c.content_id, round((s.thu - s.chi) / s.chi * 100), round(s.chi, 2) from s join etp.camp c using (camp_id)
        where not coalesce(c.la_roas, false) and c.content_id is not null and s.chi >= {float(HC['goc']['chi'])} and (s.thu - s.chi) / s.chi * 100 >= {float(HC['goc']['roi'])}
        order by s.thu - s.chi desc limit 60""").splitlines() if l.count("|") == 3]
    return [{"goc": int(g), "phim": int(p), "r": r, "chi": c} for g, p, r, c in ds if f"goc:{g}" not in thu and int(p) not in chan]

def nb(args, luat):
    try:
        r = subprocess.run(["python3", NB, *args, "--that", "--luat", luat, "--ai", AI], capture_output=True, text=True, timeout=1500, cwd=os.path.dirname(NB))
        return json.loads(next((l for l in reversed(r.stdout.strip().splitlines()) if l.startswith("{")), "{}"))
    except Exception as e: return {"ok": False, "loi": str(e)[:200]}

def chay(xem=False):
    if CG.LUAT_CU_DUNG: return {"dot": False, "ly": CG.LY_LUAT_CU}   # đợt hồi chợ 18/11 là luật trước 20/11 (anh 22/11/2026)
    tt = json.loads(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'phanh_cho'), '{}')") or "{}")
    pn = q("select max(split_part(khoa, ':', 3)) from etp.canh_bao where khoa like 'phanh_cho:phanh:%'") or None
    co, ly = dot(tt, pn, dt.datetime.now(dt.timezone.utc))
    if not co: return {"dot": False, "ly": ly}
    st = json.loads(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'hoi_cho_da'), '{}')") or "{}")
    if st.get("dot") != pn: st = {"dot": pn, "thu": []}
    thu, chan = set(st["thu"]), CG.phim_chan_len()
    kq = {"dot": True, "ly": ly, "roas": [], "bai_cu": []}
    con_r, con_b = int(HC["tran_ngay"]) - da_lam(LUAT_ROAS), int(HC["tran_bai_cu"]) - da_lam(LUAT_BAI)
    uv_r, uv_b = (ung_vien_roas(thu, chan) if con_r > 0 else []), (ung_vien_bai(thu, chan) if con_b > 0 else [])
    if xem: return {**kq, "con": {"roas": con_r, "bai_cu": con_b}, "ung_vien": {"roas": uv_r[:10], "bai_cu": uv_b[:10]}}
    lay_r, lay_b = uv_r[:min(con_r, int(HC["moi_nhip"]))], uv_b[:min(con_b, int(HC["moi_nhip"]))]
    # GHI "ĐÃ THỬ" TRƯỚC KHI GỌI (worker có trần giờ cho cả nuoi_bo.py): lượt bị cắt giữa chừng không gọi lại đúng creative / gốc đó ở nhịp sau → không lên trùng
    thu |= {k for v in lay_r for k in (f"cr:{v['cr']}", f"phim:{v['phim']}")} | {f"goc:{v['goc']}" for v in lay_b}
    st["thu"] = sorted(thu)
    q(f"""insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('hoi_cho_da', $J${json.dumps(st)}$J$::jsonb, 'creative / gốc / phim đợt hồi chợ đã thử (apps/etp/hoi_cho.py) — mỗi thứ một lần / đợt', 'hoi_cho.py')
          on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()""")
    for v in lay_r:
        ten = re.sub(r"[^ -~]|['\"$`\\]", "", f"hc {v['ten']} {v['lang'][:2].upper()} - cr moi #{v['cr']}")[:120]
        bo = q(CG.SQL_BO_PHIM.format(cid=v["phim"])) or "1"
        r = nb([str(KHUON[v["lang"][:2]]), "--roas", f"{float(HC['roas']):g}", "--ns", f"{int(HC['ns'])}", "--creative", str(v["cr"]), "--content", str(v["phim"]), "--ten", ten, "--bo", str(bo)],
               f"{LUAT_ROAS} · phim #{v['phim']} trước {HC['moc_sut'][8:]}/{HC['moc_sut'][5:7]} ROI {v['r']}% · creative #{v['cr']}")
        kq["roas"].append({**v, "ok": r.get("ok"), "moi": r.get("moi"), "loi": r.get("loi")})
    for v in lay_b:
        r = nb([str(v["goc"]), "--hoi-cho", "--nac"], f"{LUAT_BAI} · gốc #{v['goc']} trước {HC['moc_sut'][8:]}/{HC['moc_sut'][5:7]} ROI {v['r']}% chi ${v['chi']}")
        kq["bai_cu"].append({**v, "ok": r.get("ok"), "moi": r.get("moi"), "loi": r.get("loi")})
    for x in kq["roas"] + kq["bai_cu"]:
        if x.get("ok") and x.get("moi"):
            chu = (f"🌤 HỒI CHỢ — ★ ROAS {float(HC['roas']):g} · ${int(HC['ns'])} từ creative mới #{x['cr']} phim #{x['phim']} (trước sụt ROI {x['r']}%) → camp #{x['moi']}" if "cr" in x
                   else f"🌤 HỒI CHỢ — nhân bản bài cũ của camp #{x['goc']} (trước sụt ROI {x['r']}%, chi ${x['chi']}) → camp #{x['moi']}")
            q(f"""insert into etp.canh_bao (loai, khoa, muc, noi_dung) values ('hoi_cho', 'hoi_cho:{int(x['moi'])}', 'info', $N${chu}$N$) on conflict (khoa) do nothing""")
    return kq

def _tu_kiem():
    u = lambda s: dt.datetime.fromisoformat(s + "+00:00")
    tt = {"gia6_nay": 0.9}
    assert not dot(tt, "2026-11-17", u("2026-11-18T23:00:00"))[0], "chưa hết den_len (00:00 UTC ngày phanh + 2) thì chưa đợt"
    assert dot(tt, "2026-11-17", u("2026-11-19T00:10:00"))[0] and dot(tt, "2026-11-17", u("2026-11-21T23:50:00"))[0] and not dot(tt, "2026-11-17", u("2026-11-22T00:00:01"))[0], "đợt dài so_ngay ngày"
    assert not dot({"gia6_nay": 0.8}, "2026-11-17", u("2026-11-19T01:00:00"))[0] and not dot({}, "2026-11-17", u("2026-11-19T01:00:00"))[0], "giá chưa về ≥ ngưỡng / chưa đo được → chưa lên"
    assert not dot({"gia6_nay": 0.9, "gia6": {"ti": 0.7, "den": "2026-11-19T03:00:00+00:00"}}, "2026-11-17", u("2026-11-19T01:00:00"))[0], "còn nấc báo sớm → chưa lên"
    assert not dot({"gia6_nay": 0.9, "rut": {"den": "2026-11-20T00:00:00+00:00"}}, "2026-11-17", u("2026-11-19T01:00:00"))[0] and not dot(tt, None, u("2026-11-19T01:00:00"))[0]
    assert HC["roas"] == 1 and HC["ns_khoang"] == [5, 5] and HC["ns_khoang"][0] <= HC["ns"] <= HC["ns_khoang"][1] and HC["tran_ngay"] == 5, "đợt hồi chợ lệch sổ luật (anh 18/11/2026: ROAS 1, 5 camp / ngày; $5 như mọi camp mới — anh 25/11/2026)"
    assert KHUON.get("en") and KHUON.get("es")
    assert DU_TRU == 15, "kho dự trữ hồi chợ = 5 camp ROAS / ngày × 3 ngày (anh 18/11/2026)"
    gia = lambda tong, co, thieu: (lambda s: du_tru(lambda _: s))(f"{tong}|{co}|{thieu}")
    assert gia(36, 34, "1,2")["thieu"] == [] and gia(36, 3, "7,8")["thieu"] == [7, 8] and gia(4, 4, "")["thieu"] == [] and gia(4, 2, "5,6") == {"co": 2, "can": 4, "thieu": [5, 6]}, "đủ phim có creative Sạch thì thôi chấm"
    print("✓ hoi_cho.py tự kiểm (cửa sổ đợt sau phanh, giá về ≥ ngưỡng, nấc báo sớm / rút, sổ luật)")

if __name__ == "__main__":
    if "--tu-kiem" in sys.argv: _tu_kiem(); sys.exit(0)
    if "--du-tru" in sys.argv: print(json.dumps(du_tru(), ensure_ascii=False)); sys.exit(0)
    print(json.dumps(chay("--xem" in sys.argv), ensure_ascii=False, default=str))

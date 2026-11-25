#!/usr/bin/env python3
"""HÀNG LỆNH CHỜ PHANH NHẢ (anh 20/11/2026, chat: "Làm : 1, 2, 5" + "các camp roas trước dương lớn có thể mở lại 2 camp để dò đường, nếu ko thì sau đó cũng tắt").
Lệnh anh đã ra trong lúc PHANH CHỢ đang bật: cổng (apps/etp/cong.py) chặn đúng luật, lệnh chat không được miễn phanh → máy GIỮ lệnh ở đây và thực hiện
ở nhịp đầu tiên cổng không còn chặn vì phanh. Không timer / tiến trình riêng: nuoi_bo.py (nhịp worker ethopex.mjs) gọi chay() mỗi nhịp.

Khoá etp.cau_hinh.lenh_cho_phanh = {"lenh": [...], "do_duong": [...]}
  lenh     {id, viec: nhan_roas | tang, camp, roas?, ns, ai, luc, han, giu, tt: cho | dang | xong | bo | huy, ly, moi, xet}
           - thực hiện QUA CỔNG như mọi lệnh khác (nhan-ban.py --roas … --lenh-cho / lam-ethopex.py tang) — trần camp, trần ngày, trần test, phim cấm vẫn áp
           - điều kiện giữ lúc thực hiện: nhan_roas = camp gốc còn ACTIVE + ROI 3 ngày đã khép ≥ 0; tang = camp còn ACTIVE + ROI 3 ngày VÀ 7 ngày đã khép > 0
           - quá hạn (72 giờ từ lúc lệnh) mà phanh chưa nhả → huỷ + báo
           - ghi 'dang' TRƯỚC khi gọi script → mỗi lệnh chạy đúng một lần (lượt bị cắt giữa chừng không gọi lại)
  do_duong {camp, nhan, d0, tt: theo | giu | tat | het | loi, ly}
           - hết 2 ngày đã khép kể từ d0 (ngày UTC lúc bật): ROI cộng 2 ngày âm → máy tắt; ≥ 0 → giữ, bỏ nhãn
Thực hiện / bỏ / huỷ / tắt nhịp nào → MỘT tin gộp qua etp.canh_bao (chủ đề Ethopex).
  python3 apps/etp/lenh_cho.py --nap       → nạp 8 lệnh + 2 camp dò đường của 20/11/2026 (chạy lại không nhân đôi)
  python3 apps/etp/lenh_cho.py --xem       → in việc nhịp này sẽ làm, không gọi gì
  python3 apps/etp/lenh_cho.py --tu-kiem   → bài tự kiểm hàm thuần"""
# tra-repo-ok: mã dán keo nội bộ — nối sổ etp.cau_hinh với cổng cong.py và hai script nhan-ban / lam-ethopex của nhà, không có thư viện ngoài nào làm việc này
import datetime as dt, json, os, re, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
import cong as CG
q = CG._q
KHOA = "lenh_cho_phanh"
SC = os.path.join(D, "..", "xuong-video", "scripts", "ethopex")
NB, LE = os.path.join(SC, "nhan-ban.py"), os.path.join(SC, "lam-ethopex.py")
HAN_GIO, MOI_NHIP = 72, 4
AI = "anh (chat 20/11/2026: Làm 1, 2, 5 — lệnh chờ phanh nhả) — máy chạy"
AI_DO = "anh (chat 20/11/2026: mở lại 2 camp dò đường, nếu ko thì sau đó cũng tắt) — máy chạy"
CHO_LAI = re.compile(r"PHANH|BẢO TRÌ|DỪNG KHẨN|RÚT KHỎI", re.I)   # lỗi do cổng phanh / bảo trì → lệnh về hàng chờ, không bỏ (con chọn)

def _u(s): return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))

def xet(l, chan, the, bay):
    """hàm thuần: lệnh + câu chặn phanh (None = nhả) + {tt, ns, r3, r7} của camp + giờ → (cho | lam | bo | huy, lý do)"""
    if bay > _u(l["han"]): return "huy", f"quá {HAN_GIO} giờ phanh chưa nhả — huỷ lệnh"
    if chan: return "cho", chan
    if (the or {}).get("tt") != "ACTIVE": return "bo", f"camp #{l['camp']} không còn ACTIVE ({(the or {}).get('tt') or 'không thấy'})"
    r3, r7 = the.get("r3"), the.get("r7")
    if l["viec"] == "nhan_roas":
        if r3 is None or r3 < 0: return "bo", f"ROI 3 ngày đã khép của gốc #{l['camp']} {'chưa có' if r3 is None else f'{r3:g}%'} < 0"
    elif l["viec"] == "tang":
        if r3 is None or r3 <= 0 or r7 is None or r7 <= 0: return "bo", f"ROI 3 ngày {r3 if r3 is not None else '?'}% · 7 ngày {r7 if r7 is not None else '?'}% — không còn cùng dương"
        if float(the.get("ns") or 0) >= float(l["ns"]): return "bo", f"camp đã ở ${float(the['ns']):g} ≥ ${float(l['ns']):g}"
    else: return "bo", f"việc lạ '{l['viec']}'"
    return "lam", None

def xet_do(d, the, hom_nay, thu, chi):
    """hàm thuần: camp dò đường → (theo | giu | tat | het, lý do). thu / chi = cộng hai ngày [d0, d0+1]"""
    if (the or {}).get("tt") != "ACTIVE": return "het", f"camp đã {(the or {}).get('tt') or 'mất'} — bỏ nhãn"
    d0 = dt.date.fromisoformat(d["d0"])
    if hom_nay <= d0 + dt.timedelta(days=1): return "theo", f"chờ khép ngày {d0 + dt.timedelta(days=1):%d/%m}"
    r = round((thu - chi) / chi * 100) if chi else 0
    return ("tat" if r < 0 else "giu"), f"ROI 2 ngày đã khép {d0:%d/%m}–{d0 + dt.timedelta(days=1):%d/%m}: {r}% (chi ${chi:g}, thu ${thu:g})"

def doc():
    return json.loads(q(f"select coalesce((select gia_tri::text from etp.cau_hinh where khoa = '{KHOA}'), '{{}}')") or "{}")

def ghi(st):
    q(f"""insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('{KHOA}', $J${json.dumps(st, ensure_ascii=False)}$J$::jsonb,
          'hàng lệnh chờ phanh nhả + camp dò đường (apps/etp/lenh_cho.py) — anh 20/11/2026', 'lenh_cho.py')
          on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()""")

def the(cid):
    """trạng thái + ngân sách + ROI 3 / 7 ngày đã khép (ngày UTC) của camp nhà"""
    l = q(f"""with d as (select (now() at time zone 'utc')::date d0)
        select c.trang_thai, c.ngan_sach,
          round((sum(n.thu) filter (where n.ngay >= d0 - 3) - sum(n.chi) filter (where n.ngay >= d0 - 3)) / nullif(sum(n.chi) filter (where n.ngay >= d0 - 3), 0) * 100, 1),
          round((sum(n.thu) - sum(n.chi)) / nullif(sum(n.chi), 0) * 100, 1)
        from etp.camp c cross join d left join etp.so_ngay n on n.camp_id = c.camp_id and n.ngay between d0 - 7 and d0 - 1
        where c.camp_id = {int(cid)} group by c.trang_thai, c.ngan_sach""")
    if not l: return None
    tt, ns, r3, r7 = (l.split("|") + ["", "", "", ""])[:4]
    f = lambda s: float(s) if s not in ("", None) else None
    return {"tt": tt, "ns": f(ns), "r3": f(r3), "r7": f(r7)}

def chay_script(args):
    try:
        r = subprocess.run(["python3", *args], capture_output=True, text=True, timeout=1500, cwd=SC, env={**os.environ, "ETP_NGUON": "lenh_cho"})   # lệnh anh từ 20/11 — qua cổng luật cũ (cong.luat_cu_chan)
        return json.loads(next((x for x in reversed(r.stdout.strip().splitlines()) if x.startswith("{")), "{}") or "{}")
    except Exception as e: return {"ok": False, "loi": str(e)[:200]}

def mo_ta(l):
    return (f"nhân ★ ROAS {float(l['roas']):g} · ${l['ns']} từ camp #{l['camp']}" if l["viec"] == "nhan_roas" else f"tăng camp #{l['camp']} lên ${l['ns']}")

def hop_le(goc, roas, ns):
    """nhan-ban.py --lenh-cho: chỉ cho ngân sách ★ ROAS bài cũ ngoài $15–20 khi hàng đang chạy ĐÚNG lệnh này (tt 'dang')"""
    return any(l["viec"] == "nhan_roas" and int(l["camp"]) == int(goc) and abs(float(l["roas"]) - float(roas)) < 1e-9 and int(l["ns"]) == int(ns) and l.get("tt") == "dang"
               for l in doc().get("lenh") or [])

# CREATIVE ANH ĐÃ DUYỆT CHỜ PHANH NHẢ (anh 22/11/2026 "thằng ngu !" — bấm ✓ Duyệt ở etp2 › Camp lúc DỪNG KHẨN ra ô đỏ bắt bấm lại "Lên camp"):
# Duyệt = lệnh của anh, xếp hàng ngay. Nhịp đầu tiên phanh_sx nhả → lên camp ★ ROAS (mặc định hoi_cho, anh 24/11/2026) bằng ĐÚNG đường nút (nhan-ban khuôn theo ngôn ngữ, bộ bo_phim_moi,
# giờ chạy do nhan-ban.lich_len); lỗi do phanh → về hàng; lỗi khác → ghi lý do vào nhật ký /tmp/etp-len-cr-<cr>.log (etp2 hiện ô đỏ + nút Lên camp).
HOI_CHO = json.load(open(os.path.join(D, "..", "web", "src", "lib", "etp-bang-luat.json")))["hoi_cho"]   # cùng sổ nhan-ban đọc: roas · ns mặc định creative mới
KHUON_CR = {"en": 65110, "es": 65734}   # trùng KHUON của apps/etp2/src/lib/actions/etp-dong.ts
SQL_CR_DUYET = """select h.creative_id, r.content_id, coalesce(r.lang, 'en'), regexp_replace(coalesce(f.ten, r.content_id::text), '[^A-Za-z0-9 .,:!?#-]', '', 'g')
    from etp.cho_anh_duyet_cr h join etp.creative r on r.creative_id = h.creative_id join etp.cham_duyet u on u.creative_id = h.creative_id and u.ok
      left join etp.phim f on f.content_id = r.content_id join etp.cham_cong g on g.creative_id = h.creative_id and g.duoc_len
    where r.content_id is not null and not exists (select 1 from etp.camp c where c.creative_id = h.creative_id)
      and not coalesce((select x.gia_tri ? h.creative_id::text from etp.cau_hinh x where x.khoa = 'hoan_cr'), false) order by u.luc limit 20"""   # ⏸ anh tạm dừng ở etp2 (khoá hoan_cr, anh 25/11/2026) → máy không lên
# ★ ROAS TỪ CREATIVE ANH DUYỆT (anh 22/11/2026 "lên thêm các camp kiểu đó tương tự … roas kiểu Sơn đang lên"): khoá etp.cau_hinh.len_cr_roas = {"<cr>": {roas, ns, luc, ai}}
# — creative có trong sổ này lên ★ ROAS (nhan-ban --roas … --creative, ns trong hoi_cho.ns_khoang $5–10) THAY cho camp $1: luật "một creative một camp" (nhan-ban roas_main)
KHOA_ROAS = "len_cr_roas"
TAY_LY = "chờ anh duyệt tay ở etp2 › Camp (▶ Lên)"
def doc_roas():
    try: return json.loads(q(f"select gia_tri from etp.cau_hinh where khoa = '{KHOA_ROAS}'") or "{}")
    except ValueError: return {}

def lenh_cr(cr, ct, lang, ten, bo, ro):
    """dòng lệnh nhan-ban cho một creative đã duyệt — ro = mục len_cr_roas (★ ROAS) hoặc None (★ ROAS mặc định hoi_cho — anh 24/11/2026 "Từ giờ mặc định là roas", hết camp $1)"""
    if not ro: ro = {"roas": HOI_CHO["roas"], "ns": HOI_CHO["ns"], "ai": "anh (24/11/2026: mặc định lên creative mới = ★ ROAS) — máy lên khi phanh nhả"}
    if ro: return [NB, str(KHUON_CR[lang]), "--roas", f"{float(ro['roas']):g}", "--ns", str(int(ro["ns"])), "--tay", "--bo", bo, "--creative", cr, "--content", ct,
                   "--ten", f"duyet {ten} {lang.upper()} - cr moi #{cr}", "--that", "--luat", f"anh duyệt creative #{cr} + lệnh ★ ROAS {float(ro['roas']):g} · ${int(ro['ns'])} kiểu Sơn (chat 22/11/2026) — lên khi phanh nhả",
                   "--ai", ro.get("ai") or "anh (chat 22/11/2026: roas kiểu Sơn đang lên) — máy lên khi phanh nhả"]
    return [NB, str(KHUON_CR[lang]), "--tay", "--bo", bo, "--creative", cr, "--content", ct, "--ten", f"duyet {ten} {lang.upper()} - creative #{cr}", "--that",
            "--luat", f"anh duyệt creative #{cr} (etp2 › Camp · Chờ anh duyệt) — lên khi phanh nhả", "--ai", "anh (etp2 › Chờ anh duyệt) — máy lên khi phanh nhả"]

def nap_roas(crs, roas, ns):
    """ghi sổ len_cr_roas cho creative ĐÃ DUYỆT chưa có camp; ns ngoài hoi_cho.ns_khoang → từ chối (nhan-ban cũng chặn)"""
    lo_, hi_ = json.load(open(os.path.join(D, "..", "web", "src", "lib", "etp-bang-luat.json")))["hoi_cho"]["ns_khoang"]   # cùng sổ nhan-ban đọc
    if not lo_ <= ns <= hi_: raise SystemExit(f"ngân sách ★ ROAS creative mới ${lo_:g}–{hi_:g} (sổ luật hoi_cho)")
    duyet = {l.split("|")[0] for l in (q(SQL_CR_DUYET) or "").splitlines() if l.strip()}
    sai = [c for c in crs if c not in duyet]
    if sai: raise SystemExit(f"không phải creative đã duyệt chưa có camp: {', '.join(sai)}")
    m = doc_roas(); luc = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    for c in crs: m[c] = {"roas": roas, "ns": ns, "luc": luc, "ai": "anh (chat 22/11/2026: roas kiểu Sơn đang lên) — máy lên khi phanh nhả"}
    q(f"""insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('{KHOA_ROAS}', $J${json.dumps(m)}$J$::jsonb, 'creative anh duyệt lên ★ ROAS thay camp $1 (apps/etp/lenh_cho.py)', 'lenh_cho.py')
          on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()""")
    return m

def len_cr(st, chan, luc, xem, bao):
    """creative đã duyệt chưa có camp: phanh còn → giữ hàng (st['len_cr'][cr].tt='cho'); nhả → gọi nhan-ban một lần mỗi creative"""
    hang = st.setdefault("len_cr", {}); doi, kq = False, []
    ds = [l.split("|") for l in (q(SQL_CR_DUYET) or "").splitlines() if l.strip()]
    bo = q("select gia_tri#>>'{}' from etp.cau_hinh where khoa = 'bo_phim_moi'") or ""
    ro_ = doc_roas()
    for cr, ct, lang, ten in ds:
        h = hang.setdefault(cr, {"tt": "cho", "luc": luc}); kq.append({"cr": int(cr), "tt": h["tt"], "ly": chan, "kieu": f"★ ROAS {float(ro_[cr]['roas']):g} · ${int(ro_[cr]['ns'])}" if cr in ro_ else f"★ ROAS {float(HOI_CHO['roas']):g} · ${int(HOI_CHO['ns'])}"})
        if h["tt"] == "dang" and h.get("xet", "") < (dt.datetime.fromisoformat(luc) - dt.timedelta(hours=1)).isoformat(): h["tt"] = "cho"   # lượt bị cắt giữa chừng, 1 giờ chưa thấy camp → về hàng
        if h["tt"] == "dang" or (h["tt"] == "loi" and h.get("xet", "") > (dt.datetime.fromisoformat(luc) - dt.timedelta(hours=6)).isoformat()): continue   # lỗi thật: thử lại sau 6 giờ
        if cr in ro_:   # ★ ROAS từ len_cr_roas: CHỜ ANH DUYỆT TAY ở etp2 (▶ Lên) — máy không tự lên (anh 22/11/2026 "show … ở trạng thái Chờ duyệt rồi tao sẽ duyệt = tay")
            if h.get("ly") != TAY_LY: h.update(tt="cho", ly=TAY_LY); doi = True
            continue
        if chan or xem or not bo:
            if chan and h.get("ly") != chan: h["ly"] = chan; doi = True
            continue
        lang = "es" if lang == "es" else "en"
        h.update(tt="dang", xet=luc); ghi(st)   # GHI TRƯỚC khi gọi — mỗi lần nhả một lần gọi
        ro = ro_.get(cr); r = chay_script(lenh_cr(cr, ct, lang, ten, bo, ro))
        try:
            with open(f"/tmp/etp-len-cr-{cr}.log", "a") as f: f.write(f"{luc} lên camp sau khi phanh nhả: {json.dumps(r, ensure_ascii=False, default=str)[:600]}\n")
        except OSError: pass
        if r.get("ok"): h.update(tt="xong", ly=None, moi=r.get("moi")); bao.append(f"✅ lên camp ★ ROAS creative anh duyệt #{cr}" + (f" → camp #{r['moi']}" if r.get("moi") else ""))
        elif CHO_LAI.search(str(r.get("loi") or "")): h.update(tt="cho", ly=str(r.get("loi"))[:200])
        else: h.update(tt="loi", ly=str(r.get("loi") or "script không trả kết quả")[:200]); bao.append(f"⚠ creative anh duyệt #{cr} chưa lên camp: {h['ly']}")
        doi = True
    con = {cr for cr, *_ in ds}
    for cr in [k for k in hang if k not in con]: hang.pop(cr); doi = True   # đã có camp / bị bỏ duyệt → rời hàng
    return doi, kq

def chay(xem=False):
    st = doc()
    bay = dt.datetime.now(dt.timezone.utc); luc = bay.isoformat(timespec="seconds")
    chan = CG.phanh_sx(CG.doc_cau_hinh(), bay)
    bao0 = []; doi0, kcr = len_cr(st, chan, luc, xem, bao0)
    if not (st.get("lenh") or st.get("do_duong")):
        if doi0 and not xem: ghi(st)
        if bao0 and not xem: q(f"""insert into etp.canh_bao (loai, khoa, muc, noi_dung) values ('lenh_cho', 'lenh_cho:{bay:%Y%m%d%H%M%S}', 'info', $N$🧭 CREATIVE ANH ĐÃ DUYỆT\n""" + "\n".join(f"• {x}" for x in bao0) + """$N$) on conflict (khoa) do nothing""")
        return {"lenh": 0, "len_cr": kcr, "chan": chan}
    kq, bao, doi, lam = {"chan": chan, "lenh": [], "do_duong": [], "len_cr": kcr}, bao0, doi0, 0
    for l in st.get("lenh") or []:
        if l.get("tt") != "cho": continue
        th = None if chan else the(l["camp"])
        v, ly = xet(l, chan, th, bay)
        kq["lenh"].append({"id": l["id"], "xet": v, "ly": ly})
        if v == "cho":
            if l.get("ly") != ly: l["ly"] = ly; doi = True
            continue
        if xem: continue
        if v in ("huy", "bo"):
            l.update(tt=v, ly=ly, xet=luc); doi = True
            bao.append(f"{'⌛ huỷ' if v == 'huy' else '✋ bỏ'} lệnh {mo_ta(l)}: {ly}"); continue
        if lam >= MOI_NHIP: continue
        lam += 1
        l.update(tt="dang", xet=luc); ghi(st)   # GHI TRƯỚC khi gọi — mỗi lệnh đúng một lần
        nhan = f"lệnh chờ phanh 20/11 · anh lệnh {l['luc'][:16]}Z · ROI 3 ngày {th.get('r3')}% · 7 ngày {th.get('r7')}%"
        if l["viec"] == "nhan_roas":
            r = chay_script([NB, str(l["camp"]), "--roas", f"{float(l['roas']):g}", "--ns", str(int(l["ns"])), "--lenh-cho", "--that", "--luat", nhan, "--ai", l.get("ai") or AI])
        else:
            r = chay_script([LE, "tang", str(l["camp"]), str(int(l["ns"])), "--luat", nhan, "--ai", l.get("ai") or AI])
        if r.get("ok"):
            l.update(tt="xong", ly=None, moi=r.get("moi")); bao.append(f"✅ {mo_ta(l)}" + (f" → camp #{r['moi']}" if r.get("moi") else ""))
        elif CHO_LAI.search(str(r.get("loi") or "")):
            l.update(tt="cho", ly=str(r.get("loi"))[:200])
        else:
            l.update(tt="bo", ly=str(r.get("loi") or "script không trả kết quả")[:200]); bao.append(f"✋ bỏ lệnh {mo_ta(l)}: {l['ly']}")
        kq["lenh"][-1].update(ok=r.get("ok"), moi=r.get("moi"), loi=r.get("loi")); doi = True
    hom = bay.date()
    for d in st.get("do_duong") or []:
        if d.get("tt") != "theo": continue
        th = the(d["camp"]); d0 = dt.date.fromisoformat(d["d0"])
        tc = q(f"select coalesce(sum(thu), 0), coalesce(sum(chi), 0) from etp.so_ngay where camp_id = {int(d['camp'])} and ngay between '{d0}' and '{d0 + dt.timedelta(days=1)}'") or "0|0"
        thu, chi = (float(x or 0) for x in (tc.split("|") + ["0"])[:2])
        v, ly = xet_do(d, th, hom, thu, chi)
        kq["do_duong"].append({"camp": d["camp"], "xet": v, "ly": ly})
        if v == "theo" or xem: continue
        if v == "tat":
            r = chay_script([LE, "tat", str(d["camp"]), "--luat", f"{d['nhan']}: {ly}", "--ai", AI_DO])
            if r.get("ok"): d.update(tt="tat", ly=ly); bao.append(f"⛔ tắt camp dò đường #{d['camp']} — {ly}")
            else: d.update(tt="loi", ly=f"{ly} · tắt không được: {str(r.get('loi'))[:150]}"); bao.append(f"⚠ camp dò đường #{d['camp']} ROI âm nhưng tắt không được: {str(r.get('loi'))[:150]}")
        else:
            d.update(tt=v, ly=ly); bao.append(f"🟢 giữ camp dò đường #{d['camp']}, bỏ nhãn — {ly}" if v == "giu" else f"camp dò đường #{d['camp']}: {ly}")
        doi = True
    if doi and not xem: ghi(st)
    if bao and not xem:
        chu = "🧭 LỆNH CHỜ PHANH NHẢ (anh 20/11/2026)\n" + "\n".join(f"• {x}" for x in bao)
        q(f"""insert into etp.canh_bao (loai, khoa, muc, noi_dung) values ('lenh_cho', 'lenh_cho:{bay:%Y%m%d%H%M%S}', 'info', $N${chu}$N$) on conflict (khoa) do nothing""")
    kq["bao"] = bao
    return kq

def nap():
    st = doc(); st.setdefault("lenh", []); st.setdefault("do_duong", [])
    luc = dt.datetime.now(dt.timezone.utc).replace(microsecond=0); han = (luc + dt.timedelta(hours=HAN_GIO)).isoformat()
    giu_n, giu_t = "camp gốc còn ACTIVE + ROI 3 ngày đã khép ≥ 0", "camp còn ACTIVE + ROI 3 ngày và 7 ngày đã khép còn dương"
    moi = [{"id": f"nhan_roas:{g}:{r:g}", "viec": "nhan_roas", "camp": g, "roas": r, "ns": 5, "giu": giu_n} for g in (66055, 70189) for r in (1.0, 1.2)]
    moi += [{"id": f"tang:{c}:{n}", "viec": "tang", "camp": c, "ns": n, "truoc": t, "giu": giu_t} for c, t, n in ((102508, 2, 3), (102469, 1, 2), (101454, 2, 3), (102489, 1, 2))]
    co = {l["id"] for l in st["lenh"]}
    for l in moi:
        if l["id"] not in co: st["lenh"].append({**l, "ai": AI, "luc": luc.isoformat(), "han": han, "tt": "cho", "ly": None})
    cod = {int(d["camp"]) for d in st["do_duong"]}
    for c in (70193, 87786):
        if c not in cod: st["do_duong"].append({"camp": c, "nhan": "dò đường 20/11", "d0": "2026-11-20", "tt": "theo", "ly": None, "ai": AI_DO})
    ghi(st); return st

def _tu_kiem():
    r_ = lenh_cr("1", "2", "es", "X", "3", {"roas": 1, "ns": 5}); d_ = lenh_cr("1", "2", "en", "X", "3", None)
    assert r_[1] == "65734" and r_[r_.index("--roas") + 1] == "1" and r_[r_.index("--ns") + 1] == "5" and "--that" in r_, "★ ROAS: khuôn cùng tiếng + roas + ns"
    assert d_[1] == "65110" and d_[d_.index("--roas") + 1] == f"{float(HOI_CHO['roas']):g}" and d_[d_.index("--ns") + 1] == str(int(HOI_CHO["ns"])), "không có trong sổ len_cr_roas → ★ ROAS mặc định hoi_cho (anh 24/11/2026)"
    b = _u("2026-11-20T03:00:00Z")
    l = {"id": "x", "viec": "nhan_roas", "camp": 66055, "roas": 1.0, "ns": 5, "han": "2026-11-23T02:30:00+00:00", "tt": "cho"}
    t = {"id": "y", "viec": "tang", "camp": 102508, "ns": 3, "han": "2026-11-23T02:30:00+00:00", "tt": "cho"}
    ok = {"tt": "ACTIVE", "ns": 2, "r3": 19, "r7": 12}
    # phanh còn → không thực hiện
    assert xet(l, "chờ phanh nhả: PHANH CHỢ …", ok, b)[0] == "cho" and xet(t, "chờ phanh nhả: RÚT KHỎI CHỢ", ok, b)[0] == "cho"
    # phanh nhả + đủ điều kiện → thực hiện
    assert xet(l, None, ok, b) == ("lam", None) and xet(t, None, ok, b) == ("lam", None)
    # không đủ điều kiện → bỏ kèm lý do
    v, ly = xet(l, None, {**ok, "r3": -4}, b); assert v == "bo" and "-4" in ly
    v, ly = xet(l, None, {**ok, "tt": "PAUSED"}, b); assert v == "bo" and "ACTIVE" in ly
    v, ly = xet(t, None, {**ok, "r7": -1}, b); assert v == "bo" and "7 ngày" in ly
    v, ly = xet(t, None, {**ok, "r3": 0}, b); assert v == "bo"
    v, ly = xet(t, None, {**ok, "ns": 3}, b); assert v == "bo" and "$3" in ly
    assert xet(l, None, {**ok, "r3": 0}, b)[0] == "lam"   # bước 1: ROI 3 ngày ≥ 0 là đủ
    # quá hạn → huỷ (kể cả phanh vừa nhả)
    assert xet(l, "PHANH CHỢ", ok, _u("2026-11-23T02:31:00Z"))[0] == "huy" and xet(t, None, ok, _u("2026-11-23T03:00:00Z"))[0] == "huy"
    # dò đường: chưa khép đủ 2 ngày → theo; âm → tắt; dương → giữ; camp đã tắt → hết
    d = {"camp": 70193, "d0": "2026-11-20"}
    assert xet_do(d, ok, dt.date(2026, 11, 21), 0, 10)[0] == "theo"
    assert xet_do(d, ok, dt.date(2026, 11, 22), 30, 40)[0] == "tat" and xet_do(d, ok, dt.date(2026, 11, 22), 50, 40)[0] == "giu"
    assert xet_do(d, {"tt": "PAUSED"}, dt.date(2026, 11, 22), 0, 40)[0] == "het"
    # lỗi do cổng phanh → về hàng chờ; lỗi khác → bỏ
    assert CHO_LAI.search("PHANH CHỢ tới 11:29") and not CHO_LAI.search("ngân sách camp ROAS $15–20")
    print("lenh_cho tự kiểm: xanh")

if __name__ == "__main__":
    a = sys.argv[1:]
    if "--tu-kiem" in a: _tu_kiem()
    elif "--roas-cr" in a:   # python3 lenh_cho.py --roas-cr 113335,113336 [--roas 1] [--ns 5]
        g = lambda k, d: a[a.index(k) + 1] if k in a else d
        print(json.dumps(nap_roas([x.strip() for x in g("--roas-cr", "").split(",") if x.strip()], float(g("--roas", "1")), int(g("--ns", "5"))), ensure_ascii=False))
    elif "--nap" in a: st = nap(); print(json.dumps({"ok": True, "lenh": len(st["lenh"]), "do_duong": len(st["do_duong"])}, ensure_ascii=False))
    else: print(json.dumps(chay("--xem" in a), ensure_ascii=False, default=str))

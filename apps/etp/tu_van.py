#!/usr/bin/env python3
"""TƯ VẤN ETHOPEX THEO NGƯỜI (anh 10/11/2026: "1 con tư vấn chạy định kỳ hàng ngày vào trước đầu các phiên… đưa ra các tư vấn insight"; duyệt plan:
gửi 4 lần / ngày, trước phiên 15 phút — 06:45 · 11:45 · 14:45 · 20:45 VN; trước mắt chỉ gửi nhóm của David nhưng gồm báo cáo của MỖI người, mỗi người một chủ đề).

Chỉ ĐỌC kho etp.* (không sửa camp, không gửi lệnh Ethopex). Mỗi người (etp.tai_khoan.nguoi_id) một bản:
  hien_trang  hôm nay tới giờ này (ngày Ethopex = UTC, 07:00 VN mở ngày) so với hôm qua + trung bình 7 ngày đã khép
  thi_truong  ROI cả đội (etp.so_gio_ngoai) cùng khung giờ hôm nay vs trung bình 7 ngày trước — người lệch thị trường hay cả chợ cùng lệch
  phien       phiên sắp tới: khung máy mở / đóng lúc đó (đọc khung_doi trong etp-bang-luat.json, không chép tay)
  may_se_lam  thẻ xét luật (etp.xet_luat / xet_luat_ngoai) đang ĐỦ điều kiện, đếm theo luật
  nen         danh sách camp có số: tắt (lỗ hôm nay + 3 ngày khép yếu) · tăng (lãi 3 ngày, hôm nay tiêu nhanh) · ROAS (Dol: chi 3 ngày ≥ $20 & ROI ≥ 50%) · nhân bản
  ai          lời bình 2–4 câu qua ckey (tuyến rẻ, Haiku trước), chỉ dùng số đã tính; trần AI_TRAN_NGAY ₫ / ngày cộng dồn — chạm trần thì bỏ lời bình, báo vẫn gửi

  python3 apps/etp/tu_van.py --luu                 tính mọi người, ghi bản 'song' (trang Tổng quan đọc — dong-bo.py gọi mỗi 10 phút, không gọi AI)
  python3 apps/etp/tu_van.py --phien 06:45 --ai    tính + lời bình AI + ghi bản phiên → in JSON [{nguoi_id, nguoi, html}] cho worker gửi Telegram
  python3 apps/etp/tu_van.py --xem [--nguoi 117]   in chữ ra màn, không ghi"""
import datetime as dt, html, json, os, subprocess, sys, urllib.request

AI_TRAN_NGAY = 1000          # ₫ / ngày cho lời bình (anh duyệt plan 10/11/2026: ≤ 1.000₫ / ngày)
TAT_CHI, TAT_ROI, TAT_ROI3 = 3, -50, 20          # nên tắt: hôm nay chi ≥ $3 mà ROI < -50%, 3 ngày khép ROI < 20% (hoặc chưa có ngày khép)
TANG_ROI3, TANG_CHI3, TANG_NS, TANG_ROI = 50, 10, 0.4, 30   # nên tăng: 3 ngày ROI ≥ 50% chi ≥ $10, hôm nay đã tiêu ≥ 40% NS với ROI ≥ 30% (cổng nạp 40% của máy)
ROAS_CHI3, ROAS_ROI3 = 20, 50                    # Dol 09/11/2026: chi ≥ $20 & ROI 3 ngày khép ≥ 50% thì lên ROAS sớm
NHAN_ROI3, NHAN_CHI3 = 100, 10                   # nên nhân bản: 3 ngày ROI ≥ 100% chi ≥ $10
TOI_DA = 5                                        # mỗi danh sách tối đa 5 camp (xếp theo $ ảnh hưởng)
VN = dt.timezone(dt.timedelta(hours=7))
GOC = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def q(s):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()
def qj(s): return json.loads(q(f"select coalesce(json_agg(x), '[]') from ({s}) x") or "[]")
def roi(chi, thu): return round(100 * (thu - chi) / chi) if chi and chi > 0 else None
def pc(v): return "—" if v is None else f"{v:+d}%"
def usd(v): return f"${v:,.0f}" if abs(v) >= 10 else f"${v:,.2f}"

# ---------- số ----------
_CAMP = """select k.camp_id, k.ten, k.trang_thai, k.ngan_sach, k.la_roas, k.content_id, t.nguoi_id from etp.camp k join etp.tai_khoan t using (ad_account_id) where t.nha
  union all select k.camp_id, k.ten, k.trang_thai, k.ngan_sach, k.la_roas, k.content_id, t.nguoi_id from etp.camp_ngoai k join etp.tai_khoan t using (ad_account_id) where not t.nha"""
_SO = "select camp_id, ngay, chi, thu from etp.so_ngay union all select camp_id, ngay, chi, thu from etp.so_ngay_ngoai"

def doc_so():
    nguoi = qj("select distinct on (nguoi_id) nguoi_id, nguoi from etp.tai_khoan where nguoi_id is not null order by nguoi_id, nha desc")
    ngay = qj("""select nguoi_id, ngay::text, sum(chi)::float chi, sum(thu)::float thu, sum(camp)::int camp from etp.so_nguoi
                 where ngay >= current_date - 7 group by 1, 2 order by 2""")
    camp = qj(f"""with c as ({_CAMP}), s as ({_SO})
      select c.camp_id, c.ten, c.trang_thai, c.ngan_sach::float ns, c.la_roas, c.content_id, c.nguoi_id,
        coalesce(sum(s.chi) filter (where s.ngay = current_date), 0)::float chi_nay, coalesce(sum(s.thu) filter (where s.ngay = current_date), 0)::float thu_nay,
        coalesce(sum(s.chi) filter (where s.ngay between current_date - 3 and current_date - 1), 0)::float chi3,
        coalesce(sum(s.thu) filter (where s.ngay between current_date - 3 and current_date - 1), 0)::float thu3,
        count(*) filter (where s.ngay between current_date - 3 and current_date - 1 and s.chi > 0)::int ngay3
      from c left join s using (camp_id) where c.trang_thai = 'ACTIVE' group by 1, 2, 3, 4, 5, 6, 7""")
    # thị trường = cả đội (tài khoản team), cùng khung giờ UTC 0..H hôm nay vs 7 ngày trước
    gio = int(q("select coalesce(max(gio), -1) from etp.so_gio_ngoai where ngay = current_date") or -1)
    tt = qj(f"""select ngay::text, sum(chi)::float chi, sum(thu)::float thu from etp.so_gio_ngoai
                where ngay >= current_date - 7 and gio <= {gio} group by 1 order by 1""") if gio >= 0 else []
    the = qj("""select t.nguoi_id, e->>'ten' ten, e->>'ket' ket, count(*)::int n from etp.xet_luat x join etp.camp k using (camp_id) join etp.tai_khoan t using (ad_account_id),
                  jsonb_array_elements(x.xet) e where x.luc > now() - interval '90 minutes' and e->>'ket' in ('dat', 'gan') group by 1, 2, 3
                union all select x.nguoi_id, e->>'ten', e->>'ket', count(*)::int from etp.xet_luat_ngoai x, jsonb_array_elements(x.xet) e
                  where e->>'ket' in ('dat', 'gan') group by 1, 2, 3""")
    # NHÀ có số theo giờ (etp.so_gio_camp) → so cùng khung giờ với hôm qua / 7 ngày (team chỉ có số ngày theo người)
    gn = int(q("select coalesce(max(gio), -1) from etp.so_gio_camp where ngay = current_date") or -1)
    nha_gio = qj(f"""select t.nguoi_id, s.ngay::text, sum(s.chi)::float chi, sum(s.thu)::float thu from etp.so_gio_camp s join etp.camp k using (camp_id) join etp.tai_khoan t using (ad_account_id)
                    where t.nha and s.ngay >= current_date - 7 and s.gio <= {gn} group by 1, 2""") if gn >= 0 else []
    tu_dong = {int(r["nguoi_id"]) for r in qj("select nguoi_id from etp.che_do_luat where che_do = 'tu_dong'")} if q("select to_regclass('etp.che_do_luat')") else set()
    return nguoi, ngay, camp, gio, tt, the, tu_dong, nha_gio

# ---------- phiên ----------
TEN_KHUNG = {"tang": "tự tăng (đầu phiên · tăng bậc · T30)", "giam": "tự giảm / tắt (không tăng)", "sang": "nạp camp tiêu nhanh", "nhanh": "tăng nhanh", "len": "lên camp chạy ngay"}
PHIEN = (7, 12, 15, 21)   # phiên anh nêu 10/11/2026 ("trước đầu các phiên như 7h, 12h…"); báo gửi trước mỗi phiên 15 phút (worker ethopex-tu-van)
def phien_toi(now):
    """Phiên kế tiếp + khung máy MỞ / ĐÓNG lúc đó, kể cả khung đổi giữa giờ này và phiên (đọc khung_doi, không chép tay)."""
    kd = json.load(open(os.path.join(GOC, "apps/web/src/lib/etp-bang-luat.json")))["khung_doi"]
    p = (now + dt.timedelta(minutes=15)).replace(minute=0, second=0, microsecond=0)
    while p.hour not in PHIEN or p <= now: p += dt.timedelta(hours=1)
    gio_qua = {(now.hour + k) % 24 for k in range(1, int((p - now).total_seconds() // 3600) + 2)}   # các mốc giờ từ giờ tới phiên
    mo, dong = [], []
    for k, v in kd.items():
        if k.startswith("_") or k not in TEN_KHUNG: continue
        for a, b in (v if v and isinstance(v[0], list) else [v]):
            if a in gio_qua: mo.append((a, TEN_KHUNG[k]))
            if b in gio_qua: dong.append((b, TEN_KHUNG[k]))
    ten = lambda xs: [f"{t}" + ("" if h == p.hour else f" ({h:02d}:00)") for h, t in sorted(xs)]
    return {"gio": f"{p.hour:02d}:00", "mo": ten(mo), "dong": ten(dong)}

# ---------- một người ----------
def mot_nguoi(nid, ten, ngay, camp, gio, tt, the, tu_dong, nha_gio, now):
    hom = now.astimezone(dt.timezone.utc).date().isoformat()
    ds = [r for r in ngay if r["nguoi_id"] == nid]
    nay = next((r for r in ds if r["ngay"] == hom), {"chi": 0, "thu": 0, "camp": 0})
    cu = [r for r in ds if r["ngay"] < hom]
    qua = cu[-1] if cu else None
    c7, t7 = sum(r["chi"] for r in cu), sum(r["thu"] for r in cu)
    ht = {"chi": round(nay["chi"], 2), "thu": round(nay["thu"], 2), "roi": roi(nay["chi"], nay["thu"]), "camp": nay.get("camp") or 0,
          "roi_qua": roi(qua["chi"], qua["thu"]) if qua else None, "chi_qua": round(qua["chi"]) if qua else None,
          "roi_7": roi(c7, t7), "chi_7tb": round(c7 / len(cu)) if cu else None}
    ng = sorted((r for r in nha_gio if r["nguoi_id"] == nid and r["ngay"] < hom), key=lambda r: r["ngay"])
    if ng:   # cùng khung giờ (07:00 → giờ này) cho phần nhà
        ht["roi_qua_cung_gio"] = roi(ng[-1]["chi"], ng[-1]["thu"]) if ng[-1]["ngay"] == (dt.date.fromisoformat(hom) - dt.timedelta(days=1)).isoformat() else None
        ht["roi_7_cung_gio"] = roi(sum(r["chi"] for r in ng), sum(r["thu"] for r in ng))
    # thị trường: ROI cả đội cùng khung giờ hôm nay vs trung bình 7 ngày trước
    tn = next((r for r in tt if r["ngay"] == hom), None); tc = [r for r in tt if r["ngay"] < hom]
    thi = {"gio_vn": f"07:00–{(gio + 7) % 24:02d}:59" if gio >= 0 else None, "roi_nay": roi(tn["chi"], tn["thu"]) if tn else None,
           "roi_7": roi(sum(r["chi"] for r in tc), sum(r["thu"] for r in tc)) if tc else None}
    thi["lech"] = thi["roi_nay"] - thi["roi_7"] if thi["roi_nay"] is not None and thi["roi_7"] is not None else None
    # máy sẽ làm (thẻ xét luật đủ / gần đủ)
    mt = {}
    for r in the:
        if r["nguoi_id"] == nid: mt.setdefault(r["ten"], {"dat": 0, "gan": 0})[r["ket"]] += r["n"]
    may = sorted(({"luat": k, **v} for k, v in mt.items()), key=lambda x: -(x["dat"] * 10 + x["gan"]))
    # danh sách nên làm
    cs = [c for c in camp if c["nguoi_id"] == nid]
    def dong(c, ly):
        return {"camp_id": c["camp_id"], "ten": (c["ten"] or "")[:60], "ns": c["ns"], "chi_nay": round(c["chi_nay"], 2), "roi_nay": roi(c["chi_nay"], c["thu_nay"]),
                "chi3": round(c["chi3"], 2), "roi3": roi(c["chi3"], c["thu3"]), "ly": ly}
    tat, tang, roas, nhan = [], [], [], []
    roas_phim = {c["content_id"] for c in cs if c["la_roas"]}
    for c in cs:
        r_nay, r3 = roi(c["chi_nay"], c["thu_nay"]), roi(c["chi3"], c["thu3"])
        # camp chưa có ngày khép (mới lên / ROAS mới): chỉ đề xuất tắt khi đã tiêu hết ngân sách ngày — trước đó để máy T1 / T8 xét theo giờ
        if c["chi_nay"] >= TAT_CHI and (r_nay is not None and r_nay < TAT_ROI) and (r3 < TAT_ROI3 if r3 is not None else c["chi_nay"] >= (c["ns"] or 0) > 0):
            tat.append((c["chi_nay"] - c["thu_nay"], dong(c, f"hôm nay lỗ {usd(c['chi_nay'] - c['thu_nay'])}, 3 ngày khép {pc(r3) if r3 is not None else 'chưa có'}")))
        if c["la_roas"]: continue
        if r3 is not None and r3 >= TANG_ROI3 and c["chi3"] >= TANG_CHI3 and c["ns"] and c["chi_nay"] >= TANG_NS * c["ns"] and (r_nay or 0) >= TANG_ROI:
            tang.append((c["thu3"] - c["chi3"], dong(c, f"đã tiêu {round(100 * c['chi_nay'] / c['ns'])}% NS ${c['ns']:g}, ROI nay {pc(r_nay)}")))
        if r3 is not None and r3 >= ROAS_ROI3 and c["chi3"] >= ROAS_CHI3 and c["content_id"] not in roas_phim:
            roas.append((c["thu3"] - c["chi3"], dong(c, f"3 ngày chi {usd(c['chi3'])} ROI {pc(r3)} — phim chưa có camp ROAS"), c["content_id"]))
        if r3 is not None and r3 >= NHAN_ROI3 and c["chi3"] >= NHAN_CHI3 and c["ngay3"] >= 2:
            nhan.append((c["thu3"] - c["chi3"], dong(c, f"lãi {usd(c['thu3'] - c['chi3'])} / 3 ngày, ROI {pc(r3)}")))
    top = lambda xs: [x[1] for x in sorted(xs, key=lambda x: -x[0])[:TOI_DA]]
    # ROAS: một phim một đề xuất (camp lãi nhất của phim) — ROAS nhắm Page / bài của camp thắng, hai camp cùng phim là một việc
    _r = {}
    for x in sorted(roas, key=lambda x: -x[0]): _r.setdefault(x[2], x)
    roas = list(_r.values())
    return {"nguoi_id": nid, "nguoi": ten, "tu_dong": nid in tu_dong or nid == 117, "hien_trang": ht, "thi_truong": thi, "phien": phien_toi(now), "may_se_lam": may[:6],
            "nen": {"tat": top(tat), "tang": top(tang), "roas": top(roas), "nhan": top(nhan)},
            "dem": {"tat": len(tat), "tang": len(tang), "roas": len(roas), "nhan": len(nhan)}}

# ---------- lời bình AI (ckey) ----------
def _ckey():
    r = subprocess.run(["bash", "-c", ". /root/.secrets/spy.env; echo \"$CKEY_KEY\""], capture_output=True, text=True).stdout.strip()
    try: tuyen = json.load(open("/var/lib/spy/ckey-tuyen.json"))["dong"]; m = [x.replace("ckey:", "") for x in (tuyen.get("haiku") or []) + (tuyen.get("sonnet") or [])]
    except Exception: m = []
    return r, m
LUAT_AI = ("Bạn là cố vấn chạy quảng cáo phim ngắn trên Meta (Ethopex). Dưới đây là SỐ ĐÃ TÍNH của một người chạy. Viết 2–4 câu tiếng Việt, giọng điềm tĩnh, "
           "nói điều đáng chú ý nhất và việc nên làm ngay trong phiên tới. CHỈ dùng số có trong dữ liệu, không bịa số, không lặp lại cả bảng. "
           "Nếu thị trường cả đội cùng lệch thì nói rõ là do thị trường. Không dùng markdown, không gạch đầu dòng.")
def loi_binh(du):
    q(BANG)
    da = float(q("select coalesce(sum(chi_ai), 0) from etp.tu_van where luc > date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'") or 0)
    if da >= AI_TRAN_NGAY: return None, 0, f"đã dùng {da:.0f}₫ hôm nay (trần {AI_TRAN_NGAY}₫)"
    khoa, tuyen = _ckey(); loi = "không có tuyến ckey"
    gon = {k: du[k] for k in ("nguoi", "hien_trang", "thi_truong", "phien", "may_se_lam", "dem")} | {"nen": {k: v[:3] for k, v in du["nen"].items()}}
    for model in tuyen[:3]:
        try:
            body = {"model": model, "max_tokens": 300, "messages": [{"role": "user", "content": LUAT_AI + "\n\n" + json.dumps(gon, ensure_ascii=False)}]}
            r = json.load(urllib.request.urlopen(urllib.request.Request("https://api.xah.io/v1/chat/completions", data=json.dumps(body).encode(),
                headers={"Authorization": f"Bearer {khoa}", "content-type": "application/json"}), timeout=60))
            chi = float(((r.get("usage") or {}).get("x_ckey") or {}).get("cost") or 0)
            t = (r["choices"][0]["message"]["content"] or "").strip()
            if t: return t[:900], chi, model
            loi = f"{model}: trả rỗng"
        except Exception as e: loi = f"{model}: {str(e)[:120]}"
    return None, 0, loi

# ---------- chữ Telegram ----------
def chu(du, phien=None):
    e = lambda s: html.escape(str(s), quote=False); ht, tt, ph = du["hien_trang"], du["thi_truong"], du["phien"]
    L = [f"🧭 <b>Tư vấn · {e(du['nguoi'])}</b>" + (f" — trước phiên {ph['gio']}" if ph else "") + (f" ({phien})" if phien else "")]
    L.append(f"<b>Hôm nay</b> (ngày Ethopex từ 07:00): chi {usd(ht['chi'])} · thu {usd(ht['thu'])} · ROI <b>{pc(ht['roi'])}</b> · {ht['camp']} camp có chi")
    L.append(f"Hôm qua cả ngày {pc(ht['roi_qua'])} (chi {usd(ht['chi_qua'] or 0)}) · 7 ngày {pc(ht['roi_7'])} (TB {usd(ht['chi_7tb'] or 0)}/ngày)")
    if "roi_7_cung_gio" in ht: L.append(f"Cùng khung giờ (tài khoản nhà): hôm qua {pc(ht.get('roi_qua_cung_gio'))} · TB 7 ngày {pc(ht['roi_7_cung_gio'])}")
    if tt["roi_nay"] is not None:
        nx = "thị trường đang tốt hơn thường" if (tt["lech"] or 0) >= 10 else "thị trường đang kém hơn thường" if (tt["lech"] or 0) <= -10 else "thị trường bình thường"
        L.append(f"<b>Thị trường</b> cả đội {tt['gio_vn']}: {pc(tt['roi_nay'])} vs TB 7 ngày {pc(tt['roi_7'])} → {nx}")
    if ph:
        L.append(f"<b>Phiên {ph['gio']}</b>: " + "; ".join([*(f"mở {x}" for x in ph["mo"]), *(f"đóng {x}" for x in ph["dong"])]))
    if du["may_se_lam"]:
        L.append("<b>Máy luật đang thấy</b>: " + " · ".join(f"{e(m['luat'].split(' · ')[0])} {m['dat']} đủ" + (f"/{m['gan']} gần" if m["gan"] else "") for m in du["may_se_lam"]))
    tay = " (máy tự làm khi đúng khung + luật)" if du["tu_dong"] else " (làm tay)"
    for k, tit in (("tat", "⏹ Nên tắt"), ("tang", "⬆️ Nên tăng"), ("roas", "★ Nên lên ROAS"), ("nhan", "⧉ Nên nhân bản")):
        xs = du["nen"][k]
        if not xs: continue
        L.append(f"<b>{tit}{tay}</b> — {du['dem'][k]} camp" + (f", {len(xs)} lớn nhất:" if du["dem"][k] > len(xs) else ":"))
        L += [f"  #{x['camp_id']} {e(x['ten'][:40])} — {e(x['ly'])}" for x in xs]
    if not any(du["nen"].values()): L.append("Không có camp nào chạm ngưỡng tắt / tăng / ROAS / nhân bản lúc này.")
    if du.get("ai"): L.append(f"\n💬 {e(du['ai'])}")
    return "\n".join(L)

# BẢNG (tạo ở đây, không qua migration chung — chỉ máy tư vấn ghi): phien 'song' = bản sống dong-bo.py ghi lại mỗi 10 phút (không AI), trang Tổng quan đọc;
# phien 'HH:MM' = bản gửi Telegram trước phiên, có lời bình AI (chi_ai ₫)
BANG = """create table if not exists etp.tu_van (id bigserial primary key, luc timestamptz not null default now(), phien text not null, nguoi_id int not null,
  nguoi text, du jsonb not null, ai text, chi_ai numeric not null default 0); create index if not exists tu_van_nguoi_luc on etp.tu_van (nguoi_id, luc desc);"""
def ghi(phien, ds):
    q(BANG)
    j = json.dumps([{"phien": phien, "nguoi_id": d["nguoi_id"], "nguoi": d["nguoi"], "du": d, "ai": d.get("ai"), "chi_ai": d.get("chi_ai", 0)} for d in ds], ensure_ascii=False)
    if phien == "song":
        q(f"delete from etp.tu_van where phien = 'song'; insert into etp.tu_van (phien, nguoi_id, nguoi, du, ai, chi_ai) select phien, nguoi_id, nguoi, du, ai, chi_ai from jsonb_to_recordset($J${j}$J$::jsonb) as x(phien text, nguoi_id int, nguoi text, du jsonb, ai text, chi_ai numeric)")
    else:
        q(f"insert into etp.tu_van (phien, nguoi_id, nguoi, du, ai, chi_ai) select phien, nguoi_id, nguoi, du, ai, chi_ai from jsonb_to_recordset($J${j}$J$::jsonb) as x(phien text, nguoi_id int, nguoi text, du jsonb, ai text, chi_ai numeric)")

def main(a):
    now = dt.datetime.now(VN)
    nguoi, ngay, camp, gio, tt, the, tu_dong, nha_gio = doc_so()
    chon = int(a[a.index("--nguoi") + 1]) if "--nguoi" in a else None
    ds = [mot_nguoi(int(n["nguoi_id"]), n["nguoi"], ngay, camp, gio, tt, the, tu_dong, nha_gio, now) for n in nguoi if chon in (None, int(n["nguoi_id"]))]
    ds = [d for d in ds if d["hien_trang"]["chi"] > 0 or d["hien_trang"]["chi_qua"]]   # người không chạy 2 ngày thì không báo
    if "--luu" in a: ghi("song", ds); print(f"tư vấn sống: {len(ds)} người"); return
    phien = a[a.index("--phien") + 1] if "--phien" in a else None
    if "--ai" in a:
        for d in ds:
            d["ai"], d["chi_ai"], d["ai_tu"] = loi_binh(d)
    if phien: ghi(phien, ds)
    if "--xem" in a:
        for d in ds: print(chu(d, phien) + "\n" + "-" * 40)
        return
    print(json.dumps([{"nguoi_id": d["nguoi_id"], "nguoi": d["nguoi"], "html": chu(d, phien), "chi_ai": d.get("chi_ai", 0), "ai_tu": d.get("ai_tu")} for d in ds], ensure_ascii=False))

if __name__ == "__main__": main(sys.argv[1:])

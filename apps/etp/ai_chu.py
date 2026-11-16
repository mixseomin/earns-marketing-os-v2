#!/usr/bin/env python3
"""MỘT ĐƯỜNG GỌI AI CHỮ / NHÌN ẢNH cho mọi việc Ethopex — đi qua CỔNG AI CHUNG của spy (anh 16/11/2026: "Spy đang có chuỗi fallback hoàn chỉnh,
hãy sử dụng nó làm chuẩn để có 1 nguồn dùng API duy nhất cho mọi model"). Tệp này KHÔNG giữ khoá, KHÔNG chọn tuyến: gửi lượt sang
POST /api/ai (spy-on-tc/server/cong-ai.mjs → goi() của spy: donk → ckey sống → fal), bo_chinh_hang = không bao giờ về Claude chính hãng.
Trước 16/11 tệp này tự viết chuỗi donk → ckey (khoá + tuyến chép từ spy) — đổi tuyến phải sửa hai nơi. Sổ chi: ai_luot của spy, viec 'cong:etp-<việc>'.

Người gọi đưa nội dung theo khuôn OpenAI như cũ (chuỗi, hoặc danh sách phần {"type": "text"} / {"type": "image_url"}), kèm cong_cu=(tên, schema JSON)
khi cần kết quả có khuôn. `kiem(ket)` trả chuỗi lỗi → lượt sau bỏ tuyến đó (bo_tuyen), đi tuyến kế. Trả (ket, vnd, mo_hinh, loi):
ket = dict (có cong_cu) / str (không) / None khi mọi tuyến hỏng; vnd = tiền thật cộng dồn (cổng trả USD × 26.000); mo_hinh = tuyến đã chạy.

  python3 apps/etp/ai_chu.py --thu      gọi thử một câu qua cổng (vài ₫)"""
import base64, json, os, sys, urllib.error, urllib.request

VND_USD = 26000
UA = {"user-agent": "mos2-etp"}
MO_HINH = {"haiku": "claude-haiku-5-5", "sonnet": "fal:anthropic/claude-sonnet-5.5", "opus": "fal:anthropic/claude-opus-5.5"}   # tên theo bảng spy: chuỗi của tên này có tuyến fal trước chính hãng

def _khoa_tep(tep):
    try:
        for l in open(os.path.expanduser(tep)):
            if l.startswith("CONG_AI_KEY="): return l.split("=", 1)[1].strip().strip('"\'')
    except OSError: pass
    return ""
def cong_url(): return os.environ.get("CONG_AI_URL") or ("http://127.0.0.1:3850/api/ai" if os.path.exists("/root/.secrets/spy.env") else "https://spy.on.tc/api/ai")
def cong_khoa(): return os.environ.get("CONG_AI_KEY") or _khoa_tep("/root/.secrets/spy.env") or _khoa_tep("~/.secrets/cong-ai.env")

# ---------- đổi khuôn OpenAI → Anthropic (khối cổng AI nhận) ----------
_ANH = {}
def _anh_b64(u):
    """link / data URI → (media_type, base64); tải một lần mỗi tiến trình"""
    if u in _ANH: return _ANH[u]
    if u.startswith("data:"):
        dau, du = u.split(",", 1); mt = dau[5:].split(";")[0] or "image/jpeg"; r = (mt, du)
    else:
        b = urllib.request.urlopen(urllib.request.Request(u, headers={"user-agent": "Mozilla/5.0"}), timeout=30).read()
        mt = "image/png" if b[:4] == b"\x89PNG" else "image/webp" if b[8:12] == b"WEBP" else "image/gif" if b[:3] == b"GIF" else "image/jpeg"
        r = (mt, base64.b64encode(b).decode())
    _ANH[u] = r; return r
def _sang_anthropic(noi):
    if isinstance(noi, str): return noi
    ra = []
    for p in noi:
        if p.get("type") == "text": ra.append({"type": "text", "text": p["text"]})
        elif p.get("type") == "image_url":
            mt, du = _anh_b64(p["image_url"]["url"]); ra.append({"type": "image", "source": {"type": "base64", "media_type": mt, "data": du}})
    return ra

def goi(noi, *, max_tokens=400, cong_cu=None, uu="haiku", kiem=None, timeout=180, viec=None, so_ckey=None, cong=None):
    """so_ckey / cong: bỏ (16/11/2026 — tuyến do cổng chung chọn, nơi gọi không chọn); giữ tham số để bên gọi cũ không gãy"""
    khoa = cong_khoa()
    if not khoa: return None, 0.0, None, "thiếu CONG_AI_KEY (box3: /root/.secrets/spy.env · máy khác: ~/.secrets/cong-ai.env)"
    ten = viec or os.path.splitext(os.path.basename(sys.argv[0] or "etp"))[0] or "etp"
    body = {"viec": f"etp-{ten}"[:60], "model": MO_HINH.get(uu, MO_HINH["haiku"]), "max_tokens": max_tokens, "noi_dung": _sang_anthropic(noi) if not isinstance(noi, str) else noi,
            "bo_chinh_hang": True, **({"schema": cong_cu[1]} if cong_cu else {})}
    vnd, loi, bo = 0.0, [], []
    for _ in range(4):
        try:
            r = json.load(urllib.request.urlopen(urllib.request.Request(cong_url(), data=json.dumps({**body, "bo_tuyen": bo}).encode(),
                headers={**UA, "content-type": "application/json", "authorization": f"Bearer {khoa}"}), timeout=max(timeout, 60) * 3))
        except urllib.error.HTTPError as e:
            try: r = json.loads(e.read().decode("utf-8", "replace"))
            except Exception: r = {"loi": f"HTTP {e.code}"}
        except Exception as e: return None, vnd, None, " · ".join(loi + [f"cổng AI: {str(e)[:150]}"])
        if r.get("loi"): return None, vnd, None, " · ".join(loi + [f"cổng AI: {str(r['loi'])[:300]}"])
        vnd += float(r.get("chi_usd") or 0) * VND_USD
        ket = r.get("kq")
        if isinstance(ket, str): ket = ket.strip() or None
        k = "trả rỗng" if ket is None else (kiem(ket) if kiem else None)
        if not k: return ket, vnd, r.get("model"), None
        loi.append(f"{r.get('model')}: {k}"); bo.append(r.get("model"))
    return None, vnd, None, " · ".join(loi)

# CLI cho tệp không phải Python (viet-ke-chuyen.mts): stdin JSON {noi, max_tokens, cong_cu: [tên, schema], uu, viec} → stdout JSON {ket, vnd, mo_hinh, loi}
if __name__ == "__main__" and "--json" in sys.argv:
    a = json.load(sys.stdin)
    # can = {khoá: [mã con bắt buộc là số]} → câu trả lời chữ phải là JSON đủ các mã, thiếu thì lượt sau bỏ tuyến đó
    def _kiem_json(t):
        if not a.get("can"): return None
        try: j = json.loads(t[t.index("{"): t.rindex("}") + 1]) if isinstance(t, str) else t
        except Exception as x: return f"không phải JSON ({str(x)[:60]})"
        thieu = [f"{k}.{c}" for k, ds in a["can"].items() for c in ds if not isinstance((j.get(k) or {}).get(c), (int, float))]
        return f"thiếu {', '.join(thieu[:3])}" if thieu else None
    ket, vnd, mo, loi = goi(a["noi"], max_tokens=int(a.get("max_tokens") or 400), cong_cu=tuple(a["cong_cu"]) if a.get("cong_cu") else None, uu=a.get("uu") or "haiku",
                            kiem=_kiem_json, viec=a.get("viec"), timeout=int(a.get("timeout") or 300))
    print(json.dumps({"ket": ket, "vnd": vnd, "mo_hinh": mo, "loi": loi}, ensure_ascii=False))

if __name__ == "__main__" and "--thu" in sys.argv:
    for uu in ("haiku", "sonnet"):
        print(uu, goi("Trả lời đúng một từ: thủ đô của Pháp?", max_tokens=20, uu=uu))
    print("khuôn", goi("Ghi số 7", max_tokens=60, cong_cu=("ghi", {"type": "object", "required": ["so"], "properties": {"so": {"type": "integer"}}})))

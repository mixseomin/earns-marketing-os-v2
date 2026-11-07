#!/usr/bin/env python3
"""XẾP KHUNG ẢNH TĨNH BẰNG MẮT AI (anh 08/11/2026: "chọn các góc, khung hình ấn tượng nhất, đẹp nhất để lên creative").
anh-tinh.py (iMac) lọc khung bằng máy (mặt to, nét, không chữ đè mặt) → gửi ~12 ảnh nhỏ (data URI) qua ssh vào đây (box3, khoá ckey) →
mô hình rẻ nhất tuyến ckey (cùng tuyến nhom_goc._tuyen) xếp hạng theo: cảm xúc mạnh / kịch tính, bố cục điện ảnh, ánh sáng đẹp, nhân vật nổi bật, dừng tay lướt.
stdin: {"ten": "<tên phim>", "anh": ["data:image/jpeg;base64,…", …]} → stdout: {"thu_tu": [chỉ số tốt → kém], "ly_do": "…", "vnd": chi phí}
Lỗi mô hình → thu_tu rỗng (anh-tinh giữ thứ tự điểm máy)."""
import json, os, sys, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp"))
import nhom_goc as NG

LUAT = ("You are a senior short-drama ad creative director. These are candidate still frames from the drama \"{t}\" for a 9:16 static-image Facebook ad "
        "(the frame fills the screen, the drama title is overlaid at the bottom). Rank ALL frames from best to worst for stopping the scroll: strong emotion or "
        "dramatic tension on the face, cinematic composition, beautiful lighting, attractive / striking main character, clear single subject. Penalise blur, "
        "awkward mid-blink / mid-speech faces, dull neutral expressions, cluttered backgrounds. Frames are numbered from 0 in the order given.")

def xep(ten, anh):
    _, khoa = NG._spy(); chi, loi = 0.0, ""
    for model in NG._tuyen()[:3]:
        try:
            noi = []
            for i, u in enumerate(anh): noi += [{"type": "text", "text": f"Frame {i}:"}, {"type": "image_url", "image_url": {"url": u}}]
            body = {"model": model, "max_tokens": 400, "messages": [{"role": "user", "content": [*noi, {"type": "text", "text": LUAT.format(t=ten)}]}],
                    "tools": [{"type": "function", "function": {"name": "xep_hang", "parameters": {"type": "object", "required": ["thu_tu", "ly_do"],
                              "properties": {"thu_tu": {"type": "array", "items": {"type": "integer"}}, "ly_do": {"type": "string"}}}}}],
                    "tool_choice": {"type": "function", "function": {"name": "xep_hang"}}}
            r = json.load(urllib.request.urlopen(urllib.request.Request("https://api.xah.io/v1/chat/completions", data=json.dumps(body).encode(),
                headers={"Authorization": f"Bearer {khoa}", "content-type": "application/json"}), timeout=180))
            chi += float(((r.get("usage") or {}).get("x_ckey") or {}).get("cost") or 0)
            a = json.loads(r["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"])
            tt = [int(i) for i in a.get("thu_tu") or [] if 0 <= int(i) < len(anh)]
            tt = list(dict.fromkeys(tt)) + [i for i in range(len(anh)) if i not in tt]
            return {"thu_tu": tt, "ly_do": str(a.get("ly_do"))[:400], "vnd": round(chi), "mo_hinh": model}
        except Exception as e: loi = f"{model}: {str(e)[:150]}"
    return {"thu_tu": [], "ly_do": loi, "vnd": round(chi)}

if __name__ == "__main__":
    j = json.load(sys.stdin); print(json.dumps(xep(j["ten"], j["anh"]), ensure_ascii=False))

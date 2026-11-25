#!/usr/bin/env python3
"""XẾP KHUNG ẢNH TĨNH BẰNG MẮT AI (anh 08/11/2026: "chọn các góc, khung hình ấn tượng nhất, đẹp nhất để lên creative").
anh-tinh.py (iMac) lọc khung bằng máy (mặt to, nét, không chữ đè mặt) → gửi ~12 ảnh nhỏ (data URI) qua ssh vào đây (box3, khoá donk / ckey) →
mô hình qua apps/etp/ai_chu.py (donk → ckey) xếp hạng theo: cảm xúc mạnh / kịch tính, bố cục điện ảnh, ánh sáng đẹp, nhân vật nổi bật, dừng tay lướt.
stdin: {"ten": "<tên phim>", "anh": ["data:image/jpeg;base64,…", …], "mo_ta"?: tóm tắt phim, "the_loai"?: thể loại}
→ stdout: {"thu_tu": [chỉ số tốt → kém], "ly_do": "…", "khung": [{"i", "cam_xuc", "nhan_vat"}], "vnd": chi phí}
ĐÚNG TÂM LÝ (anh 20/11/2026 "lấy cảnh giàu cảm xúc, đúng tâm lý cũng quan trọng như việc cắt được logo gốc"): trước đây mô hình chỉ biết TÊN phim nên xếp theo "đẹp chung chung"
(American Sniper ra khung người mẹ khóc thay vì người lính). Giờ đưa cả tóm tắt + thể loại, yêu cầu khung phải KỂ ĐÚNG MÓC CÂU CHUYỆN của phim, và gắn nhãn cảm xúc + nhân vật
từng khung — bản dựng lần sau cho cùng phim chọn khung khác cảm xúc / khác nhân vật.
Lỗi mô hình → thu_tu rỗng (anh-tinh giữ thứ tự điểm máy)."""
import json, os, sys, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp"))
import ai_chu as AI   # MỘT đường gọi AI (donk → ckey)

LUAT = ("You are a senior short-drama ad creative director. These are candidate still frames from the drama \"{t}\" for a 9:16 static-image Facebook ad "
        "(the frame fills the screen, the drama title is overlaid at the bottom). Rank ALL frames from best to worst for stopping the scroll: strong emotion or "
        "dramatic tension on the face, cinematic composition, beautiful lighting, attractive / striking main character, clear single subject. Penalise blur, "
        "awkward mid-blink / mid-speech faces, dull neutral expressions, cluttered backgrounds. Frames are numbered from 0 in the order given.")
TAM_LY = ("\n\nGenre: {tl}\nSynopsis: {mt}\n\nMOST IMPORTANT: the frame must sell THIS story to its audience. Prefer the protagonist (the character the title and synopsis are about) "
          "in a moment that shows the story's core hook and emotion (for example: revenge → cold fury or a power stance; forbidden romance → longing or tension between the couple; "
          "action / military → danger, focus, a weapon or uniform; betrayal → shock or tears). A beautiful frame of a side character, or an emotion that contradicts the hook, ranks "
          "BELOW a slightly less polished frame that tells the right story. First work out from the synopsis who the protagonist is (gender, role, look) and which frames show that person; those frames lead the ranking unless they are technically unusable. A smiling or relaxed face ranks near the bottom unless the story is a comedy or a sweet romance (soát American Sniper 20/11/2026: khung người lính cười đứng hạng 1 cho một phim hành động). Also return, for EVERY frame, its dominant emotion (one of: fury, tears, fear, shock, tension, longing, "
          "joy, pride, cold, neutral) and a 2-4 word description of who is shown (e.g. 'soldier aiming rifle', 'crying mother with child').")

# POSTER GỐC LÀM ĐỐI CHIẾU (anh 20/11/2026 "Sao nó ko liên quan gì đến poster gốc?"): poster chính thức cho biết NHÂN VẬT CHÍNH + TẠO HÌNH (trang phục, bối cảnh) mà mọi ad
# đối thủ đều bám theo → khung đúng người đó, đúng tạo hình đó đứng đầu.
POSTER = ("\n\nThe image labelled OFFICIAL POSTER is the drama's official key art — it is NOT a candidate. It shows who the protagonist is and the signature look the audience "
          "expects (costume, setting, mood). Strongly prefer candidate frames that show THE SAME ACTOR as the largest figure on the poster, ideally in the same costume / look "
          "(e.g. poster shows him in an orange prison jumpsuit → prison-jumpsuit frames beat frames of him in a different outfit). A frame of a different person ranks below any usable frame of the poster's lead. "
          "RANKING ORDER (this overrides the synopsis-hook preference above): first the poster's lead in the poster's signature look, then the poster's lead in other looks, then everyone else.")
# GIỌNG THEO PHIM + CHỦ ĐỀ PHIM (anh 25/11/2026 "giọng cần phiên bản theo film và theme film"): cùng lượt xem poster + tóm tắt này, mô hình chọn luôn KIỂU GIỌNG đọc
# hợp thể loại + không khí câu chuyện từ danh sách người gọi gửi (giong_chon = {mã: mô tả}) — không tốn thêm lượt gọi. Thể loại trong sổ etp.phim thô (Genie = "tinh_cam"
# trong khi là phim phép thuật hài) nên đọc từ chính câu chuyện.
GIONG = ("\n\nALSO choose the voice-over style for this drama's ad from the list below — pick the one whose delivery matches THIS story's genre, mood and audience "
         "(read the synopsis and poster, not just the genre label; e.g. a magical comedy wants playful, a revenge thriller wants sinister or shouting). Styles:\n{ds}")
def xep(ten, anh, mo_ta="", the_loai="", poster=None, giong_chon=None):
    gc = bool(giong_chon and mo_ta)   # chọn giọng cần hiểu câu chuyện → chỉ khi có tóm tắt
    noi = [{"type": "text", "text": "OFFICIAL POSTER (reference only, not a candidate):"}, {"type": "image_url", "image_url": {"url": poster}}] if poster else []
    for i, u in enumerate(anh): noi += [{"type": "text", "text": f"Frame {i}:"}, {"type": "image_url", "image_url": {"url": u}}]
    a, chi, model, loi = AI.goi([*noi, {"type": "text", "text": LUAT.format(t=ten) + (TAM_LY.format(tl=the_loai or "unknown", mt=mo_ta[:900]) if mo_ta else "") + (POSTER if poster else "") + (GIONG.format(ds="\n".join(f"- {k}: {v}" for k, v in giong_chon.items())) if gc else "")}], max_tokens=1200 if mo_ta else 400, timeout=180, uu="sonnet" if mo_ta else "haiku",   # có tóm tắt = phải hiểu câu chuyện để nhận ra nhân vật chính → model khá hơn (vài chục đồng / phim, một lần)
        cong_cu=("xep_hang", {"type": "object", "required": ["thu_tu", "ly_do"],
        "properties": {"thu_tu": {"type": "array", "items": {"type": "integer"}}, "ly_do": {"type": "string"},
                       "khung": {"type": "array", "items": {"type": "object", "properties": {"i": {"type": "integer"}, "cam_xuc": {"type": "string"}, "nhan_vat": {"type": "string"}}}},
                       **({"giong": {"type": "string", "enum": list(giong_chon)}, "giong_ly_do": {"type": "string"}} if gc else {})}}))   # donk → ckey: apps/etp/ai_chu.py
    if not a: return {"thu_tu": [], "ly_do": loi, "vnd": round(chi)}
    tt = [int(i) for i in a.get("thu_tu") or [] if 0 <= int(i) < len(anh)]
    tt = list(dict.fromkeys(tt)) + [i for i in range(len(anh)) if i not in tt]
    kh = [{"i": int(x["i"]), "cam_xuc": str(x.get("cam_xuc") or "")[:20].lower(), "nhan_vat": str(x.get("nhan_vat") or "")[:60]} for x in a.get("khung") or [] if isinstance(x, dict) and str(x.get("i", "")).lstrip("-").isdigit()]
    g = a.get("giong") if gc and a.get("giong") in giong_chon else None
    return {"thu_tu": tt, "ly_do": str(a.get("ly_do"))[:400], "khung": kh, "vnd": round(chi), "mo_hinh": model, **({"giong": g, "giong_ly_do": str(a.get("giong_ly_do") or "")[:200]} if g else {})}

if __name__ == "__main__":
    j = json.load(sys.stdin); print(json.dumps(xep(j["ten"], j["anh"], j.get("mo_ta") or "", j.get("the_loai") or "", j.get("poster"), j.get("giong_chon")), ensure_ascii=False))

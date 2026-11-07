# BỘ NÉN H.264 THEO MÁY — bản Python của src/lib/xuong-video/nen-video.mjs (anh 07/11/2026: "phải áp dụng mặc định cho mọi việc có thể dùng đến nó").
# Mac: VideoToolbox (chip mã hoá riêng, không bị ưu tiên nền bóp). Linux (box3, Cloudflare): libx264 như cũ. Mức chất lượng: q = 100 − 1,6 × crf
# (đo 07/11/2026: libx264 crf 20 SSIM 0,961 ≈ VideoToolbox q 68 SSIM 0,962). Đổi luật ở đây thì đổi cả bản .mjs.
import sys

MAC = sys.platform == "darwin"


def q_tu_crf(crf):
    return str(max(30, min(90, round(100 - 1.6 * float(crf)))))


def nen_h264(crf=20, preset="medium", bit=None, maxrate=None, bufsize=None, threads=None):
    """Tham số mã hoá cho -c:v, gồm luôn -pix_fmt yuv420p. bit: ép bitrate cố định trên Mac (Linux vẫn crf)."""
    rate = ["-maxrate", maxrate, "-bufsize", bufsize or maxrate] if maxrate else []
    if MAC:
        return ["-c:v", "h264_videotoolbox", *(["-b:v", bit] if bit else ["-q:v", q_tu_crf(crf)]), *rate, "-pix_fmt", "yuv420p", "-allow_sw", "1"]
    return ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", str(crf), "-preset", preset, *(["-threads", str(threads)] if threads else []), *rate]


def giai_ma_hw():
    """Đặt TRƯỚC -i <video H.264/HEVC>: Mac giải mã bằng phần cứng."""
    return ["-hwaccel", "videotoolbox"] if MAC else []


def doi_nen(args):
    """Lệnh ffmpeg dựng sẵn ở máy khác (box3 xếp việc cho iMac) mang libx264 → trên Mac đổi sang VideoToolbox cùng mức chất lượng."""
    if not MAC or "libx264" not in args:
        return list(args)
    ra, i, crf = [], 0, None
    while i < len(args):
        a = args[i]
        if a in ("-crf",) and i + 1 < len(args):
            crf = args[i + 1]; i += 2; continue
        if a in ("-preset", "-tune", "-threads", "-x264-params", "-x264opts", "-profile:v") and i + 1 < len(args):
            i += 2; continue
        ra.append("h264_videotoolbox" if a == "libx264" else a); i += 1
    j = ra.index("h264_videotoolbox") + 1
    ra[j:j] = ["-q:v", q_tu_crf(crf if crf is not None else 23), "-allow_sw", "1"]
    return ra


if __name__ == "__main__" and "--crf" in sys.argv:   # cho script shell: $(python3 nen_video.py --crf 18)
    print(" ".join(nen_h264(sys.argv[sys.argv.index("--crf") + 1])))
elif __name__ == "__main__":   # tự kiểm: python3 nen_video.py
    a = ["-i", "x.mp4", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-c:a", "aac", "o.mp4"]
    b = doi_nen(a)
    if MAC:
        assert b == ["-i", "x.mp4", "-c:v", "h264_videotoolbox", "-q:v", "66", "-allow_sw", "1", "-c:a", "aac", "o.mp4"], b
        assert nen_h264(20)[:4] == ["-c:v", "h264_videotoolbox", "-q:v", "68"]
    else:
        assert b == a
    assert doi_nen(["-c:v", "copy"]) == ["-c:v", "copy"]
    print("nen_video ok", "mac" if MAC else "linux")

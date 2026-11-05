// ĐỌC CHỮ TRONG ẢNH bằng Vision của macOS (0đ, chạy tại máy) — dùng cho kiem-thoai.py đọc phụ đề in cứng trong video QC app gốc.
// Dùng: swift doc-chu.swift <anh1.png> [anh2.png …]  → mỗi ảnh một dòng JSON {"anh": "...", "chu": "dòng 1 | dòng 2",
//   "khung": [[chữ, x, y, rộng, cao], …]} — toạ độ chuẩn hoá 0–1, gốc TRÊN-TRÁI (che-thoai.py dùng để làm mờ đúng ô phụ đề, 22/10/2026)
// Cờ --mat (anh-tinh.py chọn khung đẹp nét, 05/11/2026): thêm "mat": [[x, y, rộng, cao, chất lượng 0–1], …] — VNDetectFaceCaptureQualityRequest
//   (điểm Apple chấm mặt: nét, đủ sáng, nhìn thẳng, không nhắm mắt)
import Foundation
import Vision
import AppKit

let coMat = CommandLine.arguments.contains("--mat")
for duong in CommandLine.arguments.dropFirst() where duong != "--mat" {
    var chu: [String] = []; var khung: [[Any]] = []; var mat: [[Any]] = []
    if let im = NSImage(contentsOfFile: duong), let cg = im.cgImage(forProposedRect: nil, context: nil, hints: nil) {
        let yc = VNRecognizeTextRequest()
        yc.recognitionLevel = .accurate
        yc.recognitionLanguages = ["en-US", "es-ES"]
        let fq = VNDetectFaceCaptureQualityRequest()
        try? VNImageRequestHandler(cgImage: cg, options: [:]).perform(coMat ? [yc, fq] : [yc])
        for r in yc.results ?? [] {
            guard let t = r.topCandidates(1).first?.string else { continue }
            chu.append(t); let b = r.boundingBox
            khung.append([t, b.minX, 1 - b.maxY, b.width, b.height])
        }
        for f in fq.results ?? [] { let b = f.boundingBox; mat.append([b.minX, 1 - b.maxY, b.width, b.height, f.faceCaptureQuality ?? 0]) }
    }
    var o: [String: Any] = ["anh": duong, "chu": chu.joined(separator: " | "), "khung": khung]
    if coMat { o["mat"] = mat }
    let d = try! JSONSerialization.data(withJSONObject: o)
    print(String(data: d, encoding: .utf8)!)
}

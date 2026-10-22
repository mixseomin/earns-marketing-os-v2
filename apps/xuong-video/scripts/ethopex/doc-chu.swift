// ĐỌC CHỮ TRONG ẢNH bằng Vision của macOS (0đ, chạy tại máy) — dùng cho kiem-thoai.py đọc phụ đề in cứng trong video QC app gốc.
// Dùng: swift doc-chu.swift <anh1.png> [anh2.png …]  → mỗi ảnh một dòng JSON {"anh": "...", "chu": "dòng 1 | dòng 2",
//   "khung": [[chữ, x, y, rộng, cao], …]} — toạ độ chuẩn hoá 0–1, gốc TRÊN-TRÁI (che-thoai.py dùng để làm mờ đúng ô phụ đề, 22/10/2026)
import Foundation
import Vision
import AppKit

for duong in CommandLine.arguments.dropFirst() {
    var chu: [String] = []; var khung: [[Any]] = []
    if let im = NSImage(contentsOfFile: duong), let cg = im.cgImage(forProposedRect: nil, context: nil, hints: nil) {
        let yc = VNRecognizeTextRequest()
        yc.recognitionLevel = .accurate
        yc.recognitionLanguages = ["en-US", "es-ES"]
        try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([yc])
        for r in yc.results ?? [] {
            guard let t = r.topCandidates(1).first?.string else { continue }
            chu.append(t); let b = r.boundingBox
            khung.append([t, b.minX, 1 - b.maxY, b.width, b.height])
        }
    }
    let d = try! JSONSerialization.data(withJSONObject: ["anh": duong, "chu": chu.joined(separator: " | "), "khung": khung] as [String: Any])
    print(String(data: d, encoding: .utf8)!)
}

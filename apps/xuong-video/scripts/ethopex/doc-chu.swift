// ĐỌC CHỮ TRONG ẢNH bằng Vision của macOS (0đ, chạy tại máy) — dùng cho kiem-thoai.py đọc phụ đề in cứng trong video QC app gốc.
// Dùng: swift doc-chu.swift <anh1.png> [anh2.png …]  → mỗi ảnh một dòng JSON {"anh": "...", "chu": "dòng 1 | dòng 2"}
import Foundation
import Vision
import AppKit

for duong in CommandLine.arguments.dropFirst() {
    var chu: [String] = []
    if let im = NSImage(contentsOfFile: duong), let cg = im.cgImage(forProposedRect: nil, context: nil, hints: nil) {
        let yc = VNRecognizeTextRequest()
        yc.recognitionLevel = .accurate
        yc.recognitionLanguages = ["en-US", "es-ES"]
        try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([yc])
        chu = (yc.results ?? []).compactMap { $0.topCandidates(1).first?.string }
    }
    let d = try! JSONSerialization.data(withJSONObject: ["anh": duong, "chu": chu.joined(separator: " | ")])
    print(String(data: d, encoding: .utf8)!)
}

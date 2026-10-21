// HỘP CHỮ TRONG ẢNH bằng Vision của macOS (0đ) — như doc-chu.swift nhưng in kèm KHUNG từng dòng chữ (toạ độ 0–1, gốc trên-trái)
// để xoa-chu-clip.py làm mờ đúng chỗ chữ model video tự in (phụ đề giả của Grok…).
// Dùng: hop-chu <anh1.png> [anh2.png …] → mỗi ảnh một dòng JSON {"anh": "...", "hop": [{"chu": "...", "x":, "y":, "w":, "h":}]}
import Foundation
import Vision
import AppKit

for duong in CommandLine.arguments.dropFirst() {
    var hop: [[String: Any]] = []
    if let im = NSImage(contentsOfFile: duong), let cg = im.cgImage(forProposedRect: nil, context: nil, hints: nil) {
        let yc = VNRecognizeTextRequest()
        yc.recognitionLevel = .accurate
        yc.recognitionLanguages = ["en-US", "es-ES"]
        try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([yc])
        for r in yc.results ?? [] {
            guard let c = r.topCandidates(1).first else { continue }
            let b = r.boundingBox
            hop.append(["chu": c.string, "x": b.minX, "y": 1 - b.maxY, "w": b.width, "h": b.height])
        }
    }
    let d = try! JSONSerialization.data(withJSONObject: ["anh": duong, "hop": hop])
    print(String(data: d, encoding: .utf8)!)
}

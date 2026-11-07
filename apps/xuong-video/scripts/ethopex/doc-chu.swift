// ĐỌC CHỮ TRONG ẢNH bằng Vision của macOS (0đ, chạy tại máy) — dùng cho kiem-thoai.py đọc phụ đề in cứng trong video QC app gốc.
// Dùng: swift doc-chu.swift <anh1.png> [anh2.png …]  → mỗi ảnh một dòng JSON {"anh": "...", "chu": "dòng 1 | dòng 2",
//   "khung": [[chữ, x, y, rộng, cao], …]} — toạ độ chuẩn hoá 0–1, gốc TRÊN-TRÁI (che-thoai.py dùng để làm mờ đúng ô phụ đề, 22/10/2026)
// Cờ --mat (anh-tinh.py chọn khung đẹp nét, 05/11/2026): thêm "mat": [[x, y, rộng, cao, chất lượng 0–1], …] — VNDetectFaceCaptureQualityRequest
//   (điểm Apple chấm mặt: nét, đủ sáng, nhìn thẳng, không nhắm mắt)
import Foundation
import Vision
import AppKit

let coMat = CommandLine.arguments.contains("--mat")
// --nhanh: Vision mức .fast (~25× nhanh, bắt ~63% chữ) — kiem-thoai.doc dùng để dò khung nào có phụ đề MỚI rồi chỉ đọc .accurate những khung đó (07/11/2026)
let nhanh = CommandLine.arguments.contains("--nhanh")
for duong in CommandLine.arguments.dropFirst() where duong != "--mat" && duong != "--nhanh" {
    var chu: [String] = []; var khung: [[Any]] = []; var mat: [[Any]] = []
    guard let im = NSImage(contentsOfFile: duong), let cg = im.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        FileHandle.standardError.write("doc-chu: không mở được ảnh \(duong)\n".data(using: .utf8)!); exit(2) }
    do {
        let yc = VNRecognizeTextRequest()
        yc.recognitionLevel = nhanh ? .fast : .accurate
        yc.recognitionLanguages = ["en-US", "es-ES"]
        let fq = VNDetectFaceCaptureQualityRequest()
        // KHÔNG nuốt lỗi Vision (07/11/2026: lượt đầu sau khi dịch lại, ANE đang dịch mô hình → try? trả chữ RỖNG = cổng thoại tưởng "không có câu cấm") → thoát mã 2
        // Neural Engine lỗi (e5rtError lúc ANE còn dịch mô hình cho bản vừa dịch — CPU không chạy được mức .accurate) → đợi rồi thử lại tới 3 phút (đo 07/11: bản vừa dịch ấm ANE mất 56 giây); vẫn lỗi mới thoát
        var lan = 0
        while true {
            do { try VNImageRequestHandler(cgImage: cg, options: [:]).perform(coMat ? [yc, fq] : [yc]); break }
            catch {
                lan += 1
                if lan >= 60 { FileHandle.standardError.write("doc-chu: Vision lỗi ở \(duong) sau \(lan) lần: \(error)\n".data(using: .utf8)!); exit(2) }
                Thread.sleep(forTimeInterval: 3)
            }
        }
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

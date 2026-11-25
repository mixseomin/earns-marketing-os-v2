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
// ANE đã treo một lần trong lượt → các ảnh sau đọc thẳng bằng CPU, không chờ lại 15 giây mỗi ảnh (26/11/2026: 105 khung × 15 giây = quá hạn 600 giây của kiem-thoai, phim 57545 không cắt được)
var aneTreo = false
for duong in CommandLine.arguments.dropFirst() where duong != "--mat" && duong != "--nhanh" {
    var chu: [String] = []; var khung: [[Any]] = []; var mat: [[Any]] = []; var duPhong = false
    guard let im = NSImage(contentsOfFile: duong), let cg = im.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        FileHandle.standardError.write("doc-chu: không mở được ảnh \(duong)\n".data(using: .utf8)!); exit(2) }
    do {
        let yc = VNRecognizeTextRequest()
        yc.recognitionLevel = nhanh ? .fast : .accurate
        yc.recognitionLanguages = ["en-US", "es-ES"]
        let fq = VNDetectFaceCaptureQualityRequest()
        // KHÔNG nuốt lỗi Vision (07/11/2026: lượt đầu sau khi dịch lại, ANE đang dịch mô hình → try? trả chữ RỖNG = cổng thoại tưởng "không có câu cấm") → thoát mã 2
        // Neural Engine lỗi (e5rtError lúc ANE còn dịch mô hình cho bản vừa dịch — CPU không chạy được mức .accurate) → đợi rồi thử lại tới 3 phút (đo 07/11: bản vừa dịch ấm ANE mất 56 giây); vẫn lỗi mới thoát
        // ANE TREO (25/11/2026: ANECompilerService root kẹt 57 phút → .accurate đứng im không trả lỗi, mọi lượt dựng chết vì quá hạn 120s của bên gọi):
        //   chạy .accurate ở luồng phụ, chờ tối đa 15 giây; quá hạn → đọc lại bằng CPU mức .fast (đo 2 giây) + kêu to ở stderr + "du_phong": true trong JSON
        var lan = 0; var loi: Error? = nil; var fdKq: [VNFaceObservation]? = nil
        let xong = DispatchSemaphore(value: 0)
        if !aneTreo { Thread.detachNewThread {
            while true {
                do { try VNImageRequestHandler(cgImage: cg, options: [:]).perform(coMat ? [yc, fq] : [yc]); break }
                catch { lan += 1; if lan >= 60 { loi = error; break }; Thread.sleep(forTimeInterval: 3) }
            }
            xong.signal()
        } }
        if aneTreo || xong.wait(timeout: .now() + 15) == .timedOut {
            if !aneTreo { FileHandle.standardError.write("doc-chu: ⚠ Neural Engine không trả lời sau 15 giây ở \(duong) — đọc dự phòng bằng CPU mức .fast (bắt ít chữ hơn) cho ảnh này và mọi ảnh sau trong lượt\n".data(using: .utf8)!) }
            aneTreo = true
            let yd = VNRecognizeTextRequest(); yd.recognitionLevel = .fast; yd.usesCPUOnly = true; yd.recognitionLanguages = yc.recognitionLanguages
            // dò mặt cũng chạy CPU (25/11/2026: dự phòng bỏ mặt → "mat": [] im lặng, bên gọi tưởng khung không có người, ghép logo chết max() rỗng)
            let fd = VNDetectFaceCaptureQualityRequest(); fd.usesCPUOnly = true
            do { try VNImageRequestHandler(cgImage: cg, options: [:]).perform(coMat ? [yd, fd] : [yd]) }
            catch { FileHandle.standardError.write("doc-chu: Vision CPU lỗi ở \(duong): \(error)\n".data(using: .utf8)!); exit(2) }
            duPhong = true; fdKq = fd.results
            for r in yd.results ?? [] {
                guard let t = r.topCandidates(1).first?.string else { continue }
                chu.append(t); let b = r.boundingBox
                khung.append([t, b.minX, 1 - b.maxY, b.width, b.height])
            }
        } else if let loi = loi { FileHandle.standardError.write("doc-chu: Vision lỗi ở \(duong) sau \(lan) lần: \(loi)\n".data(using: .utf8)!); exit(2) }
        if !duPhong { for r in yc.results ?? [] {
            guard let t = r.topCandidates(1).first?.string else { continue }
            chu.append(t); let b = r.boundingBox
            khung.append([t, b.minX, 1 - b.maxY, b.width, b.height])
        } }
        for f in (duPhong ? fdKq : fq.results) ?? [] { let b = f.boundingBox; mat.append([b.minX, 1 - b.maxY, b.width, b.height, f.faceCaptureQuality ?? 0]) }
    }
    var o: [String: Any] = ["anh": duong, "chu": chu.joined(separator: " | "), "khung": khung]
    if coMat { o["mat"] = mat }
    if duPhong { o["du_phong"] = true }
    let d = try! JSONSerialization.data(withJSONObject: o)
    print(String(data: d, encoding: .utf8)!)
}
exit(0)   // luồng .accurate còn treo trong ANE thì không giữ tiến trình

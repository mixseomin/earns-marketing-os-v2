// NHẤC CHỦ THỂ RA NỀN TRONG cho kho kênh lịch sử (02/11/2026): Vision (VNGenerateForegroundInstanceMaskRequest) lấy MỌI chủ thể trong ảnh gộp một —
// tay giơ xa / vũ khí rời người không bị cắt mất như khi lấy từng lớp. 0đ, chạy cục bộ iMac.
//   swift nen-trong.swift <ảnh.jpg> <ra.png>
import Foundation
import Vision
import CoreImage

let a = CommandLine.arguments
guard a.count >= 3, let goc = CIImage(contentsOf: URL(fileURLWithPath: a[1])) else { print("swift nen-trong.swift <ảnh> <ra.png>"); exit(2) }
let req = VNGenerateForegroundInstanceMaskRequest()
let h = VNImageRequestHandler(ciImage: goc)
try h.perform([req])
guard let kq = req.results?.first else { print("✗ không thấy chủ thể"); exit(1) }
let buf = try kq.generateMaskedImage(ofInstances: kq.allInstances, from: h, croppedToInstancesExtent: true)
let im = CIImage(cvPixelBuffer: buf)
try CIContext().writePNGRepresentation(of: im, to: URL(fileURLWithPath: a[2]), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
print("✓ \(a[2]) \(Int(im.extent.width))x\(Int(im.extent.height))")

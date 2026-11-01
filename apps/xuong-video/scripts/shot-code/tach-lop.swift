// TÁCH LỚP keyframe cho shot code cắt giấy (01/11/2026): Vision của macOS (VNGenerateForegroundInstanceMaskRequest, cùng máy "nhấc chủ thể" của Ảnh) — 0đ, chạy cục bộ iMac.
//   swift tach-lop.swift <ảnh.jpg> <thư-mục-ra> [<nền-sạch.jpg>] [--vung x,y,w,h]
// --vung: chỉ nhấc chủ thể trong một vùng của ảnh (con vật / đạo cụ nhỏ cả khung không nhận ra) — ra lop-*.png + lop.json, toạ độ theo ảnh gốc, không ra nền.
// Ra: lop-<i>.png (từng chủ thể, nền trong, cắt sát khung) · lop.json [{i,x,y,w,h}] theo pixel ảnh gốc · nen.jpg: có nền sạch (xoa-nguoi.mts) thì là nó
// + con-lai.png (người không tách được, đứng yên); không có thì keyframe vá chỗ chủ thể bằng màu xung quanh (dịch nhẹ được, đi xa lộ vệt).
import Foundation
import Vision
import CoreImage
import CoreImage.CIFilterBuiltins
import ImageIO
import UniformTypeIdentifiers

var a = CommandLine.arguments
var vung: [Int]? = nil
if let iv = a.firstIndex(of: "--vung"), iv + 1 < a.count { vung = a[iv + 1].split(separator: ",").compactMap { Int($0) }; a.removeSubrange(iv...iv + 1) }
guard a.count == 3 || a.count == 4, vung == nil || vung!.count == 4 else { print("swift tach-lop.swift <ảnh> <thư-mục-ra> [<nền-sạch>] [--vung x,y,w,h]"); exit(2) }
let vao = URL(fileURLWithPath: a[1]), ra = URL(fileURLWithPath: a[2], isDirectory: true)
try FileManager.default.createDirectory(at: ra, withIntermediateDirectories: true)
let ctx = CIContext()
guard let anh = CIImage(contentsOf: vao) else { print("không đọc được ảnh"); exit(1) }
// vùng (toạ độ trên-xuống) → cắt rồi dời về gốc; mọi toạ độ ra cộng lại (dx, dy)
let (goc, dx, dy): (CIImage, Int, Int) = {
  guard let v = vung else { return (anh, 0, 0) }
  let r = CGRect(x: v[0], y: Int(anh.extent.height) - v[1] - v[3], width: v[2], height: v[3])
  return (anh.cropped(to: r).transformed(by: CGAffineTransform(translationX: -r.minX, y: -r.minY)), v[0], v[1])
}()
let H = goc.extent.height

func ghi(_ im: CIImage, _ ten: String, png: Bool) throws {
  let url = ra.appendingPathComponent(ten)
  if png { try ctx.writePNGRepresentation(of: im, to: url, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!) }
  else { try ctx.writeJPEGRepresentation(of: im, to: url, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.9]) }
}

let req = VNGenerateForegroundInstanceMaskRequest()
let h = VNImageRequestHandler(ciImage: goc)
try h.perform([req])
guard let kq = req.results?.first else { try ghi(goc, "nen.jpg", png: false); try "[]".write(to: ra.appendingPathComponent("lop.json"), atomically: true, encoding: .utf8); print("0 lớp"); exit(0) }

var ds: [[String: Int]] = []
for (i, inst) in kq.allInstances.enumerated() {
  let m = try kq.generateScaledMaskForImage(forInstances: [inst], from: h)
  let mat = CIImage(cvPixelBuffer: m)
  let cat = goc.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: CIImage.empty(), kCIInputMaskImageKey: mat])
  // khung sát chủ thể: đọc alpha qua CIAreaMinMax không có sẵn cho bbox → quét bản thu nhỏ
  let nho = mat.transformed(by: CGAffineTransform(scaleX: 0.25, y: 0.25))
  let w = Int(nho.extent.width), hh = Int(nho.extent.height)
  var px = [UInt8](repeating: 0, count: w * hh)
  ctx.render(nho, toBitmap: &px, rowBytes: w, bounds: nho.extent, format: .L8, colorSpace: nil)
  var x0 = w, y0 = hh, x1 = 0, y1 = 0
  for y in 0..<hh { for x in 0..<w where px[y * w + x] > 20 { x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y) } }
  if x1 <= x0 { continue }
  // render toBitmap lật trục y so với CIImage (gốc dưới-trái) → y bitmap là từ trên xuống
  let pad = 4
  let r = CGRect(x: max(0, (x0 - pad) * 4), y: max(0, Int(H) - (y1 + pad + 1) * 4), width: (x1 - x0 + 2 * pad + 1) * 4, height: (y1 - y0 + 2 * pad + 1) * 4).intersection(goc.extent)
  try ghi(cat.cropped(to: r), "lop-\(i).png", png: true)
  ds.append(["i": i, "x": Int(r.minX) + dx, "y": Int(H - r.maxY) + dy, "w": Int(r.width), "h": Int(r.height)])
}
if vung != nil {
  try JSONSerialization.data(withJSONObject: ds, options: [.sortedKeys]).write(to: ra.appendingPathComponent("lop.json"))
  print("\(ds.count) lớp (vùng) → \(ra.path)"); exit(0)
}
// nền: vá chỗ mọi chủ thể đứng (nở rộng) bằng màu XUNG QUANH (nhoè chuẩn hoá: nhoè(ảnh·ngoài)/nhoè(ngoài)) — chủ thể đi xa không để lại bóng màu người.
// Hai bán kính: nhỏ giữ chi tiết mép lỗ, lớn lấp lòng lỗ rộng nơi bản nhỏ không có mẫu.
let mAll = CIImage(cvPixelBuffer: try kq.generateScaledMaskForImage(forInstances: kq.allInstances, from: h))
let no = mAll.applyingFilter("CIMorphologyMaximum", parameters: ["inputRadius": 14]).cropped(to: goc.extent)
let ngoai = no.applyingFilter("CIColorInvert")
let den = CIImage(color: .black).cropped(to: goc.extent)
let tu = goc.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: den, kCIInputMaskImageKey: ngoai])
func va(_ r: Double) -> (CIImage, CIImage) {
  let n = tu.clampedToExtent().applyingFilter("CIGaussianBlur", parameters: ["inputRadius": r]).cropped(to: goc.extent)
  let d = ngoai.clampedToExtent().applyingFilter("CIGaussianBlur", parameters: ["inputRadius": r]).cropped(to: goc.extent)
  return (d.applyingFilter("CIDivideBlendMode", parameters: [kCIInputBackgroundImageKey: n]), d)
}
let (vaNho, dNho) = va(24), (vaLon, _) = va(90)
// chỗ bản nhỏ đủ mẫu (mật độ > ~0,25) dùng bản nhỏ, còn lại bản lớn
let du = dNho.applyingFilter("CIColorMatrix", parameters: ["inputRVector": CIVector(x: 4, y: 0, z: 0, w: 0), "inputGVector": CIVector(x: 0, y: 4, z: 0, w: 0), "inputBVector": CIVector(x: 0, y: 0, z: 4, w: 0), "inputBiasVector": CIVector(x: -0.5, y: -0.5, z: -0.5, w: 0)]).applyingFilter("CIColorClamp")
let vaa = vaNho.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: vaLon, kCIInputMaskImageKey: du])
let mem = no.applyingFilter("CIGaussianBlur", parameters: ["inputRadius": 6]).cropped(to: goc.extent)
if a.count > 3, let sach = CIImage(contentsOf: URL(fileURLWithPath: a[3])) {
  // Có NỀN SẠCH (xoa-nguoi.mts đã xoá người): nền = ảnh sạch; người model xoá mà Vision không tách (đứng xa, lẫn đám đông) giữ lại thành
  // con-lai.png đứng yên — không thì họ biến mất khỏi shot. Mặt nạ = chỗ ảnh gốc khác ảnh sạch, trừ vùng các lớp đã tách.
  let s = sach.transformed(by: CGAffineTransform(scaleX: goc.extent.width / sach.extent.width, y: goc.extent.height / sach.extent.height))
  try ghi(s, "nen.jpg", png: false)
  let lech = goc.applyingFilter("CIDifferenceBlendMode", parameters: [kCIInputBackgroundImageKey: s])
    .applyingFilter("CIMaximumComponent").applyingFilter("CIGaussianBlur", parameters: ["inputRadius": 3]).cropped(to: goc.extent)
    .applyingFilter("CIColorMatrix", parameters: ["inputRVector": CIVector(x: 9, y: 0, z: 0, w: 0), "inputGVector": CIVector(x: 9, y: 0, z: 0, w: 0), "inputBVector": CIVector(x: 9, y: 0, z: 0, w: 0), "inputBiasVector": CIVector(x: -0.9, y: -0.9, z: -0.9, w: 0)])
    .applyingFilter("CIColorClamp").applyingFilter("CIMorphologyMinimum", parameters: ["inputRadius": 3]).applyingFilter("CIMorphologyMaximum", parameters: ["inputRadius": 6])
    .applyingFilter("CIGaussianBlur", parameters: ["inputRadius": 2]).cropped(to: goc.extent)
  let trongLop = mAll.applyingFilter("CIMorphologyMaximum", parameters: ["inputRadius": 8]).applyingFilter("CIColorInvert").cropped(to: goc.extent)
  let m = lech.applyingFilter("CIMultiplyCompositing", parameters: [kCIInputBackgroundImageKey: trongLop])
  try ghi(goc.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: CIImage.empty(), kCIInputMaskImageKey: m]).cropped(to: goc.extent), "con-lai.png", png: true)
} else {
  try ghi(vaa.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: goc, kCIInputMaskImageKey: mem]).cropped(to: goc.extent), "nen.jpg", png: false)
}
let js = try JSONSerialization.data(withJSONObject: ds, options: [.sortedKeys])
try js.write(to: ra.appendingPathComponent("lop.json"))
print("\(ds.count) lớp → \(ra.path)")

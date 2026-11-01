// ĐO HƯỚNG MẶT của ảnh dáng (02/11/2026, anh: "nhân vật phải nhìn về mục tiêu"): Vision VNDetectFaceRectanglesRequest → yaw (radian) của mặt lớn nhất.
//   swift huong-mat.swift <ảnh.png> …   → mỗi dòng: <tệp> <yaw> (yaw dương / âm = quay về một phía; kho-huong.mjs hiệu chỉnh dấu bằng dáng chi_tay)
import Foundation
import Vision
import CoreImage
for f in CommandLine.arguments.dropFirst() {
  guard let im = CIImage(contentsOf: URL(fileURLWithPath: f)) else { print("\(f) nil"); continue }
  let r = VNDetectFaceRectanglesRequest(); r.revision = VNDetectFaceRectanglesRequestRevision3
  try? VNImageRequestHandler(ciImage: im).perform([r])
  let m = (r.results ?? []).max { $0.boundingBox.width < $1.boundingBox.width }
  print("\(f) \(m?.yaw?.doubleValue ?? .nan)")
}

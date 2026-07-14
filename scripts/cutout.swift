import Foundation
import Vision
import CoreImage
import AppKit

// Subject lift + PROPER matting decontamination.
//
// v1 assumed the backdrop was black and just unpremultiplied (RGB/a), which BRIGHTENS boundary
// pixels. On a pale backdrop that manufactures a white fringe — worst on thin geometry (fingers,
// cloth strands) where a shape is mostly boundary. This solves the real matting equation instead:
//
//     C = a*F + (1-a)*B     ->     F = (C - (1-a)*B) / a
//
// B is estimated as a SPATIALLY VARYING field (normalized convolution of the background), so a
// split backdrop — white on top, black below — is handled correctly per-pixel.

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: cutout2 <in> <out>"); exit(1) }
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])

let ctx = CIContext(options: [.workingColorSpace: NSNull()])
guard let src = CIImage(contentsOf: inURL) else { print("bad input"); exit(1) }
let ext = src.extent
let W = Int(ext.width), H = Int(ext.height)

// 1. Vision subject mask
let handler = VNImageRequestHandler(ciImage: src, options: [:])
let req = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([req])
guard let obs = req.results?.first else { print("no subject"); exit(2) }
let maskPB = try obs.generateScaledMaskForImage(forInstances: obs.allInstances, from: handler)
let maskCI = CIImage(cvPixelBuffer: maskPB)

func bitmap(_ img: CIImage) -> [Float] {
  var buf = [UInt8](repeating: 0, count: W * H * 4)
  ctx.render(img, toBitmap: &buf, rowBytes: W * 4, bounds: ext,
             format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
  return buf.map { Float($0) / 255.0 }
}

let C = bitmap(src)                 // source RGBA
let M = bitmap(maskCI)              // mask (grey; use R)
var a = [Float](repeating: 0, count: W * H)
for i in 0..<(W * H) { a[i] = M[i * 4] }

// 2. Background estimate B: normalized convolution of the BACKGROUND only, so its colour is
//    extended inward under the subject's edge. Separable box blur, weight = (1 - a).
func boxBlur(_ v: inout [Float], _ w: inout [Float], radius: Int, channels: Int) {
  // horizontal then vertical, on premultiplied value + weight
  for _ in 0..<2 {
    var outV = v, outW = w
    for y in 0..<H {
      for x in 0..<W {
        var sv = [Float](repeating: 0, count: channels); var sw: Float = 0
        for d in -radius...radius {
          let xx = min(max(x + d, 0), W - 1)
          let j = y * W + xx
          for c in 0..<channels { sv[c] += v[j * channels + c] }
          sw += w[j]
        }
        let i = y * W + x
        for c in 0..<channels { outV[i * channels + c] = sv[c] }
        outW[i] = sw
      }
    }
    v = outV; w = outW
    // transpose roles by doing the vertical pass next
    outV = v; outW = w
    for y in 0..<H {
      for x in 0..<W {
        var sv = [Float](repeating: 0, count: channels); var sw: Float = 0
        for d in -radius...radius {
          let yy = min(max(y + d, 0), H - 1)
          let j = yy * W + x
          for c in 0..<channels { sv[c] += v[j * channels + c] }
          sw += w[j]
        }
        let i = y * W + x
        for c in 0..<channels { outV[i * channels + c] = sv[c] }
        outW[i] = sw
      }
    }
    v = outV; w = outW
    break
  }
}

var bgVal = [Float](repeating: 0, count: W * H * 3)
var bgW = [Float](repeating: 0, count: W * H)
for i in 0..<(W * H) {
  let wgt = 1.0 - a[i]
  bgW[i] = wgt
  for c in 0..<3 { bgVal[i * 3 + c] = C[i * 4 + c] * wgt }
}
boxBlur(&bgVal, &bgW, radius: 18, channels: 3)

var B = [Float](repeating: 0, count: W * H * 3)
for i in 0..<(W * H) {
  let wgt = max(bgW[i], 1e-4)
  for c in 0..<3 { B[i * 3 + c] = bgVal[i * 3 + c] / wgt }
}

// 3. Kill background-coloured pixels the mask wrongly swallowed (thin fingers / cloth strands).
//    ONLY where the local background is BRIGHT — otherwise this would eat the night Wretch's black
//    plates where they legitimately sit against a black backdrop.
func smoothstep(_ e0: Float, _ e1: Float, _ x: Float) -> Float {
  let t = min(max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t)
}

var out = [UInt8](repeating: 0, count: W * H * 4)
for i in 0..<(W * H) {
  let bR = B[i*3], bG = B[i*3+1], bB = B[i*3+2]
  let bLum = 0.2126*bR + 0.7152*bG + 0.0722*bB
  let cR = C[i*4], cG = C[i*4+1], cB = C[i*4+2]

  var alpha = a[i]
  if bLum > 0.45 {
    let dist = sqrt((cR-bR)*(cR-bR) + (cG-bG)*(cG-bG) + (cB-bB)*(cB-bB))
    alpha *= smoothstep(0.05, 0.22, dist)
  }

  // ENCLOSED background pockets (gaps between limbs the mask filled in solid). The estimate above
  // is blind to them — a fully-surrounded hole has no background samples within the blur radius —
  // so key them globally. Safe because the creature is charcoal and saturated ember: it contains
  // no bright DESATURATED colour anywhere, which is exactly what a white pocket is.
  //
  //    Thresholds are not eyeballed — they come from the sprite's own histogram. Every bright pixel
  //    in the art is SATURATED (ember); the only bright DESATURATED pixels are the leaked pockets,
  //    and they sit in an isolated cluster with a wide empty gap beneath them. Keying anywhere in
  //    that gap removes the leak and cannot touch the creature.
  let cLum = 0.2126*cR + 0.7152*cG + 0.0722*cB
  let cMax = max(cR, max(cG, cB)), cMin = min(cR, min(cG, cB))
  let sat = cMax > 0 ? (cMax - cMin) / cMax : 0
  if cLum > 0.72 && sat < 0.21 {
    alpha *= 1 - smoothstep(0.72, 0.82, cLum)
  }

  if alpha <= 0.004 { continue }  // fully transparent; leave zeroed

  // F = (C - (1-a)B) / a
  let inv = 1 - alpha
  let fR = min(max((cR - inv*bR) / alpha, 0), 1)
  let fG = min(max((cG - inv*bG) / alpha, 0), 1)
  let fB = min(max((cB - inv*bB) / alpha, 0), 1)

  out[i*4]   = UInt8(fR * 255)
  out[i*4+1] = UInt8(fG * 255)
  out[i*4+2] = UInt8(fB * 255)
  out[i*4+3] = UInt8(min(max(alpha, 0), 1) * 255)
}

// 3.5 DETACHED-ISLAND CLEANUP. Vision occasionally annexes a patch of the original image's baked
//     ground-shadow near the feet — a mid-grey blob that's neither near-white (so the pocket key
//     misses it) nor adjacent to a bright background (so the colour key misses it). But it is
//     physically DETACHED from the creature. So label the opaque connected components and keep only
//     the substantial ones: anything under 1.5% of the largest island is mask spill, not anatomy.
//     Purely topological — no per-image thresholds — so it generalises to the whole roster.
do {
  let n = W * H
  var label = [Int32](repeating: -1, count: n)
  var sizes: [Int] = []
  var stack = [Int]()
  stack.reserveCapacity(4096)
  for start in 0..<n where out[start*4 + 3] > 40 && label[start] == -1 {
    let id = Int32(sizes.count)
    var count = 0
    stack.removeAll(keepingCapacity: true)
    stack.append(start)
    label[start] = id
    while let p = stack.popLast() {
      count += 1
      let px = p % W, py = p / W
      for (dx, dy) in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,-1),(-1,1),(1,1)] {
        let nx = px + dx, ny = py + dy
        guard nx >= 0, nx < W, ny >= 0, ny < H else { continue }
        let q = ny * W + nx
        if out[q*4 + 3] > 40 && label[q] == -1 { label[q] = id; stack.append(q) }
      }
    }
    sizes.append(count)
  }
  if let biggest = sizes.max() {
    let keep = Int(Double(biggest) * 0.015)
    for i in 0..<n {
      let l = label[i]
      if l >= 0 && sizes[Int(l)] < keep {
        out[i*4] = 0; out[i*4+1] = 0; out[i*4+2] = 0; out[i*4+3] = 0
      }
    }
  }
}

// 4. TRIM to the alpha bounding box. Midjourney hands back a 1024² canvas with the creature
//    floating somewhere inside it, so a sprite anchored "bottom" still hangs above its own feet —
//    which is exactly what made the day Wretch look like it was levitating over its contact shadow.
//    Trimming makes the sprite's bottom edge BE the creature's lowest point, so the shadow lands
//    under its feet automatically, for every asset, with no per-creature nudging.
let ALPHA_FLOOR: UInt8 = 8
var minX = W, minY = H, maxX = -1, maxY = -1
for y in 0..<H {
  for x in 0..<W where out[(y*W + x)*4 + 3] > ALPHA_FLOOR {
    if x < minX { minX = x }; if x > maxX { maxX = x }
    if y < minY { minY = y }; if y > maxY { maxY = y }
  }
}
guard maxX >= minX, maxY >= minY else { print("empty cutout"); exit(3) }
let tW = maxX - minX + 1, tH = maxY - minY + 1

var trimmed = [UInt8](repeating: 0, count: tW * tH * 4)
for y in 0..<tH {
  for x in 0..<tW {
    let s = ((y + minY)*W + (x + minX)) * 4
    let d = (y*tW + x) * 4
    for c in 0..<4 { trimmed[d + c] = out[s + c] }
  }
}

// 5. GROUND CONTACTS — find the columns where a limb actually reaches the ground, and report their
//    LEFT and RIGHT edges independently.
//
//    NOT a centre and a width. A creature's ground contacts are not centred on its body: the Alley
//    Cur plants its back paws far left and its front paws right, while a tail and a head jut out at
//    different distances and never touch anything. Any symmetric "centre ± width" pool must
//    overshoot one side to reach the other. So measure the two edges separately and let the pool be
//    asymmetric, exactly like the creature is.
//
//    A column counts as a contact if its lowest opaque pixel lands in the bottom quarter of the
//    sprite. That admits a quadruped's raised back feet, and correctly EXCLUDES a tail held in the
//    air — which should cast nothing, because it touches nothing.
var contactCols: [(x: Int, bottom: Int)] = []
for x in 0..<tW {
  var bottom = -1
  for y in stride(from: tH - 1, through: 0, by: -1) where trimmed[(y*tW + x)*4 + 3] > 64 {
    bottom = y; break
  }
  if bottom >= tH - tH / 4 { contactCols.append((x, bottom)) }
}

var footL = 0.25, footR = 0.75, stanceDepth = 0.12
if contactCols.count > 4 {
  footL = Double(contactCols.map { $0.x }.min()!) / Double(tW)
  footR = Double(contactCols.map { $0.x }.max()! + 1) / Double(tW)

  // 6. STANCE DEPTH — how far UP the sprite those contacts reach. A quadruped's back feet are
  //    further away, so in a 2D image they sit HIGHER than its front paws; a mid-stride biped lifts
  //    one foot the same way. A pool pinned flat to the bottom edge cannot reach them.
  var bottoms = contactCols.map { $0.bottom }.sorted()
  let lo = bottoms[bottoms.count / 10]          // highest contact  (back foot)
  let hi = bottoms[bottoms.count * 9 / 10]      // lowest contact   (front foot)
  stanceDepth = max(0.08, Double(hi - lo) / Double(tH))
}

let cs = CGColorSpaceCreateDeviceRGB()
let provider = CGDataProvider(data: Data(trimmed) as CFData)!
let cg = CGImage(width: tW, height: tH, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: tW*4,
                 space: cs, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue),
                 provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
let rep = NSBitmapImageRep(cgImage: cg)
try rep.representation(using: .png, properties: [:])!.write(to: outURL)

// Framing metadata for the registry — emitted, not eyeballed.
print(String(format: """
{"file":"%@","w":%d,"h":%d,"aspect":%.3f,"footLeft":%.3f,"footRight":%.3f,"stanceDepth":%.3f}
""", outURL.lastPathComponent, tW, tH, Double(tW)/Double(tH), footL, footR, stanceDepth))

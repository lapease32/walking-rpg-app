import Foundation
import Vision
import CoreImage
import AppKit

// Subject lift + matting decontamination + colour-match pocket key + optional brightness ceiling.
//   C = a*F + (1-a)*B   ->   F = (C - (1-a)*B) / a   (B = spatially-varying background estimate)

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: cutout2 <in> <out> [key=val ...]  (maxLum, despeckle, fill)"); exit(1) }
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])

// Named per-asset params: `maxLum=0.84 despeckle=0.78 fill=0`.
var opts: [String: String] = [:]
for a in args.dropFirst(3) {
  let kv = a.split(separator: "=", maxSplits: 1)
  if kv.count == 2 { opts[String(kv[0])] = String(kv[1]) }
}
// Brightness ceiling: remove pixels brighter than this luminance. OFF by default (1.0). Only for an
// asset whose junk is provably brighter than every creature pixel.
let maxLum = Float(opts["maxLum"] ?? "") ?? 1.0
// Despeckle: remove small isolated BRIGHT islands (specks) above this luminance, keep large bright
// regions. OFF by default (1.0).
let despeckleLum = Float(opts["despeckle"] ?? "") ?? 1.0
// Fill enclosed holes: 1 for SOLID creatures (fill crack/crevice holes), 0 for OPEN/fuzzy creatures
// (tree branches, smoke, swarm — their enclosed transparency is legitimate). Default 1.
let fillHoles = (opts["fill"] ?? "1") != "0"
// bgguard=1: while filling, DON'T fill gaps whose source is the bright backdrop — for a MIXED
// creature (solid body + an OPEN sub-structure, e.g. the golem's back vegetation) whose frond gaps
// are real see-through. OFF for a pure-solid creature (a light crevice ≈ the bright day background,
// so the guard would wrongly leave it a hole). Default off.
let bgGuard = (opts["bgguard"] ?? "0") == "1"
// whitekey=T: FINAL pass — remove opaque pixels whose colour is within distance T of the sampled
// bright-corner backdrop. Catches near-white spill the tight edge band missed and any the fill
// re-added. Only safe when the creature's brightest pixels are clearly NOT near-white (grey bone).
// OFF by default (-1). Typical T ~0.10–0.16 for a white day backdrop.
let whiteKey = Float(opts["whitekey"] ?? "") ?? -1
// shadow=S: KEEP the source's cast shadow (day art on a bright ground) as a semi-transparent BLURRED
// dark shape instead of cutting it off (section 3.9). dropshadow=S: a CLEAN synthetic shadow projected
// from the creature's OWN silhouette, no AI-shadow dependency (section 3.9b). Both 0 = off (default).
let shadowStrength = Float(opts["shadow"] ?? "") ?? 0
let dropShadow = Float(opts["dropshadow"] ?? "") ?? 0

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

// The BRIGHT background colour, from the brightest of the four corners (always pure backdrop). Used
// to key ENCLOSED background pockets by COLOUR. The brightest corner — not the average — because a
// split backdrop (white-on-black, as Midjourney sometimes returns) averages to a grey that matches
// neither band; the white pockets need the white.
var bg = (r: Float(0), g: Float(0), b: Float(0)); do {
  let s = 20
  var best: Float = -1
  for (cx, cy) in [(0, 0), (W - s, 0), (0, H - s), (W - s, H - s)] {
    var r: Float = 0, g: Float = 0, b: Float = 0
    for yy in cy..<(cy + s) { for xx in cx..<(cx + s) {
      let i = (yy * W + xx) * 4
      r += C[i]; g += C[i + 1]; b += C[i + 2]
    } }
    let n = Float(s * s); r /= n; g /= n; b /= n
    let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if lum > best { best = lum; bg = (r, g, b) }
  }
}
let bgLum = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b

func smoothstep(_ e0: Float, _ e1: Float, _ x: Float) -> Float {
  let t = min(max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t)
}

var out = [UInt8](repeating: 0, count: W * H * 4)
for i in 0..<(W * H) {
  let bR = B[i*3], bG = B[i*3+1], bB = B[i*3+2]
  let bLumLocal = 0.2126*bR + 0.7152*bG + 0.0722*bB
  let cR = C[i*4], cG = C[i*4+1], cB = C[i*4+2]

  var alpha = a[i]

  // 3a. Thin-geometry fringe: decontaminate boundary pixels against the LOCAL background, only where
  //     that local background is bright (a black backdrop must keep near-black creature pixels).
  if bLumLocal > 0.45 {
    let dist = sqrt((cR-bR)*(cR-bR) + (cG-bG)*(cG-bG) + (cB-bB)*(cB-bB))
    alpha *= smoothstep(0.05, 0.22, dist)
  }

  // 3b. ENCLOSED background pockets the mask filled in solid — keyed by COLOUR-MATCH to the sampled
  //     backdrop, NOT by "bright + desaturated" (that ate a creature's pale low-sat parts: light
  //     vermin, bone, pale metal). Tight band: measured histograms show true backdrop within ~0.02
  //     of the sampled colour and a creature's palest parts starting at ~0.03+. Bright backdrop only.
  if bgLum > 0.45 {
    let dr = cR - bg.r, dg = cG - bg.g, db = cB - bg.b
    let d = sqrt(dr * dr + dg * dg + db * db)
    alpha *= smoothstep(0.018, 0.032, d)
  }

  // 3c. Per-asset brightness ceiling (opt-in) — nuke near-white specks brighter than any creature px.
  if maxLum < 0.999 {
    let cLum = 0.2126 * cR + 0.7152 * cG + 0.0722 * cB
    alpha *= 1 - smoothstep(maxLum - 0.03, maxLum + 0.02, cLum)
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

// 3.5 DETACHED-ISLAND CLEANUP. Drop mask spill (a baked ground-shadow chunk near the feet) under
//     1.5% of the largest opaque island. Purely topological.
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

// 3.6 DESPECKLE (opt-in) — remove small BRIGHT islands (specks) but keep large bright regions.
//     A bright pixel is JUNK if it belongs to a tiny isolated bright blob, a FEATURE if it belongs
//     to a large one (belly, pale fur). Answers "keep the creature's own bright pixels, drop the
//     stray specks" by the geometry of the bright region — not by brightness, which alone eats
//     pale creatures.
if despeckleLum < 0.999 {
  let n = W * H
  var seen = [Bool](repeating: false, count: n)
  var stack = [Int](); stack.reserveCapacity(2048)
  func bright(_ p: Int) -> Bool {
    guard out[p*4 + 3] > 40 else { return false }
    let l = 0.2126*Float(out[p*4])/255 + 0.7152*Float(out[p*4+1])/255 + 0.0722*Float(out[p*4+2])/255
    return l > despeckleLum
  }
  let maxIsland = max(200, n / 2000) // islands smaller than this are specks, not features
  for start in 0..<n where bright(start) && !seen[start] {
    var comp = [Int](); stack.removeAll(keepingCapacity: true); stack.append(start); seen[start] = true
    while let p = stack.popLast() {
      comp.append(p)
      let px = p % W, py = p / W
      for (dx, dy) in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,-1),(-1,1),(1,1)] {
        let nx = px + dx, ny = py + dy
        guard nx >= 0, nx < W, ny >= 0, ny < H else { continue }
        let q = ny * W + nx
        if bright(q) && !seen[q] { seen[q] = true; stack.append(q) }
      }
    }
    if comp.count < maxIsland {
      for p in comp { out[p*4] = 0; out[p*4+1] = 0; out[p*4+2] = 0; out[p*4+3] = 0 }
    }
  }
}

// 3.7 FILL ENCLOSED HOLES (SOLID creatures only; `fill=0` to disable). A transparent region NOT
//     connected to the border is not real background — it's a cutout crack (hairline gaps the cut
//     punched through a creature's dark crevices: rock seams, plate gaps, matted fur). Flood-fill
//     transparency from the border; any transparent pixel it can't reach is enclosed → restore the
//     SOURCE colour there. OFF for OPEN creatures (tree branches, smoke, a vermin swarm) whose
//     enclosed transparency is legitimate see-through, not a crack.
if fillHoles {
  // A SOLID creature has ONE outer silhouette and NO legitimate interior transparency, so every hole
  // or crack — even one joined to the border by a hairline channel — is a cutout error. Find the TRUE
  // exterior by a morphological OPEN of the background (erode by r, flood from the border, dilate back
  // by r): channels narrower than 2r are severed and never reached, so they fill; concavities wider
  // than 2r survive. The only knob is CRACK WIDTH (2r px), not a guessed threshold.
  let n = W * H, r = 3
  var transp = [Bool](repeating: false, count: n)          // transparent (candidate background)
  for i in 0..<n { transp[i] = out[i*4 + 3] < 40 }

  // erode transparency: a pixel stays background only if its whole r-disc is transparent (severs thin channels)
  var transpE = [Bool](repeating: false, count: n)
  for y in 0..<H { for x in 0..<W {
    var all = true
    erode: for dy in -r...r { for dx in -r...r {
      let xx = min(max(x+dx, 0), W-1), yy = min(max(y+dy, 0), H-1)
      if !transp[yy*W + xx] { all = false; break erode }
    } }
    transpE[y*W + x] = all
  } }

  // flood the eroded background from the border → reachable exterior
  var ext = [Bool](repeating: false, count: n)
  var q = [Int](); q.reserveCapacity(4096)
  func seed(_ p: Int) { if transpE[p] && !ext[p] { ext[p] = true; q.append(p) } }
  for x in 0..<W { seed(x); seed((H-1)*W + x) }
  for y in 0..<H { seed(y*W); seed(y*W + W - 1) }
  var qi = 0
  while qi < q.count {
    let p = q[qi]; qi += 1
    let px = p % W, py = p / W
    for (dx, dy) in [(-1,0),(1,0),(0,-1),(0,1)] {
      let nx = px + dx, ny = py + dy
      guard nx >= 0, nx < W, ny >= 0, ny < H else { continue }
      seed(ny*W + nx)
    }
  }

  // dilate the exterior back by r → true background boundary
  var trueBg = [Bool](repeating: false, count: n)
  for y in 0..<H { for x in 0..<W where ext[y*W + x] {
    for dy in -r...r { for dx in -r...r {
      let xx = min(max(x+dx, 0), W-1), yy = min(max(y+dy, 0), H-1)
      trueBg[yy*W + xx] = true
    } }
  } }

  // Everything transparent that is NOT true exterior is an interior hole/crack → restore source —
  // UNLESS its source colour is the BRIGHT backdrop. That means the gap is a see-through opening in
  // an OPEN sub-structure (the gaps between a golem's back-vegetation fronds), not a crevice in solid
  // matter; filling it would paint a background-coloured spot. So a mixed creature (solid body + open
  // vegetation) fills its rock cracks but keeps its frond gaps transparent.
  for p in 0..<n where out[p*4 + 3] < 40 && !trueBg[p] {
    if bgGuard && bgLum > 0.45 {
      let dr = C[p*4] - bg.r, dg = C[p*4+1] - bg.g, db = C[p*4+2] - bg.b
      if sqrt(dr*dr + dg*dg + db*db) < 0.18 { continue } // background-coloured gap → keep see-through
    }
    out[p*4]   = UInt8(min(max(C[p*4], 0), 1) * 255)
    out[p*4+1] = UInt8(min(max(C[p*4+1], 0), 1) * 255)
    out[p*4+2] = UInt8(min(max(C[p*4+2], 0), 1) * 255)
    out[p*4+3] = 255
  }
}

// 3.8 FINAL BACKDROP-COLOUR KEY (opt-in, UNGATED) — remove opaque pixels whose (decontaminated) colour
//     sits within `whiteKey` of the sampled backdrop. On a bright/white backdrop this is the white-spill
//     remover; on a GRAY backdrop it removes mask-included backdrop pixels the (bright-only) colour key
//     skipped. Soft 0.04 band feathers the edge. Safe ONLY when the creature's colours are clearly
//     separated from the backdrop (a dark creature on dark-gray is NOT — keying shreds it); measure T.
if whiteKey > 0 {
  for p in 0..<(W * H) where out[p*4 + 3] > 0 {
    let dr = Float(out[p*4])/255 - bg.r, dg = Float(out[p*4+1])/255 - bg.g, db = Float(out[p*4+2])/255 - bg.b
    let d = sqrt(dr*dr + dg*dg + db*db)
    let keep = smoothstep(whiteKey, whiteKey + 0.04, d) // d<whiteKey → 0 (remove), farther → keep
    out[p*4 + 3] = UInt8(Float(out[p*4 + 3]) * keep)
  }
}

// 3.9 KEEP-SHADOW (opt-in, day art). Turn the source's cast shadow into a semi-transparent dark shape:
//     for still-transparent (background) pixels, alpha = how much DARKER the source is than the clean
//     bright backdrop, DIFFUSEd (blurred) so the AI's streaky painted shadow reads as a soft pool rather
//     than a "film-burn". Colour = neutral warm-dark; multiplies the (bone) stage into a shadow.
//     (NOTE: Vision often keeps PART of the shadow opaque → green remnants + a light edge fringe the
//     user hand-cleans; that's why the project settled on user manual day-shadow passes.)
if shadowStrength > 0 && bgLum > 0.25 {
  let eps: Float = 0.05
  var sa = [Float](repeating: 0, count: W * H)
  for p in 0..<(W * H) where out[p*4 + 3] < 40 {
    let lum = 0.2126*C[p*4] + 0.7152*C[p*4+1] + 0.0722*C[p*4+2]
    let dd = (bgLum - lum) / max(bgLum, 0.001)
    if dd > eps { sa[p] = dd - eps }
  }
  let r = max(7, H / 70)
  var tmp = [Float](repeating: 0, count: W * H)
  for y in 0..<H { for x in 0..<W { var s: Float = 0; for k in -r...r { s += sa[y*W + min(max(x+k,0),W-1)] }; tmp[y*W+x] = s/Float(2*r+1) } }
  for y in 0..<H { for x in 0..<W { var s: Float = 0; for k in -r...r { s += tmp[min(max(y+k,0),H-1)*W + x] }; sa[y*W+x] = s/Float(2*r+1) } }
  let maxA: Float = 0.5, gain = shadowStrength * 1.4
  for p in 0..<(W * H) where out[p*4 + 3] < 40 && sa[p] > 0.003 {
    let a = min(sa[p] * gain, maxA)
    out[p*4] = 18; out[p*4+1] = 16; out[p*4+2] = 14
    out[p*4+3] = UInt8(max(0, min(1, a)) * 255)
  }
}

// 3.9b DROP-SHADOW (opt-in) — a CLEAN synthetic ground shadow projected from the creature's OWN
//      silhouette (no dependency on the AI's painted shadow). Squash the alpha flat onto the ground +
//      shear for light direction + blur → a soft semi-transparent pool matching the real shape. (PARKED:
//      the project chose to keep the AI's painted shadow via user manual passes instead.)
if dropShadow > 0 {
  var baseline = 0
  for y in 0..<H { for x in 0..<W where out[(y*W + x)*4 + 3] > 128 { baseline = max(baseline, y) } }
  let squash: Float = 0.17, shear: Float = 0.20
  var sa = [Float](repeating: 0, count: W * H)
  for cy in 0..<H { for cx in 0..<W {
    let a = Float(out[(cy*W + cx)*4 + 3]) / 255
    if a < 0.05 { continue }
    let h = Float(baseline - cy); if h < 0 { continue }
    let sy = baseline - Int(h * squash), sx = cx + Int(h * shear)
    if sy >= 0 && sy < H && sx >= 0 && sx < W { let i = sy*W + sx; if a > sa[i] { sa[i] = a } }
  } }
  let r = max(6, H / 55)
  var tmp = [Float](repeating: 0, count: W * H)
  for y in 0..<H { for x in 0..<W { var s: Float = 0; for k in -r...r { s += sa[y*W + min(max(x+k,0),W-1)] }; tmp[y*W+x] = s/Float(2*r+1) } }
  for y in 0..<H { for x in 0..<W { var s: Float = 0; for k in -r...r { s += tmp[min(max(y+k,0),H-1)*W + x] }; sa[y*W+x] = s/Float(2*r+1) } }
  let maxA: Float = 0.5, gain = dropShadow * 1.6
  for p in 0..<(W * H) where out[p*4 + 3] < 40 && sa[p] > 0.004 {
    let a = min(sa[p] * gain, maxA)
    out[p*4] = 18; out[p*4+1] = 16; out[p*4+2] = 14
    out[p*4+3] = UInt8(min(1, max(0, a)) * 255)
  }
}

// 4. TRIM to the alpha bounding box (sprite bottom edge == creature's lowest point).
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

// 5. GROUND CONTACTS — leftmost/rightmost columns reaching the bottom quarter, independently.
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
  var bottoms = contactCols.map { $0.bottom }.sorted()
  let lo = bottoms[bottoms.count / 10]
  let hi = bottoms[bottoms.count * 9 / 10]
  stanceDepth = max(0.08, Double(hi - lo) / Double(tH))
}

let cs = CGColorSpaceCreateDeviceRGB()
let provider = CGDataProvider(data: Data(trimmed) as CFData)!
let cg = CGImage(width: tW, height: tH, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: tW*4,
                 space: cs, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue),
                 provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
let rep = NSBitmapImageRep(cgImage: cg)
try rep.representation(using: .png, properties: [:])!.write(to: outURL)

// SELF-REPORTED QA METRICS — the cut states its own flaws so verification is a number, not a vibe.
//   holes    interior transparent px fully surrounded by opaque (a crack/hole; 0 for a solid cut)
//   leakPct  near-white opaque px as % of the creature (background spill; ~0 unless legit pale art)
//   crushPct near-black opaque px as % (info only; high is fine for a night creature)
func alphaT(_ x: Int, _ y: Int) -> Bool { (x<0||x>=tW||y<0||y>=tH) ? false : trimmed[(y*tW+x)*4+3] > 128 }
var holes = 0, kept = 0, whitePx = 0, blackPx = 0
for y in 0..<tH { for x in 0..<tW {
  let p = (y*tW + x) * 4
  if trimmed[p+3] < 40 {
    if alphaT(x-3,y) && alphaT(x+3,y) && alphaT(x,y-3) && alphaT(x,y+3) { holes += 1 }
  } else if trimmed[p+3] > 128 {
    kept += 1
    let lum = 0.2126*Double(trimmed[p]) + 0.7152*Double(trimmed[p+1]) + 0.0722*Double(trimmed[p+2])
    if lum > 217 { whitePx += 1 }
    if lum < 16 { blackPx += 1 }
  }
} }
let leakPct = kept > 0 ? 100.0 * Double(whitePx) / Double(kept) : 0
let crushPct = kept > 0 ? 100.0 * Double(blackPx) / Double(kept) : 0

print(String(format: """
{"file":"%@","w":%d,"h":%d,"aspect":%.3f,"footLeft":%.3f,"footRight":%.3f,"stanceDepth":%.3f,\
"holes":%d,"leakPct":%.2f,"crushPct":%.1f}
""", outURL.lastPathComponent, tW, tH, Double(tW)/Double(tH), footL, footR, stanceDepth,
     holes, leakPct, crushPct))

import Foundation
import CoreImage
import AppKit
// Trim a manually-cleaned FULL-CANVAS transparent export to its alpha bbox + emit framing. NO re-cut
// (Vision would re-process a finished cut). For adopting user Photopea exports (they export at 1024²).
let inU = URL(fileURLWithPath: CommandLine.arguments[1]); let outU = URL(fileURLWithPath: CommandLine.arguments[2])
let ctx = CIContext(options: [.workingColorSpace: NSNull()])
guard let src = CIImage(contentsOf: inU) else { print("bad input"); exit(1) }
let ext = src.extent; let W = Int(ext.width), H = Int(ext.height)
var buf = [UInt8](repeating: 0, count: W*H*4)
ctx.render(src, toBitmap: &buf, rowBytes: W*4, bounds: ext, format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
var minX=W,minY=H,maxX = -1,maxY = -1
for y in 0..<H { for x in 0..<W where buf[(y*W+x)*4+3] > 8 { if x<minX{minX=x};if x>maxX{maxX=x};if y<minY{minY=y};if y>maxY{maxY=y} } }
guard maxX>=minX else { print("empty"); exit(3) }
let tW=maxX-minX+1, tH=maxY-minY+1
var out=[UInt8](repeating:0,count:tW*tH*4)
for y in 0..<tH { for x in 0..<tW { let s=((y+minY)*W+(x+minX))*4, d=(y*tW+x)*4; for c in 0..<4 { out[d+c]=buf[s+c] } } }
// framing (ground contacts, alpha>64) — for shadow-kept sprites the feet values reflect the shadow spread
var contacts:[(x:Int,b:Int)]=[]
for x in 0..<tW { var b = -1; for y in stride(from:tH-1,through:0,by:-1) where out[(y*tW+x)*4+3]>64 { b=y; break }; if b >= tH - tH/4 { contacts.append((x,b)) } }
var fL=0.25,fR=0.75,st=0.12
if contacts.count>4 { fL=Double(contacts.map{$0.x}.min()!)/Double(tW); fR=Double(contacts.map{$0.x}.max()!+1)/Double(tW); let bs=contacts.map{$0.b}.sorted(); st=max(0.08,Double(bs[bs.count*9/10]-bs[bs.count/10])/Double(tH)) }
// creature horizontal center (opaque, alpha>200 = solid creature, excludes semi-transp shadow) → for centered placement
var cxMin=tW, cxMax = -1
for y in 0..<tH { for x in 0..<tW where out[(y*tW+x)*4+3]>200 { if x<cxMin{cxMin=x}; if x>cxMax{cxMax=x} } }
let creatureCenter = cxMax>=cxMin ? Double(cxMin+cxMax)/2/Double(tW) : 0.5
let cs=CGColorSpaceCreateDeviceRGB(); let prov=CGDataProvider(data:Data(out) as CFData)!
let cg=CGImage(width:tW,height:tH,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:tW*4,space:cs,bitmapInfo:CGBitmapInfo(rawValue:CGImageAlphaInfo.last.rawValue),provider:prov,decode:nil,shouldInterpolate:false,intent:.defaultIntent)!
try NSBitmapImageRep(cgImage:cg).representation(using:.png,properties:[:])!.write(to:outU)
print(String(format:"trimmed %dx%d  { aspect: %.3f, footLeft: %.3f, footRight: %.3f, stanceDepth: %.3f }  creatureCenterX: %.3f", tW, tH, Double(tW)/Double(tH), fL, fR, st, creatureCenter))

import AppKit
import WebKit

final class ScreenshotExporter: NSObject, WKNavigationDelegate {
    private let outputDirectory: URL
    private let width = 768
    private let height = 1663
    private var webView: WKWebView!
    private var nextScreenshot = 0
    private let names = [
        "01-check-in",
        "02-mates",
        "03-meet-ups",
        "04-shared-groups",
    ]

    init(outputDirectory: URL) {
        self.outputDirectory = outputDirectory
        super.init()
        let configuration = WKWebViewConfiguration()
        webView = WKWebView(
            frame: NSRect(x: 0, y: 0, width: width, height: height),
            configuration: configuration
        )
        webView.navigationDelegate = self
    }

    func export(from htmlURL: URL) {
        webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        captureNextScreenshot()
    }

    private func captureNextScreenshot() {
        guard nextScreenshot < names.count else {
            print("Exported \(names.count) App Store screenshots to \(outputDirectory.path)")
            NSApp.terminate(nil)
            return
        }

        let index = nextScreenshot
        let style = """
        html, body {
          width: \(width)px !important;
          height: \(height)px !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        body { display: block !important; }
        body > header { display: none !important; }
        main.gallery {
          display: block !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: \(width)px !important;
          height: \(height)px !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        main.gallery > article {
          display: none !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 390px !important;
          height: 844px !important;
          min-width: 0 !important;
          aspect-ratio: auto !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          transform: scale(\(Double(width) / 390.0)) !important;
          transform-origin: top left !important;
        }
        main.gallery > article .headline {
          font-size: 31px !important;
          line-height: 1.04 !important;
        }
        main.gallery > article .subhead {
          font-size: 13px !important;
          line-height: 1.28 !important;
        }
        main.gallery > article:nth-child(\(index + 1)) { display: block !important; }
        """
        let encodedStyle = try! JSONSerialization.data(withJSONObject: [style])
        let styleString = String(data: encodedStyle, encoding: .utf8)!.dropFirst().dropLast()
        let script = """
        (() => {
          const style = document.createElement('style');
          style.textContent = \(styleString);
          document.head.appendChild(style);
          return true;
        })();
        """

        webView.evaluateJavaScript(script) { [weak self] _, error in
            guard let self else { return }
            if let error {
                fputs("Unable to prepare screenshot \(index + 1): \(error)\n", stderr)
                NSApp.terminate(nil)
                return
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                self.takeSnapshot(index: index)
            }
        }
    }

    private func takeSnapshot(index: Int) {
        let configuration = WKSnapshotConfiguration()
        configuration.rect = NSRect(x: 0, y: 0, width: width, height: height)
        configuration.snapshotWidth = NSNumber(value: width)
        webView.takeSnapshot(with: configuration) { [weak self] image, error in
            guard let self else { return }
            if let error {
                fputs("Unable to capture screenshot \(index + 1): \(error)\n", stderr)
                NSApp.terminate(nil)
                return
            }
            guard let image, let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
                fputs("Screenshot \(index + 1) produced no image.\n", stderr)
                NSApp.terminate(nil)
                return
            }

            do {
                let representation = NSBitmapImageRep(
                    bitmapDataPlanes: nil,
                    pixelsWide: width,
                    pixelsHigh: height,
                    bitsPerSample: 8,
                    samplesPerPixel: 4,
                    hasAlpha: true,
                    isPlanar: false,
                    colorSpaceName: .deviceRGB,
                    bytesPerRow: 0,
                    bitsPerPixel: 0
                )!
                let context = NSGraphicsContext(bitmapImageRep: representation)!
                NSGraphicsContext.saveGraphicsState()
                NSGraphicsContext.current = context
                context.imageInterpolation = .high
                NSImage(cgImage: cgImage, size: NSSize(width: width, height: height))
                    .draw(in: NSRect(x: 0, y: 0, width: width, height: height))
                context.flushGraphics()
                NSGraphicsContext.restoreGraphicsState()

                let destination = outputDirectory
                    .appendingPathComponent("nuj-app-store-\(names[index]).png")
                guard let png = representation.representation(using: .png, properties: [:]) else {
                    throw CocoaError(.fileWriteUnknown)
                }
                try png.write(to: destination, options: .atomic)
                print("\(destination.lastPathComponent): \(width) × \(height)")
                nextScreenshot += 1
                captureNextScreenshot()
            } catch {
                fputs("Unable to save screenshot \(index + 1): \(error)\n", stderr)
                NSApp.terminate(nil)
            }
        }
    }
}

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: swift export-screenshots.swift <mockups.html> <output-directory>\n", stderr)
    exit(2)
}

let htmlURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputDirectory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

let application = NSApplication.shared
application.setActivationPolicy(.accessory)
let exporter = ScreenshotExporter(outputDirectory: outputDirectory)
exporter.export(from: htmlURL)
application.run()

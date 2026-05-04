// QR scanner: BarcodeDetector with jsQR fallback.
// Center-gates detection to a square scan box and captures the source frame.

import jsQR from "jsqr";

/** @typedef {import("./scanner").StartScannerOptions} StartScannerOptions */
/** @typedef {import("./scanner").ScannerHandle} ScannerHandle */
/** @typedef {import("./scanner").ScanBox} ScanBox */

/**
 * @param {number} videoWidth
 * @param {number} videoHeight
 * @param {number} ratio
 * @returns {ScanBox}
 */
function computeScanBox(videoWidth, videoHeight, ratio) {
  const side = Math.min(videoWidth, videoHeight) * ratio;
  return {
    x: (videoWidth - side) / 2,
    y: (videoHeight - side) / 2,
    w: side,
    h: side,
  };
}

/**
 * @param {Array<{x: number, y: number}>} points
 * @param {ScanBox} box
 * @returns {boolean}
 */
function pointsContained(points, box) {
  const maxX = box.x + box.w;
  const maxY = box.y + box.h;
  let minPx = Infinity;
  let minPy = Infinity;
  let maxPx = -Infinity;
  let maxPy = -Infinity;
  for (const p of points) {
    if (p.x < minPx) minPx = p.x;
    if (p.y < minPy) minPy = p.y;
    if (p.x > maxPx) maxPx = p.x;
    if (p.y > maxPy) maxPy = p.y;
  }
  return minPx >= box.x && minPy >= box.y && maxPx <= maxX && maxPy <= maxY;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
function canvasToJpegBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob returned null"));
      },
      "image/jpeg",
      0.9,
    );
  });
}

/**
 * @param {StartScannerOptions} opts
 * @returns {Promise<ScannerHandle>}
 */
export async function startScanner(opts) {
  const {
    video,
    onDecode,
    onError,
    onReady,
    fps = 10,
    scanBoxRatio = 0.6,
  } = opts;
  const intervalMs = Math.max(33, Math.floor(1000 / fps));

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera API not available in this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });

  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  try {
    await video.play();
  } catch {
    // Autoplay may require a user gesture; caller should arrange one.
  }

  let stopped = false;
  let readyFired = false;
  /** @type {number | undefined} */
  let timer;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
    for (const track of stream.getTracks()) track.stop();
    if (video.srcObject === stream) video.srcObject = null;
  };

  /** @type {{ detect(src: CanvasImageSource): Promise<Array<{rawValue: string, cornerPoints?: Array<{x:number,y:number}>, boundingBox?: DOMRectReadOnly}>> } | null} */
  let detector = null;
  /** @type {any} */
  const w = window;
  if (typeof w.BarcodeDetector === "function") {
    try {
      const supported = await w.BarcodeDetector.getSupportedFormats?.();
      if (!supported || supported.includes("qr_code")) {
        detector = new w.BarcodeDetector({ formats: ["qr_code"] });
      }
    } catch {
      detector = null;
    }
  }

  /** @type {HTMLCanvasElement | null} */
  let canvas = null;
  /** @type {CanvasRenderingContext2D | null} */
  let ctx = null;

  /**
   * Ensure the offscreen canvas matches current source dimensions and
   * has the latest video frame drawn into it. Returns the dimensions used.
   * @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, w: number, h: number } | null}
   */
  const drawFrame = () => {
    if (!canvas) {
      canvas = document.createElement("canvas");
      ctx = canvas.getContext("2d", { willReadFrequently: true });
    }
    if (!ctx || !canvas) return null;
    const w2 = video.videoWidth;
    const h2 = video.videoHeight;
    if (canvas.width !== w2) canvas.width = w2;
    if (canvas.height !== h2) canvas.height = h2;
    ctx.drawImage(video, 0, 0, w2, h2);
    return { canvas, ctx, w: w2, h: h2 };
  };

  /**
   * @param {ScanBox} box
   * @returns {Promise<void>}
   */
  const acceptDecode = async (rawString, box, frameWidth, frameHeight) => {
    void box;
    // Frame already drawn by tick() into `canvas` at source resolution.
    if (!canvas) return;
    let blob;
    try {
      blob = await canvasToJpegBlob(canvas);
    } catch (err) {
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    stop();
    onDecode({ rawString, frame: blob, frameWidth, frameHeight });
  };

  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const box = computeScanBox(vw, vh, scanBoxRatio);

        if (!readyFired) {
          readyFired = true;
          if (onReady) {
            onReady({ videoWidth: vw, videoHeight: vh, scanBox: box });
          }
        }

        // Always draw the current frame first so we can both decode (jsQR
        // path) and capture an accepted-frame Blob (both paths) from one
        // consistent snapshot.
        const drawn = drawFrame();

        if (detector) {
          const results = await detector.detect(video);
          if (results && results.length > 0) {
            const r = results[0];
            const text = r.rawValue;
            if (text) {
              /** @type {Array<{x:number,y:number}>} */
              let pts = [];
              if (Array.isArray(r.cornerPoints) && r.cornerPoints.length > 0) {
                pts = r.cornerPoints.map((p) => ({ x: p.x, y: p.y }));
              } else if (r.boundingBox) {
                const b = r.boundingBox;
                pts = [
                  { x: b.left, y: b.top },
                  { x: b.right, y: b.top },
                  { x: b.right, y: b.bottom },
                  { x: b.left, y: b.bottom },
                ];
              }
              if (pts.length > 0 && pointsContained(pts, box)) {
                // Re-draw to capture as close to the decoded frame as possible.
                const d2 = drawFrame() ?? drawn;
                if (d2) {
                  await acceptDecode(text, box, d2.w, d2.h);
                  return;
                }
              }
            }
          }
        } else {
          if (drawn && drawn.ctx) {
            const imageData = drawn.ctx.getImageData(0, 0, drawn.w, drawn.h);
            const result = jsQR(imageData.data, drawn.w, drawn.h, {
              inversionAttempts: "dontInvert",
            });
            if (result && result.data && result.location) {
              const loc = result.location;
              const pts = [
                loc.topLeftCorner,
                loc.topRightCorner,
                loc.bottomRightCorner,
                loc.bottomLeftCorner,
              ];
              if (pointsContained(pts, box)) {
                await acceptDecode(result.data, box, drawn.w, drawn.h);
                return;
              }
            }
          }
        }
      }
    } catch (err) {
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
    }
    if (!stopped) {
      timer = window.setTimeout(tick, intervalMs);
    }
  };

  timer = window.setTimeout(tick, intervalMs);

  return { stop };
}

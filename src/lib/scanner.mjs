// QR scanner: BarcodeDetector with jsQR fallback.

import jsQR from "jsqr";

/** @typedef {import("./scanner").StartScannerOptions} StartScannerOptions */
/** @typedef {import("./scanner").ScannerHandle} ScannerHandle */

/**
 * @param {StartScannerOptions} opts
 * @returns {Promise<ScannerHandle>}
 */
export async function startScanner(opts) {
  const { video, onDecode, onError, fps = 10 } = opts;
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

  /** @type {{ detect(src: CanvasImageSource): Promise<Array<{rawValue: string}>> } | null} */
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

  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (detector) {
          const results = await detector.detect(video);
          if (results && results.length > 0) {
            const text = results[0].rawValue;
            if (text) {
              stop();
              onDecode(text);
              return;
            }
          }
        } else {
          if (!canvas) {
            canvas = document.createElement("canvas");
            ctx = canvas.getContext("2d", { willReadFrequently: true });
          }
          if (ctx) {
            const w2 = video.videoWidth;
            const h2 = video.videoHeight;
            if (canvas.width !== w2) canvas.width = w2;
            if (canvas.height !== h2) canvas.height = h2;
            ctx.drawImage(video, 0, 0, w2, h2);
            const imageData = ctx.getImageData(0, 0, w2, h2);
            const result = jsQR(imageData.data, w2, h2, {
              inversionAttempts: "dontInvert",
            });
            if (result && result.data) {
              stop();
              onDecode(result.data);
              return;
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

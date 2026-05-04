// TypeScript declarations for ./scanner.mjs.

export interface ScanBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DecodeResult {
  rawString: string;
  frame: Blob;
  frameWidth: number;
  frameHeight: number;
}

export interface ReadyInfo {
  videoWidth: number;
  videoHeight: number;
  scanBox: ScanBox;
}

export interface StartScannerOptions {
  video: HTMLVideoElement;
  onDecode: (result: DecodeResult) => void;
  onError?: (err: Error) => void;
  onReady?: (info: ReadyInfo) => void;
  /** Frames per second to sample (default 10). */
  fps?: number;
  /** Fraction of min(videoWidth, videoHeight) the centered scan box occupies (default 0.6). */
  scanBoxRatio?: number;
}

export interface ScannerHandle {
  stop: () => void;
}

/**
 * Start a QR scanner against the supplied <video> element.
 * Acquires the rear camera via getUserMedia, then samples frames
 * (BarcodeDetector when available, jsQR otherwise) until a QR is decoded
 * (and fully contained within the centered scan box) or stop() is called.
 * onDecode is called once per scanner lifetime, with the decoded string and
 * a JPEG Blob of the source-resolution frame at the moment of decode.
 */
export function startScanner(opts: StartScannerOptions): Promise<ScannerHandle>;

// TypeScript declarations for ./scanner.mjs.

export interface StartScannerOptions {
  video: HTMLVideoElement;
  onDecode: (text: string) => void;
  onError?: (err: Error) => void;
  /** Frames per second to sample (default 10). */
  fps?: number;
}

export interface ScannerHandle {
  stop: () => void;
}

/**
 * Start a QR scanner against the supplied <video> element.
 * Acquires the rear camera via getUserMedia, then samples frames
 * (BarcodeDetector when available, jsQR otherwise) until a QR is decoded
 * or stop() is called. onDecode is called once per scanner lifetime.
 */
export function startScanner(opts: StartScannerOptions): Promise<ScannerHandle>;

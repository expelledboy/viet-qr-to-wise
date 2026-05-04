// TypeScript declarations for ./ocr.mjs.

/**
 * Lazily loads Tesseract.js v7 (and streams WASM + eng traineddata from CDN),
 * runs OCR on the given frame, and returns the top candidate lines that look
 * like an ASCII-uppercase person name.
 *
 * Filtering: keep lines that are
 *  - 2+ space-separated tokens
 *  - all uppercase A-Z and spaces only
 *  - 5..40 characters total
 *  - no leading "MR" / "MRS" / "MS" / "DR" honorific (stripped if present)
 *
 * Returns up to 5 candidates, ranked by Tesseract's per-line confidence.
 *
 * Throws if OCR cannot be initialised. Caller decides UX.
 */
export function extractNameCandidates(frame: Blob): Promise<string[]>;

/**
 * Prefetch the OCR engine (dynamic import) in the background. Fire-and-forget.
 * Errors are swallowed.
 */
export function prefetchOcr(): void;

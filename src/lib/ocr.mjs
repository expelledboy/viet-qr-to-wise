// Lazy-loaded OCR module backed by Tesseract.js v7.
//
// Bundle policy: keep the happy-path bundle untouched. The Tesseract.js
// wrapper (~30 KB) is loaded via dynamic import (Vite code-splits it into
// its own chunk). The WASM core and English traineddata are streamed from
// jsDelivr at fixed pinned versions, NOT served from our origin.

// Pinned versions. tesseract.js npm wrapper is at 7.x; tesseract.js-core
// (the WASM "v7" perf release) is the matching 7.x. We pin both explicitly.
const TESSERACT_JS_VERSION = "7.0.0";
const TESSERACT_CORE_VERSION = "7.0.0";

const WORKER_PATH =
  `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_JS_VERSION}/dist/worker.min.js`;
const CORE_PATH =
  `https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_CORE_VERSION}/`;
const LANG_PATH = `https://tessdata.projectnaptha.com/4.0.0`;

const WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
const HONORIFICS = new Set(["MR", "MRS", "MS", "DR"]);

let importPromise = null;

/**
 * Triggers the dynamic import of tesseract.js so Vite's code-split chunk
 * is fetched and parsed. Best-effort; errors are swallowed.
 */
export function prefetchOcr() {
  try {
    if (!importPromise) {
      importPromise = import("tesseract.js").catch((err) => {
        // Reset so a later real call can retry.
        importPromise = null;
        throw err;
      });
    }
    // Suppress unhandled rejection for the prefetch path.
    importPromise.catch(() => {});
  } catch {
    // ignore
  }
}

function loadTesseract() {
  if (!importPromise) {
    importPromise = import("tesseract.js").catch((err) => {
      importPromise = null;
      throw err;
    });
  }
  return importPromise;
}

function normalizeLine(raw) {
  if (typeof raw !== "string") return "";
  // Strip non-letters/spaces; collapse whitespace; uppercase.
  let s = raw.toUpperCase().replace(/[^A-Z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const tokens = s.split(" ");
  // Drop honorific prefix if present.
  if (tokens.length > 1 && HONORIFICS.has(tokens[0])) tokens.shift();
  s = tokens.join(" ");
  if (tokens.length < 2) return "";
  if (s.length < 5 || s.length > 40) return "";
  // Final sanity: post-whitelist this is automatic, but double-check.
  if (!/^[A-Z]+(?: [A-Z]+)+$/.test(s)) return "";
  return s;
}

/**
 * Runs OCR on the given frame and returns up to 5 ranked candidate names.
 * Caller is responsible for UX around errors.
 */
export async function extractNameCandidates(frame) {
  const tesseract = await loadTesseract();
  const createWorker = tesseract.createWorker;
  if (typeof createWorker !== "function") {
    throw new Error("tesseract.js: createWorker missing");
  }

  const worker = await createWorker("eng", 1, {
    corePath: CORE_PATH,
    workerPath: WORKER_PATH,
    langPath: LANG_PATH,
  });

  try {
    await worker.setParameters({ tessedit_char_whitelist: WHITELIST });
    const result = await worker.recognize(frame);
    const lines = (result && result.data && Array.isArray(result.data.lines))
      ? result.data.lines
      : [];

    /** @type {Array<{ text: string; conf: number }>} */
    const candidates = [];
    const seen = new Set();
    for (const ln of lines) {
      const text = normalizeLine(ln && ln.text);
      if (!text) continue;
      if (seen.has(text)) continue;
      seen.add(text);
      const conf = typeof ln.confidence === "number" ? ln.confidence : 0;
      candidates.push({ text, conf });
    }
    candidates.sort((a, b) => b.conf - a.conf);
    return candidates.slice(0, 5).map((c) => c.text);
  } finally {
    try {
      await worker.terminate();
    } catch {
      // ignore
    }
  }
}

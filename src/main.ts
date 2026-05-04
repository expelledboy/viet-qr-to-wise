import "./style.css";
import { type VietQRData } from "./lib/vietqr.mjs";
import { classifyQR, type ClassifyResult } from "./lib/classify.mjs";
import { lookupBin, type BankLookupResult } from "./lib/banks.mjs";
import { startScanner, type ScannerHandle } from "./lib/scanner.mjs";
import { buildWiseSendUrl } from "./lib/wise.mjs";
import { renderRecipientImage } from "./lib/render.mjs";

type View = "scanning" | "parsed" | "error" | "manual";

interface AppState {
  view: View;
  errorMessage?: string;
  errorDetail?: string;
  parsed?: VietQRData;
  bank?: BankLookupResult | null;
  notice?: string;
  cameraDenied?: boolean;
  cameraUnavailable?: boolean;
  capturedFrame?: Blob | null;
  capturedFrameWidth?: number;
  capturedFrameHeight?: number;
}

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("#app missing");

const state: AppState = { view: "scanning" };
let scanner: ScannerHandle | null = null;

function holderKey(bin: string, account: string): string {
  return `vqr2w:holder:${bin}:${account}`;
}

function getStoredHolder(bin: string, account: string): string {
  try {
    return localStorage.getItem(holderKey(bin, account)) ?? "";
  } catch {
    return "";
  }
}

function setStoredHolder(bin: string, account: string, value: string): void {
  try {
    if (value) localStorage.setItem(holderKey(bin, account), value);
    else localStorage.removeItem(holderKey(bin, account));
  } catch {
    // ignore
  }
}

function formatVnd(n: number): string {
  return n.toLocaleString("en-US");
}

function showToast(msg: string): void {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  window.setTimeout(() => {
    el.classList.add("toast--hide");
    window.setTimeout(() => el.remove(), 250);
  }, 1000);
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied!");
  } catch {
    // Fallback: select via temporary textarea
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast("Copied!");
    } catch {
      showToast("Copy failed — selected instead");
    }
    ta.remove();
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Partial<Record<string, string>> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined) continue;
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function copyRow(label: string, value: string, opts: { badge?: string } = {}): HTMLElement {
  const row = el("div", { class: "row" });
  const head = el("div", { class: "row__head" });
  head.appendChild(el("span", { class: "row__label" }, [label]));
  if (opts.badge) head.appendChild(el("span", { class: "badge" }, [opts.badge]));
  row.appendChild(head);

  const body = el("div", { class: "row__body" });
  body.appendChild(el("span", { class: "row__value" }, [value]));
  const btn = el("button", { class: "btn btn--copy", type: "button" }, ["Copy"]);
  btn.addEventListener("click", () => {
    void copyToClipboard(value);
  });
  body.appendChild(btn);
  row.appendChild(body);
  return row;
}

function handleParsed(data: VietQRData, notice?: string): void {
  state.parsed = data;
  state.bank = lookupBin(data.merchantAccount.bankBin);
  state.notice = notice;
  state.view = "parsed";
  render();
}

function handleDecode(text: string): void {
  const result: ClassifyResult = classifyQR(text);
  state.errorDetail = undefined;
  state.notice = undefined;
  switch (result.kind) {
    case "vietqr":
      handleParsed(result.parsed);
      return;
    case "vietqr-card":
      handleParsed(result.parsed, result.notice);
      return;
    case "wallet-via-vietqr":
      handleParsed(result.parsed, result.notice);
      return;
    default:
      state.view = "error";
      state.errorMessage = result.message;
      state.errorDetail = result.detail;
      render();
      return;
  }
}

async function startCamera(videoEl: HTMLVideoElement): Promise<void> {
  try {
    scanner = await startScanner({
      video: videoEl,
      onDecode: ({ rawString, frame, frameWidth, frameHeight }) => {
        scanner = null;
        state.capturedFrame = frame;
        state.capturedFrameWidth = frameWidth;
        state.capturedFrameHeight = frameHeight;
        handleDecode(rawString);
      },
      onReady: ({ videoWidth, videoHeight, scanBox }) => {
        // Geometry sanity log; also lets us verify the visual overlay matches.
        console.debug("[scanner] ready", { videoWidth, videoHeight, scanBox });
      },
      onError: () => {
        // Per-frame errors swallowed.
      },
    });
  } catch (err) {
    const e = err as Error & { name?: string };
    if (e.name === "NotAllowedError" || e.name === "SecurityError") {
      state.cameraDenied = true;
    } else if (e.name === "NotFoundError" || e.name === "OverconstrainedError") {
      state.cameraUnavailable = true;
      state.view = "manual";
    } else if (!window.isSecureContext) {
      state.errorMessage = "Camera requires HTTPS. Open this page over HTTPS.";
      state.view = "error";
    } else {
      state.cameraUnavailable = true;
      state.view = "manual";
    }
    render();
  }
}

function stopCamera(): void {
  if (scanner) {
    scanner.stop();
    scanner = null;
  }
}

function reset(): void {
  stopCamera();
  state.view = "scanning";
  state.errorMessage = undefined;
  state.errorDetail = undefined;
  state.parsed = undefined;
  state.bank = undefined;
  state.notice = undefined;
  state.cameraDenied = false;
  state.capturedFrame = null;
  state.capturedFrameWidth = undefined;
  state.capturedFrameHeight = undefined;
  render();
}

function viewScanning(): HTMLElement {
  const wrap = el("div", { class: "scan" });

  const video = el("video", { class: "scan__video", playsinline: "true", muted: "true" });
  wrap.appendChild(video);

  const overlay = el("div", { class: "scan__overlay" });
  overlay.appendChild(el("div", { class: "scan__box" }));
  overlay.appendChild(
    el("p", { class: "scan__hint" }, [
      "Position QR inside the box. Include the full card.",
    ]),
  );
  wrap.appendChild(overlay);

  const bottom = el("div", { class: "scan__bottom" });
  const manualBtn = el("button", { class: "btn btn--ghost", type: "button" }, [
    "Paste VietQR string instead",
  ]);
  manualBtn.addEventListener("click", () => {
    stopCamera();
    state.view = "manual";
    render();
  });
  bottom.appendChild(manualBtn);
  wrap.appendChild(bottom);

  if (state.cameraDenied) {
    const banner = el("div", { class: "banner banner--error" });
    banner.appendChild(
      el("p", {}, ["Camera permission denied. Allow camera access, then retry."]),
    );
    const retry = el("button", { class: "btn", type: "button" }, ["Retry"]);
    retry.addEventListener("click", () => {
      state.cameraDenied = false;
      render();
    });
    banner.appendChild(retry);
    wrap.appendChild(banner);
  } else {
    // Kick off camera after the element is mounted.
    queueMicrotask(() => {
      void startCamera(video);
    });
  }

  return wrap;
}

function viewError(): HTMLElement {
  const wrap = el("div", { class: "card" });
  wrap.appendChild(el("h2", {}, ["Can't use this QR"]));
  wrap.appendChild(
    el("p", { class: "muted" }, [state.errorMessage ?? "Unknown error."]),
  );
  if (state.errorDetail) {
    const details = el("details", { class: "tech-detail" });
    details.appendChild(el("summary", {}, ["Technical info"]));
    details.appendChild(el("pre", { class: "tech-detail__pre" }, [state.errorDetail]));
    wrap.appendChild(details);
  }
  const retry = el("button", { class: "btn btn--primary", type: "button" }, [
    "Try again",
  ]);
  retry.addEventListener("click", reset);
  wrap.appendChild(retry);
  return wrap;
}

function viewManual(): HTMLElement {
  const wrap = el("div", { class: "card" });
  wrap.appendChild(el("h2", {}, ["Paste VietQR string"]));
  wrap.appendChild(
    el("p", { class: "muted" }, [
      state.cameraUnavailable
        ? "No camera detected. Paste the raw VietQR string below."
        : "Paste the raw VietQR string (begins with 0002…).",
    ]),
  );

  const ta = el("textarea", {
    class: "input input--textarea",
    rows: "5",
    placeholder: "00020101021238…",
  });
  wrap.appendChild(ta);

  const submit = el("button", { class: "btn btn--primary", type: "button" }, [
    "Parse",
  ]);
  submit.addEventListener("click", () => {
    const v = (ta as HTMLTextAreaElement).value.trim();
    if (!v) return;
    handleDecode(v);
  });
  wrap.appendChild(submit);

  if (!state.cameraUnavailable) {
    const back = el("button", { class: "btn btn--ghost", type: "button" }, [
      "Back to scanner",
    ]);
    back.addEventListener("click", () => {
      state.view = "scanning";
      render();
    });
    wrap.appendChild(back);
  }
  return wrap;
}

function viewParsed(): HTMLElement {
  const data = state.parsed;
  if (!data) return viewError();

  const wrap = el("div", { class: "result" });
  const card = el("div", { class: "card" });

  if (state.notice) {
    const banner = el("div", { class: "warn-banner" }, [state.notice]);
    card.appendChild(banner);
  }

  const bank = state.bank;
  const bin = data.merchantAccount.bankBin;
  const account = data.merchantAccount.accountNumber;

  // Bank header
  if (bank) {
    card.appendChild(el("h2", { class: "card__title" }, [bank.shortName]));
    card.appendChild(el("p", { class: "muted" }, [bank.name]));
  } else {
    card.appendChild(el("h2", { class: "card__title" }, [`Unknown bank (BIN ${bin})`]));
    card.appendChild(
      el("p", { class: "muted" }, [
        "This BIN isn't in our list. Verify the bank manually before sending.",
      ]),
    );
  }

  // SWIFT/BIC
  const bic = bank?.bic ?? "";
  if (bic) {
    const badge =
      bank && !bank.wiseSupported
        ? "Not in Wise's bank list — verify manually"
        : bank?.bicSource === "override"
          ? "Manual override — verify"
          : undefined;
    card.appendChild(copyRow("SWIFT/BIC", bic, { badge }));
  } else {
    const r = el("div", { class: "row" });
    r.appendChild(el("span", { class: "row__label" }, ["SWIFT/BIC"]));
    r.appendChild(
      el("p", { class: "muted" }, [
        "No SWIFT/BIC available for this bank. You may not be able to send via Wise.",
      ]),
    );
    card.appendChild(r);
  }

  // Account number
  card.appendChild(copyRow("Account number", account));

  // Account holder
  const holderRow = el("div", { class: "row" });
  holderRow.appendChild(el("span", { class: "row__label" }, ["Account holder"]));
  const holderInput = el("input", {
    class: "input",
    type: "text",
    placeholder: "Enter recipient name",
    value: getStoredHolder(bin, account),
    autocomplete: "off",
    spellcheck: "false",
  }) as HTMLInputElement;
  holderInput.addEventListener("blur", () => {
    setStoredHolder(bin, account, holderInput.value.trim());
  });
  holderRow.appendChild(holderInput);
  card.appendChild(holderRow);

  // Amount
  if (typeof data.amount === "number" && data.amount > 0) {
    card.appendChild(copyRow("Amount", `${formatVnd(data.amount)} VND`));
  }

  // Reference
  const memo = data.additionalData?.purpose;
  if (memo && memo.trim().length > 0) {
    card.appendChild(copyRow("Reference", memo));
  }

  wrap.appendChild(card);

  // CTAs
  const ctas = el("div", { class: "ctas" });

  const saveBtn = el("button", { class: "btn btn--primary", type: "button" }, [
    "Save image for Wise OCR",
  ]);
  saveBtn.addEventListener("click", () => {
    void saveImage();
  });
  ctas.appendChild(saveBtn);

  const wiseBtn = el("a", {
    class: "btn btn--secondary",
    href: buildWiseSendUrl({ amount: data.amount }),
    target: "_blank",
    rel: "noopener noreferrer",
  }, ["Open Wise"]);
  ctas.appendChild(wiseBtn);

  wrap.appendChild(ctas);

  const again = el("button", { class: "btn btn--ghost btn--again", type: "button" }, [
    "Scan another",
  ]);
  again.addEventListener("click", reset);
  wrap.appendChild(again);

  return wrap;
}

async function saveImage(): Promise<void> {
  const data = state.parsed;
  const bank = state.bank;
  if (!data) return;

  const bin = data.merchantAccount.bankBin;
  const account = data.merchantAccount.accountNumber;
  const holder = getStoredHolder(bin, account);

  let blob: Blob;
  try {
    blob = await renderRecipientImage({
      bankName: bank ? bank.shortName : `Unknown bank (BIN ${bin})`,
      bic: bank?.bic ?? "—",
      accountNumber: account,
      accountHolder: holder,
      amount: data.amount,
      currency: "VND",
      reference: data.additionalData?.purpose,
    });
  } catch (err) {
    showToast(`Render failed: ${(err as Error).message}`);
    return;
  }

  const url = URL.createObjectURL(blob);
  const filename = `wise-recipient-${bin}-${account}.png`;
  let downloaded = false;
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    downloaded = true;
  } catch {
    downloaded = false;
  }

  // iOS Safari often ignores the download attribute. Detect via UA and also
  // open in a new tab as a fallback if the user is on iOS.
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!downloaded || isIOS) {
    window.open(url, "_blank", "noopener");
  }

  // Revoke later so the new tab/download has a chance to read it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function render(): void {
  if (!root) return;
  root.replaceChildren();
  const header = el("header", { class: "app__header" }, [
    el("h1", {}, ["VietQR → Wise"]),
  ]);
  root.appendChild(header);

  let body: HTMLElement;
  switch (state.view) {
    case "scanning":
      body = viewScanning();
      break;
    case "parsed":
      body = viewParsed();
      break;
    case "manual":
      body = viewManual();
      break;
    case "error":
    default:
      body = viewError();
      break;
  }
  root.appendChild(body);
}

render();

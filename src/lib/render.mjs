// Recipient-details PNG renderer for Wise OCR.

const FONT_STACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * @param {number} n
 * @returns {string}
 */
function formatThousands(n) {
  return Math.round(n).toLocaleString("en-US");
}

/**
 * @param {import("./render").RenderRecipientImageInput} input
 * @returns {Promise<Blob>}
 */
export function renderRecipientImage(input) {
  const W = 1200;
  const H = 750;
  const dpr = 2;
  const padX = 64;
  const padTop = 64;

  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Failed to acquire 2D canvas context."));
  }
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = "#111111";
  ctx.textBaseline = "top";
  ctx.font = `bold 36px ${FONT_STACK}`;
  ctx.fillText("Bank transfer details", padX, padTop);

  /** @type {Array<{ label: string, value: string }>} */
  const rows = [
    { label: "Bank", value: input.bankName },
    { label: "SWIFT/BIC", value: input.bic },
    { label: "Account number", value: input.accountNumber },
    { label: "Account holder", value: input.accountHolder || "—" },
  ];
  if (typeof input.amount === "number" && input.amount > 0) {
    rows.push({
      label: "Amount",
      value: `${formatThousands(input.amount)} ${input.currency}`,
    });
  }
  if (input.reference && input.reference.trim().length > 0) {
    rows.push({ label: "Reference", value: input.reference });
  }

  let y = padTop + 36 + 40;
  const labelSize = 28;
  const valueSize = 44;
  const rowGap = 28;

  for (const row of rows) {
    ctx.fillStyle = "#555555";
    ctx.font = `400 ${labelSize}px ${FONT_STACK}`;
    ctx.fillText(row.label, padX, y);
    y += labelSize + 6;

    ctx.fillStyle = "#111111";
    ctx.font = `600 ${valueSize}px ${FONT_STACK}`;
    ctx.fillText(row.value, padX, y);
    y += valueSize + rowGap;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas.toBlob returned null."));
    }, "image/png");
  });
}

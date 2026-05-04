// TypeScript declarations for ./render.mjs.

export interface RenderRecipientImageInput {
  bankName: string;
  bic: string;
  accountNumber: string;
  accountHolder: string;
  amount?: number;
  currency: string;
  reference?: string;
}

/**
 * Render a recipient-details PNG suitable for Wise OCR ingestion.
 * Returns a PNG Blob (1200x750 logical, 2x DPR).
 */
export function renderRecipientImage(
  input: RenderRecipientImageInput,
): Promise<Blob>;

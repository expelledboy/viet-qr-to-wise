#!/usr/bin/env node
// Builds src/data/banks.json by cross-referencing vietqr.io's bank list
// with Wise's accepted SWIFT/BIC codes for VND transfers.
//
// Run: node scripts/build-banks.mjs
// No npm deps; requires Node 18+ for global fetch.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VIETQR_URL = 'https://api.vietqr.io/v2/banks';
const WISE_URL =
  'https://api.wise.com/v1/account-requirements?source=USD&target=VND&sourceAmount=100';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_PATH = resolve(__dirname, '..', 'src', 'data', 'banks.json');

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function main() {
  console.error(`Fetching ${VIETQR_URL} ...`);
  const vietqr = await fetchJson(VIETQR_URL);
  const banks = vietqr?.data;
  if (!Array.isArray(banks)) {
    throw new Error('Unexpected vietqr.io response shape: missing data[]');
  }
  console.error(`  -> ${banks.length} banks`);

  console.error(`Fetching ${WISE_URL} ...`);
  // Wise requires this header for account-requirements without an existing quote.
  const wise = await fetchJson(WISE_URL, {
    'Accept-Minor-Version': '1',
  });

  // Wise returns an array of requirement sets; find the one with a swiftCode field.
  const wiseBics = new Set();
  const requirementSets = Array.isArray(wise) ? wise : [];
  for (const set of requirementSets) {
    const fields = set?.fields ?? [];
    for (const field of fields) {
      const groups = field?.group ?? [];
      for (const g of groups) {
        if (g?.key === 'swiftCode' && Array.isArray(g.valuesAllowed)) {
          for (const v of g.valuesAllowed) {
            if (v?.key) wiseBics.add(String(v.key).toUpperCase());
          }
        }
      }
    }
  }
  console.error(`  -> ${wiseBics.size} Wise-accepted BICs`);

  if (wiseBics.size === 0) {
    throw new Error(
      'Wise response contained no swiftCode valuesAllowed entries. Aborting to avoid producing bad data.',
    );
  }

  const out = banks
    .map((b) => {
      const bic = b.swift_code ? String(b.swift_code).trim() : null;
      const wiseSupported = bic ? wiseBics.has(bic.toUpperCase()) : false;
      return {
        bin: String(b.bin),
        code: b.code ?? null,
        shortName: b.shortName ?? null,
        name: b.name ?? null,
        bic: bic || null,
        wiseSupported,
      };
    })
    .sort((a, b) => a.bin.localeCompare(b.bin));

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');

  // Reporting
  const supported = out.filter((b) => b.wiseSupported).length;
  const noSwift = out.filter((b) => !b.bic);
  const vietqrBics = new Set(
    out.filter((b) => b.bic).map((b) => b.bic.toUpperCase()),
  );
  const orphanWiseBics = [...wiseBics].filter((b) => !vietqrBics.has(b)).sort();

  console.error('');
  console.error(`Wrote ${OUT_PATH}`);
  console.error(`Total banks: ${out.length}`);
  console.error(`wiseSupported=true: ${supported}`);
  console.error('');
  console.error(`Banks with no swift_code in vietqr.io (${noSwift.length}):`);
  for (const b of noSwift) {
    console.error(`  ${b.bin}  ${b.code ?? '-'}  ${b.shortName ?? '-'}  -- ${b.name ?? ''}`);
  }
  console.error('');
  console.error(`Wise BICs not matching any vietqr.io bank (${orphanWiseBics.length}):`);
  for (const b of orphanWiseBics) console.error(`  ${b}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});

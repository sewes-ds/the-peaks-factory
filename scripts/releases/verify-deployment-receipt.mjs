#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { validateDeploymentReceipt } from "./deployment-receipt-contract.mjs";

if (process.argv.length !== 3) {
  process.stderr.write("usage: node scripts/releases/verify-deployment-receipt.mjs <receipt.json>\n");
  process.exit(2);
}

let receipt;
try {
  receipt = JSON.parse(readFileSync(process.argv[2], "utf8"));
} catch (error) {
  process.stderr.write(`DEPLOYMENT_RECEIPT_VERIFY_FAIL: cannot read JSON: ${error.message}\n`);
  process.exit(1);
}

const failures = validateDeploymentReceipt(receipt);
if (failures.length > 0) {
  process.stderr.write(`DEPLOYMENT_RECEIPT_VERIFY_FAIL (${failures.length})\n`);
  failures.forEach((failure) => process.stderr.write(`- ${failure}\n`));
  process.exit(1);
}

process.stdout.write(`DEPLOYMENT_RECEIPT_VERIFY_PASS ${receipt.receipt_id}\n`);

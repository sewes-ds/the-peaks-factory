import { isAbsolute, normalize } from "node:path";

const releaseIdPattern = /^\d{8}T\d{6}Z-[0-9a-f]{12}$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateDeploymentReceipt(receipt) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const exactKeys = (value, expected, path) => {
    if (!isRecord(value)) {
      fail(`${path} must be an object`);
      return false;
    }
    if (Object.keys(value).sort().join("\0") !== [...expected].sort().join("\0")) {
      fail(`${path} keys must be exactly: ${expected.join(", ")}`);
    }
    return true;
  };
  const releaseRef = (value, path) => {
    if (!exactKeys(value, ["release_id", "manifest_sha256"], path)) return;
    if (!releaseIdPattern.test(value.release_id)) fail(`${path}.release_id has invalid format`);
    if (!sha256Pattern.test(value.manifest_sha256)) fail(`${path}.manifest_sha256 has invalid format`);
  };

  if (
    exactKeys(
      receipt,
      [
        "schema_version",
        "receipt_id",
        "action",
        "rehearsal",
        "recorded_at",
        "deployment_root",
        "from",
        "to",
        "pointers",
        "database",
        "result",
      ],
      "receipt",
    )
  ) {
    if (receipt.schema_version !== 1) fail("receipt.schema_version must equal 1");
    if (!["ACTIVATE", "ROLLBACK"].includes(receipt.action)) fail("receipt.action is invalid");
    if (typeof receipt.rehearsal !== "boolean") fail("receipt.rehearsal must be boolean");
    const date = new Date(receipt.recorded_at);
    if (
      typeof receipt.recorded_at !== "string" ||
      Number.isNaN(date.valueOf()) ||
      date.toISOString().replace(".000Z", "Z") !== receipt.recorded_at
    ) {
      fail("receipt.recorded_at must be a canonical whole-second UTC timestamp");
    }
    if (!isAbsolute(receipt.deployment_root) || normalize(receipt.deployment_root) !== receipt.deployment_root) {
      fail("receipt.deployment_root must be a normalized absolute path");
    }
    if (receipt.from !== null) releaseRef(receipt.from, "receipt.from");
    releaseRef(receipt.to, "receipt.to");

    if (exactKeys(receipt.pointers, ["current", "previous"], "receipt.pointers")) {
      if (receipt.pointers.current !== `releases/${receipt.to?.release_id}`) {
        fail("receipt.pointers.current must identify receipt.to");
      }
      if (
        receipt.pointers.previous !== null &&
        (typeof receipt.pointers.previous !== "string" ||
          !/^releases\/\d{8}T\d{6}Z-[0-9a-f]{12}$/u.test(receipt.pointers.previous))
      ) {
        fail("receipt.pointers.previous has invalid format");
      }
      if (
        receipt.from !== null &&
        receipt.pointers.previous !== `releases/${receipt.from.release_id}`
      ) {
        fail("receipt.pointers.previous must identify receipt.from");
      }
    }

    if (
      exactKeys(
        receipt.database,
        [
          "backup_required",
          "backup_verified",
          "backup_manifest_sha256",
          "restore_required",
          "restore_completed",
        ],
        "receipt.database",
      )
    ) {
      for (const key of ["backup_required", "backup_verified", "restore_required", "restore_completed"]) {
        if (typeof receipt.database[key] !== "boolean") fail(`receipt.database.${key} must be boolean`);
      }
      if (receipt.database.backup_required) {
        if (!receipt.database.backup_verified) fail("required database backup must be verified");
        if (!sha256Pattern.test(receipt.database.backup_manifest_sha256)) {
          fail("required backup manifest SHA-256 is invalid");
        }
      } else if (receipt.database.backup_manifest_sha256 !== null || receipt.database.backup_verified) {
        fail("non-required database backup evidence must be null/false");
      }
      if (receipt.database.restore_required && !receipt.database.restore_completed) {
        fail("required database restore must be completed");
      }
      if (!receipt.database.restore_required && receipt.database.restore_completed) {
        fail("non-required database restore cannot be marked completed");
      }
    }
    if (receipt.result !== "SUCCEEDED") fail("receipt.result must equal SUCCEEDED");
    const compactTimestamp =
      typeof receipt.recorded_at === "string"
        ? receipt.recorded_at.replaceAll("-", "").replaceAll(":", "")
        : "";
    const expectedReceiptId = `${compactTimestamp}-${String(receipt.action).toLowerCase()}-${receipt.to?.release_id}`;
    if (receipt.receipt_id !== expectedReceiptId) fail("receipt.receipt_id does not match its facts");
  }

  function rejectSensitive(value, path = "receipt") {
    if (Array.isArray(value)) {
      value.forEach((child, index) => rejectSensitive(child, `${path}[${index}]`));
      return;
    }
    if (!isRecord(value)) {
      if (
        typeof value === "string" &&
        (value.includes("postgresql://") || value.includes("BEGIN PRIVATE KEY") || /bot\d+:/iu.test(value))
      ) {
        fail(`${path} appears to contain a credential or secret value`);
      }
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (/(?:password|credential|private_key|database_url|bot_token|qr_token)/iu.test(key)) {
        fail(`${path}.${key} is a forbidden sensitive field`);
      }
      rejectSensitive(child, `${path}.${key}`);
    }
  }
  rejectSensitive(receipt);
  return failures;
}

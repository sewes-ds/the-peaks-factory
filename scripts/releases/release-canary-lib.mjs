import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { fullShaPattern, releaseIdPattern, sha256Pattern, ReleaseToolError } from "./release-tools-lib.mjs";

function exactKeys(value, keys, description) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0")
  ) {
    throw new ReleaseToolError(`${description} keys must be exactly: ${keys.join(", ")}`);
  }
}

function readCanarySpec(path) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ReleaseToolError(`cannot read canary spec: ${error.message}`);
  }
  exactKeys(spec, ["schema_version", "release_id", "source_commit", "checks"], "canary spec");
  if (![1, 2].includes(spec.schema_version)) {
    throw new ReleaseToolError("canary spec schema_version must equal 1 or 2");
  }
  if (!releaseIdPattern.test(spec.release_id)) throw new ReleaseToolError("canary spec release_id is invalid");
  if (!fullShaPattern.test(spec.source_commit) || !spec.release_id.endsWith(spec.source_commit.slice(0, 12))) {
    throw new ReleaseToolError("canary spec source_commit does not match release_id");
  }
  if (!Array.isArray(spec.checks) || spec.checks.length === 0 || spec.checks.length > 20) {
    throw new ReleaseToolError("canary spec requires between 1 and 20 checks");
  }
  const names = new Set();
  spec.checks.forEach((check, index) => {
    const checkKeys = [
      "name",
      "url",
      "expected_status",
      "response_body_sha256",
      "timeout_ms",
      "max_response_bytes",
    ];
    if (spec.schema_version === 2) checkKeys.push("request_host");
    exactKeys(check, checkKeys, `canary check ${index}`);
    if (!/^[a-z][a-z0-9-]{0,63}$/u.test(check.name) || names.has(check.name)) {
      throw new ReleaseToolError(`canary check ${index} has an invalid or duplicate name`);
    }
    names.add(check.name);
    let url;
    try {
      url = new URL(check.url);
    } catch {
      throw new ReleaseToolError(`canary check ${check.name} has an invalid URL`);
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      throw new ReleaseToolError(`canary check ${check.name} URL must be credential-free HTTP(S) without query/hash`);
    }
    if (!Number.isInteger(check.expected_status) || check.expected_status < 100 || check.expected_status > 599) {
      throw new ReleaseToolError(`canary check ${check.name} expected_status is invalid`);
    }
    if (check.response_body_sha256 !== null && !sha256Pattern.test(check.response_body_sha256)) {
      throw new ReleaseToolError(`canary check ${check.name} response_body_sha256 is invalid`);
    }
    if (!Number.isInteger(check.timeout_ms) || check.timeout_ms < 100 || check.timeout_ms > 30_000) {
      throw new ReleaseToolError(`canary check ${check.name} timeout_ms must be 100..30000`);
    }
    if (
      !Number.isInteger(check.max_response_bytes) ||
      check.max_response_bytes < 1 ||
      check.max_response_bytes > 1_048_576
    ) {
      throw new ReleaseToolError(`canary check ${check.name} max_response_bytes must be 1..1048576`);
    }
    if (
      spec.schema_version === 2
      && check.request_host !== null
      && (
        typeof check.request_host !== "string" ||
        check.request_host.length > 253 ||
        !check.request_host.includes(".") ||
        !/^[a-z0-9.-]+$/u.test(check.request_host) ||
        check.request_host.split(".").some(
          (label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label),
        )
      )
    ) {
      throw new ReleaseToolError(`canary check ${check.name} request_host must be null or a lowercase FQDN`);
    }
  });
  return spec;
}

async function responseDigest(response, maximumBytes) {
  const contentLength = response.headers["content-length"];
  if (contentLength !== undefined && Number(contentLength) > maximumBytes) {
    throw new ReleaseToolError("response exceeds max_response_bytes");
  }
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const value of response) {
    bytes += value.length;
    if (bytes > maximumBytes) {
      response.destroy();
      throw new ReleaseToolError("response exceeds max_response_bytes");
    }
    hash.update(value);
  }
  return { bytes, sha256: hash.digest("hex") };
}

function requestWithoutRedirect(url, headers, timeoutMs) {
  return new Promise((resolvePromise, rejectPromise) => {
    const target = new URL(url);
    const transport = target.protocol === "https:" ? https : http;
    const request = transport.request(target, { method: "GET", headers }, resolvePromise);
    request.setTimeout(timeoutMs, () => request.destroy(new Error("request timed out")));
    request.on("error", rejectPromise);
    request.end();
  });
}

export async function runReleaseCanary(specPath) {
  const spec = readCanarySpec(specPath);
  const results = [];
  const failures = [];
  for (const check of spec.checks) {
    const startedAt = Date.now();
    try {
      const headers = {
        accept: "application/json, text/plain;q=0.9, */*;q=0.1",
        "user-agent": "the-peaks-release-canary/1",
      };
      if (spec.schema_version === 2 && check.request_host !== null) {
        headers.host = check.request_host;
      }
      const response = await requestWithoutRedirect(check.url, headers, check.timeout_ms);
      const body = await responseDigest(response, check.max_response_bytes);
      if (response.statusCode !== check.expected_status) {
        throw new ReleaseToolError(`expected HTTP ${check.expected_status}, received ${response.statusCode}`);
      }
      if (check.response_body_sha256 !== null && body.sha256 !== check.response_body_sha256) {
        throw new ReleaseToolError("response body digest differs from the canary contract");
      }
      results.push({
        name: check.name,
        status: response.statusCode,
        response_bytes: body.bytes,
        response_body_sha256: body.sha256,
        duration_ms: Date.now() - startedAt,
      });
    } catch (error) {
      failures.push(`${check.name}: ${error.message}`);
    }
  }
  if (failures.length > 0) {
    throw new ReleaseToolError(`release canary failed (${failures.length}): ${failures.join("; ")}`);
  }
  return { releaseId: spec.release_id, sourceCommit: spec.source_commit, results };
}

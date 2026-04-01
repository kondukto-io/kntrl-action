/**
 * install.ts — Download, verify, cache, and install the kntrl binary.
 *
 * Flow:
 *   1. Check GitHub Actions tool cache for a previously downloaded binary
 *   2. If not cached, download from github.com/kondukto-io/kntrl/releases
 *   3. Verify SHA256 checksum against pinned hashes in checksums.ts
 *      - Known version + known arch → verify or fail
 *      - "latest" → skip verification with a warning
 *      - Unknown version → skip verification with a warning
 *   4. Install to /usr/local/bin/kntrl (requires sudo)
 *   5. Cache the binary for future workflow runs
 *
 * The download URL is hardcoded to the official GitHub releases endpoint —
 * it is NOT user-controllable, preventing redirect-based attacks.
 */

import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import * as io from "@actions/io";
import * as exec from "@actions/exec";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { CHECKSUMS } from "./checksums";

/**
 * Map Node.js process.arch to the binary suffix used in kntrl releases.
 * GitHub Actions runners report "x64" for amd64 and "arm64" for arm64.
 */
function getArchSuffix(): string {
  const arch = process.arch;
  switch (arch) {
    case "x64":
      return "amd64";
    case "arm64":
      return "arm64";
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }
}

/** Compute the SHA256 hex digest of a file on disk. */
function computeSHA256(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Download and install the kntrl binary for the given version.
 * Returns the installed binary path (/usr/local/bin/kntrl).
 */
export async function installKntrl(version: string): Promise<string> {
  const archSuffix = getArchSuffix();
  const binaryName = `kntrl.${archSuffix}`;

  // Build download URL — always points to the official GitHub releases
  let downloadUrl: string;
  if (version === "latest") {
    downloadUrl = `https://github.com/kondukto-io/kntrl/releases/latest/download/${binaryName}`;
  } else {
    downloadUrl = `https://github.com/kondukto-io/kntrl/releases/download/${version}/${binaryName}`;
  }

  core.startGroup(`Installing kntrl (${version}, ${archSuffix})`);

  // ── Step 1: Check tool cache for a previously downloaded copy ──
  const cachedPath = tc.find("kntrl", version === "latest" ? "0.0.0" : version);
  if (cachedPath) {
    core.info(`Using cached kntrl from ${cachedPath}`);
    const binPath = path.join(cachedPath, "kntrl");
    await exec.exec("sudo", ["cp", binPath, "/usr/local/bin/kntrl"]);
    await exec.exec("sudo", ["chmod", "+x", "/usr/local/bin/kntrl"]);
    core.endGroup();
    return "/usr/local/bin/kntrl";
  }

  // ── Step 2: Download the binary ──
  core.info(`Downloading kntrl from ${downloadUrl}`);
  const downloadedPath = await tc.downloadTool(downloadUrl);

  // ── Step 3: SHA256 checksum verification ──
  const versionChecksums = CHECKSUMS[version];
  if (versionChecksums && versionChecksums[archSuffix]) {
    // Happy path: we have a pinned hash for this exact version + arch
    const expectedHash = versionChecksums[archSuffix];
    const actualHash = computeSHA256(downloadedPath);
    if (actualHash !== expectedHash) {
      throw new Error(
        `SHA256 checksum mismatch for kntrl ${version} (${archSuffix}).\n` +
          `Expected: ${expectedHash}\n` +
          `Got:      ${actualHash}`
      );
    }
    core.info(`SHA256 checksum verified: ${actualHash}`);
  } else if (version === "latest") {
    // "latest" is a moving target — we can't pin its hash
    core.warning(
      "Skipping checksum verification for 'latest' version. " +
        "Pin a specific version for reproducible builds."
    );
  } else {
    // User specified a version we don't have a hash for (newer release?)
    core.warning(
      `No checksum available for kntrl ${version} (${archSuffix}). ` +
        "Binary integrity could not be verified."
    );
  }

  // ── Step 4: Install to /usr/local/bin ──
  await io.mkdirP("/usr/local/bin");
  await exec.exec("sudo", ["cp", downloadedPath, "/usr/local/bin/kntrl"]);
  await exec.exec("sudo", ["chmod", "+x", "/usr/local/bin/kntrl"]);

  // ── Step 5: Cache for future runs ──
  const cacheVersion = version === "latest" ? "0.0.0" : version;
  const cacheDir = await tc.cacheFile(downloadedPath, "kntrl", "kntrl", cacheVersion);
  core.info(`Cached kntrl to ${cacheDir}`);

  // Print installed version for debugging
  try {
    await exec.exec("kntrl", ["--version"]);
  } catch {
    core.info("kntrl installed (version check skipped)");
  }

  core.endGroup();
  return "/usr/local/bin/kntrl";
}

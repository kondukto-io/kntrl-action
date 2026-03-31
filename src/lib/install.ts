import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import * as io from "@actions/io";
import * as exec from "@actions/exec";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { CHECKSUMS } from "./checksums";

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

function computeSHA256(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function installKntrl(version: string): Promise<string> {
  const archSuffix = getArchSuffix();
  const binaryName = `kntrl.${archSuffix}`;

  let downloadUrl: string;
  if (version === "latest") {
    downloadUrl = `https://github.com/kondukto-io/kntrl/releases/latest/download/${binaryName}`;
  } else {
    downloadUrl = `https://github.com/kondukto-io/kntrl/releases/download/${version}/${binaryName}`;
  }

  core.startGroup(`Installing kntrl (${version}, ${archSuffix})`);

  // Check tool cache first
  const cachedPath = tc.find("kntrl", version === "latest" ? "0.0.0" : version);
  if (cachedPath) {
    core.info(`Using cached kntrl from ${cachedPath}`);
    const binPath = path.join(cachedPath, "kntrl");
    await exec.exec("sudo", ["cp", binPath, "/usr/local/bin/kntrl"]);
    await exec.exec("sudo", ["chmod", "+x", "/usr/local/bin/kntrl"]);
    core.endGroup();
    return "/usr/local/bin/kntrl";
  }

  core.info(`Downloading kntrl from ${downloadUrl}`);
  const downloadedPath = await tc.downloadTool(downloadUrl);

  // SHA256 verification
  const versionChecksums = CHECKSUMS[version];
  if (versionChecksums && versionChecksums[archSuffix]) {
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
    core.warning(
      "Skipping checksum verification for 'latest' version. " +
        "Pin a specific version for reproducible builds."
    );
  } else {
    core.warning(
      `No checksum available for kntrl ${version} (${archSuffix}). ` +
        "Binary integrity could not be verified."
    );
  }

  // Install binary
  await io.mkdirP("/usr/local/bin");
  await exec.exec("sudo", ["cp", downloadedPath, "/usr/local/bin/kntrl"]);
  await exec.exec("sudo", ["chmod", "+x", "/usr/local/bin/kntrl"]);

  // Cache for future runs
  const cacheVersion = version === "latest" ? "0.0.0" : version;
  const cacheDir = await tc.cacheFile(downloadedPath, "kntrl", "kntrl", cacheVersion);
  core.info(`Cached kntrl to ${cacheDir}`);

  // Print version
  try {
    await exec.exec("kntrl", ["--version"]);
  } catch {
    core.info("kntrl installed (version check skipped)");
  }

  core.endGroup();
  return "/usr/local/bin/kntrl";
}

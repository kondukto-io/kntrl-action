/**
 * daemon.ts — Start and stop the kntrl eBPF agent as a background daemon.
 *
 * Start flow:
 *   1. Copy user's custom rules directory into the rules dir (if provided)
 *   2. Spawn `sudo -E kntrl start ...` as a detached background process
 *   3. Redirect stdout/stderr to a log file for later inspection
 *   4. Write the PID to /var/run/kntrl.pid for the stop step
 *   5. Wait 2 seconds for eBPF probes to attach, then verify the process is alive
 *
 * Stop flow:
 *   1. Read PID from /var/run/kntrl.pid
 *   2. Send SIGTERM for graceful shutdown (kntrl flushes the report file on exit)
 *   3. Poll up to 5 seconds for the process to exit
 *   4. Clean up PID file and print daemon log
 *
 * The daemon runs with `sudo -E` to preserve environment variables (KNTRL_API_URL,
 * KNTRL_API_KEY) while gaining root privileges needed for eBPF operations.
 */

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { spawn } from "child_process";
import * as fs from "fs";

/** PID file path — shared between start and stop steps via the filesystem. */
const PID_FILE = "/var/run/kntrl.pid";

/** Daemon log file — captured stdout/stderr from the kntrl process. */
const LOG_FILE = "/tmp/kntrl-daemon.log";

/**
 * Start the kntrl agent as a detached background daemon.
 *
 * @param mode         - "monitor" (log only) or "trace" (enforce/block)
 * @param rulesDir     - Path to the generated rules directory
 * @param reportFile   - Path where kntrl writes its JSONL event report
 * @param customRulesFile - Optional: user-provided YAML rules file to merge
 * @param customRulesDir  - Optional: directory of extra .yaml/.rego files to include
 * @param apiUrl       - Optional: kntrl Cloud API URL
 * @param apiKey       - Optional: kntrl Cloud API key
 */
export async function startDaemon(
  mode: string,
  rulesDir: string,
  reportFile: string,
  customRulesFile: string,
  customRulesDir: string,
  apiUrl: string,
  apiKey: string
): Promise<void> {
  // Merge user's custom rules directory contents into the generated rules dir
  if (customRulesDir && fs.existsSync(customRulesDir)) {
    await exec.exec("cp", ["-r", `${customRulesDir}/.`, rulesDir], {
      ignoreReturnCode: true,
    });
  }

  // Build the sudo + kntrl command arguments
  // sudo -E preserves env vars (needed for KNTRL_API_URL/KEY)
  const kntrlArgs = [
    "-E",
    "kntrl",
    "start",
    "--mode",
    mode,
    "--rules-dir",
    rulesDir,
    "--output-file-name",
    reportFile,
  ];

  // Append optional --rules-file flag for merging custom YAML rules
  if (customRulesFile && fs.existsSync(customRulesFile)) {
    kntrlArgs.push("--rules-file", customRulesFile);
  }

  // Forward Cloud API credentials via environment if configured
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (apiUrl) env.KNTRL_API_URL = apiUrl;
  if (apiKey) env.KNTRL_API_KEY = apiKey;

  core.startGroup("Starting kntrl agent");
  core.info(`Command: sudo ${kntrlArgs.join(" ")}`);

  // Spawn as a detached process so it outlives this Node.js action step.
  // stdout/stderr go to a log file for post-mortem debugging.
  const logFd = fs.openSync(LOG_FILE, "w");
  const child = spawn("sudo", kntrlArgs, {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env,
  });

  const pid = child.pid;
  if (!pid) {
    throw new Error("Failed to spawn kntrl process");
  }

  // Detach from the child so Node.js can exit without killing kntrl
  child.unref();
  fs.closeSync(logFd);

  // Write PID file (used by the stop step to send SIGTERM)
  await exec.exec("sudo", ["bash", "-c", `echo ${pid} > ${PID_FILE}`]);

  // Wait for eBPF probes to attach before proceeding with the workflow.
  // kntrl needs ~1-2 seconds to set up tracepoints; we wait 2s to be safe.
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Verify the daemon is still running (didn't crash during probe setup)
  try {
    process.kill(pid, 0); // signal 0 = just check if process exists
    core.info(`kntrl agent started (pid: ${pid})`);
  } catch {
    core.error("kntrl agent failed to start. Log output:");
    if (fs.existsSync(LOG_FILE)) {
      core.info(fs.readFileSync(LOG_FILE, "utf-8"));
    }
    throw new Error("kntrl agent failed to start");
  }

  core.endGroup();
}

/**
 * Stop the kntrl daemon and return its exit code.
 * Sends SIGTERM for graceful shutdown so kntrl can flush the report file.
 */
export async function stopDaemon(): Promise<number> {
  let exitCode = 0;

  core.startGroup("Stopping kntrl agent");

  if (fs.existsSync(PID_FILE)) {
    // Read the PID written by startDaemon
    let pid: string;
    try {
      const result = await exec.getExecOutput("sudo", ["cat", PID_FILE]);
      pid = result.stdout.trim();
    } catch {
      pid = "";
    }

    if (pid) {
      // Send SIGTERM for graceful shutdown
      await exec.exec("sudo", ["kill", pid], { ignoreReturnCode: true });

      // Poll up to 5 seconds waiting for the process to exit.
      // kntrl flushes the JSONL report file on SIGTERM before exiting.
      for (let i = 0; i < 10; i++) {
        try {
          await exec.exec("kill", ["-0", pid], { ignoreReturnCode: false });
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch {
          break; // Process is gone — shutdown complete
        }
      }
    }

    // Clean up PID file
    await exec.exec("sudo", ["rm", "-f", PID_FILE], { ignoreReturnCode: true });
  } else {
    // Fallback: no PID file found, try the kntrl stop command directly
    try {
      await exec.exec("sudo", ["kntrl", "stop"]);
    } catch {
      exitCode = 1;
    }
  }

  // Print daemon log for debugging (visible in the GitHub Actions log)
  if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 0) {
    core.info("--- kntrl daemon log ---");
    core.info(fs.readFileSync(LOG_FILE, "utf-8"));
    core.info("--- end daemon log ---");
  }

  core.endGroup();
  return exitCode;
}

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { spawn } from "child_process";
import * as fs from "fs";

const PID_FILE = "/var/run/kntrl.pid";
const LOG_FILE = "/tmp/kntrl-daemon.log";

export async function startDaemon(
  mode: string,
  rulesDir: string,
  reportFile: string,
  customRulesFile: string,
  customRulesDir: string,
  apiUrl: string,
  apiKey: string
): Promise<void> {
  // Copy custom rules dir contents into rules dir
  if (customRulesDir && fs.existsSync(customRulesDir)) {
    await exec.exec("cp", ["-r", `${customRulesDir}/.`, rulesDir], {
      ignoreReturnCode: true,
    });
  }

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

  if (customRulesFile && fs.existsSync(customRulesFile)) {
    kntrlArgs.push("--rules-file", customRulesFile);
  }

  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (apiUrl) env.KNTRL_API_URL = apiUrl;
  if (apiKey) env.KNTRL_API_KEY = apiKey;

  core.startGroup("Starting kntrl agent");
  core.info(`Command: sudo ${kntrlArgs.join(" ")}`);

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

  child.unref();
  fs.closeSync(logFd);

  // Write PID file
  await exec.exec("sudo", ["bash", "-c", `echo ${pid} > ${PID_FILE}`]);

  // Wait for eBPF probes to attach
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Verify process is alive
  try {
    process.kill(pid, 0);
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

export async function stopDaemon(): Promise<number> {
  let exitCode = 0;

  core.startGroup("Stopping kntrl agent");

  if (fs.existsSync(PID_FILE)) {
    let pid: string;
    try {
      const result = await exec.getExecOutput("sudo", ["cat", PID_FILE]);
      pid = result.stdout.trim();
    } catch {
      pid = "";
    }

    if (pid) {
      await exec.exec("sudo", ["kill", pid], { ignoreReturnCode: true });

      // Wait for graceful shutdown
      for (let i = 0; i < 10; i++) {
        try {
          await exec.exec("kill", ["-0", pid], { ignoreReturnCode: false });
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch {
          break;
        }
      }
    }

    await exec.exec("sudo", ["rm", "-f", PID_FILE], { ignoreReturnCode: true });
  } else {
    try {
      await exec.exec("sudo", ["kntrl", "stop"]);
    } catch {
      exitCode = 1;
    }
  }

  // Show daemon log
  if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 0) {
    core.info("--- kntrl daemon log ---");
    core.info(fs.readFileSync(LOG_FILE, "utf-8"));
    core.info("--- end daemon log ---");
  }

  core.endGroup();
  return exitCode;
}

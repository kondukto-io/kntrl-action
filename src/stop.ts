import * as core from "@actions/core";
import { stopDaemon } from "./lib/daemon";
import { renderReport } from "./lib/report";

async function run(): Promise<void> {
  try {
    const reportFile = core.getInput("report_file") || "/tmp/kntrl-report.json";

    // Step 1: Stop the daemon
    const exitCode = await stopDaemon();

    // Step 2: Render report
    renderReport(reportFile);

    core.setOutput("exit_code", String(exitCode));
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();

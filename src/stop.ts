/**
 * stop.ts — Entry point for the kntrl stop action (stop/action.yml).
 *
 * This is compiled by ncc into stop/dist/index.js.
 *
 * Execution flow:
 *   1. Send SIGTERM to the kntrl daemon and wait for graceful shutdown
 *   2. Parse the JSONL report file written by kntrl during the workflow
 *   3. Render a formatted security report to the GitHub Actions log
 *   4. Export the exit code as an action output
 *
 * Should always run with `if: always()` in the workflow so the report
 * is generated even when previous steps fail.
 */

import * as core from "@actions/core";
import { stopDaemon } from "./lib/daemon";
import { renderReport } from "./lib/report";

async function run(): Promise<void> {
  try {
    const reportFile = core.getInput("report_file") || "/tmp/kntrl-report.json";

    // Step 1: Gracefully stop the kntrl daemon (flushes report on exit)
    const exitCode = await stopDaemon();

    // Step 2: Parse JSONL events and render the security report
    renderReport(reportFile);

    core.setOutput("exit_code", String(exitCode));
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();

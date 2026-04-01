/**
 * start.ts — Main entry point for the kntrl GitHub Action (start step).
 *
 * This is the file compiled by ncc into dist/index.js and referenced
 * by action.yml's `runs.main` field.
 *
 * Execution flow:
 *   1. Parse all action inputs into a typed object
 *   2. Download and install the kntrl binary (with SHA256 verification)
 *   3. Generate the rules directory (rules.yaml + optional Rego files)
 *   4. Start the kntrl eBPF agent as a background daemon
 *   5. Export the report file path as an action output
 *
 * The daemon stays running in the background while subsequent workflow steps
 * execute. It is stopped later by the stop action (stop/action.yml).
 */

import * as core from "@actions/core";
import { getInputs } from "./lib/inputs";
import { installKntrl } from "./lib/install";
import { buildRulesDir } from "./lib/rules";
import { startDaemon } from "./lib/daemon";

async function run(): Promise<void> {
  try {
    const inputs = getInputs();

    // Step 1: Download, verify, and install the kntrl binary
    await installKntrl(inputs.kntrlVersion);

    // Step 2: Generate rules.yaml and copy Rego files into a temp directory
    const rulesDir = buildRulesDir(inputs);

    // Step 3: Launch the kntrl eBPF agent in the background
    const reportFile = "/tmp/kntrl-report.json";
    await startDaemon(
      inputs.mode,
      rulesDir,
      reportFile,
      inputs.customRulesFile,
      inputs.customRulesDir,
      inputs.apiUrl,
      inputs.apiKey
    );

    // Export the report path so the stop step (and downstream jobs) can find it
    core.setOutput("report_file", reportFile);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();

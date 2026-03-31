import * as core from "@actions/core";
import { getInputs } from "./lib/inputs";
import { installKntrl } from "./lib/install";
import { buildRulesDir } from "./lib/rules";
import { startDaemon } from "./lib/daemon";

async function run(): Promise<void> {
  try {
    const inputs = getInputs();

    // Step 1: Install kntrl binary
    await installKntrl(inputs.kntrlVersion);

    // Step 2: Build rules directory
    const rulesDir = buildRulesDir(inputs);

    // Step 3: Start kntrl daemon
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

    core.setOutput("report_file", reportFile);
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();

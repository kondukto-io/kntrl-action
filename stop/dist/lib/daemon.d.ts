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
export declare function startDaemon(mode: string, rulesDir: string, reportFile: string, customRulesFile: string, customRulesDir: string, apiUrl: string, apiKey: string): Promise<void>;
/**
 * Stop the kntrl daemon and return its exit code.
 * Sends SIGTERM for graceful shutdown so kntrl can flush the report file.
 */
export declare function stopDaemon(): Promise<number>;

/**
 * report.ts — Parse kntrl's JSONL report and render a rich ASCII security report.
 *
 * kntrl writes one JSON object per line to the report file. Each event is classified
 * by its fields into one of four categories:
 *
 *   - Network:  has "proto" + "daddr"          → outbound connection
 *   - Process:  has "event_type" + "ppid"      → process exec/fork
 *   - DNS:      has "dns_server" + "query_domain" → DNS query
 *   - File:     has "filename" + ("policy"|"operation") → file access
 *
 * The report output is structured as:
 *   1. Summary box — total event counts with pass/block breakdown
 *   2. Per-category tables — detailed rows for each event type
 *   3. Blocked events summary — consolidated list of all blocked activity
 *
 * Blocked events are highlighted with a ">>" marker in the leftmost column
 * so they stand out immediately in CI logs.
 */
/**
 * Parse the kntrl JSONL report file and render a formatted security report
 * to the GitHub Actions log via core.info().
 */
export declare function renderReport(reportFile: string): void;
/**
 * Render a consolidated summary of all blocked events across categories.
 * This section appears at the bottom of the report so it's the last thing
 * a developer sees — making it easy to spot what was blocked at a glance.
 */
/**
 * Render the kntrl report as Markdown to GitHub's per-job summary panel
 * (the file pointed to by $GITHUB_STEP_SUMMARY, surfaced one click below
 * the run's Checks tab).
 *
 * This is a parallel renderer to renderReport() — the ASCII log version
 * remains the system-of-record for log scraping and offline review; this
 * version is what reviewers actually see when triaging a PR check failure.
 *
 * Re-parses the JSONL file rather than sharing state with renderReport so
 * the function is safe to call independently and the existing log-render
 * code path is untouched. Report files are bounded (a few MB at most), so
 * the double parse is negligible.
 */
export declare function writeStepSummary(reportFile: string): Promise<void>;

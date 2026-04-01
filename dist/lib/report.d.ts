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

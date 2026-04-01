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

import * as core from "@actions/core";
import * as fs from "fs";

// ─────────────────────────────────────────────────────────────────────────────
// Event type definitions (matching kntrl's JSONL output schema)
// ─────────────────────────────────────────────────────────────────────────────

interface NetworkEvent {
  pid?: number;
  task_name?: string;
  proto?: string;
  daddr?: string;
  dport?: number;
  domains?: string[];
  policy?: string;
}

interface ProcessEvent {
  pid?: number;
  ppid?: number;
  comm?: string;
  args?: string;
  event_type?: string;  // "exec" or "fork"
  policy?: string;      // "block" when blocked in trace mode
  ancestors?: string[];
}

interface DnsEvent {
  query_domain?: string;
  dns_server?: string;
}

interface FileEvent {
  pid?: number;
  comm?: string;
  filename?: string;
  operation?: string;
  policy?: string;
  blocked?: boolean;
  matched_env_vars?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// String formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Pad or truncate a string to exactly `len` characters (right-padded with spaces). */
function col(s: string, len: number): string {
  if (s.length > len) return s.slice(0, len - 1) + "\u2026"; // truncate with ellipsis
  return s.padEnd(len);
}

/** Truncate from the right, appending "..." if too long. */
function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 3) + "..." : s;
}

/** Truncate from the left, prepending "..." if too long (useful for file paths). */
function truncateLeft(s: string, maxLen: number): string {
  return s.length > maxLen ? "..." + s.slice(-(maxLen - 3)) : s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main report renderer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse the kntrl JSONL report file and render a formatted security report
 * to the GitHub Actions log via core.info().
 */
export function renderReport(reportFile: string): void {
  if (!fs.existsSync(reportFile) || fs.statSync(reportFile).size === 0) {
    core.info("No kntrl report file found or file is empty.");
    return;
  }

  // ── Parse JSONL: one JSON object per line ──
  const content = fs.readFileSync(reportFile, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  const network: NetworkEvent[] = [];
  const processEvts: ProcessEvent[] = [];
  const dns: DnsEvent[] = [];
  const fileEvents: FileEvent[] = [];

  for (const line of lines) {
    try {
      const ev = JSON.parse(line);
      // Classify event by its characteristic fields
      if ("proto" in ev && "daddr" in ev) {
        network.push(ev);
      } else if ("event_type" in ev && "ppid" in ev) {
        processEvts.push(ev);
      } else if ("dns_server" in ev && "query_domain" in ev) {
        dns.push(ev);
      } else if ("filename" in ev && ("policy" in ev || "operation" in ev)) {
        fileEvents.push(ev);
      }
    } catch {
      // Skip malformed JSON lines (partial writes, etc.)
    }
  }

  if (!network.length && !processEvts.length && !dns.length && !fileEvents.length) {
    core.info("No events captured.");
    return;
  }

  // ── Compute summary statistics ──
  const netPass = network.filter((e) => e.policy === "pass").length;
  const netBlock = network.filter((e) => e.policy === "block").length;
  const procBlock = processEvts.filter((e) => e.policy === "block").length;
  const fileBlock = fileEvents.filter((e) => e.blocked).length;
  const totalBlocked = netBlock + procBlock + fileBlock;

  // ── Render summary box ──
  const W = 72; // report width
  const heavy = "\u2550".repeat(W); // ══════
  const light = "\u2500".repeat(W); // ──────

  core.info("");
  core.info(`\u2554${heavy}\u2557`);
  core.info(`\u2551${"  kntrl Runtime Security Report".padEnd(W)}\u2551`);
  core.info(`\u2560${heavy}\u2563`);
  core.info(`\u2551${"  Category        Count     Details".padEnd(W)}\u2551`);
  core.info(`\u2551${"  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500".padEnd(W)}\u2551`);
  core.info(`\u2551${"  Network         " + String(network.length).padStart(5) + "     pass: " + netPass + ", block: " + netBlock}`.padEnd(W + 1) + `\u2551`);
  core.info(`\u2551${"  Process         " + String(processEvts.length).padStart(5) + "     blocked: " + procBlock}`.padEnd(W + 1) + `\u2551`);
  core.info(`\u2551${"  DNS             " + String(dns.length).padStart(5)}`.padEnd(W + 1) + `\u2551`);
  core.info(`\u2551${"  File            " + String(fileEvents.length).padStart(5) + "     blocked: " + fileBlock}`.padEnd(W + 1) + `\u2551`);
  core.info(`\u2560${heavy}\u2563`);

  // Show a prominent status line
  if (totalBlocked > 0) {
    const statusMsg = `  !! ${totalBlocked} event(s) BLOCKED`;
    core.info(`\u2551${statusMsg.padEnd(W)}\u2551`);
  } else {
    const statusMsg = `  All clear -- no events blocked`;
    core.info(`\u2551${statusMsg.padEnd(W)}\u2551`);
  }
  core.info(`\u255A${heavy}\u255D`);
  core.info("");

  // ── Network connections table ──
  if (network.length) {
    renderNetworkTable(network);
  }

  // ── DNS queries table (deduplicated) ──
  if (dns.length) {
    renderDnsTable(dns);
  }

  // ── Process executions table (exec events only) ──
  if (processEvts.length) {
    renderProcessTable(processEvts);
  }

  // ── File access events table ──
  if (fileEvents.length) {
    renderFileTable(fileEvents);
  }

  // ── Blocked events summary ──
  const blockedNet = network.filter((e) => e.policy === "block");
  const blockedProc = processEvts.filter((e) => e.policy === "block");
  const blockedFiles = fileEvents.filter((e) => e.blocked);

  if (blockedNet.length || blockedProc.length || blockedFiles.length) {
    renderBlockedSummary(blockedNet, blockedProc, blockedFiles);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-category table renderers
// ─────────────────────────────────────────────────────────────────────────────

function renderNetworkTable(events: NetworkEvent[]): void {
  core.info("\u250C\u2500 Network Connections \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
  core.info(
    `  ${col("PID", 7)}${col("Process", 15)}${col("Proto", 6)}${col("Destination", 24)}${col("Domain", 30)}${col("Policy", 8)}`
  );
  core.info("  " + "\u2500".repeat(90));

  for (const ev of events) {
    const domains = (ev.domains || []).join(", ") || "-";
    const dest = `${ev.daddr || "?"}:${ev.dport || "?"}`;
    const policy = ev.policy || "?";
    // Blocked rows get a ">>" prefix so they visually pop in CI logs
    const marker = policy === "block" ? ">>" : "  ";
    core.info(
      `${marker}${col(String(ev.pid || "?"), 7)}${col(ev.task_name || "?", 15)}${col(ev.proto || "?", 6)}${col(dest, 24)}${col(truncate(domains, 30), 30)}${col(policy, 8)}`
    );
  }
  core.info("");
}

function renderDnsTable(events: DnsEvent[]): void {
  // Deduplicate DNS queries — same domain+server seen multiple times
  const seen = new Set<string>();
  const unique: DnsEvent[] = [];
  for (const ev of events) {
    const key = `${ev.query_domain || ""}|${ev.dns_server || ""}`;
    if (ev.query_domain && !seen.has(key)) {
      seen.add(key);
      unique.push(ev);
    }
  }

  if (!unique.length) return;

  core.info(`\u250C\u2500 DNS Queries (${unique.length} unique) ${ "\u2500".repeat(Math.max(0, 50 - String(unique.length).length))}\u2510`);
  core.info(`  ${col("Domain", 50)}${col("DNS Server", 20)}`);
  core.info("  " + "\u2500".repeat(70));

  for (const ev of unique) {
    core.info(`  ${col(ev.query_domain || "?", 50)}${col(ev.dns_server || "?", 20)}`);
  }
  core.info("");
}

function renderProcessTable(events: ProcessEvent[]): void {
  // Only show exec events (not forks) — execs are the interesting security events
  const execs = events.filter((e) => e.event_type === "exec");
  if (!execs.length) return;

  core.info(`\u250C\u2500 Process Executions (${execs.length} events) ${"\u2500".repeat(Math.max(0, 45 - String(execs.length).length))}\u2510`);
  core.info(
    `  ${col("PID", 7)}${col("PPID", 7)}${col("Comm", 14)}${col("Arguments", 42)}${col("Policy", 8)}`
  );
  core.info("  " + "\u2500".repeat(78));

  for (const ev of execs) {
    const policy = ev.policy || "";
    const marker = policy === "block" ? ">>" : "  ";
    const args = truncate(ev.args || ev.comm || "?", 42);
    core.info(
      `${marker}${col(String(ev.pid || "?"), 7)}${col(String(ev.ppid || "?"), 7)}${col(ev.comm || "?", 14)}${col(args, 42)}${col(policy, 8)}`
    );
  }
  core.info("");
}

function renderFileTable(events: FileEvent[]): void {
  core.info(`\u250C\u2500 File Access Events (${events.length} events) ${"\u2500".repeat(Math.max(0, 44 - String(events.length).length))}\u2510`);
  core.info(
    `  ${col("PID", 7)}${col("Comm", 14)}${col("Op", 8)}${col("Filename", 40)}${col("Env Vars", 22)}${col("Policy", 8)}`
  );
  core.info("  " + "\u2500".repeat(99));

  for (const ev of events) {
    const op = ev.operation || "open";
    const envVars = (ev.matched_env_vars || []).join(", ") || "-";
    const policy = ev.policy || "";
    const blocked = ev.blocked || false;
    const marker = blocked ? ">>" : "  ";
    const fname = truncateLeft(ev.filename || "?", 40);
    core.info(
      `${marker}${col(String(ev.pid || "?"), 7)}${col(ev.comm || "?", 14)}${col(op, 8)}${col(fname, 40)}${col(truncate(envVars, 22), 22)}${col(policy, 8)}`
    );
  }
  core.info("");
}

// ─────────────────────────────────────────────────────────────────────────────
// Blocked events summary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render a consolidated summary of all blocked events across categories.
 * This section appears at the bottom of the report so it's the last thing
 * a developer sees — making it easy to spot what was blocked at a glance.
 */
function renderBlockedSummary(
  blockedNet: NetworkEvent[],
  blockedProc: ProcessEvent[],
  blockedFiles: FileEvent[]
): void {
  const W = 72;
  const heavy = "\u2550".repeat(W);

  core.info(`\u2554${heavy}\u2557`);
  core.info(`\u2551${"  BLOCKED EVENTS SUMMARY".padEnd(W)}\u2551`);
  core.info(`\u255A${heavy}\u255D`);

  if (blockedNet.length) {
    core.info(`\n  Network (${blockedNet.length} blocked):`);
    for (const ev of blockedNet) {
      const domains = (ev.domains || []).join(", ") || ev.daddr || "?";
      core.info(`    >> ${ev.task_name || "?"} -> ${domains}:${ev.dport || "?"} (${ev.proto || "?"})`);
    }
  }

  if (blockedProc.length) {
    core.info(`\n  Process (${blockedProc.length} blocked):`);
    for (const ev of blockedProc) {
      const ancestors = (ev.ancestors || []).join(" > ");
      const chain = ancestors ? ` (chain: ${ancestors})` : "";
      core.info(`    >> ${ev.comm || "?"} [pid:${ev.pid || "?"}]${chain}`);
    }
  }

  if (blockedFiles.length) {
    core.info(`\n  File (${blockedFiles.length} blocked):`);
    for (const ev of blockedFiles) {
      core.info(`    >> ${ev.comm || "?"} -> ${ev.filename || "?"}`);
    }
  }

  core.info("");
}

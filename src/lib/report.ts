import * as core from "@actions/core";
import * as fs from "fs";

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
  event_type?: string;
  policy?: string;
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

function pad(s: string, len: number): string {
  return s.length > len ? s.slice(0, len) : s.padEnd(len);
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 3) + "..." : s;
}

function truncateLeft(s: string, maxLen: number): string {
  return s.length > maxLen ? "..." + s.slice(-(maxLen - 3)) : s;
}

export function renderReport(reportFile: string): void {
  if (!fs.existsSync(reportFile) || fs.statSync(reportFile).size === 0) {
    core.info("No kntrl report file found or file is empty.");
    return;
  }

  const content = fs.readFileSync(reportFile, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  const network: NetworkEvent[] = [];
  const processEvts: ProcessEvent[] = [];
  const dns: DnsEvent[] = [];
  const fileEvents: FileEvent[] = [];

  for (const line of lines) {
    try {
      const ev = JSON.parse(line);
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
      // skip malformed lines
    }
  }

  if (!network.length && !processEvts.length && !dns.length && !fileEvents.length) {
    core.info("No events captured.");
    return;
  }

  // Summary
  const netPass = network.filter((e) => e.policy === "pass").length;
  const netBlock = network.filter((e) => e.policy === "block").length;
  const procBlock = processEvts.filter((e) => e.policy === "block").length;
  const fileBlock = fileEvents.filter((e) => e.blocked).length;

  const sep = "=".repeat(70);
  const line70 = "-".repeat(70);

  core.info(sep);
  core.info("  kntrl Runtime Security Report");
  core.info(sep);
  core.info(`  Network events: ${String(network.length).padStart(5)}  (pass: ${netPass}, block: ${netBlock})`);
  core.info(`  Process events: ${String(processEvts.length).padStart(5)}  (blocked: ${procBlock})`);
  core.info(`  DNS events:     ${String(dns.length).padStart(5)}`);
  core.info(`  File events:    ${String(fileEvents.length).padStart(5)}  (blocked: ${fileBlock})`);
  core.info(sep);

  // Network table
  if (network.length) {
    core.info("\n--- Network Connections ---");
    core.info(
      `${pad("PID", 8)}${pad("Process", 16)}${pad("Proto", 6)}${pad("Destination", 32)}${pad("Domain", 35)}${pad("Policy", 8)}`
    );
    core.info("-".repeat(105));
    for (const ev of network) {
      const domains = (ev.domains || []).join(", ") || ".";
      const dest = `${ev.daddr || "?"}:${ev.dport || "?"}`;
      const policy = ev.policy || "?";
      const marker = policy === "block" ? ">> " : "   ";
      core.info(
        `${marker}${pad(String(ev.pid || "?"), 5)}${pad(ev.task_name || "?", 16)}${pad(ev.proto || "?", 6)}${pad(dest, 32)}${pad(domains, 35)}${pad(policy, 8)}`
      );
    }
  }

  // DNS table
  if (dns.length) {
    const seen = new Set<string>();
    const uniqueDns: DnsEvent[] = [];
    for (const ev of dns) {
      const key = `${ev.query_domain || ""}|${ev.dns_server || ""}`;
      if (ev.query_domain && !seen.has(key)) {
        seen.add(key);
        uniqueDns.push(ev);
      }
    }

    if (uniqueDns.length) {
      core.info(`\n--- DNS Queries (${uniqueDns.length} unique) ---`);
      core.info(`${pad("Domain", 50)}${pad("DNS Server", 20)}`);
      core.info(line70);
      for (const ev of uniqueDns) {
        core.info(`${pad(ev.query_domain || "?", 50)}${pad(ev.dns_server || "?", 20)}`);
      }
    }
  }

  // Process table (exec events only)
  if (processEvts.length) {
    const execs = processEvts.filter((e) => e.event_type === "exec");
    if (execs.length) {
      core.info(`\n--- Process Executions (${execs.length} exec events) ---`);
      core.info(
        `${pad("PID", 8)}${pad("PPID", 8)}${pad("Comm", 16)}${pad("Args", 50)}${pad("Policy", 8)}`
      );
      core.info("-".repeat(90));
      for (const ev of execs) {
        const policy = ev.policy || "";
        const marker = policy === "block" ? ">> " : "   ";
        const args = truncate(ev.args || ev.comm || "?", 50);
        core.info(
          `${marker}${pad(String(ev.pid || "?"), 5)}${pad(String(ev.ppid || "?"), 8)}${pad(ev.comm || "?", 16)}${pad(args, 50)}${pad(policy, 8)}`
        );
      }
    }
  }

  // File table
  if (fileEvents.length) {
    core.info(`\n--- File Access Events (${fileEvents.length} events) ---`);
    core.info(
      `${pad("PID", 8)}${pad("Comm", 16)}${pad("Op", 8)}${pad("Filename", 45)}${pad("Env Vars", 25)}${pad("Policy", 8)}`
    );
    core.info("-".repeat(110));
    for (const ev of fileEvents) {
      const op = ev.operation || "open";
      const envVars = (ev.matched_env_vars || []).join(", ") || ".";
      const policy = ev.policy || "";
      const blocked = ev.blocked || false;
      const marker = blocked ? ">> " : "   ";
      const fname = truncateLeft(ev.filename || "?", 45);
      core.info(
        `${marker}${pad(String(ev.pid || "?"), 5)}${pad(ev.comm || "?", 16)}${pad(op, 8)}${pad(fname, 45)}${pad(envVars, 25)}${pad(policy, 8)}`
      );
    }
  }

  // Blocked events summary
  const blockedNet = network.filter((e) => e.policy === "block");
  const blockedProc = processEvts.filter((e) => e.policy === "block");
  const blockedFiles = fileEvents.filter((e) => e.blocked);

  if (blockedNet.length || blockedProc.length || blockedFiles.length) {
    core.info(`\n${sep}`);
    core.info("  BLOCKED EVENTS SUMMARY");
    core.info(sep);

    if (blockedNet.length) {
      core.info(`\n  Network (${blockedNet.length} blocked):`);
      for (const ev of blockedNet) {
        const domains = (ev.domains || []).join(", ") || ev.daddr || "?";
        core.info(`    - ${ev.task_name || "?"} -> ${domains}:${ev.dport || "?"} (${ev.proto || "?"})`);
      }
    }

    if (blockedProc.length) {
      core.info(`\n  Process (${blockedProc.length} blocked):`);
      for (const ev of blockedProc) {
        const ancestors = (ev.ancestors || []).join(" > ");
        const chain = ancestors ? ` (chain: ${ancestors})` : "";
        core.info(`    - ${ev.comm || "?"} [pid:${ev.pid || "?"}]${chain}`);
      }
    }

    if (blockedFiles.length) {
      core.info(`\n  File (${blockedFiles.length} blocked):`);
      for (const ev of blockedFiles) {
        core.info(`    - ${ev.comm || "?"} -> ${ev.filename || "?"}`);
      }
    }

    core.info("");
  }
}

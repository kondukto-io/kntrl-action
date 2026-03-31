import * as core from "@actions/core";
import { BlockedChain, NetworkProfile } from "./defaults";

export interface ActionInputs {
  mode: string;
  kntrlVersion: string;
  apiUrl: string;
  apiKey: string;
  enableDefaultNetworkRules: boolean;
  enableDefaultProcessRules: boolean;
  enableDefaultDnsRules: boolean;
  enableDefaultFileRules: boolean;
  enableDefaultSupplyChainRego: boolean;
  allowedHosts: string[];
  allowedIps: string[];
  allowLocalRanges: boolean;
  allowGithubMeta: boolean;
  allowMetadata: boolean;
  extraBlockedExecutables: string[];
  extraMonitoredPaths: string[];
  extraProtectedPaths: string[];
  extraMonitoredEnvVars: string[];
  customRulesFile: string;
  customRulesDir: string;
  customRegoFile: string;
  networkProfiles: NetworkProfile[];
  extraBlockedChains: BlockedChain[];
}

function parseCSV(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBool(input: string): boolean {
  return input.toLowerCase() === "true";
}

function parseJSON<T>(input: string, label: string): T[] {
  if (!input) return [];
  try {
    return JSON.parse(input) as T[];
  } catch (e) {
    core.setFailed(`Invalid JSON for ${label}: ${(e as Error).message}`);
    return [];
  }
}

export function getInputs(): ActionInputs {
  return {
    mode: core.getInput("mode") || "monitor",
    kntrlVersion: core.getInput("kntrl_version") || "v0.2.1",
    apiUrl: core.getInput("api_url"),
    apiKey: core.getInput("api_key"),
    enableDefaultNetworkRules: parseBool(core.getInput("enable_default_network_rules") || "true"),
    enableDefaultProcessRules: parseBool(core.getInput("enable_default_process_rules") || "true"),
    enableDefaultDnsRules: parseBool(core.getInput("enable_default_dns_rules") || "true"),
    enableDefaultFileRules: parseBool(core.getInput("enable_default_file_rules") || "true"),
    enableDefaultSupplyChainRego: parseBool(core.getInput("enable_default_supply_chain_rego") || "true"),
    allowedHosts: parseCSV(core.getInput("allowed_hosts")),
    allowedIps: parseCSV(core.getInput("allowed_ips")),
    allowLocalRanges: parseBool(core.getInput("allow_local_ranges") || "true"),
    allowGithubMeta: parseBool(core.getInput("allow_github_meta") || "true"),
    allowMetadata: parseBool(core.getInput("allow_metadata") || "false"),
    extraBlockedExecutables: parseCSV(core.getInput("extra_blocked_executables")),
    extraMonitoredPaths: parseCSV(core.getInput("extra_monitored_paths")),
    extraProtectedPaths: parseCSV(core.getInput("extra_protected_paths")),
    extraMonitoredEnvVars: parseCSV(core.getInput("extra_monitored_env_vars")),
    customRulesFile: core.getInput("custom_rules_file"),
    customRulesDir: core.getInput("custom_rules_dir"),
    customRegoFile: core.getInput("custom_rego_file"),
    networkProfiles: parseJSON<NetworkProfile>(core.getInput("network_profiles"), "network_profiles"),
    extraBlockedChains: parseJSON<BlockedChain>(core.getInput("extra_blocked_chains"), "extra_blocked_chains"),
  };
}

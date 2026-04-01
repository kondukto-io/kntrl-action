/**
 * inputs.ts — Parse and validate all GitHub Action inputs.
 *
 * Maps the 23 action.yml inputs into a strongly-typed ActionInputs object.
 * Handles three input formats:
 *   - Boolean strings ("true"/"false") → parseBool()
 *   - Comma-separated lists → parseCSV()
 *   - JSON arrays (network_profiles, extra_blocked_chains) → parseJSON()
 *
 * Fallback defaults match action.yml so the action works even if core.getInput()
 * returns empty (e.g. when testing locally without INPUT_ env vars).
 */

import * as core from "@actions/core";
import { BlockedChain, NetworkProfile } from "./defaults";

/** Strongly-typed representation of every action input. */
export interface ActionInputs {
  // General
  mode: string;
  kntrlVersion: string;

  // Cloud
  apiUrl: string;
  apiKey: string;

  // Default rule toggles
  enableDefaultNetworkRules: boolean;
  enableDefaultProcessRules: boolean;
  enableDefaultDnsRules: boolean;
  enableDefaultFileRules: boolean;
  enableDefaultSupplyChainRego: boolean;

  // Network overrides
  allowedHosts: string[];
  allowedIps: string[];
  allowLocalRanges: boolean;
  allowGithubMeta: boolean;
  allowMetadata: boolean;

  // Process overrides
  extraBlockedExecutables: string[];

  // File overrides
  extraMonitoredPaths: string[];
  extraProtectedPaths: string[];
  extraMonitoredEnvVars: string[];

  // Custom rules
  customRulesFile: string;
  customRulesDir: string;
  customRegoFile: string;

  // JSON inputs
  networkProfiles: NetworkProfile[];
  extraBlockedChains: BlockedChain[];
}

/**
 * Split a comma-separated string into trimmed, non-empty tokens.
 * e.g. " .example.com , api.foo.io , " → [".example.com", "api.foo.io"]
 */
function parseCSV(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse a boolean string — only "true" (case-insensitive) returns true. */
function parseBool(input: string): boolean {
  return input.toLowerCase() === "true";
}

/**
 * Parse a JSON array input. On invalid JSON, fails the action via core.setFailed()
 * and returns an empty array so the rest of the action can still run gracefully.
 */
function parseJSON<T>(input: string, label: string): T[] {
  if (!input) return [];
  try {
    return JSON.parse(input) as T[];
  } catch (e) {
    core.setFailed(`Invalid JSON for ${label}: ${(e as Error).message}`);
    return [];
  }
}

/**
 * Read all action inputs from the GitHub Actions runtime environment.
 * Each input has a fallback default that mirrors action.yml, so the code
 * works correctly both in CI and during local testing.
 */
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

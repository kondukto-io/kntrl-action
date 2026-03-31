import * as fs from "fs";
import * as path from "path";
import * as core from "@actions/core";
import YAML from "yaml";
import { ActionInputs } from "./inputs";
import {
  DEFAULT_NETWORK_HOSTS,
  DEFAULT_NETWORK_IPS,
  DEFAULT_NETWORK_PROFILES,
  DEFAULT_BLOCKED_CHAINS,
  DEFAULT_BLOCKED_EXECUTABLES,
  DEFAULT_DNS_SERVERS,
  DEFAULT_FILE_MONITORED_PATHS,
  DEFAULT_FILE_PROTECTED_PATHS,
  DEFAULT_FILE_ENV_VARS,
  NetworkProfile,
  BlockedChain,
} from "./defaults";

interface RulesObject {
  version: string;
  mode: string;
  rules: {
    network?: {
      allowed_hosts?: string[];
      allowed_ips?: string[];
      allow_local_ranges?: boolean;
      allow_github_meta?: boolean;
      allow_metadata?: boolean;
      profiles?: Array<{ process: string; allowed_hosts: string[] }>;
    };
    process?: {
      enabled: boolean;
      blocked_chains?: Array<{ process: string; ancestors: string[] }>;
      blocked_executables?: string[];
    };
    dns?: {
      allowed_servers: string[];
    };
    file?: {
      enabled: boolean;
      monitored_paths?: string[];
      protected_paths?: string[];
      monitored_env_vars?: string[];
    };
  };
  webhooks: never[];
}

export function buildRulesDir(inputs: ActionInputs): string {
  const rulesDir = "/tmp/kntrl-rules";
  fs.mkdirSync(rulesDir, { recursive: true });

  const rules = buildRulesObject(inputs);

  const rulesFile = path.join(rulesDir, "rules.yaml");
  fs.writeFileSync(rulesFile, YAML.stringify(rules));

  // Copy rego files
  if (inputs.enableDefaultSupplyChainRego) {
    const regoSrc = path.join(__dirname, "supply_chain.rego");
    if (fs.existsSync(regoSrc)) {
      fs.copyFileSync(regoSrc, path.join(rulesDir, "supply_chain.rego"));
    } else {
      core.warning("Default supply_chain.rego not found in action bundle");
    }
  }

  if (inputs.customRegoFile && fs.existsSync(inputs.customRegoFile)) {
    fs.copyFileSync(
      inputs.customRegoFile,
      path.join(rulesDir, path.basename(inputs.customRegoFile))
    );
  }

  core.startGroup("Generated kntrl rules");
  core.info(fs.readFileSync(rulesFile, "utf-8"));
  core.info("---");
  const files = fs.readdirSync(rulesDir);
  for (const f of files) {
    const stat = fs.statSync(path.join(rulesDir, f));
    core.info(`${f} (${stat.size} bytes)`);
  }
  core.endGroup();

  return rulesDir;
}

function buildRulesObject(inputs: ActionInputs): RulesObject {
  const rules: RulesObject = {
    version: "1",
    mode: inputs.mode,
    rules: {},
    webhooks: [],
  };

  // Network
  const hasNetwork =
    inputs.enableDefaultNetworkRules ||
    inputs.allowedHosts.length > 0 ||
    inputs.allowedIps.length > 0;

  if (hasNetwork) {
    const network: RulesObject["rules"]["network"] = {};

    // Allowed hosts
    const hosts: string[] = [];
    if (inputs.enableDefaultNetworkRules) hosts.push(...DEFAULT_NETWORK_HOSTS);
    hosts.push(...inputs.allowedHosts);
    if (hosts.length > 0) network.allowed_hosts = hosts;

    // Allowed IPs
    const ips: string[] = [];
    if (inputs.enableDefaultNetworkRules) ips.push(...DEFAULT_NETWORK_IPS);
    ips.push(...inputs.allowedIps);
    if (ips.length > 0) network.allowed_ips = ips;

    network.allow_local_ranges = inputs.allowLocalRanges;
    network.allow_github_meta = inputs.allowGithubMeta;
    network.allow_metadata = inputs.allowMetadata;

    // Profiles
    const profiles: NetworkProfile[] = [];
    if (inputs.enableDefaultNetworkRules) profiles.push(...DEFAULT_NETWORK_PROFILES);
    profiles.push(...inputs.networkProfiles);
    if (profiles.length > 0) {
      network.profiles = profiles.map((p) => ({
        process: p.process,
        allowed_hosts: p.allowed_hosts,
      }));
    }

    rules.rules.network = network;
  }

  // Process
  const hasProcess =
    inputs.enableDefaultProcessRules ||
    inputs.extraBlockedExecutables.length > 0 ||
    inputs.extraBlockedChains.length > 0;

  if (hasProcess) {
    const proc: RulesObject["rules"]["process"] = { enabled: true };

    // Blocked chains
    const chains: BlockedChain[] = [];
    if (inputs.enableDefaultProcessRules) chains.push(...DEFAULT_BLOCKED_CHAINS);
    chains.push(...inputs.extraBlockedChains);
    if (chains.length > 0) {
      proc.blocked_chains = chains.map((c) => ({
        process: c.process,
        ancestors: c.ancestors,
      }));
    }

    // Blocked executables
    const execs: string[] = [];
    if (inputs.enableDefaultProcessRules) execs.push(...DEFAULT_BLOCKED_EXECUTABLES);
    execs.push(...inputs.extraBlockedExecutables);
    if (execs.length > 0) proc.blocked_executables = execs;

    rules.rules.process = proc;
  }

  // DNS
  if (inputs.enableDefaultDnsRules) {
    rules.rules.dns = { allowed_servers: [...DEFAULT_DNS_SERVERS] };
  }

  // File
  const hasFile =
    inputs.enableDefaultFileRules ||
    inputs.extraMonitoredPaths.length > 0 ||
    inputs.extraProtectedPaths.length > 0 ||
    inputs.extraMonitoredEnvVars.length > 0;

  if (hasFile) {
    const file: RulesObject["rules"]["file"] = { enabled: true };

    const monPaths: string[] = [];
    if (inputs.enableDefaultFileRules) monPaths.push(...DEFAULT_FILE_MONITORED_PATHS);
    monPaths.push(...inputs.extraMonitoredPaths);
    if (monPaths.length > 0) file.monitored_paths = monPaths;

    const protPaths: string[] = [];
    if (inputs.enableDefaultFileRules) protPaths.push(...DEFAULT_FILE_PROTECTED_PATHS);
    protPaths.push(...inputs.extraProtectedPaths);
    if (protPaths.length > 0) file.protected_paths = protPaths;

    const envVars: string[] = [];
    if (inputs.enableDefaultFileRules) envVars.push(...DEFAULT_FILE_ENV_VARS);
    envVars.push(...inputs.extraMonitoredEnvVars);
    if (envVars.length > 0) file.monitored_env_vars = envVars;

    rules.rules.file = file;
  }

  return rules;
}

/**
 * defaults.ts — Built-in security rule data shipped with the action.
 *
 * These constants replace the old .txt files (network_hosts.txt, process_rules.txt, etc.)
 * that were read at runtime by the bash composite action. By embedding them as typed
 * constants we get compile-time safety, easier maintenance, and no filesystem dependency.
 *
 * Each constant is used by rules.ts when the corresponding "enable_default_*" input is true.
 * User-supplied extras (from action inputs) are appended after these defaults.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Network — Allowed hosts that CI/CD workflows typically need
// ─────────────────────────────────────────────────────────────────────────────

/** Hostnames allowed by default for outbound connections (package registries, GitHub, CDNs). */
export const DEFAULT_NETWORK_HOSTS: string[] = [
  // npm / Node.js
  "registry.npmjs.org",
  ".npmjs.org",
  ".npmjs.com",
  // PyPI / Python
  "pypi.org",
  "files.pythonhosted.org",
  ".pypi.org",
  // GitHub
  "github.com",
  ".github.com",
  ".githubusercontent.com",
  ".githubassets.com",
  ".actions.githubusercontent.com",
  // CDNs
  ".cloudflare.com",
  ".fastly.net",
];

/** RFC 1918 private ranges — always included when default network rules are on. */
export const DEFAULT_NETWORK_IPS: string[] = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
];

// ─────────────────────────────────────────────────────────────────────────────
// Network profiles — Per-process host restrictions
// ─────────────────────────────────────────────────────────────────────────────

/** A network profile restricts a specific process to only connect to its expected hosts. */
export interface NetworkProfile {
  process: string;
  allowed_hosts: string[];
}

/**
 * Default per-process network profiles.
 * When active, npm/node may only reach npm registries, pip/python may only reach PyPI.
 * This prevents supply-chain attacks where a compromised package phones home to an
 * unexpected domain.
 */
export const DEFAULT_NETWORK_PROFILES: NetworkProfile[] = [
  { process: "npm", allowed_hosts: ["registry.npmjs.org", ".npmjs.org", ".npmjs.com"] },
  { process: "node", allowed_hosts: ["registry.npmjs.org", ".npmjs.org", ".npmjs.com"] },
  { process: "pip", allowed_hosts: ["pypi.org", "files.pythonhosted.org", ".pypi.org"] },
  { process: "pip3", allowed_hosts: ["pypi.org", "files.pythonhosted.org", ".pypi.org"] },
  { process: "python", allowed_hosts: ["pypi.org", "files.pythonhosted.org", ".pypi.org"] },
  { process: "python3", allowed_hosts: ["pypi.org", "files.pythonhosted.org", ".pypi.org"] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Process — Blocked chains and executables
// ─────────────────────────────────────────────────────────────────────────────

/** A blocked chain defines a process that should be denied when spawned by certain ancestors. */
export interface BlockedChain {
  process: string;
  ancestors: string[];
}

/**
 * Default blocked process chains.
 * These catch classic supply-chain attack patterns:
 *   - npm postinstall scripts spawning curl/wget (data exfiltration)
 *   - pip setup.py spawning network tools
 *   - Package managers launching unexpected interpreters (python from npm, etc.)
 *   - Netcat/socat from any package manager context
 */
export const DEFAULT_BLOCKED_CHAINS: BlockedChain[] = [
  // npm/node → curl/wget (exfiltration via HTTP)
  { process: "curl", ancestors: ["npm"] },
  { process: "curl", ancestors: ["npm", "node"] },
  { process: "wget", ancestors: ["npm"] },
  { process: "wget", ancestors: ["npm", "node"] },
  // pip → curl/wget
  { process: "curl", ancestors: ["pip"] },
  { process: "curl", ancestors: ["pip3"] },
  { process: "wget", ancestors: ["pip"] },
  { process: "wget", ancestors: ["pip3"] },
  // npm → unexpected interpreters (cross-ecosystem escalation)
  { process: "python", ancestors: ["npm"] },
  { process: "python3", ancestors: ["npm"] },
  { process: "perl", ancestors: ["npm"] },
  { process: "ruby", ancestors: ["npm"] },
  // Package managers → raw socket tools
  { process: "nc", ancestors: ["npm"] },
  { process: "nc", ancestors: ["pip"] },
  { process: "ncat", ancestors: ["npm"] },
  { process: "ncat", ancestors: ["pip"] },
  { process: "socat", ancestors: ["npm"] },
  { process: "socat", ancestors: ["pip"] },
];

/** Executables blocked unconditionally regardless of ancestry (dangerous tools). */
export const DEFAULT_BLOCKED_EXECUTABLES: string[] = [
  "nc",        // netcat — raw TCP/UDP connections
  "ncat",      // nmap's netcat variant
  "nmap",      // network scanner
  "socat",     // multipurpose relay
  "trufflehog", // credential scanner (red flag if present in CI)
];

// ─────────────────────────────────────────────────────────────────────────────
// DNS — Allowed DNS servers
// ─────────────────────────────────────────────────────────────────────────────

/** DNS servers allowed by default (Google Public DNS + Cloudflare). */
export const DEFAULT_DNS_SERVERS: string[] = [
  "8.8.8.8",  // Google
  "8.8.4.4",  // Google
  "1.1.1.1",  // Cloudflare
  "1.0.0.1",  // Cloudflare
];

// ─────────────────────────────────────────────────────────────────────────────
// File monitoring — Paths and environment variables to watch
// ─────────────────────────────────────────────────────────────────────────────

/** File paths monitored for reads (credential files, auth configs, cloud secrets). */
export const DEFAULT_FILE_MONITORED_PATHS: string[] = [
  "/.npmrc",             // npm auth token
  "/.pypirc",            // PyPI credentials
  "/pip.conf",           // pip config (may contain index URLs with tokens)
  "/.ssh/",              // SSH keys
  "/.aws/",              // AWS credentials
  "/.azure/",            // Azure credentials
  "/.config/gcloud/",    // GCP credentials
  "/var/run/secrets/",   // Kubernetes mounted secrets
  "/.kube/config",       // Kubernetes config
  "/.config/gh/",        // GitHub CLI auth
];

/** File paths protected from writes (system security files that should never be modified). */
export const DEFAULT_FILE_PROTECTED_PATHS: string[] = [
  "/etc/sudoers",
  "/etc/sudoers.d/",
  "/etc/passwd",
  "/etc/shadow",
  "/root/.ssh/authorized_keys",
];

/** Environment variables monitored for access (secrets, tokens, credentials). */
export const DEFAULT_FILE_ENV_VARS: string[] = [
  "NPM_TOKEN",
  "NPM_AUTH_TOKEN",
  "NODE_AUTH_TOKEN",
  "TWINE_PASSWORD",
  "PYPI_TOKEN",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AZURE_CLIENT_SECRET",
  "AZURE_TENANT_ID",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "DOCKER_AUTH_CONFIG",
  "CI_JOB_TOKEN",
  "RUNNER_TOKEN",
];

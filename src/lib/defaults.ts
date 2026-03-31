export const DEFAULT_NETWORK_HOSTS: string[] = [
  "registry.npmjs.org",
  ".npmjs.org",
  ".npmjs.com",
  "pypi.org",
  "files.pythonhosted.org",
  ".pypi.org",
  "github.com",
  ".github.com",
  ".githubusercontent.com",
  ".githubassets.com",
  ".actions.githubusercontent.com",
  ".cloudflare.com",
  ".fastly.net",
];

export const DEFAULT_NETWORK_IPS: string[] = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
];

export interface NetworkProfile {
  process: string;
  allowed_hosts: string[];
}

export const DEFAULT_NETWORK_PROFILES: NetworkProfile[] = [
  { process: "npm", allowed_hosts: ["registry.npmjs.org", ".npmjs.org", ".npmjs.com"] },
  { process: "node", allowed_hosts: ["registry.npmjs.org", ".npmjs.org", ".npmjs.com"] },
  { process: "pip", allowed_hosts: ["pypi.org", "files.pythonhosted.org", ".pypi.org"] },
  { process: "pip3", allowed_hosts: ["pypi.org", "files.pythonhosted.org", ".pypi.org"] },
  { process: "python", allowed_hosts: ["pypi.org", "files.pythonhosted.org", ".pypi.org"] },
  { process: "python3", allowed_hosts: ["pypi.org", "files.pythonhosted.org", ".pypi.org"] },
];

export interface BlockedChain {
  process: string;
  ancestors: string[];
}

export const DEFAULT_BLOCKED_CHAINS: BlockedChain[] = [
  { process: "curl", ancestors: ["npm"] },
  { process: "curl", ancestors: ["npm", "node"] },
  { process: "wget", ancestors: ["npm"] },
  { process: "wget", ancestors: ["npm", "node"] },
  { process: "curl", ancestors: ["pip"] },
  { process: "curl", ancestors: ["pip3"] },
  { process: "wget", ancestors: ["pip"] },
  { process: "wget", ancestors: ["pip3"] },
  { process: "python", ancestors: ["npm"] },
  { process: "python3", ancestors: ["npm"] },
  { process: "perl", ancestors: ["npm"] },
  { process: "ruby", ancestors: ["npm"] },
  { process: "nc", ancestors: ["npm"] },
  { process: "nc", ancestors: ["pip"] },
  { process: "ncat", ancestors: ["npm"] },
  { process: "ncat", ancestors: ["pip"] },
  { process: "socat", ancestors: ["npm"] },
  { process: "socat", ancestors: ["pip"] },
];

export const DEFAULT_BLOCKED_EXECUTABLES: string[] = [
  "nc",
  "ncat",
  "nmap",
  "socat",
  "trufflehog",
];

export const DEFAULT_DNS_SERVERS: string[] = [
  "8.8.8.8",
  "8.8.4.4",
  "1.1.1.1",
  "1.0.0.1",
];

export const DEFAULT_FILE_MONITORED_PATHS: string[] = [
  "/.npmrc",
  "/.pypirc",
  "/pip.conf",
  "/.ssh/",
  "/.aws/",
  "/.azure/",
  "/.config/gcloud/",
  "/var/run/secrets/",
  "/.kube/config",
  "/.config/gh/",
];

export const DEFAULT_FILE_PROTECTED_PATHS: string[] = [
  "/etc/sudoers",
  "/etc/sudoers.d/",
  "/etc/passwd",
  "/etc/shadow",
  "/root/.ssh/authorized_keys",
];

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

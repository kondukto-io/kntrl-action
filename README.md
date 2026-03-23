# kntrl GitHub Action

eBPF-based runtime security for GitHub Actions. Monitors and enforces network, process, DNS, and file access policies directly on the CI/CD runner — stopping supply chain attacks like [Shai-Hulud](https://unit42.paloaltonetworks.com/npm-supply-chain-attack/) before they exfiltrate secrets.

## How it works

kntrl attaches eBPF probes to the Linux kernel on the GitHub Actions runner. Every network connection, process execution, DNS query, and file access is evaluated against a policy in real time. In **monitor** mode it logs events; in **trace** mode it actively blocks violations by dropping packets and killing processes.

```
┌─────────────────────────────────────────────────────┐
│  GitHub Actions Runner (Linux)                      │
│                                                     │
│  ┌───────────┐   ┌──────────┐   ┌───────────────┐  │
│  │ npm install│──>│ postinst │──>│ curl webhook.. │  │
│  └───────────┘   └──────────┘   └───────┬───────┘  │
│                                         │           │
│  ════════════════ eBPF ═════════════════╪═══════    │
│                                         │           │
│  ┌──────────────────────────────────────▼────────┐  │
│  │ kntrl: network blocked (exfil domain denied)  │  │
│  │ kntrl: process killed (curl from npm ancestor)│  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Quick start

Add kntrl to your workflow **before** any build/install steps:

```yaml
name: Build
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # 1. Start kntrl FIRST — it monitors everything that follows
      - uses: kondukto-io/kntrl-action@v1

      - uses: actions/checkout@v4

      - run: npm install
      - run: npm test

      # 2. Stop kntrl and print the report (always runs, even on failure)
      - uses: kondukto-io/kntrl-action/stop@v1
        if: always()
```

All built-in rules are enabled by default: network allowlists, process chain blocking, DNS server restrictions, file monitoring, and OPA supply chain protection.

The stop step prints a detailed table of all network connections, DNS queries, process executions, and file access events captured during the job.

## Enforce mode

Switch from monitoring to active blocking:

```yaml
- uses: kondukto-io/kntrl-action@v1
  with:
    mode: trace  # "monitor" (default) = log only, "trace" = enforce/block

# ... your build steps ...

- uses: kondukto-io/kntrl-action/stop@v1
  if: always()
```

## What the default rules protect against

### Network
- Only allows traffic to npm registry, PyPI, GitHub, and common CDNs
- Blocks cloud metadata endpoints (`169.254.169.254`) to prevent credential theft
- Dynamically allows GitHub Actions infrastructure IPs
- Per-process network profiles lock `npm`/`node` to npmjs.org and `pip`/`python` to pypi.org

### Process
- Blocks dangerous process chains: `curl`/`wget`/`bash`/`sh` spawned from `npm`/`node`/`pip`
- Blocks scripting interpreters (`python`, `perl`, `ruby`) spawned from `npm` postinstall
- Kills dangerous executables at exec time: `nc`, `ncat`, `nmap`, `socat`, `trufflehog`

### DNS
- Restricts DNS to well-known resolvers (Google `8.8.8.8`/`8.8.4.4`, Cloudflare `1.1.1.1`/`1.0.0.1`)

### File
- Monitors access to sensitive files: `.npmrc`, `.ssh/`, `.aws/`, `.kube/config`, `/var/run/secrets/`
- Protects system files from writes: `/etc/sudoers`, `/etc/passwd`, `/etc/shadow`
- Tracks environment variable access: `NPM_TOKEN`, `GITHUB_TOKEN`, `AWS_SECRET_ACCESS_KEY`, and more

### OPA supply chain rules
- Blocks known exfiltration domains: `webhook.site`, `ngrok.io`, `pastebin.com`, `pipedream.net`, `transfer.sh`, and more
- Blocks cloud metadata access from package manager process trees
- Locks npm/node child processes to the npm registry only
- Locks pip/python child processes to PyPI only

---

## Stopping real-world attacks

### Example: Shai-Hulud npm worm

[Shai-Hulud](https://unit42.paloaltonetworks.com/npm-supply-chain-attack/) is an npm supply chain worm discovered in 2025 that spreads through postinstall hooks. It steals npm tokens, GitHub credentials, cloud provider keys, and SSH keys — then uses them to propagate to other packages.

**Attack chain:**

1. `npm install` triggers a malicious `postinstall` script
2. The script reads `~/.npmrc` to steal the npm auth token
3. It harvests `GITHUB_TOKEN`, `AWS_ACCESS_KEY_ID`, and other secrets from the environment
4. Credentials are exfiltrated to `webhook.site` or a similar paste service
5. The worm accesses `api.github.com` to create repos and store stolen tokens
6. It fetches other victims' stolen tokens from `raw.githubusercontent.com`
7. It attempts to reach cloud metadata (`169.254.169.254`) for instance credentials
8. A dead man's switch runs `shred` on the runner if detected

**kntrl blocks every stage with default rules:**

```yaml
# Default rules are sufficient — no extra config needed
- uses: kondukto-io/kntrl-action@v1
  with:
    mode: trace
```

| Attack stage | kntrl defense layer |
|---|---|
| postinstall spawns `curl` | **Process rule**: `curl` with `npm` ancestor → blocked |
| Exfil to `webhook.site` | **OPA rule**: exfiltration domain blocklist → denied |
| Read `~/.npmrc` | **File rule**: `/.npmrc` monitored → alerted |
| Harvest `GITHUB_TOKEN` env | **File rule**: `GITHUB_TOKEN` env var monitored → alerted |
| Access `api.github.com` from npm child | **OPA rule**: npm ancestry + github API → denied |
| Fetch from `raw.githubusercontent.com` | **OPA rule**: npm ancestry + raw github content → denied |
| Cloud metadata `169.254.169.254` | **Network rule**: metadata endpoint blocked + **OPA rule**: npm ancestry + metadata IP → denied |
| `shred` dead man's switch | **Process rule**: `shred` in blocked executables → SIGKILL |
| Reverse shell via `nc` | **Process rule**: `nc` in blocked executables → SIGKILL |

### Example: Hardened Shai-Hulud protection

For maximum protection against Shai-Hulud and similar npm worms, add Bun runtime blocking and extra file protections:

```yaml
- uses: kondukto-io/kntrl-action@v1
  with:
    mode: trace
    # Block Bun (Shai-Hulud v2 evasion) and destructive tools
    extra_blocked_executables: "bun,shred"
    # Block Bun spawned from npm (evasion technique)
    extra_blocked_chains: |
      [
        {"process": "bun", "ancestors": ["npm"]},
        {"process": "bun", "ancestors": ["node"]},
        {"process": "config.sh", "ancestors": ["npm"]},
        {"process": "rm", "ancestors": ["npm"]},
        {"process": "xargs", "ancestors": ["npm"]}
      ]
    # Monitor additional paths
    extra_monitored_paths: "/.gitconfig,/.netrc"
    extra_monitored_env_vars: "GITLAB_TOKEN,RUNNER_TOKEN"
```

### Example: Preventing PyPI supply chain attacks

Attacks like [ultralytics hijack](https://blog.yossarian.net/2024/12/06/zizmor-ultralytics-injection) compromise PyPI packages to steal credentials during `pip install`:

```yaml
- uses: kondukto-io/kntrl-action@v1
  with:
    mode: trace
    extra_blocked_chains: |
      [
        {"process": "curl", "ancestors": ["python"]},
        {"process": "wget", "ancestors": ["python"]},
        {"process": "bash", "ancestors": ["pip"]},
        {"process": "sh", "ancestors": ["pip"]}
      ]
```

### Example: Multi-ecosystem build (npm + pip + Maven)

```yaml
- uses: kondukto-io/kntrl-action@v1
  with:
    mode: trace
    allowed_hosts: "repo1.maven.org,.maven.org,.gradle.org,plugins.gradle.org"
    network_profiles: |
      [
        {"process": "maven", "allowed_hosts": ["repo1.maven.org", ".maven.org"]},
        {"process": "gradle", "allowed_hosts": [".gradle.org", "plugins.gradle.org", "repo1.maven.org"]}
      ]
    extra_blocked_chains: |
      [
        {"process": "curl", "ancestors": ["maven"]},
        {"process": "curl", "ancestors": ["gradle"]},
        {"process": "wget", "ancestors": ["maven"]},
        {"process": "wget", "ancestors": ["gradle"]}
      ]
```

---

## Cloud reporting

Send runtime events and reports to [kntrl Cloud](https://github.com/kondukto-io/kntrl) for centralized visibility:

```yaml
- uses: kondukto-io/kntrl-action@v1
  with:
    mode: trace
    api_url: ${{ secrets.KNTRL_API_URL }}
    api_key: ${{ secrets.KNTRL_API_KEY }}
```

---

## Customization

### Toggle default rules

Each rule category can be independently enabled or disabled:

```yaml
- uses: kondukto-io/kntrl-action@v1
  with:
    enable_default_network_rules: "true"         # npm, PyPI, GitHub hosts
    enable_default_process_rules: "true"          # blocked chains & executables
    enable_default_dns_rules: "true"              # Google & Cloudflare resolvers
    enable_default_file_rules: "true"             # sensitive file monitoring
    enable_default_supply_chain_rego: "true"      # OPA exfil/metadata/registry rules
```

### Add extra allowed hosts

```yaml
- uses: kondukto-io/kntrl-action@v1
  with:
    allowed_hosts: ".myregistry.internal,api.myservice.io"
    allowed_ips: "203.0.113.0/24"
```

### Custom OPA rules

Write your own `.rego` file for advanced policy logic:

```rego
# .github/kntrl/custom.rego
package kntrl
import rego.v1

# Block any process from accessing internal admin endpoints
ancestry_denied if {
    some domain in input.domains
    endswith(domain, "admin.internal.io")
}
```

```yaml
- uses: kondukto-io/kntrl-action@v1
  with:
    mode: trace
    custom_rego_file: .github/kntrl/custom.rego
```

### Custom YAML rules

Provide a full rules file or directory for complete control:

```yaml
- uses: kondukto-io/kntrl-action@v1
  with:
    mode: trace
    custom_rules_file: .github/kntrl/rules.yaml
    # OR load all .yaml and .rego files from a directory
    custom_rules_dir: .github/kntrl/
```

### Network controls

```yaml
- uses: kondukto-io/kntrl-action@v1
  with:
    allow_local_ranges: "true"     # RFC 1918 private ranges (default: true)
    allow_github_meta: "true"      # GitHub Actions infra IPs (default: true)
    allow_metadata: "false"        # Cloud metadata endpoints (default: false)
```

---

## Inputs reference

| Input | Default | Description |
|-------|---------|-------------|
| `mode` | `monitor` | `monitor` (log only) or `trace` (enforce/block) |
| `kntrl_version` | `v0.1.11` | kntrl release version |
| `api_url` | | kntrl Cloud API URL |
| `api_key` | | kntrl Cloud API key |
| `enable_default_network_rules` | `true` | Built-in network allowlists |
| `enable_default_process_rules` | `true` | Built-in process chain blocking |
| `enable_default_dns_rules` | `true` | Built-in DNS server allowlist |
| `enable_default_file_rules` | `true` | Built-in file monitoring |
| `enable_default_supply_chain_rego` | `true` | Built-in OPA supply chain rules |
| `allowed_hosts` | | Extra allowed hostnames (comma-separated) |
| `allowed_ips` | | Extra allowed IPs/CIDRs (comma-separated) |
| `allow_local_ranges` | `true` | Allow RFC 1918 ranges |
| `allow_github_meta` | `true` | Allow GitHub Actions IPs |
| `allow_metadata` | `false` | Allow cloud metadata endpoints |
| `extra_blocked_executables` | | Extra executables to block (comma-separated) |
| `extra_monitored_paths` | | Extra file paths to monitor (comma-separated) |
| `extra_protected_paths` | | Extra file paths to protect (comma-separated) |
| `extra_monitored_env_vars` | | Extra env vars to monitor (comma-separated) |
| `custom_rules_file` | | Path to custom YAML rules file |
| `custom_rules_dir` | | Path to directory with custom .yaml/.rego files |
| `custom_rego_file` | | Path to custom .rego file |
| `network_profiles` | | Per-process network profiles (JSON array) |
| `extra_blocked_chains` | | Extra process blocked chains (JSON array) |

## Outputs

| Output | Description |
|--------|-------------|
| `report_file` | Path to the kntrl JSON report file |
| `exit_code` | kntrl exit code (non-zero if violations found in trace mode) |

---

## Requirements

- **Runner**: `ubuntu-latest` (or any Linux runner with kernel 5.8+)
- **Permissions**: The action uses `sudo` to install and run kntrl (available by default on GitHub-hosted runners)

## License

Apache 2.0 - See [kntrl](https://github.com/kondukto-io/kntrl) for details.
